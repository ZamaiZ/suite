"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import {
  BRIEFING_LIST_STATUS_LABELS,
  deriveBriefingListStatus,
  type BriefingListStatus,
} from "@/lib/briefing/status"
import {
  canManageClientPortal,
  canViewAllClients,
  canViewClient,
  canViewOwnClients,
} from "@/lib/clients/access"
import { CLIENT_KICKOFF_STAGE_LABELS } from "@/lib/clients/kickoff"
import type { ClientKickoffStage } from "@/lib/clients/types"
import { createClient } from "@/lib/supabase/server"
import type { ClientsListParams } from "@/lib/clients/href"

export type ClientListItem = {
  id: string
  lead_id: string
  company_name: string
  closer_id: string | null
  closer_name: string | null
  converted_at: string
  stage: "initial"
  briefingStatus: BriefingListStatus
  briefingStatusLabel: string
  canManagePortal: boolean
  canViewClient: boolean
  kickoffStage: ClientKickoffStage
  kickoffStageLabel: string
  kickoffMeetingAt: string | null
  websiteDomain: string | null
}

export type ClientCloserOption = { id: string; name: string }
export type ClientsSummary = { total: number; inProgress: number; edited: number; kickoffPending: number }

export type ListClientsState =
  | { status: "success"; clients: ClientListItem[]; summary: ClientsSummary; closerOptions: ClientCloserOption[] }
  | { status: "error"; message: string }

export async function listClients(params: ClientsListParams = { q: "", briefing: null, kickoff: null, closer: null }): Promise<ListClientsState> {
  const { user, roles } = await requireCommercialMember()
  const canViewAll = canViewAllClients(roles)
  if (!canViewAll && !canViewOwnClients(roles)) {
    return {
      status: "success",
      clients: [],
      summary: { total: 0, inProgress: 0, edited: 0, kickoffPending: 0 },
      closerOptions: [],
    }
  }

  const supabase = await createClient()
  const search = params.q.trim().replace(/[%*,()\\]/g, "")
  let matchingLeadIds: string[] = []
  if (search) {
    const { data: leads } = await supabase.from("leads").select("id").or(`company_name.ilike.%${search}%,website_domain.ilike.%${search}%`)
    matchingLeadIds = (leads ?? []).map((lead) => lead.id)
  }
  let query = supabase
    .from("clients")
    .select(
      "id, lead_id, company_name, closer_id, converted_at, stage, briefing_finalized_at, briefing_content_updated_at, kickoff_stage, kickoff_meeting_at",
    )
    .eq("stage", "initial")
    .order("converted_at", { ascending: false })
  if (params.closer) query = query.eq("closer_id", params.closer)
  if (!canViewAll) query = query.eq("closer_id", user.id)
  if (params.kickoff) query = query.eq("kickoff_stage", params.kickoff)
  if (search) {
    query = matchingLeadIds.length > 0
      ? query.or(`company_name.ilike.%${search}%,lead_id.in.(${matchingLeadIds.join(",")})`)
      : query.ilike("company_name", `%${search}%`)
  }
  const { data, error } = await query

  if (error) {
    return {
      status: "error",
      message: "Não foi possível carregar os clientes.",
    }
  }

  const closerIds = [
    ...new Set(
      (data ?? [])
        .map((row) => row.closer_id)
        .filter((value): value is string => typeof value === "string"),
    ),
  ]
  const namesById = new Map<string, string>()
  if (closerIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("users")
      .select("id, name")
      .in("id", closerIds)
    if (profileError) {
      return {
        status: "error",
        message: "Não foi possível carregar os clientes.",
      }
    }
    for (const profile of profiles ?? []) {
      namesById.set(profile.id, profile.name)
    }
  }

  const domainsByLeadId = new Map<string, string>()
  const leadIds = [...new Set((data ?? []).map((row) => row.lead_id).filter(Boolean))]
  if (leadIds.length > 0) {
    const { data: leads } = await supabase.from("leads").select("id, website_domain").in("id", leadIds)
    for (const lead of leads ?? []) if (typeof lead.website_domain === "string") domainsByLeadId.set(lead.id, lead.website_domain)
  }

  const clients: ClientListItem[] = (data ?? []).flatMap((row) => {
    if (row.stage !== "initial") return []
    const briefingStatus = deriveBriefingListStatus(
      typeof row.briefing_finalized_at === "string"
        ? row.briefing_finalized_at
        : null,
      typeof row.briefing_content_updated_at === "string"
        ? row.briefing_content_updated_at
        : null,
    )
    return [
      {
        id: row.id,
        lead_id: row.lead_id,
        company_name: row.company_name,
        closer_id: row.closer_id,
        closer_name: row.closer_id
          ? (namesById.get(row.closer_id) ?? null)
          : null,
        converted_at: row.converted_at,
        stage: "initial",
        briefingStatus,
        briefingStatusLabel: BRIEFING_LIST_STATUS_LABELS[briefingStatus],
        canManagePortal: canManageClientPortal(roles, user.id, row.closer_id),
        canViewClient: canViewClient(roles, user.id, row.closer_id),
        kickoffStage: row.kickoff_stage,
        kickoffStageLabel: CLIENT_KICKOFF_STAGE_LABELS[row.kickoff_stage],
        kickoffMeetingAt: typeof row.kickoff_meeting_at === "string" ? row.kickoff_meeting_at : null,
        websiteDomain: domainsByLeadId.get(row.lead_id) ?? null,
      },
    ]
  })
  const filteredClients = params.briefing ? clients.filter((client) => client.briefingStatus === params.briefing) : clients
  const { data: closerRows } = await supabase.from("users").select("id, name, user_roles!inner(role)").eq("user_roles.role", "closer").order("name")
  const closerOptions = (closerRows ?? []).map((row) => ({ id: row.id, name: row.name }))
  const summary: ClientsSummary = {
    total: filteredClients.length,
    inProgress: filteredClients.filter((client) => client.briefingStatus === "in_progress").length,
    edited: filteredClients.filter((client) => client.briefingStatus === "edited_after_submit").length,
    kickoffPending: filteredClients.filter((client) => client.kickoffStage === "none" || client.kickoffStage === "scheduled").length,
  }
  return { status: "success", clients: filteredClients, summary, closerOptions }
}
