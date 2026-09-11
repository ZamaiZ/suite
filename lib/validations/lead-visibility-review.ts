import { z } from "zod"
import {
  readVisibilityReview,
  VISIBILITY_NOTES_MAX,
  VISIBILITY_REVIEW_NOTE_MAX,
} from "@/lib/leads/visibility-review"

function formText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
}

/**
 * `undefined` quando o campo não veio no formulário, string quando veio — mesmo
 * vazia. Campo ausente e campo apagado são coisas diferentes: o primeiro não
 * toca a coluna, o segundo grava `null`.
 */
function optionalFormText(formData: FormData, key: string): string | undefined {
  const value = formData.get(key)
  return typeof value === "string" ? value : undefined
}

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
  .transform((value) => readVisibilityReview(value))
  .refine(
    (review) =>
      Object.values(review).every(
        (answer) => answer.note.length <= VISIBILITY_REVIEW_NOTE_MAX,
      ),
    `Nota deve ter no máximo ${VISIBILITY_REVIEW_NOTE_MAX} caracteres.`,
  )

/**
 * Vazio vira `null`: o check do banco exige 1..2000 ou nulo, e um upsert com
 * `""` falharia com erro de constraint no meio do debounce.
 */
const notesSchema = z
  .string()
  .trim()
  .max(
    VISIBILITY_NOTES_MAX,
    `Notas devem ter no máximo ${VISIBILITY_NOTES_MAX} caracteres.`,
  )
  .transform((value) => (value.length === 0 ? null : value))
  .optional()

export const upsertVisibilityReviewSchema = z.object({
  lead_id: z.uuid("Lead inválido."),
  review: reviewJsonSchema,
  notes: notesSchema,
})

export function readUpsertVisibilityReviewFields(formData: FormData) {
  return {
    lead_id: formText(formData, "lead_id"),
    review: formText(formData, "review"),
    notes: optionalFormText(formData, "notes"),
  }
}
