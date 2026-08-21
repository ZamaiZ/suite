import { z } from "zod"
import {
  readWebsiteReview,
  WEBSITE_REVIEW_NOTE_MAX,
} from "@/lib/leads/website-review"

function formText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
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

export const updateWebsiteAuditSchema = z.object({
  audit_id: z.uuid("Auditoria inválida."),
  review: reviewJsonSchema,
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
  }
}

export function readPollWebsiteJobsFields(formData: FormData) {
  return {
    audit_id: formText(formData, "audit_id"),
  }
}
