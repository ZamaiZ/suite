import {
  foldVisibilityText,
  VISIBILITY_SEARCH_CAP,
} from "./visibility-audit.ts"

export type VisibilitySeedInput = {
  companyName: string
  domain: string
  displayName: string | null
  category: string | null
  city: string | null
  rankKeywords: ReadonlyArray<string>
}

function pushUnique(
  list: string[],
  seen: Set<string>,
  value: string | null | undefined,
): void {
  if (!value) return
  const trimmed = value.trim().replace(/\s+/g, " ")
  if (!trimmed) return
  const key = foldVisibilityText(trimmed)
  if (!key || seen.has(key)) return
  seen.add(key)
  list.push(trimmed)
}

export function buildVisibilitySeedKeywords(
  input: VisibilitySeedInput,
): string[] {
  const seeds: string[] = []
  const seen = new Set<string>()

  pushUnique(seeds, seen, input.companyName)
  pushUnique(seeds, seen, input.displayName)

  const hostLabel = input.domain.replace(/\.[a-z.]+$/i, "").replace(/-/g, " ")
  pushUnique(seeds, seen, hostLabel)

  for (const keyword of input.rankKeywords) {
    pushUnique(seeds, seen, keyword)
  }

  const category = input.category?.trim() || null
  const city = input.city?.trim() || null
  if (category && city) {
    pushUnique(seeds, seen, `${category} em ${city}`)
    pushUnique(seeds, seen, `${category} ${city}`)
  } else if (category) {
    pushUnique(seeds, seen, category)
  } else if (city && input.companyName) {
    pushUnique(seeds, seen, `${input.companyName} ${city}`)
  }

  return seeds.slice(0, VISIBILITY_SEARCH_CAP)
}

export function mergeVisibilityRelatedKeywords(
  seeds: ReadonlyArray<string>,
  related: ReadonlyArray<string>,
  cap = VISIBILITY_SEARCH_CAP,
): string[] {
  const merged: string[] = []
  const seen = new Set<string>()
  for (const keyword of seeds) {
    pushUnique(merged, seen, keyword)
    if (merged.length >= cap) return merged
  }
  for (const keyword of related) {
    pushUnique(merged, seen, keyword)
    if (merged.length >= cap) return merged
  }
  return merged
}
