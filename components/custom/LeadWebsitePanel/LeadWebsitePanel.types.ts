import type { LeadDetail, LeadWebsiteAudit } from "@/app/actions/leads"

export type LeadWebsitePanelProps = {
  detail: LeadDetail
  canEdit: boolean
  onAuditChange: (audit: LeadWebsiteAudit) => void
  onPendingChange: (pending: boolean) => void
}
