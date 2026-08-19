import "server-only"

import {
  dataForSeoLocationCoordinate,
  postDataForSeo,
} from "@/lib/dataforseo/client"
import {
  mapDataForSeoInfoItem,
  type GbpEnrichment,
} from "@/lib/leads/gbp-enrichment"

const NOT_FOUND = "Não foi possível encontrar este perfil no Google."

type GoogleInfoLiveResult = {
  items?: Array<Record<string, unknown>>
}

export type FetchGoogleBusinessInfoResult =
  | { status: "ok"; enrichment: GbpEnrichment }
  | { status: "not_found"; message: string }
  | { status: "error"; message: string }

export async function fetchGoogleBusinessInfo(input: {
  placeId: string
  latitude: number
  longitude: number
}): Promise<FetchGoogleBusinessInfoResult> {
  const posted = await postDataForSeo<GoogleInfoLiveResult>(
    "/business_data/google/my_business_info/live",
    {
      language_code: "pt",
      keyword: `place_id:${input.placeId}`,
      location_coordinate: dataForSeoLocationCoordinate(
        input.latitude,
        input.longitude,
      ),
    },
  )
  if (posted.status === "error") return posted

  const item = posted.data?.items?.[0]
  if (!item || item.type !== "google_business_info") {
    return { status: "not_found", message: NOT_FOUND }
  }

  return {
    status: "ok",
    enrichment: mapDataForSeoInfoItem(item, new Date().toISOString()),
  }
}
