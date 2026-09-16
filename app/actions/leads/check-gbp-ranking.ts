"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { DATAFORSEO_UNCONFIGURED } from "@/lib/dataforseo/client"
import {
  DATAFORSEO_NOT_CONFIGURED,
  isDataForSeoConfigured,
} from "@/lib/dataforseo/configured"
import { fetchGoogleMapsRank } from "@/lib/dataforseo/google-maps"
import { hasGbpCoordinates, type LeadGbpProfile } from "@/lib/leads/gbp"
import {
  gbpProfileIdSchema,
  readGbpProfileIdFields,
} from "@/lib/validations/lead-gbp"
import { createClient } from "@/lib/supabase/server"
import {
  denyGbpEdit,
  GBP_SELECT,
  loadGbpProfileRow,
  rowToGbpProfile,
  insertGbpRankCheck,
} from "./gbp-access"

export type CheckLeadGbpRankingState =
  | { status: "success"; profile: LeadGbpProfile }
  | { status: "error"; message: string }

const RANK_FAILED = "Não foi possível checar o ranking. Tente novamente."
const NO_KEYWORDS = "Adicione pelo menos um termo para checar o ranking."

export async function checkLeadGbpRanking(
  formData: FormData,
): Promise<CheckLeadGbpRankingState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = gbpProfileIdSchema.safeParse(readGbpProfileIdFields(formData))
  if (!parsed.success) {
    return { status: "error", message: "Perfil inválido." }
  }

  const supabase = await createClient()
  const loaded = await loadGbpProfileRow(supabase, parsed.data.profile_id)
  if (loaded.status === "error") {
    return { status: "error", message: RANK_FAILED }
  }
  if (loaded.status === "not_found") {
    return { status: "error", message: "Perfil não encontrado." }
  }

  const denied = denyGbpEdit(loaded.lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  if (loaded.profile.rank_keywords.length === 0) {
    return { status: "error", message: NO_KEYWORDS }
  }

  if (!isDataForSeoConfigured()) {
    return { status: "error", message: DATAFORSEO_NOT_CONFIGURED }
  }

  // Sem coordenada, a checagem para e diz o que fazer.
  //
  // Antes havia um fallback que consultava o Places por dentro. Trocar por uma
  // chamada ao DataForSEO seria cobrar o usuário por uma coleta que ele não
  // pediu, no meio de outra operação — e a recoleta agora é um clique.
  const snapshot = loaded.profile.payload
  if (!hasGbpCoordinates(snapshot)) {
    return {
      status: "error",
      message: "Recolete o perfil antes de checar o ranking.",
    }
  }

  const latitude = snapshot.latitude
  const longitude = snapshot.longitude
  if (latitude === null || longitude === null) {
    return { status: "error", message: RANK_FAILED }
  }

  const checkedAt = new Date().toISOString()
  const results = await Promise.all(
    loaded.profile.rank_keywords.map((keyword) =>
      fetchGoogleMapsRank({
        keyword,
        placeId: snapshot.placeId,
        latitude,
        longitude,
        checkedAt,
      }),
    ),
  )

  const source = "dataforseo_maps"

  for (const result of results) {
    if (result.status === "error") {
      if (result.message === DATAFORSEO_UNCONFIGURED) return result
      return { status: "error", message: RANK_FAILED }
    }
  }

  for (const result of results) {
    if (result.status !== "ok") continue
    const ok = await insertGbpRankCheck(
      supabase,
      parsed.data.profile_id,
      result.check,
      source,
    )
    if (!ok) {
      return { status: "error", message: RANK_FAILED }
    }
  }

  const { data, error } = await supabase
    .from("lead_gbp_profiles")
    .select(GBP_SELECT)
    .eq("id", parsed.data.profile_id)
    .single()

  if (error || !data) {
    return { status: "error", message: RANK_FAILED }
  }

  const profile = rowToGbpProfile(data as Record<string, unknown>)
  if (!profile) {
    return { status: "error", message: RANK_FAILED }
  }

  return { status: "success", profile }
}
