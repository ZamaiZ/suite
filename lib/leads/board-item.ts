import { isClosingStage, type ClosingStage } from "@/lib/leads/closing"
import { emptyChannelCounts, type LeadChannelCounts } from "@/lib/leads/channel"
import { isLeadStatus, type LeadStatus } from "@/lib/leads/status"
import type { BrazilStateCode } from "@/lib/br-locations"
import type { LeadSegment } from "@/lib/leads/segments"
import type { LeadTag } from "@/lib/leads/tags"

export type { LeadChannelCounts, LeadTag, LeadSegment }

export type LeadBoardItem = {
  id: string
  company_name: string
  website: string | null
  website_domain: string | null
  status: LeadStatus
  next_follow_up_at: string | null
  created_at: string
  assigned_sdr_id: string | null
  assignee_name: string | null
  assigned_closer_id: string | null
  closer_name: string | null
  closing_meeting_at: string | null
  closing_stage: ClosingStage | null
  from_denial: boolean
  from_closing_loss: boolean
  last_activity_at: string | null
  activity_count: number
  activity_counts: LeadChannelCounts
  tags: LeadTag[]
  segment: LeadSegment | null
  state_code: BrazilStateCode | null
  city: string | null
  client_id: string | null
  converted_at: string | null
  can_view_client: boolean
}

export type LeadBoardRow = {
  id: string
  company_name: string
  website: string | null
  website_domain: string | null
  status: string
  next_follow_up_at: string | null
  created_at: string
  assigned_sdr_id: string | null
  assigned_closer_id: string | null
  closing_meeting_at: string | null
  closing_stage?: string | null
  state_code?: BrazilStateCode | null
  city?: string | null
  segments?: LeadSegment | { name: string } | { name: string }[] | null
}

export function toLeadBoardItem(
  row: LeadBoardRow,
  extras?: {
    assignee_name?: string | null
    closer_name?: string | null
    from_denial?: boolean
    from_closing_loss?: boolean
    last_activity_at?: string | null
    activity_count?: number
    activity_counts?: LeadChannelCounts
    tags?: LeadTag[]
    segment?: LeadSegment | null
    state_code?: BrazilStateCode | null
    city?: string | null
    client_id?: string | null
    converted_at?: string | null
    can_view_client?: boolean
  },
): LeadBoardItem | null {
  if (!isLeadStatus(row.status)) return null
  const embeddedSegment = row.segments
  let segment = extras?.segment ?? null
  if (!segment && embeddedSegment) {
    if (Array.isArray(embeddedSegment)) {
      const first = embeddedSegment[0]
      if (first && typeof first.name === "string") {
        segment =
          "id" in first && typeof first.id === "string"
            ? { id: first.id, name: first.name }
            : null
      }
    } else if (
      typeof embeddedSegment === "object" &&
      "name" in embeddedSegment &&
      typeof embeddedSegment.name === "string"
    ) {
      segment =
        "id" in embeddedSegment && typeof embeddedSegment.id === "string"
          ? { id: embeddedSegment.id, name: embeddedSegment.name }
          : null
    }
  }
  return {
    id: row.id,
    company_name: row.company_name,
    website: row.website,
    website_domain: row.website_domain,
    status: row.status,
    next_follow_up_at: row.next_follow_up_at,
    created_at: row.created_at,
    assigned_sdr_id: row.assigned_sdr_id,
    assignee_name: extras?.assignee_name ?? null,
    assigned_closer_id: row.assigned_closer_id ?? null,
    closer_name: extras?.closer_name ?? null,
    closing_meeting_at: row.closing_meeting_at ?? null,
    closing_stage: isClosingStage(row.closing_stage) ? row.closing_stage : null,
    from_denial: extras?.from_denial ?? false,
    from_closing_loss: extras?.from_closing_loss ?? false,
    last_activity_at: extras?.last_activity_at ?? null,
    activity_count: extras?.activity_count ?? 0,
    activity_counts: extras?.activity_counts ?? emptyChannelCounts(),
    tags: extras?.tags ?? [],
    segment,
    state_code: extras?.state_code ?? row.state_code ?? null,
    city: extras?.city ?? row.city ?? null,
    client_id: extras?.client_id ?? null,
    converted_at: extras?.converted_at ?? null,
    can_view_client: extras?.can_view_client ?? false,
  }
}

export function leadAccessFlags(lead: {
  status: string
  assigned_sdr_id: string | null
}) {
  const assigned = Boolean(lead.assigned_sdr_id)
  const closed = lead.status === "interested" || lead.status === "converted"
  return {
    canClaim: lead.status === "new" && !assigned,
    canUnclaim: assigned && !closed,
    canLogActivity: assigned && !closed,
  }
}

export function readEmbeddedName(
  embed: { name: string } | { name: string }[] | null | undefined,
): string | null {
  if (!embed) return null
  if (Array.isArray(embed)) return embed[0]?.name ?? null
  return embed.name
}
