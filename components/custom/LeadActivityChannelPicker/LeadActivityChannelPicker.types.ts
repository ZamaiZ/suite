import type { LeadActivityChannel } from "@/lib/leads/channel"

export type LeadActivityChannelPickerProps = {
  id: string
  value: LeadActivityChannel | ""
  detail: string
  onValueChange: (channel: LeadActivityChannel) => void
  onDetailChange: (detail: string) => void
  error?: string
  detailError?: string
  disabled?: boolean
}
