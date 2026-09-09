import "server-only"

import {
  DATAFORSEO_COLLECT_ERROR,
  postDataForSeo,
} from "@/lib/dataforseo/client"
import type {
  BacklinkCompetitor,
  BacklinkSnapshot,
} from "@/lib/leads/backlinks-audit"
import {
  mapBacklinkCompetitors,
  mapBacklinkSummaryResult,
  type BacklinkCompetitorsResult,
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

/** Quantos concorrentes o benchmark traz. Cinco cabem na tela e na leitura. */
export const BACKLINK_COMPETITORS_LIMIT = 5

/**
 * Quem compartilha domínios de referência com o alvo, com os números de cada
 * um — é o que responde "404 domínios é muito ou pouco?".
 *
 * Segunda chamada paga da coleta. Falhar aqui **não** derruba a análise: o
 * resumo é a entrega principal e o benchmark degrada para ausente.
 */
export async function fetchBacklinkCompetitorsLive(input: {
  domain: string
}): Promise<
  { status: "ok"; competitors: BacklinkCompetitor[] } | { status: "error" }
> {
  const posted = await postDataForSeo<BacklinkCompetitorsResult>(
    "/backlinks/competitors/live",
    {
      target: input.domain,
      limit: BACKLINK_COMPETITORS_LIMIT,
    },
  )
  if (posted.status === "error") return { status: "error" }
  return { status: "ok", competitors: mapBacklinkCompetitors(posted.data) }
}
