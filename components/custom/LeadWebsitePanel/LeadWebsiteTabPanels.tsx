"use client"

import { LeadWebsiteAuditCard } from "./LeadWebsiteAuditCard"
import { LeadWebsiteEmptyAudit } from "./LeadWebsitePanel"
import {
  LeadWebsiteAuthorityComposition,
  LeadWebsiteAuthorityMarket,
  LeadWebsiteAuthorityProfile,
  LeadWebsiteAuthorityRisk,
} from "./LeadWebsiteAuthorityCards"
import { LeadWebsitePagespeedCard } from "./LeadWebsitePagespeedCard"
import { LeadWebsiteReview } from "./LeadWebsiteReview"
import { LeadWebsiteShotViewer } from "./LeadWebsiteShotViewer"
import type { WebsiteController } from "./use-website-controller"

type PanelProps = {
  controller: WebsiteController
  readingMode: boolean
}

export function LeadWebsiteTabAudit({ controller }: PanelProps) {
  if (!controller.audit) return <LeadWebsiteEmptyAudit />
  return (
    <div className="grid grid-cols-1 items-stretch gap-3.5 xl:grid-cols-3">
      {controller.sections.map((section) => (
        <LeadWebsiteAuditCard key={section.id} section={section} />
      ))}
    </div>
  )
}

export function LeadWebsiteTabPagespeed({ controller }: PanelProps) {
  const { audit } = controller
  return (
    <div className="grid grid-cols-1 items-stretch gap-3.5 xl:grid-cols-2">
      <LeadWebsitePagespeedCard
        label="Mobile"
        strategy={audit?.pagespeed?.mobile ?? null}
        job={
          audit?.jobs.find((item) => item.kind === "pagespeed_mobile") ?? null
        }
      />
      <LeadWebsitePagespeedCard
        label="Desktop"
        strategy={audit?.pagespeed?.desktop ?? null}
        job={
          audit?.jobs.find((item) => item.kind === "pagespeed_desktop") ?? null
        }
      />
    </div>
  )
}

export function LeadWebsiteTabReview({ controller, readingMode }: PanelProps) {
  const { audit, reviewEvidence } = controller
  if (!audit || !reviewEvidence) return <LeadWebsiteEmptyAudit />
  return (
    <div className="grid grid-cols-1 items-start gap-3.5 xl:grid-cols-2">
      <LeadWebsiteShotViewer pagespeed={audit.pagespeed} />
      <LeadWebsiteReview
        syncKey={audit.channel_id}
        review={controller.review}
        evidence={reviewEvidence}
        canEdit={controller.canEdit && !readingMode}
        status={controller.saveStatus}
        errorMessage={controller.saveError}
        onDraftChange={controller.handleReviewDraftChange}
        onRetry={controller.retrySave}
      />
    </div>
  )
}

export function LeadWebsiteTabAuthority({
  controller,
  readingMode,
}: PanelProps) {
  const snapshot = controller.backlinkAudit?.snapshot ?? null
  // Duas colunas de fluxo, não um grid de duas colunas: com `grid`, a linha
  // toma a altura do card mais alto e o card curto deixa um buraco embaixo —
  // era o vão entre "Perfil do domínio" e "Risco".
  return (
    <div className="flex flex-col gap-3.5 xl:flex-row xl:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-3.5">
        <LeadWebsiteAuthorityProfile
          leadId={controller.leadId}
          audit={controller.backlinkAudit}
          canEdit={controller.canEdit && !readingMode}
          onAuditChange={controller.onBacklinkAuditChange}
          onPendingChange={controller.onPendingChange}
        />
        {snapshot ? <LeadWebsiteAuthorityRisk snapshot={snapshot} /> : null}
      </div>
      {snapshot ? (
        <div className="flex min-w-0 flex-1 flex-col gap-3.5">
          <LeadWebsiteAuthorityComposition snapshot={snapshot} />
          <LeadWebsiteAuthorityMarket snapshot={snapshot} />
        </div>
      ) : null}
    </div>
  )
}
