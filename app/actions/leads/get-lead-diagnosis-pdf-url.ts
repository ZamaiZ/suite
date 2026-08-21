"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  diagnosisExportIdSchema,
  readDiagnosisExportIdFields,
} from "@/lib/validations/lead-diagnosis"
import { createClient } from "@/lib/supabase/server"
import {
  DIAGNOSIS_EXPORT_SELECT,
  LEADS_STORAGE_BUCKET,
} from "./diagnosis-access"
import { loadGbpLeadContext } from "./gbp-access"
import { readLeadDiagnosisExportRow } from "@/lib/leads/diagnosis-read"

export type GetLeadDiagnosisPdfUrlState =
  | { status: "success"; url: string; fileName: string }
  | { status: "error"; message: string }

const FAILED = "Não foi possível abrir o PDF. Tente novamente."
const SIGNED_TTL_SECONDS = 60 * 15

export async function getLeadDiagnosisPdfUrl(
  formData: FormData,
): Promise<GetLeadDiagnosisPdfUrlState> {
  await requireCommercialMember()
  const parsed = diagnosisExportIdSchema.safeParse(
    readDiagnosisExportIdFields(formData),
  )
  if (!parsed.success) {
    return { status: "error", message: "Lead inválido." }
  }

  const supabase = await createClient()
  const lead = await loadGbpLeadContext(supabase, parsed.data.lead_id)
  if (lead === "error") return { status: "error", message: FAILED }
  if (lead === "not_found") {
    return { status: "error", message: "Lead não encontrado." }
  }

  let query = supabase
    .from("lead_diagnosis_exports")
    .select(DIAGNOSIS_EXPORT_SELECT)
    .eq("lead_id", parsed.data.lead_id)

  if (parsed.data.export_id) {
    query = query.eq("id", parsed.data.export_id)
  } else {
    query = query.eq("is_current", true)
  }

  const { data, error } = await query.maybeSingle()
  if (error) return { status: "error", message: FAILED }
  if (!data) {
    return { status: "error", message: "Nenhum PDF exportado ainda." }
  }

  const exportRow = readLeadDiagnosisExportRow(data as Record<string, unknown>)
  if (!exportRow) return { status: "error", message: FAILED }

  const admin = createAdminClient()
  const { data: signed, error: signedError } = await admin.storage
    .from(LEADS_STORAGE_BUCKET)
    .createSignedUrl(exportRow.storage_path, SIGNED_TTL_SECONDS)

  if (signedError || !signed?.signedUrl) {
    return { status: "error", message: FAILED }
  }

  return {
    status: "success",
    url: signed.signedUrl,
    fileName: exportRow.file_name,
  }
}
