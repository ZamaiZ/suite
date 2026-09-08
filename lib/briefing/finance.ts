import {
  isProductOrServiceComplete,
  type ProductOrService,
} from "@/lib/briefing/brand"

export const REVENUE_RANGE_IDS = [
  "up_to_10k",
  "10k_30k",
  "30k_50k",
  "50k_100k",
  "100k_300k",
  "300k_1m",
  "above_1m",
] as const

export type RevenueRangeId = (typeof REVENUE_RANGE_IDS)[number]

export const REVENUE_RANGE_LABELS: Record<RevenueRangeId, string> = {
  up_to_10k: "Até R$ 10 mil",
  "10k_30k": "R$ 10–30 mil",
  "30k_50k": "R$ 30–50 mil",
  "50k_100k": "R$ 50–100 mil",
  "100k_300k": "R$ 100–300 mil",
  "300k_1m": "R$ 300 mil–1 mi",
  above_1m: "Acima de R$ 1 mi",
}

export const SEASONALITY_PROFILE_IDS = [
  "predictable",
  "seasonal",
  "unstable",
] as const

export type SeasonalityProfileId = (typeof SEASONALITY_PROFILE_IDS)[number]

export const SEASONALITY_PROFILE_LABELS: Record<SeasonalityProfileId, string> =
  {
    predictable: "Alta previsibilidade",
    seasonal: "Sazonal",
    unstable: "Instável",
  }

export const SEASONALITY_PROFILE_DESCRIPTIONS: Record<
  SeasonalityProfileId,
  string
> = {
  predictable: "Faturamento estável, sem grandes variações mês a mês.",
  seasonal:
    "Há meses ou datas que mudam o resultado de forma clara (para cima ou para baixo).",
  unstable: "Oscila muito, sem padrão claro ano após ano.",
}

export const FINANCE_TEXTAREA_MAX = 8000

export type BriefingFinancePayload = {
  monthlyRevenueRange: RevenueRangeId | null
  peakRevenueRange: RevenueRangeId | null
  peakRevenueReason: string
  seasonalityProfile: SeasonalityProfileId | null
  seasonalityNotes: string
  highestProfitProductId: string | null
  highestProfitServiceId: string | null
  averageTicketRange: RevenueRangeId | null
}

export function emptyFinancePayload(): BriefingFinancePayload {
  return {
    monthlyRevenueRange: null,
    peakRevenueRange: null,
    peakRevenueReason: "",
    seasonalityProfile: null,
    seasonalityNotes: "",
    highestProfitProductId: null,
    highestProfitServiceId: null,
    averageTicketRange: null,
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function isRevenueRangeId(value: unknown): value is RevenueRangeId {
  return (
    typeof value === "string" &&
    (REVENUE_RANGE_IDS as readonly string[]).includes(value)
  )
}

function isSeasonalityProfileId(value: unknown): value is SeasonalityProfileId {
  return (
    typeof value === "string" &&
    (SEASONALITY_PROFILE_IDS as readonly string[]).includes(value)
  )
}

function asOptionalId(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function parseFinancePayload(value: unknown): BriefingFinancePayload {
  const base = emptyFinancePayload()
  if (!value || typeof value !== "object") return base
  const row = value as Record<string, unknown>

  const seasonalityProfile = isSeasonalityProfileId(row.seasonalityProfile)
    ? row.seasonalityProfile
    : null

  return {
    monthlyRevenueRange: isRevenueRangeId(row.monthlyRevenueRange)
      ? row.monthlyRevenueRange
      : null,
    peakRevenueRange: isRevenueRangeId(row.peakRevenueRange)
      ? row.peakRevenueRange
      : null,
    peakRevenueReason: asString(row.peakRevenueReason),
    seasonalityProfile,
    seasonalityNotes:
      seasonalityProfile === "predictable"
        ? ""
        : asString(row.seasonalityNotes),
    highestProfitProductId: asOptionalId(row.highestProfitProductId),
    highestProfitServiceId: asOptionalId(row.highestProfitServiceId),
    averageTicketRange: isRevenueRangeId(row.averageTicketRange)
      ? row.averageTicketRange
      : null,
  }
}

export function eligibleCatalogItems(
  catalog: ProductOrService[],
): ProductOrService[] {
  return catalog.filter(isProductOrServiceComplete)
}

export function sanitizeFinanceCatalogIds(
  payload: BriefingFinancePayload,
  catalog: ProductOrService[],
): BriefingFinancePayload {
  const eligible = eligibleCatalogItems(catalog)
  const productIds = new Set(
    eligible.filter((item) => item.kind === "product").map((item) => item.id),
  )
  const serviceIds = new Set(
    eligible.filter((item) => item.kind === "service").map((item) => item.id),
  )

  return {
    ...payload,
    highestProfitProductId:
      payload.highestProfitProductId &&
      productIds.has(payload.highestProfitProductId)
        ? payload.highestProfitProductId
        : null,
    highestProfitServiceId:
      payload.highestProfitServiceId &&
      serviceIds.has(payload.highestProfitServiceId)
        ? payload.highestProfitServiceId
        : null,
  }
}

export function isFinanceReadyToComplete(
  payload: BriefingFinancePayload,
  catalog: ProductOrService[],
): boolean {
  return getFinanceMissingGroups(payload, catalog).length === 0
}

export type FinanceMissingGroup =
  | "monthlyRevenueRange"
  | "peakRevenueRange"
  | "peakRevenueReason"
  | "seasonalityProfile"
  | "seasonalityNotes"
  | "highestProfitProduct"
  | "highestProfitService"
  | "catalog"
  | "averageTicketRange"

export const FINANCE_MISSING_LABELS: Record<FinanceMissingGroup, string> = {
  monthlyRevenueRange: "faturamento médio mensal",
  peakRevenueRange: "maior pico de faturamento",
  peakRevenueReason: "motivo do pico",
  seasonalityProfile: "sazonalidade",
  seasonalityNotes: "detalhes da sazonalidade",
  highestProfitProduct: "produto de maior lucro",
  highestProfitService: "serviço de maior lucro",
  catalog: "produtos ou serviços no step Marca",
  averageTicketRange: "ticket médio",
}

export function getFinanceMissingGroups(
  payload: BriefingFinancePayload,
  catalog: ProductOrService[],
): FinanceMissingGroup[] {
  const missing: FinanceMissingGroup[] = []
  const sanitized = sanitizeFinanceCatalogIds(payload, catalog)
  const eligible = eligibleCatalogItems(catalog)
  const products = eligible.filter((item) => item.kind === "product")
  const services = eligible.filter((item) => item.kind === "service")

  if (sanitized.monthlyRevenueRange === null) {
    missing.push("monthlyRevenueRange")
  }
  if (sanitized.peakRevenueRange === null) {
    missing.push("peakRevenueRange")
  }
  if (sanitized.peakRevenueReason.trim().length === 0) {
    missing.push("peakRevenueReason")
  }
  if (sanitized.seasonalityProfile === null) {
    missing.push("seasonalityProfile")
  } else if (
    sanitized.seasonalityProfile !== "predictable" &&
    sanitized.seasonalityNotes.trim().length === 0
  ) {
    missing.push("seasonalityNotes")
  }

  if (eligible.length === 0) {
    missing.push("catalog")
  } else {
    if (products.length > 0 && !sanitized.highestProfitProductId) {
      missing.push("highestProfitProduct")
    }
    if (services.length > 0 && !sanitized.highestProfitServiceId) {
      missing.push("highestProfitService")
    }
  }

  if (sanitized.averageTicketRange === null) {
    missing.push("averageTicketRange")
  }

  return missing
}
