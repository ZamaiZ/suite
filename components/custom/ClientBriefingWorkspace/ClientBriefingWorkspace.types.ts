export type BriefingWorkspacePhase = "wizard" | "complete" | "editing"

export type ClientBriefingWorkspaceProps = {
  companyName: string
  onPhaseChange?: (phase: BriefingWorkspacePhase) => void
}
