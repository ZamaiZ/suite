import type { BriefingClosingPayload } from "@/lib/briefing/closing"

export type ClientBriefingClosingFormProps = {
  initialPayload: BriefingClosingPayload
  initialUpdatedAt: string | null
  initialCompletedAt: string | null
  variant?: "portal" | "staff"
  onBack?: () => void
  onFinalize?: (finalizedAt: string, completedAt: string) => void
}
