import type { BriefingHistoryPayload } from "@/lib/briefing/history"

export type ClientBriefingHistoryFormProps = {
  initialPayload: BriefingHistoryPayload
  initialUpdatedAt: string | null
  initialCompletedAt: string | null
  onBack?: () => void
  onContinue?: (completedAt: string) => void
}
