export const VISIBILITY_SEARCH_CAP = 40
export const VISIBILITY_RELATED_SEED_MAX = 8
export const VISIBILITY_LOW_TRAFFIC = 50
export const VISIBILITY_THIN_KEYWORDS = 20

export type VisibilitySource = "dataforseo_labs" | "serpapi_organic"

export type VisibilityKeywordRow = {
  keyword: string
  position: number | null
  url: string | null
  volume: number | null
  traffic: number | null
  difficulty: number | null
  intent: string | null
}

export type VisibilityPositionBuckets = {
  top3: number
  pos4to10: number
  pos11to20: number
  pos21to50: number
  pos51to100: number
}

export type VisibilityMetrics = {
  keywordCount: number | null
  estimatedTraffic: number | null
  estimatedTrafficCost: number | null
  positionBuckets: VisibilityPositionBuckets | null
}

export type VisibilitySnapshot = {
  source: VisibilitySource
  domain: string
  locationLabel: string
  languageCode: string
  collectedAt: string
  searchCount: number
  metrics: VisibilityMetrics
  keywords: VisibilityKeywordRow[]
}

export type LeadVisibilityAudit = {
  id: string
  lead_id: string
  domain: string
  snapshot: VisibilitySnapshot
  fetched_at: string
  fetched_by: string
}

export type VisibilityGapId =
  | "brand_only_visibility"
  | "no_local_top20"
  | "homepage_only"
  | "not_ranking"
  | "low_organic_traffic"
  | "thin_keyword_footprint"

export const VISIBILITY_GAP_LABELS: Record<VisibilityGapId, string> = {
  brand_only_visibility: "Visibilidade só em marca",
  no_local_top20: "Sem keyword local no top 20",
  homepage_only: "Só a página inicial ranqueia",
  not_ranking: "Domínio sem posições orgânicas",
  low_organic_traffic: "Tráfego orgânico estimado baixo",
  thin_keyword_footprint: "Poucas keywords no índice",
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function asFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asInt(value: unknown): number | null {
  const n = asFinite(value)
  if (n === null) return null
  return Math.trunc(n)
}

function readBuckets(value: unknown): VisibilityPositionBuckets | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const top3 = asInt(row.top3)
  const pos4to10 = asInt(row.pos4to10)
  const pos11to20 = asInt(row.pos11to20)
  const pos21to50 = asInt(row.pos21to50)
  const pos51to100 = asInt(row.pos51to100)
  if (
    top3 === null ||
    pos4to10 === null ||
    pos11to20 === null ||
    pos21to50 === null ||
    pos51to100 === null
  ) {
    return null
  }
  return { top3, pos4to10, pos11to20, pos21to50, pos51to100 }
}

function readKeywordRow(value: unknown): VisibilityKeywordRow | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const keyword = asString(row.keyword)
  if (!keyword) return null
  const position = asInt(row.position)
  return {
    keyword,
    position: position !== null && position >= 1 ? position : null,
    url: asString(row.url),
    volume: asInt(row.volume),
    traffic: asFinite(row.traffic),
    difficulty: asInt(row.difficulty),
    intent: asString(row.intent),
  }
}

function readMetrics(value: unknown): VisibilityMetrics {
  if (!value || typeof value !== "object") {
    return {
      keywordCount: null,
      estimatedTraffic: null,
      estimatedTrafficCost: null,
      positionBuckets: null,
    }
  }
  const row = value as Record<string, unknown>
  return {
    keywordCount: asInt(row.keywordCount),
    estimatedTraffic: asFinite(row.estimatedTraffic),
    estimatedTrafficCost: asFinite(row.estimatedTrafficCost),
    positionBuckets: readBuckets(row.positionBuckets),
  }
}

export function emptyVisibilityBuckets(): VisibilityPositionBuckets {
  return {
    top3: 0,
    pos4to10: 0,
    pos11to20: 0,
    pos21to50: 0,
    pos51to100: 0,
  }
}

export function bucketsFromPositions(
  positions: ReadonlyArray<number | null>,
): VisibilityPositionBuckets {
  const buckets = emptyVisibilityBuckets()
  for (const position of positions) {
    if (position === null || position < 1) continue
    if (position <= 3) buckets.top3 += 1
    else if (position <= 10) buckets.pos4to10 += 1
    else if (position <= 20) buckets.pos11to20 += 1
    else if (position <= 50) buckets.pos21to50 += 1
    else if (position <= 100) buckets.pos51to100 += 1
  }
  return buckets
}

export function readVisibilitySnapshot(value: unknown): VisibilitySnapshot | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const source = row.source
  if (source !== "dataforseo_labs" && source !== "serpapi_organic") return null
  const domain = asString(row.domain)
  const locationLabel = asString(row.locationLabel)
  const languageCode = asString(row.languageCode)
  const collectedAt = asString(row.collectedAt)
  const searchCount = asInt(row.searchCount)
  if (!domain || !locationLabel || !languageCode || !collectedAt) return null
  if (searchCount === null || searchCount < 0) return null
  const keywords = Array.isArray(row.keywords)
    ? row.keywords.flatMap((item) => {
        const parsed = readKeywordRow(item)
        return parsed ? [parsed] : []
      })
    : []
  return {
    source,
    domain,
    locationLabel,
    languageCode,
    collectedAt,
    searchCount,
    metrics: readMetrics(row.metrics),
    keywords,
  }
}

export function readLeadVisibilityAuditRow(
  row: Record<string, unknown>,
): LeadVisibilityAudit | null {
  const id = asString(row.id)
  const lead_id = asString(row.lead_id)
  const domain = asString(row.domain)
  const fetched_at = asString(row.fetched_at)
  const fetched_by = asString(row.fetched_by)
  const snapshot = readVisibilitySnapshot(row.snapshot)
  if (!id || !lead_id || !domain || !fetched_at || !fetched_by || !snapshot) {
    return null
  }
  return {
    id,
    lead_id,
    domain,
    snapshot,
    fetched_at,
    fetched_by,
  }
}

export function foldVisibilityText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

export function brandTokensFromName(companyName: string): string[] {
  const folded = foldVisibilityText(companyName)
  if (!folded) return []
  const stop = new Set([
    "ltda",
    "me",
    "eireli",
    "sa",
    "s",
    "a",
    "e",
    "de",
    "da",
    "do",
    "dos",
    "das",
    "the",
    "group",
    "grupo",
  ])
  return folded
    .split(" ")
    .filter((token) => token.length >= 3 && !stop.has(token))
}

export function isBrandKeyword(
  keyword: string,
  companyName: string,
  domain: string,
): boolean {
  const foldedKeyword = foldVisibilityText(keyword)
  if (!foldedKeyword) return false
  const host = foldVisibilityText(domain.replace(/\.[a-z.]+$/i, ""))
  if (host && foldedKeyword.includes(host)) return true
  const tokens = brandTokensFromName(companyName)
  if (tokens.length === 0) return false
  return tokens.every((token) => foldedKeyword.includes(token))
}

export function isLocalKeyword(keyword: string, city: string | null): boolean {
  const folded = foldVisibilityText(keyword)
  if (!folded) return false
  if (/\bem\b/.test(folded)) return true
  if (!city) return false
  const cityFolded = foldVisibilityText(city)
  if (!cityFolded) return false
  return folded.includes(cityFolded)
}

export function isHomepageUrl(url: string | null, domain: string): boolean {
  if (!url) return true
  const trimmed = url.trim()
  if (!trimmed || trimmed === "/" || trimmed === "#") return true
  try {
    const absolute = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${domain}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`
    const parsed = new URL(absolute)
    const path = parsed.pathname.replace(/\/+$/, "") || "/"
    return path === "/" || path === "/index.html" || path === "/index.php"
  } catch {
    return trimmed === "/" || !trimmed.includes("/")
  }
}

export function cityFromFormattedAddress(address: string | null): string | null {
  if (!address) return null
  const match = address.match(/,\s*([^,]+?)\s*-\s*[A-Z]{2}\b/)
  if (match?.[1]) return match[1].trim()
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 2]
    if (candidate && !/\d/.test(candidate)) return candidate
  }
  return null
}

export function visibilityGapsForSnapshot(input: {
  snapshot: VisibilitySnapshot
  companyName: string
  city: string | null
}): VisibilityGapId[] {
  const { snapshot, companyName, city } = input
  const ranked = snapshot.keywords.filter(
    (row) => row.position !== null && row.position <= 100,
  )
  const gaps: VisibilityGapId[] = []

  if (ranked.length === 0) {
    gaps.push("not_ranking")
    return gaps
  }

  const top10 = ranked.filter((row) => (row.position ?? 999) <= 10)
  if (
    top10.length > 0 &&
    top10.every((row) => isBrandKeyword(row.keyword, companyName, snapshot.domain))
  ) {
    gaps.push("brand_only_visibility")
  }

  const localTop20 = ranked.some(
    (row) =>
      (row.position ?? 999) <= 20 && isLocalKeyword(row.keyword, city),
  )
  if (!localTop20) {
    gaps.push("no_local_top20")
  }

  if (
    ranked.every((row) => isHomepageUrl(row.url, snapshot.domain))
  ) {
    gaps.push("homepage_only")
  }

  if (
    snapshot.metrics.estimatedTraffic !== null &&
    snapshot.metrics.estimatedTraffic < VISIBILITY_LOW_TRAFFIC
  ) {
    gaps.push("low_organic_traffic")
  }

  if (
    snapshot.metrics.keywordCount !== null &&
    snapshot.source === "dataforseo_labs" &&
    snapshot.metrics.keywordCount < VISIBILITY_THIN_KEYWORDS
  ) {
    gaps.push("thin_keyword_footprint")
  }

  return gaps
}

export function visibilityGapLabel(id: VisibilityGapId): string {
  return VISIBILITY_GAP_LABELS[id]
}
