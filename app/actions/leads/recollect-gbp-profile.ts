"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import {
  DATAFORSEO_NOT_CONFIGURED,
  isDataForSeoConfigured,
} from "@/lib/dataforseo/configured"
import type { LeadGbpProfile } from "@/lib/leads/gbp"
import {
  gbpProfileIdSchema,
  readGbpProfileIdFields,
} from "@/lib/validations/lead-gbp"
import { createClient } from "@/lib/supabase/server"
import { collectGbpProfile, GBP_COLLECT_FAILED } from "./gbp-collect"
import {
  denyGbpEdit,
  GBP_SELECT,
  loadGbpProfileRow,
  matchedKeyForSnapshot,
  rowToGbpProfile,
} from "./gbp-access"

/**
 * Um caminho só.
 *
 * `refresh` relia o Places e `enrich` chamava o DataForSEO, e a diferença entre
 * os dois era invisível na tela e cara de explicar. Com a ficha e o enrichment
 * vindo da mesma resposta, não sobra o que separar — nem o estado intermediário
 * de perfil vinculado e nunca analisado.
 */
export type RecollectLeadGbpState =
  | { status: "success"; profile: LeadGbpProfile }
  | { status: "error"; message: string }

export async function recollectGbpProfileById(
  profileId: string,
): Promise<RecollectLeadGbpState> {
  const { user, roles } = await requireCommercialMember()
  const supabase = await createClient()
  const loaded = await loadGbpProfileRow(supabase, profileId)
  if (loaded.status === "error") {
    return { status: "error", message: GBP_COLLECT_FAILED }
  }
  if (loaded.status === "not_found") {
    return { status: "error", message: "Perfil não encontrado." }
  }

  const denied = denyGbpEdit(loaded.lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  if (!isDataForSeoConfigured()) {
    return { status: "error", message: DATAFORSEO_NOT_CONFIGURED }
  }

  const collected = await collectGbpProfile(supabase, {
    profileId,
    placeId: loaded.profile.place_id,
    latitude: loaded.profile.payload.latitude,
    longitude: loaded.profile.payload.longitude,
  })
  if (collected.status === "error") {
    return { status: "error", message: collected.message }
  }

  const { data, error } = await supabase
    .from("lead_gbp_profiles")
    .update({
      place_id: collected.snapshot.placeId,
      google_maps_uri: collected.snapshot.googleMapsUri,
      fetched_at: new Date().toISOString(),
      fetched_by: user.id,
      payload: collected.snapshot,
      cid: collected.cid,
      matched_website_key: matchedKeyForSnapshot(
        collected.snapshot.websiteDomain,
        loaded.lead.websiteKeys,
      ),
    })
    .eq("id", profileId)
    .select(GBP_SELECT)
    .single()

  if (error || !data) {
    return { status: "error", message: GBP_COLLECT_FAILED }
  }

  const profile = rowToGbpProfile(data as Record<string, unknown>)
  if (!profile) {
    return { status: "error", message: GBP_COLLECT_FAILED }
  }

  return { status: "success", profile }
}

export async function recollectLeadGbpProfile(
  formData: FormData,
): Promise<RecollectLeadGbpState> {
  const parsed = gbpProfileIdSchema.safeParse(readGbpProfileIdFields(formData))
  if (!parsed.success) {
    return { status: "error", message: "Perfil inválido." }
  }
  return recollectGbpProfileById(parsed.data.profile_id)
}
