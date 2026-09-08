import {
  visibilityGapLabel,
  type VisibilityGapId,
  type VisibilitySnapshot,
  visibilityGapsForSnapshot,
} from "./visibility-audit.ts"

export type VisibilityOpportunityImpact = "high" | "medium"
export type VisibilityOpportunitySource = "machine"

export type VisibilityOpportunityItem = {
  id: string
  title: string
  impact: VisibilityOpportunityImpact
  source: VisibilityOpportunitySource
  detail?: string
}

const HIGH_IMPACT = new Set<VisibilityGapId>([
  "not_ranking",
  "brand_only_visibility",
  "no_local_top20",
])

const OPPORTUNITY_TITLES: Record<VisibilityGapId, string> = {
  brand_only_visibility: "Ranquear para keywords locais além da marca",
  no_local_top20: "Entrar no top 20 para buscas locais",
  homepage_only: "Criar páginas que ranqueiem além da home",
  not_ranking: "Construir visibilidade orgânica no Google",
  low_organic_traffic: "Aumentar o tráfego orgânico estimado",
  thin_keyword_footprint: "Ampliar o portfólio de keywords",
}

function impactFor(id: VisibilityGapId): VisibilityOpportunityImpact {
  return HIGH_IMPACT.has(id) ? "high" : "medium"
}

export function visibilityOpportunitiesFromGaps(
  gaps: VisibilityGapId[],
): VisibilityOpportunityItem[] {
  const items = gaps.map((id) => ({
    id,
    title: OPPORTUNITY_TITLES[id] ?? visibilityGapLabel(id),
    impact: impactFor(id),
    source: "machine" as const,
  }))
  items.sort((left, right) => {
    if (left.impact !== right.impact) return left.impact === "high" ? -1 : 1
    return 0
  })
  return items
}

export function mergeVisibilityOpportunities(input: {
  snapshot: VisibilitySnapshot
  companyName: string
  city: string | null
}): VisibilityOpportunityItem[] {
  return visibilityOpportunitiesFromGaps(visibilityGapsForSnapshot(input))
}
