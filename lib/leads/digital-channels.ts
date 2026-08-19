import {
  canonicalWebsiteUrl,
  normalizeWebsiteDomain,
} from "@/lib/leads/website"

export const DIGITAL_CHANNEL_TYPES = [
  "website",
  "instagram",
  "linkedin",
] as const

export type DigitalChannelType = (typeof DIGITAL_CHANNEL_TYPES)[number]

export const DIGITAL_CHANNELS_MAX = 10
export const DIGITAL_CHANNEL_LIST_SEPARATOR = ";"
export const DIGITAL_CHANNEL_VALUE_MAX = 500

export const DIGITAL_CHANNEL_LABELS: Record<DigitalChannelType, string> = {
  website: "Site",
  instagram: "Instagram",
  linkedin: "LinkedIn",
}

export const DIGITAL_CHANNEL_PLACEHOLDERS: Record<DigitalChannelType, string> = {
  website: "empresa.com.br",
  instagram: "@empresa",
  linkedin: "linkedin.com/company/empresa",
}

export const DIGITAL_CHANNEL_INVALID_MESSAGE: Record<DigitalChannelType, string> =
  {
    website: "Site inválido.",
    instagram: "Instagram inválido.",
    linkedin: "LinkedIn inválido.",
  }

export const DIGITAL_CHANNEL_DUPLICATE_MESSAGE: Record<
  DigitalChannelType,
  string
> = {
  website: "Site repetido.",
  instagram: "Instagram repetido.",
  linkedin: "LinkedIn repetido.",
}

export const DIGITAL_CHANNEL_TAKEN_MESSAGE: Record<DigitalChannelType, string> = {
  website: "Este site já está cadastrado.",
  instagram: "Este Instagram já está cadastrado.",
  linkedin: "Este LinkedIn já está cadastrado.",
}

export const SPREADSHEET_FIELD_BY_TYPE: Record<
  DigitalChannelType,
  "website" | "instagram" | "linkedin"
> = {
  website: "website",
  instagram: "instagram",
  linkedin: "linkedin",
}

const INSTAGRAM_RESERVED = new Set([
  "p",
  "reel",
  "reels",
  "stories",
  "explore",
  "accounts",
  "tv",
])

const INSTAGRAM_HANDLE_PATTERN = /^[a-z0-9._]{1,30}$/
const LINKEDIN_SLUG_PATTERN = /^[a-z0-9._%-]+$/i

export type DigitalChannelDraft = {
  type: DigitalChannelType
  value: string
  is_primary: boolean
}

export type LeadDigitalChannelWrite = {
  type: DigitalChannelType
  value: string
  normalized_key: string
  is_primary: boolean
  sort_order: number
}

export type LeadDigitalChannel = LeadDigitalChannelWrite & {
  id?: string
}

export type DigitalChannelIssue = {
  index: number
  type: DigitalChannelType | null
  message: string
}

export function isDigitalChannelType(
  value: unknown,
): value is DigitalChannelType {
  return (
    typeof value === "string" &&
    (DIGITAL_CHANNEL_TYPES as readonly string[]).includes(value)
  )
}

export function digitalChannelConflictKey(
  type: DigitalChannelType,
  normalizedKey: string,
): string {
  return `${type}:${normalizedKey}`
}

export function parseChannelListCell(cell: string): string[] {
  return cell
    .split(DIGITAL_CHANNEL_LIST_SEPARATOR)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
}

export function formatChannelListCell(values: string[]): string {
  return values.join(`${DIGITAL_CHANNEL_LIST_SEPARATOR} `)
}

export function normalizeDigitalChannel(
  type: DigitalChannelType,
  raw: string,
): { value: string; normalized_key: string } | null {
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > DIGITAL_CHANNEL_VALUE_MAX) return null
  if (type === "website") {
    const domain = normalizeWebsiteDomain(trimmed)
    if (!domain) return null
    return { value: canonicalWebsiteUrl(domain), normalized_key: domain }
  }
  if (type === "instagram") return normalizeInstagram(trimmed)
  return normalizeLinkedin(trimmed)
}

export function hrefForDigitalChannel(
  type: DigitalChannelType,
  value: string,
): string | null {
  const normalized = normalizeDigitalChannel(type, value)
  if (!normalized) return null
  if (type === "instagram") {
    return `https://instagram.com/${normalized.normalized_key}`
  }
  return normalized.value
}

export function digitalChannelDisplay(
  type: DigitalChannelType,
  value: string,
): string {
  const normalized = normalizeDigitalChannel(type, value)
  if (!normalized) return value.trim()
  if (type === "instagram") return normalized.value
  return normalized.normalized_key
}

export function normalizeDigitalChannelList(
  drafts: DigitalChannelDraft[],
): {
  channels: LeadDigitalChannelWrite[]
  issues: DigitalChannelIssue[]
} {
  const issues: DigitalChannelIssue[] = []
  if (drafts.length > DIGITAL_CHANNELS_MAX) {
    issues.push({
      index: 0,
      type: null,
      message: "No máximo 10 canais.",
    })
  }

  const seen = new Set<string>()
  const pending: Array<{
    type: DigitalChannelType
    value: string
    normalized_key: string
    is_primary: boolean
  }> = []

  drafts.forEach((draft, index) => {
    if (index >= DIGITAL_CHANNELS_MAX) return
    const normalized = normalizeDigitalChannel(draft.type, draft.value)
    if (!normalized) {
      issues.push({
        index,
        type: draft.type,
        message: DIGITAL_CHANNEL_INVALID_MESSAGE[draft.type],
      })
      return
    }
    const key = digitalChannelConflictKey(
      draft.type,
      normalized.normalized_key,
    )
    if (seen.has(key)) {
      issues.push({
        index,
        type: draft.type,
        message: DIGITAL_CHANNEL_DUPLICATE_MESSAGE[draft.type],
      })
      return
    }
    seen.add(key)
    pending.push({
      type: draft.type,
      value: normalized.value,
      normalized_key: normalized.normalized_key,
      is_primary: draft.is_primary,
    })
  })

  const claimedPrimary = new Set<DigitalChannelType>()
  for (const item of pending) {
    if (!item.is_primary) continue
    if (claimedPrimary.has(item.type)) {
      item.is_primary = false
      continue
    }
    claimedPrimary.add(item.type)
  }
  for (const item of pending) {
    if (claimedPrimary.has(item.type)) continue
    item.is_primary = true
    claimedPrimary.add(item.type)
  }

  const channels = pending.map((item, sort_order) => ({
    type: item.type,
    value: item.value,
    normalized_key: item.normalized_key,
    is_primary: item.is_primary,
    sort_order,
  }))

  if (!channels.some((channel) => channel.type === "website")) {
    issues.push({
      index: 0,
      type: "website",
      message: "Site obrigatório.",
    })
  }

  return { channels, issues }
}

export function channelsFromSpreadsheetCells(values: {
  website: string
  instagram: string
  linkedin: string
}): DigitalChannelDraft[] {
  const channels: DigitalChannelDraft[] = []
  for (const type of DIGITAL_CHANNEL_TYPES) {
    const tokens = parseChannelListCell(values[type])
    tokens.forEach((token, index) => {
      channels.push({
        type,
        value: token,
        is_primary: index === 0,
      })
    })
  }
  return channels
}

export function spreadsheetCellsFromChannels(
  channels: LeadDigitalChannelWrite[],
): { website: string; instagram: string; linkedin: string } {
  function cell(type: DigitalChannelType): string {
    const items = channels
      .filter((channel) => channel.type === type)
      .slice()
      .sort((a, b) => {
        if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1
        return a.sort_order - b.sort_order
      })
    return formatChannelListCell(items.map((item) => item.value))
  }

  return {
    website: cell("website"),
    instagram: cell("instagram"),
    linkedin: cell("linkedin"),
  }
}

export function primaryWebsiteChannel(
  channels: LeadDigitalChannelWrite[],
): LeadDigitalChannelWrite | null {
  return (
    channels.find(
      (channel) => channel.type === "website" && channel.is_primary,
    ) ??
    channels.find((channel) => channel.type === "website") ??
    null
  )
}

export function websitePreviewLabel(channels: LeadDigitalChannelWrite[]): {
  domain: string
  extra: number
} {
  const websites = channels.filter((channel) => channel.type === "website")
  const primary = primaryWebsiteChannel(websites)
  return {
    domain: primary?.normalized_key ?? "",
    extra: Math.max(0, websites.length - 1),
  }
}

export function formatWebsitePreviewLabel(
  channels: LeadDigitalChannelWrite[],
): string {
  const { domain, extra } = websitePreviewLabel(channels)
  if (!domain) return ""
  if (extra === 0) return domain
  return `${domain} · +${extra}`
}

export function toDigitalChannelDrafts(
  channels: LeadDigitalChannelWrite[],
): DigitalChannelDraft[] {
  return channels
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((channel) => ({
      type: channel.type,
      value: channel.value,
      is_primary: channel.is_primary,
    }))
}

export function setPrimaryDigitalChannel(
  drafts: DigitalChannelDraft[],
  index: number,
): DigitalChannelDraft[] {
  const target = drafts[index]
  if (!target) return drafts
  return drafts.map((item, current) =>
    item.type !== target.type
      ? item
      : { ...item, is_primary: current === index },
  )
}

export function withEnsuredPrimaries(
  drafts: DigitalChannelDraft[],
): DigitalChannelDraft[] {
  const claimed = new Set<DigitalChannelType>()
  const next = drafts.map((item) => ({ ...item }))
  for (const item of next) {
    if (!item.is_primary) continue
    if (claimed.has(item.type)) {
      item.is_primary = false
      continue
    }
    claimed.add(item.type)
  }
  for (const item of next) {
    if (claimed.has(item.type)) continue
    item.is_primary = true
    claimed.add(item.type)
  }
  return next
}

export function readLeadDigitalChannels(embed: unknown): LeadDigitalChannel[] {
  if (!Array.isArray(embed)) return []
  const channels: LeadDigitalChannel[] = []
  const seen = new Set<string>()
  for (const row of embed) {
    if (!row || typeof row !== "object") continue
    const id = "id" in row ? row.id : null
    const type = "type" in row ? row.type : null
    const value = "value" in row ? row.value : null
    const normalized_key =
      "normalized_key" in row ? row.normalized_key : null
    const is_primary = "is_primary" in row ? row.is_primary : null
    const sort_order = "sort_order" in row ? row.sort_order : null
    if (typeof id !== "string" || seen.has(id)) continue
    if (!isDigitalChannelType(type)) continue
    if (typeof value !== "string" || typeof normalized_key !== "string") continue
    if (typeof is_primary !== "boolean") continue
    if (typeof sort_order !== "number") continue
    seen.add(id)
    channels.push({
      id,
      type,
      value,
      normalized_key,
      is_primary,
      sort_order,
    })
  }
  channels.sort((a, b) => a.sort_order - b.sort_order)
  return channels
}

function normalizeInstagram(
  input: string,
): { value: string; normalized_key: string } | null {
  let handle = input.trim()
  const urlLike =
    /^[a-z][a-z0-9+.-]*:\/\//i.test(handle) ||
    /instagram\.com|instagr\.am/i.test(handle)

  if (urlLike) {
    const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(handle)
      ? handle
      : `https://${handle}`
    try {
      const url = new URL(candidate)
      const host = url.hostname.replace(/^www\./, "").toLowerCase()
      if (host !== "instagram.com" && host !== "instagr.am") return null
      const segment = url.pathname.split("/").filter(Boolean)[0]
      if (!segment || INSTAGRAM_RESERVED.has(segment.toLowerCase())) return null
      handle = segment
    } catch {
      return null
    }
  }

  handle = handle.replace(/^@/, "").trim().toLowerCase()
  if (!INSTAGRAM_HANDLE_PATTERN.test(handle)) return null
  if (!/[a-z0-9]/.test(handle)) return null
  return { value: `@${handle}`, normalized_key: handle }
}

function normalizeLinkedin(
  input: string,
): { value: string; normalized_key: string } | null {
  const trimmed = input.trim()
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  try {
    const url = new URL(candidate)
    const host = url.hostname.replace(/^www\./, "").toLowerCase()
    if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return null
    const parts = url.pathname.split("/").filter(Boolean)
    if (parts.length < 2) return null
    const kind = parts[0].toLowerCase()
    if (kind !== "company" && kind !== "in") return null
    const slug = decodeURIComponent(parts[1]).replace(/\/+$/, "")
    if (!slug || !LINKEDIN_SLUG_PATTERN.test(slug)) return null
    const normalized_key = `linkedin.com/${kind}/${slug.toLowerCase()}`
    return { value: `https://${normalized_key}`, normalized_key }
  } catch {
    return null
  }
}
