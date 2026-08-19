import type {
  LeadDetail,
  LeadGbpProfile,
  LeadWebsiteAudit,
} from "@/app/actions/leads"

export type LeadGbpPanelProps = {
  detail: LeadDetail | null
  loading: boolean
  readOnly: boolean
  onProfilesChange: (leadId: string, profiles: LeadGbpProfile[]) => void
  onWebsiteAuditsChange: (leadId: string, audits: LeadWebsiteAudit[]) => void
  onPendingChange: (pending: boolean) => void
}
