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

/**
 * Links por domínio acima disto é assinatura de link **sitewide** — poucos
 * sites linkando de todas as páginas deles. O normal fica entre 10 e 50; o
 * primeiro perfil real coletado marcou 1.904, e as regras antigas ficaram em
 * silêncio porque só sabiam reconhecer perfil fraco, não perfil concentrado.
 */
export const BACKLINKS_SITEWIDE_LINKS_PER_DOMAIN = 100

export type BacklinkSource = "dataforseo_backlinks"

export type BacklinkDistributionItem = {
  label: string
  count: number
}

/**
 * Domínio que compartilha domínios de referência com o alvo, com os números
 * dele medidos **no mesmo instante** — comparar o meu de hoje com o dele do mês
 * passado não compara nada.
 */
export type BacklinkCompetitor = {
  domain: string
  rank: number | null
  backlinks: number | null
  referringDomains: number | null
  /** Quantos domínios de referência ele tem em comum com o alvo. */
  intersections: number | null
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
  /**
   * Campos abaixo entraram depois da primeira coleta. `null` significa
   * **não coletado**, e lista vazia significa coletado e vazio — snapshot
   * anterior a eles não pode parecer um perfil sem nada.
   */
  referringPages: number | null
  referringIps: number | null
  referringSubnets: number | null
  /** Onde o link mora: artigo e conteúdo contra rodapé e sidebar. */
  linkLocations: BacklinkDistributionItem[] | null
  /** Que tipo de plataforma linka: blog, e-commerce, notícia. */
  linkPlatforms: BacklinkDistributionItem[] | null
  /** Âncora, imagem, redirect. */
  linkTypes: BacklinkDistributionItem[] | null
  /** `null` = benchmark não coletado; `[]` = coletado e sem concorrente. */
  competitors: BacklinkCompetitor[] | null
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
  | "sitewide_link_pattern"
  | "behind_on_referring_domains"

export const BACKLINK_GAP_LABELS: Record<BacklinkGapId, string> = {
  no_backlinks: "Nenhum backlink encontrado",
  few_referring_domains: "Poucos domínios de referência",
  low_authority_rank: "Autoridade de domínio baixa",
  broken_backlinks: "Backlinks apontando para páginas quebradas",
  mostly_nofollow: "Quase todos os links são nofollow",
  toxic_backlinks: "Perfil de links com sinal de spam",
  sitewide_link_pattern: "Links concentrados em poucos domínios",
  behind_on_referring_domains:
    "Menos domínios de referência que os concorrentes",
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

export function readBacklinkCompetitors(
  value: unknown,
): BacklinkCompetitor[] | null {
  if (!Array.isArray(value)) return null
  const items: BacklinkCompetitor[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const domain = asString(row.domain)
    if (!domain) continue
    items.push({
      domain,
      rank: asCount(row.rank),
      backlinks: asCount(row.backlinks),
      referringDomains: asCount(row.referringDomains),
      intersections: asCount(row.intersections),
    })
  }
  return items
}

/**
 * Mediana dos domínios de referência dos concorrentes. Mediana e não média
 * porque um único concorrente gigante distorceria a comparação inteira.
 */
export function competitorReferringDomainsMedian(
  competitors: readonly BacklinkCompetitor[],
): number | null {
  const values = competitors
    .map((item) => item.referringDomains)
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right)
  if (values.length === 0) return null
  const middle = Math.floor(values.length / 2)
  return values.length % 2 === 1
    ? (values[middle] as number)
    : ((values[middle - 1] as number) + (values[middle] as number)) / 2
}

function readOptionalDistribution(
  value: unknown,
): BacklinkDistributionItem[] | null {
  return Array.isArray(value) ? readDistribution(value) : null
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
    referringPages: asCount(row.referringPages),
    referringIps: asCount(row.referringIps),
    referringSubnets: asCount(row.referringSubnets),
    linkLocations: readOptionalDistribution(row.linkLocations),
    linkPlatforms: readOptionalDistribution(row.linkPlatforms),
    linkTypes: readOptionalDistribution(row.linkTypes),
    competitors: readBacklinkCompetitors(row.competitors),
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

export type BacklinkMetrics = {
  /** Quantos links, em média, cada domínio de referência manda. */
  linksPerDomain: number | null
  /** Fração dos backlinks que transfere autoridade. */
  dofollowShare: number | null
  /** Domínios de referência a mais que os domínios principais. */
  subdomainSpread: number | null
  /**
   * Participação do TLD e do país mais representados, sobre o total de links.
   */
  topTldShare: number | null
  topCountryShare: number | null
}

function ratio(part: number | null, whole: number | null): number | null {
  // Razão sobre campo ausente é invenção, e zero no divisor também.
  if (part === null || whole === null || whole <= 0) return null
  return part / whole
}

/**
 * As razões que a leitura precisa e o resumo não traz prontas.
 *
 * `linksPerDomain` é a mais importante: é ela que separa "muitos links de muita
 * gente" de "muitos links das mesmas poucas pessoas", e os números brutos não
 * contam essa diferença sozinhos.
 */
export function backlinkMetrics(snapshot: BacklinkSnapshot): BacklinkMetrics {
  const nofollowShare = ratio(snapshot.nofollowBacklinks, snapshot.backlinks)
  return {
    linksPerDomain: ratio(snapshot.backlinks, snapshot.referringDomains),
    dofollowShare: nofollowShare === null ? null : 1 - nofollowShare,
    subdomainSpread:
      snapshot.referringDomains === null ||
      snapshot.referringMainDomains === null
        ? null
        : snapshot.referringDomains - snapshot.referringMainDomains,
    topTldShare: ratio(snapshot.topTlds[0]?.count ?? null, snapshot.backlinks),
    topCountryShare: ratio(
      snapshot.topCountries[0]?.count ?? null,
      snapshot.backlinks,
    ),
  }
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

  // Comparação relativa: dizer "poucos domínios" no absoluto dispararia em
  // quase todo lead local. Contra o mercado dele, a afirmação tem lastro.
  const median = snapshot.competitors
    ? competitorReferringDomainsMedian(snapshot.competitors)
    : null
  if (
    median !== null &&
    snapshot.referringDomains !== null &&
    snapshot.referringDomains < median
  ) {
    gaps.push("behind_on_referring_domains")
  }

  const linksPerDomain = backlinkMetrics(snapshot).linksPerDomain
  if (
    linksPerDomain !== null &&
    linksPerDomain >= BACKLINKS_SITEWIDE_LINKS_PER_DOMAIN
  ) {
    gaps.push("sitewide_link_pattern")
  }

  return gaps
}

export function backlinkGapLabel(id: BacklinkGapId): string {
  return BACKLINK_GAP_LABELS[id]
}
