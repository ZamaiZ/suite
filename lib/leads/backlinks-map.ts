import type {
  BacklinkCitation,
  BacklinkCompetitor,
  BacklinkDistributionItem,
  BacklinkSnapshot,
} from "./backlinks-audit.ts"
import { gbpDirectoryForDomain } from "./gbp-analyst-review.ts"

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
    citations: null,
  }
}

export type BacklinkCitationsResult = {
  items?: unknown
}

/**
 * Lê os backlinks vindos dos diretórios do catálogo.
 *
 * Um diretório pode linkar de várias páginas; só a primeira interessa, porque a
 * pergunta é "existe cadastro", não "quantos links". Dofollow ganha da
 * alternativa quando houver as duas, por ser o link de cadastro mais provável.
 */
export function mapBacklinkCitations(
  result: BacklinkCitationsResult | null,
): BacklinkCitation[] {
  const items = Array.isArray(result?.items) ? result.items : []
  const byDirectory = new Map<string, BacklinkCitation>()
  for (const item of items) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const domain = asString(row.domain_from)
    if (!domain) continue
    const directoryId = gbpDirectoryForDomain(domain)
    if (!directoryId) continue
    const dofollow = typeof row.dofollow === "boolean" ? row.dofollow : null
    const current = byDirectory.get(directoryId)
    if (current && !(dofollow === true && current.dofollow !== true)) continue
    byDirectory.set(directoryId, {
      directoryId,
      domain,
      url: asString(row.url_from),
      dofollow,
      firstSeen: asString(row.first_seen),
    })
  }
  return [...byDirectory.values()]
}
