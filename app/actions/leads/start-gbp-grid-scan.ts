"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import {
  DATAFORSEO_NOT_CONFIGURED,
  isDataForSeoConfigured,
} from "@/lib/dataforseo/configured"
import {
  GBP_GRID_DEADLINE_MS,
  GBP_GRID_ZOOM,
  gbpGridCost,
  gbpGridPoints,
  readLeadGbpGridScanRow,
  type LeadGbpGridScan,
} from "@/lib/leads/gbp-grid"
import {
  readStartGbpGridScanFields,
  startGbpGridScanSchema,
} from "@/lib/validations/lead-gbp-grid"
import { createClient } from "@/lib/supabase/server"
import { denyGbpEdit, GRID_SCAN_SELECT, loadGbpProfileRow } from "./gbp-access"

export type StartLeadGbpGridScanState =
  | { status: "success"; scan: LeadGbpGridScan }
  | { status: "error"; message: string }

const START_FAILED = "Não foi possível iniciar a malha. Tente novamente."
const ALREADY_RUNNING = "Já existe uma malha em andamento para esta keyword."
const NO_COORDINATES = "O perfil não tem coordenadas para montar a malha."
const UNKNOWN_KEYWORD = "Essa keyword não está cadastrada no perfil."
const EXPIRED = "A malha expirou antes de terminar."

export async function startLeadGbpGridScan(
  formData: FormData,
): Promise<StartLeadGbpGridScanState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = startGbpGridScanSchema.safeParse(
    readStartGbpGridScanFields(formData),
  )
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revise os dados.",
    }
  }

  const supabase = await createClient()
  const loaded = await loadGbpProfileRow(supabase, parsed.data.profile_id)
  if (loaded.status === "error") {
    return { status: "error", message: START_FAILED }
  }
  if (loaded.status === "not_found") {
    return { status: "error", message: "Perfil não encontrado." }
  }

  const denied = denyGbpEdit(loaded.lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  const keyword = parsed.data.keyword
  if (
    !loaded.profile.rank_keywords.some(
      (item) => item.toLowerCase() === keyword.toLowerCase(),
    )
  ) {
    return { status: "error", message: UNKNOWN_KEYWORD }
  }

  const { latitude, longitude } = loaded.profile.payload
  if (latitude === null || longitude === null) {
    return { status: "error", message: NO_COORDINATES }
  }

  if (!isDataForSeoConfigured()) {
    return { status: "error", message: DATAFORSEO_NOT_CONFIGURED }
  }

  // Aba fechada no meio deixava a malha em "running" para sempre, e o índice
  // único parcial prendia a keyword junto. Aposenta a malha vencida antes de
  // tentar a nova, preservando pontos e identificadores para o "Retomar".
  const staleCutoff = new Date(Date.now() - GBP_GRID_DEADLINE_MS).toISOString()
  const { error: reapError } = await supabase
    .from("lead_gbp_grid_scans")
    .update({
      status: "partial",
      error_message: EXPIRED,
      polling_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("profile_id", loaded.profile.id)
    .eq("keyword", keyword)
    .in("status", ["queued", "running"])
    .lt("updated_at", staleCutoff)
  if (reapError) return { status: "error", message: START_FAILED }

  const total = gbpGridCost(parsed.data.size)
  const points = gbpGridPoints({
    centerLat: latitude,
    centerLng: longitude,
    size: parsed.data.size,
    radiusKm: parsed.data.radius_km,
  })

  const { data, error } = await supabase
    .from("lead_gbp_grid_scans")
    .insert({
      lead_id: loaded.profile.lead_id,
      profile_id: loaded.profile.id,
      keyword,
      center_lat: latitude,
      center_lng: longitude,
      size: parsed.data.size,
      radius_km: parsed.data.radius_km,
      zoom: GBP_GRID_ZOOM,
      source: "dataforseo_maps",
      mode: parsed.data.mode,
      status: "queued",
      processed: 0,
      total,
      points,
      cost_usd: 0,
      task_ids: {},
    })
    .select(GRID_SCAN_SELECT)
    .single()

  if (error || !data) {
    // O índice único parcial recusa um segundo scan ativo para a mesma
    // keyword. Nenhuma busca foi consumida até aqui.
    if (error?.code === "23505") {
      return { status: "error", message: ALREADY_RUNNING }
    }
    return { status: "error", message: START_FAILED }
  }

  const scan = readLeadGbpGridScanRow(data as Record<string, unknown>)
  if (!scan) return { status: "error", message: START_FAILED }
  return { status: "success", scan }
}
