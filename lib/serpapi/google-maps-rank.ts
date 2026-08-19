import "server-only"

import {
  GBP_MAPS_DEPTH,
  type GbpRankCheck,
  type GbpRankCompetitor,
} from "@/lib/leads/gbp-audit"
import { getSerpApiJson, SERPAPI_RANK_ERROR } from "./client"

export type FetchSerpApiMapsRankResult =
  | { status: "ok"; check: GbpRankCheck }
  | { status: "error"; message: string }

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

export function serpApiMapsLl(latitude: number, longitude: number): string {
  return `@${Number(latitude.toFixed(7))},${Number(longitude.toFixed(7))},17z`
}

type MapsRankItem = {
  title: string
  placeId: string | null
  position: number
}

function readLocalResults(value: unknown): MapsRankItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    const position = asNumber(row.position)
    const title = asString(row.title)
    if (position === null || position < 1 || !title) return []
    return [
      {
        title,
        placeId: asString(row.place_id),
        position: Math.trunc(position),
      },
    ]
  })
}

export function mapSerpApiMapsRank(input: {
  keyword: string
  placeId: string
  result: Record<string, unknown>
  checkedAt: string
}): GbpRankCheck {
  const items = readLocalResults(input.result.local_results).slice(
    0,
    GBP_MAPS_DEPTH,
  )
  const target = items.find((item) => item.placeId === input.placeId) ?? null
  const maps_position = target?.position ?? null
  const competitors: GbpRankCompetitor[] = items
    .filter((item) => maps_position !== null && item.position < maps_position)
    .sort((left, right) => left.position - right.position)
    .slice(0, 3)
    .map((item) => ({
      title: item.title,
      placeId: item.placeId,
      position: item.position,
    }))
  const metadata =
    input.result.search_metadata &&
    typeof input.result.search_metadata === "object"
      ? (input.result.search_metadata as Record<string, unknown>)
      : null
  return {
    keyword: input.keyword,
    maps_position,
    in_top3: maps_position !== null && maps_position <= 3,
    competitors,
    check_url: metadata ? asString(metadata.google_maps_url) : null,
    checked_at: input.checkedAt,
  }
}

export async function fetchSerpApiMapsRank(input: {
  keyword: string
  placeId: string
  latitude: number
  longitude: number
  checkedAt: string
}): Promise<FetchSerpApiMapsRankResult> {
  const fetched = await getSerpApiJson(
    {
      engine: "google_maps",
      type: "search",
      q: input.keyword,
      ll: serpApiMapsLl(input.latitude, input.longitude),
    },
    SERPAPI_RANK_ERROR,
  )
  if (fetched.status === "error") return fetched
  return {
    status: "ok",
    check: mapSerpApiMapsRank({
      keyword: input.keyword,
      placeId: input.placeId,
      result: fetched.data,
      checkedAt: input.checkedAt,
    }),
  }
}
