export type BriefingReviewStepState = "empty" | "in_progress" | "completed"

export function deriveBriefingReviewStepState(
  row: { completedAt: string | null; updatedAt: string | null } | null,
): BriefingReviewStepState {
  if (!row) return "empty"
  if (row.completedAt) return "completed"
  return "in_progress"
}
