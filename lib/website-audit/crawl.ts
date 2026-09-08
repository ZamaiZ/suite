import {
  EMPTY_WEBSITE_CRAWL_SIGNALS,
  WEBSITE_FETCH_CONCURRENCY,
  WEBSITE_MAX_INTERNAL_PAGES,
  WEBSITE_MAX_SITEMAP_FILES,
  emptyWebsiteCrawlSocialUrls,
  emptyWebsiteMeasurementIds,
  mergeWebsiteCrawlSignals,
  type WebsiteCrawl,
  type WebsiteCrawlSignals,
  type WebsitePageSnapshot,
  type WebsiteRobotsSnapshot,
  type WebsiteSitemapSampleStatus,
  type WebsiteVariantSnapshot,
} from "../leads/website-audit.ts"
import { safeFetch, safeFetchStatus, WEBSITE_FETCH_FAILED } from "./fetch.ts"
import {
  crawlTargetsFromHome,
  emptyPageSnapshot,
  extractHtmlSignals,
  parseHtmlPage,
} from "./parse.ts"
import {
  aiAgentsFromGroups,
  parseRobotsGroups,
  ROBOTS_CONTENT_MAX,
} from "./robots.ts"
import {
  extractSitemapLocs,
  parseRobotsSitemaps,
  pickSitemapSample,
  sitemapSnapshotFromSample,
} from "./sitemap.ts"

/**
 * Sonda as quatro variantes da home e compara onde cada par termina. Nao da
 * para responder isso lendo o HTML: e preciso buscar e ver o destino final.
 */
async function probeVariants(
  homeUrl: URL,
): Promise<WebsiteVariantSnapshot | null> {
  const host = homeUrl.hostname
  const otherHost = host.startsWith("www.") ? host.slice(4) : `www.${host}`

  const withHost = new URL(homeUrl.toString())
  withHost.hostname = otherHost

  const slashed = new URL(homeUrl.toString())
  slashed.pathname = slashed.pathname.endsWith("/")
    ? slashed.pathname.slice(0, -1) || "/"
    : `${slashed.pathname}/`

  const insecure = new URL(homeUrl.toString())
  insecure.protocol = "http:"

  const [base, hostVariant, slashVariant, insecureVariant] = await Promise.all([
    safeFetch(homeUrl.toString(), "HEAD"),
    safeFetch(withHost.toString(), "HEAD"),
    safeFetch(slashed.toString(), "HEAD"),
    safeFetch(insecure.toString(), "HEAD"),
  ])

  if (base.status !== "ok") return null

  const settle = (url: string): string => {
    try {
      const parsed = new URL(url)
      const path =
        parsed.pathname !== "/" && parsed.pathname.endsWith("/")
          ? parsed.pathname.slice(0, -1)
          : parsed.pathname
      return `${parsed.hostname}${path}`
    } catch {
      return url
    }
  }

  const target = settle(base.url)
  return {
    // Uma variante que nao resolve nao e divergencia: pode simplesmente nao
    // existir, e cobrar convergencia dela seria falso positivo.
    hostMismatch:
      hostVariant.status === "ok" &&
      hostVariant.statusCode < 400 &&
      settle(hostVariant.url) !== target,
    slashMismatch:
      slashVariant.status === "ok" &&
      slashVariant.statusCode < 400 &&
      settle(slashVariant.url) !== target,
    // `settle` compara host e caminho de proposito, ignorando o protocolo —
    // entao a convergencia http/https precisa da comparacao propria. So faz
    // sentido perguntar em site que ja e https; senao `no_https` ja responde.
    httpsMismatch:
      homeUrl.protocol === "https:" &&
      insecureVariant.status === "ok" &&
      insecureVariant.statusCode < 400 &&
      !insecureVariant.url.startsWith("https:"),
  }
}

export type CrawlWebsiteResult =
  | { status: "ok"; crawl: WebsiteCrawl; usedPaths: string[] }
  | { status: "error"; message: string }

async function mapPool<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return []
  const results = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next
      next += 1
      const item = items[index]
      if (item === undefined) return
      results[index] = await fn(item)
    }
  }
  const workers = Math.min(size, items.length)
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return results
}

async function fetchPage(
  url: string,
): Promise<{ page: WebsitePageSnapshot; signals: WebsiteCrawlSignals }> {
  const fetched = await safeFetch(url, "GET")
  // Falha vira um snapshot com status, nunca uma ausencia silenciosa: a
  // amostra e fixa, entao a lista de paginas precisa ter sempre o mesmo
  // tamanho para o comparativo fazer sentido.
  if (fetched.status === "error") {
    return {
      page: emptyPageSnapshot(url, 0, fetched.redirects ?? null),
      signals: {
        ...EMPTY_WEBSITE_CRAWL_SIGNALS,
        socialUrls: emptyWebsiteCrawlSocialUrls(),
        measurementIds: emptyWebsiteMeasurementIds(),
      },
    }
  }
  if (fetched.statusCode >= 400) {
    return {
      page: emptyPageSnapshot(
        fetched.url,
        fetched.statusCode,
        fetched.redirects,
      ),
      signals: {
        ...EMPTY_WEBSITE_CRAWL_SIGNALS,
        socialUrls: emptyWebsiteCrawlSocialUrls(),
        measurementIds: emptyWebsiteMeasurementIds(),
      },
    }
  }
  return {
    page: parseHtmlPage(
      fetched.body,
      fetched.url,
      fetched.statusCode,
      fetched.headers,
      fetched.redirects,
    ),
    signals: extractHtmlSignals(fetched.body, fetched.url),
  }
}

async function collectSitemapUrls(
  start: URL,
  robotsSitemaps: string[],
): Promise<{ found: boolean; urls: string[] }> {
  const seeds =
    robotsSitemaps.length > 0
      ? robotsSitemaps
      : [new URL("/sitemap.xml", start).toString()]
  const queue = seeds.slice(0, WEBSITE_MAX_SITEMAP_FILES)
  const urls: string[] = []
  const seenFile = new Set<string>()
  let files = 0
  let found = false

  while (queue.length > 0 && files < WEBSITE_MAX_SITEMAP_FILES) {
    const file = queue.shift()
    if (!file || seenFile.has(file)) continue
    seenFile.add(file)
    files += 1
    const fetched = await safeFetch(file, "GET")
    if (fetched.status === "error" || fetched.statusCode >= 400) continue
    const parsed = extractSitemapLocs(fetched.body)
    if (parsed.locs.length === 0) continue
    found = true
    if (parsed.kind === "index") {
      for (const loc of parsed.locs) {
        if (queue.length + files >= WEBSITE_MAX_SITEMAP_FILES) break
        if (!seenFile.has(loc)) queue.push(loc)
      }
      continue
    }
    urls.push(...parsed.locs)
  }

  return { found, urls }
}

/**
 * @param fixedPaths amostra ja fixada para o canal. Quando vem preenchida, ela
 * substitui a derivacao a partir da home, para que coletas sucessivas leiam as
 * mesmas URLs. Vazia, a amostra e derivada e devolvida em `usedPaths` para ser
 * persistida pelo chamador.
 */
export async function crawlWebsite(
  startUrl: string,
  fixedPaths: readonly string[] = [],
): Promise<CrawlWebsiteResult> {
  const homeFetch = await safeFetch(startUrl, "GET")
  if (homeFetch.status === "error") {
    return { status: "error", message: homeFetch.message }
  }
  if (homeFetch.statusCode >= 400) {
    return { status: "error", message: WEBSITE_FETCH_FAILED }
  }

  let homeUrl: URL
  try {
    homeUrl = new URL(homeFetch.url)
  } catch {
    return { status: "error", message: WEBSITE_FETCH_FAILED }
  }

  const home = parseHtmlPage(
    homeFetch.body,
    homeFetch.url,
    homeFetch.statusCode,
    homeFetch.headers,
    homeFetch.redirects,
  )
  const homeSignals = extractHtmlSignals(homeFetch.body, homeFetch.url)
  const usedPaths =
    fixedPaths.length > 0
      ? [...fixedPaths].slice(0, WEBSITE_MAX_INTERNAL_PAGES)
      : crawlTargetsFromHome(home, homeUrl)
          .slice(0, WEBSITE_MAX_INTERNAL_PAGES)
          .map((target) => new URL(target).pathname)
  const targets = usedPaths.map((path) => new URL(path, homeUrl).toString())

  const robotsUrl = new URL("/robots.txt", homeUrl).toString()
  const llmsUrl = new URL("/llms.txt", homeUrl).toString()
  const [internalPages, robotsFetch, llmsFetch, variants] = await Promise.all([
    mapPool(targets, WEBSITE_FETCH_CONCURRENCY, fetchPage),
    safeFetch(robotsUrl, "GET"),
    safeFetchStatus(llmsUrl),
    probeVariants(homeUrl),
  ])

  const fetchedPages = internalPages
  const pages: WebsitePageSnapshot[] = [
    home,
    ...fetchedPages.map((item) => item.page),
  ]
  const signals = fetchedPages.reduce(
    (acc, item) => mergeWebsiteCrawlSignals(acc, item.signals),
    homeSignals,
  )

  let robots: WebsiteRobotsSnapshot = {
    found: false,
    sitemapUrls: [],
    content: "",
    groups: [],
    aiAgents: [],
  }
  if (robotsFetch.status === "ok" && robotsFetch.statusCode < 400) {
    const groups = parseRobotsGroups(robotsFetch.body)
    robots = {
      found: true,
      sitemapUrls: parseRobotsSitemaps(robotsFetch.body),
      // O texto bruto fica guardado para que uma analise futura nao dependa
      // de recoletar o arquivo.
      content: robotsFetch.body.slice(0, ROBOTS_CONTENT_MAX),
      groups,
      aiAgents: aiAgentsFromGroups(groups),
    }
  }

  const collected = await collectSitemapUrls(homeUrl, robots.sitemapUrls)
  const sampleUrls = pickSitemapSample(collected.urls)
  const sampleRows = await mapPool(
    sampleUrls,
    WEBSITE_FETCH_CONCURRENCY,
    async (url): Promise<WebsiteSitemapSampleStatus> => {
      const checked = await safeFetchStatus(url)
      return { url, status: checked.status }
    },
  )

  return {
    status: "ok",
    usedPaths,
    crawl: {
      finalUrl: homeFetch.url,
      https: homeFetch.url.startsWith("https:"),
      pages,
      robots,
      sitemap: sitemapSnapshotFromSample(
        collected.found,
        collected.urls.length,
        sampleRows,
      ),
      signals,
      llmsTxt: {
        found: llmsFetch.status !== null && llmsFetch.status < 400,
        status: llmsFetch.status,
      },
      variants,
    },
  }
}
