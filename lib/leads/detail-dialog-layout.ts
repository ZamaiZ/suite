export type LeadDetailDialogTab = "activity" | "record" | "opportunity"

export function leadDetailDialogSize(
  tab: LeadDetailDialogTab,
): "lg" | "xl" {
  return tab === "opportunity" ? "xl" : "lg"
}
