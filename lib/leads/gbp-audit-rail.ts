export type GbpAuditRailStatus =
  | "processing"
  | "analyzed"
  | "pending"
  | "error"

export type GbpAuditStepState =
  | "current"
  | "processing"
  | "complete"
  | "error"
  | "upcoming"

export type GbpAuditRailStepId =
  | "google-profile"
  | "website"
  | "digital-presence"
  | "visibility"
  | "diagnosis"

export type GbpAuditRailStep = {
  id: GbpAuditRailStepId
  label: string
  state: GbpAuditStepState
  selectable: boolean
  selected: boolean
  alertCount: number
  showAlerts: boolean
}

export type GbpAuditRailProfile = {
  fetched_at: string
  enrichment_at: string | null
  jobs: ReadonlyArray<{ status: "queued" | "ready" | "failed" }>
}

export type GbpAuditRailWebsite = {
  fetched_at: string
} | null

export type GbpAuditRailModel = {
  status: GbpAuditRailStatus
  currentStep: number
  totalSteps: number
  progress: number
  alertCount: number
  showAlerts: boolean
  collectedAt: string | null
  analyzedAt: string | null
  steps: GbpAuditRailStep[]
}

export type BuildGbpAuditRailInput = {
  profile: GbpAuditRailProfile | null
  website: GbpAuditRailWebsite
  selectedStep: GbpAuditRailStepId
  googleAlertCount: number
  websiteAlertCount: number
}

const STEPS: ReadonlyArray<{ id: GbpAuditRailStepId; label: string }> = [
  { id: "google-profile", label: "Perfil no Google" },
  { id: "website", label: "Website" },
  { id: "digital-presence", label: "Presença digital" },
  { id: "visibility", label: "Visibilidade" },
  { id: "diagnosis", label: "Diagnóstico" },
]

const SELECTABLE = new Set<GbpAuditRailStepId>(["google-profile", "website"])

function googleStatus(profile: GbpAuditRailProfile | null): GbpAuditRailStatus {
  if (!profile) return "pending"
  if (profile.jobs.some((job) => job.status === "queued")) return "processing"
  if (profile.jobs.some((job) => job.status === "failed")) return "error"
  if (profile.enrichment_at) return "analyzed"
  return "pending"
}

function googleState(
  status: GbpAuditRailStatus,
  selected: boolean,
): GbpAuditStepState {
  if (status === "analyzed") return "complete"
  if (status === "processing" || status === "error") return status
  return selected ? "current" : "upcoming"
}

function websiteState(
  website: GbpAuditRailWebsite,
  selected: boolean,
): GbpAuditStepState {
  if (website) return "complete"
  return selected ? "current" : "upcoming"
}

export function buildGbpAuditRailModel(
  input: BuildGbpAuditRailInput,
): GbpAuditRailModel {
  const google = googleStatus(input.profile)
  const selected = SELECTABLE.has(input.selectedStep)
    ? input.selectedStep
    : "google-profile"
  const selectedIndex = STEPS.findIndex((step) => step.id === selected)
  const completeCount =
    (google === "analyzed" ? 1 : 0) + (input.website ? 1 : 0)

  const status: GbpAuditRailStatus =
    selected === "website"
      ? input.website
        ? "analyzed"
        : "pending"
      : google

  const steps: GbpAuditRailStep[] = STEPS.map((step) => {
    const isSelected = step.id === selected
    const selectable = SELECTABLE.has(step.id)
    if (step.id === "google-profile") {
      return {
        ...step,
        state: googleState(google, isSelected),
        selectable,
        selected: isSelected,
        alertCount: Math.max(0, input.googleAlertCount),
        showAlerts: input.profile !== null,
      }
    }
    if (step.id === "website") {
      return {
        ...step,
        state: websiteState(input.website, isSelected),
        selectable,
        selected: isSelected,
        alertCount: Math.max(0, input.websiteAlertCount),
        showAlerts: input.website !== null,
      }
    }
    return {
      ...step,
      state: "upcoming" as const,
      selectable: false,
      selected: false,
      alertCount: 0,
      showAlerts: false,
    }
  })

  const selectedStep = steps[selectedIndex] ?? steps[0]

  return {
    status,
    currentStep: selectedIndex + 1,
    totalSteps: STEPS.length,
    progress: Math.round((completeCount / STEPS.length) * 100),
    alertCount: selectedStep?.alertCount ?? 0,
    showAlerts: selectedStep?.showAlerts ?? false,
    collectedAt:
      selected === "website"
        ? (input.website?.fetched_at ?? null)
        : (input.profile?.fetched_at ?? null),
    analyzedAt:
      selected === "website"
        ? (input.website?.fetched_at ?? null)
        : (input.profile?.enrichment_at ?? null),
    steps,
  }
}
