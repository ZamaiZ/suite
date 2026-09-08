/**
 * Autoridade externa do domínio, a partir do resumo de backlinks.
 *
 * Puro e sem imports, como os vizinhos: o painel de Website é componente de
 * cliente, e um módulo que alcance `server-only` por caminho transitivo quebra
 * o build.
 *
 * Uma limitação que vale registrar em vez de esconder: `/backlinks/summary`
 * devolve **contagens e distribuições**, não a lista de domínios que apontam
 * para o site. Ver quem são exige outro endpoint, e outra chamada paga.
 */

/** Abaixo disto o perfil de links não sustenta ranking competitivo. */
export const BACKLINKS_FEW_REFERRING_DOMAINS = 10

/** O rank do DataForSEO vai de 0 a 1000. */
export const BACKLINKS_LOW_RANK = 100

/** Acima desta fração de nofollow, o volume não transfere autoridade. */
export const BACKLINKS_NOFOLLOW_RATIO = 0.7

/** Pontuação de spam de 0 a 100. */
export const BACKLINKS_HIGH_SPAM_SCORE = 40

export type BacklinkSource = "dataforseo_backlinks"

export type BacklinkDistributionItem = {
  label: string
  count: number
}

export type BacklinkSnapshot = {
  source: BacklinkSource
  domain: string
  collectedAt: string
  /** Rank de autoridade do provider, 0–1000. */
  rank: number | null
  backlinks: number | null
  referringDomains: number | null
  referringMainDomains: number | null
  referringDomainsNofollow: number | null
  nofollowBacklinks: number | null
  brokenBacklinks: number | null
  brokenPages: number | null
  spamScore: number | null
  firstSeen: string | null
  lostDate: string | null
  /** Distribuições que a mesma resposta já traz, sem chamada extra. */
  topTlds: BacklinkDistributionItem[]
  topCountries: BacklinkDistributionItem[]
}

export type LeadBacklinkAudit = {
  id: string
  lead_id: string
  domain: string
  snapshot: BacklinkSnapshot
  fetched_at: string
  fetched_by: string
}

export type BacklinkGapId =
  | "no_backlinks"
  | "few_referring_domains"
  | "low_authority_rank"
  | "broken_backlinks"
  | "mostly_nofollow"
  | "toxic_backlinks"

export const BACKLINK_GAP_LABELS: Record<BacklinkGapId, string> = {
  no_backlinks: "Nenhum backlink encontrado",
  few_referring_domains: "Poucos domínios de referência",
  low_authority_rank: "Autoridade de domínio baixa",
  broken_backlinks: "Backlinks apontando para páginas quebradas",
  mostly_nofollow: "Quase todos os links são nofollow",
  toxic_backlinks: "Perfil de links com sinal de spam",
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function asCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null
  }
  return Math.trunc(value)
}

function asScore(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function readDistribution(value: unknown): BacklinkDistributionItem[] {
  if (!Array.isArray(value)) return []
  const items: BacklinkDistributionItem[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const label = asString(row.label)
    const count = asCount(row.count)
    if (!label || count === null) continue
    items.push({ label, count })
  }
  return items
}

export function readBacklinkSnapshot(value: unknown): BacklinkSnapshot | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  if (row.source !== "dataforseo_backlinks") return null
  const domain = asString(row.domain)
  const collectedAt = asString(row.collectedAt)
  if (!domain || !collectedAt) return null
  return {
    source: "dataforseo_backlinks",
    domain,
    collectedAt,
    rank: asCount(row.rank),
    backlinks: asCount(row.backlinks),
    referringDomains: asCount(row.referringDomains),
    referringMainDomains: asCount(row.referringMainDomains),
    referringDomainsNofollow: asCount(row.referringDomainsNofollow),
    nofollowBacklinks: asCount(row.nofollowBacklinks),
    brokenBacklinks: asCount(row.brokenBacklinks),
    brokenPages: asCount(row.brokenPages),
    spamScore: asScore(row.spamScore),
    firstSeen: asString(row.firstSeen),
    lostDate: asString(row.lostDate),
    topTlds: readDistribution(row.topTlds),
    topCountries: readDistribution(row.topCountries),
  }
}

export function readLeadBacklinkAuditRow(
  row: Record<string, unknown>,
): LeadBacklinkAudit | null {
  const id = asString(row.id)
  const lead_id = asString(row.lead_id)
  const domain = asString(row.domain)
  const fetched_at = asString(row.fetched_at)
  const fetched_by = asString(row.fetched_by)
  const snapshot = readBacklinkSnapshot(row.snapshot)
  if (!id || !lead_id || !domain || !fetched_at || !fetched_by || !snapshot) {
    return null
  }
  return { id, lead_id, domain, snapshot, fetched_at, fetched_by }
}

/**
 * A tabela é append-only, então o mesmo lead traz várias coletas. Resolve a
 * mais recente comparando o timestamp, sem depender da ordem da consulta.
 */
export function readLeadBacklinkAudits(value: unknown): LeadBacklinkAudit[] {
  if (!Array.isArray(value)) return []
  let latest: LeadBacklinkAudit | null = null
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const audit = readLeadBacklinkAuditRow(item as Record<string, unknown>)
    if (!audit) continue
    if (latest && latest.fetched_at >= audit.fetched_at) continue
    latest = audit
  }
  return latest ? [latest] : []
}

/**
 * Toda regra exige que o campo tenha sido de fato coletado. Ausente não é zero:
 * tratar os dois igual inventaria gap em resposta incompleta — foi assim que
 * `no_services` passou a acusar todo perfil novo.
 */
export function backlinkGapsForSnapshot(
  snapshot: BacklinkSnapshot,
): BacklinkGapId[] {
  const gaps: BacklinkGapId[] = []

  if (snapshot.backlinks === 0) {
    // Sem link nenhum, as outras regras só repetiriam o mesmo achado.
    gaps.push("no_backlinks")
    return gaps
  }

  if (
    snapshot.referringDomains !== null &&
    snapshot.referringDomains < BACKLINKS_FEW_REFERRING_DOMAINS
  ) {
    gaps.push("few_referring_domains")
  }
  if (snapshot.rank !== null && snapshot.rank < BACKLINKS_LOW_RANK) {
    gaps.push("low_authority_rank")
  }
  if (snapshot.brokenBacklinks !== null && snapshot.brokenBacklinks > 0) {
    gaps.push("broken_backlinks")
  }
  if (
    snapshot.nofollowBacklinks !== null &&
    snapshot.backlinks !== null &&
    snapshot.backlinks > 0 &&
    snapshot.nofollowBacklinks / snapshot.backlinks >= BACKLINKS_NOFOLLOW_RATIO
  ) {
    gaps.push("mostly_nofollow")
  }
  if (
    snapshot.spamScore !== null &&
    snapshot.spamScore >= BACKLINKS_HIGH_SPAM_SCORE
  ) {
    gaps.push("toxic_backlinks")
  }

  return gaps
}

export function backlinkGapLabel(id: BacklinkGapId): string {
  return BACKLINK_GAP_LABELS[id]
}
