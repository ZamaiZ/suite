"use client"

import {
  RiCheckboxCircleLine,
  RiFileList3Line,
  RiSearchEyeLine,
  RiTrafficLightLine,
} from "react-icons/ri"
import type { IconType } from "react-icons"
import {
  StepMeter,
  StepStat,
  stepShareTone,
  type StepTone,
} from "@/components/custom/LeadStepShell"
import { VISIBILITY_LOW_TRAFFIC } from "@/lib/leads/visibility-audit"
import {
  visibilityCanonicalTrafficShare,
  visibilityPages,
} from "@/lib/leads/visibility-pages"
import { formatVisibilityMetric } from "@/lib/leads/visibility-presenters"
import {
  VISIBILITY_STEP_TABS,
  type VisibilityStepTabId,
} from "@/lib/leads/visibility-step-tabs"
import type { VisibilityController } from "./use-visibility-controller"

/**
 * Cada big number é a manchete de uma aba, e clicar nele leva até lá. O
 * cabeçalho deixa de ser estatística solta e passa a ser o estado da etapa.
 *
 * Cada `unit` carrega **uma coisa só**: `"cliques/mês · ≈ US$ 731 em mídia"`
 * seria o `A · B · C` que frase pronta produz — sem hierarquia para declarar, e
 * o componente só consegue imprimi-la inteira, em cinza. O segundo número vai
 * para o `hint`, um degrau abaixo.
 */
const TAB_LABEL: Record<VisibilityStepTabId, string> = Object.fromEntries(
  VISIBILITY_STEP_TABS.map((item) => [item.id, item.label]),
) as Record<VisibilityStepTabId, string>

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
  tab: VisibilityStepTabId
  onSelectTab: (tab: VisibilityStepTabId) => void
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

export function LeadVisibilityMetricCells({
  controller,
  onSelectTab,
}: {
  controller: VisibilityController
  onSelectTab: (tab: VisibilityStepTabId) => void
}) {
  const { snapshot, progress } = controller
  const metrics = snapshot?.metrics ?? null
  const buckets = metrics?.positionBuckets ?? null

  const traffic = metrics?.estimatedTraffic ?? null
  const cost = metrics?.estimatedTrafficCost ?? null
  const footprint = metrics?.keywordCount ?? null
  const top10 = buckets ? buckets.top3 + buckets.pos4to10 : null

  const pages = snapshot ? visibilityPages(snapshot) : []
  const hosts = snapshot?.hosts ?? []
  const canonicalShare = visibilityCanonicalTrafficShare(hosts)

  return (
    <>
      {/*
        Sem trilha, e não por esquecimento: não existe denominador para tráfego
        orgânico. Sem mediana de mercado, a barra desenharia uma escala que não
        existe — e trilha sem escala mente pior que trilha ausente.
      */}
      <Cell
        tab="panorama"
        onSelectTab={onSelectTab}
        icon={RiTrafficLightLine}
        label="TRÁFEGO"
        value={traffic === null ? "—" : formatVisibilityMetric(traffic)}
        unit={traffic === null ? "sem coleta" : "cliques/mês"}
        hint={
          cost === null
            ? undefined
            : `≈ US$ ${formatVisibilityMetric(cost)}/mês em mídia`
        }
        tone={
          traffic === null
            ? "neutral"
            : traffic < VISIBILITY_LOW_TRAFFIC
              ? "warning"
              : "success"
        }
        share={null}
      />
      <Cell
        tab="keywords"
        onSelectTab={onSelectTab}
        icon={RiSearchEyeLine}
        label="TOP 10"
        value={top10 === null ? "—" : formatVisibilityMetric(top10)}
        unit={
          footprint === null
            ? "sem footprint medido"
            : `de ${formatVisibilityMetric(footprint)} no índice`
        }
        tone={
          top10 === null || !footprint
            ? "neutral"
            : stepShareTone(top10 / footprint)
        }
        share={top10 === null || !footprint ? null : top10 / footprint}
      />
      {/*
        O aviso de host não-canônico viaja no tom e na trilha, não numa frase:
        com dois hosts dividindo 74/26, a fração pinta o card de `warning` sem
        precisar dizer "77 fora do principal" na unidade.
      */}
      <Cell
        tab="paginas"
        onSelectTab={onSelectTab}
        icon={RiFileList3Line}
        label="PÁGINAS"
        value={snapshot === null ? "—" : formatVisibilityMetric(pages.length)}
        unit={
          snapshot === null
            ? "sem coleta"
            : hosts.length === 0
              ? "sem host identificado"
              : `em ${formatVisibilityMetric(hosts.length)} host${hosts.length > 1 ? "s" : ""}`
        }
        tone={
          canonicalShare === null ? "neutral" : stepShareTone(canonicalShare)
        }
        share={canonicalShare}
      />
      <Cell
        tab="validacao"
        onSelectTab={onSelectTab}
        icon={RiCheckboxCircleLine}
        label="VALIDAÇÃO"
        value={formatVisibilityMetric(progress.done)}
        unit={`de ${progress.total} critérios`}
        tone="primary"
        share={progress.done / progress.total}
      />
    </>
  )
}
