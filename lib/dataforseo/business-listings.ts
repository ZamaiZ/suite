import "server-only"

import { postDataForSeoLiveDetailed } from "./client"

const BUSINESS_LISTINGS_PATH =
  "/business_data/business_listings/search/live"
const BUSINESS_LISTINGS_ERROR =
  "Não foi possível coletar esta página de prospecção."

type RawBusinessListingsPage = {
  total_count?: unknown
  count?: unknown
  offset?: unknown
  offset_token?: unknown
  items?: unknown
}

export type BusinessListingsSearchInput = {
  categories: readonly string[]
  latitude: number
  longitude: number
  radiusKm: number
  limit: number
  offset?: number | null
  offsetToken?: string | null
}

export type BusinessListingsPage = {
  totalCount: number | null
  count: number
  offset: number
  offsetToken: string | null
  nextOffset: number | null
  nextOffsetToken: string | null
  items: Record<string, unknown>[]
  cost: number
}

export type BusinessListingsPageResult =
  | { status: "ok"; page: BusinessListingsPage }
  | {
      status: "rejected"
      code: number | null
      message: string
      cost: number
    }
  | { status: "unknown"; message: string }
  | { status: "invalid_response"; message: string; cost: number }

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function nonNegativeInteger(value: unknown): number | null {
  const number = finiteNumber(value)
  return number !== null && Number.isInteger(number) && number >= 0
    ? number
    : null
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function locationCoordinate(input: BusinessListingsSearchInput): string {
  return [
    Number(input.latitude.toFixed(7)),
    Number(input.longitude.toFixed(7)),
    // O fornecedor documenta e exemplifica o raio em quilômetros inteiros.
    // Arredondar para cima preserva toda a área municipal; o geofence elimina
    // os resultados adicionais fora do polígono depois da coleta.
    Math.ceil(input.radiusKm),
  ].join(",")
}

function validInput(input: BusinessListingsSearchInput): boolean {
  const uniqueCategories = new Set(input.categories)
  return (
    input.categories.length >= 1 &&
    input.categories.length <= 10 &&
    uniqueCategories.size === input.categories.length &&
    [...uniqueCategories].every((category) => category.trim().length > 0) &&
    Number.isFinite(input.latitude) &&
    input.latitude >= -90 &&
    input.latitude <= 90 &&
    Number.isFinite(input.longitude) &&
    input.longitude >= -180 &&
    input.longitude <= 180 &&
    Number.isFinite(input.radiusKm) &&
    input.radiusKm > 0 &&
    input.radiusKm <= 100_000 &&
    Number.isInteger(input.limit) &&
    input.limit >= 1 &&
    input.limit <= 1000 &&
    !(input.offsetToken && input.offset !== null && input.offset !== undefined) &&
    (input.offset === null ||
      input.offset === undefined ||
      (Number.isInteger(input.offset) && input.offset >= 0))
  )
}

export async function fetchBusinessListingsPage(
  input: BusinessListingsSearchInput,
): Promise<BusinessListingsPageResult> {
  if (!validInput(input)) {
    return {
      status: "invalid_response",
      message: "Parâmetros inválidos para a página de prospecção.",
      cost: 0,
    }
  }

  const coordinate = locationCoordinate(input)
  const posted = await postDataForSeoLiveDetailed<RawBusinessListingsPage>(
    BUSINESS_LISTINGS_PATH,
    {
      categories: [...input.categories],
      language_code: "pt",
      location_coordinate: coordinate,
      limit: input.limit,
      ...(input.offsetToken
        ? { offset_token: input.offsetToken }
        : input.offset !== null && input.offset !== undefined
          ? { offset: input.offset }
          : {}),
    },
    30_000,
  )
  if (posted.status === "unknown") {
    return { status: "unknown", message: BUSINESS_LISTINGS_ERROR }
  }
  if (posted.status === "rejected") {
    console.error("[prospecting] business listings request rejected", {
      code: posted.code,
      cost: posted.cost,
      categories: input.categories,
      locationCoordinate: coordinate,
      limit: input.limit,
      hasOffsetToken: Boolean(input.offsetToken),
      offset: input.offset ?? null,
    })
    const reference = posted.code
      ? ` Código DataForSEO ${posted.code}.`
      : ""
    return {
      status: "rejected",
      code: posted.code,
      message: `${BUSINESS_LISTINGS_ERROR}${reference}`,
      cost: posted.cost,
    }
  }
  if (!posted.data || !Array.isArray(posted.data.items)) {
    return {
      status: "invalid_response",
      message: BUSINESS_LISTINGS_ERROR,
      cost: posted.cost,
    }
  }

  const items = posted.data.items.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item),
  )
  const reportedCount = nonNegativeInteger(posted.data.count)
  const count = reportedCount ?? items.length
  const offset = nonNegativeInteger(posted.data.offset) ?? input.offset ?? 0
  const totalCount = nonNegativeInteger(posted.data.total_count)
  const outputToken = text(posted.data.offset_token)
  const hasMoreByTotal =
    totalCount !== null && count > 0 && offset + count < totalCount
  const hasMore = count > 0 && (hasMoreByTotal || (totalCount === null && Boolean(outputToken)))

  if (
    count !== items.length ||
    (hasMore && outputToken === input.offsetToken) ||
    (hasMore && !outputToken && totalCount === null)
  ) {
    return {
      status: "invalid_response",
      message: BUSINESS_LISTINGS_ERROR,
      cost: posted.cost,
    }
  }

  return {
    status: "ok",
    page: {
      totalCount,
      count,
      offset,
      offsetToken: outputToken,
      nextOffset: hasMore ? offset + count : null,
      nextOffsetToken: hasMore ? outputToken : null,
      items,
      cost: posted.cost,
    },
  }
}
