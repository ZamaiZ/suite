import "server-only"

import { denyGbpEdit, loadGbpLeadContext, type GbpLeadContext } from "./gbp-access"
import {
  readLeadDiagnosisDraftRow,
  readLeadDiagnosisExportRow,
} from "@/lib/leads/diagnosis-read"
import type {
  LeadDiagnosisDraft,
  LeadDiagnosisExport,
} from "@/lib/leads/diagnosis-document"
import type { AppRole } from "@/lib/auth/roles"
import type { createClient } from "@/lib/supabase/server"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export const DIAGNOSIS_DRAFT_SELECT =
  "lead_id, document, facts_fingerprint, updated_at, updated_by"

export const DIAGNOSIS_EXPORT_SELECT =
  "id, lead_id, document, storage_path, file_name, is_current, exported_at, exported_by"

export const LEADS_STORAGE_BUCKET = "leads"

export function diagnosisStoragePath(
  leadId: string,
  fileName: string,
): string {
  return `${leadId}/${fileName}`
}

export function diagnosisFileName(timestamp: string): string {
  return `initial_diagnosis_${timestamp}.pdf`
}

export async function loadDiagnosisDraftByLead(
  supabase: SupabaseClient,
  leadId: string,
): Promise<
  | {
      status: "ok"
      draft: LeadDiagnosisDraft | null
      lead: GbpLeadContext
    }
  | { status: "not_found" }
  | { status: "error" }
> {
  const lead = await loadGbpLeadContext(supabase, leadId)
  if (lead === "error") return { status: "error" }
  if (lead === "not_found") return { status: "not_found" }

  const { data, error } = await supabase
    .from("lead_diagnosis_drafts")
    .select(DIAGNOSIS_DRAFT_SELECT)
    .eq("lead_id", leadId)
    .maybeSingle()

  if (error) return { status: "error" }
  if (!data) return { status: "ok", draft: null, lead }

  const draft = readLeadDiagnosisDraftRow(data as Record<string, unknown>)
  if (!draft) return { status: "error" }
  return { status: "ok", draft, lead }
}

export async function loadDiagnosisExportsByLead(
  supabase: SupabaseClient,
  leadId: string,
): Promise<LeadDiagnosisExport[] | null> {
  const { data, error } = await supabase
    .from("lead_diagnosis_exports")
    .select(DIAGNOSIS_EXPORT_SELECT)
    .eq("lead_id", leadId)
    .order("exported_at", { ascending: false })
    .limit(12)

  if (error) return null
  return (data ?? []).flatMap((row) => {
    const parsed = readLeadDiagnosisExportRow(row as Record<string, unknown>)
    return parsed ? [parsed] : []
  })
}

export async function loadCurrentDiagnosisExport(
  supabase: SupabaseClient,
  leadId: string,
): Promise<LeadDiagnosisExport | null | "error"> {
  const { data, error } = await supabase
    .from("lead_diagnosis_exports")
    .select(DIAGNOSIS_EXPORT_SELECT)
    .eq("lead_id", leadId)
    .eq("is_current", true)
    .maybeSingle()

  if (error) return "error"
  if (!data) return null
  return (
    readLeadDiagnosisExportRow(data as Record<string, unknown>) ?? "error"
  )
}

export function denyDiagnosisEdit(
  lead: GbpLeadContext,
  userId: string,
  roles: readonly AppRole[],
): string | null {
  return denyGbpEdit(lead, userId, roles)
}
