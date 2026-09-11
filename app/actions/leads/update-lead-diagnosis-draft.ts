"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import type { LeadDiagnosisDraft } from "@/lib/leads/diagnosis-document"
import { readLeadDiagnosisDraftRow } from "@/lib/leads/diagnosis-read"
import {
  readUpdateDiagnosisDraftFields,
  updateDiagnosisDraftSchema,
} from "@/lib/validations/lead-diagnosis"
import { createClient } from "@/lib/supabase/server"
import {
  denyDiagnosisEdit,
  DIAGNOSIS_DRAFT_SELECT,
  loadDiagnosisDraftByLead,
} from "./diagnosis-access"

export type UpdateLeadDiagnosisDraftState =
  | { status: "success"; draft: LeadDiagnosisDraft }
  | { status: "error"; message: string }

const FAILED = "Não foi possível salvar o diagnóstico. Tente novamente."

export async function updateLeadDiagnosisDraft(
  formData: FormData,
): Promise<UpdateLeadDiagnosisDraftState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = updateDiagnosisDraftSchema.safeParse(
    readUpdateDiagnosisDraftFields(formData),
  )
  if (!parsed.success) {
    return { status: "error", message: "Dados inválidos." }
  }

  const supabase = await createClient()
  const loaded = await loadDiagnosisDraftByLead(supabase, parsed.data.lead_id)
  if (loaded.status === "error") {
    return { status: "error", message: FAILED }
  }
  if (loaded.status === "not_found") {
    return { status: "error", message: "Lead não encontrado." }
  }
  if (!loaded.draft) {
    return {
      status: "error",
      message: "Monte o diagnóstico antes de editar o texto.",
    }
  }

  const denied = denyDiagnosisEdit(loaded.lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  const updatedAt = new Date().toISOString()
  const document = {
    ...loaded.draft.document,
    prose: {
      executiveSummary: parsed.data.executiveSummary.trim(),
      commercialHook: parsed.data.commercialHook.trim(),
      pillarNarratives: {
        google: parsed.data.pillarNarratives.google.trim(),
        website: parsed.data.pillarNarratives.website.trim(),
        presence: parsed.data.pillarNarratives.presence.trim(),
        visibility: parsed.data.pillarNarratives.visibility.trim(),
        geo: parsed.data.pillarNarratives.geo.trim(),
      },
    },
  }

  const { data, error } = await supabase
    .from("lead_diagnosis_drafts")
    .update({
      document,
      updated_at: updatedAt,
      updated_by: user.id,
    })
    .eq("lead_id", parsed.data.lead_id)
    .select(DIAGNOSIS_DRAFT_SELECT)
    .single()

  if (error || !data) {
    return { status: "error", message: FAILED }
  }

  const draft = readLeadDiagnosisDraftRow(data as Record<string, unknown>)
  if (!draft) return { status: "error", message: FAILED }
  return { status: "success", draft }
}
