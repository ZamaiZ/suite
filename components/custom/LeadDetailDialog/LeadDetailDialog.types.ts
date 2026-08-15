import type { LeadBoardItem } from "@/lib/leads/board-item"
import type { LeadStatus } from "@/lib/leads/status"

export type LeadDetailTab = "activity" | "record"

export type LeadDetailPreview = {
  company_name: string
  website_domain: string
  status: LeadStatus
  next_follow_up_at: string | null
  activity_count: number
  assignee_name: string | null
}

export type LeadDetailDialogProps = {
  open: boolean
  onClose: () => void
  leadId: string | null
  preview?: LeadDetailPreview | null
  readOnly?: boolean
  onMutated?: (patch: Partial<LeadBoardItem>) => void
}
