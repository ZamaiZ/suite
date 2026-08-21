import type {
  LeadDetail,
  LeadDiagnosisDraft,
  LeadDiagnosisExport,
} from "@/app/actions/leads"

export type LeadDiagnosisPanelProps = {
  detail: LeadDetail
  canEdit: boolean
  unlocked: boolean
  liveFingerprint: string
  onDraftChange: (draft: LeadDiagnosisDraft | null) => void
  onExportsChange: (exports: LeadDiagnosisExport[]) => void
  onPendingChange: (pending: boolean) => void
}
