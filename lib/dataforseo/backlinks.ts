import "server-only"

import {
  DATAFORSEO_COLLECT_ERROR,
  postDataForSeo,
} from "@/lib/dataforseo/client"
import type { BacklinkSnapshot } from "@/lib/leads/backlinks-audit"
import {
  mapBacklinkSummaryResult,
  type BacklinkSummaryResult,
} from "@/lib/leads/backlinks-map"

export type FetchBacklinkSummaryResult =
  | { status: "ok"; snapshot: BacklinkSnapshot; cost?: number }
  | { status: "error"; message: string }

/**
 * Resumo de autoridade externa do domínio. Uma requisição.
 *
 * A seção `backlinks` é precificada à parte de Labs e SERP no DataForSEO, e a
 * assinatura dela tem validade própria — a tela de Ferramentas já mostra as
 * duas coisas a partir de `/appendix/user_data`, que é gratuito.
 */
export async function fetchBacklinkSummaryLive(input: {
  domain: string
  collectedAt: string
}): Promise<FetchBacklinkSummaryResult> {
  const posted = await postDataForSeo<BacklinkSummaryResult>(
    "/backlinks/summary/live",
    {
      target: input.domain,
      // Só o que está vivo agora: misturar link perdido com link ativo na mesma
      // contagem faria a série temporal comparar coisas diferentes.
      backlinks_status_type: "live",
      include_subdomains: true,
    },
  )
  if (posted.status === "error") {
    return { status: "error", message: DATAFORSEO_COLLECT_ERROR }
  }
  return {
    status: "ok",
    snapshot: mapBacklinkSummaryResult({
      domain: input.domain,
      result: posted.data,
      collectedAt: input.collectedAt,
    }),
    ...(posted.cost !== undefined ? { cost: posted.cost } : {}),
  }
}
