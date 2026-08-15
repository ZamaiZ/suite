import type { ClaimLeadState } from "@/app/actions/leads"

export type LeadClaimActionsProps = {
  leadId: string
  canClaim: boolean
  canUnclaim: boolean
  createdByName?: string | null
  variant?: "buttons" | "menu"
  onSuccess?: (result: Extract<ClaimLeadState, { status: "success" }>) => void
  onPendingChange?: (pending: boolean) => void
  onError?: (message: string | null) => void
}
