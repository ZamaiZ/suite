import type { LeadBoardItem } from "@/lib/leads/board-item"
import type { LeadsListParams } from "@/lib/leads/queues"

export type { LeadBoardItem }

export type LeadTagFilterOption = {
  slug: string
  name: string
}

export type LeadSegmentFilterOption = {
  slug: string
  name: string
}

export type LeadBoardProps = {
  leads: LeadBoardItem[]
  currentUserId: string
  listParams: LeadsListParams
  tagOptions: LeadTagFilterOption[]
  segmentOptions: LeadSegmentFilterOption[]
  canViewTeamLeads: boolean
  initialLeadId?: string | null
}
