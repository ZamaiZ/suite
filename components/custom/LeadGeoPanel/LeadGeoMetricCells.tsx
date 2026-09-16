"use client"

import {
  RiCheckboxCircleLine,
  RiQuestionAnswerLine,
  RiRobot2Line,
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
import { pct } from "./geo-format"
import type { GeoController } from "./use-geo-controller"

/**
 * Cada big number é a manchete de **uma** aba, e clicar nele leva até lá.
 *
 * São quatro abas, então são quatro células — o mesmo número de Website,
 * Visibilidade e Presença digital, e o que o grid `repeat(4)` do cabeçalho
 * comporta sem quebrar linha. Antes eram cinco: `citacoes` e `conteudo` tinham
 * duas manchetes cada, `sondagem` não tinha nenhuma — justamente a coleta mais
 * cara da etapa —, e a quinta célula caía sozinha numa segunda linha. Demanda
 * em IA e menções em IA continuam inteiras dentro das abas delas.
 *
 * **Uma célula não ganha trilha, e não por esquecimento.** Citações em AI
 * Overview não têm denominador — não existe "de quantas seria possível" —, e
 * trilha sem escala mente pior que trilha ausente. As outras três têm: agentes
 * declarados no robots, execuções `ok` da sondagem, e critérios do analista.
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
  const probe = snapshot?.promptVisibility ?? null
  const okRuns = probe?.runs.filter((run) => run.status === "ok").length ?? 0

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
        Fração legítima: "cheio é bom" — toda resposta lida citando a marca é o
        melhor resultado possível. O denominador é o das execuções `ok`, igual
        ao de `mentionRate`: contar as que o provedor recusou derrubaria a taxa
        por um motivo que não tem nada a ver com o lead.
      */}
      <Cell
        tab="sondagem"
        onSelectTab={onSelectTab}
        icon={RiQuestionAnswerLine}
        label="SONDAGEM EM IA"
        value={probe === null ? "—" : pct(probe.metrics.mentionRate)}
        unit={
          probe === null
            ? "não sondado"
            : `de ${okRuns} ${okRuns === 1 ? "resposta lida" : "respostas lidas"}`
        }
        tone={
          probe === null ? "neutral" : stepShareTone(probe.metrics.mentionRate)
        }
        share={probe === null ? null : probe.metrics.mentionRate}
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
