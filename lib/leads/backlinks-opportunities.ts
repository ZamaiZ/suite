import {
  backlinkGapLabel,
  backlinkMetrics,
  competitorReferringDomainsMedian,
  type BacklinkGapId,
  type BacklinkSnapshot,
  backlinkGapsForSnapshot,
} from "./backlinks-audit.ts"

/**
 * Oportunidades de autoridade externa.
 *
 * Catálogo próprio em vez de entrar em `WEBSITE_GAP_IDS`: aquele enum descreve
 * o crawl, e `websiteGapsForAudit` nem recebe backlinks. A junção acontece no
 * nível do pilar, do mesmo jeito que a revisão do analista já se junta às
 * oportunidades de máquina.
 */
export type BacklinkOpportunityImpact = "high" | "medium"
export type BacklinkOpportunitySource = "machine"

export type BacklinkOpportunityItem = {
  id: string
  title: string
  impact: BacklinkOpportunityImpact
  source: BacklinkOpportunitySource
  detail?: string
}

const HIGH_IMPACT = new Set<BacklinkGapId>([
  "no_backlinks",
  "few_referring_domains",
  "toxic_backlinks",
  // Ficar atrás do mercado é o achado mais acionável do conjunto, e o único
  // com um número de destino.
  "behind_on_referring_domains",
])

const OPPORTUNITY_TITLES: Record<BacklinkGapId, string> = {
  no_backlinks: "Construir os primeiros backlinks",
  few_referring_domains: "Ampliar os domínios que apontam para o site",
  low_authority_rank: "Elevar a autoridade do domínio",
  broken_backlinks: "Recuperar os backlinks que apontam para erro",
  mostly_nofollow: "Conquistar links que transferem autoridade",
  toxic_backlinks: "Limpar o perfil de links suspeitos",
  sitewide_link_pattern: "Conquistar links de domínios novos",
  behind_on_referring_domains: "Alcançar o volume de domínios do mercado",
}

function impactFor(id: BacklinkGapId): BacklinkOpportunityImpact {
  return HIGH_IMPACT.has(id) ? "high" : "medium"
}

/**
 * O detalhe carrega o número que originou o gap. Sem ele a oportunidade diz o
 * que fazer e não diz de onde saiu.
 */
function detailFor(
  id: BacklinkGapId,
  snapshot: BacklinkSnapshot,
): string | undefined {
  const count = (value: number) => value.toLocaleString("pt-BR")
  if (id === "few_referring_domains" && snapshot.referringDomains !== null) {
    return `${count(snapshot.referringDomains)} domínios de referência`
  }
  if (id === "low_authority_rank" && snapshot.rank !== null) {
    return `Rank ${count(snapshot.rank)} de 1000`
  }
  if (id === "broken_backlinks" && snapshot.brokenBacklinks !== null) {
    return `${count(snapshot.brokenBacklinks)} backlinks quebrados`
  }
  if (
    id === "mostly_nofollow" &&
    snapshot.nofollowBacklinks !== null &&
    snapshot.backlinks
  ) {
    const share = Math.round(
      (snapshot.nofollowBacklinks / snapshot.backlinks) * 100,
    )
    return `${share}% dos backlinks são nofollow`
  }
  if (id === "toxic_backlinks" && snapshot.spamScore !== null) {
    return `Spam score ${count(Math.round(snapshot.spamScore))} de 100`
  }
  if (id === "behind_on_referring_domains" && snapshot.competitors) {
    const median = competitorReferringDomainsMedian(snapshot.competitors)
    if (median !== null && snapshot.referringDomains !== null) {
      return (
        `${count(snapshot.referringDomains)} domínios;` +
        ` mediana dos concorrentes: ${count(Math.round(median))}`
      )
    }
  }
  if (id === "sitewide_link_pattern") {
    const perDomain = backlinkMetrics(snapshot).linksPerDomain
    // O número é a explicação: sem ele, "conquistar domínios novos" não diz
    // por que o volume atual não conta.
    if (perDomain !== null) {
      return `${count(Math.round(perDomain))} links por domínio`
    }
  }
  return undefined
}

export function backlinkOpportunitiesFromSnapshot(
  snapshot: BacklinkSnapshot | null,
): BacklinkOpportunityItem[] {
  if (!snapshot) return []
  const items = backlinkGapsForSnapshot(snapshot).map((id) => {
    const detail = detailFor(id, snapshot)
    return {
      id,
      title: OPPORTUNITY_TITLES[id] ?? backlinkGapLabel(id),
      impact: impactFor(id),
      source: "machine" as const,
      ...(detail ? { detail } : {}),
    }
  })
  items.sort((left, right) => {
    if (left.impact !== right.impact) return left.impact === "high" ? -1 : 1
    return 0
  })
  return items
}
