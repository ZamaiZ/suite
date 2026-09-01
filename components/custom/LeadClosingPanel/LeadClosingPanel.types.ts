import type { LeadDetail } from "@/app/actions/leads"
import type { LogClosingEventState } from "@/app/actions/leads"
import type { ConvertLeadState } from "@/app/actions/clients"
import type { ClosingChecklistPatch } from "@/app/actions/leads"

export type LeadClosingPanelProps = {
  detail: LeadDetail
  readOnly: boolean
  onEventSuccess: (
    result: Extract<LogClosingEventState, { status: "success" }>,
  ) => void
  onChecklistSuccess: (patch: ClosingChecklistPatch) => void
  onConvertSuccess: (
    result: Extract<ConvertLeadState, { status: "success" }>,
  ) => void
  onPendingChange: (pending: boolean) => void
}
