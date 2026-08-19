import "server-only"

import {
  dataForSeoMapsCoordinate,
  postDataForSeo,
} from "@/lib/dataforseo/client"
import {
  GBP_MAPS_DEPTH,
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
    {
      language_code: "pt",
      keyword: input.keyword,
      location_coordinate: dataForSeoMapsCoordinate(
        input.latitude,
        input.longitude,
      ),
      depth: GBP_MAPS_DEPTH,
      search_this_area: true,
    },
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
