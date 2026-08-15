import type { LogLeadActivityState } from "@/app/actions/leads"

export type LeadActivityFormProps = {
  leadId: string
  onSuccess?: (
    result: Extract<LogLeadActivityState, { status: "success" }>,
  ) => void
  onPendingChange?: (pending: boolean) => void
}
