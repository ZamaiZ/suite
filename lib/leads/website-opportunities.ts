import {
  WEBSITE_GAP_LABELS,
  type WebsiteGapId,
} from "./website-audit.ts"
import { PSI_PERFORMANCE_POOR } from "./website-pagespeed.ts"
import {
  WEBSITE_REVIEW_CATALOG,
  websiteReviewHasOpportunity,
  websiteReviewOpportunityId,
  type WebsiteReview,
} from "./website-review.ts"

export type WebsiteOpportunityImpact = "high" | "medium"
export type WebsiteOpportunitySource = "machine" | "analyst"

export type WebsiteOpportunityItem = {
  id: string
  title: string
  impact: WebsiteOpportunityImpact
  source: WebsiteOpportunitySource
  detail?: string
}

export type WebsiteOpportunityContext = {
  minPerformance?: number | null
}

const HIGH_IMPACT = new Set<WebsiteGapId>([
  "no_https",
  "missing_sitemap",
  "sitemap_bloat",
  "few_pages",
  "no_service_pages",
  "missing_h1",
  "thin_content",
  "images_missing_alt",
  "no_local_schema",
  "no_schema",
  "weak_cta",
  "poor_cwv",
  "a11y_issues",
  "mixed_content",
  "noindex",
])

const OPPORTUNITY_TITLES: Partial<Record<WebsiteGapId, string>> = {
  no_https: "Ativar HTTPS em todo o site",
  missing_sitemap: "Criar e enviar o sitemap.xml",
  sitemap_bloat: "Limpar URLs inválidas do sitemap",
  few_pages: "Criar páginas estratégicas",
  unfriendly_urls: "Simplificar as URLs",
  no_service_pages: "Criar páginas de serviços",
  no_blog: "Publicar conteúdo no site",
  generic_title: "Otimizar as title tags",
  missing_meta_description: "Escrever meta descriptions",
  missing_h1: "Incluir um H1 em cada página",
  duplicate_h1: "Corrigir H1 duplicado",
  thin_content: "Ampliar o conteúdo das páginas",
  images_missing_alt: "Adicionar alt text nas imagens",
  no_internal_links: "Ligar as páginas entre si",
  no_schema: "Implementar schema markup",
  no_local_schema: "Adicionar schema de negócio local",
  weak_cta: "Destacar um CTA claro",
  contact_only_in_footer: "Exibir o contato acima da dobra",
  nap_mismatch: "Alinhar telefone e endereço com o Google",
  slow_performance: "Melhorar a velocidade do site",
  poor_cwv: "Corrigir Core Web Vitals",
  not_responsive: "Ajustar o viewport mobile",
  a11y_issues: "Corrigir contraste e acessibilidade",
  mixed_content: "Servir todos os recursos em HTTPS",
  noindex: "Remover noindex da página inicial",
}

function impactFor(
  id: WebsiteGapId,
  context: WebsiteOpportunityContext,
): WebsiteOpportunityImpact {
  if (id === "slow_performance") {
    const score = context.minPerformance
    if (score != null && score < PSI_PERFORMANCE_POOR) return "high"
    return "medium"
  }
  return HIGH_IMPACT.has(id) ? "high" : "medium"
}

export function websiteOpportunitiesFromGaps(
  gaps: WebsiteGapId[],
  context: WebsiteOpportunityContext = {},
): WebsiteOpportunityItem[] {
  const items = gaps.map((id) => ({
    id,
    title: OPPORTUNITY_TITLES[id] ?? WEBSITE_GAP_LABELS[id],
    impact: impactFor(id, context),
    source: "machine" as const,
  }))
  items.sort((left, right) => {
    if (left.impact !== right.impact) return left.impact === "high" ? -1 : 1
    return 0
  })
  return items
}

export function websiteOpportunitiesFromReview(
  review: WebsiteReview,
): WebsiteOpportunityItem[] {
  const items: WebsiteOpportunityItem[] = []
  for (const criterion of WEBSITE_REVIEW_CATALOG) {
    const answer = review[criterion.id]
    if (!websiteReviewHasOpportunity(criterion, answer)) continue
    items.push({
      id: websiteReviewOpportunityId(criterion.id),
      title: criterion.title,
      impact: criterion.impact,
      source: "analyst",
      ...(answer.note.trim() ? { detail: answer.note } : {}),
    })
  }
  return items
}

export function mergeWebsiteOpportunities(
  gaps: WebsiteGapId[],
  context: WebsiteOpportunityContext,
  review: WebsiteReview,
): WebsiteOpportunityItem[] {
  const items = [
    ...websiteOpportunitiesFromGaps(gaps, context),
    ...websiteOpportunitiesFromReview(review),
  ]
  items.sort((left, right) => {
    if (left.impact !== right.impact) return left.impact === "high" ? -1 : 1
    if (left.source !== right.source) {
      return left.source === "machine" ? -1 : 1
    }
    return 0
  })
  return items
}
