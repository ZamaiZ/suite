import {
  DIGITAL_CHANNEL_LABELS,
  SOCIAL_CHANNEL_TYPES,
  type LeadDigitalChannel,
  type SocialChannelType,
} from "./digital-channels.ts"
import {
  digitalPresenceGapsForAudit,
  hasSocialSignal,
  socialChannelsFromLead,
  type DigitalPresenceGapId,
} from "./digital-presence.ts"
import type { DigitalPresenceReview } from "./digital-presence-review.ts"
import type { WebsiteCrawlSignals } from "./website-audit.ts"

export type DigitalPresenceCheckStatus = "ok" | "warn" | "pending" | "error"

export type DigitalPresenceCheckItem = {
  id: string
  label: string
  detail: string
  status: DigitalPresenceCheckStatus
}

export type DigitalPresenceCheckSection = {
  id: "tracking" | "social"
  title: string
  items: DigitalPresenceCheckItem[]
}

function gapSet(gaps: readonly DigitalPresenceGapId[]): Set<string> {
  return new Set(gaps)
}

export function digitalPresenceCheckSections(input: {
  signals: WebsiteCrawlSignals | null
  channels: ReadonlyArray<LeadDigitalChannel>
  review: DigitalPresenceReview
  today: string
}): DigitalPresenceCheckSection[] {
  if (!input.signals) {
    return [
      {
        id: "tracking",
        title: "Rastreamento",
        items: [
          {
            id: "gtm",
            label: "Google Tag / GTM",
            detail: "Aguardando coleta do site",
            status: "pending",
          },
          {
            id: "pixel",
            label: "Pixel do Facebook",
            detail: "Aguardando coleta do site",
            status: "pending",
          },
        ],
      },
      {
        id: "social",
        title: "Redes no site",
        items: [
          {
            id: "social-pending",
            label: "Links sociais",
            detail: "Aguardando coleta do site",
            status: "pending",
          },
        ],
      },
    ]
  }

  const signals = input.signals
  const gaps = gapSet(
    digitalPresenceGapsForAudit({
      signals,
      channels: input.channels,
      review: input.review,
      today: input.today,
    }),
  )
  const social = socialChannelsFromLead(input.channels)
  const registeredTypes = new Set(
    social.map((channel) => channel.type as SocialChannelType),
  )

  const tracking: DigitalPresenceCheckItem[] = [
    {
      id: "gtm",
      label: "Google Tag / GTM",
      detail: gaps.has("missing_google_tag")
        ? "Não encontrado no HTML"
        : signals.hasGtm
          ? "GTM presente"
          : "gtag presente",
      status: gaps.has("missing_google_tag") ? "warn" : "ok",
    },
    {
      id: "pixel",
      label: "Pixel do Facebook",
      detail: gaps.has("pixel_not_in_html")
        ? "Não aparece no HTML"
        : "fbevents.js encontrado",
      status: gaps.has("pixel_not_in_html") ? "warn" : "ok",
    },
  ]

  const socialItems: DigitalPresenceCheckItem[] = []
  for (const type of SOCIAL_CHANNEL_TYPES) {
    const onSite = hasSocialSignal(signals, type)
    const registered = registeredTypes.has(type)
    if (!onSite && !registered) continue

    let detail = ""
    let status: DigitalPresenceCheckStatus = "ok"
    if (gaps.has(`social_not_linked_on_site:${type}`)) {
      detail = "Cadastrado, sem link no site"
      status = "warn"
    } else if (gaps.has(`social_on_site_unregistered:${type}`)) {
      detail = "No site, sem cadastro"
      status = "warn"
    } else if (gaps.has(`social_handle_mismatch:${type}`)) {
      detail = "Handle do site diferente do cadastro"
      status = "warn"
    } else if (registered && onSite) {
      detail = "Link no site alinhado ao cadastro"
      status = "ok"
    } else if (onSite) {
      detail = "Link no site"
      status = "ok"
    } else {
      detail = "Só no cadastro"
      status = "ok"
    }

    socialItems.push({
      id: `social:${type}`,
      label: DIGITAL_CHANNEL_LABELS[type],
      detail,
      status,
    })
  }

  if (socialItems.length === 0) {
    socialItems.push({
      id: "social-empty",
      label: "Links sociais",
      detail: "Nenhuma rede no cadastro nem no HTML",
      status: "ok",
    })
  }

  return [
    { id: "tracking", title: "Rastreamento", items: tracking },
    { id: "social", title: "Redes no site", items: socialItems },
  ]
}
