"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { snapshotFromPlace, type LeadGbpProfile } from "@/lib/leads/gbp"
import { fetchPlaceDetails } from "@/lib/places"
import {
  gbpProfileIdSchema,
  readGbpProfileIdFields,
} from "@/lib/validations/lead-gbp"
import { createClient } from "@/lib/supabase/server"
import {
  denyGbpEdit,
  GBP_SELECT,
  loadGbpProfileRow,
  matchedKeyForSnapshot,
  rowToGbpProfile,
} from "./gbp-access"

export type RefreshLeadGbpState =
  | { status: "success"; profile: LeadGbpProfile }
  | { status: "error"; message: string }

export async function refreshGbpProfileById(
  profileId: string,
): Promise<RefreshLeadGbpState> {
  const { user, roles } = await requireCommercialMember()
  const supabase = await createClient()
  const loaded = await loadGbpProfileRow(supabase, profileId)
  if (loaded.status === "error") {
    return {
      status: "error",
      message: "Não foi possível atualizar o perfil. Tente novamente.",
    }
  }
  if (loaded.status === "not_found") {
    return { status: "error", message: "Perfil não encontrado." }
  }

  const denied = denyGbpEdit(loaded.lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  const details = await fetchPlaceDetails(loaded.profile.place_id)
  if (details.status === "error") {
    return { status: "error", message: details.message }
  }

  const snapshot = snapshotFromPlace(details.data)
  const { data, error } = await supabase
    .from("lead_gbp_profiles")
    .update({
      place_id: snapshot.placeId,
      google_maps_uri: snapshot.googleMapsUri,
      fetched_at: new Date().toISOString(),
      fetched_by: user.id,
      payload: snapshot,
      matched_website_key: matchedKeyForSnapshot(
        snapshot.websiteDomain,
        loaded.lead.websiteKeys,
      ),
    })
    .eq("id", profileId)
    .select(GBP_SELECT)
    .single()

  if (error || !data) {
    return {
      status: "error",
      message: "Não foi possível atualizar o perfil. Tente novamente.",
    }
  }

  const profile = rowToGbpProfile(data as Record<string, unknown>)
  if (!profile) {
    return {
      status: "error",
      message: "Não foi possível atualizar o perfil. Tente novamente.",
    }
  }

  return { status: "success", profile }
}

export async function refreshLeadGbpProfile(
  formData: FormData,
): Promise<RefreshLeadGbpState> {
  const parsed = gbpProfileIdSchema.safeParse(readGbpProfileIdFields(formData))
  if (!parsed.success) {
    return { status: "error", message: "Perfil inválido." }
  }
  return refreshGbpProfileById(parsed.data.profile_id)
}
