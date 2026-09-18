export {
  STEP_TONE_CHIP,
  STEP_TONE_FILL,
  STEP_TONE_RING,
  STEP_TONE_TEXT,
  StepCountCell,
  StepMeter,
  StepMeterRow,
  StepSectionLabel,
  StepStat,
  stepScoreTone,
  stepShareTone,
  type StepTone,
} from "./StepMetrics"
export { StepCard } from "./StepCard"
export { StepTabs, type StepTabDef } from "./StepTabs"
export {
  STEP_IMPACT_LABEL,
  StepOpportunityItem,
  type StepOpportunity,
} from "./StepOpportunityItem"
export { StepOpportunitiesRail } from "./StepOpportunitiesRail"
export { useCollapsibleRail, useWideViewport } from "./use-collapsible-rail"
// Reexportado do lugar novo: o hook saiu daqui para `hooks/` quando a paleta
// de comandos passou a precisar dele sem arrastar este barril inteiro para o
// bundle de toda página.
export { useCaptureShortcut } from "@/hooks/use-capture-shortcut"
export { StepNotesField, type StepNotesStatus } from "./StepNotesField"
