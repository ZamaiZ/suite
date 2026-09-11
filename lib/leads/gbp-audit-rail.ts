export type GbpAuditRailStatus = "processing" | "analyzed" | "pending" | "error"

export type GbpAuditStepState =
  "current" | "processing" | "complete" | "error" | "upcoming"

export type GbpAuditRailStepId =
  | "google-profile"
  | "website"
  | "digital-presence"
  | "visibility"
  | "geo"
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
  pagespeed_at: string | null
  jobs: ReadonlyArray<{ status: "queued" | "running" | "ready" | "failed" }>
} | null

export type GbpAuditRailDigitalPresence = {
  updatedAt: string | null
  complete: boolean
  alertCount: number
  collectedAt: string | null
} | null

export type GbpAuditRailVisibility = {
  fetchedAt: string | null
  alertCount: number
} | null

export type GbpAuditRailGeo = {
  fetchedAt: string | null
  alertCount: number
} | null

export type GbpAuditRailDiagnosis = {
  unlocked: boolean
  hasExport: boolean
  updatedAt: string | null
  stale: boolean
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
  digitalPresence: GbpAuditRailDigitalPresence
  visibility: GbpAuditRailVisibility
  geo: GbpAuditRailGeo
  diagnosis: GbpAuditRailDiagnosis
  selectedStep: GbpAuditRailStepId
  googleAlertCount: number
  websiteAlertCount: number
}

const STEPS: ReadonlyArray<{ id: GbpAuditRailStepId; label: string }> = [
  { id: "google-profile", label: "Perfil no Google" },
  { id: "website", label: "Website" },
  { id: "digital-presence", label: "Presença digital" },
  { id: "visibility", label: "Visibilidade" },
  { id: "geo", label: "Presença em IA" },
  { id: "diagnosis", label: "Diagnóstico" },
]

const BASE_SELECTABLE = new Set<GbpAuditRailStepId>([
  "google-profile",
  "website",
  "digital-presence",
  "visibility",
  "geo",
  "diagnosis",
])

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

function websiteStatus(website: GbpAuditRailWebsite): GbpAuditRailStatus {
  if (!website) return "pending"
  const jobs = website.jobs
  if (jobs.some((job) => job.status === "queued" || job.status === "running")) {
    return "processing"
  }
  if (
    jobs.some((job) => job.status === "failed") &&
    !jobs.some((job) => job.status === "ready")
  ) {
    return "error"
  }
  return "analyzed"
}

function websiteState(
  website: GbpAuditRailWebsite,
  selected: boolean,
): GbpAuditStepState {
  const status = websiteStatus(website)
  if (status === "analyzed") return "complete"
  if (status === "processing" || status === "error") return status
  return selected ? "current" : "upcoming"
}

function digitalPresenceState(
  presence: GbpAuditRailDigitalPresence,
  selected: boolean,
): GbpAuditStepState {
  if (presence?.complete) return "complete"
  return selected ? "current" : "upcoming"
}

function digitalPresenceRailStatus(
  presence: GbpAuditRailDigitalPresence,
): GbpAuditRailStatus {
  if (presence?.complete) return "analyzed"
  return "pending"
}

function visibilityState(
  visibility: GbpAuditRailVisibility,
  selected: boolean,
): GbpAuditStepState {
  if (visibility?.fetchedAt) return "complete"
  return selected ? "current" : "upcoming"
}

function visibilityRailStatus(
  visibility: GbpAuditRailVisibility,
): GbpAuditRailStatus {
  if (visibility?.fetchedAt) return "analyzed"
  return "pending"
}

function geoState(
  geo: GbpAuditRailGeo,
  selected: boolean,
): GbpAuditStepState {
  if (geo?.fetchedAt) return "complete"
  return selected ? "current" : "upcoming"
}

function geoRailStatus(geo: GbpAuditRailGeo): GbpAuditRailStatus {
  return geo?.fetchedAt ? "analyzed" : "pending"
}

function diagnosisUnlocked(input: BuildGbpAuditRailInput): boolean {
  if (input.diagnosis?.unlocked === true) return true
  const google = googleStatus(input.profile)
  const website = websiteStatus(input.website)
  return (
    google === "analyzed" &&
    website === "analyzed" &&
    Boolean(input.digitalPresence?.complete) &&
    Boolean(input.visibility?.fetchedAt) &&
    // Presenca em IA destrava como as outras quatro. A sondagem em LLM **nao**
    // entra aqui: ela e o analogo de PageSpeed e backlinks, que enriquecem a
    // etapa e nao a definem.
    Boolean(input.geo?.fetchedAt)
  )
}

function diagnosisState(
  input: BuildGbpAuditRailInput,
  selected: boolean,
  unlocked: boolean,
): GbpAuditStepState {
  if (input.diagnosis?.hasExport) return "complete"
  if (!unlocked) return selected ? "current" : "upcoming"
  return selected ? "current" : "upcoming"
}

function diagnosisRailStatus(
  input: BuildGbpAuditRailInput,
  unlocked: boolean,
): GbpAuditRailStatus {
  if (!unlocked) return "pending"
  if (input.diagnosis?.hasExport) return "analyzed"
  return "pending"
}

export function buildGbpAuditRailModel(
  input: BuildGbpAuditRailInput,
): GbpAuditRailModel {
  const google = googleStatus(input.profile)
  const unlocked = diagnosisUnlocked(input)
  const selectable = BASE_SELECTABLE

  const selected = selectable.has(input.selectedStep)
    ? input.selectedStep
    : "google-profile"
  const selectedIndex = STEPS.findIndex((step) => step.id === selected)
  const website = websiteStatus(input.website)
  const presenceComplete = Boolean(input.digitalPresence?.complete)
  const visibilityComplete = Boolean(input.visibility?.fetchedAt)
  const geoComplete = Boolean(input.geo?.fetchedAt)
  const diagnosisComplete = Boolean(input.diagnosis?.hasExport)
  const completeCount =
    (google === "analyzed" ? 1 : 0) +
    (website === "analyzed" ? 1 : 0) +
    (presenceComplete ? 1 : 0) +
    (visibilityComplete ? 1 : 0) +
    (geoComplete ? 1 : 0) +
    (diagnosisComplete ? 1 : 0)

  const status: GbpAuditRailStatus =
    selected === "website"
      ? website
      : selected === "digital-presence"
        ? digitalPresenceRailStatus(input.digitalPresence)
        : selected === "visibility"
          ? visibilityRailStatus(input.visibility)
          : selected === "geo"
            ? geoRailStatus(input.geo)
            : selected === "diagnosis"
              ? diagnosisRailStatus(input, unlocked)
              : google

  const steps: GbpAuditRailStep[] = STEPS.map((step) => {
    const isSelected = step.id === selected
    const stepSelectable = selectable.has(step.id)
    if (step.id === "google-profile") {
      return {
        ...step,
        state: googleState(google, isSelected),
        selectable: stepSelectable,
        selected: isSelected,
        alertCount: Math.max(0, input.googleAlertCount),
        showAlerts: input.profile !== null,
      }
    }
    if (step.id === "website") {
      return {
        ...step,
        state: websiteState(input.website, isSelected),
        selectable: stepSelectable,
        selected: isSelected,
        alertCount: Math.max(0, input.websiteAlertCount),
        showAlerts: input.website !== null,
      }
    }
    if (step.id === "digital-presence") {
      const alertCount = Math.max(0, input.digitalPresence?.alertCount ?? 0)
      return {
        ...step,
        state: digitalPresenceState(input.digitalPresence, isSelected),
        selectable: stepSelectable,
        selected: isSelected,
        alertCount,
        showAlerts: input.digitalPresence !== null,
      }
    }
    if (step.id === "visibility") {
      const alertCount = Math.max(0, input.visibility?.alertCount ?? 0)
      return {
        ...step,
        state: visibilityState(input.visibility, isSelected),
        selectable: stepSelectable,
        selected: isSelected,
        alertCount,
        showAlerts: input.visibility !== null,
      }
    }
    if (step.id === "geo") {
      const alertCount = Math.max(0, input.geo?.alertCount ?? 0)
      return {
        ...step,
        state: geoState(input.geo, isSelected),
        selectable: stepSelectable,
        selected: isSelected,
        alertCount,
        showAlerts: input.geo !== null,
      }
    }
    return {
      ...step,
      state: diagnosisState(input, isSelected, unlocked),
      selectable: stepSelectable,
      selected: isSelected,
      alertCount: unlocked && input.diagnosis?.stale ? 1 : 0,
      showAlerts: unlocked,
    }
  })

  const selectedStep = steps[selectedIndex] ?? steps[0]

  let collectedAt: string | null = null
  let analyzedAt: string | null = null
  if (selected === "website") {
    collectedAt = input.website?.fetched_at ?? null
    analyzedAt = input.website?.pagespeed_at ?? null
  } else if (selected === "digital-presence") {
    collectedAt = input.digitalPresence?.collectedAt ?? null
    analyzedAt = input.digitalPresence?.updatedAt ?? null
  } else if (selected === "visibility") {
    collectedAt = input.visibility?.fetchedAt ?? null
    analyzedAt = input.visibility?.fetchedAt ?? null
  } else if (selected === "geo") {
    collectedAt = input.geo?.fetchedAt ?? null
    analyzedAt = input.geo?.fetchedAt ?? null
  } else if (selected === "diagnosis") {
    collectedAt = input.diagnosis?.updatedAt ?? null
    analyzedAt = input.diagnosis?.hasExport ? input.diagnosis.updatedAt : null
  } else {
    collectedAt = input.profile?.fetched_at ?? null
    analyzedAt = input.profile?.enrichment_at ?? null
  }

  return {
    status,
    currentStep: selectedIndex + 1,
    totalSteps: STEPS.length,
    progress: Math.round((completeCount / STEPS.length) * 100),
    alertCount: selectedStep?.alertCount ?? 0,
    showAlerts: selectedStep?.showAlerts ?? false,
    collectedAt,
    analyzedAt,
    steps,
  }
}
