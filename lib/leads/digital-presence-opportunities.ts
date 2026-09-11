import {
  DIGITAL_CHANNEL_LABELS,
  type LeadDigitalChannel,
} from "./digital-channels.ts"
import {
  DIGITAL_PRESENCE_IDENTITY,
  digitalPresenceIdentityOpportunityId,
  type DigitalPresenceReview,
} from "./digital-presence-review.ts"
import {
  digitalPresenceGapLabel,
  digitalPresenceGapsForAudit,
  type DigitalPresenceGapId,
} from "./digital-presence.ts"
import type { DigitalPresenceStepTabId } from "./digital-presence-step-tabs.ts"
import type { WebsiteCrawlSignals } from "./website-audit.ts"

export type DigitalPresenceOpportunityImpact = "high" | "medium"
export type DigitalPresenceOpportunitySource = "machine" | "analyst"

export type DigitalPresenceOpportunityItem = {
  id: string
  title: string
  impact: DigitalPresenceOpportunityImpact
  source: DigitalPresenceOpportunitySource
  detail?: string
}

const HIGH_IMPACT = new Set<string>([])

function impactFor(id: DigitalPresenceGapId): DigitalPresenceOpportunityImpact {
  if (id.startsWith("stale_social_posts:")) return "high"
  if (HIGH_IMPACT.has(id)) return "high"
  return "medium"
}

function opportunityTitle(
  id: DigitalPresenceGapId,
  channels: ReadonlyArray<LeadDigitalChannel>,
): string {
  if (id === "missing_google_tag") {
    return "Instalar Google Tag / GTM no site"
  }
  if (id === "pixel_not_in_html") {
    return "Incluir o pixel do Facebook no HTML"
  }
  if (id.startsWith("social_not_linked_on_site:")) {
    const type = id.slice("social_not_linked_on_site:".length)
    return `Linkar ${DIGITAL_CHANNEL_LABELS[type as keyof typeof DIGITAL_CHANNEL_LABELS]} no site`
  }
  if (id.startsWith("social_on_site_unregistered:")) {
    const type = id.slice("social_on_site_unregistered:".length)
    return `Cadastrar ${DIGITAL_CHANNEL_LABELS[type as keyof typeof DIGITAL_CHANNEL_LABELS]} do site`
  }
  if (id.startsWith("social_handle_mismatch:")) {
    const type = id.slice("social_handle_mismatch:".length)
    return `Alinhar ${DIGITAL_CHANNEL_LABELS[type as keyof typeof DIGITAL_CHANNEL_LABELS]} com o site`
  }
  if (id.startsWith("stale_social_posts:")) {
    const channelId = id.slice("stale_social_posts:".length)
    const channel = channels.find((item) => item.id === channelId)
    const label = channel
      ? DIGITAL_CHANNEL_LABELS[
          channel.type as keyof typeof DIGITAL_CHANNEL_LABELS
        ]
      : "rede"
    return `Retomar publicações no ${label}`
  }
  return digitalPresenceGapLabel(id, channels)
}

function opportunityDetail(id: DigitalPresenceGapId): string | undefined {
  if (id === "pixel_not_in_html") {
    return "Não aparece no HTML — pode estar só dentro do GTM"
  }
  return undefined
}

export function digitalPresenceOpportunitiesFromGaps(
  gaps: DigitalPresenceGapId[],
  channels: ReadonlyArray<LeadDigitalChannel> = [],
): DigitalPresenceOpportunityItem[] {
  const items = gaps.map((id) => ({
    id,
    title: opportunityTitle(id, channels),
    impact: impactFor(id),
    source: "machine" as const,
    ...(opportunityDetail(id) ? { detail: opportunityDetail(id) } : {}),
  }))
  items.sort((left, right) => {
    if (left.impact !== right.impact) return left.impact === "high" ? -1 : 1
    return 0
  })
  return items
}

export function digitalPresenceOpportunitiesFromReview(
  review: DigitalPresenceReview,
): DigitalPresenceOpportunityItem[] {
  if (review.identity.verdict !== "issue") return []
  return [
    {
      id: digitalPresenceIdentityOpportunityId(),
      title: DIGITAL_PRESENCE_IDENTITY.title,
      impact: DIGITAL_PRESENCE_IDENTITY.impact,
      source: "analyst",
      ...(review.identity.note.trim() ? { detail: review.identity.note } : {}),
    },
  ]
}

export function mergeDigitalPresenceOpportunities(input: {
  signals: WebsiteCrawlSignals | null
  channels: ReadonlyArray<LeadDigitalChannel>
  review: DigitalPresenceReview
  today: string
}): DigitalPresenceOpportunityItem[] {
  const gaps = digitalPresenceGapsForAudit({
    signals: input.signals,
    channels: input.channels,
    review: input.review,
    today: input.today,
  })
  const items = [
    ...digitalPresenceOpportunitiesFromGaps(gaps, input.channels),
    ...digitalPresenceOpportunitiesFromReview(input.review),
  ]
  items.sort((left, right) => {
    if (left.impact !== right.impact) return left.impact === "high" ? -1 : 1
    if (left.source !== right.source) {
      return left.source === "machine" ? -1 : 1
    }
    return 0
  })
  return items
}

/**
 * A oportunidade mora na aba onde o analista a vê. Alinhamento e cadência têm
 * chip no card da rede, então são de `redes`; `social_on_site_unregistered` é
 * de `site` porque essa rede **não tem card** — ela só existe na lista do site.
 */
const THEME_BY_PREFIX: ReadonlyArray<
  readonly [string, DigitalPresenceStepTabId]
> = [
  ["stale_social_posts:", "redes"],
  ["social_not_linked_on_site:", "redes"],
  ["social_handle_mismatch:", "redes"],
  ["social_on_site_unregistered:", "site"],
]

export function digitalPresenceOpportunityTheme(
  id: string,
): DigitalPresenceStepTabId {
  for (const [prefix, theme] of THEME_BY_PREFIX) {
    if (id.startsWith(prefix)) return theme
  }
  // Os ids de gap são literais de template, então `tsc` não consegue exigir
  // exaustividade como faz no `Record` do Website. Cair em "site" mantém o item
  // visível na coluna em vez de sumir do agrupamento.
  return "site"
}

const EMPTY_BY_THEME = (): Record<
  DigitalPresenceStepTabId,
  DigitalPresenceOpportunityItem[]
> => ({
  redes: [],
  site: [],
})

/**
 * Reduce sobre a lista recebida: a soma dos grupos é a lista, por construção.
 * Nenhum item pode sumir entre o contador da aba e o grupo da coluna.
 */
export function digitalPresenceOpportunitiesByTheme(
  items: ReadonlyArray<DigitalPresenceOpportunityItem>,
): Record<DigitalPresenceStepTabId, DigitalPresenceOpportunityItem[]> {
  return items.reduce((acc, item) => {
    acc[digitalPresenceOpportunityTheme(item.id)].push(item)
    return acc
  }, EMPTY_BY_THEME())
}
