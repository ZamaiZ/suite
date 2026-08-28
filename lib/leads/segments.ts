export const SEGMENT_NAME_MAX = 64

const SEGMENT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export type LeadSegment = {
  id: string
  name: string
}

export function normalizeSegmentName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, " ")
  if (name.length < 1 || name.length > SEGMENT_NAME_MAX) return null
  return name
}

export function segmentSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function isSegmentSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= SEGMENT_NAME_MAX &&
    SEGMENT_SLUG_PATTERN.test(value)
  )
}

export function parseSegmentName(raw: string): string | null {
  return normalizeSegmentName(raw)
}

export function readLeadSegment(embed: unknown): LeadSegment | null {
  if (!embed || typeof embed !== "object") return null
  const item = "segments" in embed ? embed.segments : embed
  if (!item || typeof item !== "object") return null
  const id = "id" in item ? item.id : null
  const name = "name" in item ? item.name : null
  if (typeof id !== "string" || typeof name !== "string") return null
  return { id, name }
}
