"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { DATAFORSEO_COLLECT_ERROR } from "@/lib/dataforseo/client"
import { fetchGoogleBusinessInfo } from "@/lib/dataforseo/google-info"
import { fetchGoogleQna } from "@/lib/dataforseo/google-qna"
import { postGoogleReviewsTask } from "@/lib/dataforseo/google-reviews"
import { postGoogleUpdatesTask } from "@/lib/dataforseo/google-updates"
import {
  DATAFORSEO_NOT_CONFIGURED,
  isDataForSeoConfigured,
} from "@/lib/dataforseo/configured"
import {
  hasGbpCoordinates,
  snapshotFromPlace,
  type LeadGbpProfile,
} from "@/lib/leads/gbp"
import { fetchPlaceDetails } from "@/lib/places"
import {
  gbpProfileIdSchema,
  readGbpProfileIdFields,
} from "@/lib/validations/lead-gbp"
import { createClient } from "@/lib/supabase/server"
import {
  denyGbpEdit,
  GBP_SELECT,
  insertGbpSnapshot,
  loadGbpProfileRow,
  matchedKeyForSnapshot,
  rowToGbpProfile,
  upsertGbpJob,
} from "./gbp-access"

export type EnrichLeadGbpState =
  | { status: "success"; profile: LeadGbpProfile }
  | { status: "error"; message: string }

const ENRICH_FAILED = "Não foi possível analisar o perfil. Tente novamente."
const FAILED_TASK_ID = "unavailable"

export async function enrichLeadGbpProfile(
  formData: FormData,
): Promise<EnrichLeadGbpState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = gbpProfileIdSchema.safeParse(readGbpProfileIdFields(formData))
  if (!parsed.success) {
    return { status: "error", message: "Perfil inválido." }
  }

  const supabase = await createClient()
  const loaded = await loadGbpProfileRow(supabase, parsed.data.profile_id)
  if (loaded.status === "error") {
    return { status: "error", message: ENRICH_FAILED }
  }
  if (loaded.status === "not_found") {
    return { status: "error", message: "Perfil não encontrado." }
  }

  const denied = denyGbpEdit(loaded.lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  if (!isDataForSeoConfigured()) {
    return { status: "error", message: DATAFORSEO_NOT_CONFIGURED }
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
      return { status: "error", message: ENRICH_FAILED }
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
    return { status: "error", message: ENRICH_FAILED }
  }

  const info = await fetchGoogleBusinessInfo({
    placeId: snapshot.placeId,
    latitude,
    longitude,
  })
  if (info.status === "error") {
    return { status: "error", message: info.message }
  }
  if (info.status === "not_found") {
    return { status: "error", message: info.message }
  }

  const [qnaResult, reviewsPost, updatesPost] = await Promise.all([
    fetchGoogleQna({
      placeId: snapshot.placeId,
      latitude,
      longitude,
      establishmentTitle: snapshot.displayName,
    }),
    postGoogleReviewsTask({
      placeId: snapshot.placeId,
      latitude,
      longitude,
    }),
    postGoogleUpdatesTask({
      placeId: snapshot.placeId,
      latitude,
      longitude,
    }),
  ])

  const qna = qnaResult.status === "ok" ? qnaResult.qna : null

  const reviewsOk = await upsertGbpJob(
    supabase,
    parsed.data.profile_id,
    "reviews",
    reviewsPost.status === "ok"
      ? {
          dfs_task_id: reviewsPost.data,
          status: "queued",
          error_message: null,
        }
      : {
          dfs_task_id: FAILED_TASK_ID,
          status: "failed",
          error_message: DATAFORSEO_COLLECT_ERROR,
        },
  )
  const updatesOk = await upsertGbpJob(
    supabase,
    parsed.data.profile_id,
    "updates",
    updatesPost.status === "ok"
      ? {
          dfs_task_id: updatesPost.data,
          status: "queued",
          error_message: null,
        }
      : {
          dfs_task_id: FAILED_TASK_ID,
          status: "failed",
          error_message: DATAFORSEO_COLLECT_ERROR,
        },
  )
  if (!reviewsOk || !updatesOk) {
    return { status: "error", message: ENRICH_FAILED }
  }

  // Reviews e posts continuam vindo dos jobs; o snapshot herda os do anterior.
  const snapshotted = await insertGbpSnapshot(
    supabase,
    parsed.data.profile_id,
    { enrichment: info.enrichment, qna },
    info.enrichment.fetchedAt,
  )
  if (!snapshotted) {
    return { status: "error", message: ENRICH_FAILED }
  }

  const { data, error } = await supabase
    .from("lead_gbp_profiles")
    .update({
      ...payloadPatch,
      cid: info.enrichment.cid,
    })
    .eq("id", parsed.data.profile_id)
    .select(GBP_SELECT)
    .single()

  if (error || !data) {
    return { status: "error", message: ENRICH_FAILED }
  }

  const profile = rowToGbpProfile(data as Record<string, unknown>)
  if (!profile) {
    return { status: "error", message: ENRICH_FAILED }
  }

  return { status: "success", profile }
}
