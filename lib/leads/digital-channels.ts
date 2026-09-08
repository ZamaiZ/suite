import { canonicalWebsiteUrl, normalizeWebsiteDomain } from "./website.ts"

export const DIGITAL_CHANNEL_TYPES = [
  "website",
  "instagram",
  "linkedin",
  "facebook",
  "youtube",
  "tiktok",
  "pinterest",
  "twitter",
] as const

export type DigitalChannelType = (typeof DIGITAL_CHANNEL_TYPES)[number]

export const SOCIAL_CHANNEL_TYPES = [
  "instagram",
  "linkedin",
  "facebook",
  "youtube",
  "tiktok",
  "pinterest",
  "twitter",
] as const satisfies readonly Exclude<DigitalChannelType, "website">[]

export type SocialChannelType = (typeof SOCIAL_CHANNEL_TYPES)[number]

export function isSocialChannelType(
  value: unknown,
): value is SocialChannelType {
  return (
    typeof value === "string" &&
    (SOCIAL_CHANNEL_TYPES as readonly string[]).includes(value)
  )
}

export const DIGITAL_CHANNELS_MAX = 10
export const DIGITAL_CHANNEL_LIST_SEPARATOR = ";"
export const DIGITAL_CHANNEL_VALUE_MAX = 500

export const DIGITAL_CHANNEL_LABELS: Record<DigitalChannelType, string> = {
  website: "Site",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  youtube: "YouTube",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  twitter: "X (Twitter)",
}

export const DIGITAL_CHANNEL_PLACEHOLDERS: Record<DigitalChannelType, string> =
  {
    website: "empresa.com.br",
    instagram: "@empresa",
    linkedin: "linkedin.com/company/empresa",
    facebook: "facebook.com/empresa",
    youtube: "youtube.com/@empresa",
    tiktok: "@empresa",
    pinterest: "pinterest.com/empresa",
    twitter: "@empresa",
  }

export const DIGITAL_CHANNEL_INVALID_MESSAGE: Record<
  DigitalChannelType,
  string
> = {
  website: "Site inválido.",
  instagram: "Instagram inválido.",
  linkedin: "LinkedIn inválido.",
  facebook: "Facebook inválido.",
  youtube: "YouTube inválido.",
  tiktok: "TikTok inválido.",
  pinterest: "Pinterest inválido.",
  twitter: "X (Twitter) inválido.",
}

export const DIGITAL_CHANNEL_DUPLICATE_MESSAGE: Record<
  DigitalChannelType,
  string
> = {
  website: "Site repetido.",
  instagram: "Instagram repetido.",
  linkedin: "LinkedIn repetido.",
  facebook: "Facebook repetido.",
  youtube: "YouTube repetido.",
  tiktok: "TikTok repetido.",
  pinterest: "Pinterest repetido.",
  twitter: "X (Twitter) repetido.",
}

export const DIGITAL_CHANNEL_TAKEN_MESSAGE: Record<DigitalChannelType, string> =
  {
    website: "Este site já está cadastrado.",
    instagram: "Este Instagram já está cadastrado.",
    linkedin: "Este LinkedIn já está cadastrado.",
    facebook: "Este Facebook já está cadastrado.",
    youtube: "Este YouTube já está cadastrado.",
    tiktok: "Este TikTok já está cadastrado.",
    pinterest: "Este Pinterest já está cadastrado.",
    twitter: "Este X (Twitter) já está cadastrado.",
  }

export const SPREADSHEET_FIELD_BY_TYPE = Object.fromEntries(
  DIGITAL_CHANNEL_TYPES.map((type) => [type, type]),
) as { [K in DigitalChannelType]: K }

const INSTAGRAM_RESERVED = new Set([
  "p",
  "reel",
  "reels",
  "stories",
  "explore",
  "accounts",
  "tv",
])

const FACEBOOK_RESERVED = new Set([
  "watch",
  "reel",
  "reels",
  "groups",
  "events",
  "login",
  "share",
  "sharer",
  "profile.php",
  "pages",
  "stories",
  "marketplace",
  "gaming",
  "live",
  "photo.php",
  "permalink.php",
  "dialog",
  "privacy",
  "help",
  "ads",
  "friends",
  "messages",
  "notifications",
  "settings",
])

const YOUTUBE_RESERVED = new Set([
  "watch",
  "shorts",
  "playlist",
  "embed",
  "live",
  "results",
  "feed",
])

const TIKTOK_RESERVED = new Set([
  "video",
  "t",
  "explore",
  "live",
  "login",
  "signup",
])

const PINTEREST_RESERVED = new Set([
  "pin",
  "ideas",
  "today",
  "search",
  "settings",
  "login",
  "signup",
])

const TWITTER_RESERVED = new Set([
  "status",
  "i",
  "intent",
  "home",
  "explore",
  "search",
  "settings",
  "compose",
  "share",
  "hashtag",
  "login",
  "signup",
])

const INSTAGRAM_HANDLE_PATTERN = /^[a-z0-9._]{1,30}$/
const LINKEDIN_SLUG_PATTERN = /^[a-z0-9._%-]+$/i
const FACEBOOK_SLUG_PATTERN = /^[a-z0-9._-]+$/
const YOUTUBE_HANDLE_PATTERN = /^[a-z0-9._-]{3,30}$/
const YOUTUBE_CHANNEL_ID_PATTERN = /^UC[\w-]{22}$/
const YOUTUBE_CUSTOM_PATTERN = /^[a-z0-9._%-]+$/i
const TIKTOK_HANDLE_PATTERN = /^[a-z0-9._]{2,24}$/
const PINTEREST_USER_PATTERN = /^[a-z0-9._-]{1,30}$/
const TWITTER_HANDLE_PATTERN = /^[a-z0-9_]{1,15}$/

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
  /**
   * Amostra de caminhos fixada no primeiro crawl do canal. Duas coletas
   * precisam ler as mesmas URLs para que o comparativo compare o mesmo site, e
   * nao a ordem do menu daquele dia. Vazio significa "ainda nao derivada".
   */
  audit_paths?: string[]
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
  switch (type) {
    case "website": {
      const domain = normalizeWebsiteDomain(trimmed)
      if (!domain) return null
      return { value: canonicalWebsiteUrl(domain), normalized_key: domain }
    }
    case "instagram":
      return normalizeInstagram(trimmed)
    case "linkedin":
      return normalizeLinkedin(trimmed)
    case "facebook":
      return normalizeFacebook(trimmed)
    case "youtube":
      return normalizeYoutube(trimmed)
    case "tiktok":
      return normalizeTiktok(trimmed)
    case "pinterest":
      return normalizePinterest(trimmed)
    case "twitter":
      return normalizeTwitter(trimmed)
  }
}

export function hrefForDigitalChannel(
  type: DigitalChannelType,
  value: string,
): string | null {
  const normalized = normalizeDigitalChannel(type, value)
  if (!normalized) return null
  switch (type) {
    case "instagram":
      return `https://instagram.com/${normalized.normalized_key}`
    case "tiktok":
      return `https://www.tiktok.com/@${normalized.normalized_key}`
    case "twitter":
      return `https://x.com/${normalized.normalized_key}`
    default:
      return normalized.value
  }
}

export function digitalChannelDisplay(
  type: DigitalChannelType,
  value: string,
): string {
  const normalized = normalizeDigitalChannel(type, value)
  if (!normalized) return value.trim()
  switch (type) {
    case "instagram":
    case "tiktok":
    case "twitter":
      return normalized.value
    default:
      return normalized.normalized_key
  }
}

export function normalizeDigitalChannelList(drafts: DigitalChannelDraft[]): {
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
    const key = digitalChannelConflictKey(draft.type, normalized.normalized_key)
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

export function channelsFromSpreadsheetCells(
  values: Record<DigitalChannelType, string>,
): DigitalChannelDraft[] {
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
): Record<DigitalChannelType, string> {
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

  const cells = {} as Record<DigitalChannelType, string>
  for (const type of DIGITAL_CHANNEL_TYPES) {
    cells[type] = cell(type)
  }
  return cells
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
    const normalized_key = "normalized_key" in row ? row.normalized_key : null
    const is_primary = "is_primary" in row ? row.is_primary : null
    const sort_order = "sort_order" in row ? row.sort_order : null
    if (typeof id !== "string" || seen.has(id)) continue
    if (!isDigitalChannelType(type)) continue
    if (typeof value !== "string" || typeof normalized_key !== "string")
      continue
    if (typeof is_primary !== "boolean") continue
    if (typeof sort_order !== "number") continue
    seen.add(id)
    const audit_paths = Array.isArray(row.audit_paths)
      ? (row.audit_paths as unknown[]).filter(
          (item): item is string => typeof item === "string" && item.length > 0,
        )
      : []
    channels.push({
      id,
      type,
      value,
      normalized_key,
      is_primary,
      sort_order,
      audit_paths,
    })
  }
  channels.sort((a, b) => a.sort_order - b.sort_order)
  return channels
}

function hasScheme(input: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(input)
}

function parseHttpUrl(input: string): URL | null {
  const candidate = hasScheme(input) ? input : `https://${input}`
  try {
    return new URL(candidate)
  } catch {
    return null
  }
}

function canonicalHost(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/^m\./, "")
    .replace(/^web\./, "")
    .replace(/^mobile\./, "")
}

function firstPathSegment(url: URL): string {
  const segment = url.pathname.split("/").filter(Boolean)[0] ?? ""
  try {
    return decodeURIComponent(segment).replace(/\/+$/, "")
  } catch {
    return segment.replace(/\/+$/, "")
  }
}

function urlPathParts(url: URL): string[] {
  return url.pathname
    .split("/")
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part)
      } catch {
        return part
      }
    })
}

function looksLikeHostedUrl(input: string, hostPattern: RegExp): boolean {
  return hasScheme(input) || hostPattern.test(input)
}

function normalizeInstagram(
  input: string,
): { value: string; normalized_key: string } | null {
  let handle = input.trim()
  const urlLike = looksLikeHostedUrl(handle, /instagram\.com|instagr\.am/i)

  if (urlLike) {
    const url = parseHttpUrl(handle)
    if (!url) return null
    const host = canonicalHost(url.hostname)
    if (host !== "instagram.com" && host !== "instagr.am") return null
    const segment = firstPathSegment(url)
    if (!segment || INSTAGRAM_RESERVED.has(segment.toLowerCase())) return null
    handle = segment
  }

  handle = handle.replace(/^@/, "").trim().toLowerCase()
  if (!INSTAGRAM_HANDLE_PATTERN.test(handle)) return null
  if (!/[a-z0-9]/.test(handle)) return null
  return { value: `@${handle}`, normalized_key: handle }
}

function normalizeLinkedin(
  input: string,
): { value: string; normalized_key: string } | null {
  const url = parseHttpUrl(input.trim())
  if (!url) return null
  const host = canonicalHost(url.hostname)
  if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return null
  const parts = urlPathParts(url)
  if (parts.length < 2) return null
  const kind = parts[0].toLowerCase()
  if (kind !== "company" && kind !== "in") return null
  const slug = parts[1].replace(/\/+$/, "")
  if (!slug || !LINKEDIN_SLUG_PATTERN.test(slug)) return null
  const normalized_key = `linkedin.com/${kind}/${slug.toLowerCase()}`
  return { value: `https://${normalized_key}`, normalized_key }
}

function normalizeFacebook(
  input: string,
): { value: string; normalized_key: string } | null {
  const trimmed = input.trim()
  const urlLike = looksLikeHostedUrl(trimmed, /facebook\.com|fb\.com/i)

  if (!urlLike) {
    return facebookFromSlug(trimmed.replace(/^@/, "").trim())
  }

  const url = parseHttpUrl(trimmed)
  if (!url) return null
  const host = canonicalHost(url.hostname)
  if (
    host !== "facebook.com" &&
    host !== "fb.com" &&
    !host.endsWith(".facebook.com") &&
    !host.endsWith(".fb.com")
  ) {
    return null
  }
  return facebookFromSlug(firstPathSegment(url))
}

function facebookFromSlug(
  slug: string,
): { value: string; normalized_key: string } | null {
  const normalized = slug.toLowerCase()
  if (!normalized || FACEBOOK_RESERVED.has(normalized)) return null
  if (!FACEBOOK_SLUG_PATTERN.test(normalized)) return null
  if (!/[a-z0-9]/.test(normalized)) return null
  const normalized_key = `facebook.com/${normalized}`
  return { value: `https://${normalized_key}`, normalized_key }
}

function normalizeYoutube(
  input: string,
): { value: string; normalized_key: string } | null {
  const trimmed = input.trim()
  const urlLike = looksLikeHostedUrl(trimmed, /youtube\.com|youtu\.be/i)

  if (!urlLike) {
    const handle = trimmed.replace(/^@/, "").trim().toLowerCase()
    if (!YOUTUBE_HANDLE_PATTERN.test(handle)) return null
    const normalized_key = `youtube.com/@${handle}`
    return { value: `https://${normalized_key}`, normalized_key }
  }

  const url = parseHttpUrl(trimmed)
  if (!url) return null
  const host = canonicalHost(url.hostname)
  if (host !== "youtube.com") return null

  const parts = urlPathParts(url)
  if (parts.length === 0) return null
  const first = parts[0]
  if (YOUTUBE_RESERVED.has(first.toLowerCase())) return null

  if (first.startsWith("@")) {
    const handle = first.slice(1).toLowerCase()
    if (!YOUTUBE_HANDLE_PATTERN.test(handle)) return null
    const normalized_key = `youtube.com/@${handle}`
    return { value: `https://${normalized_key}`, normalized_key }
  }

  const kind = first.toLowerCase()
  if (kind === "channel") {
    const id = parts[1]
    if (!id || !YOUTUBE_CHANNEL_ID_PATTERN.test(id)) return null
    const normalized_key = `youtube.com/channel/${id}`
    return { value: `https://${normalized_key}`, normalized_key }
  }
  if (kind === "c" || kind === "user") {
    const slug = (parts[1] ?? "").replace(/\/+$/, "")
    if (!slug || !YOUTUBE_CUSTOM_PATTERN.test(slug)) return null
    const normalized_key = `youtube.com/${kind}/${slug.toLowerCase()}`
    return { value: `https://${normalized_key}`, normalized_key }
  }

  return null
}

function normalizeTiktok(
  input: string,
): { value: string; normalized_key: string } | null {
  let handle = input.trim()
  const urlLike = looksLikeHostedUrl(handle, /tiktok\.com/i)

  if (urlLike) {
    const url = parseHttpUrl(handle)
    if (!url) return null
    const host = canonicalHost(url.hostname)
    if (host !== "tiktok.com") return null
    const parts = urlPathParts(url)
    if (parts.some((part) => TIKTOK_RESERVED.has(part.toLowerCase()))) {
      return null
    }
    const first = parts[0]
    if (!first || !first.startsWith("@")) return null
    handle = first.slice(1)
  }

  handle = handle.replace(/^@/, "").trim().toLowerCase()
  if (!TIKTOK_HANDLE_PATTERN.test(handle)) return null
  if (!/[a-z0-9]/.test(handle)) return null
  return { value: `@${handle}`, normalized_key: handle }
}

function normalizePinterest(
  input: string,
): { value: string; normalized_key: string } | null {
  const trimmed = input.trim()
  const urlLike = looksLikeHostedUrl(trimmed, /pinterest\.com|pin\.it/i)

  if (!urlLike) {
    return pinterestFromUser(trimmed.replace(/^@/, "").trim())
  }

  const url = parseHttpUrl(trimmed)
  if (!url) return null
  const host = canonicalHost(url.hostname)
  if (host === "pin.it") return null
  if (host !== "pinterest.com" && !host.endsWith(".pinterest.com")) return null
  return pinterestFromUser(firstPathSegment(url))
}

function pinterestFromUser(
  user: string,
): { value: string; normalized_key: string } | null {
  const normalized = user.toLowerCase()
  if (!normalized || PINTEREST_RESERVED.has(normalized)) return null
  if (!PINTEREST_USER_PATTERN.test(normalized)) return null
  if (!/[a-z0-9]/.test(normalized)) return null
  const normalized_key = `pinterest.com/${normalized}`
  return { value: `https://${normalized_key}`, normalized_key }
}

function normalizeTwitter(
  input: string,
): { value: string; normalized_key: string } | null {
  let handle = input.trim()
  const urlLike = looksLikeHostedUrl(handle, /(?:^|\/\/|\.)(?:x|twitter)\.com/i)

  if (urlLike) {
    const url = parseHttpUrl(handle)
    if (!url) return null
    const host = canonicalHost(url.hostname)
    if (host !== "x.com" && host !== "twitter.com") return null
    const parts = urlPathParts(url)
    if (parts.some((part) => part.toLowerCase() === "status")) return null
    const first = parts[0]
    if (!first || TWITTER_RESERVED.has(first.toLowerCase())) return null
    handle = first
  }

  handle = handle.replace(/^@/, "").trim().toLowerCase()
  if (!TWITTER_HANDLE_PATTERN.test(handle)) return null
  if (TWITTER_RESERVED.has(handle)) return null
  return { value: `@${handle}`, normalized_key: handle }
}
