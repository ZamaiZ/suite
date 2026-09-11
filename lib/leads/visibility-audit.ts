export const VISIBILITY_SEARCH_CAP = 40
export const VISIBILITY_RELATED_SEED_MAX = 8
export const VISIBILITY_LOW_TRAFFIC = 50
export const VISIBILITY_THIN_KEYWORDS = 20

export type VisibilitySource = "dataforseo_labs" | "serpapi_organic"

/**
 * Tudo anulável menos `path`, e por um motivo só: o snapshot v1 gravou apenas o
 * caminho — o mapeador preferia `relative_url` a `url`. O tipo precisa comportar
 * a linha antiga sem inventar host, porque inventar host é exatamente o defeito
 * que este formato corrige: em `buscaorganica.com.br`, 77 das 110 keywords
 * ranqueavam num subdomínio de homologação, e o caminho sozinho não conta isso.
 */
export type VisibilityUrl = {
  full: string | null
  host: string | null
  mainDomain: string | null
  path: string
  isCanonicalHost: boolean | null
}

export type VisibilityAdsCompetition = "LOW" | "MEDIUM" | "HIGH"

/**
 * Três sinais de dificuldade, e nenhum deles sozinho basta.
 *
 * `index` é o Keyword Difficulty da DataForSEO, e tem buraco: na medição de
 * 2026-09-10 ele veio `0` em 98 de 110 keywords — e `0` ali significa "não
 * calculei", não "fácil". O endpoint dedicado devolveu os mesmos zeros, então
 * não há fonte melhor a comprar. Os outros dois vêm na mesma resposta já paga:
 * a disputa do Google Ads, que não tem buraco, e os domínios de referência do
 * top-10, que é a matéria-prima da dificuldade em vez da estimativa dela.
 */
export type VisibilityDifficulty = {
  index: number | null
  adsCompetition: VisibilityAdsCompetition | null
  adsCompetitionScore: number | null
  topTenReferringDomains: number | null
}

/**
 * A posição e a data em que a DataForSEO viu aquela SERP.
 *
 * As duas juntas porque separá-las foi o defeito: a etapa carimbava a hora do
 * clique como se fosse a hora da medida, e a medição de 2026-09-10 mostrou que
 * o índice tinha mediana de 59 dias e máximo de 108.
 */
export type VisibilityPosition = {
  value: number | null
  previous: number | null
  updatedAt: string | null
}

export type VisibilityVolume = {
  value: number | null
  updatedAt: string | null
}

export type VisibilityIndexAge = {
  serpMedianDays: number
  serpMaxDays: number
  volumeMedianDays: number | null
  intentMedianDays: number | null
}

/** Acima disto a linha é histórico, não retrato. Medido: mediana 59, máximo 108. */
export const VISIBILITY_STALE_SERP_DAYS = 90

export type VisibilityItemType =
  "organic" | "local_pack" | "ai_overview_reference"

export type VisibilityIntentLabel =
  "informational" | "navigational" | "commercial" | "transactional"

export type VisibilityIntent = {
  label: VisibilityIntentLabel
  /** `null` só na linha v1, que não tinha o dado. Ver a leitura de compatibilidade. */
  probability: number | null
  secondary: Array<{ label: string; probability: number }>
  updatedAt: string | null
}

/**
 * Abaixo disto a tela cala.
 *
 * Medido em 2026-09-10: 36 das 110 classificações ficaram abaixo de 0,60, com
 * mínima de 0,3667 e mediana de 0,7439. Uma classificação de 0,37 estampada
 * como letra fica visualmente idêntica a uma de 0,98 — e é isso que fazia a
 * coluna parecer errada contra outras ferramentas.
 */
export const VISIBILITY_INTENT_MIN_PROBABILITY = 0.6

/**
 * Mora aqui, junto do tipo, e não no presenter: a agregação por intenção e a
 * célula da tabela precisam do mesmo rótulo, e duas cópias divergem em silêncio.
 */
export const VISIBILITY_INTENT_LABELS: Record<VisibilityIntentLabel, string> = {
  informational: "Informacional",
  navigational: "Navegacional",
  commercial: "Comercial",
  transactional: "Transacional",
}

export type VisibilityKeywordRow = {
  keyword: string
  position: VisibilityPosition
  url: VisibilityUrl | null
  volume: VisibilityVolume
  traffic: number | null
  difficulty: VisibilityDifficulty
  /** `null` quando a coleta dedicada de intenção não respondeu. */
  intent: VisibilityIntent | null
  /** `serp_info.serp_item_types`: o que a SERP daquela busca contém de fato. */
  serpFeatures: string[]
  itemType: VisibilityItemType
  /** `keyword_properties.is_another_language`: o detector errou o idioma. */
  languageMismatch: boolean
  /**
   * `serp_item.text` — o trecho que a SERP de fato mostrou.
   *
   * Em `ai_overview_reference` é **a frase que a visão geral de IA citou do
   * site**, e é o campo de maior valor comercial da linha: o lead reconhece a
   * própria frase. Vinha pago e era descartado.
   *
   * `null` significa **não coletado**: snapshot anterior a 2026-09-11 não tem
   * o campo, e ausência aqui não é "a SERP não mostrou texto".
   */
  citedText: string | null
}

/**
 * Quantas linhas vieram, de quantas existem. Separado das métricas porque
 * confundir os dois era o defeito: `keywordCount` significava footprint quando
 * a API mandava `metrics.organic` e amostra quando não mandava, e nada no
 * snapshot distinguia os casos — enquanto a guarda de gap dependia disso.
 */
export type VisibilityCoverage = {
  returned: number
  total: number | null
  truncated: boolean
}

export type VisibilityHost = {
  host: string
  keywords: number
  traffic: number
  isCanonical: boolean
}

/**
 * As seções não-orgânicas de `metrics`. Só contagem e tráfego: os buckets de
 * posição não fazem sentido em `local_pack` nem em `ai_overview_reference`, e
 * as duas vieram zeradas na única medição — o mínimo é o honesto.
 */
export type VisibilityTypeMetrics = {
  count: number | null
  estimatedTraffic: number | null
}

export type VisibilityPositionBuckets = {
  top3: number
  pos4to10: number
  pos11to20: number
  pos21to50: number
  pos51to100: number
}

export type VisibilityMetrics = {
  keywordCount: number | null
  estimatedTraffic: number | null
  estimatedTrafficCost: number | null
  positionBuckets: VisibilityPositionBuckets | null
}

export type VisibilitySnapshot = {
  /**
   * `1` é o formato gravado até 2026-09-10, com `url` como caminho solto. O
   * leitor tolera os dois; o escritor só produz `2`.
   */
  version: 1 | 2
  source: VisibilitySource
  domain: string
  locationLabel: string
  languageCode: string
  collectedAt: string
  searchCount: number
  /** `null` no v1, que não media a idade do índice. */
  indexAge: VisibilityIndexAge | null
  coverage: VisibilityCoverage
  hosts: VisibilityHost[]
  /** Custo real da coleta, somando as chamadas. `null` no v1, que o descartava. */
  costUsd: number | null
  /** Linhas que o leitor não conseguiu ler. Antes sumiam em silêncio. */
  droppedRows: number
  metrics: VisibilityMetrics
  localPack: VisibilityTypeMetrics | null
  aiOverview: VisibilityTypeMetrics | null
  keywords: VisibilityKeywordRow[]
}

export type LeadVisibilityAudit = {
  id: string
  lead_id: string
  domain: string
  snapshot: VisibilitySnapshot
  fetched_at: string
  fetched_by: string
}

export type VisibilityGapId =
  | "brand_only_visibility"
  | "no_local_top20"
  | "homepage_only"
  | "not_ranking"
  | "low_organic_traffic"
  | "thin_keyword_footprint"
  | "non_canonical_host_traffic"

export const VISIBILITY_GAP_LABELS: Record<VisibilityGapId, string> = {
  brand_only_visibility: "Visibilidade só em marca",
  no_local_top20: "Sem keyword local no top 20",
  homepage_only: "Só a página inicial ranqueia",
  not_ranking: "Domínio sem posições orgânicas",
  low_organic_traffic: "Tráfego orgânico estimado baixo",
  thin_keyword_footprint: "Poucas keywords no índice",
  non_canonical_host_traffic: "Tráfego orgânico fora do host principal",
}

/**
 * Acima disto o host secundário deixou de ser detalhe.
 *
 * No primeiro lead medido eram 77 das 110 keywords e 119 dos 468 cliques
 * estimados num subdomínio de homologação indexado — perda de autoridade e de
 * atribuição, e um achado que a auditoria existe para encontrar.
 */
export const VISIBILITY_NON_CANONICAL_SHARE = 0.2

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function asFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asInt(value: unknown): number | null {
  const n = asFinite(value)
  if (n === null) return null
  return Math.trunc(n)
}

function readBuckets(value: unknown): VisibilityPositionBuckets | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const top3 = asInt(row.top3)
  const pos4to10 = asInt(row.pos4to10)
  const pos11to20 = asInt(row.pos11to20)
  const pos21to50 = asInt(row.pos21to50)
  const pos51to100 = asInt(row.pos51to100)
  if (
    top3 === null ||
    pos4to10 === null ||
    pos11to20 === null ||
    pos21to50 === null ||
    pos51to100 === null
  ) {
    return null
  }
  return { top3, pos4to10, pos11to20, pos21to50, pos51to100 }
}

/** `www.` não é outro site. Qualquer outro rótulo à esquerda é. */
export function isCanonicalHost(
  host: string,
  canonicalDomain: string,
): boolean {
  const fold = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/^www\./, "")
  return fold(host) === fold(canonicalDomain)
}

export function visibilityUrlFromAbsolute(
  full: string,
  canonicalDomain: string,
): VisibilityUrl | null {
  try {
    const parsed = new URL(full)
    const host = parsed.hostname.toLowerCase()
    return {
      full,
      host,
      mainDomain: null,
      path: `${parsed.pathname}${parsed.search}` || "/",
      isCanonicalHost: isCanonicalHost(host, canonicalDomain),
    }
  } catch {
    return null
  }
}

function readUrl(value: unknown): VisibilityUrl | null {
  // v1 gravava só o caminho. Não dá para recuperar o host, e inventar um seria
  // repetir o defeito — a linha antiga fica honesta com `null`.
  if (typeof value === "string") {
    const path = value.trim()
    return path
      ? {
          full: null,
          host: null,
          mainDomain: null,
          path,
          isCanonicalHost: null,
        }
      : null
  }
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const path = asString(row.path)
  if (!path) return null
  return {
    full: asString(row.full),
    host: asString(row.host),
    mainDomain: asString(row.mainDomain),
    path,
    isCanonicalHost:
      typeof row.isCanonicalHost === "boolean" ? row.isCanonicalHost : null,
  }
}

export function emptyVisibilityDifficulty(): VisibilityDifficulty {
  return {
    index: null,
    adsCompetition: null,
    adsCompetitionScore: null,
    topTenReferringDomains: null,
  }
}

/** Exportada: o mapeador lê o mesmo enum a partir do payload cru. */
export function readAdsCompetition(
  value: unknown,
): VisibilityAdsCompetition | null {
  return value === "LOW" || value === "MEDIUM" || value === "HIGH"
    ? value
    : null
}

function readDifficulty(value: unknown): VisibilityDifficulty {
  // v1 gravava um número solto. A regra do zero NÃO é aplicada retroativamente:
  // ali não dá para saber se aquele 0 veio da API ou de linha sem o campo, e
  // converter às cegas trocaria um dado duvidoso por outro.
  if (typeof value === "number") {
    return { ...emptyVisibilityDifficulty(), index: asInt(value) }
  }
  if (!value || typeof value !== "object") return emptyVisibilityDifficulty()
  const row = value as Record<string, unknown>
  return {
    index: asInt(row.index),
    adsCompetition: readAdsCompetition(row.adsCompetition),
    adsCompetitionScore: asFinite(row.adsCompetitionScore),
    topTenReferringDomains: asFinite(row.topTenReferringDomains),
  }
}

function readPosition(value: unknown): VisibilityPosition {
  // v1 gravava um número solto, sem data — de lá não sai procedência nenhuma.
  if (typeof value === "number") {
    const current = asInt(value)
    return {
      value: current !== null && current >= 1 ? current : null,
      previous: null,
      updatedAt: null,
    }
  }
  if (!value || typeof value !== "object") {
    return { value: null, previous: null, updatedAt: null }
  }
  const row = value as Record<string, unknown>
  const current = asInt(row.value)
  const previous = asInt(row.previous)
  return {
    value: current !== null && current >= 1 ? current : null,
    previous: previous !== null && previous >= 1 ? previous : null,
    updatedAt: asString(row.updatedAt),
  }
}

function readVolume(value: unknown): VisibilityVolume {
  if (typeof value === "number") {
    return { value: asInt(value), updatedAt: null }
  }
  if (!value || typeof value !== "object") {
    return { value: null, updatedAt: null }
  }
  const row = value as Record<string, unknown>
  return { value: asInt(row.value), updatedAt: asString(row.updatedAt) }
}

function readIndexAge(value: unknown): VisibilityIndexAge | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const serpMedianDays = asInt(row.serpMedianDays)
  const serpMaxDays = asInt(row.serpMaxDays)
  if (serpMedianDays === null || serpMaxDays === null) return null
  return {
    serpMedianDays,
    serpMaxDays,
    volumeMedianDays: asInt(row.volumeMedianDays),
    intentMedianDays: asInt(row.intentMedianDays),
  }
}

const ITEM_TYPES = new Set<string>([
  "organic",
  "local_pack",
  "ai_overview_reference",
])

export function readItemType(value: unknown): VisibilityItemType {
  // Defensivo de propósito: `local_pack` e `ai_overview_reference` vieram
  // zerados na única medição, então a forma do `serp_item` desses dois tipos
  // NUNCA foi observada. O primeiro lead que os tiver é a validação.
  return typeof value === "string" && ITEM_TYPES.has(value)
    ? (value as VisibilityItemType)
    : "organic"
}

function readStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []
}

function readCoverage(value: unknown, returned: number): VisibilityCoverage {
  // v1 não gravava cobertura. `total: null` é honesto: não dá para saber se
  // aquela coleta foi truncada, e `truncated: false` seria afirmar demais.
  if (!value || typeof value !== "object") {
    return { returned, total: null, truncated: false }
  }
  const row = value as Record<string, unknown>
  return {
    returned: asInt(row.returned) ?? returned,
    total: asInt(row.total),
    truncated: row.truncated === true,
  }
}

function readHosts(value: unknown): VisibilityHost[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    const host = asString(row.host)
    if (!host) return []
    return [
      {
        host,
        keywords: asInt(row.keywords) ?? 0,
        traffic: asFinite(row.traffic) ?? 0,
        isCanonical: row.isCanonical === true,
      },
    ]
  })
}

function readTypeMetrics(value: unknown): VisibilityTypeMetrics | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  return {
    count: asInt(row.count),
    estimatedTraffic: asFinite(row.estimatedTraffic),
  }
}

const INTENT_LABEL_VALUES = new Set<string>([
  "informational",
  "navigational",
  "commercial",
  "transactional",
])

function readIntent(value: unknown): VisibilityIntent | null {
  // v1 gravava a string solta de `main_intent`, sem probabilidade. Ela
  // atravessa e escapa do limiar: mostrar o rótulo que a coleta tinha, marcado
  // como antigo, é mais honesto do que fazê-lo virar "—" de repente.
  if (typeof value === "string") {
    const label = value.trim()
    return INTENT_LABEL_VALUES.has(label)
      ? {
          label: label as VisibilityIntentLabel,
          probability: null,
          secondary: [],
          updatedAt: null,
        }
      : null
  }
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const label = asString(row.label)
  if (!label || !INTENT_LABEL_VALUES.has(label)) return null
  const secondary = Array.isArray(row.secondary)
    ? row.secondary.flatMap((item) => {
        if (!item || typeof item !== "object") return []
        const entry = item as Record<string, unknown>
        const entryLabel = asString(entry.label)
        const probability = asFinite(entry.probability)
        return entryLabel && probability !== null
          ? [{ label: entryLabel, probability }]
          : []
      })
    : []
  return {
    label: label as VisibilityIntentLabel,
    probability: asFinite(row.probability),
    secondary,
    updatedAt: asString(row.updatedAt),
  }
}

function readKeywordRow(value: unknown): VisibilityKeywordRow | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const keyword = asString(row.keyword)
  if (!keyword) return null
  return {
    keyword,
    position: readPosition(row.position),
    url: readUrl(row.url),
    volume: readVolume(row.volume),
    traffic: asFinite(row.traffic),
    difficulty: readDifficulty(row.difficulty),
    intent: readIntent(row.intent),
    serpFeatures: readStringList(row.serpFeatures),
    itemType: readItemType(row.itemType),
    languageMismatch: row.languageMismatch === true,
    citedText: asString(row.citedText),
  }
}

function readMetrics(value: unknown): VisibilityMetrics {
  if (!value || typeof value !== "object") {
    return {
      keywordCount: null,
      estimatedTraffic: null,
      estimatedTrafficCost: null,
      positionBuckets: null,
    }
  }
  const row = value as Record<string, unknown>
  return {
    keywordCount: asInt(row.keywordCount),
    estimatedTraffic: asFinite(row.estimatedTraffic),
    estimatedTrafficCost: asFinite(row.estimatedTrafficCost),
    positionBuckets: readBuckets(row.positionBuckets),
  }
}

export function readVisibilitySnapshot(
  value: unknown,
): VisibilitySnapshot | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const source = row.source
  if (source !== "dataforseo_labs" && source !== "serpapi_organic") return null
  const domain = asString(row.domain)
  const locationLabel = asString(row.locationLabel)
  const languageCode = asString(row.languageCode)
  const collectedAt = asString(row.collectedAt)
  const searchCount = asInt(row.searchCount)
  if (!domain || !locationLabel || !languageCode || !collectedAt) return null
  if (searchCount === null || searchCount < 0) return null
  const keywords = Array.isArray(row.keywords)
    ? row.keywords.flatMap((item) => {
        const parsed = readKeywordRow(item)
        return parsed ? [parsed] : []
      })
    : []
  return {
    version: asInt(row.version) === 2 ? 2 : 1,
    source,
    domain,
    locationLabel,
    languageCode,
    collectedAt,
    searchCount,
    indexAge: readIndexAge(row.indexAge),
    coverage: readCoverage(row.coverage, keywords.length),
    hosts: readHosts(row.hosts),
    costUsd: asFinite(row.costUsd),
    droppedRows: asInt(row.droppedRows) ?? 0,
    metrics: readMetrics(row.metrics),
    localPack: readTypeMetrics(row.localPack),
    aiOverview: readTypeMetrics(row.aiOverview),
    keywords,
  }
}

export function readLeadVisibilityAuditRow(
  row: Record<string, unknown>,
): LeadVisibilityAudit | null {
  const id = asString(row.id)
  const lead_id = asString(row.lead_id)
  const domain = asString(row.domain)
  const fetched_at = asString(row.fetched_at)
  const fetched_by = asString(row.fetched_by)
  const snapshot = readVisibilitySnapshot(row.snapshot)
  if (!id || !lead_id || !domain || !fetched_at || !fetched_by || !snapshot) {
    return null
  }
  return {
    id,
    lead_id,
    domain,
    snapshot,
    fetched_at,
    fetched_by,
  }
}

export function foldVisibilityText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

export function brandTokensFromName(companyName: string): string[] {
  const folded = foldVisibilityText(companyName)
  if (!folded) return []
  const stop = new Set([
    "ltda",
    "me",
    "eireli",
    "sa",
    "s",
    "a",
    "e",
    "de",
    "da",
    "do",
    "dos",
    "das",
    "the",
    "group",
    "grupo",
  ])
  return folded
    .split(" ")
    .filter((token) => token.length >= 3 && !stop.has(token))
}

export function isBrandKeyword(
  keyword: string,
  companyName: string,
  domain: string,
): boolean {
  const foldedKeyword = foldVisibilityText(keyword)
  if (!foldedKeyword) return false
  const host = foldVisibilityText(domain.replace(/\.[a-z.]+$/i, ""))
  if (host && foldedKeyword.includes(host)) return true
  const tokens = brandTokensFromName(companyName)
  if (tokens.length === 0) return false
  return tokens.every((token) => foldedKeyword.includes(token))
}

export function isLocalKeyword(keyword: string, city: string | null): boolean {
  const folded = foldVisibilityText(keyword)
  if (!folded) return false
  if (/\bem\b/.test(folded)) return true
  if (!city) return false
  const cityFolded = foldVisibilityText(city)
  if (!cityFolded) return false
  return folded.includes(cityFolded)
}

/**
 * Antes esta função montava `https://${domain}${path}` quando só tinha o
 * caminho — e produzia URL que não existe. Na primeira medição real, 77 das 110
 * keywords ranqueavam em `aprov.buscaorganica.com.br`, e todas eram lidas como
 * se estivessem na home do domínio principal.
 *
 * Página em outro host nunca é "a home": é outro site, e o gap `homepage_only`
 * não pode absorvê-la em silêncio.
 */
export function isHomepageUrl(url: VisibilityUrl | null): boolean {
  if (!url) return true
  if (url.isCanonicalHost === false) return false
  const trimmed = url.path.trim()
  if (!trimmed || trimmed === "/" || trimmed === "#") return true
  const path = trimmed.split("?")[0].replace(/\/+$/, "") || "/"
  return path === "/" || path === "/index.html" || path === "/index.php"
}

export function cityFromFormattedAddress(
  address: string | null,
): string | null {
  if (!address) return null
  const match = address.match(/,\s*([^,]+?)\s*-\s*[A-Z]{2}\b/)
  if (match?.[1]) return match[1].trim()
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 2]
    if (candidate && !/\d/.test(candidate)) return candidate
  }
  return null
}

export function visibilityGapsForSnapshot(input: {
  snapshot: VisibilitySnapshot
  companyName: string
  city: string | null
}): VisibilityGapId[] {
  const { snapshot, companyName, city } = input
  const ranked = snapshot.keywords.filter(
    (row) => row.position.value !== null && row.position.value <= 100,
  )
  const gaps: VisibilityGapId[] = []

  if (ranked.length === 0) {
    gaps.push("not_ranking")
    return gaps
  }

  /**
   * A amostra do `ranked_keywords` vem truncada e ordenada por tráfego, então
   * num domínio grande o que se procura pode simplesmente não estar nela. Sem
   * cobertura do footprint, "não encontrei" não é "não existe" — e não saber
   * não é um gap.
   *
   * A guarda nasceu só em `no_local_top20` e agora vale para os três testes de
   * ausência. `coverage` é a fonte porque `keywordCount` significava footprint
   * num caso e amostra no outro, sem nada que distinguisse.
   */
  const sampleCoversFootprint = !snapshot.coverage.truncated

  const top10 = ranked.filter((row) => (row.position.value ?? 999) <= 10)
  if (
    sampleCoversFootprint &&
    top10.length > 0 &&
    top10.every((row) =>
      isBrandKeyword(row.keyword, companyName, snapshot.domain),
    )
  ) {
    gaps.push("brand_only_visibility")
  }

  const localTop20 = ranked.some(
    (row) =>
      (row.position.value ?? 999) <= 20 && isLocalKeyword(row.keyword, city),
  )
  if (sampleCoversFootprint && !localTop20) {
    gaps.push("no_local_top20")
  }

  // A mesma guarda vale aqui, e por um motivo mais forte: a amostra vem
  // ordenada por tráfego e a home costuma liderar o ETV, então num domínio
  // grande "só a home ranqueia" dispara por construção, não por diagnóstico.
  if (sampleCoversFootprint && ranked.every((row) => isHomepageUrl(row.url))) {
    gaps.push("homepage_only")
  }

  if (
    snapshot.metrics.estimatedTraffic !== null &&
    snapshot.metrics.estimatedTraffic < VISIBILITY_LOW_TRAFFIC
  ) {
    gaps.push("low_organic_traffic")
  }

  if (
    snapshot.metrics.keywordCount !== null &&
    snapshot.source === "dataforseo_labs" &&
    snapshot.metrics.keywordCount < VISIBILITY_THIN_KEYWORDS
  ) {
    gaps.push("thin_keyword_footprint")
  }

  if (hasNonCanonicalHostTraffic(snapshot.hosts)) {
    gaps.push("non_canonical_host_traffic")
  }

  return gaps
}

function share(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0
}

/**
 * Dispara por keywords **ou** por tráfego: um host secundário pode carregar
 * muitas páginas de cauda longa com pouco tráfego, ou poucas páginas com muito
 * — os dois são o mesmo problema de atribuição.
 */
export function hasNonCanonicalHostTraffic(
  hosts: ReadonlyArray<VisibilityHost>,
): boolean {
  const nonCanonical = hosts.filter((host) => !host.isCanonical)
  if (nonCanonical.length === 0) return false
  const totalKeywords = hosts.reduce((sum, host) => sum + host.keywords, 0)
  const totalTraffic = hosts.reduce((sum, host) => sum + host.traffic, 0)
  const keywordShare = share(
    nonCanonical.reduce((sum, host) => sum + host.keywords, 0),
    totalKeywords,
  )
  const trafficShare = share(
    nonCanonical.reduce((sum, host) => sum + host.traffic, 0),
    totalTraffic,
  )
  return (
    keywordShare >= VISIBILITY_NON_CANONICAL_SHARE ||
    trafficShare >= VISIBILITY_NON_CANONICAL_SHARE
  )
}

export function visibilityGapLabel(id: VisibilityGapId): string {
  return VISIBILITY_GAP_LABELS[id]
}
