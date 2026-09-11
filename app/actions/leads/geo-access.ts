import "server-only"

import {
  denyGbpEdit,
  loadGbpLeadContext,
  type GbpLeadContext,
} from "./gbp-access"
import { readLeadGeoAuditRow, type LeadGeoAudit } from "@/lib/leads/geo-audit"
import type { AppRole } from "@/lib/auth/roles"
import type { createClient } from "@/lib/supabase/server"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export const GEO_SELECT =
  "id, lead_id, domain, snapshot, fetched_at, fetched_by"

export const GEO_REVIEW_SELECT =
  "review, prompt_set, notes, updated_at, updated_by"

export async function loadGeoAuditByLead(
  supabase: SupabaseClient,
  leadId: string,
): Promise<
  | { status: "ok"; audit: LeadGeoAudit | null; lead: GbpLeadContext }
  | { status: "not_found" }
  | { status: "error" }
> {
  const lead = await loadGbpLeadContext(supabase, leadId)
  if (lead === "error") return { status: "error" }
  if (lead === "not_found") return { status: "not_found" }

  // Append-only: a leitura padrao e sempre o snapshot mais recente do lead.
  const { data, error } = await supabase
    .from("lead_geo_audits")
    .select(GEO_SELECT)
    .eq("lead_id", leadId)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { status: "error" }
  if (!data) return { status: "ok", audit: null, lead }

  const audit = readLeadGeoAuditRow(data as Record<string, unknown>)
  if (!audit) return { status: "error" }
  return { status: "ok", audit, lead }
}

export function denyGeoEdit(
  lead: GbpLeadContext,
  userId: string,
  roles: readonly AppRole[],
): string | null {
  return denyGbpEdit(lead, userId, roles)
}
