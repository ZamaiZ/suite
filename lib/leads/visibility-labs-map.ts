import { dataForSeoTimeToIso } from "../dataforseo/time.ts"
import {
  readAdsCompetition,
  readItemType,
  visibilityUrlFromAbsolute,
  type VisibilityDifficulty,
  type VisibilityIndexAge,
  type VisibilityIntent,
  type VisibilityIntentLabel,
  type VisibilityKeywordRow,
  type VisibilityHost,
  type VisibilityMetrics,
  type VisibilitySnapshot,
  type VisibilityTypeMetrics,
  type VisibilityUrl,
} from "./visibility-audit.ts"

export type RankedKeywordsLiveResult = {
  total_count?: number
  metrics?: {
    organic?: Record<string, unknown>
    local_pack?: Record<string, unknown>
    ai_overview_reference?: Record<string, unknown>
  }
  items?: Array<Record<string, unknown>>
}

function asFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asInt(value: unknown): number | null {
  const n = asFinite(value)
  return n === null ? null : Math.trunc(n)
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function daysBetween(iso: string | null, reference: string): number | null {
  if (!iso) return null
  const ms = Date.parse(reference) - Date.parse(iso)
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 86_400_000)) : null
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = values.slice().sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)]
}

/**
 * A idade do índice, resumida. É o número que separa "coletado agora" de
 * "medido há dois meses" — e a ausência dele era a maior causa isolada de
 * divergência contra outras ferramentas, que reindexam em ciclos próprios.
 */
function mapIndexAge(
  keywords: ReadonlyArray<VisibilityKeywordRow>,
  collectedAt: string,
): VisibilityIndexAge | null {
  const serp = keywords
    .map((row) => daysBetween(row.position.updatedAt, collectedAt))
    .filter((value): value is number => value !== null)
  if (serp.length === 0) return null
  const volume = keywords
    .map((row) => daysBetween(row.volume.updatedAt, collectedAt))
    .filter((value): value is number => value !== null)
  // A idade da intenção sai da fonte que a tela exibe. O `search_intent_info`
  // embutido no `ranked_keywords` tem data própria, mas não é o que mostramos.
  const intent = keywords
    .map((row) => daysBetween(row.intent?.updatedAt ?? null, collectedAt))
    .filter((value): value is number => value !== null)
  return {
    serpMedianDays: median(serp) ?? 0,
    serpMaxDays: Math.max(...serp),
    volumeMedianDays: median(volume),
    intentMedianDays: median(intent),
  }
}

/**
 * Sem `metrics.organic` os campos ficam `null`, e **não** caem para a amostra.
 *
 * O fallback antigo — contar as linhas devolvidas — fazia `keywordCount` e
 * `positionBuckets` significarem footprint num caso e amostra no outro, sem
 * nada no snapshot que distinguisse os dois. Quem lê depois não tem como
 * saber, e a guarda de cobertura das regras de gap dependia exatamente dessa
 * distinção. Cobertura agora mora em `coverage`, que é o lugar dela.
 */
function mapOrganicMetrics(
  organic: Record<string, unknown> | undefined,
): VisibilityMetrics {
  if (!organic) {
    return {
      keywordCount: null,
      estimatedTraffic: null,
      estimatedTrafficCost: null,
      positionBuckets: null,
    }
  }
  const pos1 = asInt(organic.pos_1) ?? 0
  const pos2_3 = asInt(organic.pos_2_3) ?? 0
  const pos4_10 = asInt(organic.pos_4_10) ?? 0
  const pos11_20 = asInt(organic.pos_11_20) ?? 0
  const pos21_30 = asInt(organic.pos_21_30) ?? 0
  const pos31_40 = asInt(organic.pos_31_40) ?? 0
  const pos41_50 = asInt(organic.pos_41_50) ?? 0
  const pos51_60 = asInt(organic.pos_51_60) ?? 0
  const pos61_70 = asInt(organic.pos_61_70) ?? 0
  const pos71_80 = asInt(organic.pos_71_80) ?? 0
  const pos81_90 = asInt(organic.pos_81_90) ?? 0
  const pos91_100 = asInt(organic.pos_91_100) ?? 0
  return {
    keywordCount: asInt(organic.count),
    estimatedTraffic: asFinite(organic.etv),
    estimatedTrafficCost: asFinite(organic.estimated_paid_traffic_cost),
    positionBuckets: {
      top3: pos1 + pos2_3,
      pos4to10: pos4_10,
      pos11to20: pos11_20,
      pos21to50: pos21_30 + pos31_40 + pos41_50,
      pos51to100: pos51_60 + pos61_70 + pos71_80 + pos81_90 + pos91_100,
    },
  }
}

/**
 * `serp_item.url` é a URL absoluta; `relative_url` é só o caminho, e era o que
 * gravávamos. `serp_item.subdomain` **não é usado**: veio `null` nas 110 linhas
 * da medição de 2026-09-10, enquanto o host real estava em `domain` e o domínio
 * registrável em `main_domain`.
 */
function mapUrl(
  serpItem: Record<string, unknown> | null,
  canonicalDomain: string,
): VisibilityUrl | null {
  const full = asString(serpItem?.url)
  if (!full) return null
  const parsed = visibilityUrlFromAbsolute(full, canonicalDomain)
  if (!parsed) return null
  return { ...parsed, mainDomain: asString(serpItem?.main_domain) }
}

/**
 * `keyword_difficulty` a `0` é ausência, não facilidade.
 *
 * A escala é 0–100, e a documentação promete `null` quando não há dado. Na
 * base brasileira a promessa não se cumpre: a medição de 2026-09-10 trouxe 98
 * zeros e nenhum `null`, e `bulk_keyword_difficulty` — o endpoint dedicado —
 * devolveu exatamente os mesmos 98. Zero com cara de resposta é pior que
 * ausência declarada, então aqui ele vira ausência.
 */
function mapDifficulty(
  keywordProperties: Record<string, unknown> | null,
  keywordInfo: Record<string, unknown> | null,
  avgBacklinks: Record<string, unknown> | null,
): VisibilityDifficulty {
  const raw = asFinite(keywordProperties?.keyword_difficulty)
  return {
    // `Math.round`, não `Math.trunc`: 39,6 é 40, não 39.
    index: raw === null || raw === 0 ? null : Math.round(raw),
    adsCompetition: readAdsCompetition(keywordInfo?.competition_level),
    adsCompetitionScore: asFinite(keywordInfo?.competition),
    topTenReferringDomains: asFinite(avgBacklinks?.referring_domains),
  }
}

function mapTypeMetrics(
  section: Record<string, unknown> | undefined,
): VisibilityTypeMetrics | null {
  if (!section) return null
  return {
    count: asInt(section.count),
    estimatedTraffic: asFinite(section.etv),
  }
}

/**
 * Agrega o footprint por host. É a leitura que revelou que 77 das 110 keywords
 * de `buscaorganica.com.br` ranqueavam em `aprov.buscaorganica.com.br` — dado
 * que já vinha na resposta e que ninguém via, porque gravávamos só o caminho.
 */
function hostsFromRows(
  rows: ReadonlyArray<VisibilityKeywordRow>,
): VisibilityHost[] {
  const byHost = new Map<string, VisibilityHost>()
  for (const row of rows) {
    const host = row.url?.host
    if (!host) continue
    const found = byHost.get(host) ?? {
      host,
      keywords: 0,
      traffic: 0,
      isCanonical: row.url?.isCanonicalHost === true,
    }
    found.keywords += 1
    found.traffic += row.traffic ?? 0
    byHost.set(host, found)
  }
  return [...byHost.values()].sort(
    (left, right) => right.traffic - left.traffic,
  )
}

const INTENT_LABELS = new Set<string>([
  "informational",
  "navigational",
  "commercial",
  "transactional",
])

export type VisibilityIntentSource = {
  label: string
  probability: number
  secondary: Array<{ label: string; probability: number }>
  updatedAt: string | null
}

function mapIntent(
  entry: VisibilityIntentSource | undefined,
): VisibilityIntent | null {
  // Só a fonte dedicada alimenta esta coluna. O `main_intent` do
  // `ranked_keywords` continua vindo na resposta, mas discorda dela em 23% dos
  // casos — misturar as duas produziria uma coluna sem procedência.
  if (!entry || !INTENT_LABELS.has(entry.label)) return null
  return {
    label: entry.label as VisibilityIntentLabel,
    probability: entry.probability,
    secondary: entry.secondary,
    updatedAt: entry.updatedAt,
  }
}

function mapKeywordItem(
  item: Record<string, unknown>,
  canonicalDomain: string,
  intents: ReadonlyMap<string, VisibilityIntentSource> | null,
): VisibilityKeywordRow | null {
  const keywordData =
    item.keyword_data && typeof item.keyword_data === "object"
      ? (item.keyword_data as Record<string, unknown>)
      : null
  const keyword = keywordData ? asString(keywordData.keyword) : null
  if (!keyword) return null

  const keywordInfo =
    keywordData?.keyword_info && typeof keywordData.keyword_info === "object"
      ? (keywordData.keyword_info as Record<string, unknown>)
      : null
  const keywordProperties =
    keywordData?.keyword_properties &&
    typeof keywordData.keyword_properties === "object"
      ? (keywordData.keyword_properties as Record<string, unknown>)
      : null
  // `keyword_data.search_intent_info` continua vindo na resposta e não é lido:
  // a coluna de intenção passou a ter fonte única, a dedicada.
  const avgBacklinks =
    keywordData?.avg_backlinks_info &&
    typeof keywordData.avg_backlinks_info === "object"
      ? (keywordData.avg_backlinks_info as Record<string, unknown>)
      : null

  const ranked =
    item.ranked_serp_element && typeof item.ranked_serp_element === "object"
      ? (item.ranked_serp_element as Record<string, unknown>)
      : null
  const serpItem =
    ranked?.serp_item && typeof ranked.serp_item === "object"
      ? (ranked.serp_item as Record<string, unknown>)
      : null

  // `rank_group` é a posição, e `rank_absolute` NÃO é equivalente a ela.
  //
  // Medido em 2026-09-11 contra 100 linhas de `ai_overview_reference` de
  // `puroclean.com` — ver `23-rank-group-vs-absolute.json`:
  //
  //   rank_group     1:12  2:13  3:18  4:9  5:23 … 10:5  15:1  16:1  19:1
  //   rank_absolute  1:93  2:3   3:2   4:1  6:1
  //
  // `rank_absolute` vale **1 em 93 de 100** porque é a posição do bloco de AI
  // Overview na SERP, e esse bloco é quase sempre o primeiro elemento da
  // página. `rank_group` é a posição do site **entre as fontes que a IA
  // citou** — que é o número que o relatório de referência mostra e o que o
  // lead entende por "posição".
  //
  // O fallback abaixo é histórico e nunca disparou nesta amostra: as 100
  // linhas trazem `rank_group`. Se um dia disparar num item de AI Overview,
  // ele devolve `1` com cara de "primeira citação" — trocar quinta por
  // primeira sem nada quebrar.
  const position = asInt(serpItem?.rank_group) ?? asInt(serpItem?.rank_absolute)
  const rankChanges =
    serpItem?.rank_changes && typeof serpItem.rank_changes === "object"
      ? (serpItem.rank_changes as Record<string, unknown>)
      : null
  const serpInfo =
    keywordData?.serp_info && typeof keywordData.serp_info === "object"
      ? (keywordData.serp_info as Record<string, unknown>)
      : null
  const previous = asInt(rankChanges?.previous_rank_absolute)

  return {
    keyword,
    position: {
      value: position !== null && position >= 1 ? position : null,
      previous: previous !== null && previous >= 1 ? previous : null,
      // `serp_info.last_updated_time` é quando a DataForSEO viu esta SERP —
      // não quando nós pedimos. A distância entre as duas é o que faltava.
      updatedAt: dataForSeoTimeToIso(serpInfo?.last_updated_time),
    },
    url: mapUrl(serpItem, canonicalDomain),
    volume: {
      value: asInt(keywordInfo?.search_volume),
      updatedAt: dataForSeoTimeToIso(keywordInfo?.last_updated_time),
    },
    traffic: asFinite(serpItem?.etv),
    difficulty: mapDifficulty(keywordProperties, keywordInfo, avgBacklinks),
    intent: mapIntent(intents?.get(keyword)),
    serpFeatures: Array.isArray(serpInfo?.serp_item_types)
      ? serpInfo.serp_item_types.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [],
    itemType: readItemType(serpItem?.type),
    languageMismatch: keywordProperties?.is_another_language === true,
    // O trecho que a SERP mostrou. Em `ai_overview_reference` é a frase que a
    // visão geral de IA citou do site — o campo que o lead reconhece como
    // sendo dele. Vinha pago em toda coleta e era descartado.
    citedText: asTrimmed(serpItem?.text),
  }
}

function asTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function mapRankedKeywordsLiveResult(input: {
  domain: string
  result: RankedKeywordsLiveResult | null
  collectedAt: string
  /** Ecoados de `VISIBILITY_QUERY`, nunca repetidos como literal aqui. */
  locationLabel: string
  languageCode: string
  /** Custo real somado das chamadas da coleta. */
  costUsd?: number | null
  /** Intenção da fonte dedicada. `null` quando aquela chamada falhou. */
  intents?: ReadonlyMap<string, VisibilityIntentSource> | null
}): VisibilitySnapshot {
  const items = Array.isArray(input.result?.items) ? input.result.items : []
  const keywords = items.flatMap((item) => {
    const row = mapKeywordItem(item, input.domain, input.intents ?? null)
    return row ? [row] : []
  })
  const total = asInt(input.result?.total_count)
  return {
    version: 2,
    indexAge: mapIndexAge(keywords, input.collectedAt),
    source: "dataforseo_labs",
    domain: input.domain,
    locationLabel: input.locationLabel,
    languageCode: input.languageCode,
    collectedAt: input.collectedAt,
    searchCount: 1,
    coverage: {
      returned: keywords.length,
      total,
      truncated: total !== null && total > keywords.length,
    },
    hosts: hostsFromRows(keywords),
    costUsd: input.costUsd ?? null,
    // `items` que o mapeador não conseguiu ler. Antes o `flatMap` os descartava
    // em silêncio, e ninguém sabia que a coleta tinha vindo incompleta.
    droppedRows: items.length - keywords.length,
    metrics: mapOrganicMetrics(input.result?.metrics?.organic),
    localPack: mapTypeMetrics(input.result?.metrics?.local_pack),
    aiOverview: mapTypeMetrics(input.result?.metrics?.ai_overview_reference),
    keywords,
  }
}
