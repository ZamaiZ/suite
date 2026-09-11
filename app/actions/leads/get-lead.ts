"use server"

import { z } from "zod"
import { requireCommercialMember } from "@/lib/auth/session"
import { leadAccessFlags } from "@/lib/leads/board-item"
import { canViewLead } from "@/lib/leads/access"
import { canViewClient } from "@/lib/clients/access"
import {
  canEditClosingChecklist,
  canRecordClosingOutcome,
  canRescheduleClosing,
  isClosingStage,
} from "@/lib/leads/closing"
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
import {
  readLeadDigitalPresenceAuditRow,
  type LeadDigitalPresenceAudit,
} from "@/lib/leads/digital-presence"
import {
  readLeadVisibilityAuditRow,
  type LeadVisibilityAudit,
} from "@/lib/leads/visibility-audit"
import {
  readLeadBacklinkAuditRow,
  type LeadBacklinkAudit,
} from "@/lib/leads/backlinks-audit"
import type {
  LeadDiagnosisDraft,
  LeadDiagnosisExport,
} from "@/lib/leads/diagnosis-document"
import {
  readLeadDiagnosisDraftRow,
  readLeadDiagnosisExportRow,
} from "@/lib/leads/diagnosis-read"
import { isLeadStatus } from "@/lib/leads/status"
import { readLeadSegment, type LeadSegment } from "@/lib/leads/segments"
import { readLeadTags, type LeadTag } from "@/lib/leads/tags"
import type { LeadDetailActivity, LeadRecord } from "@/lib/leads/types"
import { createClient } from "@/lib/supabase/server"
import { GBP_SELECT } from "./gbp-access"
import {
  DIAGNOSIS_DRAFT_SELECT,
  DIAGNOSIS_EXPORT_SELECT,
} from "./diagnosis-access"
import { DIGITAL_PRESENCE_SELECT } from "./digital-presence-access"
import { VISIBILITY_SELECT } from "./visibility-access"
import { GEO_REVIEW_SELECT, GEO_SELECT } from "./geo-access"
import { BACKLINKS_SELECT } from "./backlinks-access"
import { WEBSITE_REVIEW_SELECT, WEBSITE_SELECT } from "./website-access"
import { websiteReviewsByChannel } from "@/lib/leads/website-review"
import {
  readLeadVisibilityReviewRow,
  type LeadVisibilityReview,
} from "@/lib/leads/visibility-review"
import { readLeadGeoAuditRow, type LeadGeoAudit } from "@/lib/leads/geo-audit"
import {
  readLeadGeoReviewRow,
  type LeadGeoReview,
} from "@/lib/leads/geo-review"

export type {
  LeadDetailActivity,
  LeadTag,
  LeadSegment,
  LeadGbpProfile,
  LeadWebsiteAudit,
  LeadDigitalPresenceAudit,
  LeadVisibilityAudit,
  LeadBacklinkAudit,
  LeadDiagnosisDraft,
  LeadDiagnosisExport,
}
export type { LeadGeoAudit, LeadGeoReview }

export type LeadDetail = {
  lead: LeadRecord
  tags: LeadTag[]
  segment: LeadSegment | null
  gbpProfiles: LeadGbpProfile[]
  websiteAudits: LeadWebsiteAudit[]
  digitalPresenceAudit: LeadDigitalPresenceAudit | null
  visibilityAudit: LeadVisibilityAudit | null
  visibilityReview: LeadVisibilityReview
  geoAudit: LeadGeoAudit | null
  geoReview: LeadGeoReview
  backlinkAudit: LeadBacklinkAudit | null
  diagnosisDraft: LeadDiagnosisDraft | null
  diagnosisExports: LeadDiagnosisExport[]
  assigneeName: string | null
  closerName: string | null
  createdByName: string | null
  activities: LeadDetailActivity[]
  canClaim: boolean
  canUnclaim: boolean
  canLogActivity: boolean
  canEditGbp: boolean
  canRescheduleClosing: boolean
  canRecordClosingOutcome: boolean
  canEditClosingChecklist: boolean
  client: { id: string; canView: boolean } | null
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
    { data: websiteReviewRows },
    { data: digitalPresenceRow, error: digitalPresenceError },
    { data: visibilityRow, error: visibilityError },
    { data: visibilityReviewRow },
    { data: geoRow, error: geoError },
    { data: geoReviewRow },
    { data: backlinkRow, error: backlinkError },
    { data: diagnosisDraftRow, error: diagnosisDraftError },
    { data: diagnosisExportRows, error: diagnosisExportError },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "*, clients(id), lead_tags(tags(id, name)), lead_digital_channels(id, type, value, normalized_key, is_primary, sort_order), segments(id, name)",
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
      .eq("lead_id", id)
      .order("fetched_at", { ascending: false }),
    supabase
      .from("lead_website_reviews")
      .select(WEBSITE_REVIEW_SELECT)
      .eq("lead_id", id),
    supabase
      .from("lead_digital_presence_audits")
      .select(DIGITAL_PRESENCE_SELECT)
      .eq("lead_id", id)
      .maybeSingle(),
    supabase
      .from("lead_visibility_audits")
      .select(VISIBILITY_SELECT)
      .eq("lead_id", id)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Uma linha por lead. Sem `error` no destructuring: lead nunca julgado
    // simplesmente não tem linha, e isso não é falha de carregamento.
    supabase
      .from("lead_visibility_reviews")
      .select("review, notes, updated_at, updated_by")
      .eq("lead_id", id)
      .maybeSingle(),
    supabase
      .from("lead_geo_audits")
      .select(GEO_SELECT)
      .eq("lead_id", id)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Uma linha por lead, e lead nunca julgado simplesmente nao tem linha.
    supabase
      .from("lead_geo_reviews")
      .select(GEO_REVIEW_SELECT)
      .eq("lead_id", id)
      .maybeSingle(),
    supabase
      .from("lead_backlink_audits")
      .select(BACKLINKS_SELECT)
      .eq("lead_id", id)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("lead_diagnosis_drafts")
      .select(DIAGNOSIS_DRAFT_SELECT)
      .eq("lead_id", id)
      .maybeSingle(),
    supabase
      .from("lead_diagnosis_exports")
      .select(DIAGNOSIS_EXPORT_SELECT)
      .eq("lead_id", id)
      .order("exported_at", { ascending: false })
      .limit(12),
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
      message:
        "Não foi possível carregar os perfis do Google. Tente novamente.",
    }
  }

  if (websiteError) {
    return {
      status: "error",
      message:
        "Não foi possível carregar a auditoria do site. Tente novamente.",
    }
  }

  if (digitalPresenceError) {
    return {
      status: "error",
      message: "Não foi possível carregar a presença digital. Tente novamente.",
    }
  }

  if (visibilityError) {
    return {
      status: "error",
      message: "Não foi possível carregar a visibilidade. Tente novamente.",
    }
  }

  if (geoError) {
    return {
      status: "error",
      message: "Não foi possível carregar a presença em IA. Tente novamente.",
    }
  }

  if (backlinkError) {
    return {
      status: "error",
      message: "Não foi possível carregar os backlinks. Tente novamente.",
    }
  }

  if (diagnosisDraftError || diagnosisExportError) {
    return {
      status: "error",
      message: "Não foi possível carregar o diagnóstico. Tente novamente.",
    }
  }

  const {
    lead_tags: tagEmbed,
    lead_digital_channels: channelEmbed,
    segments: segmentEmbed,
    clients: clientEmbed,
    ...leadRow
  } = lead as LeadRecord & {
    lead_tags?: unknown
    lead_digital_channels?: unknown
    segments?: unknown
    clients?: { id: string } | { id: string }[] | null
  }
  const segment = readLeadSegment(segmentEmbed)
  const record: LeadRecord = {
    ...(leadRow as Omit<LeadRecord, "channels" | "segment">),
    channels: readLeadDigitalChannels(channelEmbed),
    segment,
  }
  const tags = readLeadTags(tagEmbed)
  if (!isLeadStatus(record.status)) {
    return { status: "error", message: "Lead com status inválido." }
  }
  if (!canViewLead(record, user.id, roles)) return { status: "not_found" }

  const clientRow = Array.isArray(clientEmbed)
    ? (clientEmbed[0] ?? null)
    : (clientEmbed ?? null)
  const client =
    clientRow && typeof clientRow.id === "string"
      ? {
          id: clientRow.id,
          canView: canViewClient(roles, user.id, record.assigned_closer_id),
        }
      : null

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

  const flags = leadAccessFlags(record)
  const closingActor = {
    status: record.status,
    assigned_sdr_id: record.assigned_sdr_id,
    assigned_closer_id: record.assigned_closer_id,
    closing_stage: isClosingStage(record.closing_stage)
      ? record.closing_stage
      : null,
  }

  return {
    status: "success",
    data: {
      lead: record,
      tags,
      segment,
      gbpProfiles,
      websiteAudits: readLeadWebsiteAudits(
        websiteRows,
        websiteReviewsByChannel(websiteReviewRows),
      ),
      digitalPresenceAudit: digitalPresenceRow
        ? (readLeadDigitalPresenceAuditRow(
            digitalPresenceRow as Record<string, unknown>,
          ) ?? null)
        : null,
      visibilityAudit: visibilityRow
        ? (readLeadVisibilityAuditRow(
            visibilityRow as Record<string, unknown>,
          ) ?? null)
        : null,
      visibilityReview: readLeadVisibilityReviewRow(
        (visibilityReviewRow as Record<string, unknown> | null) ?? null,
      ),
      geoAudit: geoRow
        ? readLeadGeoAuditRow(geoRow as Record<string, unknown>)
        : null,
      geoReview: readLeadGeoReviewRow(
        (geoReviewRow as Record<string, unknown> | null) ?? null,
      ),
      backlinkAudit: backlinkRow
        ? (readLeadBacklinkAuditRow(backlinkRow as Record<string, unknown>) ??
          null)
        : null,
      diagnosisDraft: diagnosisDraftRow
        ? (readLeadDiagnosisDraftRow(
            diagnosisDraftRow as Record<string, unknown>,
          ) ?? null)
        : null,
      diagnosisExports: (diagnosisExportRows ?? []).flatMap((row) => {
        const parsed = readLeadDiagnosisExportRow(
          row as Record<string, unknown>,
        )
        return parsed ? [parsed] : []
      }),
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
      ...flags,
      canEditGbp: canEditLeadGbp(record, user.id, roles),
      canRescheduleClosing: canRescheduleClosing(closingActor, user.id, roles),
      canRecordClosingOutcome: canRecordClosingOutcome(
        closingActor,
        user.id,
        roles,
      ),
      canEditClosingChecklist: canEditClosingChecklist(
        closingActor,
        user.id,
        roles,
      ),
      client,
    },
  }
}
