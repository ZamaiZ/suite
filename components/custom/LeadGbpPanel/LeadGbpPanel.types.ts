import type {
  LeadDetail,
  LeadGbpProfile,
  LeadWebsiteAudit,
  LeadDigitalPresenceAudit,
  LeadVisibilityAudit,
  LeadDiagnosisDraft,
  LeadDiagnosisExport,
} from "@/app/actions/leads"

export type LeadGbpPanelProps = {
  detail: LeadDetail | null
  loading: boolean
  readOnly: boolean
  onProfilesChange: (leadId: string, profiles: LeadGbpProfile[]) => void
  onWebsiteAuditsChange: (leadId: string, audits: LeadWebsiteAudit[]) => void
  onDigitalPresenceChange: (
    leadId: string,
    audit: LeadDigitalPresenceAudit | null,
  ) => void
  onVisibilityChange: (
    leadId: string,
    audit: LeadVisibilityAudit | null,
  ) => void
  onDiagnosisDraftChange: (
    leadId: string,
    draft: LeadDiagnosisDraft | null,
  ) => void
  onDiagnosisExportsChange: (
    leadId: string,
    exports: LeadDiagnosisExport[],
  ) => void
  onPendingChange: (pending: boolean) => void
}
