export const PERSONA_AGE_RANGE_IDS = [
  "up_to_17",
  "18_24",
  "25_34",
  "35_44",
  "45_54",
  "55_64",
  "65_plus",
] as const

export type PersonaAgeRangeId = (typeof PERSONA_AGE_RANGE_IDS)[number]

export const PERSONA_AGE_RANGE_LABELS: Record<PersonaAgeRangeId, string> = {
  up_to_17: "Até 17",
  "18_24": "18–24",
  "25_34": "25–34",
  "35_44": "35–44",
  "45_54": "45–54",
  "55_64": "55–64",
  "65_plus": "65+",
}

export const PERSONA_INCOME_RANGE_IDS = [
  "up_to_2000",
  "2001_5000",
  "5001_10000",
  "10001_20000",
  "20001_50000",
  "above_50000",
] as const

export type PersonaIncomeRangeId = (typeof PERSONA_INCOME_RANGE_IDS)[number]

export const PERSONA_INCOME_RANGE_LABELS: Record<PersonaIncomeRangeId, string> =
  {
    up_to_2000: "Até R$ 2.000",
    "2001_5000": "R$ 2.001 – R$ 5.000",
    "5001_10000": "R$ 5.001 – R$ 10.000",
    "10001_20000": "R$ 10.001 – R$ 20.000",
    "20001_50000": "R$ 20.001 – R$ 50.000",
    above_50000: "Acima de R$ 50.000",
  }

export const PERSONA_SEX_IDS = ["male", "female", "both", "any"] as const
export type PersonaSexId = (typeof PERSONA_SEX_IDS)[number]

export const PERSONA_SEX_LABELS: Record<PersonaSexId, string> = {
  male: "Masculino",
  female: "Feminino",
  both: "Ambos",
  any: "Indiferente",
}

export const AUDIENCE_TEXTAREA_MAX = 8000
export const AUDIENCE_CHIP_MAX = 20
export const AUDIENCE_CHIP_ITEM_MAX = 80
export const AUDIENCE_LINE_MAX = 240
export const SERVICE_RADIUS_KM_MIN = 1
export const SERVICE_RADIUS_KM_MAX = 80
export const SERVICE_RADIUS_KM_DEFAULT = 10

export type BriefingAudiencePayload = {
  personaAgeRanges: PersonaAgeRangeId[]
  personaSex: PersonaSexId | null
  personaCity: string
  personaProfession: string
  personaIncomeRanges: PersonaIncomeRangeId[]
  personaPains: string[]
  personaBehaviors: string[]
  personaObjections: string
  personaTraits: string
  voiceTone: string
  serviceRadiusNotApplicable: boolean
  serviceRadiusKm: number
  mapLatitude: number | null
  mapLongitude: number | null
  mapAddressKey: string
  targetNeighborhoods: string[]
  targetCities: string[]
  priorityRegion: string
  keywords: string[]
  primaryKeyword: string
}

export function emptyAudiencePayload(): BriefingAudiencePayload {
  return {
    personaAgeRanges: [],
    personaSex: null,
    personaCity: "",
    personaProfession: "",
    personaIncomeRanges: [],
    personaPains: [],
    personaBehaviors: [],
    personaObjections: "",
    personaTraits: "",
    voiceTone: "",
    serviceRadiusNotApplicable: false,
    serviceRadiusKm: SERVICE_RADIUS_KM_DEFAULT,
    mapLatitude: null,
    mapLongitude: null,
    mapAddressKey: "",
    targetNeighborhoods: [],
    targetCities: [],
    priorityRegion: "",
    keywords: [],
    primaryKeyword: "",
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

export function isPersonaAgeRangeId(
  value: unknown,
): value is PersonaAgeRangeId {
  return (
    typeof value === "string" &&
    (PERSONA_AGE_RANGE_IDS as readonly string[]).includes(value)
  )
}

export function isPersonaSexId(value: unknown): value is PersonaSexId {
  return (
    typeof value === "string" &&
    (PERSONA_SEX_IDS as readonly string[]).includes(value)
  )
}

export function isPersonaIncomeRangeId(
  value: unknown,
): value is PersonaIncomeRangeId {
  return (
    typeof value === "string" &&
    (PERSONA_INCOME_RANGE_IDS as readonly string[]).includes(value)
  )
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return value
}

function clampServiceRadiusKm(value: number): number {
  if (!Number.isFinite(value)) return SERVICE_RADIUS_KM_DEFAULT
  const rounded = Math.round(value)
  if (rounded < SERVICE_RADIUS_KM_MIN) return SERVICE_RADIUS_KM_MIN
  if (rounded > SERVICE_RADIUS_KM_MAX) return SERVICE_RADIUS_KM_MAX
  return rounded
}

function normalizeChipList(values: string[]): string[] {
  return values
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, AUDIENCE_CHIP_MAX)
}

function mapLegacyIncomeCentsToRange(
  cents: number,
): PersonaIncomeRangeId | null {
  if (cents <= 200_000) return "up_to_2000"
  if (cents <= 500_000) return "2001_5000"
  if (cents <= 1_000_000) return "5001_10000"
  if (cents <= 2_000_000) return "10001_20000"
  if (cents <= 5_000_000) return "20001_50000"
  return "above_50000"
}

export function parseAudiencePayload(value: unknown): BriefingAudiencePayload {
  const base = emptyAudiencePayload()
  if (!value || typeof value !== "object") return base
  const row = value as Record<string, unknown>

  const personaAgeRanges = asStringList(row.personaAgeRanges)
    .filter(isPersonaAgeRangeId)
    .filter(
      (id, index, list) => list.findIndex((item) => item === id) === index,
    )

  const personaIncomeRanges = asStringList(row.personaIncomeRanges)
    .filter(isPersonaIncomeRangeId)
    .filter(
      (id, index, list) => list.findIndex((item) => item === id) === index,
    )

  const legacyIncomeCents = asFiniteNumber(row.personaIncomeCents)
  const resolvedIncomeRanges =
    personaIncomeRanges.length > 0
      ? personaIncomeRanges
      : legacyIncomeCents !== null && legacyIncomeCents > 0
        ? ([mapLegacyIncomeCentsToRange(Math.round(legacyIncomeCents))].filter(
            Boolean,
          ) as PersonaIncomeRangeId[])
        : []

  const latitude = asFiniteNumber(row.mapLatitude)
  const longitude = asFiniteNumber(row.mapLongitude)
  const radius = asFiniteNumber(row.serviceRadiusKm)

  return {
    personaAgeRanges,
    personaSex: isPersonaSexId(row.personaSex) ? row.personaSex : null,
    personaCity: asString(row.personaCity),
    personaProfession: asString(row.personaProfession),
    personaIncomeRanges: resolvedIncomeRanges,
    personaPains: normalizeChipList(asStringList(row.personaPains)),
    personaBehaviors: normalizeChipList(asStringList(row.personaBehaviors)),
    personaObjections: asString(row.personaObjections),
    personaTraits: asString(row.personaTraits),
    voiceTone: asString(row.voiceTone),
    serviceRadiusNotApplicable: row.serviceRadiusNotApplicable === true,
    serviceRadiusKm: clampServiceRadiusKm(radius ?? SERVICE_RADIUS_KM_DEFAULT),
    mapLatitude: latitude,
    mapLongitude: longitude,
    mapAddressKey: asString(row.mapAddressKey),
    targetNeighborhoods: normalizeChipList(
      asStringList(row.targetNeighborhoods),
    ),
    targetCities: normalizeChipList(asStringList(row.targetCities)),
    priorityRegion: asString(row.priorityRegion),
    keywords: normalizeChipList(asStringList(row.keywords)),
    primaryKeyword: asString(row.primaryKeyword).trim(),
  }
}

function keywordInList(primary: string, keywords: string[]): boolean {
  const needle = primary.trim().toLowerCase()
  if (!needle) return false
  return keywords.some((item) => item.trim().toLowerCase() === needle)
}

export function isAudienceReadyToComplete(
  payload: BriefingAudiencePayload,
): boolean {
  if (payload.personaAgeRanges.length === 0) return false
  if (payload.personaSex === null) return false
  if (payload.personaCity.trim().length === 0) return false
  if (payload.personaProfession.trim().length === 0) return false
  if (payload.personaIncomeRanges.length === 0) return false
  if (payload.personaPains.length === 0) return false
  if (payload.personaBehaviors.length === 0) return false
  if (payload.personaObjections.trim().length === 0) return false
  if (payload.personaTraits.trim().length === 0) return false
  if (payload.voiceTone.trim().length === 0) return false

  if (!payload.serviceRadiusNotApplicable) {
    if (
      payload.serviceRadiusKm < SERVICE_RADIUS_KM_MIN ||
      payload.serviceRadiusKm > SERVICE_RADIUS_KM_MAX
    ) {
      return false
    }
  }

  if (payload.targetCities.length === 0) return false
  if (payload.priorityRegion.trim().length === 0) return false
  if (payload.keywords.length === 0) return false
  if (!keywordInList(payload.primaryKeyword, payload.keywords)) return false

  return true
}

export type AudienceMissingGroup =
  | "personaAge"
  | "personaSex"
  | "personaProfile"
  | "personaIncome"
  | "personaPains"
  | "personaBehaviors"
  | "personaObjections"
  | "personaTraits"
  | "voiceTone"
  | "serviceRadius"
  | "targetCities"
  | "priorityRegion"
  | "keywords"
  | "primaryKeyword"

export const AUDIENCE_MISSING_LABELS: Record<AudienceMissingGroup, string> = {
  personaAge: "faixa etária",
  personaSex: "sexo",
  personaProfile: "cidade e profissão da persona",
  personaIncome: "renda média",
  personaPains: "dores",
  personaBehaviors: "comportamentos",
  personaObjections: "objeções",
  personaTraits: "características",
  voiceTone: "tom de voz",
  serviceRadius: "raio de atendimento",
  targetCities: "cidades no Google",
  priorityRegion: "região prioridade",
  keywords: "palavras-chave",
  primaryKeyword: "palavra-chave principal",
}

export function getAudienceMissingGroups(
  payload: BriefingAudiencePayload,
): AudienceMissingGroup[] {
  const missing: AudienceMissingGroup[] = []

  if (payload.personaAgeRanges.length === 0) missing.push("personaAge")
  if (payload.personaSex === null) missing.push("personaSex")
  if (
    payload.personaCity.trim().length === 0 ||
    payload.personaProfession.trim().length === 0
  ) {
    missing.push("personaProfile")
  }
  if (payload.personaIncomeRanges.length === 0) {
    missing.push("personaIncome")
  }
  if (payload.personaPains.length === 0) missing.push("personaPains")
  if (payload.personaBehaviors.length === 0) missing.push("personaBehaviors")
  if (payload.personaObjections.trim().length === 0) {
    missing.push("personaObjections")
  }
  if (payload.personaTraits.trim().length === 0) missing.push("personaTraits")
  if (payload.voiceTone.trim().length === 0) missing.push("voiceTone")

  if (
    !payload.serviceRadiusNotApplicable &&
    (payload.serviceRadiusKm < SERVICE_RADIUS_KM_MIN ||
      payload.serviceRadiusKm > SERVICE_RADIUS_KM_MAX)
  ) {
    missing.push("serviceRadius")
  }

  if (payload.targetCities.length === 0) missing.push("targetCities")
  if (payload.priorityRegion.trim().length === 0) missing.push("priorityRegion")
  if (payload.keywords.length === 0) missing.push("keywords")
  else if (!keywordInList(payload.primaryKeyword, payload.keywords)) {
    missing.push("primaryKeyword")
  }

  return missing
}
