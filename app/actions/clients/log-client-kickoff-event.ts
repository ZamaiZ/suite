"use server"

import { readEmbeddedName } from "@/lib/leads/board-item"
import { revalidatePath } from "next/cache"
import {
  canLogKickoff,
  isClientKickoffStage,
  isKickoffEventAllowed,
} from "@/lib/clients/kickoff"
import { denyUnlessCanManage, loadStaffClient } from "@/lib/clients/staff"
import { createClient } from "@/lib/supabase/server"
import {
  logClientKickoffEventSchema,
  readClientKickoffEventFormFields,
} from "@/lib/validations/client-kickoff"
import type { ClientKickoffActivity } from "./load-client-kickoff"

export type LogClientKickoffEventState =
  | {
      status: "success"
      activity: ClientKickoffActivity
      stage: "none" | "scheduled" | "no_show" | "completed"
      meetingAt: string | null
    }
  | { status: "error"; message: string }

export async function logClientKickoffEvent(
  formData: FormData,
): Promise<LogClientKickoffEventState> {
  const parsed = logClientKickoffEventSchema.safeParse(
    readClientKickoffEventFormFields(formData),
  )
  if (!parsed.success)
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revise os dados do kickoff.",
    }
  const input = parsed.data
  const loaded = await loadStaffClient(input.client_id)
  if (loaded.status === "error") return loaded
  const denied = denyUnlessCanManage(loaded.context)
  if (denied) return denied
  const supabase = await createClient()
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("kickoff_stage, kickoff_meeting_at, briefing_finalized_at")
    .eq("id", input.client_id)
    .maybeSingle()
  if (clientError || !client || !isClientKickoffStage(client.kickoff_stage))
    return { status: "error", message: "Não foi possível carregar o kickoff." }
  if (
    !canLogKickoff({
      roles: loaded.context.roles,
      userId: loaded.context.user.id,
      closerId: loaded.context.client.closer_id,
      finalizedAt:
        typeof client.briefing_finalized_at === "string"
          ? client.briefing_finalized_at
          : null,
    })
  )
    return {
      status: "error",
      message: "Envie o briefing antes de registrar o kickoff.",
    }
  if (!isKickoffEventAllowed(client.kickoff_stage, input.type))
    return {
      status: "error",
      message: "Esta ação não se aplica ao estágio atual.",
    }
  const next =
    input.type === "kickoff_scheduled" || input.type === "kickoff_rescheduled"
      ? { stage: "scheduled" as const, meetingAt: input.meeting_at }
      : input.type === "kickoff_no_show"
        ? {
            stage: "no_show" as const,
            meetingAt:
              typeof client.kickoff_meeting_at === "string"
                ? client.kickoff_meeting_at
                : null,
          }
        : input.type === "kickoff_completed"
          ? { stage: "completed" as const, meetingAt: null }
          : { stage: client.kickoff_stage, meetingAt: undefined }
  const { data: activity, error: insertError } = await supabase
    .from("client_activities")
    .insert({
      client_id: input.client_id,
      type: input.type,
      channel: input.channel,
      channel_detail: input.channel_detail,
      note: input.note,
      meeting_at: input.meeting_at,
      created_by: loaded.context.user.id,
    })
    .select(
      "id, type, channel, channel_detail, note, meeting_at, created_at, users!created_by(name)",
    )
    .single()
  if (insertError || !activity)
    return { status: "error", message: "Não foi possível registrar o kickoff." }
  const update =
    next.meetingAt === undefined
      ? { kickoff_stage: next.stage }
      : { kickoff_stage: next.stage, kickoff_meeting_at: next.meetingAt }
  const { error: updateError } = await supabase
    .from("clients")
    .update(update)
    .eq("id", input.client_id)
  if (updateError)
    return {
      status: "error",
      message: "A atividade foi gravada, mas o kickoff não atualizou.",
    }
  revalidatePath("/clients")
  return {
    status: "success",
    stage: next.stage,
    meetingAt:
      next.meetingAt === undefined
        ? typeof client.kickoff_meeting_at === "string"
          ? client.kickoff_meeting_at
          : null
        : next.meetingAt,
    activity: {
      id: activity.id,
      type: activity.type,
      channel: typeof activity.channel === "string" ? activity.channel : null,
      channelDetail:
        typeof activity.channel_detail === "string"
          ? activity.channel_detail
          : null,
      note: typeof activity.note === "string" ? activity.note : null,
      meetingAt:
        typeof activity.meeting_at === "string" ? activity.meeting_at : null,
      createdAt: activity.created_at,
      createdByName: readEmbeddedName(activity.users),
    },
  }
}
