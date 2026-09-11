import {
  WEBSITE_SITEMAP_SAMPLE,
  type WebsiteSitemapSampleStatus,
  type WebsiteSitemapSnapshot,
} from "../leads/website-audit.ts"

export function parseRobotsSitemaps(text: string): string[] {
  const urls: string[] = []
  const seen = new Set<string>()
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*sitemap\s*:\s*(\S+)/i)
    const url = match?.[1]?.trim()
    if (!url || seen.has(url)) continue
    seen.add(url)
    urls.push(url)
  }
  return urls
}

export function extractSitemapLocs(xml: string): {
  kind: "urlset" | "index" | "unknown"
  locs: string[]
  /** `lastmod` mais recente do arquivo; `null` quando nenhuma URL declara. */
  lastmod: string | null
} {
  const isIndex = /<sitemapindex[\s>]/i.test(xml)
  const isUrlset = /<urlset[\s>]/i.test(xml)
  const locs: string[] = []
  const seen = new Set<string>()
  const pattern = /<loc>\s*([^<]+)\s*<\/loc>/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(xml))) {
    const loc = match[1]?.replace(/&amp;/g, "&").trim()
    if (!loc || seen.has(loc)) continue
    seen.add(loc)
    locs.push(loc)
  }

  // A data mais recente do arquivo inteiro. Serve de sinal de frescor do site
  // quando a home nao declara data nenhuma no JSON-LD — que e o caso comum em
  // site institucional sem blog.
  let lastmod: string | null = null
  let lastmodAt = Number.NEGATIVE_INFINITY
  const lastmodPattern = /<lastmod>\s*([^<]+)\s*<\/lastmod>/gi
  let lastmodMatch: RegExpExecArray | null
  while ((lastmodMatch = lastmodPattern.exec(xml))) {
    const value = lastmodMatch[1]?.trim()
    if (!value) continue
    const parsed = Date.parse(value)
    if (!Number.isFinite(parsed) || parsed <= lastmodAt) continue
    lastmodAt = parsed
    lastmod = value
  }

  return {
    kind: isIndex ? "index" : isUrlset ? "urlset" : "unknown",
    locs,
    lastmod,
  }
}

export function pickSitemapSample(
  urls: string[],
  size = WEBSITE_SITEMAP_SAMPLE,
): string[] {
  if (urls.length <= size) return [...urls]
  const picked: string[] = []
  const seen = new Set<number>()
  const last = urls.length - 1
  const slots = size
  for (let i = 0; i < slots; i += 1) {
    const index =
      i === 0
        ? 0
        : i === slots - 1
          ? last
          : Math.round((i / (slots - 1)) * last)
    if (seen.has(index)) continue
    seen.add(index)
    const url = urls[index]
    if (url) picked.push(url)
  }
  return picked
}

export function sitemapSnapshotFromSample(
  found: boolean,
  urlCount: number,
  sample: WebsiteSitemapSampleStatus[],
  lastmod: string | null = null,
): WebsiteSitemapSnapshot {
  const sampleNotFound = sample.filter(
    (item) => item.status !== null && item.status >= 400,
  ).length
  return {
    found,
    urlCount,
    sampleChecked: sample.length,
    sampleNotFound,
    sampleStatuses: sample,
    lastmod,
  }
}
