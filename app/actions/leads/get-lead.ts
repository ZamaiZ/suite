"use server"

import { z } from "zod"
import { requireCommercialMember } from "@/lib/auth/session"
import { leadAccessFlags } from "@/lib/leads/board-item"
import { isLeadStatus } from "@/lib/leads/status"
import { readLeadTags, type LeadTag } from "@/lib/leads/tags"
import type { LeadDetailActivity, LeadRecord } from "@/lib/leads/types"
import { createClient } from "@/lib/supabase/server"

export type { LeadDetailActivity, LeadTag }

export type LeadDetail = {
  lead: LeadRecord
  tags: LeadTag[]
  assigneeName: string | null
  createdByName: string | null
  activities: LeadDetailActivity[]
  canClaim: boolean
  canUnclaim: boolean
  canLogActivity: boolean
}

export type GetLeadDetailState =
  | { status: "success"; data: LeadDetail }
  | { status: "not_found" }
  | { status: "error"; message: string }

export async function getLeadDetail(
  leadId: string,
): Promise<GetLeadDetailState> {
  await requireCommercialMember()

  const parsed = z.uuid().safeParse(leadId)
  if (!parsed.success) {
    return { status: "error", message: "Lead inválido." }
  }

  const id = parsed.data
  const supabase = await createClient()

  const [
    { data: lead, error: leadError },
    { data: activities, error: activityError },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("*, lead_tags(tags(id, name))")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("lead_activities")
      .select(
        "id, type, channel, channel_detail, note, denied_reason, follow_up_at, created_by, created_at",
      )
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
  ])

  if (leadError) {
    return {
      status: "error",
      message: "Não foi possível carregar o lead. Tente novamente.",
    }
  }

  if (!lead) return { status: "not_found" }

  if (activityError) {
    return {
      status: "error",
      message: "Não foi possível carregar o histórico. Tente novamente.",
    }
  }

  const { lead_tags: tagEmbed, ...leadRow } = lead as LeadRecord & {
    lead_tags?: unknown
  }
  const record = leadRow as LeadRecord
  const tags = readLeadTags(tagEmbed)
  if (!isLeadStatus(record.status)) {
    return { status: "error", message: "Lead com status inválido." }
  }

  const userIds = [
    ...new Set(
      [
        record.assigned_sdr_id,
        record.created_by,
        ...(activities ?? []).map((activity) => activity.created_by),
      ].filter((value): value is string => typeof value === "string"),
    ),
  ]

  const namesById = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("users")
      .select("id, name")
      .in("id", userIds)

    if (profileError) {
      return {
        status: "error",
        message: "Não foi possível carregar o lead. Tente novamente.",
      }
    }

    for (const profile of profiles ?? []) {
      namesById.set(profile.id, profile.name)
    }
  }

  return {
    status: "success",
    data: {
      lead: record,
      tags,
      assigneeName: record.assigned_sdr_id
        ? (namesById.get(record.assigned_sdr_id) ?? null)
        : null,
      createdByName: namesById.get(record.created_by) ?? null,
      activities: (activities ?? []).map((activity) => ({
        id: activity.id,
        type: activity.type,
        channel: activity.channel,
        channel_detail: activity.channel_detail,
        note: activity.note,
        denied_reason: activity.denied_reason,
        follow_up_at: activity.follow_up_at,
        created_by: activity.created_by,
        created_at: activity.created_at,
        created_by_name: namesById.get(activity.created_by) ?? null,
      })),
      ...leadAccessFlags(record),
    },
  }
}
