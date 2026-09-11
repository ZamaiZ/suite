import {
  DIGITAL_CHANNEL_LABELS,
  digitalChannelDisplay,
  hrefForDigitalChannel,
  SOCIAL_CHANNEL_TYPES,
  type LeadDigitalChannel,
  type SocialChannelType,
} from "./digital-channels.ts"
import {
  digitalPresenceGapsForAudit,
  hasSocialSignal,
  socialChannelsFromLead,
  socialPostingAge,
  type DigitalPresenceGapId,
  type DigitalPresenceTone,
  type SocialPostingAge,
} from "./digital-presence.ts"
import {
  emptyNetworkAnswer,
  type DigitalPresenceNetworkAnswer,
  type DigitalPresenceReview,
} from "./digital-presence-review.ts"
import type { WebsiteCrawlSignals } from "./website-audit.ts"

function gapSet(gaps: readonly DigitalPresenceGapId[]): Set<string> {
  return new Set(gaps)
}

export type DigitalPresenceAlignment =
  | "aligned"
  | "not_on_site"
  | "mismatch"
  | "unregistered"
  | "unknown"

export const DIGITAL_PRESENCE_ALIGNMENT_LABEL: Record<
  DigitalPresenceAlignment,
  string
> = {
  aligned: "Alinhado ao site",
  not_on_site: "Sem link no site",
  mismatch: "Handle diferente do site",
  unregistered: "No site, sem cadastro",
  unknown: "Sem coleta do site",
}

export const DIGITAL_PRESENCE_ALIGNMENT_TONE: Record<
  DigitalPresenceAlignment,
  DigitalPresenceTone
> = {
  aligned: "success",
  not_on_site: "warning",
  mismatch: "warning",
  unregistered: "warning",
  unknown: "neutral",
}

export type DigitalPresenceNetworkState = {
  channelId: string
  type: SocialChannelType
  label: string
  /** Handle legível, já normalizado. */
  display: string
  href: string | null
  isPrimary: boolean
  answer: DigitalPresenceNetworkAnswer
  alignment: DigitalPresenceAlignment
  /** `null` quando não há data — não medido não é "publicou hoje". */
  age: SocialPostingAge | null
  /** Tom da **superfície do card**: só neutro ou atenção. */
  tone: "neutral" | "warning"
}

type DigitalPresenceReadInput = {
  signals: WebsiteCrawlSignals | null
  channels: ReadonlyArray<LeadDigitalChannel>
  review: DigitalPresenceReview
  today: string
}

/**
 * Um estado por rede cadastrada, servido pelo mesmo conjunto de gaps que
 * alimenta a coluna de oportunidades. Chip do card e achado da coluna não podem
 * divergir porque saem da mesma função.
 */
export function digitalPresenceNetworkStates(
  input: DigitalPresenceReadInput,
): DigitalPresenceNetworkState[] {
  const gaps = gapSet(digitalPresenceGapsForAudit(input))
  return socialChannelsFromLead(input.channels)
    .filter(
      (channel): channel is LeadDigitalChannel & { id: string } =>
        typeof channel.id === "string",
    )
    .map((channel) => {
      const type = channel.type as SocialChannelType
      const answer = input.review.networks[channel.id] ?? emptyNetworkAnswer()

      // Sem coleta o alinhamento é desconhecido — e desconhecido nunca é
      // desenhado como "alinhado".
      let alignment: DigitalPresenceAlignment = "unknown"
      if (input.signals) {
        if (gaps.has(`social_not_linked_on_site:${type}`)) {
          alignment = "not_on_site"
        } else if (gaps.has(`social_handle_mismatch:${type}`)) {
          alignment = "mismatch"
        } else {
          alignment = "aligned"
        }
      }

      const age =
        !answer.unavailable && answer.lastPostedOn
          ? socialPostingAge(answer.lastPostedOn, input.today)
          : null

      const tone: "neutral" | "warning" = answer.unavailable
        ? "neutral"
        : age?.tone === "danger" ||
            alignment === "not_on_site" ||
            alignment === "mismatch"
          ? "warning"
          : "neutral"

      return {
        channelId: channel.id,
        type,
        label: DIGITAL_CHANNEL_LABELS[type],
        display: digitalChannelDisplay(channel.type, channel.value),
        href: hrefForDigitalChannel(channel.type, channel.value),
        isPrimary: channel.is_primary,
        answer,
        alignment,
        age,
        tone,
      }
    })
}

export type DigitalPresenceSiteLink = {
  type: SocialChannelType
  label: string
  href: string | null
  alignment: DigitalPresenceAlignment
}

/**
 * `null` quando não há coleta — a aba inteira vira um vazio, e é assim que a
 * ressalva sai do rodapé da página e passa a ser o conteúdo dela.
 */
export function digitalPresenceSiteLinks(
  input: DigitalPresenceReadInput,
): DigitalPresenceSiteLink[] | null {
  const signals = input.signals
  if (!signals) return null
  const gaps = gapSet(digitalPresenceGapsForAudit(input))
  const registered = new Set(
    socialChannelsFromLead(input.channels).map(
      (channel) => channel.type as SocialChannelType,
    ),
  )

  const rows: DigitalPresenceSiteLink[] = []
  for (const type of SOCIAL_CHANNEL_TYPES) {
    const onSite = hasSocialSignal(signals, type)
    if (!onSite && !registered.has(type)) continue

    let alignment: DigitalPresenceAlignment = "aligned"
    if (gaps.has(`social_on_site_unregistered:${type}`)) {
      alignment = "unregistered"
    } else if (gaps.has(`social_handle_mismatch:${type}`)) {
      alignment = "mismatch"
    } else if (gaps.has(`social_not_linked_on_site:${type}`)) {
      alignment = "not_on_site"
    }

    rows.push({
      type,
      label: DIGITAL_CHANNEL_LABELS[type],
      href: signals.socialUrls[type],
      alignment,
    })
  }
  return rows
}

export type DigitalPresenceTally = {
  networks: {
    total: number
    /** Com data e acessível. Rede sem data não entra em denominador. */
    measured: number
    active: number
    aligned: number
  }
  followers: { sum: number; measured: number }
  /** `null` sem coleta do site — nunca `{ total: 2, ok: 0 }`. */
  tracking: { total: number; ok: number } | null
  /** `false` sem coleta: alinhamento é desconhecido, não é zero. */
  alignmentKnown: boolean
}

export function digitalPresenceTally(
  input: DigitalPresenceReadInput,
): DigitalPresenceTally {
  const states = digitalPresenceNetworkStates(input)
  const measured = states.filter((state) => state.age !== null)
  const withFollowers = states.filter(
    (state) => !state.answer.unavailable && state.answer.followers !== null,
  )
  const signals = input.signals

  return {
    networks: {
      total: states.length,
      measured: measured.length,
      active: measured.filter((state) => state.age?.tone !== "danger").length,
      aligned: states.filter((state) => state.alignment === "aligned").length,
    },
    followers: {
      sum: withFollowers.reduce(
        (total, state) => total + (state.answer.followers ?? 0),
        0,
      ),
      measured: withFollowers.length,
    },
    tracking: signals
      ? {
          total: 2,
          ok:
            (signals.hasGtm || signals.hasGtag ? 1 : 0) +
            (signals.hasFacebookPixel ? 1 : 0),
        }
      : null,
    alignmentKnown: signals !== null,
  }
}
