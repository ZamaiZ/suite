export type ClientBriefingBrandFormProps = {
  initialPayload: import("@/lib/briefing/brand").BriefingBrandPayload
  initialUpdatedAt: string | null
  initialCompletedAt: string | null
  onBack?: () => void
  onContinue?: (completedAt: string) => void
}
