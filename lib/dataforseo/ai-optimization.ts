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
import type { SearchMentionsResult } from "@/lib/leads/geo-mentions"

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

/**
 * `40501 Invalid Field` — e ele significa **duas coisas diferentes**.
 *
 * Medido em três sondagens do mesmo lead, com o mesmo corpo e os mesmos
 * prompts: **2 → 1 → 0** recusas. Campo inválido não é intermitente. O que
 * varia é o provedor de LLM recusando o prompt, e o DataForSEO mapeia essa
 * recusa para o mesmo código de "campo inválido".
 *
 * A discriminação está na mensagem, e ela também foi medida: os `40501`
 * genuínos da onda 0 vieram com `"Invalid Field: 'max_output_tokens'."`,
 * reproduzíveis em 100% das tentativas. Os intermitentes vieram **sem mensagem
 * nenhuma**.
 *
 * Isso muda o que a tela diz ao analista. "Campo recusado" pede correção de
 * código; "o provedor não respondeu" pede outra tentativa. Chamar os dois pelo
 * mesmo nome mandaria alguém caçar um bug que não existe.
 */
const INVALID_FIELD = 40501

/** A assinatura de um erro de campo de verdade: ele nomeia o campo. */
const NAMES_A_FIELD = /invalid field/i

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

/**
 * `multi_target_metrics` foi medido e **não entrou no produto**.
 *
 * Ele responde "quantas menções este domínio tem no dataset inteiro", e a
 * pergunta do relatório é "quem mais a IA cita nas respostas em que este
 * negócio aparece". Medido em 2026-09-11, a diferença não é sutil: o endpoint
 * trouxe `mobills.com.br` com 17.919 menções contra as 2 do lead, e o
 * percentual virou 0,007%.
 *
 * A conta certa sai das fontes de `search_mentions`, sem chamada nova, em
 * `lib/leads/geo-mentions.ts`. Evidência e números na seção 14 de
 * `docs/auditoria/2026-09-10-onda0-presenca-em-ia.md`.
 */

export type FetchSearchMentionsResult =
  | { status: "ok"; result: SearchMentionsResult | null; cost?: number }
  | { status: "error"; message: string }

/**
 * O detalhe por pergunta: a frase que alguém perguntou e as fontes que a IA
 * citou ao responder.
 *
 * **É a única chamada da coleta de menções**, e dela sai tudo: quantas
 * respostas citam o lead, quais domínios a IA lê no mercado dele, e a
 * comparação com quem aparece ao lado. US$ 0,10 + US$ 0,001 por linha, mesmo
 * quando devolve zero.
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
      // Sem o nome do campo, não é erro de corpo: é recusa transitória do
      // provedor com o código errado. Tratar como execução que não aconteceu.
      const nomeia = NAMES_A_FIELD.test(posted.vendorMessage ?? "")
      return nomeia
        ? { status: "rejected", message: posted.vendorMessage ?? "" }
        : {
            status: "provider_unavailable",
            message:
              posted.vendorMessage ?? "O provedor de IA recusou este prompt.",
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
