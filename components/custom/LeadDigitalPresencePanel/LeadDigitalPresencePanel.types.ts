import type { LeadDetail, LeadDigitalPresenceAudit } from "@/app/actions/leads"

export type LeadDigitalPresencePanelProps = {
  detail: LeadDetail
  canEdit: boolean
  /** Modo reunião: esconde edição. Nunca habilita nada. */
  readingMode?: boolean
  onAuditChange: (audit: LeadDigitalPresenceAudit) => void
  onPendingChange: (pending: boolean) => void
}
