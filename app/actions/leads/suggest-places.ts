"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { autocompletePlaces, PLACES_SUGGEST_MIN_CHARS } from "@/lib/places"
import type { PlaceSuggestion } from "@/lib/places"
import {
  readSuggestPlacesFields,
  suggestPlacesSchema,
} from "@/lib/validations/lead-gbp"

export type SuggestPlacesState =
  | { status: "success"; suggestions: PlaceSuggestion[] }
  | { status: "error"; message: string }

export async function suggestPlaces(
  formData: FormData,
): Promise<SuggestPlacesState> {
  await requireCommercialMember()
  const parsed = suggestPlacesSchema.safeParse(readSuggestPlacesFields(formData))
  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ??
        `Digite pelo menos ${PLACES_SUGGEST_MIN_CHARS} caracteres.`,
    }
  }

  const result = await autocompletePlaces(
    parsed.data.query,
    parsed.data.session_token,
  )
  if (result.status === "error") {
    return { status: "error", message: result.message }
  }
  return { status: "success", suggestions: result.data }
}
