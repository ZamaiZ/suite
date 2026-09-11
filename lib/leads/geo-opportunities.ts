import {
  geoGapLabel,
  geoGapsForSnapshot,
  type GeoGapId,
  type GeoSnapshot,
} from "./geo-audit.ts"
import { GEO_REVIEW_CATALOG, type GeoReview } from "./geo-review.ts"
import type { GeoStepTabId } from "./geo-step-tabs.ts"

export type GeoOpportunityImpact = "high" | "medium"
export type GeoOpportunitySource = "machine" | "analyst"

export type GeoOpportunityItem = {
  id: string
  title: string
  impact: GeoOpportunityImpact
  source: GeoOpportunitySource
  detail?: string
}

const HIGH_IMPACT = new Set<GeoGapId>([
  "ai_crawlers_blocked",
  "content_requires_js",
  "no_ai_overview_presence",
  "brand_unknown_to_llms",
  "absent_from_discovery_prompts",
])

const OPPORTUNITY_TITLES: Record<GeoGapId, string> = {
  ai_crawlers_blocked: "Liberar os robôs de IA no robots.txt",
  content_requires_js: "Entregar o conteúdo principal já no HTML",
  no_ai_overview_presence: "Conquistar citação na visão geral de IA",
  no_llms_txt: "Publicar um llms.txt",
  no_faq_content: "Criar conteúdo em pergunta e resposta",
  no_identity_schema: "Declarar a empresa em schema de identidade",
  no_freshness_signals: "Marcar data de publicação e atualização",
  no_machine_readable_contact: "Expor contato em formato legível por máquina",
  no_authority_citations: "Conquistar citação em fontes que a IA consulta",
  brand_unknown_to_llms: "Construir reconhecimento de marca nas IAs",
  absent_from_discovery_prompts: "Aparecer nas recomendações das IAs",
  outranked_by_competitors: "Passar os concorrentes nas respostas de IA",
}

function impactFor(id: GeoGapId): GeoOpportunityImpact {
  return HIGH_IMPACT.has(id) ? "high" : "medium"
}

export function geoOpportunitiesFromGaps(
  gaps: GeoGapId[],
): GeoOpportunityItem[] {
  return gaps.map((id) => ({
    id,
    title: OPPORTUNITY_TITLES[id] ?? geoGapLabel(id),
    impact: impactFor(id),
    source: "machine" as const,
  }))
}

/**
 * Só `issue` vira oportunidade.
 *
 * `ok`, `na` e **veredito em branco** não geram nada: ausência de resposta do
 * analista não é ausência de problema, e inventar gap a partir de campo vazio
 * é o erro que a onda 5 evitou por escrito.
 */
export function geoOpportunitiesFromReview(
  review: GeoReview,
): GeoOpportunityItem[] {
  const items: GeoOpportunityItem[] = []
  for (const criterion of GEO_REVIEW_CATALOG) {
    if (!criterion.hasVerdict) continue
    const answer = review[criterion.id]
    if (answer?.verdict !== "issue") continue
    items.push({
      id: `analyst:${criterion.id}`,
      title: criterion.title,
      impact: criterion.impact,
      source: "analyst",
      detail: answer.note.trim() || undefined,
    })
  }
  return items
}

export function mergeGeoOpportunities(input: {
  snapshot: GeoSnapshot
  review: GeoReview
}): GeoOpportunityItem[] {
  const items = [
    ...geoOpportunitiesFromGaps(
      geoGapsForSnapshot({ snapshot: input.snapshot }),
    ),
    ...geoOpportunitiesFromReview(input.review),
  ]
  items.sort((left, right) => {
    if (left.impact !== right.impact) return left.impact === "high" ? -1 : 1
    return 0
  })
  return items
}

/**
 * Aba e tema são o mesmo eixo: o contador da aba é a contagem do grupo da
 * coluna. Traduzir de um para o outro no meio do caminho foi por onde a trilha
 * e a lista da tela já divergiram uma vez no GBP.
 */
const THEME_BY_GAP: Record<GeoGapId, GeoStepTabId> = {
  ai_crawlers_blocked: "acesso",
  content_requires_js: "acesso",
  no_llms_txt: "acesso",
  no_identity_schema: "conteudo",
  no_faq_content: "conteudo",
  no_freshness_signals: "conteudo",
  no_machine_readable_contact: "conteudo",
  no_ai_overview_presence: "citacoes",
  no_authority_citations: "citacoes",
  brand_unknown_to_llms: "sondagem",
  absent_from_discovery_prompts: "sondagem",
  outranked_by_competitors: "sondagem",
}

function emptyByTheme(): Record<GeoStepTabId, GeoOpportunityItem[]> {
  return { acesso: [], conteudo: [], citacoes: [], sondagem: [] }
}

/** Os três critérios do analista são todos sobre conteúdo para LLM. */
function themeFor(id: string): GeoStepTabId {
  if (id.startsWith("analyst:")) return "conteudo"
  return THEME_BY_GAP[id as GeoGapId] ?? "acesso"
}

export function geoOpportunitiesByTheme(
  items: ReadonlyArray<GeoOpportunityItem>,
): Record<GeoStepTabId, GeoOpportunityItem[]> {
  return items.reduce((acc, item) => {
    acc[themeFor(item.id)].push(item)
    return acc
  }, emptyByTheme())
}
