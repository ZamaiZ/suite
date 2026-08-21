import "server-only"

import { denyGbpEdit, loadGbpLeadContext, type GbpLeadContext } from "./gbp-access"
import {
  readLeadWebsiteAuditRow,
  type LeadWebsiteAudit,
} from "@/lib/leads/website-audit"
import {
  PSI_STALE_RUNNING_MS,
  WEBSITE_PSI_JOB_KINDS,
  type WebsitePsiJobKind,
} from "@/lib/leads/website-pagespeed"
import type { createClient } from "@/lib/supabase/server"
import type { AppRole } from "@/lib/auth/roles"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export const WEBSITE_SELECT =
  "id, lead_id, channel_id, url, fetched_at, fetched_by, crawl, notes, review, pagespeed, pagespeed_at, lead_website_jobs(kind, status, error_message)"

export type WebsiteChannelRow = {
  id: string
  lead_id: string
  type: string
  value: string
  normalized_key: string
}

export function rowToWebsiteAudit(
  row: Record<string, unknown>,
): LeadWebsiteAudit | null {
  return readLeadWebsiteAuditRow(row)
}

export async function loadWebsiteChannelRow(
  supabase: SupabaseClient,
  channelId: string,
): Promise<
  | {
      status: "ok"
      channel: WebsiteChannelRow
      lead: GbpLeadContext
    }
  | { status: "not_found" }
  | { status: "error" }
> {
  const { data, error } = await supabase
    .from("lead_digital_channels")
    .select("id, lead_id, type, value, normalized_key")
    .eq("id", channelId)
    .maybeSingle()

  if (error) return { status: "error" }
  if (!data || data.type !== "website") return { status: "not_found" }

  const lead = await loadGbpLeadContext(supabase, data.lead_id)
  if (lead === "error") return { status: "error" }
  if (lead === "not_found") return { status: "not_found" }

  return {
    status: "ok",
    channel: {
      id: data.id,
      lead_id: data.lead_id,
      type: data.type,
      value: data.value,
      normalized_key: data.normalized_key,
    },
    lead,
  }
}

export async function loadWebsiteAuditRow(
  supabase: SupabaseClient,
  auditId: string,
): Promise<
  | { status: "ok"; audit: LeadWebsiteAudit; lead: GbpLeadContext }
  | { status: "not_found" }
  | { status: "error" }
> {
  const { data, error } = await supabase
    .from("lead_website_audits")
    .select(WEBSITE_SELECT)
    .eq("id", auditId)
    .maybeSingle()

  if (error) return { status: "error" }
  if (!data) return { status: "not_found" }

  const audit = rowToWebsiteAudit(data as Record<string, unknown>)
  if (!audit) return { status: "error" }

  const lead = await loadGbpLeadContext(supabase, audit.lead_id)
  if (lead === "error") return { status: "error" }
  if (lead === "not_found") return { status: "not_found" }

  return { status: "ok", audit, lead }
}

export function denyWebsiteEdit(
  lead: GbpLeadContext,
  userId: string,
  roles: readonly AppRole[],
): string | null {
  return denyGbpEdit(lead, userId, roles)
}

export async function enqueueWebsitePagespeedJobs(
  supabase: SupabaseClient,
  auditId: string,
): Promise<boolean> {
  const now = new Date().toISOString()
  const rows = WEBSITE_PSI_JOB_KINDS.map((kind) => ({
    audit_id: auditId,
    kind,
    status: "queued",
    error_message: null,
    started_at: null,
    updated_at: now,
  }))
  const { error } = await supabase.from("lead_website_jobs").upsert(rows, {
    onConflict: "audit_id,kind",
  })
  return !error
}

export async function claimWebsitePagespeedJob(
  supabase: SupabaseClient,
  auditId: string,
): Promise<
  | { status: "ok"; job: { id: string; kind: WebsitePsiJobKind } }
  | { status: "empty" }
  | { status: "error" }
> {
  const staleBefore = new Date(Date.now() - PSI_STALE_RUNNING_MS).toISOString()
  const { data, error } = await supabase
    .from("lead_website_jobs")
    .select("id, kind, status, started_at")
    .eq("audit_id", auditId)
    .in("status", ["queued", "running"])

  if (error) return { status: "error" }

  const ranked = [...(data ?? [])].sort((left, right) => {
    if (left.kind === right.kind) return 0
    return left.kind === "pagespeed_mobile" ? -1 : 1
  })
  const candidate = ranked.find((row) => {
    if (row.status === "queued") return true
    return (
      typeof row.started_at === "string" && row.started_at < staleBefore
    )
  })
  if (!candidate || typeof candidate.id !== "string") {
    return { status: "empty" }
  }
  if (
    candidate.kind !== "pagespeed_mobile" &&
    candidate.kind !== "pagespeed_desktop"
  ) {
    return { status: "empty" }
  }

  const now = new Date().toISOString()
  const { data: claimed, error: claimError } = await supabase
    .from("lead_website_jobs")
    .update({
      status: "running",
      started_at: now,
      error_message: null,
      updated_at: now,
    })
    .eq("id", candidate.id)
    .eq("status", candidate.status)
    .select("id, kind")
    .maybeSingle()

  if (claimError) return { status: "error" }
  if (
    !claimed ||
    typeof claimed.id !== "string" ||
    (claimed.kind !== "pagespeed_mobile" &&
      claimed.kind !== "pagespeed_desktop")
  ) {
    return { status: "empty" }
  }
  return {
    status: "ok",
    job: { id: claimed.id, kind: claimed.kind },
  }
}

export async function completeWebsitePagespeedJob(
  supabase: SupabaseClient,
  jobId: string,
  input: { status: "ready" | "failed"; error_message: string | null },
): Promise<boolean> {
  const message = input.error_message?.trim() ?? ""
  const { error } = await supabase
    .from("lead_website_jobs")
    .update({
      status: input.status,
      error_message: message.length === 0 ? null : message.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
  return !error
}
