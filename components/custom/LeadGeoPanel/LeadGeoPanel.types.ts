import type { LeadDetail, LeadGeoAudit } from "@/app/actions/leads"
import type { LeadGeoReview } from "@/lib/leads/geo-review"

export type LeadGeoPanelProps = {
  detail: LeadDetail
  canEdit: boolean
  /** Modo reunião: esconde o que é de trabalho, nunca habilita nada. */
  readingMode: boolean
  onAuditChange: (audit: LeadGeoAudit) => void
  onReviewChange: (review: LeadGeoReview) => void
  onPendingChange: (pending: boolean) => void
}
