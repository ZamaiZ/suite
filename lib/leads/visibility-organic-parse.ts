import { normalizeWebsiteDomain } from "./website.ts"

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function hostMatches(link: string, domain: string): boolean {
  const host = normalizeWebsiteDomain(link)
  if (!host) return false
  return host === domain || host.endsWith(`.${domain}`)
}

export function findOrganicRankForDomain(
  result: Record<string, unknown>,
  domain: string,
): { position: number; url: string | null } | null {
  const organic = result.organic_results
  if (!Array.isArray(organic)) return null
  for (const item of organic) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const link = asString(row.link) ?? asString(row.displayed_link)
    if (!link || !hostMatches(link, domain)) continue
    const position = asNumber(row.position)
    if (position === null || position < 1) continue
    return {
      position: Math.trunc(position),
      url: link,
    }
  }
  return null
}

export function collectRelatedQueries(
  result: Record<string, unknown>,
): string[] {
  const related: string[] = []
  const relatedSearches = result.related_searches
  if (Array.isArray(relatedSearches)) {
    for (const item of relatedSearches) {
      if (!item || typeof item !== "object") continue
      const query = asString((item as Record<string, unknown>).query)
      if (query) related.push(query)
    }
  }
  const relatedQuestions = result.related_questions
  if (Array.isArray(relatedQuestions)) {
    for (const item of relatedQuestions) {
      if (!item || typeof item !== "object") continue
      const query = asString((item as Record<string, unknown>).question)
      if (query) related.push(query)
    }
  }
  return related
}
