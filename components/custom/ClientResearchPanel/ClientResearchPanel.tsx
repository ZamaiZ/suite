"use client"

import { useCallback, useState } from "react"
import {
  RiGroupLine,
  RiPriceTag3Line,
  RiSearchEyeLine,
  RiSparkling2Line,
} from "react-icons/ri"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { StepStat, StepTabs, type StepTabDef } from "@/components/custom/LeadStepShell"
import {
  compileResearch,
  type CompileResearchState,
} from "@/app/actions/clients/research-compile"
import {
  planResearch,
  startResearch,
  type ResearchPlan,
  type ResearchStartSummary,
} from "@/app/actions/clients/research-run"
import {
  pollResearchSerpTasks,
  postResearchSerpTasks,
} from "@/app/actions/clients/research-serp"
import type { ClientResearchSnapshot } from "@/lib/research/types"
import type { SerpQueueProgress } from "@/lib/research/serp-queue"
import {
  ClientResearchRunner,
  useSerpPolling,
  type RunnerStage,
} from "./ClientResearchRunner"
import {
  ClientResearchClusters,
  ClientResearchCompetitors,
  ClientResearchVerdicts,
} from "./ClientResearchViews"
import { researchHeadline } from "./presenters"

/**
 * Etapa de Pesquisa do cliente.
 *
 * Segue o arquétipo de painel de trabalho: cabeçalho fora do scroll, quatro
 * números que são as manchetes das abas, e só o corpo rolando. O `min-h-0` no
 * filho do grid é obrigatório — sem ele a coluna estoura em vez de rolar, e o
 * defeito só aparece com conteúdo longo.
 *
 * Não tem coluna de oportunidades: oportunidade é decisão, e decisão é a fase
 * seguinte. A pesquisa entrega inteligência e recomendação, não plano.
 */

type TabId = "coleta" | "temas" | "concorrentes" | "palavras"

const TABS: ReadonlyArray<StepTabDef<TabId>> = [
  { id: "coleta", label: "Coleta" },
  { id: "temas", label: "Temas" },
  { id: "concorrentes", label: "Concorrentes" },
  { id: "palavras", label: "Palavras do briefing" },
]

export type ClientResearchPanelProps = {
  clientId: string
  companyName: string
  /** Domínio do cliente, para separar o próprio site dos concorrentes. */
  selfDomain: string
  /** A pesquisa mais recente, quando já houve uma. */
  snapshot: ClientResearchSnapshot | null
  /** Fingerprint corrente do briefing, para saber se a pesquisa defasou. */
  currentFingerprint: string | null
}

export function ClientResearchPanel({
  clientId,
  companyName,
  selfDomain,
  snapshot,
  currentFingerprint,
}: ClientResearchPanelProps) {
  const [tab, setTab] = useState<TabId>(snapshot ? "temas" : "coleta")
  const [runId] = useState(() => crypto.randomUUID())
  const [plan, setPlan] = useState<ResearchPlan | null>(null)
  const [summary, setSummary] = useState<ResearchStartSummary | null>(null)
  const [progress, setProgress] = useState<SerpQueueProgress | null>(null)
  const [stage, setStage] = useState<RunnerStage>("idle")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [compiled, setCompiled] = useState<CompileResearchState | null>(null)

  const headline = researchHeadline(snapshot)

  const defasada =
    snapshot !== null &&
    currentFingerprint !== null &&
    snapshot.input.briefingFingerprint !== currentFingerprint

  const handlePlan = useCallback(async () => {
    setBusy(true)
    setError(null)
    const resultado = await planResearch({ clientId })
    setBusy(false)
    if (resultado.status === "success") {
      setPlan(resultado.plan)
      setStage("planned")
      return
    }
    setPlan(null)
    setError(
      resultado.status === "refused"
        ? resultado.refusals.map((r) => r.message).join(" ")
        : resultado.message,
    )
  }, [clientId])

  const handleStart = useCallback(async () => {
    setBusy(true)
    setError(null)
    const resultado = await startResearch({ clientId, runId })
    setBusy(false)
    if (resultado.status === "success") {
      setSummary(resultado.summary)
      setStage("started")
      return
    }
    setError(
      resultado.status === "refused"
        ? resultado.refusals.map((r) => r.message).join(" ")
        : resultado.message,
    )
  }, [clientId, runId])

  const handleCollect = useCallback(async () => {
    setBusy(true)
    setError(null)
    setStage("collecting")
    const enfileirado = await postResearchSerpTasks(runId)
    if (enfileirado.status === "error") {
      setBusy(false)
      setError(enfileirado.message)
      return
    }
    setProgress(enfileirado.progress)
    const coletado = await pollResearchSerpTasks(runId)
    setBusy(false)
    if (coletado.status === "error") {
      setError(coletado.message)
      return
    }
    setProgress(coletado.progress)
  }, [runId])

  const handleTick = useCallback(async () => {
    const resultado = await pollResearchSerpTasks(runId)
    if (resultado.status === "success") setProgress(resultado.progress)
  }, [runId])

  const handleCompile = useCallback(async () => {
    if (!plan) return
    setBusy(true)
    setError(null)
    const resultado = await compileResearch({
      clientId,
      runId,
      selfDomain,
      briefingFingerprint: plan.briefingFingerprint,
      seeds: plan.seeds,
    })
    setBusy(false)
    setCompiled(resultado)
    if (resultado.status === "error") setError(resultado.message)
    if (resultado.status === "success") setStage("done")
  }, [clientId, plan, runId, selfDomain])

  // Dependências são chave e escalar, nunca o objeto `progress`: objeto de
  // estado ganha identidade nova a cada resposta e reiniciaria o intervalo
  // antes de ele completar um ciclo.
  useSerpPolling({
    enabled: stage === "collecting",
    settled: progress?.settled ?? true,
    total: progress?.total ?? 0,
    onTick: handleTick,
  })

  const counts: Record<TabId, number> = {
    coleta: progress && !progress.settled ? progress.pending + progress.queued : 0,
    temas: snapshot?.clusters.length ?? 0,
    concorrentes: snapshot?.competitors.length ?? 0,
    palavras: snapshot?.verdicts.length ?? 0,
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as TabId)}
      className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-0"
    >
      <header className="border-b border-border px-[var(--page-padding-x)] pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Pesquisa · {companyName}</h2>
          {defasada ? (
            <p className="text-[11px] text-warning">
              O briefing mudou depois desta pesquisa. Rode de novo para os
              números acompanharem.
            </p>
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <HeadlineStat
            icon={RiPriceTag3Line}
            label="Temas"
            fact={headline.clusters}
            onClick={() => setTab("temas")}
          />
          <HeadlineStat
            icon={RiGroupLine}
            label="Concorrentes"
            fact={headline.competitors}
            onClick={() => setTab("concorrentes")}
          />
          <HeadlineStat
            icon={RiSparkling2Line}
            label="Descobertas"
            fact={headline.discovered}
            onClick={() => setTab("temas")}
          />
          <HeadlineStat
            icon={RiSearchEyeLine}
            label="Palavras de pé"
            fact={headline.verdicts}
            tone={headline.verdicts.tone}
            onClick={() => setTab("palavras")}
          />
        </div>

        <StepTabs
          tabs={TABS}
          counts={counts}
          value={tab}
          layoutId="client-research-tabs"
          ariaLabel="Seções da pesquisa"
        />
      </header>

      <div className="min-h-0 overflow-y-auto bg-accent/45 px-[var(--page-padding-x)] py-4">
        {/* `keepMounted`: a aba de coleta guarda a fila e o polling em curso —
            desmontar perderia o progresso e recomeçaria a contagem. */}
        <TabsContent value="coleta" keepMounted>
          <ClientResearchRunner
            plan={plan}
            summary={summary}
            progress={progress}
            stage={stage}
            busy={busy}
            error={error}
            onPlan={handlePlan}
            onStart={handleStart}
            onCollect={handleCollect}
            onCompile={handleCompile}
          />
          {compiled?.status === "success" ? (
            <p className="mt-3 text-xs text-success">
              Pesquisa compilada: {compiled.clusters} temas e{" "}
              {compiled.competitors} concorrentes de referência. Recarregue para
              ver o resultado nas outras abas.
            </p>
          ) : null}
          {compiled?.status === "incomplete" ? (
            <p className="mt-3 text-xs text-warning">
              Ainda há {compiled.pending + compiled.queued} buscas em aberto.
              Compilar agora gravaria um retrato que muda na próxima passada.
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="temas">
          {snapshot ? (
            <ClientResearchClusters snapshot={snapshot} />
          ) : (
            <SemPesquisa onStart={() => setTab("coleta")} />
          )}
        </TabsContent>

        <TabsContent value="concorrentes">
          {snapshot ? (
            <ClientResearchCompetitors snapshot={snapshot} />
          ) : (
            <SemPesquisa onStart={() => setTab("coleta")} />
          )}
        </TabsContent>

        <TabsContent value="palavras">
          {snapshot ? (
            <ClientResearchVerdicts snapshot={snapshot} />
          ) : (
            <SemPesquisa onStart={() => setTab("coleta")} />
          )}
        </TabsContent>
      </div>
    </Tabs>
  )
}

function HeadlineStat({
  icon,
  label,
  fact,
  tone,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>
  label: string
  fact: { value: string; hint: string }
  tone?: Parameters<typeof StepStat>[0]["tone"]
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // O rótulo visível não diz que clicar leva a algum lugar.
      aria-label={`${label}: ver a seção`}
      className="cursor-pointer text-left"
    >
      <StepStat
        icon={icon as never}
        label={label}
        value={fact.value}
        hint={fact.hint}
        tone={tone}
      />
    </button>
  )
}

/** Vazio por falta de pesquisa, não por filtro — a ação é começar uma. */
function SemPesquisa({ onStart }: { onStart: () => void }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <RiSearchEyeLine aria-hidden />
        </EmptyMedia>
        <EmptyTitle>Nenhuma pesquisa foi feita ainda</EmptyTitle>
        <EmptyDescription>
          A pesquisa parte das palavras-chave e das cidades do briefing, e
          devolve os temas, os concorrentes e um veredito por palavra.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={onStart}>Começar pela coleta</Button>
      </EmptyContent>
    </Empty>
  )
}
