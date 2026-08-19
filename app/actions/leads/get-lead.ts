"use server"

import { z } from "zod"
import { requireCommercialMember } from "@/lib/auth/session"
import { leadAccessFlags } from "@/lib/leads/board-item"
import { readLeadDigitalChannels } from "@/lib/leads/digital-channels"
import {
  canEditLeadGbp,
  matchWebsiteKey,
  readLeadGbpProfiles,
  websiteKeysFromChannels,
  type LeadGbpProfile,
} from "@/lib/leads/gbp"
import {
  readLeadWebsiteAudits,
  type LeadWebsiteAudit,
} from "@/lib/leads/website-audit"
import { isLeadStatus } from "@/lib/leads/status"
import { readLeadTags, type LeadTag } from "@/lib/leads/tags"
import type { LeadDetailActivity, LeadRecord } from "@/lib/leads/types"
import { createClient } from "@/lib/supabase/server"
import { GBP_SELECT } from "./gbp-access"
import { WEBSITE_SELECT } from "./website-access"

export type { LeadDetailActivity, LeadTag, LeadGbpProfile, LeadWebsiteAudit }

export type LeadDetail = {
  lead: LeadRecord
  tags: LeadTag[]
  gbpProfiles: LeadGbpProfile[]
  websiteAudits: LeadWebsiteAudit[]
  assigneeName: string | null
  closerName: string | null
  createdByName: string | null
  activities: LeadDetailActivity[]
  canClaim: boolean
  canUnclaim: boolean
  canLogActivity: boolean
  canEditGbp: boolean
}

export type GetLeadDetailState =
  | { status: "success"; data: LeadDetail }
  | { status: "not_found" }
  | { status: "error"; message: string }

export async function getLeadDetail(
  leadId: string,
): Promise<GetLeadDetailState> {
  const { user, roles } = await requireCommercialMember()

  const parsed = z.uuid().safeParse(leadId)
  if (!parsed.success) {
    return { status: "error", message: "Lead inválido." }
  }

  const id = parsed.data
  const supabase = await createClient()

  const [
    { data: lead, error: leadError },
    { data: activities, error: activityError },
    { data: gbpRows, error: gbpError },
    { data: websiteRows, error: websiteError },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "*, lead_tags(tags(id, name)), lead_digital_channels(id, type, value, normalized_key, is_primary, sort_order)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("lead_activities")
      .select(
        "id, type, channel, channel_detail, note, denied_reason, follow_up_at, created_by, created_at",
      )
      .eq("lead_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("lead_gbp_profiles")
      .select(GBP_SELECT)
      .eq("lead_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("lead_website_audits")
      .select(WEBSITE_SELECT)
      .eq("lead_id", id),
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

  if (gbpError) {
    return {
      status: "error",
      message: "Não foi possível carregar os perfis do Google. Tente novamente.",
    }
  }

  if (websiteError) {
    return {
      status: "error",
      message: "Não foi possível carregar a auditoria do site. Tente novamente.",
    }
  }

  const {
    lead_tags: tagEmbed,
    lead_digital_channels: channelEmbed,
    ...leadRow
  } = lead as LeadRecord & {
    lead_tags?: unknown
    lead_digital_channels?: unknown
  }
  const record: LeadRecord = {
    ...(leadRow as Omit<LeadRecord, "channels">),
    channels: readLeadDigitalChannels(channelEmbed),
  }
  const tags = readLeadTags(tagEmbed)
  if (!isLeadStatus(record.status)) {
    return { status: "error", message: "Lead com status inválido." }
  }

  const websiteKeys = websiteKeysFromChannels(record.channels)
  const gbpProfiles = readLeadGbpProfiles(gbpRows).map((profile) => ({
    ...profile,
    matched_website_key: matchWebsiteKey(
      profile.payload.websiteDomain,
      websiteKeys,
    ),
  }))

  const userIds = [
    ...new Set(
      [
        record.assigned_sdr_id,
        record.assigned_closer_id,
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
      gbpProfiles,
      websiteAudits: readLeadWebsiteAudits(websiteRows),
      assigneeName: record.assigned_sdr_id
        ? (namesById.get(record.assigned_sdr_id) ?? null)
        : null,
      closerName: record.assigned_closer_id
        ? (namesById.get(record.assigned_closer_id) ?? null)
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
      canEditGbp: canEditLeadGbp(record, user.id, roles),
    },
  }
}
