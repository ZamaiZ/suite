import "server-only"

import { denyGbpEdit, loadGbpLeadContext, type GbpLeadContext } from "./gbp-access"
import {
  readLeadDigitalPresenceAuditRow,
  type LeadDigitalPresenceAudit,
} from "@/lib/leads/digital-presence"
import type { AppRole } from "@/lib/auth/roles"
import type { createClient } from "@/lib/supabase/server"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export const DIGITAL_PRESENCE_SELECT =
  "id, lead_id, review, updated_at, updated_by"

export function rowToDigitalPresenceAudit(
  row: Record<string, unknown>,
): LeadDigitalPresenceAudit | null {
  return readLeadDigitalPresenceAuditRow(row)
}

export async function loadDigitalPresenceAuditByLead(
  supabase: SupabaseClient,
  leadId: string,
): Promise<
  | { status: "ok"; audit: LeadDigitalPresenceAudit | null; lead: GbpLeadContext }
  | { status: "not_found" }
  | { status: "error" }
> {
  const lead = await loadGbpLeadContext(supabase, leadId)
  if (lead === "error") return { status: "error" }
  if (lead === "not_found") return { status: "not_found" }

  const { data, error } = await supabase
    .from("lead_digital_presence_audits")
    .select(DIGITAL_PRESENCE_SELECT)
    .eq("lead_id", leadId)
    .maybeSingle()

  if (error) return { status: "error" }
  if (!data) return { status: "ok", audit: null, lead }

  const audit = rowToDigitalPresenceAudit(data as Record<string, unknown>)
  if (!audit) return { status: "error" }
  return { status: "ok", audit, lead }
}

export function denyDigitalPresenceEdit(
  lead: GbpLeadContext,
  userId: string,
  roles: readonly AppRole[],
): string | null {
  return denyGbpEdit(lead, userId, roles)
}
