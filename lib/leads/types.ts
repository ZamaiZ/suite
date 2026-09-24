import type {
  DigitalChannelDraft,
  DigitalChannelType,
  LeadDigitalChannel,
  LeadDigitalChannelWrite,
} from "@/lib/leads/digital-channels"
import type { LeadSegment } from "@/lib/leads/segments"
import type { BrazilStateCode } from "@/lib/br-locations"

export type LeadRecord = {
  id: string
  company_name: string
  website: string | null
  website_domain: string | null
  contact_name: string | null
  phone: string | null
  email: string | null
  observations: string | null
  segment_id: string | null
  state_code: BrazilStateCode | null
  city: string | null
  status: string
  assigned_sdr_id: string | null
  assigned_closer_id: string | null
  next_follow_up_at: string | null
  closing_meeting_at: string | null
  closing_stage: string | null
  legal_name: string | null
  tax_id: string | null
  signer_name: string | null
  contract_ref: string | null
  invoice_ref: string | null
  contract_sent_at: string | null
  contract_signed_at: string | null
  invoice_sent_at: string | null
  paid_at: string | null
  created_by: string
  created_at: string
  updated_at: string
  channels: LeadDigitalChannel[]
  segment: LeadSegment | null
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
  website: string | null
  website_domain: string | null
  channels: LeadDigitalChannelWrite[]
  contact_name: string | null
  phone: string | null
  email: string | null
  observations: string | null
  segment: string
  state_code: BrazilStateCode
  city: string
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
  segment: string
  state_code: string
  city: string
  tags: string
  contact_name: string
  phone: string
  email: string
}

export type SpreadsheetEvaluatedRow = {
  row: number
  values: SpreadsheetRawValues
  payload: SpreadsheetLeadWritePayload | null
  issues: SpreadsheetIssue[]
}

export type SpreadsheetLeadWritePayload = LeadWritePayload & {
  website: string
  website_domain: string
}

export type { DigitalChannelDraft, LeadDigitalChannel, LeadDigitalChannelWrite }
