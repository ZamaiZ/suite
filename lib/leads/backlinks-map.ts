import {
  BACKLINK_ANCHOR_CLUSTER_MIN,
  BACKLINK_IP_CLUSTER_MIN,
  BACKLINK_IP_CLUSTER_SHARE,
  BACKLINK_LINK_SPAM_SCORE,
  BACKLINK_SCHEME_SAMPLES,
  type BacklinkAnchorCluster,
  type BacklinkCompetitor,
  type BacklinkDistributionItem,
  type BacklinkScheme,
  type BacklinkSchemeDomain,
  type BacklinkSnapshot,
} from "./backlinks-audit.ts"

/**
 * Leitura do resultado de `/backlinks/summary/live`.
 *
 * Separado do cliente pelo mesmo motivo que `visibility-labs-map.ts` é separado
 * de `ranked-keywords.ts`: o cliente importa `server-only`, e isso tornaria o
 * mapeamento impossível de carregar fora do servidor.
 *
 * **Escrito contra a documentação, nunca contra resposta real** — como todos os
 * outros mapeadores desta migração. Por isso cada campo é opcional e ausente
 * vira `null`, nunca zero: campo que não veio não é campo que veio vazio, e
 * confundir os dois inventa gap.
 */

/** Quantas faixas de cada distribuição valem exibir. */
export const BACKLINK_DISTRIBUTION_MAX = 5

export type BacklinkSummaryResult = Record<string, unknown>

function asCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null
  }
  return Math.trunc(value)
}

function asScore(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

/**
 * As distribuições vêm como objeto `{ chave: contagem }`. Vira lista ordenada
 * por contagem para a tela não depender da ordem que o provider escolheu.
 */
function mapDistribution(value: unknown): BacklinkDistributionItem[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return []
  const items: BacklinkDistributionItem[] = []
  for (const [label, raw] of Object.entries(value as Record<string, unknown>)) {
    const count = asCount(raw)
    const trimmed = label.trim()
    if (!trimmed || count === null || count === 0) continue
    items.push({ label: trimmed, count })
  }
  items.sort((left, right) => right.count - left.count)
  return items.slice(0, BACKLINK_DISTRIBUTION_MAX)
}

/** Ausente vira `null`, não lista vazia: "não veio" não é "veio sem nada". */
function optionalDistribution(
  value: unknown,
): BacklinkDistributionItem[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return mapDistribution(value)
}

function nofollowFromAttributes(value: unknown): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return asCount((value as Record<string, unknown>).nofollow)
}

export type BacklinkCompetitorsResult = {
  items?: unknown
}

/**
 * `/backlinks/competitors/live` — quem compartilha domínios de referência com o
 * alvo, com os números de cada um. **Escrito contra documentação**, como todos
 * os outros: campo ausente vira `null`, e a primeira coleta é que valida.
 */
export function mapBacklinkCompetitors(
  result: BacklinkCompetitorsResult | null,
): BacklinkCompetitor[] {
  const items = Array.isArray(result?.items) ? result.items : []
  const mapped: BacklinkCompetitor[] = []
  for (const item of items) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const domain = asString(row.domain) ?? asString(row.target)
    if (!domain) continue
    mapped.push({
      domain,
      rank: asCount(row.rank),
      backlinks: asCount(row.backlinks),
      referringDomains: asCount(row.referring_domains),
      intersections: asCount(row.intersections),
    })
  }
  return mapped
}

export function mapBacklinkSummaryResult(input: {
  domain: string
  result: BacklinkSummaryResult | null
  collectedAt: string
}): BacklinkSnapshot {
  const row = input.result ?? {}
  return {
    source: "dataforseo_backlinks",
    domain: input.domain,
    collectedAt: input.collectedAt,
    rank: asCount(row.rank),
    backlinks: asCount(row.backlinks),
    referringDomains: asCount(row.referring_domains),
    referringMainDomains: asCount(row.referring_main_domains),
    referringDomainsNofollow: asCount(row.referring_domains_nofollow),
    nofollowBacklinks: nofollowFromAttributes(row.referring_links_attributes),
    brokenBacklinks: asCount(row.broken_backlinks),
    brokenPages: asCount(row.broken_pages),
    spamScore: asScore(row.backlinks_spam_score),
    firstSeen: asString(row.first_seen),
    lostDate: asString(row.lost_date),
    topTlds: mapDistribution(row.referring_links_tld),
    topCountries: mapDistribution(row.referring_links_countries),
    referringPages: asCount(row.referring_pages),
    referringIps: asCount(row.referring_ips),
    referringSubnets: asCount(row.referring_subnets),
    // A resposta traz a família `referring_links_*` inteira e a primeira
    // versão guardava só duas. `semantic_locations` é a que explica volume
    // concentrado: diz se o link mora no artigo ou no rodapé.
    linkLocations: optionalDistribution(row.referring_links_semantic_locations),
    linkPlatforms: optionalDistribution(row.referring_links_platform_types),
    linkTypes: optionalDistribution(row.referring_links_types),
    // Preenchidos pelo chamador depois das outras chamadas; `null` enquanto
    // não vierem.
    competitors: null,
    scheme: null,
  }
}

export type BacklinkSchemeResult = {
  total_count?: unknown
  items_count?: unknown
  items?: unknown
}

/**
 * Lê a amostra de domínios de referência e devolve os três sinais de rede.
 *
 * Nenhum deles julga: contam repetição, concentração e a pontuação que o
 * próprio provider já atribuiu. Não há lista de palavras nem classificação de
 * assunto — regra dessas envelhece e acusa site inocente, e o analista é quem
 * abre a página e decide.
 */
export function mapBacklinkScheme(
  result: BacklinkSchemeResult | null,
  limit: number,
): BacklinkScheme {
  const items = Array.isArray(result?.items) ? result.items : []
  // `one_per_domain` já devolve uma linha por domínio. O mapa é a garantia de
  // que uma resposta fora desse modo não conte o mesmo domínio duas vezes e
  // infle todos os três sinais de uma vez.
  const byDomain = new Map<string, Record<string, unknown>>()
  for (const item of items) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const domain = asString(row.domain_from)
    if (!domain || byDomain.has(domain)) continue
    byDomain.set(domain, row)
  }

  const spammy: BacklinkSchemeDomain[] = []
  const anchors = new Map<string, { anchor: string; domains: Set<string> }>()
  const ips = new Map<string, Set<string>>()

  for (const [domain, row] of byDomain) {
    const spamScore = asScore(row.backlink_spam_score)
    const anchor = asString(row.anchor)
    if (spamScore !== null && spamScore >= BACKLINK_LINK_SPAM_SCORE) {
      spammy.push({
        domain,
        url: asString(row.url_from),
        spamScore,
        anchor,
      })
    }
    if (anchor) {
      // Agrupa sem diferenciar caixa: a mesma frase colada em vinte sites
      // costuma variar só na maiúscula.
      const key = anchor.toLowerCase()
      const current = anchors.get(key)
      if (current) current.domains.add(domain)
      else anchors.set(key, { anchor, domains: new Set([domain]) })
    }
    const ip = asString(row.domain_from_ip)
    if (ip) {
      const current = ips.get(ip)
      if (current) current.add(domain)
      else ips.set(ip, new Set([domain]))
    }
  }

  const sampled = byDomain.size
  const ipFloor = Math.max(
    BACKLINK_IP_CLUSTER_MIN,
    Math.ceil(sampled * BACKLINK_IP_CLUSTER_SHARE),
  )

  return {
    sampled,
    total: asCount(result?.total_count),
    // A amostra bateu no teto: daqui em diante o silêncio é sobre o que ficou
    // de fora, e não afirmação de que não existe.
    truncated: sampled >= limit,
    spammyDomains: spammy.length,
    spammySamples: spammy
      .sort((left, right) => (right.spamScore ?? 0) - (left.spamScore ?? 0))
      .slice(0, BACKLINK_SCHEME_SAMPLES),
    anchorClusters: [...anchors.values()]
      .filter((entry) => entry.domains.size >= BACKLINK_ANCHOR_CLUSTER_MIN)
      .map((entry) => ({ anchor: entry.anchor, domains: entry.domains.size }))
      .sort((left, right) => right.domains - left.domains)
      .slice(0, BACKLINK_SCHEME_SAMPLES),
    ipClusters: [...ips.entries()]
      .map(([ip, domains]) => ({ ip, domains: domains.size }))
      .filter((entry) => entry.domains >= ipFloor)
      .sort((left, right) => right.domains - left.domains)
      .slice(0, BACKLINK_SCHEME_SAMPLES),
  }
}
