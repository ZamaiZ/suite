import "server-only"

import {
  bucketsFromPositions,
  type VisibilityKeywordRow,
  type VisibilitySnapshot,
  VISIBILITY_RELATED_SEED_MAX,
  VISIBILITY_SEARCH_CAP,
} from "@/lib/leads/visibility-audit"
import {
  collectRelatedQueries,
  findOrganicRankForDomain,
} from "@/lib/leads/visibility-organic-parse"
import {
  buildVisibilitySeedKeywords,
  mergeVisibilityRelatedKeywords,
  type VisibilitySeedInput,
} from "@/lib/leads/visibility-seeds"
import { getSerpApiJson, requireSerpApiQuota } from "./client"

export const SERPAPI_ORGANIC_ERROR =
  "Não foi possível checar a visibilidade orgânica. Tente novamente."

export type FetchSerpApiOrganicVisibilityResult =
  | { status: "ok"; snapshot: VisibilitySnapshot }
  | { status: "error"; message: string }

async function fetchOrganicSearch(
  keyword: string,
): Promise<
  | { status: "ok"; data: Record<string, unknown> }
  | { status: "error"; message: string }
> {
  return getSerpApiJson(
    {
      engine: "google",
      q: keyword,
      num: "100",
    },
    SERPAPI_ORGANIC_ERROR,
  )
}

export async function fetchSerpApiOrganicVisibility(input: {
  domain: string
  seedInput: VisibilitySeedInput
  collectedAt: string
}): Promise<FetchSerpApiOrganicVisibilityResult> {
  const seeds = buildVisibilitySeedKeywords(input.seedInput)
  if (seeds.length === 0) {
    return {
      status: "error",
      message: "Não há termos suficientes para analisar a visibilidade.",
    }
  }

  const expandCount = Math.min(VISIBILITY_RELATED_SEED_MAX, seeds.length)
  const related: string[] = []
  const seedResults = new Map<string, Record<string, unknown>>()

  for (let index = 0; index < expandCount; index += 1) {
    const keyword = seeds[index]
    if (!keyword) continue
    const left = await requireSerpApiQuota(1)
    if (left.status === "error") {
      if (seedResults.size === 0) return left
      break
    }
    const fetched = await fetchOrganicSearch(keyword)
    if (fetched.status === "error") {
      if (seedResults.size === 0) return fetched
      break
    }
    seedResults.set(keyword, fetched.data)
    related.push(...collectRelatedQueries(fetched.data))
  }

  const keywords = mergeVisibilityRelatedKeywords(
    seeds,
    related,
    VISIBILITY_SEARCH_CAP,
  )

  const remaining = keywords.filter((keyword) => !seedResults.has(keyword))
  if (remaining.length > 0) {
    const needed = await requireSerpApiQuota(remaining.length)
    if (needed.status === "error") {
      if (seedResults.size === 0) return needed
    } else {
      for (const keyword of remaining) {
        const fetched = await fetchOrganicSearch(keyword)
        if (fetched.status === "error") {
          if (seedResults.size === 0) {
            return fetched
          }
          break
        }
        seedResults.set(keyword, fetched.data)
      }
    }
  }

  const rows: VisibilityKeywordRow[] = []
  for (const keyword of keywords) {
    const payload = seedResults.get(keyword)
    if (!payload) {
      rows.push({
        keyword,
        position: null,
        url: null,
        volume: null,
        traffic: null,
        difficulty: null,
        intent: null,
      })
      continue
    }
    const match = findOrganicRankForDomain(payload, input.domain)
    rows.push({
      keyword,
      position: match?.position ?? null,
      url: match?.url ?? null,
      volume: null,
      traffic: null,
      difficulty: null,
      intent: null,
    })
  }

  const searched = seedResults.size
  const positions = rows.map((row) => row.position)

  return {
    status: "ok",
    snapshot: {
      source: "serpapi_organic",
      domain: input.domain,
      locationLabel: "Brazil",
      languageCode: "pt",
      collectedAt: input.collectedAt,
      searchCount: searched,
      metrics: {
        keywordCount: rows.length,
        estimatedTraffic: null,
        estimatedTrafficCost: null,
        positionBuckets: bucketsFromPositions(positions),
      },
      keywords: rows,
    },
  }
}
