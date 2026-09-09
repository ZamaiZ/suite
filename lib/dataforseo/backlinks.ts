import "server-only"

import {
  DATAFORSEO_COLLECT_ERROR,
  postDataForSeo,
} from "@/lib/dataforseo/client"
import {
  BACKLINK_COMPETITORS_LIMIT,
  BACKLINK_SCHEME_LIMIT,
} from "@/lib/dataforseo/limits"
import type {
  BacklinkCompetitor,
  BacklinkScheme,
  BacklinkSnapshot,
} from "@/lib/leads/backlinks-audit"
import {
  mapBacklinkCompetitors,
  mapBacklinkScheme,
  mapBacklinkSummaryResult,
  type BacklinkCompetitorsResult,
  type BacklinkSchemeResult,
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
 * Sinais de rede de links artificiais apontando para o site.
 *
 * Substituiu a checagem de citações em diretórios — e não por defeito dela. Com
 * o filtro inválido removido e o catálogo casado do nosso lado, a chamada
 * devolveu 399 domínios de referência e **zero** diretórios, sem truncamento.
 * Diretório publica ficha e quase nunca emite link rastreável: a pergunta não
 * tem resposta por esta via, e quem fecha o estado de cadastro segue sendo o
 * analista, no checklist.
 *
 * A mesma chamada, pelo mesmo preço, responde uma pergunta que tem resposta —
 * repetição de âncora entre domínios independentes, concentração de IP e a
 * pontuação de spam que o provider já atribui a cada link.
 */
export async function fetchBacklinkSchemeLive(input: {
  domain: string
}): Promise<{ status: "ok"; scheme: BacklinkScheme } | { status: "error" }> {
  const posted = await postDataForSeo<BacklinkSchemeResult>(
    "/backlinks/backlinks/live",
    {
      target: input.domain,
      // Uma linha por domínio de origem. Sem isso, um único domínio que linka
      // de centenas de páginas encheria o teto sozinho, e os três sinais
      // descreveriam ele em vez do perfil.
      mode: "one_per_domain",
      limit: BACKLINK_SCHEME_LIMIT,
      backlinks_status_type: "live",
    },
  )
  if (posted.status === "error") return { status: "error" }
  // Resposta sem resultado não é resposta com resultado vazio. Devolver uma
  // leitura zerada aqui faria a action gravar "olhamos e está limpo" quando o
  // que houve foi a chamada não trazer nada.
  if (posted.data === null) return { status: "error" }
  return {
    status: "ok",
    scheme: mapBacklinkScheme(posted.data, BACKLINK_SCHEME_LIMIT),
  }
}
