/**
 * Tipos, leitores e cálculo de custo do DataForSEO — tudo puro.
 *
 * Separado de `user-data.ts` porque aquele é `server-only`: a página de
 * Ferramentas e a malha são componentes de cliente, precisam destes tipos e do
 * formatador, e não podem arrastar o cliente HTTP junto.
 *
 * `GET /v3/appendix/user_data` é gratuito e devolve saldo, limites, uso por
 * seção de API e a tabela de preços da própria conta, com `cost_type` e
 * `cost` por função. Por isso a calculadora não guarda preço no código: preço
 * fixo envelhece, varia por plano e induz decisão errada. A fonte é a conta.
 */

import {
  GBP_GRID_SIZES,
  gbpGridCost,
  gbpGridExecutionMode,
} from "../leads/gbp-grid.ts"

export const DATAFORSEO_USER_DATA_PATH = "/appendix/user_data"

export const DATAFORSEO_USAGE_ERROR =
  "Não foi possível ler os dados da conta DataForSEO."

export type DataForSeoMoney = {
  total: number | null
  balance: number | null
  /** Gasto acumulado por período, como a API devolver (day, month...). */
  statistics: Record<string, number>
  limits: Record<string, number>
}

export type DataForSeoRateEntry = {
  /** Nome da seção de API, ex.: "serp", "business_data", "dataforseo_labs". */
  api: string
  limit: number | null
  used: number | null
}

export type DataForSeoRates = {
  day: DataForSeoRateEntry[]
  minute: DataForSeoRateEntry[]
}

export type DataForSeoPriceEntry = {
  api: string
  /** Caminho da função, ex.: "google/maps/live/advanced". */
  fn: string
  costType: "per_request" | "per_result" | null
  cost: number
}

export type DataForSeoUserData = {
  login: string | null
  timezone: string | null
  money: DataForSeoMoney
  rates: DataForSeoRates
  prices: DataForSeoPriceEntry[]
  backlinksSubscriptionExpiry: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function readNumberMap(value: unknown): Record<string, number> {
  const row = asRecord(value)
  if (!row) return {}
  const out: Record<string, number> = {}
  for (const [key, item] of Object.entries(row)) {
    const parsed = asFinite(item)
    if (parsed !== null) out[key] = parsed
  }
  return out
}

function readMoney(value: unknown): DataForSeoMoney {
  const row = asRecord(value)
  if (!row) {
    return { total: null, balance: null, statistics: {}, limits: {} }
  }
  return {
    total: asFinite(row.total),
    balance: asFinite(row.balance),
    statistics: readNumberMap(row.statistics),
    limits: readNumberMap(row.limits),
  }
}

/**
 * `rates.limits` e `rates.statistics` têm a mesma forma: agrupados por período
 * e, dentro dele, por seção de API. As chaves agregadas `total_*` são
 * ignoradas — a leitura útil é por seção.
 */
function readRateGroup(
  limits: unknown,
  statistics: unknown,
  period: string,
): DataForSeoRateEntry[] {
  const limitRow = asRecord(asRecord(limits)?.[period])
  const usedRow = asRecord(asRecord(statistics)?.[period])
  const keys = new Set<string>([
    ...Object.keys(limitRow ?? {}),
    ...Object.keys(usedRow ?? {}),
  ])
  const entries: DataForSeoRateEntry[] = []
  for (const key of keys) {
    if (key.startsWith("total_")) continue
    entries.push({
      api: key,
      limit: asFinite(limitRow?.[key]),
      used: asFinite(usedRow?.[key]),
    })
  }
  return entries.sort((left, right) => left.api.localeCompare(right.api))
}

function readCostType(value: unknown): "per_request" | "per_result" | null {
  return value === "per_request" || value === "per_result" ? value : null
}

/**
 * `price` é uma árvore aninhada de profundidade variável por seção. O achatado
 * junta os segmentos num caminho legível até encontrar o nó que tem `cost`.
 */
function flattenPrices(
  value: unknown,
  api: string,
  trail: string[],
  out: DataForSeoPriceEntry[],
): void {
  const row = asRecord(value)
  if (!row) return
  const cost = asFinite(row.cost)
  if (cost !== null) {
    out.push({
      api,
      fn: trail.join("/") || api,
      costType: readCostType(row.cost_type),
      cost,
    })
    return
  }
  for (const [key, child] of Object.entries(row)) {
    flattenPrices(child, api, [...trail, key], out)
  }
}

function readPrices(value: unknown): DataForSeoPriceEntry[] {
  const row = asRecord(value)
  if (!row) return []
  const out: DataForSeoPriceEntry[] = []
  for (const [api, child] of Object.entries(row)) {
    flattenPrices(child, api, [], out)
  }
  return out
}

export function readDataForSeoUserData(
  value: unknown,
): DataForSeoUserData | null {
  const row = asRecord(value)
  if (!row) return null
  return {
    login: asString(row.login),
    timezone: asString(row.timezone),
    money: readMoney(row.money),
    rates: {
      day: readRateGroup(
        asRecord(row.rates)?.limits,
        asRecord(row.rates)?.statistics,
        "day",
      ),
      minute: readRateGroup(
        asRecord(row.rates)?.limits,
        asRecord(row.rates)?.statistics,
        "minute",
      ),
    },
    prices: readPrices(row.price),
    backlinksSubscriptionExpiry: asString(
      row.backlinks_subscription_expiry_date,
    ),
  }
}

/** Procura o preço de uma função pelo sufixo do caminho, ex.: "live/advanced". */
export function findDataForSeoPrice(
  prices: readonly DataForSeoPriceEntry[],
  api: string,
  fnSuffix: string,
): DataForSeoPriceEntry | null {
  return (
    prices.find((entry) => entry.api === api && entry.fn.endsWith(fnSuffix)) ??
    null
  )
}

/**
 * Catálogo das operações que a auditoria dispara, para a calculadora.
 *
 * Cada entrada declara o endpoint e o modo que a operação realmente usa, para
 * que o número exibido seja auditável — e não uma estimativa solta.
 */
export type DataForSeoOperationId =
  | "grid_3"
  | "grid_5"
  | "grid_7"
  | "grid_11"
  | "gbp_enrichment"
  | "gbp_reviews"
  | "gbp_qna"
  | "gbp_updates"
  | "maps_rank"
  | "organic_visibility"
  | "backlink_summary"
  | "backlink_competitors"

export type DataForSeoOperation = {
  id: DataForSeoOperationId
  label: string
  /** Seção da API na tabela de preços, ex.: "serp", "business_data". */
  api: string
  /** Sufixo do caminho da função, casado contra a tabela da conta. */
  fnSuffix: string
  /** Quantas requisições a operação dispara, uma vez. */
  requests: number
  detail: string
}

/**
 * As malhas são derivadas dos tamanhos disponíveis, e não escritas à mão: a
 * lista antiga já trazia a contagem de pontos e o modo digitados, e cada
 * tamanho novo faria a calculadora mentir em silêncio. O modo mostrado é o
 * sugerido pelo tamanho — na tela da malha o usuário pode escolher o outro, e
 * o preço muda junto.
 */
const GRID_OPERATIONS: readonly DataForSeoOperation[] = GBP_GRID_SIZES.map(
  (size) => {
    const mode = gbpGridExecutionMode(size)
    const requests = gbpGridCost(size)
    return {
      id: `grid_${size}` as DataForSeoOperationId,
      label: `Malha ${size}×${size}`,
      api: "serp",
      fnSuffix: mode === "live" ? "maps/live/advanced" : "maps/task_post",
      requests,
      detail:
        mode === "live"
          ? `${requests} pontos em modo live`
          : `${requests} pontos na fila padrão`,
    }
  },
)

export const DATAFORSEO_OPERATIONS: readonly DataForSeoOperation[] = [
  ...GRID_OPERATIONS,
  {
    id: "gbp_enrichment",
    label: "Enriquecimento do perfil",
    api: "business_data",
    fnSuffix: "my_business_info/live",
    requests: 1,
    detail: "Ficha completa em modo live",
  },
  {
    id: "gbp_reviews",
    label: "Avaliações do perfil",
    api: "business_data",
    fnSuffix: "reviews/task_post",
    requests: 1,
    detail: "Amostra de 200 na fila",
  },
  {
    id: "gbp_qna",
    label: "Perguntas e respostas",
    api: "business_data",
    fnSuffix: "questions_and_answers/live",
    requests: 1,
    detail: "Até 20 perguntas em modo live",
  },
  {
    id: "gbp_updates",
    label: "Postagens do perfil",
    api: "business_data",
    fnSuffix: "my_business_updates/task_post",
    requests: 1,
    detail: "Até 10 postagens na fila",
  },
  {
    id: "maps_rank",
    label: "Ranking no Maps",
    api: "serp",
    fnSuffix: "maps/live/advanced",
    requests: 1,
    detail: "Uma keyword, um ponto",
  },
  {
    id: "organic_visibility",
    label: "Visibilidade orgânica",
    api: "dataforseo_labs",
    fnSuffix: "ranked_keywords/live",
    requests: 1,
    detail: "Até 100 keywords do domínio",
  },
  {
    id: "backlink_summary",
    label: "Autoridade externa",
    api: "backlinks",
    fnSuffix: "summary/live",
    requests: 1,
    detail: "Resumo de backlinks do domínio",
  },
  {
    id: "backlink_competitors",
    label: "Benchmark de backlinks",
    api: "backlinks",
    fnSuffix: "competitors/live",
    requests: 1,
    detail: "Até 5 concorrentes, na mesma análise",
  },
]

export type DataForSeoOperationCost = {
  operation: DataForSeoOperation
  /** Nulo quando a conta não expõe preço para aquela função. */
  unitCost: number | null
  totalCost: number | null
  requests: number
}

export function dataForSeoOperationCost(
  operation: DataForSeoOperation,
  prices: readonly DataForSeoPriceEntry[],
  quantity: number,
): DataForSeoOperationCost {
  const entry = findDataForSeoPrice(prices, operation.api, operation.fnSuffix)
  const requests = operation.requests * Math.max(quantity, 0)
  return {
    operation,
    unitCost: entry?.cost ?? null,
    totalCost: entry ? entry.cost * requests : null,
    requests,
  }
}

export function formatUsd(value: number | null): string {
  if (value === null) return "—"
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: value < 1 ? 4 : 2,
  })
}
