import "server-only"

import {
  DATAFORSEO_COLLECT_ERROR,
  postDataForSeo,
} from "@/lib/dataforseo/client"
import {
  BACKLINK_CITATIONS_LIMIT,
  BACKLINK_COMPETITORS_LIMIT,
} from "@/lib/dataforseo/limits"
import type {
  BacklinkCitation,
  BacklinkCompetitor,
  BacklinkSnapshot,
} from "@/lib/leads/backlinks-audit"
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
  // Mesmo motivo do que está logo abaixo: resposta sem resultado vira erro, e
  // não lista vazia. "Não coletado" e "sem concorrente" são coisas diferentes,
  // e só a segunda é um achado.
  if (posted.data === null) return { status: "error" }
  return { status: "ok", competitors: mapBacklinkCompetitors(posted.data) }
}

/**
 * Quais diretórios do catálogo linkam para o site.
 *
 * **Sem filtro de domínio, de propósito.** A versão anterior mandava
 * `["domain_from", "in", [...]]`, e `in` não existe para esse campo — ele
 * aceita `=`, `<>`, `like`, `not_like`, `ilike`, `not_ilike`, `match` e
 * `not_match`, só. A tarefa voltava com erro, o erro virava resultado ausente,
 * e o ausente virava "nenhum diretório linka". Encadear os vinte e dois
 * domínios com `or` também não serve: o teto é de oito filtros.
 *
 * Então a chamada traz os domínios de referência como eles vêm, e o casamento
 * com o catálogo acontece aqui, em `mapBacklinkCitations` — por sufixo, que é
 * o que tolera `pt.foursquare.com` no lugar de `foursquare.com`.
 *
 * O preço tem parcela por linha devolvida, e o teto está dimensionado para
 * caber o perfil inteiro de um negócio local. Se ainda assim truncar, o efeito
 * é o corroborador **calar** sobre um diretório, nunca afirmar que ele não
 * linka: a tela só usa a citação para exibir o selo de link encontrado.
 *
 * Devolve também a URL da página do cadastro, que é o que o analista abre para
 * conferir o NAP — a parte que nenhuma API julga.
 */
export async function fetchBacklinkCitationsLive(input: {
  domain: string
}): Promise<
  { status: "ok"; citations: BacklinkCitation[] } | { status: "error" }
> {
  const posted = await postDataForSeo<BacklinkCitationsResult>(
    "/backlinks/backlinks/live",
    {
      target: input.domain,
      // Uma linha por domínio de origem. Com `as_is`, um diretório que linka de
      // centenas de páginas encheria o teto sozinho e expulsaria os outros.
      mode: "one_per_domain",
      limit: BACKLINK_CITATIONS_LIMIT,
      backlinks_status_type: "live",
    },
  )
  if (posted.status === "error") return { status: "error" }
  // Resposta sem resultado não é resposta com resultado vazio. Devolver `[]`
  // aqui fazia a action gravar "checado, e nenhum diretório linka" quando o
  // que houve foi a chamada não trazer nada — ausente virando zero, no próprio
  // código que invoca a regra.
  if (posted.data === null) return { status: "error" }
  return { status: "ok", citations: mapBacklinkCitations(posted.data) }
}
