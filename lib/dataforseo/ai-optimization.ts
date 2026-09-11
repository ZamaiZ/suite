import "server-only"

import {
  DATAFORSEO_COLLECT_ERROR,
  postDataForSeo,
} from "@/lib/dataforseo/client"
import {
  GEO_PROMPT_MODELS,
  GEO_PROMPT_OMITTED_FIELDS,
  GEO_QUERY,
  LLM_MENTIONS_LIMIT,
  type GeoPromptPlatform,
} from "@/lib/dataforseo/limits"
import type { AiKeywordVolumeResult } from "@/lib/leads/geo-demand"
import type {
  MultiTargetResult,
  SearchMentionsResult,
} from "@/lib/leads/geo-mentions"

/**
 * Seção `ai_optimization` do DataForSEO. O único módulo `server-only` da etapa
 * de Presença em IA.
 *
 * Todas as formas aqui foram medidas contra payload real na onda 0
 * (`docs/auditoria/2026-09-10-onda0-presenca-em-ia.md`), e não lidas na
 * documentação. Isso não é zelo: a documentação errou **três vezes** nesta
 * etapa, e as três produziriam zero silencioso em vez de erro —
 * `annotations` no nível errado, filtro de domínio sem `www.`, e
 * `brand_entities` documentado como existente onde vem vazio.
 *
 * **A assinatura de `llm_mentions` é separada do saldo.**
 * `llm_mentions_subscription_expiry_date` vive em `/appendix/user_data` e a
 * página de Ferramentas o mostra. Vencida, estas chamadas falham por permissão
 * — que é diferente de devolverem vazio.
 */

/**
 * `50301 3rd Party API Service Unavailable`. O provedor de LLM recusou, do lado
 * de lá — visto três vezes seguidas nos modelos `gemini-3.x` em 2026-09-11,
 * sempre com `cost: 0`.
 */
const PROVIDER_UNAVAILABLE = 50301

/** `40501 Invalid Field`. Corpo errado, e também não cobra. */
const INVALID_FIELD = 40501

export type FetchAiDemandResult =
  | { status: "ok"; result: AiKeywordVolumeResult | null; cost?: number }
  | { status: "error"; message: string }

/**
 * Volume de busca em IA por keyword. Uma requisição, até 1.000 keywords.
 *
 * US$ 0,01 por requisição + US$ 0,0001 por linha — **mais barato que o
 * `ranked_keywords` que produziu as keywords** (0,012 + 0,00012). Medido:
 * 0,01 + 110 × 0,0001 = 0,021 exato.
 */
export async function fetchAiDemandLive(input: {
  keywords: string[]
}): Promise<FetchAiDemandResult> {
  if (input.keywords.length === 0) {
    return { status: "error", message: DATAFORSEO_COLLECT_ERROR }
  }
  const posted = await postDataForSeo<AiKeywordVolumeResult>(
    "/ai_optimization/ai_keyword_data/keywords_search_volume/live",
    {
      keywords: input.keywords,
      location_name: GEO_QUERY.locationName,
      language_code: GEO_QUERY.languageCode,
    },
  )
  if (posted.status === "error") {
    return { status: "error", message: DATAFORSEO_COLLECT_ERROR }
  }
  // Resposta sem resultado não é resposta com resultado vazio. Devolver uma
  // leitura zerada aqui gravaria "não há demanda em IA" quando o que houve foi
  // a chamada não trazer nada — a recusa que `fetchBacklinkSchemeLive`
  // documenta.
  if (posted.data === null) {
    return { status: "error", message: DATAFORSEO_COLLECT_ERROR }
  }
  return {
    status: "ok",
    result: posted.data,
    ...(posted.cost !== undefined ? { cost: posted.cost } : {}),
  }
}

export type GeoMentionTargetInput = {
  key: string
  /**
   * O nome da marca, casado no texto da resposta.
   *
   * `null` quando não se sabe — `/backlinks/competitors/live` devolve domínio
   * sem nome, e derivar o nome do domínio falha em casos comuns
   * (`agenciamestre.com` não vira "Agência Mestre"). O alvo então é medido só
   * pelo domínio, e o snapshot grava esse critério para a tela poder dizê-lo.
   */
  brand: string | null
  /** O domínio, casado entre as fontes citadas. */
  domain: string
}

export type FetchMultiTargetResult =
  | { status: "ok"; result: MultiTargetResult | null; cost?: number }
  | { status: "error"; message: string }

/**
 * Cada alvo leva **duas** entradas, e as duas medem presenças diferentes.
 *
 * A marca por nome em `answer` responde "a IA fala deste negócio"; o domínio em
 * `sources` responde "a IA usa o site dele como fonte". Um negócio pode ter a
 * primeira sem a segunda — e é exatamente esse o gap `no_authority_citations`.
 *
 * `include_subdomains: true` porque o índice guarda o host com `www.`. A forma
 * nua foi o que deu falso zero no filtro de backlinks da onda 0.
 */
function mentionTarget(target: GeoMentionTargetInput) {
  const entries: Record<string, unknown>[] = [
    {
      domain: target.domain,
      search_scope: ["sources"],
      search_filter: "include",
      include_subdomains: true,
    },
  ]
  if (target.brand) {
    entries.unshift({
      keyword: target.brand,
      search_scope: ["answer"],
      search_filter: "include",
      match_type: "word_match",
    })
  }
  return { key: target.key, target: entries }
}

/**
 * Menções em IA do lead e dos concorrentes, na mesma chamada.
 *
 * **É a chamada principal da etapa**, e entrega duas coisas: o total por alvo
 * (a tabela de dominância) e `sources_domain` por alvo (os domínios que a IA
 * cita nas respostas em que aquele alvo aparece). US$ 0,10 + 0,001 por linha.
 *
 * Aceita de 2 a 10 alvos. Com um só, a API recusa.
 */
export async function fetchLlmMultiTargetLive(input: {
  targets: GeoMentionTargetInput[]
}): Promise<FetchMultiTargetResult> {
  if (input.targets.length < 2) {
    return { status: "error", message: DATAFORSEO_COLLECT_ERROR }
  }
  const posted = await postDataForSeo<MultiTargetResult>(
    "/ai_optimization/llm_mentions/multi_target_metrics/live",
    {
      // Sempre explícito: omitir devolve as duas plataformas, e `chat_gpt` é
      // EUA/inglês por decisão do provider.
      platform: GEO_QUERY.platform,
      location_name: GEO_QUERY.locationName,
      language_code: GEO_QUERY.languageCode,
      targets: input.targets.map(mentionTarget),
    },
  )
  if (posted.status === "error" || posted.data === null) {
    return { status: "error", message: DATAFORSEO_COLLECT_ERROR }
  }
  return {
    status: "ok",
    result: posted.data,
    ...(posted.cost !== undefined ? { cost: posted.cost } : {}),
  }
}

export type FetchSearchMentionsResult =
  | { status: "ok"; result: SearchMentionsResult | null; cost?: number }
  | { status: "error"; message: string }

/**
 * O detalhe por pergunta: a frase que alguém perguntou e as fontes que a IA
 * citou ao responder.
 *
 * **Condicional.** Só vale a pena quando o lead tem menção — a chamada custa
 * US$ 0,10 mesmo devolvendo zero linha, e lead sem menção vai ser a maioria.
 * Quem decide é a action, com o número que `multi_target` já trouxe.
 */
export async function fetchLlmSearchMentionsLive(input: {
  domain: string
}): Promise<FetchSearchMentionsResult> {
  const posted = await postDataForSeo<SearchMentionsResult>(
    "/ai_optimization/llm_mentions/search_mentions/live",
    {
      target: [{ domain: input.domain }],
      platform: GEO_QUERY.platform,
      location_name: GEO_QUERY.locationName,
      language_code: GEO_QUERY.languageCode,
      limit: LLM_MENTIONS_LIMIT,
    },
  )
  if (posted.status === "error" || posted.data === null) {
    return { status: "error", message: DATAFORSEO_COLLECT_ERROR }
  }
  return {
    status: "ok",
    result: posted.data,
    ...(posted.cost !== undefined ? { cost: posted.cost } : {}),
  }
}

export type LlmResponseResult = {
  model_name?: unknown
  input_tokens?: unknown
  output_tokens?: unknown
  money_spent?: unknown
  web_search?: unknown
  items?: unknown
  fan_out_queries?: unknown
}

export type FetchLlmResponseResult =
  | { status: "ok"; result: LlmResponseResult; cost?: number }
  /** O provider não respondeu — `50301`. **Execução que não aconteceu.** */
  | { status: "provider_unavailable"; message: string }
  /** Corpo recusado — `40501`. Bug nosso, não ausência de dado. */
  | { status: "rejected"; message: string }
  | { status: "error"; message: string }

/**
 * Uma execução da sondagem: um prompt numa plataforma.
 *
 * **O corpo é montado por plataforma.** Três das quatro recusam um campo
 * diferente do mesmo corpo, medido em 2026-09-10/11 — e `40501` **não cobra
 * nada**, então um construtor único falharia em silêncio no custo e apareceria
 * meses depois como "essa plataforma nunca traz dado". A tabela está em
 * `GEO_PROMPT_OMITTED_FIELDS`, ao lado dos tetos, porque a calculadora de
 * custo precisa contar as mesmas execuções que o fetcher dispara.
 *
 * O `gemini` recusa os **dois** campos de localização: ele mede sem recorte
 * geográfico, e a tela precisa marcar a coluna dele.
 */
export async function fetchLlmResponseLive(input: {
  platform: GeoPromptPlatform
  prompt: string
  countryIso: string
  city: string | null
  modelName?: string
}): Promise<FetchLlmResponseResult> {
  const corpo: Record<string, unknown> = {
    user_prompt: input.prompt,
    model_name: input.modelName ?? GEO_PROMPT_MODELS[input.platform],
    web_search: true,
    web_search_country_iso_code: input.countryIso,
    max_output_tokens: 800,
  }
  if (input.city) corpo.web_search_city = input.city
  for (const campo of GEO_PROMPT_OMITTED_FIELDS[input.platform]) {
    delete corpo[campo]
  }

  const posted = await postDataForSeo<LlmResponseResult>(
    `/ai_optimization/${input.platform}/llm_responses/live`,
    corpo,
  )
  if (posted.status === "error") {
    // Os dois códigos abaixo chegam como HTTP 200 com `cost: 0` e `result`
    // ausente. Sem distingui-los de "respondeu e não mencionou", a sondagem
    // gravaria ausência inventada — e de graça, então nem o custo denunciaria.
    if (posted.code === PROVIDER_UNAVAILABLE) {
      return {
        status: "provider_unavailable",
        message: posted.vendorMessage ?? "O provedor de IA não respondeu.",
      }
    }
    if (posted.code === INVALID_FIELD) {
      return {
        status: "rejected",
        message: posted.vendorMessage ?? "Campo recusado pela plataforma.",
      }
    }
    return { status: "error", message: posted.message }
  }
  if (posted.data === null) {
    return { status: "error", message: DATAFORSEO_COLLECT_ERROR }
  }
  return {
    status: "ok",
    result: posted.data,
    ...(posted.cost !== undefined ? { cost: posted.cost } : {}),
  }
}
