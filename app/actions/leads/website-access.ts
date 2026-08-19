import "server-only"

import { denyGbpEdit, loadGbpLeadContext, type GbpLeadContext } from "./gbp-access"
import {
  readLeadWebsiteAuditRow,
  type LeadWebsiteAudit,
} from "@/lib/leads/website-audit"
import type { createClient } from "@/lib/supabase/server"
import type { AppRole } from "@/lib/auth/roles"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export const WEBSITE_SELECT =
  "id, lead_id, channel_id, url, fetched_at, fetched_by, crawl, notes"

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
