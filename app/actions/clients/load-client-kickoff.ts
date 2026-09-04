"use server"

import { z } from "zod"
import { canLogKickoff, isClientKickoffActivityType, type ClientKickoffActivityType } from "@/lib/clients/kickoff"
import { denyUnlessCanManage, loadStaffClient } from "@/lib/clients/staff"

export type ClientKickoffActivity = { id: string; type: ClientKickoffActivityType; channel: string | null; channelDetail: string | null; note: string | null; meetingAt: string | null; createdAt: string; createdByName: string | null }
export type ClientKickoffDetail = { stage: "none" | "scheduled" | "no_show" | "completed"; meetingAt: string | null; canLog: boolean; activities: ClientKickoffActivity[] }
export type LoadClientKickoffState = { status: "success"; detail: ClientKickoffDetail } | { status: "error"; message: string }

export async function loadClientKickoff(clientId: string): Promise<LoadClientKickoffState> {
  const parsed = z.uuid().safeParse(clientId)
  if (!parsed.success) return { status: "error", message: "Cliente inválido." }
  const loaded = await loadStaffClient(parsed.data)
  if (loaded.status === "error") return loaded
  const denied = denyUnlessCanManage(loaded.context)
  if (denied) return denied
  const { data, error } = await loaded.context.supabase.from("clients").select("kickoff_stage, kickoff_meeting_at, briefing_finalized_at").eq("id", parsed.data).maybeSingle()
  if (error || !data) return { status: "error", message: "Não foi possível carregar o kickoff." }
  const { data: rows, error: activitiesError } = await loaded.context.supabase.from("client_activities").select("id, type, channel, channel_detail, note, meeting_at, created_at, users!created_by(name)").eq("client_id", parsed.data).order("created_at", { ascending: false })
  if (activitiesError) return { status: "error", message: "Não foi possível carregar o kickoff." }
  return { status: "success", detail: { stage: data.kickoff_stage, meetingAt: typeof data.kickoff_meeting_at === "string" ? data.kickoff_meeting_at : null, canLog: canLogKickoff({ roles: loaded.context.roles, userId: loaded.context.user.id, closerId: loaded.context.client.closer_id, finalizedAt: typeof data.briefing_finalized_at === "string" ? data.briefing_finalized_at : null }), activities: (rows ?? []).flatMap((row) => isClientKickoffActivityType(row.type) ? [{ id: row.id, type: row.type, channel: typeof row.channel === "string" ? row.channel : null, channelDetail: typeof row.channel_detail === "string" ? row.channel_detail : null, note: typeof row.note === "string" ? row.note : null, meetingAt: typeof row.meeting_at === "string" ? row.meeting_at : null, createdAt: row.created_at, createdByName: Array.isArray(row.users) ? row.users[0]?.name ?? null : row.users?.name ?? null }] : []) } }
}
