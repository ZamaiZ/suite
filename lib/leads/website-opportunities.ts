import {
  WEBSITE_GAP_LABELS,
  type NapCheck,
  type WebsiteCrawl,
  type WebsiteGapId,
} from "./website-audit.ts"
import {
  missingSecurityHeaders,
  SECURITY_HEADER_LABELS,
} from "./website-headers.ts"
import { PSI_PERFORMANCE_POOR } from "./website-pagespeed.ts"
import {
  WEBSITE_REVIEW_CATALOG,
  websiteReviewHasOpportunity,
  websiteReviewOpportunityId,
  type WebsiteReview,
  type WebsiteReviewCriterionId,
} from "./website-review.ts"
import { type BacklinkGapId } from "./backlinks-audit.ts"
import { type WebsiteStepTabId } from "./website-step-tabs.ts"

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
  /** Rótulos dos headers ausentes, para o detalhe de weak_security_headers. */
  missingSecurityHeaders?: string[]
  /** Componentes do NAP que divergem, para o detalhe de nap_mismatch. */
  napMismatches?: string[]
}

const NAP_COMPONENT_LABELS: Record<keyof NapCheck, string> = {
  phone: "telefone",
  address: "endereço",
}

/**
 * Só os componentes divergentes. `absent` fica de fora do detalhe da
 * oportunidade — ele é estado a exibir, não algo a corrigir no site.
 */
export function napMismatchLabels(check: NapCheck): string[] {
  return (Object.keys(NAP_COMPONENT_LABELS) as Array<keyof NapCheck>)
    .filter((key) => check[key] === "mismatch")
    .map((key) => NAP_COMPONENT_LABELS[key])
}

/**
 * Reúne os headers que faltam em qualquer página lida com sucesso. Fica aqui
 * para que os três pontos que montam oportunidades usem a mesma regra.
 */
export function missingSecurityHeaderLabels(crawl: WebsiteCrawl): string[] {
  const missing = new Set<string>()
  for (const page of crawl.pages) {
    if (page.status <= 0 || page.status >= 400) continue
    for (const key of missingSecurityHeaders(page.headers)) {
      missing.add(SECURITY_HEADER_LABELS[key])
    }
  }
  return [...missing]
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
  "canonical_external",
  "canonical_vs_noindex",
  "noindex_internal_pages",
  "robots_blocks_search",
  "no_privacy_policy",
  "redirect_loop",
  "https_canonicalization",
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
  canonical_missing: "Declarar a URL canônica das páginas",
  canonical_points_elsewhere: "Corrigir canonical apontando para outra URL",
  canonical_external: "Remover canonical para domínio externo",
  canonical_insecure: "Apontar o canonical para HTTPS",
  canonical_vs_noindex: "Resolver conflito entre canonical e noindex",
  canonical_non_indexable: "Apontar o canonical para uma URL indexável",
  host_canonicalization: "Unificar www e sem www",
  slash_canonicalization: "Unificar URLs com e sem barra final",
  weak_security_headers: "Configurar headers de segurança",
  heading_hierarchy: "Corrigir a hierarquia de títulos",
  noindex_internal_pages: "Remover noindex das páginas internas",
  robots_blocks_search: "Liberar o rastreamento no robots.txt",
  no_privacy_policy: "Publicar a política de privacidade",
  no_terms: "Publicar os termos de uso",
  redirect_chain: "Encurtar os redirects para um salto",
  temporary_redirect: "Trocar redirect temporário por permanente",
  redirect_loop: "Quebrar o laço de redirect",
  https_canonicalization: "Redirecionar HTTP para HTTPS",
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
  const missing = context.missingSecurityHeaders ?? []
  const napMismatches = context.napMismatches ?? []
  const items = gaps.map((id) => ({
    id,
    title: OPPORTUNITY_TITLES[id] ?? WEBSITE_GAP_LABELS[id],
    impact: impactFor(id, context),
    source: "machine" as const,
    ...(id === "weak_security_headers" && missing.length > 0
      ? { detail: `Ausentes: ${missing.join(", ")}` }
      : {}),
    ...(id === "nap_mismatch" && napMismatches.length > 0
      ? { detail: `Divergentes: ${napMismatches.join(", ")}` }
      : {}),
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

/**
 * Contadores das abas, grupos da coluna e total do rail saem da mesma lista. A
 * garantia de que não divergem é de tipo, não de teste: `Record` sobre as três
 * uniões inteiras faz o `tsc` recusar a compilação quando um id novo entra sem
 * tema — mais barato e mais confiável que um teste, num runner que não resolve
 * o alias `@/`.
 *
 * A regra do corte não é "quem produz o gap". `websitePagespeedGaps` também
 * levanta `mixed_content` e `noindex`, e os dois ficam em Auditoria: não são
 * métricas do PageSpeed, são fatos binários com item de check próprio, e
 * `noindex` ainda tem segunda fonte no crawl. Temar por origem faria a mesma
 * checagem mudar de aba conforme qual coleta chegasse primeiro.
 */
export const WEBSITE_OPPORTUNITY_THEME: Record<
  WebsiteGapId | BacklinkGapId | `review:${WebsiteReviewCriterionId}`,
  WebsiteStepTabId
> = {
  // PageSpeed — as quatro métricas que a aba mede em profundidade.
  slow_performance: "pagespeed",
  poor_cwv: "pagespeed",
  not_responsive: "pagespeed",
  a11y_issues: "pagespeed",

  // Auditoria — estrutura técnica.
  no_https: "auditoria",
  mixed_content: "auditoria",
  noindex: "auditoria",
  noindex_internal_pages: "auditoria",
  robots_blocks_search: "auditoria",
  missing_sitemap: "auditoria",
  sitemap_bloat: "auditoria",
  weak_security_headers: "auditoria",
  canonical_missing: "auditoria",
  canonical_points_elsewhere: "auditoria",
  canonical_external: "auditoria",
  canonical_insecure: "auditoria",
  canonical_vs_noindex: "auditoria",
  canonical_non_indexable: "auditoria",
  host_canonicalization: "auditoria",
  slash_canonicalization: "auditoria",
  https_canonicalization: "auditoria",
  redirect_chain: "auditoria",
  temporary_redirect: "auditoria",
  redirect_loop: "auditoria",
  few_pages: "auditoria",
  unfriendly_urls: "auditoria",

  // Auditoria — SEO on-page.
  generic_title: "auditoria",
  missing_meta_description: "auditoria",
  missing_h1: "auditoria",
  duplicate_h1: "auditoria",
  heading_hierarchy: "auditoria",
  thin_content: "auditoria",
  images_missing_alt: "auditoria",
  no_internal_links: "auditoria",
  no_schema: "auditoria",
  no_local_schema: "auditoria",
  no_service_pages: "auditoria",
  no_blog: "auditoria",

  // Auditoria — conversão e UX.
  weak_cta: "auditoria",
  contact_only_in_footer: "auditoria",
  nap_mismatch: "auditoria",
  no_privacy_policy: "auditoria",
  no_terms: "auditoria",

  // Autoridade externa — o catálogo inteiro de backlinks.
  no_backlinks: "autoridade",
  few_referring_domains: "autoridade",
  low_authority_rank: "autoridade",
  broken_backlinks: "autoridade",
  mostly_nofollow: "autoridade",
  toxic_backlinks: "autoridade",
  sitewide_link_pattern: "autoridade",
  behind_on_referring_domains: "autoridade",
  link_scheme_detected: "autoridade",

  // Validação visual — o julgamento do analista.
  "review:design": "validacao",
  "review:cta_visible": "validacao",
  "review:narrow_layout": "validacao",
  "review:sample_pages": "validacao",
  "review:nap_group": "validacao",
  "review:content_quality": "validacao",
  "review:other": "validacao",
}

const EMPTY_BY_THEME = (): Record<
  WebsiteStepTabId,
  WebsiteOpportunityItem[]
> => ({
  auditoria: [],
  pagespeed: [],
  validacao: [],
  autoridade: [],
})

export function websiteOpportunityTheme(id: string): WebsiteStepTabId {
  // Id fora do mapa só existe se alguém montar um item à mão; cair em
  // "auditoria" mantém o item visível em vez de sumir do agrupamento.
  return (
    WEBSITE_OPPORTUNITY_THEME[id as keyof typeof WEBSITE_OPPORTUNITY_THEME] ??
    "auditoria"
  )
}

/**
 * Reduce sobre a lista recebida: a soma dos grupos é a lista, por construção.
 * Nenhum item pode sumir entre o contador da aba e o grupo da coluna.
 */
export function websiteOpportunitiesByTheme(
  items: ReadonlyArray<WebsiteOpportunityItem>,
): Record<WebsiteStepTabId, WebsiteOpportunityItem[]> {
  return items.reduce((acc, item) => {
    acc[websiteOpportunityTheme(item.id)].push(item)
    return acc
  }, EMPTY_BY_THEME())
}
