export type BriefingListStatus =
  "in_progress" | "finalized" | "edited_after_submit"

export const BRIEFING_LIST_STATUS_LABELS: Record<BriefingListStatus, string> = {
  in_progress: "Em andamento",
  finalized: "Briefing enviado",
  edited_after_submit: "Editado após envio",
}

export function deriveBriefingListStatus(
  finalizedAt: string | null,
  contentUpdatedAt: string | null,
): BriefingListStatus {
  if (!finalizedAt) return "in_progress"
  if (!contentUpdatedAt) return "finalized"
  return contentUpdatedAt > finalizedAt ? "edited_after_submit" : "finalized"
}
