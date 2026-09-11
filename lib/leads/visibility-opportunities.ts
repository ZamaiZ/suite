import {
  visibilityGapLabel,
  type VisibilityGapId,
  type VisibilitySnapshot,
  visibilityGapsForSnapshot,
} from "./visibility-audit.ts"
import {
  visibilityReviewHasOpportunity,
  visibilityReviewOpportunityId,
  VISIBILITY_REVIEW_CATALOG,
  type VisibilityReview,
} from "./visibility-review.ts"
import type { VisibilityStepTabId } from "./visibility-step-tabs.ts"

export type VisibilityOpportunityImpact = "high" | "medium"
export type VisibilityOpportunitySource = "machine" | "analyst"

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
  "non_canonical_host_traffic",
])

const OPPORTUNITY_TITLES: Record<VisibilityGapId, string> = {
  brand_only_visibility: "Ranquear para keywords locais além da marca",
  no_local_top20: "Entrar no top 20 para buscas locais",
  homepage_only: "Criar páginas que ranqueiem além da home",
  not_ranking: "Construir visibilidade orgânica no Google",
  low_organic_traffic: "Aumentar o tráfego orgânico estimado",
  thin_keyword_footprint: "Ampliar o portfólio de keywords",
  non_canonical_host_traffic: "Consolidar o tráfego no domínio principal",
}

/**
 * O que a linha da coluna diz embaixo do título.
 *
 * Veio do `gapDetail` do presenter, que morreu junto com o card de checks: o
 * texto continua certo, e a coluna de oportunidades renderiza `item.detail` —
 * que até agora nenhum item de máquina preenchia.
 */
const OPPORTUNITY_DETAILS: Record<VisibilityGapId, string> = {
  brand_only_visibility: "No top 10 só aparecem termos de marca",
  no_local_top20: "Nenhuma busca local relevante no top 20",
  homepage_only: "As URLs ranqueadas apontam só para a home",
  not_ranking: "Nenhuma posição orgânica encontrada",
  low_organic_traffic: "Tráfego estimado abaixo do limiar comercial",
  thin_keyword_footprint: "Poucas keywords no índice do domínio",
  non_canonical_host_traffic: "Parte das páginas ranqueadas está em outro host",
}

/**
 * Tema de cada gap. O `Record` sobre a união inteira é o portão: gap novo sem
 * tema **não compila**, e foi por falta desse portão que a trilha e a lista da
 * tela já divergiram uma vez no GBP.
 */
const GAP_THEME: Record<VisibilityGapId, VisibilityStepTabId> = {
  not_ranking: "panorama",
  thin_keyword_footprint: "panorama",
  low_organic_traffic: "panorama",
  brand_only_visibility: "keywords",
  no_local_top20: "keywords",
  homepage_only: "paginas",
  non_canonical_host_traffic: "paginas",
}

/** `review:<id>` é do analista e mora sempre na aba de validação. */
export function visibilityOpportunityTheme(id: string): VisibilityStepTabId {
  if (id.startsWith("review:")) return "validacao"
  return GAP_THEME[id as VisibilityGapId] ?? "panorama"
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
    detail: OPPORTUNITY_DETAILS[id],
  }))
  items.sort((left, right) => {
    if (left.impact !== right.impact) return left.impact === "high" ? -1 : 1
    return 0
  })
  return items
}

/**
 * Os achados do analista. **Campo em branco não gera gap** — a etapa não acusa
 * quem ainda não julgou —, e a nota vira o detalhe da linha.
 */
export function visibilityReviewOpportunities(
  review: VisibilityReview,
): VisibilityOpportunityItem[] {
  const items: VisibilityOpportunityItem[] = []
  for (const criterion of VISIBILITY_REVIEW_CATALOG) {
    const answer = review[criterion.id]
    if (!visibilityReviewHasOpportunity(criterion, answer)) continue
    items.push({
      id: visibilityReviewOpportunityId(criterion.id),
      title: criterion.title,
      impact: criterion.impact,
      source: "analyst",
      detail: answer.note.trim() || undefined,
    })
  }
  return items
}

function emptyByTheme(): Record<
  VisibilityStepTabId,
  VisibilityOpportunityItem[]
> {
  return { panorama: [], keywords: [], paginas: [], validacao: [] }
}

export function visibilityOpportunitiesByTheme(
  items: ReadonlyArray<VisibilityOpportunityItem>,
): Record<VisibilityStepTabId, VisibilityOpportunityItem[]> {
  return items.reduce((acc, item) => {
    acc[visibilityOpportunityTheme(item.id)].push(item)
    return acc
  }, emptyByTheme())
}

export function mergeVisibilityOpportunities(input: {
  snapshot: VisibilitySnapshot
  companyName: string
  city: string | null
  /** Ausente enquanto a etapa não tiver julgamento carregado. */
  review?: VisibilityReview
}): VisibilityOpportunityItem[] {
  const machine = visibilityOpportunitiesFromGaps(
    visibilityGapsForSnapshot(input),
  )
  const analyst = input.review
    ? visibilityReviewOpportunities(input.review)
    : []
  // Máquina primeiro dentro de cada faixa de impacto: o achado medido sustenta
  // a conversa, e o do analista qualifica.
  return [...machine, ...analyst].sort((left, right) => {
    if (left.impact !== right.impact) return left.impact === "high" ? -1 : 1
    if (left.source !== right.source) return left.source === "machine" ? -1 : 1
    return 0
  })
}
