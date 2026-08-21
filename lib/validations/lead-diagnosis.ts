import { z } from "zod"
import {
  DIAGNOSIS_HOOK_MAX,
  DIAGNOSIS_PILLARS,
  DIAGNOSIS_PROSE_MAX,
} from "@/lib/leads/diagnosis-document"

function formText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

export const diagnosisLeadIdSchema = z.object({
  lead_id: z.uuid("Lead inválido."),
})

export function readDiagnosisLeadIdFields(formData: FormData) {
  return {
    lead_id: formText(formData, "lead_id"),
  }
}

const pillarNarrativeSchema = z.object({
  google: z.string().max(DIAGNOSIS_PROSE_MAX),
  website: z.string().max(DIAGNOSIS_PROSE_MAX),
  presence: z.string().max(DIAGNOSIS_PROSE_MAX),
  visibility: z.string().max(DIAGNOSIS_PROSE_MAX),
})

export const updateDiagnosisDraftSchema = z.object({
  lead_id: z.uuid("Lead inválido."),
  executiveSummary: z.string().max(DIAGNOSIS_PROSE_MAX),
  commercialHook: z.string().max(DIAGNOSIS_HOOK_MAX),
  pillarNarratives: pillarNarrativeSchema,
})

export function readUpdateDiagnosisDraftFields(formData: FormData) {
  const narratives = Object.fromEntries(
    DIAGNOSIS_PILLARS.map((pillar) => [
      pillar,
      formText(formData, `narrative_${pillar}`),
    ]),
  )
  return {
    lead_id: formText(formData, "lead_id"),
    executiveSummary: formText(formData, "executive_summary"),
    commercialHook: formText(formData, "commercial_hook"),
    pillarNarratives: narratives,
  }
}

export const diagnosisExportIdSchema = z.object({
  lead_id: z.uuid("Lead inválido."),
  export_id: z.uuid("Exportação inválida.").optional(),
})

export function readDiagnosisExportIdFields(formData: FormData) {
  const exportId = formText(formData, "export_id")
  return {
    lead_id: formText(formData, "lead_id"),
    ...(exportId ? { export_id: exportId } : {}),
  }
}
