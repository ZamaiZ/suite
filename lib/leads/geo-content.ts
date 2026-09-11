/**
 * Os cinco checks determinísticos de conteúdo para motores generativos.
 *
 * Os outros três da seção — definição de entidade, citabilidade e autoridade —
 * são humanos, em `geo-review.ts`, porque não há dado de API que responda a
 * eles. E nenhuma LLM os julga: decisão explícita da spec.
 */

import { type GeoContent } from "./geo-audit.ts"
import { websiteHomePage, type WebsiteCrawl } from "./website-audit.ts"

/**
 * Os tipos que respondem "quem é esta empresa".
 *
 * Não é o mesmo que o gap `no_schema` da etapa de Website: um site com
 * `Product` e `BreadcrumbList` passa lá e falha aqui, porque declarar produtos
 * não declara a entidade.
 */
export const IDENTITY_SCHEMA_TYPES = [
  "organization",
  "localbusiness",
  "person",
  "corporation",
  "professionalservice",
] as const

// As faixas alvo de title e meta (`GEO_TITLE_*`, `GEO_META_*`) NÃO são lidas
// aqui: este módulo grava o comprimento, e quem compara com a faixa é a tela.
// Importar só para reexportar criaria a segunda cópia da mesma verdade.

function isQuestion(text: string): boolean {
  return text.trim().endsWith("?")
}

export function geoContentFromCrawl(crawl: WebsiteCrawl): GeoContent {
  const home = websiteHomePage(crawl)
  const allSchema = new Set(
    crawl.pages.flatMap((page) =>
      page.schemaTypes.map((type) => type.trim().toLowerCase()),
    ),
  )
  const identitySchema = IDENTITY_SCHEMA_TYPES.filter((type) =>
    allSchema.has(type),
  )

  const headings = crawl.pages.flatMap((page) => page.headings)
  const levels = new Set(headings.map((heading) => heading.level))
  const questionHeadings = headings.filter((  ) =>
    isQuestion(heading.text),
  ).length

  // Salto de nível: algum nível ausente entre o menor e o maior presente.
  let skips = false
  if (levels.size > 0) {
    const sorted = [...levels].sort((left, right) => left - right)
    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index] - sorted[index - 1] > 1) {
        skips = true
        break
      }
    }
  }

  const dates = home?.schemaDates ?? null

  return {
    identitySchema: [...identitySchema],
    hasFaqSchema: allSchema.has("faqpage") || allSchema.has("qapage"),
    questionHeadings,
    headingDepth: { levels: levels.size, skips },
    contactPoints: {
      phone: Boolean(home?.hasTel) || (home?.phones.length ?? 0) > 0,
      email: Boolean(home?.hasMailto),
      // Endereço legível por máquina é o schema de local, não texto no rodapé.
      address: allSchema.has("postaladdress") || allSchema.has("localbusiness"),
      whatsapp: Boolean(home?.hasWhatsapp),
    },
    freshness: {
      datePublished: dates?.published ?? null,
      dateModified: dates?.modified ?? null,
      sitemapLastmod: crawl.sitemap.lastmod ?? null,
      // `schemaDates: null` = crawl anterior à extensão do parser. Ausente não
      // é "página sem data", e confundir os dois faria todo snapshot antigo
      // ganhar um gap de frescor que nunca foi medido.
      collected: dates !== null,
    },
    titleLength: home?.title ? home.title.length : null,
    metaDescriptionLength: home?.metaDescription
      ? home.metaDescription.length
      : null,
  }
}
