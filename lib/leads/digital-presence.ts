import {
  civilDateDiffDays,
  formatCivilDate,
  shiftCivilDate,
} from "../civil-date.ts"
import {
  DIGITAL_CHANNEL_LABELS,
  normalizeDigitalChannel,
  SOCIAL_CHANNEL_TYPES,
  type LeadDigitalChannel,
  type SocialChannelType,
} from "./digital-channels.ts"
import { GBP_STALE_POSTS_DAYS } from "./gbp-audit.ts"
import {
  digitalPresenceIdentityOpportunityId,
  isNetworkAnswerFilled,
  pruneDigitalPresenceNetworks,
  readDigitalPresenceReview,
  type DigitalPresenceReview,
} from "./digital-presence-review.ts"
import type { WebsiteCrawlSignals } from "./website-audit.ts"

export type LeadDigitalPresenceAudit = {
  id: string
  lead_id: string
  review: DigitalPresenceReview
  updated_at: string
  updated_by: string
}

export type DigitalPresenceGapId =
  | "missing_google_tag"
  | "pixel_not_in_html"
  | `social_not_linked_on_site:${SocialChannelType}`
  | `social_on_site_unregistered:${SocialChannelType}`
  | `social_handle_mismatch:${SocialChannelType}`
  | `stale_social_posts:${string}`

export const DIGITAL_PRESENCE_GAP_LABELS: Record<
  "missing_google_tag" | "pixel_not_in_html",
  string
> &
  Partial<Record<DigitalPresenceGapId, string>> = {
  missing_google_tag: "Sem Google Tag / GTM no HTML",
  pixel_not_in_html: "Pixel do Facebook não aparece no HTML",
}

const SIGNAL_HAS: Record<
  SocialChannelType,
  keyof Pick<
    WebsiteCrawlSignals,
    | "hasInstagram"
    | "hasFacebook"
    | "hasLinkedin"
    | "hasYoutube"
    | "hasTiktok"
    | "hasPinterest"
    | "hasTwitter"
  >
> = {
  instagram: "hasInstagram",
  facebook: "hasFacebook",
  linkedin: "hasLinkedin",
  youtube: "hasYoutube",
  tiktok: "hasTiktok",
  pinterest: "hasPinterest",
  twitter: "hasTwitter",
}

export function socialChannelsFromLead(
  channels: ReadonlyArray<LeadDigitalChannel>,
): LeadDigitalChannel[] {
  return channels
    .filter((channel) =>
      (SOCIAL_CHANNEL_TYPES as readonly string[]).includes(channel.type),
    )
    .slice()
    .sort((left, right) => {
      if (left.sort_order !== right.sort_order) {
        return left.sort_order - right.sort_order
      }
      return left.type.localeCompare(right.type)
    })
}

export function hasSocialSignal(
  signals: WebsiteCrawlSignals,
  type: SocialChannelType,
): boolean {
  return signals[SIGNAL_HAS[type]]
}

export function isSocialPostingStale(
  lastPostedOn: string,
  today: string,
): boolean {
  const cutoff = shiftCivilDate(today, -GBP_STALE_POSTS_DAYS)
  return lastPostedOn < cutoff
}

export function socialPostingAgeLabel(
  lastPostedOn: string,
  today: string,
): string {
  const days = civilDateDiffDays(lastPostedOn, today)
  if (days < 0) return formatCivilDate(lastPostedOn)
  if (isSocialPostingStale(lastPostedOn, today)) {
    return `Parado há mais de ${GBP_STALE_POSTS_DAYS} dias`
  }
  if (days === 0) return "Publicou hoje"
  if (days === 1) return "Há 1 dia"
  return `Há ${days.toLocaleString("pt-BR")} dias`
}

function channelKeysByType(
  channels: ReadonlyArray<LeadDigitalChannel>,
): Map<SocialChannelType, Set<string>> {
  const map = new Map<SocialChannelType, Set<string>>()
  for (const type of SOCIAL_CHANNEL_TYPES) {
    map.set(type, new Set())
  }
  for (const channel of channels) {
    if (!(SOCIAL_CHANNEL_TYPES as readonly string[]).includes(channel.type)) {
      continue
    }
    const type = channel.type as SocialChannelType
    map.get(type)?.add(channel.normalized_key)
  }
  return map
}

function hrefMatchesChannel(
  href: string,
  type: SocialChannelType,
  keys: Set<string>,
): boolean {
  const normalized = normalizeDigitalChannel(type, href)
  if (!normalized) return false
  return keys.has(normalized.normalized_key)
}

export function digitalPresenceGapsForAudit(input: {
  signals: WebsiteCrawlSignals | null
  channels: ReadonlyArray<LeadDigitalChannel>
  review: DigitalPresenceReview
  today: string
}): DigitalPresenceGapId[] {
  const gaps: DigitalPresenceGapId[] = []
  const social = socialChannelsFromLead(input.channels)
  const keysByType = channelKeysByType(social)
  const today = input.today

  if (input.signals) {
    const signals = input.signals
    if (!signals.hasGtm && !signals.hasGtag) {
      gaps.push("missing_google_tag")
    }
    if (!signals.hasFacebookPixel) {
      gaps.push("pixel_not_in_html")
    }

    for (const type of SOCIAL_CHANNEL_TYPES) {
      const keys = keysByType.get(type) ?? new Set()
      const onSite = hasSocialSignal(signals, type)
      const href = signals.socialUrls[type]
      const registered = keys.size > 0

      if (registered && !onSite) {
        gaps.push(`social_not_linked_on_site:${type}`)
        continue
      }
      if (onSite && !registered) {
        gaps.push(`social_on_site_unregistered:${type}`)
        continue
      }
      if (registered && onSite && href) {
        if (!hrefMatchesChannel(href, type, keys)) {
          gaps.push(`social_handle_mismatch:${type}`)
        }
      }
    }
  }

  for (const channel of social) {
    if (!channel.id) continue
    const answer = input.review.networks[channel.id]
    if (!answer || answer.unavailable || !answer.lastPostedOn) continue
    if (isSocialPostingStale(answer.lastPostedOn, today)) {
      gaps.push(`stale_social_posts:${channel.id}`)
    }
  }

  return gaps
}

export function isDigitalPresenceComplete(
  review: DigitalPresenceReview,
  channels: ReadonlyArray<LeadDigitalChannel>,
): boolean {
  if (review.identity.verdict === null) return false
  const social = socialChannelsFromLead(channels)
  return social.every((channel) => {
    if (!channel.id) return false
    const answer = review.networks[channel.id]
    return answer != null && isNetworkAnswerFilled(answer)
  })
}

export function digitalPresenceReviewForChannels(
  review: DigitalPresenceReview,
  channels: ReadonlyArray<LeadDigitalChannel>,
): DigitalPresenceReview {
  const ids = socialChannelsFromLead(channels)
    .map((channel) => channel.id)
    .filter((id): id is string => typeof id === "string")
  return pruneDigitalPresenceNetworks(review, ids)
}

export function readLeadDigitalPresenceAuditRow(
  row: Record<string, unknown>,
): LeadDigitalPresenceAudit | null {
  const id = typeof row.id === "string" ? row.id : null
  const lead_id = typeof row.lead_id === "string" ? row.lead_id : null
  const updated_at = typeof row.updated_at === "string" ? row.updated_at : null
  const updated_by = typeof row.updated_by === "string" ? row.updated_by : null
  if (!id || !lead_id || !updated_at || !updated_by) return null
  return {
    id,
    lead_id,
    review: readDigitalPresenceReview(row.review),
    updated_at,
    updated_by,
  }
}

export function digitalPresenceGapLabel(
  id: DigitalPresenceGapId,
  channels: ReadonlyArray<LeadDigitalChannel> = [],
): string {
  if (id === "missing_google_tag" || id === "pixel_not_in_html") {
    return DIGITAL_PRESENCE_GAP_LABELS[id]
  }
  if (id.startsWith("social_not_linked_on_site:")) {
    const type = id.slice(
      "social_not_linked_on_site:".length,
    ) as SocialChannelType
    return `${DIGITAL_CHANNEL_LABELS[type]} sem link no site`
  }
  if (id.startsWith("social_on_site_unregistered:")) {
    const type = id.slice(
      "social_on_site_unregistered:".length,
    ) as SocialChannelType
    return `${DIGITAL_CHANNEL_LABELS[type]} no site sem cadastro`
  }
  if (id.startsWith("social_handle_mismatch:")) {
    const type = id.slice("social_handle_mismatch:".length) as SocialChannelType
    return `${DIGITAL_CHANNEL_LABELS[type]} do site diferente do cadastro`
  }
  if (id.startsWith("stale_social_posts:")) {
    const channelId = id.slice("stale_social_posts:".length)
    const channel = channels.find((item) => item.id === channelId)
    const label = channel
      ? DIGITAL_CHANNEL_LABELS[channel.type as SocialChannelType]
      : "Rede"
    return `${label} parado há mais de ${GBP_STALE_POSTS_DAYS} dias`
  }
  return id
}

export { digitalPresenceIdentityOpportunityId }
