import { z } from "zod"
import {
  CLOSING_ANSWER_IDS,
  CLOSING_TEXTAREA_MAX,
  sanitizeClosingPayload,
  type BriefingClosingPayload,
  type ClosingAnswerId,
} from "@/lib/briefing/closing"

const closingText = z.string().trim().max(CLOSING_TEXTAREA_MAX)
const closingAnswer = z.union([z.enum(CLOSING_ANSWER_IDS), z.null()])

export const briefingClosingPayloadSchema = z.object({
  hasAdditionalInfo: closingAnswer,
  additionalInfo: closingText,
})

export type BriefingClosingInput = z.infer<typeof briefingClosingPayloadSchema>

export function toClosingPayload(
  data: BriefingClosingInput,
): BriefingClosingPayload {
  return sanitizeClosingPayload({
    hasAdditionalInfo: data.hasAdditionalInfo as ClosingAnswerId | null,
    additionalInfo: data.additionalInfo,
  })
}
