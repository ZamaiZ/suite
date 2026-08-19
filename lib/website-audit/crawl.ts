import {
  WEBSITE_FETCH_CONCURRENCY,
  WEBSITE_MAX_INTERNAL_PAGES,
  WEBSITE_MAX_SITEMAP_FILES,
  type WebsiteCrawl,
  type WebsitePageSnapshot,
  type WebsiteRobotsSnapshot,
  type WebsiteSitemapSampleStatus,
} from "../leads/website-audit.ts"
import { safeFetch, safeFetchStatus, WEBSITE_FETCH_FAILED } from "./fetch.ts"
import { crawlTargetsFromHome, parseHtmlPage } from "./parse.ts"
import {
  extractSitemapLocs,
  parseRobotsSitemaps,
  pickSitemapSample,
  sitemapSnapshotFromSample,
} from "./sitemap.ts"

export type CrawlWebsiteResult =
  | { status: "ok"; crawl: WebsiteCrawl }
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
): Promise<WebsitePageSnapshot | null> {
  const fetched = await safeFetch(url, "GET")
  if (fetched.status === "error") return null
  if (fetched.statusCode >= 400) {
    return parseHtmlPage(fetched.body, fetched.url, fetched.statusCode)
  }
  return parseHtmlPage(fetched.body, fetched.url, fetched.statusCode)
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

export async function crawlWebsite(startUrl: string): Promise<CrawlWebsiteResult> {
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

  const home = parseHtmlPage(homeFetch.body, homeFetch.url, homeFetch.statusCode)
  const targets = crawlTargetsFromHome(home, homeUrl).slice(
    0,
    WEBSITE_MAX_INTERNAL_PAGES,
  )

  const robotsUrl = new URL("/robots.txt", homeUrl).toString()
  const [internalPages, robotsFetch] = await Promise.all([
    mapPool(targets, WEBSITE_FETCH_CONCURRENCY, fetchPage),
    safeFetch(robotsUrl, "GET"),
  ])

  const pages: WebsitePageSnapshot[] = [
    home,
    ...internalPages.filter((page): page is WebsitePageSnapshot => page !== null),
  ]

  const robots: WebsiteRobotsSnapshot =
    robotsFetch.status === "ok" && robotsFetch.statusCode < 400
      ? {
          found: true,
          sitemapUrls: parseRobotsSitemaps(robotsFetch.body),
        }
      : { found: false, sitemapUrls: [] }

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
    },
  }
}
