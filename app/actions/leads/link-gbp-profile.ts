"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import {
  snapshotFromPlace,
  type LeadGbpProfile,
} from "@/lib/leads/gbp"
import { fetchPlaceDetails } from "@/lib/places"
import {
  linkLeadGbpSchema,
  readLinkLeadGbpFields,
} from "@/lib/validations/lead-gbp"
import { createClient } from "@/lib/supabase/server"
import {
  countGbpProfiles,
  denyGbpEdit,
  findGbpPlaceConflict,
  GBP_SELECT,
  insertGbpSnapshot,
  loadGbpLeadContext,
  matchedKeyForSnapshot,
  nextGbpSortOrder,
  rowToGbpProfile,
} from "./gbp-access"
import { refreshGbpProfileById } from "./refresh-gbp-profile"

export type LinkLeadGbpState =
  | { status: "success"; profile: LeadGbpProfile; refreshed: boolean }
  | {
      status: "conflict"
      message: string
      existingLeadId: string
    }
  | { status: "error"; message: string }

export async function linkLeadGbpProfile(
  formData: FormData,
): Promise<LinkLeadGbpState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = linkLeadGbpSchema.safeParse(readLinkLeadGbpFields(formData))
  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ?? "Revise o estabelecimento.",
    }
  }

  const payload = parsed.data
  const supabase = await createClient()
  const lead = await loadGbpLeadContext(supabase, payload.lead_id)
  if (lead === "error") {
    return {
      status: "error",
      message: "Não foi possível vincular o perfil. Tente novamente.",
    }
  }
  if (lead === "not_found") {
    return { status: "error", message: "Lead não encontrado." }
  }

  const denied = denyGbpEdit(lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  const conflict = await findGbpPlaceConflict(supabase, payload.place_id)
  if (conflict.status === "error") {
    return {
      status: "error",
      message: "Não foi possível vincular o perfil. Tente novamente.",
    }
  }
  if (conflict.status === "taken") {
    if (conflict.leadId === payload.lead_id) {
      const refreshed = await refreshGbpProfileById(conflict.profileId)
      if (refreshed.status !== "success") return refreshed
      return { ...refreshed, refreshed: true }
    }
    return {
      status: "conflict",
      message: "Este perfil do Google já está em outro lead.",
      existingLeadId: conflict.leadId,
    }
  }

  const details = await fetchPlaceDetails(
    payload.place_id,
    payload.session_token,
  )
  if (details.status === "error") {
    return { status: "error", message: details.message }
  }

  const snapshot = snapshotFromPlace(details.data)
  const existingCount = await countGbpProfiles(supabase, payload.lead_id)
  const sortOrder = await nextGbpSortOrder(supabase, payload.lead_id)
  const fetchedAt = new Date().toISOString()
  const { data: created, error } = await supabase
    .from("lead_gbp_profiles")
    .insert({
      lead_id: payload.lead_id,
      place_id: snapshot.placeId,
      is_primary: existingCount === 0,
      sort_order: sortOrder,
      google_maps_uri: snapshot.googleMapsUri,
      fetched_at: fetchedAt,
      fetched_by: user.id,
      payload: snapshot,
      matched_website_key: matchedKeyForSnapshot(
        snapshot.websiteDomain,
        lead.websiteKeys,
      ),
      notes: null,
    })
    .select("id")
    .single()

  if (error || !created) {
    if (error?.code === "23505") {
      const raced = await findGbpPlaceConflict(supabase, snapshot.placeId)
      if (raced.status === "taken" && raced.leadId !== payload.lead_id) {
        return {
          status: "conflict",
          message: "Este perfil do Google já está em outro lead.",
          existingLeadId: raced.leadId,
        }
      }
    }
    return {
      status: "error",
      message: "Não foi possível vincular o perfil. Tente novamente.",
    }
  }

  // O perfil precisa existir antes do snapshot por causa da chave estrangeira,
  // e o snapshot antes da releitura, porque GBP_SELECT o embeda.
  const stored = await insertGbpSnapshot(
    supabase,
    created.id as string,
    { payload: snapshot },
    fetchedAt,
  )
  if (!stored) {
    return {
      status: "error",
      message: "Não foi possível vincular o perfil. Tente novamente.",
    }
  }

  const { data, error: reloadError } = await supabase
    .from("lead_gbp_profiles")
    .select(GBP_SELECT)
    .eq("id", created.id)
    .single()

  if (reloadError || !data) {
    return {
      status: "error",
      message: "Não foi possível vincular o perfil. Tente novamente.",
    }
  }

  const profile = rowToGbpProfile(data as Record<string, unknown>)
  if (!profile) {
    return {
      status: "error",
      message: "Não foi possível vincular o perfil. Tente novamente.",
    }
  }

  return { status: "success", profile, refreshed: false }
}
