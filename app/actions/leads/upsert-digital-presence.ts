"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import {
  digitalPresenceReviewForChannels,
  readLeadDigitalPresenceAuditRow,
  type LeadDigitalPresenceAudit,
} from "@/lib/leads/digital-presence"
import { stampDigitalPresenceReview } from "@/lib/leads/digital-presence-review"
import { readLeadDigitalChannels } from "@/lib/leads/digital-channels"
import {
  readUpsertDigitalPresenceFields,
  upsertDigitalPresenceSchema,
} from "@/lib/validations/lead-digital-presence"
import { createClient } from "@/lib/supabase/server"
import {
  denyDigitalPresenceEdit,
  DIGITAL_PRESENCE_SELECT,
  loadDigitalPresenceAuditByLead,
} from "./digital-presence-access"

export type UpsertLeadDigitalPresenceState =
  | { status: "success"; audit: LeadDigitalPresenceAudit }
  | { status: "error"; message: string }

const SAVE_FAILED = "Não foi possível salvar. Tente novamente."

export async function upsertLeadDigitalPresence(
  formData: FormData,
): Promise<UpsertLeadDigitalPresenceState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = upsertDigitalPresenceSchema.safeParse(
    readUpsertDigitalPresenceFields(formData),
  )
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revise os dados.",
    }
  }

  const supabase = await createClient()
  const loaded = await loadDigitalPresenceAuditByLead(
    supabase,
    parsed.data.lead_id,
  )
  if (loaded.status === "error") {
    return { status: "error", message: SAVE_FAILED }
  }
  if (loaded.status === "not_found") {
    return { status: "error", message: "Lead não encontrado." }
  }

  const denied = denyDigitalPresenceEdit(loaded.lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  const { data: channelRows, error: channelError } = await supabase
    .from("lead_digital_channels")
    .select("id, type, value, normalized_key, is_primary, sort_order")
    .eq("lead_id", parsed.data.lead_id)

  if (channelError) {
    return { status: "error", message: SAVE_FAILED }
  }

  const channels = readLeadDigitalChannels(channelRows)
  const now = new Date().toISOString()
  const review = stampDigitalPresenceReview(
    digitalPresenceReviewForChannels(parsed.data.review, channels),
    user.id,
    now,
  )

  if (loaded.audit) {
    const { data, error } = await supabase
      .from("lead_digital_presence_audits")
      .update({
        review,
        updated_at: now,
        updated_by: user.id,
      })
      .eq("id", loaded.audit.id)
      .select(DIGITAL_PRESENCE_SELECT)
      .single()

    if (error || !data) {
      return { status: "error", message: SAVE_FAILED }
    }
    const audit = readLeadDigitalPresenceAuditRow(data as Record<string, unknown>)
    if (!audit) return { status: "error", message: SAVE_FAILED }
    return { status: "success", audit }
  }

  const { data, error } = await supabase
    .from("lead_digital_presence_audits")
    .insert({
      lead_id: parsed.data.lead_id,
      review,
      updated_at: now,
      updated_by: user.id,
    })
    .select(DIGITAL_PRESENCE_SELECT)
    .single()

  if (error || !data) {
    return { status: "error", message: SAVE_FAILED }
  }
  const audit = readLeadDigitalPresenceAuditRow(data as Record<string, unknown>)
  if (!audit) return { status: "error", message: SAVE_FAILED }
  return { status: "success", audit }
}
