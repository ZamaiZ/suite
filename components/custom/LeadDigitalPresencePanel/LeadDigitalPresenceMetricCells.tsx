"use client"

import {
  RiBarChartBoxLine,
  RiCodeSSlashLine,
  RiLinksLine,
  RiUserFollowLine,
} from "react-icons/ri"
import type { IconType } from "react-icons"
import {
  StepMeter,
  StepStat,
  stepShareTone,
  type StepTone,
} from "@/components/custom/LeadStepShell"
import {
  DIGITAL_PRESENCE_STEP_TABS,
  type DigitalPresenceStepTabId,
} from "@/lib/leads/digital-presence-step-tabs"
import type { DigitalPresenceController } from "./use-digital-presence-controller"

/**
 * Cada big number é a manchete de uma aba, e clicar nele leva até lá. O
 * cabeçalho deixa de ser estatística solta e passa a ser o estado da etapa.
 */
const TAB_LABEL: Record<DigitalPresenceStepTabId, string> = Object.fromEntries(
  DIGITAL_PRESENCE_STEP_TABS.map((item) => [item.id, item.label]),
) as Record<DigitalPresenceStepTabId, string>

function Cell({
  tab,
  onSelectTab,
  icon,
  label,
  value,
  unit,
  tone = "neutral",
  share,
}: {
  tab: DigitalPresenceStepTabId
  onSelectTab: (tab: DigitalPresenceStepTabId) => void
  icon: IconType
  label: string
  value: string
  unit: string
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
      <StepStat icon={icon} label={label} value={value} unit={unit} tone={tone}>
        {share === null ? null : (
          <StepMeter share={share} tone={tone} className="mt-2" />
        )}
      </StepStat>
    </button>
  )
}

const count = (value: number) => value.toLocaleString("pt-BR")

export function LeadDigitalPresenceMetricCells({
  controller,
  onSelectTab,
}: {
  controller: DigitalPresenceController
  onSelectTab: (tab: DigitalPresenceStepTabId) => void
}) {
  const { networks, followers, tracking, alignmentKnown } = controller.tally

  // Denominador de atividade é "redes medidas", não "redes cadastradas": uma
  // rede sem data não é uma rede parada, é uma rede que ninguém olhou. Contá-la
  // faria a barra encolher por falta de trabalho do analista e ler como
  // problema do lead.
  const activityShare =
    networks.measured > 0 ? networks.active / networks.measured : null
  const alignmentShare =
    alignmentKnown && networks.total > 0
      ? networks.aligned / networks.total
      : null
  const trackingShare = tracking ? tracking.ok / tracking.total : null

  return (
    <>
      <Cell
        tab="redes"
        onSelectTab={onSelectTab}
        icon={RiBarChartBoxLine}
        label="ATIVIDADE"
        value={networks.measured > 0 ? count(networks.active) : "—"}
        unit={
          networks.measured > 0
            ? `de ${count(networks.measured)} redes medidas`
            : "nenhuma rede medida"
        }
        tone={activityShare === null ? "neutral" : stepShareTone(activityShare)}
        share={activityShare}
      />
      {/*
        Sem mediana de mercado não há denominador, e trilha sem escala mente
        pior que a ausência dela. É o único dos quatro sem medidor.
      */}
      <Cell
        tab="redes"
        onSelectTab={onSelectTab}
        icon={RiUserFollowLine}
        label="SEGUIDORES"
        value={followers.measured > 0 ? count(followers.sum) : "—"}
        unit={
          followers.measured > 0
            ? `somados em ${count(followers.measured)} de ${count(networks.total)} redes`
            : "nenhuma rede medida"
        }
        tone="neutral"
        share={null}
      />
      {/*
        Ausência é `—`, nunca zero: `0 de 2` afirma que as tags não existem, e a
        verdade sem coleta é que ninguém olhou.
      */}
      <Cell
        tab="site"
        onSelectTab={onSelectTab}
        icon={RiCodeSSlashLine}
        label="RASTREAMENTO"
        value={tracking ? count(tracking.ok) : "—"}
        unit={
          tracking
            ? `de ${count(tracking.total)} tags no HTML`
            : "sem coleta do site"
        }
        tone={trackingShare === null ? "neutral" : stepShareTone(trackingShare)}
        share={trackingShare}
      />
      <Cell
        tab="site"
        onSelectTab={onSelectTab}
        icon={RiLinksLine}
        label="ALINHAMENTO"
        value={alignmentShare === null ? "—" : count(networks.aligned)}
        unit={
          !alignmentKnown
            ? "sem coleta do site"
            : networks.total === 0
              ? "nenhuma rede cadastrada"
              : `de ${count(networks.total)} redes cadastradas`
        }
        tone={
          alignmentShare === null ? "neutral" : stepShareTone(alignmentShare)
        }
        share={alignmentShare}
      />
    </>
  )
}
