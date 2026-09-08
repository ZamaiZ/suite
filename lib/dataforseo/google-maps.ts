import "server-only"

import { postDataForSeo } from "@/lib/dataforseo/client"
import { GBP_MAPS_ZOOM, googleMapsTask } from "@/lib/dataforseo/maps-task"
import {
  mapDataForSeoMapsRank,
  type GbpRankCheck,
} from "@/lib/leads/gbp-audit"

type MapsLiveResult = Record<string, unknown>

export type FetchGoogleMapsRankResult =
  | { status: "ok"; check: GbpRankCheck }
  | { status: "error"; message: string }

export async function fetchGoogleMapsRank(input: {
  keyword: string
  placeId: string
  latitude: number
  longitude: number
  checkedAt: string
}): Promise<FetchGoogleMapsRankResult> {
  const posted = await postDataForSeo<MapsLiveResult>(
    "/serp/google/maps/live/advanced",
    googleMapsTask({
      keyword: input.keyword,
      latitude: input.latitude,
      longitude: input.longitude,
      zoom: GBP_MAPS_ZOOM,
    }),
  )
  if (posted.status === "error") return posted
  return {
    status: "ok",
    check: mapDataForSeoMapsRank({
      keyword: input.keyword,
      placeId: input.placeId,
      result: posted.data,
      checkedAt: input.checkedAt,
    }),
  }
}
