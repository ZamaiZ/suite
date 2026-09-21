"use client"

import { useEffect, useRef } from "react"
import {
  RiAlertLine,
  RiCheckLine,
  RiPlayLine,
  RiSearchLine,
} from "react-icons/ri"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { StepCard } from "@/components/custom/LeadStepShell"
import type { ResearchPlan, ResearchStartSummary } from "@/app/actions/clients/research-run"
import type { SerpQueueProgress } from "@/lib/research/serp-queue"
import { EMPTY_VALUE } from "./presenters"

/**
 * O disparo da pesquisa, em três passos com confirmação separada.
 *
 * A separação não é estética: os três custam ordens de grandeza diferentes.
 * Conferir é gratuito, expandir custa centavos, e a coleta de SERP é ~60% do
 * preço da fase. Um botão só esconderia do analista o único número que ele
 * precisa ver antes de gastar — quantas buscas serão compradas.
 */

export type RunnerStage = "idle" | "planned" | "started" | "collecting" | "done"

export type ClientResearchRunnerProps = {
  plan: ResearchPlan | null
  summary: ResearchStartSummary | null
  progress: SerpQueueProgress | null
  stage: RunnerStage
  busy: boolean
  error: string | null
  onPlan: () => void
  onStart: () => void
  onCollect: () => void
  onCompile: () => void
}

export function ClientResearchRunner({
  plan,
  summary,
  progress,
  stage,
  busy,
  error,
  onPlan,
  onStart,
  onCollect,
  onCompile,
}: ClientResearchRunnerProps) {
  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <Alert variant="destructive">
          <RiAlertLine aria-hidden />
          <AlertTitle>A pesquisa parou</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <StepCard title="1. Conferir o briefing">
        <p className="text-xs text-muted-foreground">
          Lê as palavras-chave e as cidades, e resolve a localidade de cada uma.
          Não gasta nada.
        </p>

        {plan ? (
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <PlanFact label="Palavra principal" value={plan.primaryKeyword} />
            <PlanFact label="Palavras-chave" value={String(plan.seedCount)} />
            <PlanFact label="Cidades" value={String(plan.cities.length)} />
            <PlanFact
              label="Bairros"
              value={
                plan.neighborhoodCount > 0
                  ? String(plan.neighborhoodCount)
                  : EMPTY_VALUE
              }
              hint={plan.neighborhoodCount > 0 ? undefined : "não informados"}
            />
          </dl>
        ) : null}

        {plan ? <CityList cities={plan.cities} /> : null}

        {plan?.warnings.length ? (
          <ul className="mt-3 flex flex-col gap-1.5">
            {plan.warnings.map((aviso) => (
              <li
                key={aviso.code}
                className="flex items-start gap-1.5 text-xs text-warning"
              >
                <RiAlertLine aria-hidden className="mt-0.5 shrink-0" />
                <span>{aviso.message}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <Button
          className="mt-3"
          variant={plan ? "outline" : "default"}
          disabled={busy}
          onClick={onPlan}
        >
          {busy && stage === "idle" ? <Spinner /> : <RiSearchLine aria-hidden />}
          {plan ? "Conferir de novo" : "Conferir briefing"}
        </Button>
      </StepCard>

      <StepCard title="2. Expandir as palavras-chave">
        <p className="text-xs text-muted-foreground">
          Descobre o que o cliente não listou, cruzando com quem já rankeia.
          {plan
            ? ` São ${plan.expansionCalls} consultas ao provedor.`
            : " Confira o briefing primeiro."}
        </p>

        {summary ? (
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <PlanFact
              label="Candidatas"
              value={summary.candidatesFound.toLocaleString("pt-BR")}
            />
            <PlanFact
              label="Descobertas"
              value={summary.discovered.toLocaleString("pt-BR")}
              hint="fora do briefing"
            />
            <PlanFact
              label="Buscas a comprar"
              value={summary.serpCalls.toLocaleString("pt-BR")}
              hint="depois do filtro"
            />
            <PlanFact
              label="Custo da expansão"
              value={`US$ ${summary.expansionCostUsd.toFixed(2)}`}
            />
          </dl>
        ) : null}

        {summary?.unconfirmedSeeds.length ? (
          <p className="mt-3 text-xs text-warning">
            {summary.unconfirmedSeeds.length === 1
              ? "Uma palavra do briefing não apareceu em nenhuma expansão: "
              : `${summary.unconfirmedSeeds.length} palavras do briefing não apareceram em nenhuma expansão: `}
            {summary.unconfirmedSeeds.join(", ")}. Elas seguem para a coleta
            mesmo assim, para receberem veredito.
          </p>
        ) : null}

        {summary?.failures.length ? (
          <ul className="mt-3 flex flex-col gap-1">
            {summary.failures.map((falha, i) => (
              <li key={i} className="text-xs text-destructive">
                {falha}
              </li>
            ))}
          </ul>
        ) : null}

        <Button
          className="mt-3"
          disabled={!plan || busy || Boolean(summary)}
          onClick={onStart}
        >
          {busy && stage === "planned" ? <Spinner /> : <RiPlayLine aria-hidden />}
          Expandir
        </Button>
      </StepCard>

      <StepCard title="3. Coletar as buscas">
        <p className="text-xs text-muted-foreground">
          {summary
            ? `Compra ${summary.serpCalls.toLocaleString("pt-BR")} consultas de busca. É o passo mais caro da pesquisa.`
            : "Disponível depois da expansão."}
        </p>

        {progress ? <QueueProgress progress={progress} /> : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            disabled={!summary || busy || progress?.settled}
            onClick={onCollect}
          >
            {busy && stage === "collecting" ? (
              <Spinner />
            ) : (
              <RiPlayLine aria-hidden />
            )}
            {progress && progress.done > 0 ? "Continuar coleta" : "Coletar"}
          </Button>

          <Button
            variant="outline"
            disabled={!progress?.settled || busy}
            onClick={onCompile}
          >
            <RiCheckLine aria-hidden />
            Compilar resultado
          </Button>
        </div>
      </StepCard>
    </div>
  )
}

function PlanFact({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-semibold tabular-nums text-foreground">
        {value}
      </dd>
      {hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

/**
 * As cidades com o que foi resolvido para cada uma.
 *
 * A queda para o estado é dita, não escondida: uma cidade medida num raio
 * maior não é a mesma coisa que uma cidade medida, e o relatório não pode
 * afirmar precisão que não teve.
 */
function CityList({ cities }: { cities: ResearchPlan["cities"] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-1.5">
      {cities.map((cidade) => (
        <li key={`${cidade.name}-${cidade.stateCode}`}>
          <Badge
            variant={
              cidade.locationCode === null
                ? "destructive"
                : cidade.granularity === "state"
                  ? "warning"
                  : cidade.isPrimary
                    ? "primary"
                    : "muted"
            }
          >
            {cidade.name}
            {cidade.isPrimary ? " · principal" : ""}
            {cidade.locationCode === null
              ? " · sem localidade"
              : cidade.granularity === "state"
                ? " · medida no estado"
                : ""}
          </Badge>
        </li>
      ))}
    </ul>
  )
}

/**
 * Progresso da fila.
 *
 * `failed` aparece separado de `done` de propósito: coleta que não aconteceu e
 * busca sem resultado orgânico são coisas diferentes, e somá-las faria uma
 * coleta quebrada parecer um mercado vazio.
 */
function QueueProgress({ progress }: { progress: SerpQueueProgress }) {
  const concluidas = progress.done + progress.failed
  const share = progress.total > 0 ? concluidas / progress.total : 0

  return (
    <div className="mt-3">
      <Progress value={share * 100}>
        <ProgressTrack>
          <ProgressIndicator />
        </ProgressTrack>
      </Progress>
      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
        <Tally label="coletadas" value={progress.done} tone="text-foreground" />
        <Tally label="na fila" value={progress.queued} tone="text-muted-foreground" />
        <Tally label="a enviar" value={progress.pending} tone="text-muted-foreground" />
        {progress.failed > 0 ? (
          <Tally label="falharam" value={progress.failed} tone="text-destructive" />
        ) : null}
        {progress.exhausted > 0 ? (
          <Tally
            label="sem nova tentativa"
            value={progress.exhausted}
            tone="text-destructive"
          />
        ) : null}
      </dl>
    </div>
  )
}

function Tally({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: string
}) {
  return (
    <div className="flex items-baseline gap-1">
      <dt className="sr-only">{label}</dt>
      <dd className={`font-semibold tabular-nums ${tone}`}>{value}</dd>
      <span className="text-muted-foreground">{label}</span>
    </div>
  )
}

/**
 * Poll enquanto houver tarefa em aberto.
 *
 * A dependência é **`progress.total` e `settled`**, nunca o objeto `progress`:
 * objeto vindo de props ganha identidade nova a cada resposta, e o intervalo
 * reiniciaria a cada ciclo sem nunca completar.
 */
export function useSerpPolling({
  enabled,
  settled,
  total,
  onTick,
  intervalMs = 8000,
}: {
  enabled: boolean
  settled: boolean
  total: number
  onTick: () => void
  intervalMs?: number
}) {
  // O callback muda de identidade a cada render do pai. Guardá-lo num ref
  // atualizado por efeito — nunca no corpo do render — mantém o intervalo fora
  // da lista de dependências, que é o que impede o ciclo de reiniciar antes de
  // completar.
  const tickRef = useRef(onTick)
  useEffect(() => {
    tickRef.current = onTick
  })

  useEffect(() => {
    if (!enabled || settled || total === 0) return
    const id = window.setInterval(() => tickRef.current(), intervalMs)
    return () => window.clearInterval(id)
  }, [enabled, settled, total, intervalMs])
}
