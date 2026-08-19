import "server-only"

import {
  dataForSeoLocationCoordinate,
  postDataForSeo,
} from "@/lib/dataforseo/client"
import { GBP_QNA_DEPTH, mapDataForSeoQna, type GbpQna } from "@/lib/leads/gbp-audit"

type QnaLiveResult = Record<string, unknown>

export type FetchGoogleQnaResult =
  | { status: "ok"; qna: GbpQna | null }
  | { status: "error"; message: string }

export async function fetchGoogleQna(input: {
  placeId: string
  latitude: number
  longitude: number
  establishmentTitle: string | null
}): Promise<FetchGoogleQnaResult> {
  const posted = await postDataForSeo<QnaLiveResult>(
    "/business_data/google/questions_and_answers/live",
    {
      language_code: "pt",
      keyword: `place_id:${input.placeId}`,
      location_coordinate: dataForSeoLocationCoordinate(
        input.latitude,
        input.longitude,
      ),
      depth: GBP_QNA_DEPTH,
    },
  )
  if (posted.status === "error") return posted
  if (!posted.data) return { status: "ok", qna: null }
  return {
    status: "ok",
    qna: mapDataForSeoQna(posted.data, input.establishmentTitle),
  }
}
