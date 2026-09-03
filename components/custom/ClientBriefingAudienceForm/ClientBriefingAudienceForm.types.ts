export type ClientBriefingAudienceFormProps = {
  initialPayload: import("@/lib/briefing/audience").BriefingAudiencePayload
  initialUpdatedAt: string | null
  initialCompletedAt: string | null
  companyCity: string
  companyFormattedAddress: string
  companyAddressKey: string
  onBack?: () => void
  onContinue?: (completedAt: string) => void
}
