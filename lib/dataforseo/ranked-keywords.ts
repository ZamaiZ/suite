import "server-only"

import {
  DATAFORSEO_COLLECT_ERROR,
  postDataForSeo,
} from "@/lib/dataforseo/client"
import {
  RANKED_KEYWORDS_LIMIT,
  VISIBILITY_ITEM_TYPES,
  VISIBILITY_QUERY,
} from "@/lib/dataforseo/limits"
import { fetchSearchIntentLive } from "@/lib/dataforseo/search-intent"
import {
  mapRankedKeywordsLiveResult,
  type RankedKeywordsLiveResult,
} from "@/lib/leads/visibility-labs-map"
import type { VisibilitySnapshot } from "@/lib/leads/visibility-audit"

export type FetchRankedKeywordsResult =
  | { status: "ok"; snapshot: VisibilitySnapshot }
  | { status: "error"; message: string }

/** As keywords que a primeira chamada devolveu, sem repetir. */
function keywordsFromResult(result: RankedKeywordsLiveResult | null): string[] {
  const items = Array.isArray(result?.items) ? result.items : []
  const out = new Set<string>()
  for (const item of items) {
    const data = item?.keyword_data as Record<string, unknown> | undefined
    const keyword = typeof data?.keyword === "string" ? data.keyword.trim() : ""
    if (keyword) out.add(keyword)
  }
  return [...out]
}

/**
 * A coleta de visibilidade: duas chamadas, e só a primeira é obrigatória.
 *
 * `ranked_keywords` traz o que o domínio posiciona; `search_intent` traz a
 * intenção com probabilidade. A segunda pode falhar sozinha, e quando falha o
 * snapshot sai com `intent: null` em todas as linhas — a visibilidade orgânica
 * é útil sem intenção, e derrubar a coleta inteira por causa do campo mais
 * fraco trocaria dado por nada. A tela diz que faltou.
 */
export async function fetchRankedKeywordsLive(input: {
  domain: string
  collectedAt: string
}): Promise<FetchRankedKeywordsResult> {
  const posted = await postDataForSeo<RankedKeywordsLiveResult>(
    "/dataforseo_labs/google/ranked_keywords/live",
    {
      target: input.domain,
      location_name: VISIBILITY_QUERY.locationName,
      language_code: VISIBILITY_QUERY.languageCode,
      limit: RANKED_KEYWORDS_LIMIT,
      item_types: [...VISIBILITY_ITEM_TYPES],
      order_by: ["ranked_serp_element.serp_item.etv,desc"],
    },
  )
  if (posted.status === "error") {
    return { status: "error", message: DATAFORSEO_COLLECT_ERROR }
  }

  const intent = await fetchSearchIntentLive({
    keywords: keywordsFromResult(posted.data),
    languageCode: VISIBILITY_QUERY.languageCode,
  })

  return {
    status: "ok",
    snapshot: mapRankedKeywordsLiveResult({
      domain: input.domain,
      result: posted.data,
      collectedAt: input.collectedAt,
      locationLabel: VISIBILITY_QUERY.locationName,
      languageCode: VISIBILITY_QUERY.languageCode,
      intents: intent.status === "ok" ? intent.intents : null,
      // O campo `cost` vinha em toda resposta e era descartado aqui, enquanto
      // `lead_gbp_grid_scans.cost_usd` guardava o dele.
      costUsd:
        (posted.cost ?? 0) + (intent.status === "ok" ? intent.cost : 0) || null,
    }),
  }
}
