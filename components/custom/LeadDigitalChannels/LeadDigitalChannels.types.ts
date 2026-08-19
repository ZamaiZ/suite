import type { DigitalChannelDraft } from "@/lib/leads/digital-channels"

export type LeadDigitalChannelsHandle = {
  flush: () => boolean
}

export type LeadDigitalChannelsProps = {
  id: string
  value: DigitalChannelDraft[]
  onValueChange: (value: DigitalChannelDraft[]) => void
  error?: string
  disabled?: boolean
  onBlur?: () => void
  onDraftChange?: (dirty: boolean) => void
}

export type LeadDigitalChannelListProps = {
  channels: DigitalChannelDraft[]
}
