import {
  DIGITAL_CHANNEL_TAKEN_MESSAGE,
  digitalChannelConflictKey,
  isDigitalChannelType,
  readLeadDigitalChannels,
  type DigitalChannelType,
  type LeadDigitalChannel,
  type LeadDigitalChannelWrite,
} from "@/lib/leads/digital-channels"
import type { createClient } from "@/lib/supabase/server"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type SyncLeadChannelsResult =
  | { status: "ok"; channels: LeadDigitalChannel[] }
  | {
      status: "conflict"
      type: DigitalChannelType
      existingLeadId: string
      message: string
    }
  | { status: "error" }

export type ChannelConflictLookup =
  | { status: "ok" }
  | { status: "conflict"; type: DigitalChannelType; existingLeadId: string }
  | { status: "error" }

export async function findChannelConflict(
  supabase: SupabaseClient,
  channels: LeadDigitalChannelWrite[],
  excludeLeadId?: string,
): Promise<ChannelConflictLookup> {
  const keys = [...new Set(channels.map((channel) => channel.normalized_key))]
  if (keys.length === 0) return { status: "ok" }

  const { data, error } = await supabase
    .from("lead_digital_channels")
    .select("lead_id, type, normalized_key")
    .in("normalized_key", keys)

  if (error) return { status: "error" }

  const incoming = new Set(
    channels.map((channel) =>
      digitalChannelConflictKey(channel.type, channel.normalized_key),
    ),
  )

  for (const row of data ?? []) {
    if (!isDigitalChannelType(row.type)) continue
    if (typeof row.lead_id !== "string") continue
    if (typeof row.normalized_key !== "string") continue
    if (excludeLeadId && row.lead_id === excludeLeadId) continue
    const key = digitalChannelConflictKey(row.type, row.normalized_key)
    if (!incoming.has(key)) continue
    return {
      status: "conflict",
      type: row.type,
      existingLeadId: row.lead_id,
    }
  }

  return { status: "ok" }
}

export async function syncLeadChannels(
  supabase: SupabaseClient,
  leadId: string,
  channels: LeadDigitalChannelWrite[],
): Promise<SyncLeadChannelsResult> {
  const conflict = await findChannelConflict(supabase, channels, leadId)
  if (conflict.status === "error") return { status: "error" }
  if (conflict.status === "conflict") {
    return {
      status: "conflict",
      type: conflict.type,
      existingLeadId: conflict.existingLeadId,
      message: DIGITAL_CHANNEL_TAKEN_MESSAGE[conflict.type],
    }
  }

  const { error: deleteError } = await supabase
    .from("lead_digital_channels")
    .delete()
    .eq("lead_id", leadId)
  if (deleteError) return { status: "error" }

  if (channels.length === 0) return { status: "ok", channels: [] }

  const { data, error } = await supabase
    .from("lead_digital_channels")
    .insert(
      channels.map((channel) => ({
        lead_id: leadId,
        type: channel.type,
        value: channel.value,
        normalized_key: channel.normalized_key,
        is_primary: channel.is_primary,
        sort_order: channel.sort_order,
      })),
    )
    .select("id, type, value, normalized_key, is_primary, sort_order")

  if (error) {
    if (error.code === "23505") {
      const raced = await findChannelConflict(supabase, channels, leadId)
      if (raced.status === "conflict") {
        return {
          status: "conflict",
          type: raced.type,
          existingLeadId: raced.existingLeadId,
          message: DIGITAL_CHANNEL_TAKEN_MESSAGE[raced.type],
        }
      }
      const website = channels.find((channel) => channel.type === "website")
      return {
        status: "conflict",
        type: website?.type ?? "website",
        existingLeadId: "",
        message: DIGITAL_CHANNEL_TAKEN_MESSAGE[website?.type ?? "website"],
      }
    }
    return { status: "error" }
  }

  return {
    status: "ok",
    channels: readLeadDigitalChannels(data),
  }
}
