"use client"

import { useState } from "react"
import { useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { analyzeLeadVisibility } from "@/app/actions/leads"
import { LeadGbpOpportunitiesCard } from "@/components/custom/LeadGbpPanel/LeadGbpOpportunitiesCard"
import { resolveLeadLocation } from "@/lib/leads/resolve-location"
import { mergeVisibilityOpportunities } from "@/lib/leads/visibility-opportunities"
import { visibilityCheckSections } from "@/lib/leads/visibility-presenters"
import { LeadVisibilityChecks } from "./LeadVisibilityChecks"
import { LeadVisibilityKeywordsTable } from "./LeadVisibilityKeywordsTable"
import { LeadVisibilityStepHeader } from "./LeadVisibilityStepHeader"
import { LeadVisibilitySummaryCards } from "./LeadVisibilitySummaryCards"
import type { LeadVisibilityPanelProps } from "./LeadVisibilityPanel.types"

const EASE = [0.23, 1, 0.32, 1] as const

export function LeadVisibilityPanel({
  detail,
  canEdit,
  onAuditChange,
  onPendingChange,
}: LeadVisibilityPanelProps) {
  const reduced = !!useReducedMotion()
  const fade = {
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0.12 : 0.18, ease: EASE },
  }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const audit = detail.visibilityAudit
  const primaryGbp =
    detail.gbpProfiles.find((profile) => profile.is_primary) ??
    detail.gbpProfiles[0] ??
    null
  const city = resolveLeadLocation(
    {
      city: detail.lead.city,
      state_code: detail.lead.state_code,
      segment: detail.lead.segment,
    },
    primaryGbp
      ? { formattedAddress: primaryGbp.payload.formattedAddress ?? null }
      : null,
  ).city
  const opportunities = audit
    ? mergeVisibilityOpportunities({
        snapshot: audit.snapshot,
        companyName: detail.lead.company_name,
        city,
      })
    : []
  const sections = visibilityCheckSections({
    snapshot: audit?.snapshot ?? null,
    companyName: detail.lead.company_name,
    city,
  })

  async function handleAnalyze() {
    if (!canEdit || busy) return
    setBusy(true)
    setError(null)
    onPendingChange(true)
    const formData = new FormData()
    formData.set("lead_id", detail.lead.id)
    const result = await analyzeLeadVisibility(formData)
    setBusy(false)
    onPendingChange(false)
    if (result.status === "error") {
      setError(result.message)
      return
    }
    onAuditChange(result.audit)
  }

  return (
    <div className="flex flex-col gap-3">
      <m.div
        initial={fade.initial}
        animate={fade.animate}
        transition={fade.transition}
      >
        <LeadVisibilityStepHeader
          updatedAt={audit?.fetched_at ?? null}
          source={audit?.snapshot.source ?? null}
          collecting={busy}
          canEdit={canEdit}
          onAnalyze={() => {
            void handleAnalyze()
          }}
        />
      </m.div>

      {error ? (
        <p role="alert" className="text-xs/relaxed text-destructive">
          {error}
        </p>
      ) : null}

      {!audit ? (
        <p className="text-xs/relaxed text-muted-foreground">
          Analise a visibilidade orgânica do domínio do lead. A fonte segue o
          vendor configurado em Ferramentas.
        </p>
      ) : (
        <>
          <LeadVisibilitySummaryCards snapshot={audit.snapshot} />
          <LeadVisibilityChecks sections={sections} />
          <LeadVisibilityKeywordsTable keywords={audit.snapshot.keywords} />
          <LeadGbpOpportunitiesCard items={opportunities} />
        </>
      )}
    </div>
  )
}
