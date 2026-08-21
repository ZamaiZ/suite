import type {
  DigitalChannelDraft,
  DigitalChannelType,
  LeadDigitalChannel,
  LeadDigitalChannelWrite,
} from "@/lib/leads/digital-channels"

export type LeadRecord = {
  id: string
  company_name: string
  website: string
  website_domain: string
  contact_name: string | null
  phone: string | null
  email: string | null
  observations: string | null
  status: string
  assigned_sdr_id: string | null
  assigned_closer_id: string | null
  next_follow_up_at: string | null
  closing_meeting_at: string | null
  created_by: string
  created_at: string
  updated_at: string
  channels: LeadDigitalChannel[]
}

export type LeadActivityRecord = {
  id: string
  lead_id: string
  type: string
  note: string | null
  denied_reason: string | null
  follow_up_at: string | null
  channel: string | null
  channel_detail: string | null
  created_by: string
  created_at: string
}

export type LeadDetailActivity = {
  id: string
  type: string
  note: string | null
  denied_reason: string | null
  follow_up_at: string | null
  channel: string | null
  channel_detail: string | null
  created_by: string
  created_at: string
  created_by_name: string | null
}

export type LeadWritePayload = {
  company_name: string
  website: string
  website_domain: string
  channels: LeadDigitalChannelWrite[]
  contact_name: string | null
  phone: string | null
  email: string | null
  observations: string | null
}

export type SpreadsheetIssueKind = "problem" | "conflict"

export type SpreadsheetIssue = {
  row: number
  field: string | null
  kind: SpreadsheetIssueKind
  message: string
}

export type SpreadsheetRawValues = Record<DigitalChannelType, string> & {
  company_name: string
  contact_name: string
  phone: string
  email: string
}

export type SpreadsheetEvaluatedRow = {
  row: number
  values: SpreadsheetRawValues
  payload: LeadWritePayload | null
  issues: SpreadsheetIssue[]
}

export type { DigitalChannelDraft, LeadDigitalChannel, LeadDigitalChannelWrite }
