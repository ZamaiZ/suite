import {
  WEBSITE_GAP_LABELS,
  WEBSITE_SITEMAP_BLOAT_MIN_SAMPLE,
  WEBSITE_SITEMAP_BLOAT_MIN_URLS,
  WEBSITE_SITEMAP_BLOAT_NOT_FOUND_RATIO,
  type WebsiteCrawl,
  type WebsiteGapId,
  type WebsitePageSnapshot,
} from "./website-audit.ts"

export type WebsiteCheckStatus = "ok" | "warn" | "pending"

export type WebsiteCheckItem = {
  id: string
  label: string
  detail: string
  status: WebsiteCheckStatus
}

export type WebsiteCheckSectionId = "technical" | "onpage" | "conversion"

export type WebsiteCheckSection = {
  id: WebsiteCheckSectionId
  title: string
  items: WebsiteCheckItem[]
}

const PAGESPEED_PENDING = "Aguardando PageSpeed"

function homePage(crawl: WebsiteCrawl): WebsitePageSnapshot | null {
  return crawl.pages[0] ?? null
}

function warnOrOk(
  gaps: ReadonlySet<WebsiteGapId>,
  id: WebsiteGapId,
  okDetail: string,
): Pick<WebsiteCheckItem, "detail" | "status"> {
  if (gaps.has(id)) {
    return { status: "warn", detail: WEBSITE_GAP_LABELS[id] }
  }
  return { status: "ok", detail: okDetail }
}

function headingDetail(
  home: WebsitePageSnapshot | null,
  gaps: ReadonlySet<WebsiteGapId>,
): Pick<WebsiteCheckItem, "detail" | "status"> {
  if (gaps.has("missing_h1")) {
    return { status: "warn", detail: WEBSITE_GAP_LABELS.missing_h1 }
  }
  if (gaps.has("duplicate_h1")) {
    return { status: "warn", detail: WEBSITE_GAP_LABELS.duplicate_h1 }
  }
  const count = home?.h1.length ?? 0
  return {
    status: "ok",
    detail:
      count === 1
        ? "H1 único na página inicial"
        : `${count.toLocaleString("pt-BR")} H1 na página inicial`,
  }
}

function schemaDetail(
  gaps: ReadonlySet<WebsiteGapId>,
): Pick<WebsiteCheckItem, "detail" | "status"> {
  if (gaps.has("no_schema")) {
    return { status: "warn", detail: WEBSITE_GAP_LABELS.no_schema }
  }
  if (gaps.has("no_local_schema")) {
    return { status: "warn", detail: WEBSITE_GAP_LABELS.no_local_schema }
  }
  return { status: "ok", detail: "Schema local encontrado" }
}

function indexationDetail(
  crawl: WebsiteCrawl,
  gaps: ReadonlySet<WebsiteGapId>,
): Pick<WebsiteCheckItem, "detail" | "status"> {
  if (gaps.has("missing_sitemap")) {
    return { status: "warn", detail: WEBSITE_GAP_LABELS.missing_sitemap }
  }
  if (gaps.has("sitemap_bloat")) {
    return {
      status: "warn",
      detail: `${crawl.sitemap.urlCount.toLocaleString("pt-BR")} URLs no sitemap, ${crawl.sitemap.sampleNotFound.toLocaleString("pt-BR")} inválidas na amostra`,
    }
  }
  return {
    status: "ok",
    detail: crawl.sitemap.found
      ? `${crawl.sitemap.urlCount.toLocaleString("pt-BR")} URLs no sitemap`
      : "Sitemap ok",
  }
}

function architectureDetail(
  crawl: WebsiteCrawl,
  gaps: ReadonlySet<WebsiteGapId>,
): Pick<WebsiteCheckItem, "detail" | "status"> {
  if (gaps.has("few_pages")) {
    return { status: "warn", detail: WEBSITE_GAP_LABELS.few_pages }
  }
  if (gaps.has("unfriendly_urls")) {
    return { status: "warn", detail: WEBSITE_GAP_LABELS.unfriendly_urls }
  }
  return {
    status: "ok",
    detail: `${crawl.pages.length.toLocaleString("pt-BR")} páginas na amostra`,
  }
}

export function websiteHttpsLabel(https: boolean): string {
  return https ? "HTTPS ativo" : "Sem HTTPS"
}

export function websiteSitemapLabel(crawl: WebsiteCrawl): string {
  if (!crawl.sitemap.found) return "Ausente"
  if (
    crawl.sitemap.urlCount >= WEBSITE_SITEMAP_BLOAT_MIN_URLS &&
    crawl.sitemap.sampleChecked >= WEBSITE_SITEMAP_BLOAT_MIN_SAMPLE &&
    crawl.sitemap.sampleNotFound / crawl.sitemap.sampleChecked >=
      WEBSITE_SITEMAP_BLOAT_NOT_FOUND_RATIO
  ) {
    return "Inchado"
  }
  return "Ok"
}

export function websiteHasSchema(crawl: WebsiteCrawl): boolean {
  return crawl.pages.some((page) => page.schemaTypes.length > 0)
}

export function websiteCheckSections(
  crawl: WebsiteCrawl,
  gapIds: readonly WebsiteGapId[],
): WebsiteCheckSection[] {
  const gaps = new Set(gapIds)
  const home = homePage(crawl)
  const https = warnOrOk(gaps, "no_https", "HTTPS ativo")
  const cta = warnOrOk(gaps, "weak_cta", "CTA de telefone ou WhatsApp encontrado")
  const contact = warnOrOk(
    gaps,
    "contact_only_in_footer",
    "Contato visível fora do rodapé",
  )

  return [
    {
      id: "technical",
      title: "Estrutura técnica",
      items: [
        {
          id: "speed",
          label: "Velocidade",
          detail: PAGESPEED_PENDING,
          status: "pending",
        },
        {
          id: "cwv",
          label: "Core Web Vitals",
          detail: PAGESPEED_PENDING,
          status: "pending",
        },
        {
          id: "responsive",
          label: "Responsividade",
          detail: PAGESPEED_PENDING,
          status: "pending",
        },
        {
          id: "security",
          label: "Segurança",
          ...https,
        },
        {
          id: "indexation",
          label: "Indexação",
          ...indexationDetail(crawl, gaps),
        },
        {
          id: "architecture",
          label: "Arquitetura",
          ...architectureDetail(crawl, gaps),
        },
      ],
    },
    {
      id: "onpage",
      title: "SEO on-page",
      items: [
        {
          id: "title",
          label: "Title tags",
          ...warnOrOk(gaps, "generic_title", home?.title ?? "Title presente"),
        },
        {
          id: "meta",
          label: "Meta descriptions",
          ...warnOrOk(
            gaps,
            "missing_meta_description",
            home?.metaDescription ?? "Meta description presente",
          ),
        },
        {
          id: "headings",
          label: "Headings",
          ...headingDetail(home, gaps),
        },
        {
          id: "content",
          label: "Conteúdo",
          ...warnOrOk(
            gaps,
            "thin_content",
            `${(home?.wordCount ?? 0).toLocaleString("pt-BR")} palavras na inicial`,
          ),
        },
        {
          id: "images",
          label: "Imagens",
          ...warnOrOk(gaps, "images_missing_alt", "Imagens com alt text"),
        },
        {
          id: "internal-links",
          label: "Links internos",
          ...warnOrOk(
            gaps,
            "no_internal_links",
            `${(home?.internalLinkCount ?? 0).toLocaleString("pt-BR")} links internos`,
          ),
        },
        {
          id: "schema",
          label: "Schema markup",
          ...schemaDetail(gaps),
        },
      ],
    },
    {
      id: "conversion",
      title: "Conversão e UX",
      items: [
        {
          id: "cta",
          label: "CTAs",
          ...cta,
        },
        {
          id: "design",
          label: "Design/UI",
          detail: "Avaliação visual na coleta",
          status: "pending",
        },
        {
          id: "contact",
          label: "Contato",
          ...contact,
        },
        {
          id: "a11y",
          label: "Acessibilidade",
          detail: PAGESPEED_PENDING,
          status: "pending",
        },
      ],
    },
  ]
}
