export type ClientBriefingCompanyFormProps = {
  initialPayload: import("@/lib/briefing/company").BriefingCompanyPayload
  sourceSnapshot: import("@/lib/briefing/company").BriefingCompanyPayload
  initialUpdatedAt: string | null
  initialCompletedAt: string | null
  onContinue?: (completedAt: string) => void
}
