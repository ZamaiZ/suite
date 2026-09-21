import "server-only"

/**
 * As chamadas pagas da pesquisa que não são a SERP.
 *
 * Fica separado de `lib/research/*` porque importa `server-only`; a decisão
 * mora lá, testada, e aqui há só transporte.
 *
 * **Duas granularidades, de propósito.** `keywords_for_keywords` é de
 * `keywords_data` e aceita `location_code` de cidade; `keyword_ideas` é do
 * Labs e **só aceita país** — pedir cidade a ele devolve
 * `40501 Invalid Field: 'location_code'`. Os volumes que os dois devolvem não
 * são comparáveis, e é o pool que reconcilia isso.
 */

import {
  getDataForSeoList,
  postDataForSeo,
  type DataForSeoResult,
} from "./client"
import {
  keywordsForKeywordsTasks,
  mapKeywordIdeas,
  mapKeywordsForKeywords,
  type ExpandedKeyword,
} from "./keyword-expansion"
import type { DataForSeoLocation } from "../research/location-match"

const LOCATIONS_PATH = "/serp/google/locations/BR"
const KFK_PATH = "/keywords_data/google_ads/keywords_for_keywords/live"
const IDEAS_PATH = "/dataforseo_labs/google/keyword_ideas/live"

/** Código do Brasil. O único que o Labs aceita para este país. */
export const BRAZIL_LOCATION_CODE = 2076

/** Teto de itens por página do `keyword_ideas`. */
export const KEYWORD_IDEAS_LIMIT = 200

/**
 * As 5.311 localidades do Brasil. **Gratuito**, e por isso sem teto de custo.
 *
 * Vem inteiro porque o casamento precisa comparar cidade **e** estado: a lista
 * tem homônimos entre UFs, e pedir por nome traria a cidade errada.
 */
export async function fetchBrazilLocations(): Promise<
  DataForSeoResult<DataForSeoLocation[]>
> {
  return getDataForSeoList<DataForSeoLocation>(LOCATIONS_PATH)
}

export type ExpansionResult = {
  keywords: ExpandedKeyword[]
  costUsd: number
  /** Chamadas que falharam, para o relatório não afirmar cobertura que não teve. */
  failures: string[]
}

/**
 * Expansão local — medida na cidade.
 *
 * Fatia em lotes de 20, que é o teto **medido** do endpoint: mandar 50 devolve
 * `40501 ... Max number exceeded (20/21)`. Com 50 seeds são três chamadas a
 * US$ 0,09, não uma.
 */
export async function expandLocalKeywords(params: {
  seeds: string[]
  locationCode: number
  languageCode: string
}): Promise<ExpansionResult> {
  const tarefas = keywordsForKeywordsTasks({
    seeds: params.seeds,
    locationCode: params.locationCode,
    languageCode: params.languageCode,
  })

  const keywords: ExpandedKeyword[] = []
  const failures: string[] = []
  let costUsd = 0

  for (const tarefa of tarefas) {
    const resposta = await postDataForSeo<unknown>(KFK_PATH, tarefa)
    if (resposta.status === "error") {
      failures.push(resposta.vendorMessage ?? resposta.message)
      continue
    }
    costUsd += resposta.cost ?? 0
    // `postDataForSeo` já desembrulha para `result[0]`, e este endpoint devolve
    // a lista em `result` — então o envelope é remontado para o mapeador, que
    // é o que está travado por teste contra payload real.
    keywords.push(
      ...mapKeywordsForKeywords({
        tasks: [{ status_code: 20000, result: resposta.data ? [resposta.data] : [] }],
      }),
    )
  }

  return { keywords, costUsd, failures }
}

/**
 * Expansão nacional — traz o que a local não alcança.
 *
 * Medido: 72% dos 200 itens eram inéditos contra as 4.669 já pagas, e o que
 * apareceu foi categoria inteira que faltava — marcas de tinta, que seeds
 * genéricos não produzem.
 */
export async function expandNationalKeywords(params: {
  seeds: string[]
  languageCode: string
  limit?: number
}): Promise<ExpansionResult> {
  const resposta = await postDataForSeo<unknown>(IDEAS_PATH, {
    keywords: params.seeds.slice(0, 20),
    location_code: BRAZIL_LOCATION_CODE,
    language_code: params.languageCode,
    limit: params.limit ?? KEYWORD_IDEAS_LIMIT,
  })

  if (resposta.status === "error") {
    return {
      keywords: [],
      costUsd: 0,
      failures: [resposta.vendorMessage ?? resposta.message],
    }
  }

  return {
    keywords: mapKeywordIdeas({
      tasks: [{ status_code: 20000, result: resposta.data ? [resposta.data] : [] }],
    }),
    costUsd: resposta.cost ?? 0,
    failures: [],
  }
}
