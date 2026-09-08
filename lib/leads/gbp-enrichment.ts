export const GBP_FEW_PHOTOS = 10
export const GBP_THIN_DESCRIPTION = 200
export const GBP_CID_MAX = 64

export type GbpRatingDistribution = {
  "1": number
  "2": number
  "3": number
  "4": number
  "5": number
}

export type GbpEnrichmentService = {
  title: string
  category: string | null
}

export type GbpPeopleAlsoSearch = {
  title: string
  cid: string | null
}

export type GbpEnrichmentSource = "dataforseo" | "serpapi"

export type GbpEnrichment = {
  source: GbpEnrichmentSource
  fetchedAt: string
  cid: string | null
  dataId: string | null
  isClaimed: boolean | null
  description: string | null
  category: string | null
  additionalCategories: string[]
  totalPhotos: number | null
  mainImageUrl: string | null
  /**
   * `null` significa que a coleta não trouxe o campo. Ausente é diferente de
   * vazio, e só o vazio é um gap.
   */
  services: GbpEnrichmentService[] | null
  ratingDistribution: GbpRatingDistribution | null
  peopleAlsoSearch: GbpPeopleAlsoSearch[]
  checkUrl: string | null
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function asCid(value: unknown): string | null {
  const text = asString(value)
  if (!text || text.length > GBP_CID_MAX) return null
  return text
}

function asCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null
  }
  return Math.trunc(value)
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const text = asString(item)
    return text ? [text] : []
  })
}

function readServices(value: unknown): GbpEnrichmentService[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    const title = asString(row.title)
    if (!title) return []
    return [{ title, category: asString(row.category) }]
  })
}

function readPeopleAlsoSearch(value: unknown): GbpPeopleAlsoSearch[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    const title = asString(row.title)
    if (!title) return []
    return [{ title, cid: asCid(row.cid) }]
  })
}

function readRatingDistribution(value: unknown): GbpRatingDistribution | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const stars = ["1", "2", "3", "4", "5"] as const
  const result: GbpRatingDistribution = {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
  }
  let seen = false
  for (const star of stars) {
    if (!(star in row)) continue
    const count = asCount(row[star])
    if (count === null) return null
    result[star] = count
    seen = true
  }
  return seen ? result : null
}

export function readGbpEnrichment(value: unknown): GbpEnrichment | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  if (row.source !== "dataforseo" && row.source !== "serpapi") return null
  const fetchedAt = asString(row.fetchedAt)
  if (!fetchedAt) return null
  if (
    row.additionalCategories !== undefined &&
    !Array.isArray(row.additionalCategories)
  ) {
    return null
  }
  if (
    row.services !== undefined &&
    row.services !== null &&
    !Array.isArray(row.services)
  ) {
    return null
  }
  if (
    row.peopleAlsoSearch !== undefined &&
    !Array.isArray(row.peopleAlsoSearch)
  ) {
    return null
  }
  const ratingDistribution =
    row.ratingDistribution === null || row.ratingDistribution === undefined
      ? null
      : readRatingDistribution(row.ratingDistribution)
  if (row.ratingDistribution != null && ratingDistribution === null) return null
  const totalPhotos =
    row.totalPhotos === null || row.totalPhotos === undefined
      ? null
      : asCount(row.totalPhotos)
  if (row.totalPhotos != null && totalPhotos === null) return null
  const isClaimed =
    row.isClaimed === null || row.isClaimed === undefined
      ? null
      : typeof row.isClaimed === "boolean"
        ? row.isClaimed
        : null
  if (row.isClaimed != null && isClaimed === null) return null

  return {
    source: row.source,
    fetchedAt,
    cid: asCid(row.cid),
    dataId: asString(row.dataId),
    isClaimed,
    description: asString(row.description),
    category: asString(row.category),
    additionalCategories: asStringList(row.additionalCategories),
    totalPhotos,
    mainImageUrl: asString(row.mainImageUrl),
    services: Array.isArray(row.services) ? readServices(row.services) : null,
    ratingDistribution,
    peopleAlsoSearch: readPeopleAlsoSearch(row.peopleAlsoSearch),
    checkUrl: asString(row.checkUrl),
  }
}

export function mapDataForSeoInfoItem(
  item: Record<string, unknown>,
  fetchedAt: string,
): GbpEnrichment {
  return {
    source: "dataforseo",
    fetchedAt,
    cid: asCid(item.cid),
    dataId: null,
    isClaimed: typeof item.is_claimed === "boolean" ? item.is_claimed : null,
    description: asString(item.description),
    category: asString(item.category),
    additionalCategories: asStringList(item.additional_categories),
    totalPhotos: asCount(item.total_photos),
    mainImageUrl: asString(item.main_image),
    // Ausente vira `null`, não `[]`: um perfil sem a chave não é um perfil sem
    // serviços, e tratar os dois igual inventa gap em toda coleta nova.
    services: Array.isArray(item.services) ? readServices(item.services) : null,
    ratingDistribution: readRatingDistribution(item.rating_distribution),
    peopleAlsoSearch: readPeopleAlsoSearch(item.people_also_search),
    checkUrl: asString(item.check_url),
  }
}
