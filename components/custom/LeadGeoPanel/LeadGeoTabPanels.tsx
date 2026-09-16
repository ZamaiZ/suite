"use client"

import type { ReactNode } from "react"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  StepCard,
  StepCountCell,
  StepSectionLabel,
} from "@/components/custom/LeadStepShell"
import { LeadVisibilityRankedList } from "@/components/custom/LeadVisibilityPanel/LeadVisibilityRankedList"
import { PROVIDER_LABELS, pct } from "./geo-format"
import { LeadGeoAccessBoard } from "./LeadGeoAccessBoard"
import { LeadGeoBrandLeaderboard } from "./LeadGeoBrandLeaderboard"
import { LeadGeoContentChecks } from "./LeadGeoContentChecks"
import { LeadGeoDemandCard } from "./LeadGeoDemandCard"
import { LeadGeoPromptMatrix } from "./LeadGeoPromptMatrix"
import {
  LeadGeoAiOverviewCard,
  LeadGeoMentionsCard,
  LeadGeoPromptsCard,
  LeadGeoSourcesList,
} from "./LeadGeoSourcesCard"
import { LeadGeoReview } from "./LeadGeoReview"
import type { GeoController } from "./use-geo-controller"

/**
 * O roteador das quatro abas. Cada card mora em arquivo próprio — é o mesmo
 * desenho das outras quatro etapas de auditoria, e o que este arquivo guarda é
 * só a composição de cada aba e o estado vazio que as quatro compartilham.
 */

function NoCollection({ children }: { children: ReactNode }) {
  return (
    <Empty className="py-8">
      <EmptyHeader>
        <EmptyTitle>Sem análise</EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export function LeadGeoTabAccess({ controller }: { controller: GeoController }) {
  const snapshot = controller.snapshot
  if (!snapshot) {
    return (
      <NoCollection>
        Rode a análise para ver o que as IAs conseguem acessar neste site.
      </NoCollection>
    )
  }
  return <LeadGeoAccessBoard snapshot={snapshot} />
}

export function LeadGeoTabContent({
  controller,
  readingMode,
}: {
  controller: GeoController
  readingMode: boolean
}) {
  const snapshot = controller.snapshot
  if (!snapshot) {
    return (
      <NoCollection>
        Rode a análise para ver o que as IAs conseguem entender deste conteúdo.
      </NoCollection>
    )
  }

  return (
    <div className="grid min-h-0 gap-3.5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <LeadGeoContentChecks snapshot={snapshot} />
      <LeadGeoDemandCard snapshot={snapshot} />
      <LeadGeoReview controller={controller} readingMode={readingMode} />
    </div>
  )
}

export function LeadGeoTabCitations({
  controller,
}: {
  controller: GeoController
}) {
  const snapshot = controller.snapshot
  if (!snapshot) {
    return (
      <NoCollection>
        Rode a análise para ver onde este negócio já é citado.
      </NoCollection>
    )
  }

  return (
    <div className="grid min-h-0 gap-3.5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <LeadGeoAiOverviewCard snapshot={snapshot} />
      <LeadGeoSourcesList snapshot={snapshot} />
      <LeadGeoMentionsCard snapshot={snapshot} />
      <LeadGeoPromptsCard snapshot={snapshot} />
    </div>
  )
}

export function LeadGeoTabProbe({ controller }: { controller: GeoController }) {
  const probe = controller.snapshot?.promptVisibility ?? null

  if (probe === null) {
    return (
      <StepCard title="Sondagem em LLM">
        <p className="text-xs/relaxed text-muted-foreground">
          Não sondado. A sondagem pergunta a ChatGPT, Claude, Gemini e
          Perplexity o que este mercado pergunta, e mede se a marca aparece.
          São {controller.probeRuns} respostas, e é a coleta mais cara desta
          etapa — por isso tem botão próprio.
        </p>
      </StepCard>
    )
  }

  const executadas = probe.runs.filter((run) => run.status === "ok")
  const naoExecutadas = probe.runs.filter((run) => run.status !== "ok")

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-3.5">
      {/* A matriz é a manchete da aba: largura inteira, acima do resumo. Ela é
          o que o analista abre a aba para ver; os agregados qualificam. */}
      <LeadGeoPromptMatrix
        promptSet={controller.promptSet}
        probe={probe}
        companyName={controller.companyName}
      />

      <div className="grid min-h-0 gap-3.5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3.5">
          <StepCard title="A marca nas respostas de IA">
            <div className="grid grid-cols-3 gap-2">
              <StepCountCell
                value={pct(probe.metrics.mentionRate)}
                label="das respostas citam"
              />
              <StepCountCell
                value={
                  probe.metrics.averagePosition === null
                    ? "—"
                    : probe.metrics.averagePosition.toFixed(1)
                }
                label="ordem média"
                dim={probe.metrics.averagePosition === null}
              />
              <StepCountCell
                value={String(executadas.length)}
                label="respostas lidas"
              />
            </div>
            {/* Duas ressalvas que o número não carrega sozinho, e sem as quais
                ele é lido como precisão que não tem. */}
            <p className="mt-3 text-xs/relaxed text-muted-foreground">
              Indicação direcional: a mesma pergunta no mesmo modelo devolve
              respostas diferentes entre execuções.
            </p>
            <p className="mt-1 text-xs/relaxed text-muted-foreground">
              A ordem é a posição da marca entre as marcas citadas no texto — não
              é posição em lista numerada.
            </p>
          </StepCard>

          <StepCard title="Por plataforma">
            <StepSectionLabel aside="barra relativa à que mais cita">
              Taxa de menção
            </StepSectionLabel>
            <LeadVisibilityRankedList
              rows={probe.metrics.byProvider.map((row) => ({
                id: row.provider,
                label: (
                  <>
                    {PROVIDER_LABELS[row.provider] ?? row.provider}
                    {/* O Gemini recusa os dois campos de localização da API: ele
                        mede sem recorte geográfico. Comparar a coluna dele com as
                        outras sem dizer isso compara coisas diferentes. */}
                    {row.provider === "gemini" ? " · sem recorte de cidade" : ""}
                  </>
                ),
                title:
                  (PROVIDER_LABELS[row.provider] ?? row.provider) +
                  (row.provider === "gemini" ? " · sem recorte de cidade" : ""),
                value: row.mentionRate,
                note:
                  row.averagePosition === null
                    ? undefined
                    : `ordem ${row.averagePosition.toFixed(1)}`,
              }))}
              formatValue={pct}
              emptyLabel="Nenhuma execução lida."
            />
          </StepCard>

          {naoExecutadas.length > 0 ? (
            <StepCard title="Não executadas">
              {/* Execução que o provedor recusou não é "não mencionou": ela fica
                  fora do denominador e aparece aqui com o motivo. Contá-la como
                  ausência inventaria um resultado — e de graça, porque esses
                  erros não cobram. */}
              <p className="text-xs/relaxed text-muted-foreground">
                {naoExecutadas.length} de {probe.runs.length} não rodaram e ficam
                fora da conta.
              </p>
              <ul className="mt-3 flex flex-col">
                {naoExecutadas.slice(0, 8).map((run) => (
                  <li
                    key={`${run.promptId}-${run.provider}`}
                    className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2 last:border-b-0 last:pb-0"
                  >
                    <span className="min-w-0 flex-1 truncate text-xs/relaxed text-foreground">
                      {PROVIDER_LABELS[run.provider] ?? run.provider}
                    </span>
                    <span className="shrink-0 text-xs/relaxed text-muted-foreground">
                      {run.statusMessage ?? "não respondeu"}
                    </span>
                  </li>
                ))}
              </ul>
            </StepCard>
          ) : null}
        </div>

        <LeadGeoBrandLeaderboard
          probe={probe}
          companyName={controller.companyName}
        />
      </div>
    </div>
  )
}
