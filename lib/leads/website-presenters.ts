import {
  WEBSITE_GAP_LABELS,
  WEBSITE_SITEMAP_BLOAT_MIN_SAMPLE,
  WEBSITE_SITEMAP_BLOAT_MIN_URLS,
  WEBSITE_SITEMAP_BLOAT_NOT_FOUND_RATIO,
  WEBSITE_THIN_CONTENT_WORDS,
  napCheckForCrawl,
  websiteHomePage,
  websiteTitleIsGeneric,
  type NapCheck,
  type NapComponentState,
  type WebsiteCrawl,
  type WebsiteGapId,
  type WebsiteNapInput,
  type WebsitePageSnapshot,
} from "./website-audit.ts"
import {
  websitePsiJobsActive,
  websitePsiJobsFailedWithoutReady,
  type WebsitePagespeedSnapshot,
  type WebsitePsiJob,
  type WebsitePsiStrategy,
} from "./website-pagespeed.ts"
import {
  type WebsiteReview,
  type WebsiteReviewCriterionId,
} from "./website-review.ts"

export type WebsiteCheckStatus = "ok" | "warn" | "pending" | "error"

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
const PAGESPEED_FAILED = "Não foi possível obter o PageSpeed"

function formatScore(value: number): string {
  return value.toLocaleString("pt-BR")
}

function formatMs(value: number): string {
  if (value >= 1000) {
    const seconds = value / 1000
    return `${seconds.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}s`
  }
  return `${Math.round(value).toLocaleString("pt-BR")}ms`
}

function strategyScoreLabel(
  strategy: WebsitePsiStrategy | null,
  jobs: readonly WebsitePsiJob[],
  kind: "pagespeed_mobile" | "pagespeed_desktop",
  suffix: string,
): string | null {
  if (strategy) return `${formatScore(strategy.performance)} ${suffix}`
  const job = jobs.find((item) => item.kind === kind)
  if (job?.status === "queued" || job?.status === "running") {
    return `${suffix} aguardando`
  }
  if (job?.status === "failed") return `${suffix} falhou`
  return null
}

function speedDetail(
  pagespeed: WebsitePagespeedSnapshot | null,
  jobs: readonly WebsitePsiJob[],
): string {
  const parts = [
    strategyScoreLabel(
      pagespeed?.mobile ?? null,
      jobs,
      "pagespeed_mobile",
      "mobile",
    ),
    strategyScoreLabel(
      pagespeed?.desktop ?? null,
      jobs,
      "pagespeed_desktop",
      "desktop",
    ),
  ].filter((item): item is string => Boolean(item))
  return parts.length > 0 ? parts.join(" · ") : PAGESPEED_PENDING
}

function cwvParts(strategy: WebsitePsiStrategy): string {
  const lab = [
    strategy.lcpMs !== null ? `LCP ${formatMs(strategy.lcpMs)}` : null,
    strategy.inpMs !== null ? `INP ${formatMs(strategy.inpMs)}` : null,
    strategy.cls !== null
      ? `CLS ${strategy.cls.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`
      : null,
  ].filter((item): item is string => Boolean(item))
  const field =
    strategy.fieldLcpMs !== null
      ? `campo LCP ${formatMs(strategy.fieldLcpMs)}`
      : null
  return [...lab, field].join(" · ")
}

function cwvDetail(pagespeed: WebsitePagespeedSnapshot | null): string {
  const strategy = pagespeed?.mobile ?? pagespeed?.desktop
  if (!strategy) return PAGESPEED_PENDING
  const text = cwvParts(strategy)
  return text || PAGESPEED_PENDING
}

function responsiveDetail(pagespeed: WebsitePagespeedSnapshot | null): string {
  const strategies = [pagespeed?.mobile, pagespeed?.desktop].filter(
    (item): item is WebsitePsiStrategy => Boolean(item),
  )
  if (strategies.length === 0) return PAGESPEED_PENDING
  if (strategies.some((item) => !item.viewportOk)) {
    return WEBSITE_GAP_LABELS.not_responsive
  }
  return "Viewport ok — conferir quebra nas capturas"
}

function a11yDetail(pagespeed: WebsitePagespeedSnapshot | null): string {
  const strategies = [pagespeed?.mobile, pagespeed?.desktop].filter(
    (item): item is WebsitePsiStrategy => Boolean(item),
  )
  if (strategies.length === 0) return PAGESPEED_PENDING
  const worst = Math.min(...strategies.map((item) => item.accessibility))
  const contrast = Math.max(...strategies.map((item) => item.contrastFails))
  if (contrast > 0) {
    return `${contrast.toLocaleString("pt-BR")} falhas de contraste`
  }
  return `${formatScore(worst)} de acessibilidade`
}

function psiStatus(
  pagespeed: WebsitePagespeedSnapshot | null,
  jobs: readonly WebsitePsiJob[],
  gap: boolean,
  readyDetail: string,
): Pick<WebsiteCheckItem, "detail" | "status"> {
  const hasData = Boolean(pagespeed?.mobile || pagespeed?.desktop)
  if (hasData) {
    return { status: gap ? "warn" : "ok", detail: readyDetail }
  }
  if (websitePsiJobsActive(jobs)) {
    return { status: "pending", detail: PAGESPEED_PENDING }
  }
  if (websitePsiJobsFailedWithoutReady(jobs)) {
    return { status: "error", detail: PAGESPEED_FAILED }
  }
  return { status: "pending", detail: PAGESPEED_PENDING }
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

function sampleCount(
  total: number,
  bad: number,
  warnLabel: string,
): string {
  return `${bad.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} ${warnLabel}`
}

function headingDetail(
  crawl: WebsiteCrawl,
  home: WebsitePageSnapshot | null,
  gaps: ReadonlySet<WebsiteGapId>,
): Pick<WebsiteCheckItem, "detail" | "status"> {
  if (gaps.has("missing_h1")) {
    const missing = crawl.pages.filter((page) => page.h1.length === 0).length
    return {
      status: "warn",
      detail: sampleCount(crawl.pages.length, missing, "páginas sem H1"),
    }
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
  if (gaps.has("noindex")) {
    return { status: "warn", detail: WEBSITE_GAP_LABELS.noindex }
  }
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

function securityDetail(
  crawl: WebsiteCrawl,
  gaps: ReadonlySet<WebsiteGapId>,
): Pick<WebsiteCheckItem, "detail" | "status"> {
  if (gaps.has("no_https")) {
    return { status: "warn", detail: WEBSITE_GAP_LABELS.no_https }
  }
  if (gaps.has("mixed_content")) {
    return { status: "warn", detail: WEBSITE_GAP_LABELS.mixed_content }
  }
  return {
    status: "ok",
    detail: crawl.https ? "HTTPS ativo" : "Sem HTTPS",
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
    detail: `${crawl.pages.length.toLocaleString("pt-BR")} na amostra · ${crawl.sitemap.urlCount.toLocaleString("pt-BR")} no sitemap`,
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

function clipReviewNote(note: string, empty: string): string {
  const trimmed = note.trim()
  if (!trimmed) return empty
  if (trimmed.length <= 80) return trimmed
  return `${trimmed.slice(0, 79)}…`
}

const NAP_STATE_TEXT: Record<NapComponentState, string> = {
  absent: "não informado no perfil",
  match: "confere",
  mismatch: "não encontrado na home",
}

/**
 * Mostra os dois componentes, sempre. O texto anterior dizia "Telefone do
 * perfil primário não aparece na home" mesmo quando quem divergia era o
 * endereço, e escondia o estado real quando não havia gap.
 */
function napEvidence(check: NapCheck): string {
  return `Telefone ${NAP_STATE_TEXT[check.phone]} · Endereço ${NAP_STATE_TEXT[check.address]}`
}

export function websiteReviewEvidence(
  crawl: WebsiteCrawl,
  pagespeed: WebsitePagespeedSnapshot | null,
  gaps: readonly WebsiteGapId[],
  nap: WebsiteNapInput | null = null,
): Record<WebsiteReviewCriterionId, string> {
  const gapSet = new Set(gaps)
  const home = websiteHomePage(crawl)
  const strategies = [pagespeed?.mobile, pagespeed?.desktop].filter(
    (item): item is WebsitePsiStrategy => Boolean(item),
  )
  let viewport = PAGESPEED_PENDING
  if (strategies.length > 0) {
    viewport = strategies.some((item) => !item.viewportOk)
      ? WEBSITE_GAP_LABELS.not_responsive
      : "Viewport ok"
  }
  return {
    design: "Capturas mobile e desktop",
    cta_visible: gapSet.has("weak_cta")
      ? "Sem tel/WhatsApp no HTML"
      : "Tel/WhatsApp no HTML",
    narrow_layout: viewport,
    sample_pages: `${crawl.pages.length.toLocaleString("pt-BR")} na amostra · ${crawl.sitemap.urlCount.toLocaleString("pt-BR")} no sitemap`,
    nap_group: napEvidence(napCheckForCrawl(crawl, nap)),
    content_quality: `${(home?.wordCount ?? 0).toLocaleString("pt-BR")} palavras na inicial`,
    other: "",
  }
}

function designCheck(
  review: WebsiteReview | null,
): Pick<WebsiteCheckItem, "detail" | "status"> {
  const verdict = review?.design.verdict ?? null
  if (verdict === null) {
    return {
      status: "pending",
      detail: "Usar as capturas: confiança e layout",
    }
  }
  if (verdict === "issue") {
    return {
      status: "warn",
      detail: clipReviewNote(
        review?.design.note ?? "",
        "Problema marcado nas capturas",
      ),
    }
  }
  return {
    status: "ok",
    detail: clipReviewNote(
      review?.design.note ?? "",
      "Layout conferido",
    ),
  }
}

export function websiteCheckSections(
  crawl: WebsiteCrawl,
  gapIds: readonly WebsiteGapId[],
  pagespeed: WebsitePagespeedSnapshot | null = null,
  jobs: readonly WebsitePsiJob[] = [],
  companyName = "",
  review: WebsiteReview | null = null,
): WebsiteCheckSection[] {
  const gaps = new Set(gapIds)
  const home = websiteHomePage(crawl)
  const total = crawl.pages.length
  const genericTitles = crawl.pages.filter((page) =>
    websiteTitleIsGeneric(page.title, companyName),
  ).length
  const missingMeta = crawl.pages.filter((page) => !page.metaDescription).length
  const missingAlt = crawl.pages.filter(
    (page) => page.imageCount > 0 && page.imagesWithoutAlt > 0,
  ).length
  const thinPages = crawl.pages.filter(
    (page) => page.wordCount < WEBSITE_THIN_CONTENT_WORDS,
  ).length
  const cta = warnOrOk(
    gaps,
    "weak_cta",
    "Tel/WhatsApp no HTML — conferir se chama atenção nas capturas",
  )
  const contact = warnOrOk(
    gaps,
    "contact_only_in_footer",
    "Contato visível fora do rodapé",
  )
  const speed = psiStatus(
    pagespeed,
    jobs,
    gaps.has("slow_performance"),
    speedDetail(pagespeed, jobs),
  )
  const cwv = psiStatus(
    pagespeed,
    jobs,
    gaps.has("poor_cwv"),
    cwvDetail(pagespeed),
  )
  const responsive = psiStatus(
    pagespeed,
    jobs,
    gaps.has("not_responsive"),
    responsiveDetail(pagespeed),
  )
  const a11y = psiStatus(
    pagespeed,
    jobs,
    gaps.has("a11y_issues"),
    a11yDetail(pagespeed),
  )

  return [
    {
      id: "technical",
      title: "Estrutura técnica",
      items: [
        {
          id: "speed",
          label: "Velocidade",
          ...speed,
        },
        {
          id: "cwv",
          label: "Core Web Vitals",
          ...cwv,
        },
        {
          id: "responsive",
          label: "Responsividade",
          ...responsive,
        },
        {
          id: "security",
          label: "Segurança",
          ...securityDetail(crawl, gaps),
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
          ...(gaps.has("generic_title")
            ? {
                status: "warn" as const,
                detail: sampleCount(total, genericTitles, "páginas com title genérico"),
              }
            : {
                status: "ok" as const,
                detail: home?.title ?? "Title presente",
              }),
        },
        {
          id: "meta",
          label: "Meta descriptions",
          ...(gaps.has("missing_meta_description")
            ? {
                status: "warn" as const,
                detail: sampleCount(total, missingMeta, "páginas sem meta"),
              }
            : {
                status: "ok" as const,
                detail: home?.metaDescription ?? "Meta description presente",
              }),
        },
        {
          id: "headings",
          label: "Headings",
          ...headingDetail(crawl, home, gaps),
        },
        {
          id: "content",
          label: "Conteúdo",
          ...(gaps.has("thin_content")
            ? {
                status: "warn" as const,
                detail: sampleCount(
                  total,
                  thinPages,
                  "páginas com pouco conteúdo",
                ),
              }
            : {
                status: "ok" as const,
                detail: `${(home?.wordCount ?? 0).toLocaleString("pt-BR")} palavras na inicial`,
              }),
        },
        {
          id: "images",
          label: "Imagens",
          ...(gaps.has("images_missing_alt")
            ? {
                status: "warn" as const,
                detail: sampleCount(
                  total,
                  missingAlt,
                  "páginas com imagens sem alt",
                ),
              }
            : warnOrOk(gaps, "images_missing_alt", "Imagens com alt text")),
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
          ...designCheck(review),
        },
        {
          id: "contact",
          label: "Contato",
          ...contact,
        },
        {
          id: "a11y",
          label: "Acessibilidade",
          ...a11y,
        },
      ],
    },
  ]
}
