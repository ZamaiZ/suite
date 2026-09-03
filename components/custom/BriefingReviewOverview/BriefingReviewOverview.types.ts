import type { StaffBriefingOverviewStep } from "@/app/actions/briefing"
import type { BriefingReviewStepState } from "@/lib/briefing/review-step-state"

export type BriefingReviewOverviewProps = {
  steps: StaffBriefingOverviewStep[]
  completedCount: number
  onSelectStep: (stepId: StaffBriefingOverviewStep["id"]) => void
  loading?: boolean
}

export type BriefingReviewTileTone = BriefingReviewStepState
