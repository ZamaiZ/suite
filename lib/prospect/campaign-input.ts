/**
 * A campanha: validação, corpo da chamada e estimativa de custo. Puro.
 *
 * Fica sem imports de rede pelo mesmo motivo de `lib/dataforseo/limits.ts`: a
 * estimativa roda no navegador, antes de o SDR confirmar o gasto, e o corpo da
 * chamada roda no servidor. Duas cópias do mesmo teto fariam a calculadora
 * mentir em silêncio.
 */

/* -------------------------------------------------------------------------- */
/*  Tetos                                                                     */
/* -------------------------------------------------------------------------- */

/** Teto do endpoint. Acima disso ele recorta sozinho, sem avisar. */
export const PROSPECT_CATEGORIES_MAX = 10

/** Teto de itens por chamada do `search`. */
export const PROSPECT_PAGE_MAX = 1000

/**
 * Teto de empresas por campanha.
 *
 * Mil, que é também o teto de uma página. Não é limitação técnica —
 * `offset_token` pagina além disso — e sim de trabalho: a sondagem mediu 4.791
 * restaurantes num raio de 10 km, e nenhum SDR revisa isso antes de a lista
 * envelhecer. Campanha maior é campanha mais estreita, não teto maior.
 */
export const PROSPECT_TARGET_MAX = 1000
export const PROSPECT_TARGET_DEFAULT = 200

export const PROSPECT_RADIUS_MIN_KM = 1
export const PROSPECT_RADIUS_MAX_KM = 100
export const PROSPECT_RADIUS_DEFAULT_KM = 10

/* -------------------------------------------------------------------------- */
/*  Preço                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Medido em 2026-09-21, e aqui a tabela fecha.
 *
 * `search` com 100 itens custou US$ 0,048 contra US$ 0,012 + 100 × 0,00036 =
 * US$ 0,048 de tabela. Exato.
 *
 * Isso é o oposto do que o `SERP_CAVEAT` de `lib/dataforseo/usage.ts` registra
 * para a seção `serp`, onde o medido ficou cinco vezes acima. A parcela por
 * item do `business_listings` é confiável; a de SERP não é — e é por isso que
 * a estimativa da descoberta pode ser mostrada como número, e a do
 * enriquecimento por SERP é mostrada como faixa.
 */
export const BUSINESS_LISTINGS_TASK_USD = 0.012
export const BUSINESS_LISTINGS_ITEM_USD = 0.00036

/**
 * O agregado custa o mesmo que uma busca, e o `limit` não barateia.
 *
 * Medido: `limit: 5` e `limit: 100` custaram US$ 0,048 os dois. Por isso a
 * estimativa é guardada em `prospect_campaigns.estimate` e não refeita a cada
 * abertura da tela — seria pagar duas vezes pela mesma pergunta.
 */
export const CATEGORIES_AGGREGATION_USD = 0.048

export function discoveryCostUsd(targetCount: number): number {
  const paginas = Math.max(1, Math.ceil(targetCount / PROSPECT_PAGE_MAX))
  const bruto =
    paginas * BUSINESS_LISTINGS_TASK_USD + targetCount * BUSINESS_LISTINGS_ITEM_USD
  return Number(bruto.toFixed(5))
}

/* -------------------------------------------------------------------------- */
/*  Filtros de qualificação                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Os filtros que o provedor aplica no servidor dele.
 *
 * Filtrar lá é diferente de filtrar aqui: só se paga pelo que volta. Pedir
 * mil e descartar novecentos na tela custaria os mil.
 */
export type ProspectFilters = {
  /** Só perfis não reivindicados. Entre 32% e 52% da amostra. */
  onlyUnclaimed?: boolean
  /** Só quem não tem site. De 60% a 79% da amostra. */
  onlyWithoutWebsite?: boolean
  /** Só quem tem telefone — sem ele, não há como abordar nem cruzar CNPJ. */
  onlyWithPhone?: boolean
  /** Nota máxima. O sinal de dor mais direto. */
  maxRating?: number
  /** Mínimo de avaliações, para não trazer perfil fantasma. */
  minVotes?: number
}

export type CampaignInput = {
  name: string
  categories: string[]
  latitude: number
  longitude: number
  radiusKm: number
  targetCount: number
  filters: ProspectFilters
}

export type CampaignInputIssue = { field: string; message: string }

export function validateCampaignInput(
  input: Partial<CampaignInput>,
): CampaignInputIssue[] {
  const issues: CampaignInputIssue[] = []

  const name = (input.name ?? "").trim()
  if (name.length < 2 || name.length > 120) {
    issues.push({ field: "name", message: "Dê um nome de 2 a 120 caracteres." })
  }

  const categories = input.categories ?? []
  if (categories.length === 0) {
    issues.push({ field: "categories", message: "Escolha ao menos um segmento." })
  } else if (categories.length > PROSPECT_CATEGORIES_MAX) {
    issues.push({
      field: "categories",
      message: `No máximo ${PROSPECT_CATEGORIES_MAX} segmentos por campanha.`,
    })
  }

  if (
    typeof input.latitude !== "number" ||
    typeof input.longitude !== "number" ||
    !Number.isFinite(input.latitude) ||
    !Number.isFinite(input.longitude)
  ) {
    issues.push({ field: "city", message: "Escolha uma cidade." })
  }

  const raio = input.radiusKm ?? 0
  if (raio < PROSPECT_RADIUS_MIN_KM || raio > PROSPECT_RADIUS_MAX_KM) {
    issues.push({
      field: "radiusKm",
      message: `O raio vai de ${PROSPECT_RADIUS_MIN_KM} a ${PROSPECT_RADIUS_MAX_KM} km.`,
    })
  }

  const alvo = input.targetCount ?? 0
  if (!Number.isInteger(alvo) || alvo < 1 || alvo > PROSPECT_TARGET_MAX) {
    issues.push({
      field: "targetCount",
      message: `Traga de 1 a ${PROSPECT_TARGET_MAX} empresas por campanha.`,
    })
  }

  const nota = input.filters?.maxRating
  if (nota !== undefined && (nota < 1 || nota > 5)) {
    issues.push({ field: "maxRating", message: "A nota vai de 1 a 5." })
  }

  return issues
}

/* -------------------------------------------------------------------------- */
/*  Corpo da chamada                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Coordenada no formato do endpoint: `lat,lng,raio_em_km`.
 *
 * Diferente do `location_coordinate` da SERP do Maps, que termina em **zoom**
 * (ver `lib/dataforseo/maps-task.ts`). Mesmo nome de campo, terceira posição
 * com significado diferente — trocar um pelo outro devolve resultado plausível
 * e errado, que é o pior tipo de bug.
 */
export function listingsCoordinate(
  latitude: number,
  longitude: number,
  radiusKm: number,
): string {
  return `${Number(latitude.toFixed(7))},${Number(longitude.toFixed(7))},${Number(radiusKm.toFixed(2))}`
}

/** Os filtros no formato `[campo, operador, valor]` que o endpoint aceita. */
export function listingsFilters(
  filters: ProspectFilters,
): Array<unknown> {
  const clauses: Array<unknown> = []
  const push = (clause: unknown) => {
    if (clauses.length > 0) clauses.push("and")
    clauses.push(clause)
  }

  if (filters.onlyWithoutWebsite) push(["url", "=", null])
  if (filters.onlyWithPhone) push(["phone", "<>", null])
  if (typeof filters.maxRating === "number") {
    push(["rating.value", "<=", filters.maxRating])
  }
  if (typeof filters.minVotes === "number") {
    push(["rating.votes_count", ">=", filters.minVotes])
  }
  return clauses
}

export function buildSearchTask(
  input: CampaignInput,
  page: { limit: number; offset?: number; offsetToken?: string | null },
): Record<string, unknown> {
  const task: Record<string, unknown> = {
    categories: input.categories.slice(0, PROSPECT_CATEGORIES_MAX),
    location_coordinate: listingsCoordinate(
      input.latitude,
      input.longitude,
      input.radiusKm,
    ),
    limit: Math.min(page.limit, PROSPECT_PAGE_MAX),
  }

  // `is_claimed` é parâmetro próprio, não filtro: mandá-lo dentro de `filters`
  // devolve 40501.
  if (input.filters.onlyUnclaimed) task.is_claimed = false

  const filters = listingsFilters(input.filters)
  if (filters.length > 0) task.filters = filters

  // O token manda no offset. Mandar os dois faz o provedor ignorar o token e
  // recomeçar — que é exatamente a recompra que a paginação existe para evitar.
  if (page.offsetToken) task.offset_token = page.offsetToken
  else if (page.offset) task.offset = page.offset

  return task
}

export function buildAggregationTask(
  input: Pick<CampaignInput, "categories" | "latitude" | "longitude" | "radiusKm">,
): Record<string, unknown> {
  return {
    categories: input.categories.slice(0, PROSPECT_CATEGORIES_MAX),
    location_coordinate: listingsCoordinate(
      input.latitude,
      input.longitude,
      input.radiusKm,
    ),
    limit: 5,
  }
}

/* -------------------------------------------------------------------------- */
/*  Estimativa                                                                */
/* -------------------------------------------------------------------------- */

export type CategoryDensity = {
  category: string
  count: number
  withWebsite: number
}

export type CampaignEstimate = {
  /** Densidade das categorias que a campanha realmente pediu. */
  byCategory: CategoryDensity[]
  /**
   * Categorias vizinhas que o provedor sugeriu, com o tamanho de cada uma.
   *
   * Não entram na conta — entram na tela, como "quer incluir também?". Para
   * dentista em Guarulhos o agregado devolveu `dental_clinic` (509),
   * `oral_surgeon` (401), `orthodontist` (309) e `dental_implants_provider`
   * (232) sem que ninguém pedisse.
   */
  related: CategoryDensity[]
  universeCount: number
  /** Quantas o provedor diz ter site. É a fração que o CNPJ do rodapé alcança. */
  withWebsiteCount: number
  /** Quantas a campanha vai trazer, respeitando o teto. */
  plannedCount: number
  costUsd: number
}

/**
 * Lê o `categories_aggregation` e monta o que a tela mostra antes do gasto.
 *
 * Duas armadilhas medidas em 2026-09-21, as duas capazes de inflar o número
 * que o SDR lê antes de autorizar o gasto:
 *
 * **1. O agregado devolve categorias vizinhas que ninguém pediu.** Pedindo
 * `dentist`, vieram cinco itens; somar os cinco dá 3.852 contra os 2.401
 * reais, porque uma clínica odontológica também é dentista e é contada duas
 * vezes. Só as categorias **pedidas** entram no universo.
 *
 * **2. `withWebsite` sai do `websites_count` do agregado, nunca de extrapolar
 * a primeira página do `search`.** Para o mesmo dentista o agregado dá 22% e a
 * amostra de 100 dá 40% — a amostra não é aleatória.
 *
 * Com mais de uma categoria pedida a soma ainda pode contar em dobro quem
 * pertence às duas. É estimativa, e o `total_count` da primeira página de
 * descoberta corrige o número depois.
 */
export function readAggregation(
  raw: unknown,
  targetCount: number,
  requestedCategories: string[] = [],
): CampaignEstimate {
  const pedidas = new Set(requestedCategories)
  const byCategory: CategoryDensity[] = []
  const related: CategoryDensity[] = []

  const result =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  const items = Array.isArray(result.items) ? result.items : []

  for (const item of items) {
    if (!item || typeof item !== "object") continue
    const entry = item as Record<string, unknown>
    const agg =
      entry.aggregation && typeof entry.aggregation === "object"
        ? (entry.aggregation as Record<string, unknown>)
        : {}
    const categorias = Array.isArray(entry.categories) ? entry.categories : []
    const category =
      typeof categorias[0] === "string" ? (categorias[0] as string) : null
    const count = typeof agg.count === "number" ? agg.count : 0
    if (!category || count <= 0) continue

    const densidade: CategoryDensity = {
      category,
      count,
      withWebsite:
        typeof agg.websites_count === "number" ? agg.websites_count : 0,
    }
    // Sem lista de pedidas, tudo conta: é o caso do planejamento exploratório,
    // em que o SDR ainda não escolheu categoria nenhuma.
    if (pedidas.size === 0 || pedidas.has(category)) byCategory.push(densidade)
    else related.push(densidade)
  }

  const porTamanho = (a: CategoryDensity, b: CategoryDensity) =>
    b.count - a.count
  byCategory.sort(porTamanho)
  related.sort(porTamanho)

  const universeCount = byCategory.reduce((total, c) => total + c.count, 0)
  const withWebsiteCount = byCategory.reduce(
    (total, c) => total + c.withWebsite,
    0,
  )
  const plannedCount = Math.min(targetCount, universeCount || targetCount)

  return {
    byCategory,
    related,
    universeCount,
    withWebsiteCount,
    plannedCount,
    costUsd: discoveryCostUsd(plannedCount),
  }
}
