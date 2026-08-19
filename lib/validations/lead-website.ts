import { z } from "zod"
import { WEBSITE_NOTES_MAX } from "@/lib/leads/website-audit"

function formText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

export const analyzeWebsiteSchema = z.object({
  channel_id: z.uuid("Site inválido."),
})

export const updateWebsiteAuditSchema = z.object({
  audit_id: z.uuid("Auditoria inválida."),
  notes: z
    .string()
    .max(WEBSITE_NOTES_MAX, `Nota deve ter no máximo ${WEBSITE_NOTES_MAX} caracteres.`)
    .transform((value) => {
      const trimmed = value.trim()
      return trimmed.length === 0 ? null : trimmed
    }),
})

export function readAnalyzeWebsiteFields(formData: FormData) {
  return {
    channel_id: formText(formData, "channel_id"),
  }
}

export function readUpdateWebsiteAuditFields(formData: FormData) {
  return {
    audit_id: formText(formData, "audit_id"),
    notes: formText(formData, "notes"),
  }
}
