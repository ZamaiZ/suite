"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import {
  DATAFORSEO_NOT_CONFIGURED,
  isDataForSeoConfigured,
} from "@/lib/dataforseo/configured"
import { searchGooglePlaces } from "@/lib/dataforseo/maps-search"
import type { GbpPlaceCandidate } from "@/lib/leads/gbp-maps-candidate"
import { cityCenter } from "@/lib/locationiq/city-center"
import {
  readSearchPlacesFields,
  searchPlacesSchema,
} from "@/lib/validations/lead-gbp"
import { createClient } from "@/lib/supabase/server"
import { loadGbpLeadContext } from "./gbp-access"

export type SearchPlacesState =
  | { status: "success"; candidates: GbpPlaceCandidate[] }
  | { status: "error"; message: string }

export async function searchPlaces(
  formData: FormData,
): Promise<SearchPlacesState> {
  await requireCommercialMember()
  const parsed = searchPlacesSchema.safeParse(readSearchPlacesFields(formData))
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revise a busca.",
    }
  }

  if (!isDataForSeoConfigured()) {
    return { status: "error", message: DATAFORSEO_NOT_CONFIGURED }
  }

  const supabase = await createClient()
  const lead = await loadGbpLeadContext(supabase, parsed.data.lead_id)
  if (lead === "error" || lead === "not_found") {
    return { status: "error", message: "Lead não encontrado." }
  }

  // O centroide da cidade é o que centra a busca. Sem ele o Maps devolve outro
  // estado — medido em 2026-09-15, P5 das evidências da onda 0.
  const center = await cityCenter(lead.city, lead.state_code)
  if (center.status === "error") {
    return { status: "error", message: center.message }
  }

  // A keyword vai crua, só o que o analista digitou. Acrescentar cidade e UF
  // nela foi medido e não ajuda: com a localidade errada não salva — "Otica
  // Diniz Guarulhos SP" voltou uma ótica no Rio —, e com a coordenada certa é
  // ruído que recorta resultado bom.
  const result = await searchGooglePlaces({
    query: parsed.data.query,
    latitude: center.data.latitude,
    longitude: center.data.longitude,
  })
  if (result.status === "error") {
    return { status: "error", message: result.message }
  }
  return { status: "success", candidates: result.candidates }
}
