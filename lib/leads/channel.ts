export const LEAD_ACTIVITY_CHANNELS = [
  "email",
  "call",
  "whatsapp",
  "other",
] as const

export type LeadActivityChannel = (typeof LEAD_ACTIVITY_CHANNELS)[number]

export const LEAD_ACTIVITY_CHANNEL_LABELS: Record<LeadActivityChannel, string> =
  {
    email: "E-mail",
    call: "Ligação",
    whatsapp: "WhatsApp",
    other: "Outro",
  }

export function isLeadActivityChannel(
  value: unknown,
): value is LeadActivityChannel {
  return (
    typeof value === "string" &&
    (LEAD_ACTIVITY_CHANNELS as readonly string[]).includes(value)
  )
}

export type LeadChannelCounts = Record<LeadActivityChannel, number>

export function emptyChannelCounts(): LeadChannelCounts {
  return { email: 0, call: 0, whatsapp: 0, other: 0 }
}

export function countActivitiesByChannel(
  activities: { channel: string | null }[],
): LeadChannelCounts {
  const counts = emptyChannelCounts()
  for (const activity of activities) {
    if (isLeadActivityChannel(activity.channel)) {
      counts[activity.channel] += 1
    }
  }
  return counts
}

export function incrementChannelCount(
  current: LeadChannelCounts | undefined,
  channel: unknown,
): LeadChannelCounts {
  const counts = { ...(current ?? emptyChannelCounts()) }
  if (isLeadActivityChannel(channel)) {
    counts[channel] += 1
  }
  return counts
}

export function activityChannelLabel(
  channel: string | null,
  detail: string | null,
): string | null {
  if (!isLeadActivityChannel(channel)) return null
  if (channel === "other") {
    const specified = detail?.trim()
    return specified && specified.length > 0
      ? specified
      : LEAD_ACTIVITY_CHANNEL_LABELS.other
  }
  return LEAD_ACTIVITY_CHANNEL_LABELS[channel]
}
