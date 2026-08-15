"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { readEmbeddedName, type LeadBoardItem } from "@/lib/leads/board-item"
import { deriveLeadStatus, isLeadStatus } from "@/lib/leads/status"
import type { LeadDetailActivity } from "@/lib/leads/types"
import { createClient } from "@/lib/supabase/server"
import {
  logLeadActivitySchema,
  readLeadActivityFormFields,
} from "@/lib/validations/lead-activity"

export type LogLeadActivityField =
  | "type"
  | "channel"
  | "channel_detail"
  | "note"
  | "denied_reason"
  | "follow_up_date"
  | "follow_up_time"

export type LeadActivityPatch = Pick<
  LeadBoardItem,
  "status" | "next_follow_up_at" | "from_denial" | "last_activity_at"
>

export type LogLeadActivityState =
  | {
      status: "success"
      message: string
      activity: LeadDetailActivity
      patch: LeadActivityPatch
    }
  | {
      status: "error"
      message: string
      fieldErrors?: Partial<Record<LogLeadActivityField, string[]>>
    }

export async function logLeadActivity(
  formData: FormData,
): Promise<LogLeadActivityState> {
  const { user } = await requireCommercialMember()
  const parsed = logLeadActivitySchema.safeParse(
    readLeadActivityFormFields(formData),
  )

  if (!parsed.success) {
    return {
      status: "error",
      message: "Revise os dados da tentativa.",
      fieldErrors: parsed.error.flatten().fieldErrors as Partial<
        Record<LogLeadActivityField, string[]>
      >,
    }
  }

  const payload = parsed.data
  const supabase = await createClient()
  const { data: lead, error: loadError } = await supabase
    .from("leads")
    .select("id, status, assigned_sdr_id")
    .eq("id", payload.lead_id)
    .maybeSingle()

  if (loadError) {
    return {
      status: "error",
      message: "Não foi possível registrar a tentativa. Tente novamente.",
    }
  }

  if (!lead) {
    return { status: "error", message: "Lead não encontrado." }
  }

  if (!isLeadStatus(lead.status)) {
    return { status: "error", message: "Status do lead inválido." }
  }

  if (lead.status === "interested") {
    return {
      status: "error",
      message: "Este lead já tem interesse. Não há novas tentativas nesta etapa.",
    }
  }

  if (!lead.assigned_sdr_id) {
    return {
      status: "error",
      message: "Reivindique o lead antes de registrar contato.",
    }
  }

  const next = deriveLeadStatus(payload.type, payload.follow_up_at)
  const { data: activity, error: insertError } = await supabase
    .from("lead_activities")
    .insert({
      lead_id: payload.lead_id,
      type: payload.type,
      channel: payload.channel,
      channel_detail: payload.channel_detail,
      note: payload.note,
      denied_reason: payload.denied_reason,
      follow_up_at: payload.follow_up_at,
      created_by: user.id,
    })
    .select(
      "id, type, channel, channel_detail, note, denied_reason, follow_up_at, created_by, created_at, users!created_by(name)",
    )
    .single()

  if (insertError || !activity) {
    return {
      status: "error",
      message: "Não foi possível registrar a tentativa. Tente novamente.",
    }
  }

  const { error: updateError } = await supabase
    .from("leads")
    .update({
      status: next.status,
      next_follow_up_at: next.nextFollowUpAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.lead_id)
    .neq("status", "interested")
    .not("assigned_sdr_id", "is", null)

  if (updateError) {
    return {
      status: "error",
      message: "A tentativa foi gravada, mas o status do lead não atualizou.",
    }
  }

  return {
    status: "success",
    message: "Tentativa registrada.",
    activity: {
      id: activity.id,
      type: activity.type,
      channel: activity.channel,
      channel_detail: activity.channel_detail,
      note: activity.note,
      denied_reason: activity.denied_reason,
      follow_up_at: activity.follow_up_at,
      created_by: activity.created_by,
      created_at: activity.created_at,
      created_by_name: readEmbeddedName(
        activity.users as { name: string } | { name: string }[] | null,
      ),
    },
    patch: {
      status: next.status,
      next_follow_up_at: next.nextFollowUpAt,
      from_denial: payload.type === "denied" && next.status === "follow_up",
      last_activity_at: activity.created_at,
    },
  }
}
