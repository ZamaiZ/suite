"use client"

import {
  RiCheckboxCircleLine,
  RiChatQuoteLine,
  RiRobot2Line,
  RiSearchEyeLine,
  RiSparkling2Line,
} from "react-icons/ri"
import type { IconType } from "react-icons"
import {
  StepMeter,
  StepStat,
  stepShareTone,
  type StepTone,
} from "@/components/custom/LeadStepShell"
import { GEO_STEP_TABS, type GeoStepTabId } from "@/lib/leads/geo-step-tabs"
import type { GeoController } from "./use-geo-controller"

/**
 * Cada big number é a manchete de uma aba, e clicar nele leva até lá.
 *
 * Duas células **não** ganham trilha, e não por esquecimento. Citações em AI
 * Overview não têm denominador — não existe "de quantas seria possível" —, e
 * trilha sem escala mente pior que trilha ausente. A de robôs tem: o
 * denominador é quantos agentes o robots.txt declara.
 */
const TAB_LABEL: Record<GeoStepTabId, string> = Object.fromEntries(
  GEO_STEP_TABS.map((item) => [item.id, item.label]),
) as Record<GeoStepTabId, string>

function Cell({
  tab,
  onSelectTab,
  icon,
  label,
  value,
  unit,
  hint,
  tone = "neutral",
  share,
}: {
  tab: GeoStepTabId
  onSelectTab: (tab: GeoStepTabId) => void
  icon: IconType
  label: string
  value: string
  unit: string
  hint?: string
  tone?: StepTone
  /** `null` quando não há escala contra a qual medir — aí a trilha não entra. */
  share: number | null
}) {
  return (
    <button
      type="button"
      onClick={() => onSelectTab(tab)}
      aria-label={`Ver a aba ${TAB_LABEL[tab]}`}
      className="min-w-0 cursor-pointer rounded-lg text-left transition-opacity duration-150 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <StepStat
        icon={icon}
        label={label}
        value={value}
        unit={unit}
        hint={hint}
        tone={tone}
      >
        {share === null ? null : (
          <StepMeter share={share} tone={tone} className="mt-2" />
        )}
      </StepStat>
    </button>
  )
}

export function LeadGeoMetricCells({
  controller,
  onSelectTab,
}: {
  controller: GeoController
  onSelectTab: (tab: GeoStepTabId) => void
}) {
  const { snapshot, progress } = controller
  const access = snapshot?.accessibility ?? null
  const extended = snapshot?.sources.websiteCrawlExtended ?? false

  const declared = access?.aiCrawlers.length ?? 0
  const blocked = access?.blockedAiCrawlers ?? 0
  const allowed = declared - blocked

  const aiOverview = snapshot?.aiOverview ?? null
  const citations = snapshot?.citations ?? null
  const demand = snapshot?.aiDemand ?? null

  return (
    <>
      {/*
        Fração legítima: "cheio é bom" vale aqui — todos os agentes declarados
        liberados é o melhor resultado possível. Sem crawl ampliado não há
        agentes lidos, e a célula cala em vez de afirmar liberação total.
      */}
      <Cell
        tab="acesso"
        onSelectTab={onSelectTab}
        icon={RiRobot2Line}
        label="ROBÔS DE IA"
        value={!extended || declared === 0 ? "—" : String(allowed)}
        unit={
          !extended
            ? "crawl antigo"
            : declared === 0
              ? "nenhum declarado no robots"
              : `de ${declared} declarados`
        }
        hint={
          extended && access
            ? access.llmsTxt.found
              ? "llms.txt publicado"
              : "sem llms.txt"
            : undefined
        }
        tone={
          !extended || declared === 0 ? "neutral" : stepShareTone(allowed / declared)
        }
        share={!extended || declared === 0 ? null : allowed / declared}
      />
      {/*
        Sem trilha: não existe denominador para citação em visão geral de IA.
        `null` é "visibilidade não coletada"; zero com footprint orgânico é
        achado, e é o que pinta a célula de `warning`.
      */}
      <Cell
        tab="citacoes"
        onSelectTab={onSelectTab}
        icon={RiSparkling2Line}
        label="CITAÇÕES EM IA"
        value={aiOverview === null ? "—" : String(aiOverview.count)}
        unit={
          aiOverview === null
            ? "sem coleta de visibilidade"
            : aiOverview.hasOrganicFootprint
              ? "keywords citadas pelo Google"
              : "sem ranking orgânico medido"
        }
        tone={
          aiOverview === null
            ? "neutral"
            : aiOverview.count > 0
              ? "success"
              : aiOverview.hasOrganicFootprint
                ? "warning"
                : "neutral"
        }
        share={null}
      />
      {/*
        `null` é onda 2 não rodada, e a célula diz "não coletado" em vez de
        "nenhuma" — a diferença entre não olhar e olhar e não achar.
      */}
      <Cell
        tab="citacoes"
        onSelectTab={onSelectTab}
        icon={RiChatQuoteLine}
        label="MENÇÕES EM IA"
        value={citations === null ? "—" : String(citations.mentions)}
        unit={
          citations === null
            ? "não coletado"
            : citations.mentions === 0
              ? "respostas de IA citam o negócio"
              : citations.domainCitedAsSource
                ? "respostas · o site é fonte"
                : "respostas · o site não é fonte"
        }
        tone={
          citations === null
            ? "neutral"
            : citations.mentions === 0
              ? "warning"
              : citations.domainCitedAsSource
                ? "success"
                : "warning"
        }
        share={null}
      />
      {/*
        Sem trilha, e nunca como percentual do volume orgânico: medido em
        2026-09-11, uma keyword teve 12.559 buscas em IA contra 5.400 no Google
        e outra teve 234 contra 18.100. Não há razão constante entre os dois.
      */}
      <Cell
        tab="conteudo"
        onSelectTab={onSelectTab}
        icon={RiSearchEyeLine}
        label="DEMANDA EM IA"
        value={
          demand === null || demand.totalAiSearchVolume === null
            ? "—"
            : demand.totalAiSearchVolume.toLocaleString("pt-BR")
        }
        unit={
          demand === null
            ? "não coletado"
            : demand.totalAiSearchVolume === null
              ? "sem keyword medida"
              : "buscas/mês nas keywords do lead"
        }
        tone={
          demand === null || demand.totalAiSearchVolume === null
            ? "neutral"
            : demand.totalAiSearchVolume > 0
              ? "success"
              : "warning"
        }
        share={null}
      />
      <Cell
        tab="conteudo"
        onSelectTab={onSelectTab}
        icon={RiCheckboxCircleLine}
        label="VALIDAÇÃO"
        value={String(progress.done)}
        unit={`de ${progress.total} critérios`}
        tone="primary"
        share={progress.done / progress.total}
      />
    </>
  )
}
