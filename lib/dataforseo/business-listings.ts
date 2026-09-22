import "server-only"

import {
  buildAggregationTask,
  buildSearchTask,
  readAggregation,
  type CampaignEstimate,
  type CampaignInput,
} from "@/lib/prospect/campaign-input"
import {
  dedupeListings,
  readBusinessListingsPage,
  type BusinessListingsPage,
} from "@/lib/prospect/listing-map"

import { getDataForSeoList, postDataForSeo } from "./client"

/**
 * O motor de descoberta da prospecção.
 *
 * `business_listings` é **consulta a banco de dados**, não busca por
 * palavra-chave: filtra por categoria, coordenada, raio, nota, avaliações e
 * `is_claimed`, e devolve até mil registros estruturados com `total_count` e
 * paginação por token.
 *
 * Isso é o oposto do `/serp/google/maps` que a suite já usa em
 * `lib/dataforseo/maps-search.ts`, e os dois continuam existindo porque
 * respondem a perguntas diferentes: o Maps diz *quem aparece* para um termo, e
 * serve para ranking; este diz *quem existe* numa área, e serve para
 * prospectar.
 *
 * Também é o que resolve o problema de licença. Os termos da Google Maps
 * Platform proíbem usar dados do Places para montar lista de prospecção e
 * proíbem guardar qualquer campo além do `place_id` — o produto do DataForSEO
 * é o banco dele, entregue para o cliente armazenar.
 *
 * Tudo medido em 2026-09-21 contra a conta real; ver
 * `docs/auditoria/evidencias/2026-09-21-prospeccao/`.
 */

const CATEGORIES_PATH = "/business_data/business_listings/categories"
const SEARCH_PATH = "/business_data/business_listings/search/live"
const AGGREGATION_PATH =
  "/business_data/business_listings/categories_aggregation/live"

export const PROSPECT_DISCOVERY_ERROR =
  "Não foi possível buscar as empresas. Tente novamente."

export type BusinessCategory = { id: string; businessCount: number }

export type FetchCategoriesResult =
  | { status: "ok"; categories: BusinessCategory[] }
  | { status: "error"; message: string }

/**
 * O catálogo inteiro de categorias. **Gratuito.**
 *
 * 5.318 categorias na medição, cada uma `{ category_name, business_count }` —
 * note que a chave é `category_name`, e não `category`. Ler o campo errado
 * devolve uma lista de `undefined`, que não quebra nada e deixa o combobox
 * vazio.
 *
 * `getDataForSeoList` e não `getDataForSeo`: aqui o `result` é a lista
 * inteira, e o leitor de tarefa comum devolveria só a primeira categoria, em
 * silêncio.
 */
export async function fetchBusinessCategories(): Promise<FetchCategoriesResult> {
  const fetched = await getDataForSeoList<Record<string, unknown>>(
    CATEGORIES_PATH,
    PROSPECT_DISCOVERY_ERROR,
  )
  if (fetched.status === "error") return fetched

  const categories: BusinessCategory[] = []
  for (const row of fetched.data) {
    const id = typeof row.category_name === "string" ? row.category_name : null
    if (!id) continue
    categories.push({
      id,
      businessCount:
        typeof row.business_count === "number" ? row.business_count : 0,
    })
  }
  return { status: "ok", categories }
}

export type AggregationResult =
  | { status: "ok"; estimate: CampaignEstimate; costUsd: number }
  | { status: "error"; message: string }

/**
 * A densidade da área, antes de qualquer gasto de descoberta.
 *
 * Cobra como uma busca — US$ 0,048 medido, com `limit` 5 ou 100 igualmente, o
 * que significa que **o `limit` não barateia**. Por isso o resultado é gravado
 * em `prospect_campaigns.estimate` e não refeito a cada abertura da tela.
 */
export async function aggregateCategories(
  input: Pick<CampaignInput, "categories" | "latitude" | "longitude" | "radiusKm">,
  targetCount: number,
): Promise<AggregationResult> {
  const posted = await postDataForSeo<Record<string, unknown>>(
    AGGREGATION_PATH,
    buildAggregationTask(input),
  )
  if (posted.status === "error") {
    return { status: "error", message: PROSPECT_DISCOVERY_ERROR }
  }
  return {
    status: "ok",
    estimate: readAggregation(posted.data, targetCount, input.categories),
    costUsd: posted.cost ?? 0,
  }
}

export type SearchListingsResult =
  | { status: "ok"; page: BusinessListingsPage; costUsd: number }
  | { status: "error"; message: string }

/**
 * Uma página de empresas.
 *
 * O `offset_token` da resposta é o que permite retomar sem recomprar, e por
 * isso ele sobe até a coluna da campanha em vez de morrer aqui.
 */
export async function searchBusinessListings(
  input: CampaignInput,
  page: { limit: number; offset?: number; offsetToken?: string | null },
): Promise<SearchListingsResult> {
  const posted = await postDataForSeo<Record<string, unknown>>(
    SEARCH_PATH,
    buildSearchTask(input, page),
  )
  if (posted.status === "error") {
    return { status: "error", message: PROSPECT_DISCOVERY_ERROR }
  }

  const lida = readBusinessListingsPage(posted.data)
  if (!lida) {
    // Resposta paga que não deu para ler. Não é ausência de empresa na área —
    // é coleta que não aconteceu, e quem chama precisa distinguir para não
    // marcar a campanha como concluída.
    return { status: "error", message: PROSPECT_DISCOVERY_ERROR }
  }

  return {
    status: "ok",
    page: { ...lida, items: dedupeListings(lida.items) },
    costUsd: posted.cost ?? 0,
  }
}
