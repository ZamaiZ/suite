import {
  WEBSITE_GAP_LABELS,
  type WebsiteGapId,
} from "./website-audit.ts"

export type WebsiteOpportunityImpact = "high" | "medium"

export type WebsiteOpportunityItem = {
  id: WebsiteGapId
  title: string
  impact: WebsiteOpportunityImpact
}

const HIGH_IMPACT = new Set<WebsiteGapId>([
  "no_https",
  "sitemap_bloat",
  "missing_meta_description",
  "missing_h1",
  "thin_content",
  "no_local_schema",
  "no_schema",
  "weak_cta",
  "nap_mismatch",
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
}

export function websiteOpportunitiesFromGaps(
  gaps: WebsiteGapId[],
): WebsiteOpportunityItem[] {
  const items = gaps.map((id) => ({
    id,
    title: OPPORTUNITY_TITLES[id] ?? WEBSITE_GAP_LABELS[id],
    impact: HIGH_IMPACT.has(id)
      ? ("high" as const)
      : ("medium" as const),
  }))
  items.sort((left, right) => {
    if (left.impact !== right.impact) return left.impact === "high" ? -1 : 1
    return 0
  })
  return items
}
