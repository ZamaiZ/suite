import "server-only"

import {
  DATAFORSEO_COLLECT_ERROR,
  postDataForSeo,
} from "@/lib/dataforseo/client"
import type {
  BacklinkCitation,
  BacklinkCompetitor,
  BacklinkSnapshot,
} from "@/lib/leads/backlinks-audit"
import { gbpCitationDomains } from "@/lib/leads/gbp-analyst-review"
import {
  mapBacklinkCitations,
  mapBacklinkCompetitors,
  mapBacklinkSummaryResult,
  type BacklinkCitationsResult,
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

/**
 * Teto de linhas da checagem de citações. Com `one_per_domain` cada diretório
 * ocupa uma linha só, então o teto sobra para o catálogo inteiro.
 */
export const BACKLINK_CITATIONS_LIMIT = 100

/**
 * Quais diretórios do catálogo linkam para o site.
 *
 * Uma chamada cobre a lista inteira: o filtro `in` conta como **um** filtro
 * (o teto da API é de oito filtros, não de oito valores), e a cobrança é por
 * requisição, então vinte domínios custam o mesmo que oito.
 *
 * Devolve também a URL da página do cadastro, que é o que o analista abre para
 * conferir o NAP — a parte que nenhuma API julga.
 */
export async function fetchBacklinkCitationsLive(input: {
  domain: string
}): Promise<
  { status: "ok"; citations: BacklinkCitation[] } | { status: "error" }
> {
  const domains = gbpCitationDomains()
  if (domains.length === 0) return { status: "ok", citations: [] }
  const posted = await postDataForSeo<BacklinkCitationsResult>(
    "/backlinks/backlinks/live",
    {
      target: input.domain,
      // Uma linha por domínio de origem. Com `as_is`, um diretório que linka de
      // centenas de páginas encheria o teto e expulsaria os outros do
      // resultado — o filtro passa, mas a resposta mente por truncamento.
      mode: "one_per_domain",
      limit: BACKLINK_CITATIONS_LIMIT,
      backlinks_status_type: "live",
      filters: [["domain_from", "in", domains]],
    },
  )
  if (posted.status === "error") return { status: "error" }
  return { status: "ok", citations: mapBacklinkCitations(posted.data) }
}
