import { z } from "zod"
import {
  readWebsiteReview,
  WEBSITE_NOTES_MAX,
  WEBSITE_REVIEW_NOTE_MAX,
} from "@/lib/leads/website-review"

function formText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

/**
 * `undefined` quando o campo nao veio no formulario, string quando veio — mesmo
 * vazia. Campo ausente e campo apagado sao coisas diferentes: o primeiro nao
 * toca a coluna, o segundo grava `null`.
 */
function optionalFormText(
  formData: FormData,
  key: string,
): string | undefined {
  const value = formData.get(key)
  return typeof value === "string" ? value : undefined
}

export const analyzeWebsiteSchema = z.object({
  channel_id: z.uuid("Site inválido."),
})

const reviewJsonSchema = z
  .string()
  .min(1, "Revise os dados.")
  .transform((value, ctx) => {
    try {
      return JSON.parse(value) as unknown
    } catch {
      ctx.addIssue({ code: "custom", message: "Revise os dados." })
      return z.NEVER
    }
  })
  .transform((value) => readWebsiteReview(value))
  .refine(
    (review) =>
      Object.values(review).every(
        (answer) => answer.note.length <= WEBSITE_REVIEW_NOTE_MAX,
      ),
    `Nota deve ter no máximo ${WEBSITE_REVIEW_NOTE_MAX} caracteres.`,
  )

/**
 * Vazio vira `null`: o check do banco exige 1..2000 ou nulo, e um upsert com
 * "" falharia com erro de constraint no meio do debounce.
 */
const notesSchema = z
  .string()
  .trim()
  .max(
    WEBSITE_NOTES_MAX,
    `Notas devem ter no máximo ${WEBSITE_NOTES_MAX} caracteres.`,
  )
  .transform((value) => (value.length === 0 ? null : value))
  .optional()

export const updateWebsiteAuditSchema = z.object({
  audit_id: z.uuid("Auditoria inválida."),
  review: reviewJsonSchema,
  notes: notesSchema,
})

export const pollWebsiteJobsSchema = z.object({
  audit_id: z.uuid("Auditoria inválida."),
})

export function readAnalyzeWebsiteFields(formData: FormData) {
  return {
    channel_id: formText(formData, "channel_id"),
  }
}

export function readUpdateWebsiteAuditFields(formData: FormData) {
  return {
    audit_id: formText(formData, "audit_id"),
    review: formText(formData, "review"),
    notes: optionalFormText(formData, "notes"),
  }
}

export function readPollWebsiteJobsFields(formData: FormData) {
  return {
    audit_id: formText(formData, "audit_id"),
  }
}
