import type {
  LeadBacklinkAudit,
  LeadDetail,
  LeadWebsiteAudit,
} from "@/app/actions/leads"

export type LeadWebsitePanelProps = {
  detail: LeadDetail
  canEdit: boolean
  /** Modo reunião: esconde edição. Nunca habilita nada. */
  readingMode?: boolean
  onAuditChange: (audit: LeadWebsiteAudit) => void
  onBacklinkAuditChange: (audit: LeadBacklinkAudit) => void
  onPendingChange: (pending: boolean) => void
}
