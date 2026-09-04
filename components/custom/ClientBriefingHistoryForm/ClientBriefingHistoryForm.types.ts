import type { BriefingHistoryPayload } from "@/lib/briefing/history"

export type ClientBriefingHistoryFormProps = {
  initialPayload: BriefingHistoryPayload
  initialUpdatedAt: string | null
  initialCompletedAt: string | null
  variant?: "portal" | "staff"
  onBack?: () => void
  onContinue?: (completedAt: string) => void
}
