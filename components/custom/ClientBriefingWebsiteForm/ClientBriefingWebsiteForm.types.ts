import type { BriefingWebsitePayload } from "@/lib/briefing/website"

export type ClientBriefingWebsiteFormProps = {
  initialPayload: BriefingWebsitePayload
  initialUpdatedAt: string | null
  initialCompletedAt: string | null
  onBack?: () => void
  onContinue?: (completedAt: string) => void
}
