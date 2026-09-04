"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { DATAFORSEO_UNCONFIGURED } from "@/lib/dataforseo/client"
import { fetchGoogleMapsRank } from "@/lib/dataforseo/google-maps"
import { GBP_VENDOR_UNCONFIGURED } from "@/lib/gbp-vendor"
import { resolveGbpDataProvider } from "@/lib/gbp-vendor/resolve"
import {
  hasGbpCoordinates,
  snapshotFromPlace,
  type LeadGbpProfile,
} from "@/lib/leads/gbp"
import { fetchPlaceDetails } from "@/lib/places"
import { requireSerpApiQuota } from "@/lib/serpapi/client"
import { fetchSerpApiMapsRank } from "@/lib/serpapi/google-maps-rank"
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

  const vendor = await resolveGbpDataProvider()
  if (vendor.status === "error") {
    return { status: "error", message: vendor.message }
  }

  let snapshot = loaded.profile.payload
  const payloadPatch: Record<string, unknown> = {}

  if (!hasGbpCoordinates(snapshot)) {
    const details = await fetchPlaceDetails(loaded.profile.place_id)
    if (details.status === "error") {
      return { status: "error", message: details.message }
    }
    snapshot = snapshotFromPlace(details.data)
    if (!hasGbpCoordinates(snapshot)) {
      return { status: "error", message: RANK_FAILED }
    }
    payloadPatch.place_id = snapshot.placeId
    payloadPatch.google_maps_uri = snapshot.googleMapsUri
    payloadPatch.fetched_at = new Date().toISOString()
    payloadPatch.fetched_by = user.id
    payloadPatch.payload = snapshot
    payloadPatch.matched_website_key = matchedKeyForSnapshot(
      snapshot.websiteDomain,
      loaded.lead.websiteKeys,
    )
  }

  const latitude = snapshot.latitude
  const longitude = snapshot.longitude
  if (latitude === null || longitude === null) {
    return { status: "error", message: RANK_FAILED }
  }

  if (vendor.provider === "serpapi") {
    const quota = await requireSerpApiQuota(loaded.profile.rank_keywords.length)
    if (quota.status === "error") {
      return { status: "error", message: quota.message }
    }
  }

  const checkedAt = new Date().toISOString()
  const results =
    vendor.provider === "serpapi"
      ? await Promise.all(
          loaded.profile.rank_keywords.map((keyword) =>
            fetchSerpApiMapsRank({
              keyword,
              placeId: snapshot.placeId,
              latitude,
              longitude,
              checkedAt,
            }),
          ),
        )
      : await Promise.all(
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

  const source =
    vendor.provider === "serpapi" ? "serpapi_maps" : "dataforseo_maps"

  for (const result of results) {
    if (result.status === "error") {
      if (
        result.message === DATAFORSEO_UNCONFIGURED ||
        result.message === GBP_VENDOR_UNCONFIGURED
      ) {
        return result
      }
      return { status: "error", message: RANK_FAILED }
    }
  }

  if (Object.keys(payloadPatch).length > 0) {
    const { error: patchError } = await supabase
      .from("lead_gbp_profiles")
      .update(payloadPatch)
      .eq("id", parsed.data.profile_id)
    if (patchError) {
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
