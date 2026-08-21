import { z } from "zod"
import {
  DIGITAL_PRESENCE_FOLLOWERS_MAX,
  DIGITAL_PRESENCE_REVIEW_NOTE_MAX,
  readDigitalPresenceReview,
} from "@/lib/leads/digital-presence-review"
import { isCivilDate } from "@/lib/civil-date"

function formText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value : ""
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
  .transform((value) => readDigitalPresenceReview(value))
  .refine(
    (review) => review.identity.note.length <= DIGITAL_PRESENCE_REVIEW_NOTE_MAX,
    `Nota deve ter no máximo ${DIGITAL_PRESENCE_REVIEW_NOTE_MAX} caracteres.`,
  )
  .refine((review) => {
    return Object.values(review.networks).every((answer) => {
      if (answer.unavailable) return true
      if (
        answer.followers !== null &&
        (answer.followers < 0 || answer.followers > DIGITAL_PRESENCE_FOLLOWERS_MAX)
      ) {
        return false
      }
      if (answer.lastPostedOn !== null && !isCivilDate(answer.lastPostedOn)) {
        return false
      }
      return true
    })
  }, "Revise os dados das redes.")

export const upsertDigitalPresenceSchema = z.object({
  lead_id: z.uuid("Lead inválido."),
  review: reviewJsonSchema,
})

export function readUpsertDigitalPresenceFields(formData: FormData) {
  return {
    lead_id: formText(formData, "lead_id"),
    review: formText(formData, "review"),
  }
}
