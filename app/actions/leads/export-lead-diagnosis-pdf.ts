"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { formatStorageTimestamp } from "@/lib/date-time"
import type { LeadDiagnosisExport } from "@/lib/leads/diagnosis-document"
import { renderDiagnosisPdfBuffer } from "@/lib/leads/diagnosis-pdf"
import { readLeadDiagnosisExportRow } from "@/lib/leads/diagnosis-read"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  diagnosisLeadIdSchema,
  readDiagnosisLeadIdFields,
} from "@/lib/validations/lead-diagnosis"
import { createClient } from "@/lib/supabase/server"
import {
  denyDiagnosisEdit,
  DIAGNOSIS_EXPORT_SELECT,
  diagnosisFileName,
  diagnosisStoragePath,
  LEADS_STORAGE_BUCKET,
  loadDiagnosisDraftByLead,
} from "./diagnosis-access"

export type ExportLeadDiagnosisPdfState =
  | { status: "success"; exportRow: LeadDiagnosisExport; url: string }
  | { status: "error"; message: string }

const FAILED = "Não foi possível exportar o PDF. Tente novamente."
const SIGNED_TTL_SECONDS = 60 * 15

export async function exportLeadDiagnosisPdf(
  formData: FormData,
): Promise<ExportLeadDiagnosisPdfState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = diagnosisLeadIdSchema.safeParse(
    readDiagnosisLeadIdFields(formData),
  )
  if (!parsed.success) {
    return { status: "error", message: "Lead inválido." }
  }

  const supabase = await createClient()
  const loaded = await loadDiagnosisDraftByLead(
    supabase,
    parsed.data.lead_id,
  )
  if (loaded.status === "error") {
    return { status: "error", message: FAILED }
  }
  if (loaded.status === "not_found") {
    return { status: "error", message: "Lead não encontrado." }
  }
  if (!loaded.draft) {
    return {
      status: "error",
      message: "Monte e revise o diagnóstico antes de exportar.",
    }
  }

  const denied = denyDiagnosisEdit(loaded.lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  const document = {
    ...loaded.draft.document,
    meta: {
      ...loaded.draft.document.meta,
      generatedAt: new Date().toISOString(),
    },
  }

  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderDiagnosisPdfBuffer(document)
  } catch {
    return { status: "error", message: FAILED }
  }

  const stamp = formatStorageTimestamp()
  const fileName = diagnosisFileName(stamp)
  const storagePath = diagnosisStoragePath(parsed.data.lead_id, fileName)
  const admin = createAdminClient()

  const { error: uploadError } = await admin.storage
    .from(LEADS_STORAGE_BUCKET)
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: false,
    })

  if (uploadError) {
    return { status: "error", message: FAILED }
  }

  await supabase
    .from("lead_diagnosis_exports")
    .update({ is_current: false })
    .eq("lead_id", parsed.data.lead_id)
    .eq("is_current", true)

  const exportedAt = new Date().toISOString()
  const { data: inserted, error: insertError } = await supabase
    .from("lead_diagnosis_exports")
    .insert({
      lead_id: parsed.data.lead_id,
      document,
      storage_path: storagePath,
      file_name: fileName,
      is_current: true,
      exported_at: exportedAt,
      exported_by: user.id,
    })
    .select(DIAGNOSIS_EXPORT_SELECT)
    .single()

  if (insertError || !inserted) {
    await admin.storage.from(LEADS_STORAGE_BUCKET).remove([storagePath])
    return { status: "error", message: FAILED }
  }

  const exportRow = readLeadDiagnosisExportRow(
    inserted as Record<string, unknown>,
  )
  if (!exportRow) {
    return { status: "error", message: FAILED }
  }

  const { data: signed, error: signedError } = await admin.storage
    .from(LEADS_STORAGE_BUCKET)
    .createSignedUrl(storagePath, SIGNED_TTL_SECONDS)

  if (signedError || !signed?.signedUrl) {
    return { status: "success", exportRow, url: "" }
  }

  return { status: "success", exportRow, url: signed.signedUrl }
}
