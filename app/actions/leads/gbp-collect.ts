import "server-only"

import { DATAFORSEO_COLLECT_ERROR } from "@/lib/dataforseo/client"
import { fetchGoogleBusinessInfo } from "@/lib/dataforseo/google-info"
import { fetchGoogleQna } from "@/lib/dataforseo/google-qna"
import { postGoogleReviewsTask } from "@/lib/dataforseo/google-reviews"
import { postGoogleUpdatesTask } from "@/lib/dataforseo/google-updates"
import { snapshotFromBusinessInfo } from "@/lib/leads/gbp-business-info-map"
import type { GbpSnapshot } from "@/lib/leads/gbp"
import type { createClient } from "@/lib/supabase/server"
import { insertGbpSnapshot, upsertGbpJob } from "./gbp-access"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

/**
 * A coleta completa de um perfil, num lugar só.
 *
 * Existia em duplicata implícita: `link` gravava o snapshot do Places e
 * `enrich` gravava o enrichment do DataForSEO, e entre os dois havia um estado
 * — perfil vinculado e nunca analisado — que as regras de gap carregavam ramos
 * para tratar. Com uma chamada produzindo os dois, o estado deixa de existir.
 */

export const GBP_COLLECT_FAILED =
  "Não foi possível coletar o perfil. Tente novamente."

const FAILED_TASK_ID = "unavailable"

export type CollectGbpProfileResult =
  | { status: "ok"; snapshot: GbpSnapshot; cid: string | null }
  | { status: "error"; message: string }

export async function collectGbpProfile(
  supabase: SupabaseClient,
  input: {
    profileId: string
    placeId: string
    latitude: number | null
    longitude: number | null
  },
): Promise<CollectGbpProfileResult> {
  const info = await fetchGoogleBusinessInfo({
    placeId: input.placeId,
    latitude: input.latitude,
    longitude: input.longitude,
  })
  if (info.status !== "ok") {
    return { status: "error", message: info.message }
  }

  const snapshot = snapshotFromBusinessInfo(info.item)
  if (!snapshot) {
    return { status: "error", message: GBP_COLLECT_FAILED }
  }

  // A coordenada do próprio item alimenta Q&A, avaliações e postagens. Quando o
  // perfil antigo não tinha nenhuma, era o Places que a devolvia; agora ela vem
  // da mesma chamada que já foi paga.
  const latitude = snapshot.latitude ?? input.latitude
  const longitude = snapshot.longitude ?? input.longitude
  if (latitude === null || longitude === null) {
    return { status: "error", message: GBP_COLLECT_FAILED }
  }

  const [qnaResult, reviewsPost, updatesPost] = await Promise.all([
    fetchGoogleQna({
      placeId: snapshot.placeId,
      latitude,
      longitude,
      establishmentTitle: snapshot.displayName,
    }),
    postGoogleReviewsTask({ placeId: snapshot.placeId, latitude, longitude }),
    postGoogleUpdatesTask({ placeId: snapshot.placeId, latitude, longitude }),
  ])

  const reviewsOk = await upsertGbpJob(
    supabase,
    input.profileId,
    "reviews",
    reviewsPost.status === "ok"
      ? { dfs_task_id: reviewsPost.data, status: "queued", error_message: null }
      : {
          dfs_task_id: FAILED_TASK_ID,
          status: "failed",
          error_message: DATAFORSEO_COLLECT_ERROR,
        },
  )
  const updatesOk = await upsertGbpJob(
    supabase,
    input.profileId,
    "updates",
    updatesPost.status === "ok"
      ? { dfs_task_id: updatesPost.data, status: "queued", error_message: null }
      : {
          dfs_task_id: FAILED_TASK_ID,
          status: "failed",
          error_message: DATAFORSEO_COLLECT_ERROR,
        },
  )
  if (!reviewsOk || !updatesOk) {
    return { status: "error", message: GBP_COLLECT_FAILED }
  }

  // Snapshot e enrichment na mesma linha, porque vieram da mesma resposta.
  // Avaliações e postagens continuam chegando pelos jobs e herdam do anterior.
  const stored = await insertGbpSnapshot(
    supabase,
    input.profileId,
    {
      payload: snapshot,
      enrichment: info.enrichment,
      qna: qnaResult.status === "ok" ? qnaResult.qna : null,
    },
    info.enrichment.fetchedAt,
  )
  if (!stored) {
    return { status: "error", message: GBP_COLLECT_FAILED }
  }

  return { status: "ok", snapshot, cid: info.enrichment.cid }
}
