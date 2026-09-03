export const HISTORY_ANSWER_IDS = ["yes", "no"] as const

export type HistoryAnswerId = (typeof HISTORY_ANSWER_IDS)[number]

export const HISTORY_TEXTAREA_MAX = 8000

export type BriefingHistoryPayload = {
  hasMarketingInvestment: HistoryAnswerId | null
  marketingChannels: string
  marketingResults: string
  hasProviderDissatisfaction: HistoryAnswerId | null
  providerDissatisfactionNotes: string
  projectGoals: string
  npsTenCriteria: string
}

export function emptyHistoryPayload(): BriefingHistoryPayload {
  return {
    hasMarketingInvestment: null,
    marketingChannels: "",
    marketingResults: "",
    hasProviderDissatisfaction: null,
    providerDissatisfactionNotes: "",
    projectGoals: "",
    npsTenCriteria: "",
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function isHistoryAnswerId(value: unknown): value is HistoryAnswerId {
  return (
    typeof value === "string" &&
    (HISTORY_ANSWER_IDS as readonly string[]).includes(value)
  )
}

export function sanitizeHistoryPayload(
  payload: BriefingHistoryPayload,
): BriefingHistoryPayload {
  if (payload.hasMarketingInvestment !== "yes") {
    return {
      ...payload,
      marketingChannels: "",
      marketingResults: "",
      hasProviderDissatisfaction: null,
      providerDissatisfactionNotes: "",
      projectGoals: payload.projectGoals,
      npsTenCriteria: payload.npsTenCriteria,
      hasMarketingInvestment: payload.hasMarketingInvestment,
    }
  }

  if (payload.hasProviderDissatisfaction !== "yes") {
    return {
      ...payload,
      providerDissatisfactionNotes: "",
    }
  }

  return payload
}

export function parseHistoryPayload(value: unknown): BriefingHistoryPayload {
  const base = emptyHistoryPayload()
  if (!value || typeof value !== "object") return base
  const row = value as Record<string, unknown>

  return sanitizeHistoryPayload({
    hasMarketingInvestment: isHistoryAnswerId(row.hasMarketingInvestment)
      ? row.hasMarketingInvestment
      : null,
    marketingChannels: asString(row.marketingChannels).slice(
      0,
      HISTORY_TEXTAREA_MAX,
    ),
    marketingResults: asString(row.marketingResults).slice(
      0,
      HISTORY_TEXTAREA_MAX,
    ),
    hasProviderDissatisfaction: isHistoryAnswerId(
      row.hasProviderDissatisfaction,
    )
      ? row.hasProviderDissatisfaction
      : null,
    providerDissatisfactionNotes: asString(
      row.providerDissatisfactionNotes,
    ).slice(0, HISTORY_TEXTAREA_MAX),
    projectGoals: asString(row.projectGoals).slice(0, HISTORY_TEXTAREA_MAX),
    npsTenCriteria: asString(row.npsTenCriteria).slice(0, HISTORY_TEXTAREA_MAX),
  })
}

export type HistoryMissingGroup =
  | "hasMarketingInvestment"
  | "marketingChannels"
  | "marketingResults"
  | "hasProviderDissatisfaction"
  | "providerDissatisfactionNotes"
  | "projectGoals"
  | "npsTenCriteria"

export const HISTORY_MISSING_LABELS: Record<HistoryMissingGroup, string> = {
  hasMarketingInvestment: "investimento em marketing",
  marketingChannels: "em que investiu",
  marketingResults: "resultados do investimento",
  hasProviderDissatisfaction: "insatisfação com prestador",
  providerDissatisfactionNotes: "detalhe da insatisfação",
  projectGoals: "objetivos do projeto",
  npsTenCriteria: "critério de NPS 10",
}

export function getHistoryMissingGroups(
  payload: BriefingHistoryPayload,
): HistoryMissingGroup[] {
  const sanitized = sanitizeHistoryPayload(payload)
  const missing: HistoryMissingGroup[] = []

  if (sanitized.hasMarketingInvestment === null) {
    missing.push("hasMarketingInvestment")
  } else if (sanitized.hasMarketingInvestment === "yes") {
    if (sanitized.marketingChannels.trim().length === 0) {
      missing.push("marketingChannels")
    }
    if (sanitized.marketingResults.trim().length === 0) {
      missing.push("marketingResults")
    }
    if (sanitized.hasProviderDissatisfaction === null) {
      missing.push("hasProviderDissatisfaction")
    } else if (
      sanitized.hasProviderDissatisfaction === "yes" &&
      sanitized.providerDissatisfactionNotes.trim().length === 0
    ) {
      missing.push("providerDissatisfactionNotes")
    }
  }

  if (sanitized.projectGoals.trim().length === 0) {
    missing.push("projectGoals")
  }
  if (sanitized.npsTenCriteria.trim().length === 0) {
    missing.push("npsTenCriteria")
  }

  return missing
}

export function isHistoryReadyToComplete(
  payload: BriefingHistoryPayload,
): boolean {
  return getHistoryMissingGroups(payload).length === 0
}
