"use client"

import { useCallback, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  RiAlertLine,
  RiDatabase2Line,
  RiPlayLine,
  RiRefreshLine,
} from "react-icons/ri"
import { cn } from "cn"

import {
  enqueueProspectEnrichment,
  pollProspectDiscovery,
  pollProspectEnrichment,
  resumeProspectDiscovery,
} from "@/app/actions/prospect"
import { useQueuePolling } from "@/hooks/use-queue-polling"
import { remainingMinutes } from "@/lib/prospect/pipeline"
import type { PipelineProgress } from "./ProspectWorkspace.types"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"

const NUM = new Intl.NumberFormat("pt-BR")

/**
 * O motor da campanha, e a barra que diz o que está acontecendo.
 *
 * O scheduler é esta aba. Tudo que a passada faz está gravado no banco, então
 * fechar a aba não perde nada — mas também nada avança. Por isso a tela diz
 * quanto falta **em minutos**, e não só em porcentagem: quem precisa decidir
 * se espera ou volta depois precisa do número, não de uma barra em 37%.
 */
export function ProspectRunner({
  campaignId,
  status,
  discovered,
  target,
  universeCount,
  progress,
  selectedIds,
  errorMessage,
}: {
  campaignId: string
  status: string
  discovered: number
  target: number
  universeCount: number | null
  progress: PipelineProgress
  selectedIds: string[]
  errorMessage: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [aviso, setAviso] = useState<string | null>(null)

  // Sem esta guarda o intervalo empilha chamadas quando uma passada demora
  // mais que o intervalo — e cada uma é uma server action inteira.
  const emVooRef = useRef(false)

  const descobrindo = status === "draft" || status === "discovering"
  const coletaPronta = status === "discovered"

  const tickDescoberta = useCallback(() => {
    if (emVooRef.current) return
    emVooRef.current = true
    void pollProspectDiscovery(campaignId)
      .then((r) => {
        if (r.status === "error") setAviso(r.message)
        else if (r.status === "success") setAviso(null)
        router.refresh()
      })
      .finally(() => {
        emVooRef.current = false
      })
  }, [campaignId, router])

  const tickEnriquecimento = useCallback(() => {
    if (emVooRef.current) return
    emVooRef.current = true
    void pollProspectEnrichment(campaignId)
      .then((r) => {
        if (r.status === "error") setAviso(r.message)
        router.refresh()
      })
      .finally(() => {
        emVooRef.current = false
      })
  }, [campaignId, router])

  useQueuePolling({
    enabled: descobrindo,
    settled: coletaPronta,
    total: target,
    onTick: tickDescoberta,
    // Descoberta é síncrona no provedor e volta em segundos.
    intervalMs: 2500,
  })

  useQueuePolling({
    enabled: coletaPronta && progress.total > 0,
    settled: progress.settled,
    total: progress.total,
    onTick: tickEnriquecimento,
    // Enriquecimento tem etapa paga na fila do provedor; 8 s é o intervalo que
    // o resto do repositório usa para o mesmo caso.
    intervalMs: 8000,
  })

  function enriquecer() {
    setAviso(null)
    startTransition(async () => {
      const r = await enqueueProspectEnrichment(campaignId, selectedIds)
      if (r.status === "error") {
        setAviso(r.message)
        return
      }
      tickEnriquecimento()
      router.refresh()
    })
  }

  function retomar() {
    setAviso(null)
    startTransition(async () => {
      await resumeProspectDiscovery(campaignId)
      tickDescoberta()
      router.refresh()
    })
  }

  const pctDescoberta = target > 0 ? Math.min(100, (discovered / target) * 100) : 0
  const assentadas = progress.done + progress.failed
  const pctEnriquecimento =
    progress.total > 0 ? (assentadas / progress.total) * 100 : 0
  const faltam = remainingMinutes(progress)

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-xs/relaxed font-medium">
            {descobrindo ? "Descobrindo empresas" : "Coleta concluída"}
          </span>
          <span className="text-muted-foreground text-xs/relaxed tabular-nums">
            {NUM.format(discovered)} de {NUM.format(target)}
            {universeCount ? ` · ${NUM.format(universeCount)} na área` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {status === "failed" || (descobrindo && !pending) ? (
            <Button
              type="button"
              variant="outline"
              onClick={retomar}
              disabled={pending}
            >
              {pending ? <Spinner aria-hidden /> : <RiRefreshLine aria-hidden />}
              Retomar
            </Button>
          ) : null}
          {coletaPronta ? (
            <Button
              type="button"
              onClick={enriquecer}
              disabled={pending || selectedIds.length === 0}
            >
              {pending ? <Spinner aria-hidden /> : <RiDatabase2Line aria-hidden />}
              Enriquecer
              {selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
            </Button>
          ) : (
            <Button type="button" onClick={tickDescoberta} disabled={pending}>
              {pending ? <Spinner aria-hidden /> : <RiPlayLine aria-hidden />}
              Coletar
            </Button>
          )}
        </div>
      </div>

      <Progress value={descobrindo ? pctDescoberta : pctEnriquecimento} />

      {progress.stages.length > 0 ? (
        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {progress.stages.map((s) => (
            <div key={s.stage} className="flex items-baseline gap-1.5">
              <dt className="text-muted-foreground">{s.label}</dt>
              <dd className="font-semibold tabular-nums">
                {NUM.format(s.hits)}
              </dd>
              <span className="text-muted-foreground tabular-nums">
                / {NUM.format(s.total)}
              </span>
              {/* `failed` separado de `done`: coleta que não aconteceu e busca
                  sem resultado são coisas diferentes, e somá-las faria uma
                  coleta quebrada parecer um mercado vazio. */}
              {s.failed > 0 ? (
                <span className="text-destructive tabular-nums">
                  · {NUM.format(s.failed)} falhou
                </span>
              ) : null}
            </div>
          ))}
          {faltam !== null ? (
            <span className="text-muted-foreground ml-auto">
              ~{faltam} min restantes — mantenha esta aba aberta
            </span>
          ) : null}
        </dl>
      ) : null}

      {aviso || errorMessage ? (
        <p
          role="alert"
          aria-live="polite"
          className={cn(
            "flex items-start gap-1.5 text-xs/relaxed",
            "text-destructive",
          )}
        >
          <RiAlertLine aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {aviso ?? errorMessage}
        </p>
      ) : null}
    </div>
  )
}
