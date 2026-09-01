"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { readEmbeddedName, type LeadBoardItem } from "@/lib/leads/board-item"
import {
  canRecordClosingOutcome,
  canRescheduleClosing,
  CLEARED_CLOSING_FIELDS,
  isClosingEventAllowed,
  isClosingStage,
} from "@/lib/leads/closing"
import { isLeadStatus } from "@/lib/leads/status"
import type { LeadDetailActivity } from "@/lib/leads/types"
import { createClient } from "@/lib/supabase/server"
import {
  logClosingEventSchema,
  readClosingEventFormFields,
} from "@/lib/validations/lead-closing"

export type LogClosingEventField =
  | "type"
  | "channel"
  | "channel_detail"
  | "note"
  | "denied_reason"
  | "closer_id"
  | "follow_up_date"
  | "follow_up_time"

export type LeadClosingPatch = Pick<
  LeadBoardItem,
  | "status"
  | "next_follow_up_at"
  | "from_denial"
  | "from_closing_loss"
  | "last_activity_at"
  | "assigned_closer_id"
  | "closer_name"
  | "closing_meeting_at"
  | "closing_stage"
>

export type LogClosingEventState =
  | {
      status: "success"
      message: string
      activity: LeadDetailActivity
      patch: LeadClosingPatch
    }
  | {
      status: "error"
      message: string
      fieldErrors?: Partial<Record<LogClosingEventField, string[]>>
    }

type LeadUpdate = {
  status?: string
  next_follow_up_at?: string | null
  assigned_closer_id?: string | null
  closing_meeting_at?: string | null
  closing_stage?: string | null
  legal_name?: string | null
  tax_id?: string | null
  signer_name?: string | null
  contract_ref?: string | null
  invoice_ref?: string | null
  contract_sent_at?: string | null
  contract_signed_at?: string | null
  invoice_sent_at?: string | null
  paid_at?: string | null
  updated_at: string
}

export async function logClosingEvent(
  formData: FormData,
): Promise<LogClosingEventState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = logClosingEventSchema.safeParse(
    readClosingEventFormFields(formData),
  )

  if (!parsed.success) {
    return {
      status: "error",
      message: "Revise os dados do fechamento.",
      fieldErrors: parsed.error.flatten().fieldErrors as Partial<
        Record<LogClosingEventField, string[]>
      >,
    }
  }

  const payload = parsed.data
  const supabase = await createClient()
  const { data: lead, error: loadError } = await supabase
    .from("leads")
    .select(
      "id, status, company_name, contact_name, assigned_sdr_id, assigned_closer_id, closing_stage, closing_meeting_at, legal_name, signer_name",
    )
    .eq("id", payload.lead_id)
    .maybeSingle()

  if (loadError) {
    return {
      status: "error",
      message: "Não foi possível registrar o fechamento. Tente novamente.",
    }
  }

  if (!lead) {
    return { status: "error", message: "Lead não encontrado." }
  }

  if (!isLeadStatus(lead.status) || lead.status !== "interested") {
    return {
      status: "error",
      message: "Esta ação só vale para oportunidades.",
    }
  }

  if (!isClosingStage(lead.closing_stage)) {
    return { status: "error", message: "Estágio de fechamento inválido." }
  }

  if (!isClosingEventAllowed(lead.closing_stage, payload.type)) {
    return {
      status: "error",
      message: "Esta ação não se aplica ao estágio atual.",
    }
  }

  const actor = {
    status: lead.status,
    assigned_sdr_id: lead.assigned_sdr_id,
    assigned_closer_id: lead.assigned_closer_id,
    closing_stage: lead.closing_stage,
  }

  if (payload.type === "meeting_rescheduled") {
    if (!canRescheduleClosing(actor, user.id, roles)) {
      return {
        status: "error",
        message: "Você não pode reagendar esta reunião.",
      }
    }
  } else if (!canRecordClosingOutcome(actor, user.id, roles)) {
    return {
      status: "error",
      message: "Você não pode registrar o desfecho desta reunião.",
    }
  }

  let closerName: string | null = null
  let closerId = lead.assigned_closer_id

  if (payload.type === "meeting_rescheduled") {
    if (!payload.closer_id || !payload.follow_up_at) {
      return {
        status: "error",
        message: "Informe o closer e a data da reunião.",
        fieldErrors: {
          closer_id: payload.closer_id ? undefined : ["Selecione o closer."],
          follow_up_date: payload.follow_up_at
            ? undefined
            : ["Informe data e horário da reunião."],
        },
      }
    }

    const [{ data: closerRole }, { data: closer }] = await Promise.all([
      supabase
        .from("user_roles")
        .select("user_id")
        .eq("user_id", payload.closer_id)
        .eq("role", "closer")
        .maybeSingle(),
      supabase
        .from("users")
        .select("id, name")
        .eq("id", payload.closer_id)
        .maybeSingle(),
    ])

    if (!closerRole || !closer) {
      return {
        status: "error",
        message: "Selecione um closer válido.",
        fieldErrors: { closer_id: ["Selecione um closer válido."] },
      }
    }

    closerId = closer.id
    closerName = closer.name
  }

  const now = new Date().toISOString()
  let leadUpdate: LeadUpdate = { updated_at: now }
  let nextStatus: LeadBoardItem["status"] = "interested"
  let nextStage: LeadBoardItem["closing_stage"] = lead.closing_stage
  let nextFollowUp = null as string | null
  let nextMeeting = lead.closing_meeting_at
  let fromClosingLoss = false
  let nextCloserId = closerId
  let nextCloserName: string | null = closerName

  switch (payload.type) {
    case "meeting_rescheduled":
      leadUpdate = {
        closing_stage: "open",
        closing_meeting_at: payload.follow_up_at,
        assigned_closer_id: closerId,
        next_follow_up_at: null,
        updated_at: now,
      }
      nextStage = "open"
      nextMeeting = payload.follow_up_at
      nextFollowUp = null
      nextCloserId = closerId
      break
    case "meeting_no_show":
      leadUpdate = { closing_stage: "no_show", updated_at: now }
      nextStage = "no_show"
      break
    case "closing_standby":
      leadUpdate = {
        closing_stage: "standby",
        next_follow_up_at: payload.follow_up_at,
        updated_at: now,
      }
      nextStage = "standby"
      nextFollowUp = payload.follow_up_at
      break
    case "closing_won":
      leadUpdate = {
        closing_stage: "won_pending",
        next_follow_up_at: null,
        legal_name: lead.legal_name ?? lead.company_name,
        signer_name: lead.signer_name ?? lead.contact_name,
        updated_at: now,
      }
      nextStage = "won_pending"
      nextFollowUp = null
      break
    case "closing_lost":
      nextStatus = payload.follow_up_at ? "follow_up" : "denied"
      fromClosingLoss = true
      nextStage = null
      nextFollowUp = payload.follow_up_at
      nextMeeting = null
      nextCloserId = null
      nextCloserName = null
      leadUpdate = {
        status: nextStatus,
        next_follow_up_at: payload.follow_up_at,
        ...CLEARED_CLOSING_FIELDS,
        updated_at: now,
      }
      break
  }

  if (payload.type !== "meeting_rescheduled" && nextStatus === "interested") {
    const { data: closer } = lead.assigned_closer_id
      ? await supabase
          .from("users")
          .select("name")
          .eq("id", lead.assigned_closer_id)
          .maybeSingle()
      : { data: null }
    nextCloserName = closer?.name ?? null
  }

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
      message: "Não foi possível registrar o fechamento. Tente novamente.",
    }
  }

  const { error: updateError } = await supabase
    .from("leads")
    .update(leadUpdate)
    .eq("id", payload.lead_id)
    .eq("status", "interested")

  if (updateError) {
    return {
      status: "error",
      message: "A ação foi gravada, mas o lead não atualizou.",
    }
  }

  return {
    status: "success",
    message: "Fechamento atualizado.",
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
      status: nextStatus,
      next_follow_up_at: nextFollowUp,
      from_denial: false,
      from_closing_loss: fromClosingLoss,
      last_activity_at: activity.created_at,
      assigned_closer_id: nextCloserId,
      closer_name: nextCloserName,
      closing_meeting_at: nextMeeting,
      closing_stage: nextStage,
    },
  }
}
