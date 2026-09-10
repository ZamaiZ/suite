"use client"

import type { ReactNode } from "react"
import {
  RiCheckboxCircleLine,
  RiEyeLine,
  RiLinksLine,
  RiSpeedUpLine,
} from "react-icons/ri"
import type { IconType } from "react-icons"
import { StepMeter, StepStat, type StepTone } from "@/components/custom/LeadStepShell"
import { competitorReferringDomainsMedian } from "@/lib/leads/backlinks-audit"
import { websiteMinPerformance } from "@/lib/leads/website-pagespeed"
import { websiteReviewProgress } from "@/lib/leads/website-review"
import {
  WEBSITE_STEP_TABS,
  type WebsiteStepTabId,
} from "@/lib/leads/website-step-tabs"
import type { WebsiteController } from "./use-website-controller"

/**
 * Cada big number é a manchete de uma aba, e clicar nele leva até lá. O
 * cabeçalho deixa de ser estatística solta e passa a ser o estado da etapa:
 * dois números de máquina, dois de progresso, cada um com a escala declarada
 * pela trilha do medidor.
 */
const TAB_LABEL: Record<WebsiteStepTabId, string> = Object.fromEntries(
  WEBSITE_STEP_TABS.map((item) => [item.id, item.label]),
) as Record<WebsiteStepTabId, string>

function bandTone(share: number): StepTone {
  if (share >= 0.8) return "success"
  if (share >= 0.5) return "warning"
  return "danger"
}

function Cell({
  tab,
  onSelectTab,
  icon,
  label,
  value,
  unit,
  tone = "neutral",
  share,
  children,
}: {
  tab: WebsiteStepTabId
  onSelectTab: (tab: WebsiteStepTabId) => void
  icon: IconType
  label: string
  value: string
  unit: string
  tone?: StepTone
  /** `null` quando não há escala contra a qual medir — aí a trilha não entra. */
  share: number | null
  children?: ReactNode
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
        tone={tone}
      >
        {share === null ? null : (
          <StepMeter share={share} tone={tone} className="mt-2" />
        )}
        {children}
      </StepStat>
    </button>
  )
}

export function LeadWebsiteMetricCells({
  controller,
  onSelectTab,
}: {
  controller: WebsiteController
  onSelectTab: (tab: WebsiteStepTabId) => void
}) {
  const { tally, audit, review, backlinkAudit } = controller

  const approvedShare = tally.total > 0 ? tally.ok / tally.total : 0
  const performance = websiteMinPerformance(audit?.pagespeed ?? null)
  const progress = websiteReviewProgress(review)
  const snapshot = backlinkAudit?.snapshot ?? null
  const domains = snapshot?.referringDomains ?? null
  const median = snapshot?.competitors
    ? competitorReferringDomainsMedian(snapshot.competitors)
    : null

  return (
    <>
      <Cell
        tab="auditoria"
        onSelectTab={onSelectTab}
        icon={RiCheckboxCircleLine}
        label="APROVAÇÕES"
        value={audit ? tally.ok.toLocaleString("pt-BR") : "—"}
        unit={
          audit
            ? `de ${tally.total.toLocaleString("pt-BR")} checks`
            : "sem coleta"
        }
        tone={audit ? bandTone(approvedShare) : "neutral"}
        share={audit ? approvedShare : null}
      />
      <Cell
        tab="pagespeed"
        onSelectTab={onSelectTab}
        icon={RiSpeedUpLine}
        label="PERFORMANCE"
        value={performance === null ? "—" : performance.toLocaleString("pt-BR")}
        unit={
          performance === null ? "sem coleta" : "pior entre mobile e desktop"
        }
        tone={
          performance === null
            ? "neutral"
            : performance < 50
              ? "danger"
              : performance < 90
                ? "warning"
                : "success"
        }
        share={performance === null ? null : performance / 100}
      />
      <Cell
        tab="validacao"
        onSelectTab={onSelectTab}
        icon={RiEyeLine}
        label="VALIDAÇÃO"
        value={audit ? progress.done.toLocaleString("pt-BR") : "—"}
        unit={
          audit
            ? `de ${progress.total.toLocaleString("pt-BR")} critérios julgados`
            : "sem coleta"
        }
        tone="primary"
        share={audit ? progress.done / progress.total : null}
      />
      {/*
        Ausência é `—`, nunca zero: um domínio sem coleta não é um domínio sem
        autoridade. Sem mediana de mercado, a trilha não é renderizada — trilha
        sem escala mente pior que a ausência dela.
      */}
      <Cell
        tab="autoridade"
        onSelectTab={onSelectTab}
        icon={RiLinksLine}
        label="DOMÍNIOS"
        value={domains === null ? "—" : domains.toLocaleString("pt-BR")}
        unit={
          domains === null
            ? "sem coleta"
            : median === null
              ? "no total"
              : `mediana ${median.toLocaleString("pt-BR")} no mercado`
        }
        tone={
          domains === null || median === null
            ? "neutral"
            : domains >= median
              ? "success"
              : "warning"
        }
        share={
          domains === null || median === null || median === 0
            ? null
            : Math.min(1, domains / median)
        }
      />
    </>
  )
}
