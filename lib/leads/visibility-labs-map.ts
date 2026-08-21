import {
  bucketsFromPositions,
  type VisibilityKeywordRow,
  type VisibilityMetrics,
  type VisibilitySnapshot,
} from "./visibility-audit.ts"

export type RankedKeywordsLiveResult = {
  total_count?: number
  metrics?: {
    organic?: Record<string, unknown>
  }
  items?: Array<Record<string, unknown>>
}

function asFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asInt(value: unknown): number | null {
  const n = asFinite(value)
  return n === null ? null : Math.trunc(n)
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function mapOrganicMetrics(
  organic: Record<string, unknown> | undefined,
  keywordCount: number,
  positions: number[],
): VisibilityMetrics {
  if (!organic) {
    return {
      keywordCount,
      estimatedTraffic: null,
      estimatedTrafficCost: null,
      positionBuckets: bucketsFromPositions(positions),
    }
  }
  const pos1 = asInt(organic.pos_1) ?? 0
  const pos2_3 = asInt(organic.pos_2_3) ?? 0
  const pos4_10 = asInt(organic.pos_4_10) ?? 0
  const pos11_20 = asInt(organic.pos_11_20) ?? 0
  const pos21_30 = asInt(organic.pos_21_30) ?? 0
  const pos31_40 = asInt(organic.pos_31_40) ?? 0
  const pos41_50 = asInt(organic.pos_41_50) ?? 0
  const pos51_60 = asInt(organic.pos_51_60) ?? 0
  const pos61_70 = asInt(organic.pos_61_70) ?? 0
  const pos71_80 = asInt(organic.pos_71_80) ?? 0
  const pos81_90 = asInt(organic.pos_81_90) ?? 0
  const pos91_100 = asInt(organic.pos_91_100) ?? 0
  return {
    keywordCount: asInt(organic.count) ?? keywordCount,
    estimatedTraffic: asFinite(organic.etv),
    estimatedTrafficCost: asFinite(organic.estimated_paid_traffic_cost),
    positionBuckets: {
      top3: pos1 + pos2_3,
      pos4to10: pos4_10,
      pos11to20: pos11_20,
      pos21to50: pos21_30 + pos31_40 + pos41_50,
      pos51to100: pos51_60 + pos61_70 + pos71_80 + pos81_90 + pos91_100,
    },
  }
}

function mapKeywordItem(item: Record<string, unknown>): VisibilityKeywordRow | null {
  const keywordData =
    item.keyword_data && typeof item.keyword_data === "object"
      ? (item.keyword_data as Record<string, unknown>)
      : null
  const keyword = keywordData ? asString(keywordData.keyword) : null
  if (!keyword) return null

  const keywordInfo =
    keywordData?.keyword_info && typeof keywordData.keyword_info === "object"
      ? (keywordData.keyword_info as Record<string, unknown>)
      : null
  const keywordProperties =
    keywordData?.keyword_properties &&
    typeof keywordData.keyword_properties === "object"
      ? (keywordData.keyword_properties as Record<string, unknown>)
      : null
  const searchIntent =
    keywordData?.search_intent_info &&
    typeof keywordData.search_intent_info === "object"
      ? (keywordData.search_intent_info as Record<string, unknown>)
      : null

  const ranked =
    item.ranked_serp_element && typeof item.ranked_serp_element === "object"
      ? (item.ranked_serp_element as Record<string, unknown>)
      : null
  const serpItem =
    ranked?.serp_item && typeof ranked.serp_item === "object"
      ? (ranked.serp_item as Record<string, unknown>)
      : null

  const position =
    asInt(serpItem?.rank_group) ?? asInt(serpItem?.rank_absolute)
  const url =
    asString(serpItem?.relative_url) ?? asString(serpItem?.url) ?? null

  return {
    keyword,
    position: position !== null && position >= 1 ? position : null,
    url,
    volume: asInt(keywordInfo?.search_volume),
    traffic: asFinite(serpItem?.etv),
    difficulty: asInt(keywordProperties?.keyword_difficulty),
    intent: asString(searchIntent?.main_intent),
  }
}

export function mapRankedKeywordsLiveResult(input: {
  domain: string
  result: RankedKeywordsLiveResult | null
  collectedAt: string
}): VisibilitySnapshot {
  const items = Array.isArray(input.result?.items) ? input.result.items : []
  const keywords = items.flatMap((item) => {
    const row = mapKeywordItem(item)
    return row ? [row] : []
  })
  const positions = keywords
    .map((row) => row.position)
    .filter((value): value is number => value !== null)
  return {
    source: "dataforseo_labs",
    domain: input.domain,
    locationLabel: "Brazil",
    languageCode: "pt",
    collectedAt: input.collectedAt,
    searchCount: 1,
    metrics: mapOrganicMetrics(
      input.result?.metrics?.organic,
      asInt(input.result?.total_count) ?? keywords.length,
      positions,
    ),
    keywords,
  }
}
