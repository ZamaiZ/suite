import type {
  LeadDetail,
  LeadVisibilityAudit,
} from "@/app/actions/leads"

export type LeadVisibilityPanelProps = {
  detail: LeadDetail
  canEdit: boolean
  onAuditChange: (audit: LeadVisibilityAudit) => void
  onPendingChange: (pending: boolean) => void
}
