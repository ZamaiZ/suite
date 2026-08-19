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
}

export type WebsiteSitemapSampleStatus = {
  url: string
  status: number | null
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
}

export type WebsiteRobotsSnapshot = {
  found: boolean
  sitemapUrls: string[]
}

export type WebsiteSitemapSnapshot = {
  found: boolean
  urlCount: number
  sampleChecked: number
  sampleNotFound: number
  sampleStatuses: WebsiteSitemapSampleStatus[]
}

export type WebsiteCrawl = {
  finalUrl: string
  https: boolean
  pages: WebsitePageSnapshot[]
  robots: WebsiteRobotsSnapshot
  sitemap: WebsiteSitemapSnapshot
}

export type LeadWebsiteAudit = {
  id: string
  lead_id: string
  channel_id: string
  url: string
  fetched_at: string
  fetched_by: string
  crawl: WebsiteCrawl
  notes: string | null
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
  }
}

function readRobots(value: unknown): WebsiteRobotsSnapshot | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const found = asBool(row.found)
  const sitemapUrls = asStringList(row.sitemapUrls)
  if (found === null || !sitemapUrls) return null
  return { found, sitemapUrls }
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
  if (!robots || !sitemap) return null
  return { finalUrl, https, pages, robots, sitemap }
}

export function readLeadWebsiteAuditRow(
  row: Record<string, unknown>,
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
  if (row.notes != null && typeof row.notes !== "string") return null
  return {
    id,
    lead_id,
    channel_id,
    url,
    fetched_at,
    fetched_by,
    crawl,
    notes: asString(row.notes),
  }
}

export function readLeadWebsiteAudits(embed: unknown): LeadWebsiteAudit[] {
  if (!Array.isArray(embed)) return []
  const audits: LeadWebsiteAudit[] = []
  const seen = new Set<string>()
  for (const row of embed) {
    if (!row || typeof row !== "object") continue
    const audit = readLeadWebsiteAuditRow(row as Record<string, unknown>)
    if (!audit || seen.has(audit.id)) continue
    seen.add(audit.id)
    audits.push(audit)
  }
  return audits
}

function homePage(crawl: WebsiteCrawl): WebsitePageSnapshot | null {
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
    if (path.includes(".php") || path.includes(".aspx") || path.includes(".jsp")) {
      return true
    }
    return /\/\d{3,}(?:\/|$)/.test(path)
  } catch {
    return urlOrPath.includes("?") || urlOrPath.length > 80
  }
}

function isGenericTitle(title: string | null, companyName: string): boolean {
  if (!title) return true
  const folded = fold(title)
  if (GENERIC_TITLES.has(folded)) return true
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
  const folded = fold(address)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
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

export function websiteGapsForAudit(
  crawl: WebsiteCrawl,
  companyName: string,
  nap?: WebsiteNapInput | null,
): WebsiteGapId[] {
  const gaps: WebsiteGapId[] = []
  const home = homePage(crawl)
  if (!home) return gaps

  if (!crawl.https || !crawl.finalUrl.startsWith("https:")) {
    gaps.push("no_https")
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
  if (!paths.some((path) => SERVICE_PATH.test(path))) {
    gaps.push("no_service_pages")
  }
  if (!paths.some((path) => BLOG_PATH.test(path))) gaps.push("no_blog")

  if (isGenericTitle(home.title, companyName)) gaps.push("generic_title")
  if (!home.metaDescription) gaps.push("missing_meta_description")
  if (home.h1.length === 0) gaps.push("missing_h1")

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

  if (home.wordCount < WEBSITE_THIN_CONTENT_WORDS) gaps.push("thin_content")
  if (home.imageCount > 0 && home.imagesWithoutAlt > 0) {
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

  if (nap && (nap.phone || nap.address)) {
    const phoneOk = nap.phone ? phoneMatches(nap.phone, home) : true
    const addressOk = nap.address ? addressMatches(nap.address, home) : true
    if (!phoneOk || !addressOk) gaps.push("nap_mismatch")
  }

  return gaps
}
