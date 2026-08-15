export const TAG_NAME_MAX = 32
export const TAGS_PER_LEAD_MAX = 8

const TAG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export type LeadTag = {
  id: string
  name: string
}

export function normalizeTagName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, " ")
  if (name.length < 1 || name.length > TAG_NAME_MAX) return null
  return name
}

export function tagSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function isTagSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= TAG_NAME_MAX &&
    TAG_SLUG_PATTERN.test(value)
  )
}

export function parseTagNames(raw: string[]): string[] {
  const names: string[] = []
  const seen = new Set<string>()
  for (const value of raw) {
    const name = normalizeTagName(value)
    if (!name) continue
    const slug = tagSlug(name)
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    names.push(name)
    if (names.length >= TAGS_PER_LEAD_MAX) break
  }
  return names
}

export function readLeadTags(embed: unknown): LeadTag[] {
  if (!Array.isArray(embed)) return []
  const tags: LeadTag[] = []
  const seen = new Set<string>()
  for (const row of embed) {
    if (!row || typeof row !== "object") continue
    const raw = "tags" in row ? row.tags : row
    const item = Array.isArray(raw) ? raw[0] : raw
    if (!item || typeof item !== "object") continue
    const id = "id" in item ? item.id : null
    const name = "name" in item ? item.name : null
    if (typeof id !== "string" || typeof name !== "string") continue
    if (seen.has(id)) continue
    seen.add(id)
    tags.push({ id, name })
  }
  return tags
}

export function leadHasTagSlug(tags: LeadTag[], slug: string): boolean {
  return tags.some((tag) => tagSlug(tag.name) === slug)
}
