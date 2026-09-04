"use server"

import { requireBriefingWriter } from "@/lib/briefing/writer"
import {
  autocompletePlaces,
  fetchPlaceDetails,
  PLACES_SUGGEST_MIN_CHARS,
  type PlaceSuggestion,
} from "@/lib/places"
import {
  addressFromPlaceComponents,
  mergeAddress,
  parseBrazilianAddress,
} from "@/lib/briefing/address"
import { hoursLinesEqual } from "@/lib/briefing/company"
import { z } from "zod"

export type SuggestBriefingAddressesState =
  | { status: "success"; suggestions: PlaceSuggestion[] }
  | { status: "error"; message: string }
  | { status: "unauthenticated" }

export type ApplyBriefingPlaceState =
  | {
      status: "success"
      street: string
      number: string
      complement: string
      neighborhood: string
      city: string
      stateCode: string
      postalCode: string
      formattedAddress: string
      hoursLines: string[] | null
    }
  | { status: "error"; message: string }
  | { status: "unauthenticated" }

const suggestSchema = z.object({
  query: z.string().trim().min(PLACES_SUGGEST_MIN_CHARS),
  session_token: z.uuid(),
})

const applySchema = z.object({
  place_id: z.string().trim().min(1),
  session_token: z.uuid(),
  hours_locked: z.boolean(),
})

export async function suggestBriefingAddresses(input: {
  query: string
  sessionToken: string
  clientId?: string
}): Promise<SuggestBriefingAddressesState> {
  const loaded = await requireBriefingWriter(input.clientId)
  if (loaded.status !== "ok") return loaded

  const parsed = suggestSchema.safeParse({
    query: input.query,
    session_token: input.sessionToken,
  })
  if (!parsed.success) {
    return {
      status: "error",
      message: `Digite pelo menos ${PLACES_SUGGEST_MIN_CHARS} caracteres.`,
    }
  }

  const result = await autocompletePlaces(
    parsed.data.query,
    parsed.data.session_token,
    "address",
  )
  if (result.status === "error") {
    return { status: "error", message: result.message }
  }
  return { status: "success", suggestions: result.data }
}

export async function applyBriefingPlace(input: {
  placeId: string
  sessionToken: string
  currentHours: string[]
  snapshotHours: string[]
  clientId?: string
}): Promise<ApplyBriefingPlaceState> {
  const loaded = await requireBriefingWriter(input.clientId)
  if (loaded.status !== "ok") return loaded

  const parsed = applySchema.safeParse({
    place_id: input.placeId,
    session_token: input.sessionToken,
    hours_locked: !hoursLinesEqual(input.currentHours, input.snapshotHours),
  })
  if (!parsed.success) {
    return { status: "error", message: "Endereço inválido." }
  }

  const result = await fetchPlaceDetails(
    parsed.data.place_id,
    parsed.data.session_token,
  )
  if (result.status === "error") {
    return { status: "error", message: result.message }
  }

  const formatted =
    result.data.formattedAddress ?? result.data.displayName ?? ""
  const merged = mergeAddress(
    parseBrazilianAddress(formatted),
    addressFromPlaceComponents(result.data.addressComponents),
  )
  if (formatted) merged.formattedAddress = formatted

  const nextHours =
    !parsed.data.hours_locked && result.data.weekdayDescriptions.length > 0
      ? result.data.weekdayDescriptions
      : null

  return {
    status: "success",
    street: merged.street,
    number: merged.number,
    complement: merged.complement,
    neighborhood: merged.neighborhood,
    city: merged.city,
    stateCode: merged.stateCode,
    postalCode: merged.postalCode,
    formattedAddress: merged.formattedAddress,
    hoursLines: nextHours,
  }
}
