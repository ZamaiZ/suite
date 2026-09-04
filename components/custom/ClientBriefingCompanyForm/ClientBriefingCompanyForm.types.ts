export type ClientBriefingCompanyFormProps = {
  initialPayload: import("@/lib/briefing/company").BriefingCompanyPayload
  sourceSnapshot: import("@/lib/briefing/company").BriefingCompanyPayload
  initialUpdatedAt: string | null
  initialCompletedAt: string | null
  variant?: "portal" | "staff"
  onContinue?: (completedAt: string) => void
}
