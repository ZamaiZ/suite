import type {
  BacklinkDistributionItem,
  BacklinkSnapshot,
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

function nofollowFromAttributes(value: unknown): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return asCount((value as Record<string, unknown>).nofollow)
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
  }
}
