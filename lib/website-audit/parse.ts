import { load } from "cheerio"
import {
  WEBSITE_INTERNAL_PATHS_MAX,
  WEBSITE_TEXT_EXCERPT_MAX,
  type WebsitePageSnapshot,
} from "../leads/website-audit.ts"
import { normalizeWebsiteDomain } from "../leads/website.ts"

const SKIP_ASSET =
  /\.(?:pdf|jpe?g|png|gif|webp|svg|zip|css|js|mjs|ico|woff2?|ttf|eot|mp4|mp3|xml)(?:$|\?)/i
const TRACKING_PARAM = /^(utm_|gclid|fbclid|gbraid|wbraid|msclkid|mc_)/i
const PHONE_RE = /(?:\+?55)?\s*(?:\(?\d{2}\)?\s*)?\d{4,5}[-\s]?\d{4}/g

function sameSite(left: URL, right: URL): boolean {
  const a = normalizeWebsiteDomain(left.hostname)
  const b = normalizeWebsiteDomain(right.hostname)
  return Boolean(a && b && a === b)
}

function decodeHref(raw: string, base: URL): URL | null {
  const trimmed = raw.trim()
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("javascript:")) {
    return null
  }
  try {
    return new URL(trimmed, base)
  } catch {
    return null
  }
}

function stripTracking(url: URL): URL {
  const next = new URL(url.toString())
  for (const key of [...next.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) next.searchParams.delete(key)
  }
  return next
}

export function internalPathFromHref(
  href: string,
  pageUrl: URL,
): string | null {
  const parsed = decodeHref(href, pageUrl)
  if (!parsed) return null
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
  if (!sameSite(parsed, pageUrl)) return null
  if (SKIP_ASSET.test(parsed.pathname)) return null
  const clean = stripTracking(parsed)
  const path = clean.pathname || "/"
  const normalized = path !== "/" && path.endsWith("/") ? path.slice(0, -1) : path
  if ([...clean.searchParams].length > 0) {
    return `${normalized}?${clean.searchParams.toString()}`
  }
  return normalized || "/"
}

function schemaTypesFromJson(value: unknown, acc: Set<string>): void {
  if (!value) return
  if (Array.isArray(value)) {
    for (const item of value) schemaTypesFromJson(item, acc)
    return
  }
  if (typeof value !== "object") return
  const row = value as Record<string, unknown>
  if ("@graph" in row) schemaTypesFromJson(row["@graph"], acc)
  const type = row["@type"]
  if (typeof type === "string" && type.trim()) acc.add(type.trim())
  if (Array.isArray(type)) {
    for (const item of type) {
      if (typeof item === "string" && item.trim()) acc.add(item.trim())
    }
  }
}

function isWhatsappHref(href: string): boolean {
  const lower = href.toLowerCase()
  return (
    lower.includes("wa.me/") ||
    lower.includes("api.whatsapp.com") ||
    lower.includes("whatsapp.com/send")
  )
}

function phonesFromTel(href: string): string | null {
  if (!href.toLowerCase().startsWith("tel:")) return null
  const number = href.slice(4).trim()
  return number || null
}

export function parseHtmlPage(
  html: string,
  pageUrl: string,
  status: number,
): WebsitePageSnapshot {
  const url = new URL(pageUrl)
  const $ = load(html)

  const types = new Set<string>()
  $('script[type="application/ld+json"]').each((_, node) => {
    const raw = $(node).text()
    if (!raw.trim()) return
    try {
      schemaTypesFromJson(JSON.parse(raw) as unknown, types)
    } catch {
      return
    }
  })

  $("script, style, noscript, svg, canvas").remove()

  const title = $("title").first().text().replace(/\s+/g, " ").trim() || null
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    null

  const h1 = $("h1")
    .toArray()
    .map((node) => $(node).text().replace(/\s+/g, " ").trim())
    .filter(Boolean)
  const h2 = $("h2")
    .toArray()
    .map((node) => $(node).text().replace(/\s+/g, " ").trim())
    .filter(Boolean)

  const bodyText = $("body").text().replace(/\s+/g, " ").trim()
  const words = bodyText ? bodyText.split(" ").filter(Boolean) : []
  const textExcerpt = bodyText.slice(0, WEBSITE_TEXT_EXCERPT_MAX)

  const images = $("img").toArray()
  const imageCount = images.length
  const imagesWithoutAlt = images.filter((node) => {
    const alt = $(node).attr("alt")
    return alt === undefined || alt.trim().length === 0
  }).length

  const pathSet = new Set<string>()
  $("a[href]").each((_, node) => {
    const href = $(node).attr("href")
    if (!href) return
    const path = internalPathFromHref(href, url)
    if (path) pathSet.add(path)
  })
  const pagePath = url.pathname !== "/" && url.pathname.endsWith("/")
    ? url.pathname.slice(0, -1)
    : url.pathname || "/"
  pathSet.delete(pagePath)
  pathSet.delete("/")
  const internalPaths = [...pathSet].slice(0, WEBSITE_INTERNAL_PATHS_MAX)

  const hrefs = $("a[href]")
    .toArray()
    .map((node) => $(node).attr("href")?.trim() ?? "")
    .filter(Boolean)

  const hasTel = hrefs.some((href) => href.toLowerCase().startsWith("tel:"))
  const hasWhatsapp = hrefs.some((href) => isWhatsappHref(href))
  const hasMailto = hrefs.some((href) => href.toLowerCase().startsWith("mailto:"))

  const phones = [
    ...new Set(
      hrefs
        .map((href) => phonesFromTel(href))
        .filter((item): item is string => Boolean(item)),
    ),
  ]
  const excerptPhones = textExcerpt.match(PHONE_RE) ?? []
  for (const phone of excerptPhones) {
    const trimmed = phone.replace(/\s+/g, " ").trim()
    if (trimmed && !phones.includes(trimmed)) phones.push(trimmed)
  }

  const footer = $("footer, [role='contentinfo']").first()
  const contactHrefs = hrefs.filter(
    (href) =>
      href.toLowerCase().startsWith("tel:") ||
      href.toLowerCase().startsWith("mailto:") ||
      isWhatsappHref(href),
  )
  let contactInFooterOnly = false
  if (contactHrefs.length > 0 && footer.length > 0) {
    const footerHrefs = footer
      .find("a[href]")
      .toArray()
      .map((node) => $(node).attr("href")?.trim() ?? "")
      .filter(Boolean)
    contactInFooterOnly = contactHrefs.every((href) =>
      footerHrefs.includes(href),
    )
  }

  return {
    url: pageUrl,
    status,
    title,
    metaDescription,
    h1,
    h2,
    wordCount: words.length,
    imageCount,
    imagesWithoutAlt,
    internalLinkCount: internalPaths.length,
    internalPaths,
    schemaTypes: [...types],
    hasTel,
    hasWhatsapp,
    hasMailto,
    contactInFooterOnly,
    phones,
    textExcerpt,
  }
}

export function crawlTargetsFromHome(
  home: WebsitePageSnapshot,
  homeUrl: URL,
): string[] {
  const homePath = homeUrl.pathname !== "/" && homeUrl.pathname.endsWith("/")
    ? homeUrl.pathname.slice(0, -1)
    : homeUrl.pathname || "/"
  const targets: string[] = []
  const seen = new Set<string>([homePath, "/"])
  for (const path of home.internalPaths) {
    const pathOnly = path.split("?")[0] ?? path
    if (seen.has(pathOnly)) continue
    if ([...new URL(path, homeUrl).searchParams].length > 0) continue
    seen.add(pathOnly)
    targets.push(new URL(pathOnly, homeUrl).toString())
  }
  return targets
}
