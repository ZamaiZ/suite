import type { LeadDetail, LeadDigitalPresenceAudit } from "@/app/actions/leads"

export type LeadDigitalPresencePanelProps = {
  detail: LeadDetail
  canEdit: boolean
  onAuditChange: (audit: LeadDigitalPresenceAudit) => void
  onPendingChange: (pending: boolean) => void
}
