import "server-only"

import { denyGbpEdit, loadGbpLeadContext, type GbpLeadContext } from "./gbp-access"
import {
  readLeadVisibilityAuditRow,
  type LeadVisibilityAudit,
} from "@/lib/leads/visibility-audit"
import type { AppRole } from "@/lib/auth/roles"
import type { createClient } from "@/lib/supabase/server"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export const VISIBILITY_SELECT =
  "id, lead_id, domain, snapshot, fetched_at, fetched_by"

export function rowToVisibilityAudit(
  row: Record<string, unknown>,
): LeadVisibilityAudit | null {
  return readLeadVisibilityAuditRow(row)
}

export async function loadVisibilityAuditByLead(
  supabase: SupabaseClient,
  leadId: string,
): Promise<
  | { status: "ok"; audit: LeadVisibilityAudit | null; lead: GbpLeadContext }
  | { status: "not_found" }
  | { status: "error" }
> {
  const lead = await loadGbpLeadContext(supabase, leadId)
  if (lead === "error") return { status: "error" }
  if (lead === "not_found") return { status: "not_found" }

  const { data, error } = await supabase
    .from("lead_visibility_audits")
    .select(VISIBILITY_SELECT)
    .eq("lead_id", leadId)
    .maybeSingle()

  if (error) return { status: "error" }
  if (!data) return { status: "ok", audit: null, lead }

  const audit = rowToVisibilityAudit(data as Record<string, unknown>)
  if (!audit) return { status: "error" }
  return { status: "ok", audit, lead }
}

export function denyVisibilityEdit(
  lead: GbpLeadContext,
  userId: string,
  roles: readonly AppRole[],
): string | null {
  return denyGbpEdit(lead, userId, roles)
}
