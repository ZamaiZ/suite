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
import {
  BACKLINK_COMPETITORS_LIMIT,
  BACKLINK_SCHEME_LIMIT,
  RANKED_KEYWORDS_LIMIT,
} from "./limits.ts"

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
  /**
   * Assinatura é coisa diferente de preço.
   *
   * A tabela de `price` diz **quanto custa**; esta data diz **se pode chamar**.
   * Sem ela, assinatura vencida vira "não foi possível coletar" sem motivo na
   * tela — e a seção `ai_optimization` aparece na tabela de preço mesmo assim,
   * então o preço presente não prova acesso.
   *
   * Medida em 2026-09-10 junto com a onda 0 da Presença em IA, onde a conta
   * devolveu `2050-01-01` nas duas.
   */
  llmMentionsSubscriptionExpiry: string | null
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
 * A prioridade que o sistema envia em toda tarefa. `low` custa o mesmo e `high`
 * custa o dobro; guardar as três faria a busca devolver a primeira que
 * aparecesse na árvore, que é a `low`.
 */
const PRICE_PRIORITY = "priority_normal"

/**
 * `price` é uma árvore aninhada de profundidade variável por seção, e a folha
 * de cada função é uma **lista** de `{cost_type, cost}` sob `priority_low`,
 * `priority_normal` e `priority_high`.
 *
 * A versão anterior só descia por objeto, e `asRecord` devolve `null` para
 * array. O achatado parava na folha sem nunca lê-la, `readPrices` devolvia
 * lista vazia, e a calculadora mostrava "—" para toda operação — não por
 * casar o caminho errado, mas por não ter tabela nenhuma para casar.
 */
function flattenPrices(
  value: unknown,
  api: string,
  trail: string[],
  out: DataForSeoPriceEntry[],
): void {
  if (Array.isArray(value)) {
    // A mesma função pode trazer as duas parcelas — por requisição e por
    // resultado — como dois itens da lista. As duas são cobradas, e as duas
    // ficam.
    for (const item of value) flattenPrices(item, api, trail, out)
    return
  }
  const row = asRecord(value)
  if (!row) return
  const cost = asFinite(row.cost)
  if (cost !== null) {
    const last = trail.at(-1)
    const priority = last !== undefined && last.startsWith("priority_")
    if (priority && last !== PRICE_PRIORITY) return
    out.push({
      api,
      fn: (priority ? trail.slice(0, -1) : trail).join("/") || api,
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
    llmMentionsSubscriptionExpiry: asString(
      row.llm_mentions_subscription_expiry_date,
    ),
  }
}

/**
 * As duas parcelas do preço de uma função.
 *
 * O DataForSEO cobra por requisição e, em Backlinks e Labs, **também** por
 * resultado devolvido. As duas somam: ler só a primeira subestima uma consulta
 * de mil linhas em mais da metade do que ela custa.
 */
export type DataForSeoFnPrice = {
  /** O caminho que casou na tabela, para conferência na tela. */
  fn: string
  perRequest: number | null
  perResult: number | null
}

/**
 * Procura o preço de uma função pelo caminho, ex.: "my_business_info/live".
 *
 * O caminho exato ganha do sufixo, e não é preferência de estilo: a seção
 * `serp` tem `task_post` e `jobs/task_post`, e casar por sufixo faria a malha
 * na fila ser precificada pelo endpoint de vagas. Hoje os dois custam igual, e
 * o erro só apareceria no dia em que deixassem de custar.
 *
 * O sufixo continua existindo porque `business_data` prefixa o motor —
 * `google/my_business_info/live` — e o catálogo não deveria depender disso.
 */
export function findDataForSeoPrice(
  prices: readonly DataForSeoPriceEntry[],
  api: string,
  fnSuffix: string,
): DataForSeoFnPrice | null {
  const section = prices.filter((entry) => entry.api === api)
  const exact = section.filter((entry) => entry.fn === fnSuffix)
  const matched =
    exact.length > 0
      ? exact
      : section.filter((entry) => entry.fn.endsWith(`/${fnSuffix}`))
  const first = matched[0]
  if (!first) return null
  const pick = (type: "per_request" | "per_result"): number | null =>
    matched.find((entry) => entry.costType === type)?.cost ?? null
  const perRequest = pick("per_request")
  const perResult = pick("per_result")
  // Sem `cost_type` declarado, a leitura conservadora é por requisição: é como
  // a maioria das seções cobra, e é o que não some da conta.
  if (perRequest === null && perResult === null) {
    return { fn: first.fn, perRequest: first.cost, perResult: null }
  }
  return { fn: first.fn, perRequest, perResult }
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
  | "backlink_scheme"

export type DataForSeoOperation = {
  id: DataForSeoOperationId
  label: string
  /** Seção da API na tabela de preços, ex.: "serp", "business_data". */
  api: string
  /** Caminho da função na tabela da conta, inteiro ou o sufixo dele. */
  fnSuffix: string
  /** Quantas requisições a operação dispara, uma vez. */
  requests: number
  /**
   * Teto de resultados que a operação pede de volta, para a parcela
   * `per_result`. Zero nas seções que só cobram por requisição.
   */
  results: number
  detail: string
  /** Ressalva a mostrar junto do número, quando a tabela não fecha a conta. */
  caveat?: string
}

/**
 * A seção `serp` da conta tem um preço só por método — existe `live/advanced`,
 * e não um por Maps ou por Orgânico. Nas medições que fizemos a cobrança real
 * ficou acima da tabela, e não por um fator constante.
 */
const SERP_CAVEAT =
  "A tabela da conta precifica a SERP sem distinguir motor nem profundidade. " +
  "Medimos US$ 0,01 num live avançado do Maps contra US$ 0,002 na tabela, e " +
  "de US$ 0,003 a US$ 0,006 num task_post orgânico contra US$ 0,0006. O " +
  "número aqui é piso, não conta fechada."

/** Backlinks e Labs cobram por chamada e por linha devolvida, e as duas somam. */
const RESULT_CAVEAT =
  "O preço soma a parcela por chamada e a parcela por resultado, e o total usa " +
  "o teto de linhas. A conta cobra pelas linhas que voltarem, que costumam ser " +
  "menos."

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
      fnSuffix: mode === "live" ? "live/advanced" : "task_post",
      requests,
      results: 0,
      detail:
        mode === "live"
          ? `${requests} pontos em modo live`
          : `${requests} pontos na fila padrão`,
      caveat: SERP_CAVEAT,
    }
  },
)

export const DATAFORSEO_OPERATIONS: readonly DataForSeoOperation[] = [
  ...GRID_OPERATIONS,
  {
    id: "gbp_enrichment",
    label: "Enriquecimento do perfil",
    api: "business_data",
    fnSuffix: "google/my_business_info/live",
    requests: 1,
    results: 0,
    detail: "Ficha completa em modo live",
  },
  {
    id: "gbp_reviews",
    label: "Avaliações do perfil",
    api: "business_data",
    fnSuffix: "google/reviews/task_post",
    requests: 1,
    results: 0,
    detail: "Amostra de 200 na fila",
  },
  {
    id: "gbp_qna",
    label: "Perguntas e respostas",
    api: "business_data",
    fnSuffix: "google/questions_and_answers/live",
    requests: 1,
    results: 0,
    detail: "Até 20 perguntas em modo live",
  },
  {
    id: "gbp_updates",
    label: "Postagens do perfil",
    api: "business_data",
    fnSuffix: "google/my_business_updates/task_post",
    requests: 1,
    results: 0,
    detail: "Até 10 postagens na fila",
  },
  {
    id: "maps_rank",
    label: "Ranking no Maps",
    api: "serp",
    fnSuffix: "live/advanced",
    requests: 1,
    results: 0,
    detail: "Uma keyword, um ponto",
    caveat: SERP_CAVEAT,
  },
  {
    id: "organic_visibility",
    label: "Visibilidade orgânica",
    api: "dataforseo_labs",
    fnSuffix: "ranked_keywords/live",
    requests: 1,
    results: RANKED_KEYWORDS_LIMIT,
    detail: `Até ${RANKED_KEYWORDS_LIMIT} keywords do domínio`,
    caveat: RESULT_CAVEAT,
  },
  {
    id: "backlink_summary",
    label: "Autoridade externa",
    api: "backlinks",
    fnSuffix: "summary/live",
    requests: 1,
    // O resumo devolve uma linha só: o domínio consultado.
    results: 1,
    detail: "Resumo de backlinks do domínio",
    caveat: RESULT_CAVEAT,
  },
  {
    id: "backlink_competitors",
    label: "Benchmark de backlinks",
    api: "backlinks",
    fnSuffix: "competitors/live",
    requests: 1,
    results: BACKLINK_COMPETITORS_LIMIT,
    detail: `Até ${BACKLINK_COMPETITORS_LIMIT} concorrentes, na mesma análise`,
    caveat: RESULT_CAVEAT,
  },
  {
    id: "backlink_scheme",
    label: "Rede de links artificiais",
    api: "backlinks",
    fnSuffix: "backlinks/live",
    requests: 1,
    results: BACKLINK_SCHEME_LIMIT,
    detail: `Uma chamada, teto de ${BACKLINK_SCHEME_LIMIT} domínios de origem`,
    caveat: RESULT_CAVEAT,
  },
]

export type DataForSeoOperationCost = {
  operation: DataForSeoOperation
  /** Nulo quando a conta não expõe preço para aquela função. */
  unitCost: number | null
  totalCost: number | null
  requests: number
  /** O caminho que casou na tabela da conta, para conferência na tela. */
  fn: string | null
}

export function dataForSeoOperationCost(
  operation: DataForSeoOperation,
  prices: readonly DataForSeoPriceEntry[],
  quantity: number,
): DataForSeoOperationCost {
  const price = findDataForSeoPrice(prices, operation.api, operation.fnSuffix)
  const requests = operation.requests * Math.max(quantity, 0)
  if (!price) {
    return { operation, unitCost: null, totalCost: null, requests, fn: null }
  }
  // As duas parcelas somam: uma por chamada, outra por linha devolvida.
  const unitCost =
    (price.perRequest ?? 0) + (price.perResult ?? 0) * operation.results
  return {
    operation,
    unitCost,
    totalCost: unitCost * requests,
    requests,
    fn: price.fn,
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
