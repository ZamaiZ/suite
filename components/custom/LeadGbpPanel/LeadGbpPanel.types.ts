import type {
  LeadDetail,
  LeadGbpProfile,
  LeadWebsiteAudit,
  LeadDigitalPresenceAudit,
  LeadVisibilityAudit,
  LeadBacklinkAudit,
  LeadDiagnosisDraft,
  LeadDiagnosisExport,
} from "@/app/actions/leads"

export type LeadGbpPanelProps = {
  detail: LeadDetail | null
  loading: boolean
  readOnly: boolean
  /**
   * Modo reunião: esconde os controles de edição da etapa. Nunca habilita nada
   * — `canEdit` continua sendo `detail.canEditGbp && !readOnly`.
   */
  readingMode: boolean
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
  onBacklinksChange: (leadId: string, audit: LeadBacklinkAudit | null) => void
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
