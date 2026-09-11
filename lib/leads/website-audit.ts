import {
  SOCIAL_CHANNEL_TYPES,
  type SocialChannelType,
} from "./digital-channels.ts"
import {
  readWebsitePagespeed,
  readWebsitePsiJobs,
  websitePagespeedGaps,
  type WebsitePagespeedSnapshot,
  type WebsitePsiJob,
} from "./website-pagespeed.ts"
import {
  ROBOTS_CONTENT_MAX,
  readRobotsAiAgents,
  readRobotsGroups,
  robotsBlocksPath,
  type RobotsAiAgent,
  type RobotsGroup,
} from "../website-audit/robots.ts"
import { canonicalIssuesForSample } from "./website-canonical.ts"
import { complianceIssuesForPaths } from "./website-compliance.ts"
import {
  redirectIssuesForPages,
  type WebsiteRedirectHop,
} from "./website-redirects.ts"
import {
  missingSecurityHeaders,
  readSecurityHeaders,
} from "./website-headers.ts"
import {
  headingsSkipLevel,
  readHeadings,
  type WebsiteHeading,
} from "./website-headings.ts"
import {
  emptyWebsiteReviewEntry,
  type WebsiteReview,
  type WebsiteReviewEntry,
} from "./website-review.ts"

export const WEBSITE_NOTES_MAX = 2000
export const WEBSITE_THIN_CONTENT_WORDS = 300
export const WEBSITE_FEW_PAGES_MAX = 4
export const WEBSITE_SITEMAP_BLOAT_MIN_URLS = 100
export const WEBSITE_SITEMAP_BLOAT_NOT_FOUND_RATIO = 0.5
export const WEBSITE_SITEMAP_BLOAT_MIN_SAMPLE = 5
export const WEBSITE_INTERNAL_PATHS_MAX = 40
export const WEBSITE_TEXT_EXCERPT_MAX = 4000
export const WEBSITE_MAX_INTERNAL_PAGES = 8
export const WEBSITE_SITEMAP_SAMPLE = 20
export const WEBSITE_FETCH_TIMEOUT_MS = 10_000
export const WEBSITE_FETCH_MAX_BYTES = 1_500_000
export const WEBSITE_MAX_REDIRECTS = 5
export const WEBSITE_FETCH_CONCURRENCY = 4
export const WEBSITE_MAX_SITEMAP_FILES = 3

export const WEBSITE_GAP_IDS = [
  "no_https",
  "missing_sitemap",
  "sitemap_bloat",
  "few_pages",
  "unfriendly_urls",
  "no_service_pages",
  "no_blog",
  "generic_title",
  "missing_meta_description",
  "missing_h1",
  "duplicate_h1",
  "thin_content",
  "images_missing_alt",
  "no_internal_links",
  "no_schema",
  "no_local_schema",
  "weak_cta",
  "contact_only_in_footer",
  "nap_mismatch",
  "slow_performance",
  "poor_cwv",
  "not_responsive",
  "a11y_issues",
  "mixed_content",
  "noindex",
  "canonical_missing",
  "canonical_points_elsewhere",
  "canonical_external",
  "canonical_insecure",
  "canonical_vs_noindex",
  "canonical_non_indexable",
  "host_canonicalization",
  "slash_canonicalization",
  "weak_security_headers",
  "heading_hierarchy",
  "noindex_internal_pages",
  "robots_blocks_search",
  "no_privacy_policy",
  "no_terms",
  "redirect_chain",
  "temporary_redirect",
  "redirect_loop",
  "https_canonicalization",
] as const

export type WebsiteGapId = (typeof WEBSITE_GAP_IDS)[number]

export const WEBSITE_GAP_LABELS: Record<WebsiteGapId, string> = {
  no_https: "Site sem HTTPS",
  missing_sitemap: "Sitemap ausente",
  sitemap_bloat: "Sitemap com muitas URLs inválidas",
  few_pages: "Poucas páginas no site",
  unfriendly_urls: "URLs pouco amigáveis",
  no_service_pages: "Sem páginas de serviços",
  no_blog: "Sem blog ou notícias",
  generic_title: "Title tags genéricas",
  missing_meta_description: "Meta description ausente",
  missing_h1: "Página sem H1",
  duplicate_h1: "H1 duplicado",
  thin_content: "Conteúdo raso",
  images_missing_alt: "Imagens sem alt",
  no_internal_links: "Sem links internos",
  no_schema: "Schema markup inexistente",
  no_local_schema: "Sem schema de SEO local",
  weak_cta: "CTA pouco evidente",
  contact_only_in_footer: "Contato só no rodapé",
  nap_mismatch: "NAP diferente do perfil no Google",
  slow_performance: "Velocidade baixa no PageSpeed",
  poor_cwv: "Core Web Vitals abaixo do ideal",
  not_responsive: "Viewport não adaptado a mobile",
  a11y_issues: "Problemas de acessibilidade",
  mixed_content: "Recursos mistos sem HTTPS",
  noindex: "Página inicial com noindex",
  canonical_missing: "Página sem canonical",
  canonical_points_elsewhere: "Canonical aponta para outra URL",
  canonical_external: "Canonical aponta para domínio externo",
  canonical_insecure: "Canonical em HTTP na página HTTPS",
  canonical_vs_noindex: "Canonical em página com noindex",
  canonical_non_indexable: "Canonical aponta para URL não indexável",
  host_canonicalization: "www e sem www não convergem",
  slash_canonicalization: "Barra final e sem barra não convergem",
  weak_security_headers: "Headers de segurança ausentes",
  heading_hierarchy: "Hierarquia de headings quebrada",
  noindex_internal_pages: "Páginas internas com noindex",
  robots_blocks_search: "robots.txt bloqueia a busca",
  no_privacy_policy: "Sem política de privacidade",
  no_terms: "Sem termos de uso",
  redirect_chain: "Redirect em cadeia",
  temporary_redirect: "Redirect temporário onde cabe permanente",
  redirect_loop: "Redirect em laço",
  https_canonicalization: "HTTP não redireciona para HTTPS",
}

/** Reexportado para quem já lê os tipos da coleta a partir deste módulo. */
export type { WebsiteRedirectHop }

export type WebsiteSitemapSampleStatus = {
  url: string
  status: number | null
}

/**
 * Datas declaradas no JSON-LD da pagina.
 *
 * `null` no lugar do objeto inteiro significa **crawl anterior a este campo** —
 * nao "pagina sem data". Confundir os dois faria todo snapshot ja gravado
 * ganhar um gap de frescor que nunca foi medido, que e o mesmo argumento de
 * `redirects` logo abaixo.
 *
 * O parser lia os `@type` do JSON-LD e descartava os valores; estas duas sao a
 * materia-prima do sinal de frescor que a etapa de Presenca em IA precisa.
 */
export type WebsiteSchemaDates = {
  published: string | null
  modified: string | null
}

export type WebsitePageSnapshot = {
  url: string
  status: number
  title: string | null
  metaDescription: string | null
  h1: string[]
  h2: string[]
  wordCount: number
  imageCount: number
  imagesWithoutAlt: number
  internalLinkCount: number
  internalPaths: string[]
  schemaTypes: string[]
  hasTel: boolean
  hasWhatsapp: boolean
  hasMailto: boolean
  contactInFooterOnly: boolean
  phones: string[]
  textExcerpt: string
  /** Ausentes em snapshots gravados antes da coleta ampliada. */
  canonical: string | null
  headings: WebsiteHeading[]
  headers: Record<string, string>
  indexable: boolean
  /**
   * Saltos ate esta pagina. `null` significa coleta anterior a este campo —
   * ausente nao e "sem redirect", e confundir os dois faria todo snapshot
   * antigo passar no teste sem ter sido medido.
   */
  redirects: WebsiteRedirectHop[] | null
  /** `null` = crawl anterior a extracao de datas. Ver `WebsiteSchemaDates`. */
  schemaDates: WebsiteSchemaDates | null
}

export type WebsiteCrawlSocialUrls = Record<SocialChannelType, string | null>

/**
 * Identificadores das tags encontradas. O booleano diz se existe medicao; o id
 * diz *qual* propriedade — o que separa "tinha analytics" de "tinha a
 * propriedade da agencia anterior" na hora do kickoff.
 */
export type WebsiteMeasurementIds = {
  ga4: string | null
  gtm: string | null
  googleAds: string | null
  metaPixel: string | null
}

export function emptyWebsiteMeasurementIds(): WebsiteMeasurementIds {
  return { ga4: null, gtm: null, googleAds: null, metaPixel: null }
}

export type WebsiteCrawlSignals = {
  measurementIds: WebsiteMeasurementIds
  hasGtm: boolean
  hasGtag: boolean
  hasFacebookPixel: boolean
  hasInstagram: boolean
  hasFacebook: boolean
  hasLinkedin: boolean
  hasYoutube: boolean
  hasTiktok: boolean
  hasPinterest: boolean
  hasTwitter: boolean
  socialUrls: WebsiteCrawlSocialUrls
}

export function emptyWebsiteCrawlSocialUrls(): WebsiteCrawlSocialUrls {
  return {
    instagram: null,
    linkedin: null,
    facebook: null,
    youtube: null,
    tiktok: null,
    pinterest: null,
    twitter: null,
  }
}

export type WebsiteRobotsSnapshot = {
  found: boolean
  sitemapUrls: string[]
  /** Ausentes em snapshots anteriores a interpretacao do robots. */
  content: string
  groups: RobotsGroup[]
  aiAgents: RobotsAiAgent[]
}

export type WebsiteLlmsTxtSnapshot = {
  found: boolean
  status: number | null
}

/**
 * Resultado da sondagem das variantes da home: com e sem `www`, com e sem
 * barra final. Nao e regra de parse — exige buscar as variantes e comparar
 * onde cada uma termina.
 */
export type WebsiteVariantSnapshot = {
  hostMismatch: boolean
  slashMismatch: boolean
  /** Sondagem posterior as duas primeiras: ausente vale `false`. */
  httpsMismatch: boolean
}

export type WebsiteSitemapSnapshot = {
  found: boolean
  urlCount: number
  sampleChecked: number
  sampleNotFound: number
  sampleStatuses: WebsiteSitemapSampleStatus[]
  /**
   * `lastmod` mais recente do arquivo. `null` = crawl anterior a este campo,
   * ou sitemap que nao declara data em nenhuma URL — os dois calam, porque
   * nenhum dos dois autoriza afirmar que o site esta parado.
   */
  lastmod: string | null
}

export type WebsiteCrawl = {
  finalUrl: string
  https: boolean
  pages: WebsitePageSnapshot[]
  robots: WebsiteRobotsSnapshot
  sitemap: WebsiteSitemapSnapshot
  signals: WebsiteCrawlSignals
  llmsTxt: WebsiteLlmsTxtSnapshot
  variants: WebsiteVariantSnapshot | null
}

export const EMPTY_WEBSITE_CRAWL_SIGNALS: WebsiteCrawlSignals = {
  measurementIds: emptyWebsiteMeasurementIds(),
  hasGtm: false,
  hasGtag: false,
  hasFacebookPixel: false,
  hasInstagram: false,
  hasFacebook: false,
  hasLinkedin: false,
  hasYoutube: false,
  hasTiktok: false,
  hasPinterest: false,
  hasTwitter: false,
  socialUrls: emptyWebsiteCrawlSocialUrls(),
}

function mergeSocialUrls(
  left: WebsiteCrawlSocialUrls,
  right: WebsiteCrawlSocialUrls,
): WebsiteCrawlSocialUrls {
  const next = emptyWebsiteCrawlSocialUrls()
  for (const type of SOCIAL_CHANNEL_TYPES) {
    next[type] = left[type] ?? right[type]
  }
  return next
}

function mergeMeasurementIds(
  left: WebsiteMeasurementIds,
  right: WebsiteMeasurementIds,
): WebsiteMeasurementIds {
  return {
    ga4: left.ga4 ?? right.ga4,
    gtm: left.gtm ?? right.gtm,
    googleAds: left.googleAds ?? right.googleAds,
    metaPixel: left.metaPixel ?? right.metaPixel,
  }
}

export function mergeWebsiteCrawlSignals(
  left: WebsiteCrawlSignals,
  right: WebsiteCrawlSignals,
): WebsiteCrawlSignals {
  return {
    measurementIds: mergeMeasurementIds(
      left.measurementIds,
      right.measurementIds,
    ),
    hasGtm: left.hasGtm || right.hasGtm,
    hasGtag: left.hasGtag || right.hasGtag,
    hasFacebookPixel: left.hasFacebookPixel || right.hasFacebookPixel,
    hasInstagram: left.hasInstagram || right.hasInstagram,
    hasFacebook: left.hasFacebook || right.hasFacebook,
    hasLinkedin: left.hasLinkedin || right.hasLinkedin,
    hasYoutube: left.hasYoutube || right.hasYoutube,
    hasTiktok: left.hasTiktok || right.hasTiktok,
    hasPinterest: left.hasPinterest || right.hasPinterest,
    hasTwitter: left.hasTwitter || right.hasTwitter,
    socialUrls: mergeSocialUrls(left.socialUrls, right.socialUrls),
  }
}

export type LeadWebsiteAudit = {
  id: string
  lead_id: string
  channel_id: string
  url: string
  fetched_at: string
  fetched_by: string
  crawl: WebsiteCrawl
  /**
   * Hidratada de `lead_website_reviews` pela camada de acesso: e um campo de
   * apresentacao, nao uma coluna do snapshot.
   */
  review: WebsiteReview
  /** Notas livres do analista, por canal. Mesma origem e mesma gravacao. */
  notes: string | null
  pagespeed: WebsitePagespeedSnapshot | null
  pagespeed_at: string | null
  jobs: WebsitePsiJob[]
}

export type WebsiteNapInput = {
  phone: string | null
  address: string | null
}

const GENERIC_TITLES = new Set([
  "home",
  "página inicial",
  "pagina inicial",
  "início",
  "inicio",
  "index",
  "bem-vindo",
  "bem vindo",
  "welcome",
  "site oficial",
])

const GENERIC_TITLE_FRAGMENTS = [
  "página inicial",
  "pagina inicial",
  "site oficial",
  "bem-vindo",
  "bem vindo",
] as const

const ADDRESS_STOPWORDS = new Set([
  "rua",
  "avenida",
  "alameda",
  "travessa",
  "praca",
  "praça",
  "bairro",
  "brasil",
  "centro",
  "cidade",
  "estado",
  "cep",
  "numero",
  "número",
  "n",
  "sn",
  "das",
  "dos",
  "da",
  "do",
  "de",
  "e",
  "em",
  "no",
  "na",
])

const LOCAL_SCHEMA_TYPES = new Set([
  "localbusiness",
  "restaurant",
  "dentist",
  "physician",
  "attorney",
  "store",
  "foodestablishment",
  "lodgingbusiness",
  "funeralhome",
  "cemetery",
  "professionalservice",
  "medicalbusiness",
  "faqpage",
  "legalservice",
  "automotiverepair",
  "hvacbusiness",
  "realestateagent",
])

const SERVICE_PATH = /servi[cç]os?|services?/i
const BLOG_PATH = /\/(blog|not[ií]cias|artigos|news|novidades)(\/|$)/i

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function asCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null
  }
  return Math.trunc(value)
}

function asStringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const items: string[] = []
  for (const item of value) {
    if (typeof item !== "string") return null
    const trimmed = item.trim()
    if (trimmed) items.push(trimmed)
  }
  return items
}

function asBool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null
}

function fold(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function readSampleStatus(value: unknown): WebsiteSitemapSampleStatus | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const url = asString(row.url)
  if (!url) return null
  if (row.status === null || row.status === undefined) {
    return { url, status: null }
  }
  const status = asCount(row.status)
  if (status === null) return null
  return { url, status }
}

function readPage(value: unknown): WebsitePageSnapshot | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const url = asString(row.url)
  const status = asCount(row.status)
  const h1 = asStringList(row.h1)
  const h2 = asStringList(row.h2)
  const wordCount = asCount(row.wordCount)
  const imageCount = asCount(row.imageCount)
  const imagesWithoutAlt = asCount(row.imagesWithoutAlt)
  const internalLinkCount = asCount(row.internalLinkCount)
  const internalPaths = asStringList(row.internalPaths)
  const schemaTypes = asStringList(row.schemaTypes)
  const hasTel = asBool(row.hasTel)
  const hasWhatsapp = asBool(row.hasWhatsapp)
  const hasMailto = asBool(row.hasMailto)
  const contactInFooterOnly = asBool(row.contactInFooterOnly)
  const phones = asStringList(row.phones)
  if (
    !url ||
    status === null ||
    !h1 ||
    !h2 ||
    wordCount === null ||
    imageCount === null ||
    imagesWithoutAlt === null ||
    internalLinkCount === null ||
    !internalPaths ||
    !schemaTypes ||
    hasTel === null ||
    hasWhatsapp === null ||
    hasMailto === null ||
    contactInFooterOnly === null ||
    !phones
  ) {
    return null
  }
  if (row.title != null && typeof row.title !== "string") return null
  if (row.metaDescription != null && typeof row.metaDescription !== "string") {
    return null
  }
  if (typeof row.textExcerpt !== "string") return null
  let indexable = true
  if (row.indexable !== undefined && row.indexable !== null) {
    const parsed = asBool(row.indexable)
    if (parsed === null) return null
    indexable = parsed
  }
  return {
    url,
    status,
    title: asString(row.title),
    metaDescription: asString(row.metaDescription),
    h1,
    h2,
    wordCount,
    imageCount,
    imagesWithoutAlt,
    internalLinkCount,
    internalPaths: internalPaths.slice(0, WEBSITE_INTERNAL_PATHS_MAX),
    schemaTypes,
    hasTel,
    hasWhatsapp,
    hasMailto,
    contactInFooterOnly,
    phones,
    textExcerpt: row.textExcerpt.slice(0, WEBSITE_TEXT_EXCERPT_MAX),
    // Campos da coleta ampliada: opcionais, para que snapshots anteriores a
    // ela continuem legiveis em vez de serem descartados.
    canonical: asString(row.canonical),
    headings: readHeadings(row.headings),
    headers: readSecurityHeaders(row.headers),
    indexable,
    redirects: readRedirects(row.redirects),
    schemaDates: readSchemaDates(row.schemaDates),
  }
}

/**
 * Ausente devolve `null`, nao um objeto com os dois campos nulos: a diferenca
 * entre "nao coletamos" e "coletamos e a pagina nao declara" e o unico jeito de
 * a regra de frescor calar em vez de acusar snapshot antigo.
 */
function readSchemaDates(value: unknown): WebsiteSchemaDates | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  return {
    published: asString(row.published),
    modified: asString(row.modified),
  }
}

function readRedirects(value: unknown): WebsiteRedirectHop[] | null {
  if (!Array.isArray(value)) return null
  const hops: WebsiteRedirectHop[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const url = asString(row.url)
    const status = asCount(row.status)
    if (!url || status === null) continue
    hops.push({ url, status })
  }
  return hops
}

function readRobots(value: unknown): WebsiteRobotsSnapshot | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const found = asBool(row.found)
  const sitemapUrls = asStringList(row.sitemapUrls)
  if (found === null || !sitemapUrls) return null
  return {
    found,
    sitemapUrls,
    content:
      typeof row.content === "string"
        ? row.content.slice(0, ROBOTS_CONTENT_MAX)
        : "",
    groups: readRobotsGroups(row.groups),
    aiAgents: readRobotsAiAgents(row.aiAgents),
  }
}

function readLlmsTxt(value: unknown): WebsiteLlmsTxtSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { found: false, status: null }
  }
  const row = value as Record<string, unknown>
  return {
    found: asBool(row.found) ?? false,
    status: asCount(row.status),
  }
}

function readOptionalBool(
  row: Record<string, unknown>,
  key: string,
): boolean | null {
  if (row[key] === undefined) return false
  return asBool(row[key])
}

function readSocialUrls(value: unknown): WebsiteCrawlSocialUrls {
  const urls = emptyWebsiteCrawlSocialUrls()
  if (!value || typeof value !== "object" || Array.isArray(value)) return urls
  const row = value as Record<string, unknown>
  for (const type of SOCIAL_CHANNEL_TYPES) {
    const item = row[type]
    if (typeof item === "string" && item.trim().length > 0) {
      urls[type] = item.trim()
    }
  }
  return urls
}

function readSignals(value: unknown): WebsiteCrawlSignals | null {
  if (value === undefined || value === null) {
    return {
      ...EMPTY_WEBSITE_CRAWL_SIGNALS,
      socialUrls: emptyWebsiteCrawlSocialUrls(),
      measurementIds: emptyWebsiteMeasurementIds(),
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const hasGtm = readOptionalBool(row, "hasGtm")
  const hasGtag = readOptionalBool(row, "hasGtag")
  const hasFacebookPixel = readOptionalBool(row, "hasFacebookPixel")
  const hasInstagram = readOptionalBool(row, "hasInstagram")
  const hasFacebook = readOptionalBool(row, "hasFacebook")
  const hasLinkedin = readOptionalBool(row, "hasLinkedin")
  const hasYoutube = readOptionalBool(row, "hasYoutube")
  const hasTiktok = readOptionalBool(row, "hasTiktok")
  const hasPinterest = readOptionalBool(row, "hasPinterest")
  const hasTwitter = readOptionalBool(row, "hasTwitter")
  if (
    hasGtm === null ||
    hasGtag === null ||
    hasFacebookPixel === null ||
    hasInstagram === null ||
    hasFacebook === null ||
    hasLinkedin === null ||
    hasYoutube === null ||
    hasTiktok === null ||
    hasPinterest === null ||
    hasTwitter === null
  ) {
    return null
  }
  return {
    measurementIds: readMeasurementIds(row.measurementIds),
    hasGtm,
    hasGtag,
    hasFacebookPixel,
    hasInstagram,
    hasFacebook,
    hasLinkedin,
    hasYoutube,
    hasTiktok,
    hasPinterest,
    hasTwitter,
    socialUrls: readSocialUrls(row.socialUrls),
  }
}

function readMeasurementIds(value: unknown): WebsiteMeasurementIds {
  const ids = emptyWebsiteMeasurementIds()
  if (!value || typeof value !== "object" || Array.isArray(value)) return ids
  const row = value as Record<string, unknown>
  for (const key of ["ga4", "gtm", "googleAds", "metaPixel"] as const) {
    ids[key] = asString(row[key])
  }
  return ids
}

function readSitemap(value: unknown): WebsiteSitemapSnapshot | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const found = asBool(row.found)
  const urlCount = asCount(row.urlCount)
  const sampleChecked = asCount(row.sampleChecked)
  const sampleNotFound = asCount(row.sampleNotFound)
  if (
    found === null ||
    urlCount === null ||
    sampleChecked === null ||
    sampleNotFound === null ||
    !Array.isArray(row.sampleStatuses)
  ) {
    return null
  }
  const sampleStatuses: WebsiteSitemapSampleStatus[] = []
  for (const item of row.sampleStatuses) {
    const parsed = readSampleStatus(item)
    if (!parsed) return null
    sampleStatuses.push(parsed)
  }
  return {
    found,
    urlCount,
    sampleChecked,
    sampleNotFound,
    sampleStatuses,
    lastmod: asString(row.lastmod),
  }
}

export function readWebsiteCrawl(value: unknown): WebsiteCrawl | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const finalUrl = asString(row.finalUrl)
  const https = asBool(row.https)
  if (!finalUrl || https === null || !Array.isArray(row.pages)) return null
  const pages: WebsitePageSnapshot[] = []
  for (const item of row.pages) {
    const parsed = readPage(item)
    if (!parsed) return null
    pages.push(parsed)
  }
  const robots = readRobots(row.robots)
  const sitemap = readSitemap(row.sitemap)
  const signals = readSignals(row.signals)
  if (!robots || !sitemap || !signals) return null
  return {
    finalUrl,
    https,
    pages,
    robots,
    sitemap,
    signals,
    llmsTxt: readLlmsTxt(row.llmsTxt),
    variants: readVariants(row.variants),
  }
}

function readVariants(value: unknown): WebsiteVariantSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const hostMismatch = asBool(row.hostMismatch)
  const slashMismatch = asBool(row.slashMismatch)
  if (hostMismatch === null || slashMismatch === null) return null
  return {
    hostMismatch,
    slashMismatch,
    httpsMismatch: asBool(row.httpsMismatch) ?? false,
  }
}

export function readLeadWebsiteAuditRow(
  row: Record<string, unknown>,
  entry: WebsiteReviewEntry = emptyWebsiteReviewEntry(),
): LeadWebsiteAudit | null {
  const id = asString(row.id)
  const lead_id = asString(row.lead_id)
  const channel_id = asString(row.channel_id)
  const url = asString(row.url)
  const fetched_at = asString(row.fetched_at)
  const fetched_by = asString(row.fetched_by)
  const crawl = readWebsiteCrawl(row.crawl)
  if (!id || !lead_id || !channel_id || !url || !fetched_at || !fetched_by) {
    return null
  }
  if (!crawl) return null
  let pagespeed: WebsitePagespeedSnapshot | null = null
  if (row.pagespeed != null) {
    pagespeed = readWebsitePagespeed(row.pagespeed)
    if (!pagespeed) return null
  }
  if (row.pagespeed_at != null && typeof row.pagespeed_at !== "string") {
    return null
  }
  const pagespeed_at = asString(row.pagespeed_at)
  if (pagespeed_at && !pagespeed) return null
  return {
    id,
    lead_id,
    channel_id,
    url,
    fetched_at,
    fetched_by,
    crawl,
    review: entry.review,
    notes: entry.notes,
    pagespeed,
    pagespeed_at,
    jobs: readWebsitePsiJobs(row.lead_website_jobs),
  }
}

export function readLeadWebsiteAudits(
  embed: unknown,
  reviewsByChannel?: ReadonlyMap<string, WebsiteReviewEntry>,
): LeadWebsiteAudit[] {
  if (!Array.isArray(embed)) return []
  // A tabela e append-only, entao o mesmo canal traz varios snapshots.
  // A aplicacao le sempre o mais recente, sem depender da ordem da consulta.
  const latest = new Map<string, LeadWebsiteAudit>()
  for (const row of embed) {
    if (!row || typeof row !== "object") continue
    const record = row as Record<string, unknown>
    const channelId = asString(record.channel_id)
    const entry = channelId ? reviewsByChannel?.get(channelId) : undefined
    const audit = readLeadWebsiteAuditRow(record, entry)
    if (!audit) continue
    const current = latest.get(audit.channel_id)
    if (current && current.fetched_at >= audit.fetched_at) continue
    latest.set(audit.channel_id, audit)
  }
  return [...latest.values()]
}

export function websiteHomePage(
  crawl: WebsiteCrawl,
): WebsitePageSnapshot | null {
  if (crawl.pages.length === 0) return null
  const finalPath = pathOf(crawl.finalUrl)
  return (
    crawl.pages.find((page) => pathOf(page.url) === finalPath) ?? crawl.pages[0]
  )
}

function pathOf(urlOrPath: string): string {
  try {
    const url = urlOrPath.includes("://")
      ? new URL(urlOrPath)
      : new URL(urlOrPath, "https://website.local")
    return normalizePath(url.pathname)
  } catch {
    const path = urlOrPath.split("?")[0] ?? urlOrPath
    return normalizePath(path)
  }
}

function normalizePath(path: string): string {
  const trimmed = path.trim() || "/"
  const lower = trimmed.toLowerCase()
  if (lower !== "/" && lower.endsWith("/")) return lower.slice(0, -1)
  return lower
}

function uniquePaths(crawl: WebsiteCrawl): string[] {
  const seen = new Set<string>()
  for (const page of crawl.pages) {
    seen.add(pathOf(page.url))
    for (const path of page.internalPaths) seen.add(pathOf(path))
  }
  return [...seen]
}

export function isUnfriendlyUrl(urlOrPath: string): boolean {
  try {
    const url = urlOrPath.includes("://")
      ? new URL(urlOrPath)
      : new URL(urlOrPath, "https://website.local")
    if ([...url.searchParams].length > 0) return true
    if (url.pathname.length > 80) return true
    const path = url.pathname.toLowerCase()
    if (
      path.includes(".php") ||
      path.includes(".aspx") ||
      path.includes(".jsp")
    ) {
      return true
    }
    return /\/\d{3,}(?:\/|$)/.test(path)
  } catch {
    return urlOrPath.includes("?") || urlOrPath.length > 80
  }
}

export function websiteTitleIsGeneric(
  title: string | null,
  companyName: string,
): boolean {
  if (!title) return true
  const folded = fold(title)
  if (GENERIC_TITLES.has(folded)) return true
  if (GENERIC_TITLE_FRAGMENTS.some((fragment) => folded.includes(fragment))) {
    return true
  }
  if (folded === fold(companyName)) return true
  return folded.length < 15
}

function allSchemaTypes(crawl: WebsiteCrawl): string[] {
  return crawl.pages.flatMap((page) =>
    page.schemaTypes.map((type) => type.trim().toLowerCase()),
  )
}

function hasLocalSchema(types: string[]): boolean {
  return types.some((type) => LOCAL_SCHEMA_TYPES.has(type))
}

function digits(value: string): string {
  return value.replace(/\D+/g, "")
}

function phoneMatches(gbpPhone: string, page: WebsitePageSnapshot): boolean {
  const expected = digits(gbpPhone)
  if (expected.length < 8) return true
  const needle = expected.slice(-8)
  for (const phone of page.phones) {
    const run = digits(phone)
    if (run.endsWith(needle) || run.includes(needle)) return true
  }
  return digits(page.textExcerpt).includes(needle)
}

function addressTokens(address: string): string[] {
  const folded = fold(address).normalize("NFD").replace(/\p{M}/gu, "")
  return folded.split(/[^a-z0-9]+/).filter((token) => {
    if (!token || ADDRESS_STOPWORDS.has(token)) return false
    if (/^\d+$/.test(token)) return token.length >= 3
    return token.length >= 4
  })
}

function addressMatches(address: string, page: WebsitePageSnapshot): boolean {
  const tokens = addressTokens(address)
  if (tokens.length === 0) return true
  const haystack = fold(page.textExcerpt)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
  const hits = tokens.filter((token) => haystack.includes(token))
  const needed = Math.min(2, tokens.length)
  return hits.length >= needed
}

/**
 * Estado de cada componente do NAP, avaliado de forma independente.
 *
 * `absent` é distinto de `match` de propósito: antes desta separação,
 * "o perfil não tem endereço", "o endereço confere" e "o endereço nem foi
 * conferido" produziam exatamente o mesmo resultado — silêncio —, porque as
 * funções de comparação retornam `true` quando não há o que verificar e o
 * telefone curto-circuitava a checagem do endereço.
 */
export type NapComponentState = "absent" | "match" | "mismatch"

export type NapCheck = {
  phone: NapComponentState
  address: NapComponentState
}

export function napCheckForPage(
  nap: WebsiteNapInput | null | undefined,
  page: WebsitePageSnapshot,
): NapCheck {
  const check: NapCheck = { phone: "absent", address: "absent" }
  if (!nap) return check
  if (nap.phone && digits(nap.phone).length >= 8) {
    check.phone = phoneMatches(nap.phone, page) ? "match" : "mismatch"
  }
  if (nap.address && addressTokens(nap.address).length > 0) {
    check.address = addressMatches(nap.address, page) ? "match" : "mismatch"
  }
  return check
}

/** Conveniência para quem tem o crawl em mãos: avalia contra a home. */
export function napCheckForCrawl(
  crawl: WebsiteCrawl,
  nap: WebsiteNapInput | null | undefined,
): NapCheck {
  const home = websiteHomePage(crawl)
  if (!home) return { phone: "absent", address: "absent" }
  return napCheckForPage(nap, home)
}

const SERVICE_TITLE_MIN = 4

function foldToken(value: string): string {
  return fold(value).normalize("NFD").replace(/\p{M}/gu, "")
}

function serviceNeedles(titles: readonly string[]): string[] {
  return titles
    .map((title) => foldToken(title))
    .filter((title) => title.length >= SERVICE_TITLE_MIN)
}

function mentionsService(
  haystack: string,
  needles: readonly string[],
): boolean {
  if (needles.length === 0) return false
  const folded = foldToken(haystack)
  return needles.some((needle) => folded.includes(needle))
}

function hasServicePages(
  crawl: WebsiteCrawl,
  paths: readonly string[],
  serviceTitles: readonly string[],
): boolean {
  if (paths.some((path) => SERVICE_PATH.test(path))) return true
  const needles = serviceNeedles(serviceTitles)
  if (needles.length === 0) return false
  if (paths.some((path) => mentionsService(path, needles))) return true
  return crawl.pages.some((page) =>
    mentionsService([page.title ?? "", ...page.h1].join(" "), needles),
  )
}

export function websiteGapsForAudit(
  crawl: WebsiteCrawl,
  companyName: string,
  nap?: WebsiteNapInput | null,
  pagespeed?: WebsitePagespeedSnapshot | null,
  serviceTitles: readonly string[] = [],
): WebsiteGapId[] {
  const gaps: WebsiteGapId[] = []
  const home = websiteHomePage(crawl)
  if (!home) return gaps

  if (!crawl.https || !crawl.finalUrl.startsWith("https:")) {
    gaps.push("no_https")
  }
  if (home.indexable === false) gaps.push("noindex")

  // Canonical: seis regras por pagina, avaliadas sobre a amostra.
  gaps.push(
    ...canonicalIssuesForSample(
      crawl.pages.map((page) => ({
        url: page.url,
        canonical: page.canonical,
        indexable: page.indexable,
        status: page.status,
      })),
    ),
  )
  if (crawl.variants?.hostMismatch) gaps.push("host_canonicalization")
  if (crawl.variants?.slashMismatch) gaps.push("slash_canonicalization")
  if (crawl.variants?.httpsMismatch) gaps.push("https_canonicalization")
  gaps.push(...redirectIssuesForPages(crawl.pages))

  // Um unico gap para os headers, com o detalhe listando quais faltam: seis
  // gaps separados poluiriam o roadmap sem ganho de leitura.
  if (
    crawl.pages.some(
      (page) =>
        page.status > 0 &&
        page.status < 400 &&
        missingSecurityHeaders(page.headers).length > 0,
    )
  ) {
    gaps.push("weak_security_headers")
  }

  if (crawl.pages.some((page) => headingsSkipLevel(page.headings))) {
    gaps.push("heading_hierarchy")
  }

  const homePath = pathOf(crawl.finalUrl)
  if (
    crawl.pages.some(
      (page) => pathOf(page.url) !== homePath && page.indexable === false,
    )
  ) {
    gaps.push("noindex_internal_pages")
  }

  if (
    crawl.robots.groups.length > 0 &&
    crawl.pages.some((page) =>
      robotsBlocksPath(crawl.robots.groups, "googlebot", pathOf(page.url)),
    )
  ) {
    gaps.push("robots_blocks_search")
  }
  if (!crawl.sitemap.found) gaps.push("missing_sitemap")
  else if (
    crawl.sitemap.urlCount >= WEBSITE_SITEMAP_BLOAT_MIN_URLS &&
    crawl.sitemap.sampleChecked >= WEBSITE_SITEMAP_BLOAT_MIN_SAMPLE &&
    crawl.sitemap.sampleNotFound / crawl.sitemap.sampleChecked >=
      WEBSITE_SITEMAP_BLOAT_NOT_FOUND_RATIO
  ) {
    gaps.push("sitemap_bloat")
  }

  const paths = uniquePaths(crawl)
  if (paths.length <= WEBSITE_FEW_PAGES_MAX) gaps.push("few_pages")
  if (crawl.pages.some((page) => isUnfriendlyUrl(page.url))) {
    gaps.push("unfriendly_urls")
  }
  if (!hasServicePages(crawl, paths, serviceTitles)) {
    gaps.push("no_service_pages")
  }
  if (!paths.some((path) => BLOG_PATH.test(path))) gaps.push("no_blog")
  gaps.push(...complianceIssuesForPaths(paths))

  if (
    crawl.pages.some((page) => websiteTitleIsGeneric(page.title, companyName))
  ) {
    gaps.push("generic_title")
  }
  if (crawl.pages.some((page) => !page.metaDescription)) {
    gaps.push("missing_meta_description")
  }
  if (crawl.pages.some((page) => page.h1.length === 0)) {
    gaps.push("missing_h1")
  }

  const h1Seen = new Map<string, number>()
  let duplicateOnPage = false
  for (const page of crawl.pages) {
    if (page.h1.length > 1) duplicateOnPage = true
    for (const heading of page.h1) {
      const key = fold(heading)
      h1Seen.set(key, (h1Seen.get(key) ?? 0) + 1)
    }
  }
  if (duplicateOnPage || [...h1Seen.values()].some((count) => count > 1)) {
    gaps.push("duplicate_h1")
  }

  const thinCount = crawl.pages.filter(
    (page) => page.wordCount < WEBSITE_THIN_CONTENT_WORDS,
  ).length
  if (
    home.wordCount < WEBSITE_THIN_CONTENT_WORDS ||
    thinCount > crawl.pages.length / 2
  ) {
    gaps.push("thin_content")
  }
  if (
    crawl.pages.some((page) => page.imageCount > 0 && page.imagesWithoutAlt > 0)
  ) {
    gaps.push("images_missing_alt")
  }
  if (home.internalLinkCount === 0) gaps.push("no_internal_links")

  const schema = allSchemaTypes(crawl)
  if (schema.length === 0) gaps.push("no_schema")
  else if (!hasLocalSchema(schema)) gaps.push("no_local_schema")

  if (!home.hasTel && !home.hasWhatsapp) gaps.push("weak_cta")
  if (
    home.contactInFooterOnly &&
    (home.hasTel || home.hasWhatsapp || home.hasMailto)
  ) {
    gaps.push("contact_only_in_footer")
  }

  // Telefone e endereço são avaliados de forma independente: um telefone que
  // confere não pode mais impedir a checagem do endereço.
  const napCheck = napCheckForPage(nap, home)
  if (napCheck.phone === "mismatch" || napCheck.address === "mismatch") {
    gaps.push("nap_mismatch")
  }

  gaps.push(...websitePagespeedGaps(crawl.https, pagespeed ?? null))
  return [...new Set(gaps)]
}
