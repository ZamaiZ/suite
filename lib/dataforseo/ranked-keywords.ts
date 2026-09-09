import "server-only"

import {
  DATAFORSEO_COLLECT_ERROR,
  postDataForSeo,
} from "@/lib/dataforseo/client"
import { RANKED_KEYWORDS_LIMIT } from "@/lib/dataforseo/limits"
import {
  mapRankedKeywordsLiveResult,
  type RankedKeywordsLiveResult,
} from "@/lib/leads/visibility-labs-map"
import type { VisibilitySnapshot } from "@/lib/leads/visibility-audit"

export type FetchRankedKeywordsResult =
  | { status: "ok"; snapshot: VisibilitySnapshot }
  | { status: "error"; message: string }

export async function fetchRankedKeywordsLive(input: {
  domain: string
  collectedAt: string
}): Promise<FetchRankedKeywordsResult> {
  const posted = await postDataForSeo<RankedKeywordsLiveResult>(
    "/dataforseo_labs/google/ranked_keywords/live",
    {
      target: input.domain,
      location_name: "Brazil",
      language_code: "pt",
      limit: RANKED_KEYWORDS_LIMIT,
      item_types: ["organic"],
      order_by: ["ranked_serp_element.serp_item.etv,desc"],
    },
  )
  if (posted.status === "error") {
    return { status: "error", message: DATAFORSEO_COLLECT_ERROR }
  }
  return {
    status: "ok",
    snapshot: mapRankedKeywordsLiveResult({
      domain: input.domain,
      result: posted.data,
      collectedAt: input.collectedAt,
    }),
  }
}
