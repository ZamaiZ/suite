import { normalizeWebsiteDomain } from "./website.ts"

/**
 * Regras de canonical por pagina da amostra.
 *
 * A coleta nao extraia canonical, entao nenhuma das situacoes abaixo era
 * detectavel — nem a mais comum, que e a ausencia. Todas operam sobre as ate
 * nove paginas efetivamente buscadas; duplicidade em escala continua fora do
 * escopo desta etapa.
 */
export type CanonicalIssueId =
  | "canonical_missing"
  | "canonical_points_elsewhere"
  | "canonical_external"
  | "canonical_insecure"
  | "canonical_vs_noindex"
  | "canonical_non_indexable"

export type CanonicalPage = {
  url: string
  canonical: string | null
  indexable: boolean
  status: number
}

export function normalizeCanonical(
  raw: string | undefined | null,
  pageUrl: URL,
): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed, pageUrl)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
    return parsed.href
  } catch {
    return null
  }
}

function samePath(left: URL, right: URL): boolean {
  const strip = (path: string) =>
    path !== "/" && path.endsWith("/") ? path.slice(0, -1) : path || "/"
  return strip(left.pathname) === strip(right.pathname)
}

function sameHost(left: URL, right: URL): boolean {
  const a = normalizeWebsiteDomain(left.hostname)
  const b = normalizeWebsiteDomain(right.hostname)
  return Boolean(a && b && a === b)
}

/**
 * Uma pagina que respondeu erro nao gera achado de canonical: o achado ali e o
 * proprio status, e cobrar canonical de um 404 seria ruido.
 */
export function canonicalIssuesForPage(
  page: CanonicalPage,
  sample: readonly CanonicalPage[],
): CanonicalIssueId[] {
  if (page.status >= 400 || page.status === 0) return []

  let pageUrl: URL
  try {
    pageUrl = new URL(page.url)
  } catch {
    return []
  }

  if (!page.canonical) return ["canonical_missing"]

  let canonicalUrl: URL
  try {
    canonicalUrl = new URL(page.canonical)
  } catch {
    return ["canonical_missing"]
  }

  const issues: CanonicalIssueId[] = []

  if (!page.indexable) issues.push("canonical_vs_noindex")

  if (!sameHost(canonicalUrl, pageUrl)) {
    issues.push("canonical_external")
    return issues
  }

  if (pageUrl.protocol === "https:" && canonicalUrl.protocol === "http:") {
    issues.push("canonical_insecure")
  }

  if (!samePath(canonicalUrl, pageUrl)) {
    issues.push("canonical_points_elsewhere")
    const target = sample.find((item) => {
      try {
        return samePath(new URL(item.url), canonicalUrl)
      } catch {
        return false
      }
    })
    if (target && (!target.indexable || target.status >= 400)) {
      issues.push("canonical_non_indexable")
    }
  }

  return issues
}

export function canonicalIssuesForSample(
  sample: readonly CanonicalPage[],
): CanonicalIssueId[] {
  const found = new Set<CanonicalIssueId>()
  for (const page of sample) {
    for (const issue of canonicalIssuesForPage(page, sample)) {
      found.add(issue)
    }
  }
  return [...found]
}
