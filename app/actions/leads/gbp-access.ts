import type { AppRole } from "@/lib/auth/roles"
import { readLeadDigitalChannels } from "@/lib/leads/digital-channels"
import {
  canEditLeadGbp,
  matchWebsiteKey,
  readLeadGbpProfileRow,
  websiteKeysFromChannels,
  type LeadGbpProfile,
} from "@/lib/leads/gbp"
import { isLeadStatus } from "@/lib/leads/status"
import type {
  GbpJobKind,
  GbpJobStatus,
  GbpRankCheck,
  GbpRankSource,
} from "@/lib/leads/gbp-audit"
import type { createClient } from "@/lib/supabase/server"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

const GBP_SELECT =
  "id, lead_id, place_id, is_primary, sort_order, google_maps_uri, fetched_at, fetched_by, payload, matched_website_key, notes, cid, enrichment, enrichment_at, posts, posts_at, reviews, reviews_at, qna, qna_at, rank_keywords, lead_gbp_jobs(kind, status, error_message), lead_gbp_rank_checks(keyword, maps_position, in_top3, competitors, check_url, checked_at)"

export type GbpLeadContext = {
  id: string
  status: string
  company_name: string
  assigned_sdr_id: string | null
  assigned_closer_id: string | null
  websiteKeys: string[]
}

export function rowToGbpProfile(row: Record<string, unknown>): LeadGbpProfile | null {
  return readLeadGbpProfileRow(row)
}

export async function loadGbpLeadContext(
  supabase: SupabaseClient,
  leadId: string,
): Promise<GbpLeadContext | "not_found" | "error"> {
  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, status, company_name, assigned_sdr_id, assigned_closer_id, lead_digital_channels(type, normalized_key, value, is_primary, sort_order, id)",
    )
    .eq("id", leadId)
    .maybeSingle()

  if (error) return "error"
  if (!data) return "not_found"
  if (!isLeadStatus(data.status)) return "error"

  const channels = readLeadDigitalChannels(data.lead_digital_channels)
  return {
    id: data.id,
    status: data.status,
    company_name: data.company_name,
    assigned_sdr_id: data.assigned_sdr_id,
    assigned_closer_id: data.assigned_closer_id,
    websiteKeys: websiteKeysFromChannels(channels),
  }
}

export function denyGbpEdit(
  lead: GbpLeadContext,
  userId: string,
  roles: readonly AppRole[],
): string | null {
  if (lead.status !== "interested") {
    return "A oportunidade só fica disponível após o interesse."
  }
  if (!canEditLeadGbp(lead, userId, roles)) {
    return "Você não pode editar a análise desta oportunidade."
  }
  return null
}

export async function loadGbpProfileRow(
  supabase: SupabaseClient,
  profileId: string,
): Promise<
  | { status: "ok"; profile: LeadGbpProfile; lead: GbpLeadContext }
  | { status: "not_found" }
  | { status: "error" }
> {
  const { data, error } = await supabase
    .from("lead_gbp_profiles")
    .select(GBP_SELECT)
    .eq("id", profileId)
    .maybeSingle()

  if (error) return { status: "error" }
  if (!data) return { status: "not_found" }
  const profile = rowToGbpProfile(data as Record<string, unknown>)
  if (!profile) return { status: "error" }

  const lead = await loadGbpLeadContext(supabase, profile.lead_id)
  if (lead === "error") return { status: "error" }
  if (lead === "not_found") return { status: "not_found" }
  return { status: "ok", profile, lead }
}

export async function nextGbpSortOrder(
  supabase: SupabaseClient,
  leadId: string,
): Promise<number> {
  const { data } = await supabase
    .from("lead_gbp_profiles")
    .select("sort_order")
    .eq("lead_id", leadId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()
  return typeof data?.sort_order === "number" ? data.sort_order + 1 : 0
}

export async function countGbpProfiles(
  supabase: SupabaseClient,
  leadId: string,
): Promise<number> {
  const { count } = await supabase
    .from("lead_gbp_profiles")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
  return count ?? 0
}

export async function setGbpPrimary(
  supabase: SupabaseClient,
  leadId: string,
  profileId: string,
): Promise<boolean> {
  const { error: clearError } = await supabase
    .from("lead_gbp_profiles")
    .update({ is_primary: false })
    .eq("lead_id", leadId)
    .eq("is_primary", true)
  if (clearError) return false
  const { error } = await supabase
    .from("lead_gbp_profiles")
    .update({ is_primary: true })
    .eq("id", profileId)
    .eq("lead_id", leadId)
  return !error
}

export async function findGbpPlaceConflict(
  supabase: SupabaseClient,
  placeId: string,
): Promise<
  | { status: "free" }
  | { status: "taken"; leadId: string; profileId: string }
  | { status: "error" }
> {
  const { data, error } = await supabase
    .from("lead_gbp_profiles")
    .select("id, lead_id")
    .eq("place_id", placeId)
    .maybeSingle()
  if (error) return { status: "error" }
  if (!data || typeof data.lead_id !== "string" || typeof data.id !== "string") {
    return { status: "free" }
  }
  return { status: "taken", leadId: data.lead_id, profileId: data.id }
}

export function matchedKeyForSnapshot(
  websiteDomain: string | null,
  websiteKeys: string[],
): string | null {
  return matchWebsiteKey(websiteDomain, websiteKeys)
}

export async function upsertGbpJob(
  supabase: SupabaseClient,
  profileId: string,
  kind: GbpJobKind,
  input: {
    dfs_task_id: string
    status: GbpJobStatus
    error_message: string | null
  },
): Promise<boolean> {
  const { error } = await supabase.from("lead_gbp_jobs").upsert(
    {
      profile_id: profileId,
      kind,
      dfs_task_id: input.dfs_task_id,
      status: input.status,
      error_message: input.error_message,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id,kind" },
  )
  return !error
}

export async function loadQueuedGbpJobs(
  supabase: SupabaseClient,
  profileId: string,
): Promise<
  | {
      status: "ok"
      jobs: Array<{
        kind: GbpJobKind
        dfs_task_id: string
      }>
    }
  | { status: "error" }
> {
  const { data, error } = await supabase
    .from("lead_gbp_jobs")
    .select("kind, dfs_task_id")
    .eq("profile_id", profileId)
    .eq("status", "queued")

  if (error) return { status: "error" }
  const jobs = (data ?? []).flatMap((row) => {
    const kind = row.kind === "reviews" || row.kind === "updates" ? row.kind : null
    const dfs_task_id =
      typeof row.dfs_task_id === "string" && row.dfs_task_id.trim().length > 0
        ? row.dfs_task_id.trim()
        : null
    if (!kind || !dfs_task_id) return []
    return [{ kind, dfs_task_id }]
  })
  return { status: "ok", jobs }
}

export async function deleteGbpRankChecksNotIn(
  supabase: SupabaseClient,
  profileId: string,
  keywords: string[],
): Promise<boolean> {
  if (keywords.length === 0) {
    const { error } = await supabase
      .from("lead_gbp_rank_checks")
      .delete()
      .eq("profile_id", profileId)
    return !error
  }

  const { data, error } = await supabase
    .from("lead_gbp_rank_checks")
    .select("id, keyword")
    .eq("profile_id", profileId)
  if (error) return false

  const keep = new Set(keywords)
  const ids = (data ?? []).flatMap((row) => {
    if (typeof row.id !== "string") return []
    if (typeof row.keyword === "string" && keep.has(row.keyword)) return []
    return [row.id]
  })
  if (ids.length === 0) return true

  const { error: deleteError } = await supabase
    .from("lead_gbp_rank_checks")
    .delete()
    .in("id", ids)
  return !deleteError
}

export async function deleteGbpJobs(
  supabase: SupabaseClient,
  profileId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("lead_gbp_jobs")
    .delete()
    .eq("profile_id", profileId)
  return !error
}

export async function upsertGbpRankCheck(
  supabase: SupabaseClient,
  profileId: string,
  check: GbpRankCheck,
  source: GbpRankSource,
): Promise<boolean> {
  const { error } = await supabase.from("lead_gbp_rank_checks").upsert(
    {
      profile_id: profileId,
      keyword: check.keyword,
      maps_position: check.maps_position,
      in_top3: check.in_top3,
      competitors: check.competitors,
      check_url: check.check_url,
      checked_at: check.checked_at,
      source,
    },
    { onConflict: "profile_id,keyword" },
  )
  return !error
}

export { GBP_SELECT }
