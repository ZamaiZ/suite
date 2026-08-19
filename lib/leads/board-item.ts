import {
  emptyChannelCounts,
  type LeadChannelCounts,
} from "@/lib/leads/channel"
import { isLeadStatus, type LeadStatus } from "@/lib/leads/status"
import type { LeadTag } from "@/lib/leads/tags"

export type { LeadChannelCounts, LeadTag }

export type LeadBoardItem = {
  id: string
  company_name: string
  website: string
  website_domain: string
  status: LeadStatus
  next_follow_up_at: string | null
  created_at: string
  assigned_sdr_id: string | null
  assignee_name: string | null
  assigned_closer_id: string | null
  closer_name: string | null
  closing_meeting_at: string | null
  from_denial: boolean
  last_activity_at: string | null
  activity_count: number
  activity_counts: LeadChannelCounts
  tags: LeadTag[]
}

export type LeadBoardRow = {
  id: string
  company_name: string
  website: string
  website_domain: string
  status: string
  next_follow_up_at: string | null
  created_at: string
  assigned_sdr_id: string | null
  assigned_closer_id: string | null
  closing_meeting_at: string | null
}

export function toLeadBoardItem(
  row: LeadBoardRow,
  extras?: {
    assignee_name?: string | null
    closer_name?: string | null
    from_denial?: boolean
    last_activity_at?: string | null
    activity_count?: number
    activity_counts?: LeadChannelCounts
    tags?: LeadTag[]
  },
): LeadBoardItem | null {
  if (!isLeadStatus(row.status)) return null
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
    from_denial: extras?.from_denial ?? false,
    last_activity_at: extras?.last_activity_at ?? null,
    activity_count: extras?.activity_count ?? 0,
    activity_counts: extras?.activity_counts ?? emptyChannelCounts(),
    tags: extras?.tags ?? [],
  }
}

export function leadAccessFlags(lead: {
  status: string
  assigned_sdr_id: string | null
}) {
  const assigned = Boolean(lead.assigned_sdr_id)
  const interested = lead.status === "interested"
  return {
    canClaim: lead.status === "new" && !assigned,
    canUnclaim: assigned && !interested,
    canLogActivity: assigned && !interested,
  }
}

export function readEmbeddedName(
  embed: { name: string } | { name: string }[] | null | undefined,
): string | null {
  if (!embed) return null
  if (Array.isArray(embed)) return embed[0]?.name ?? null
  return embed.name
}
