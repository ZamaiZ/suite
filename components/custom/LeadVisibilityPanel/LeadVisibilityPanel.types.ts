import type { LeadDetail, LeadVisibilityAudit } from "@/app/actions/leads"
import type { LeadVisibilityReview } from "@/lib/leads/visibility-review"

export type LeadVisibilityPanelProps = {
  detail: LeadDetail
  canEdit: boolean
  /** Modo reunião: esconde o que é de trabalho, nunca habilita nada. */
  readingMode: boolean
  onAuditChange: (audit: LeadVisibilityAudit) => void
  onReviewChange: (review: LeadVisibilityReview) => void
  onPendingChange: (pending: boolean) => void
}
