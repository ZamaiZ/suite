"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import type { LeadGbpProfile } from "@/lib/leads/gbp"
import {
  linkLeadGbpSchema,
  readLinkLeadGbpFields,
} from "@/lib/validations/lead-gbp"
import { createClient } from "@/lib/supabase/server"
import { collectGbpProfile, GBP_COLLECT_FAILED } from "./gbp-collect"
import {
  countGbpProfiles,
  denyGbpEdit,
  findGbpPlaceConflict,
  GBP_SELECT,
  loadGbpLeadContext,
  matchedKeyForSnapshot,
  nextGbpSortOrder,
  rowToGbpProfile,
} from "./gbp-access"
import { recollectGbpProfileById } from "./recollect-gbp-profile"

/**
 * Vincular e coletar viraram uma etapa só.
 *
 * O analista escolhe o estabelecimento e recebe o perfil **já analisado** —
 * ficha, Q&A e os jobs de avaliações e postagens —, em vez de vincular agora e
 * clicar em "Analisar" depois. O que permite isso é o `my_business_info`
 * devolver snapshot e enrichment no mesmo item, medido em 2026-09-15.
 */
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
      message: parsed.error.issues[0]?.message ?? "Revise o estabelecimento.",
    }
  }

  const payload = parsed.data
  const supabase = await createClient()
  const lead = await loadGbpLeadContext(supabase, payload.lead_id)
  if (lead === "error") {
    return { status: "error", message: GBP_COLLECT_FAILED }
  }
  if (lead === "not_found") {
    return { status: "error", message: "Lead não encontrado." }
  }

  const denied = denyGbpEdit(lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  const conflict = await findGbpPlaceConflict(supabase, payload.place_id)
  if (conflict.status === "error") {
    return { status: "error", message: GBP_COLLECT_FAILED }
  }
  if (conflict.status === "taken") {
    if (conflict.leadId === payload.lead_id) {
      // Revincular o que já está aqui é recoletar. Aponta para o mesmo caminho
      // do botão, para que as duas coisas não colham de fontes diferentes.
      const recollected = await recollectGbpProfileById(conflict.profileId)
      if (recollected.status !== "success") return recollected
      return { ...recollected, refreshed: true }
    }
    return {
      status: "conflict",
      message: "Este perfil do Google já está em outro lead.",
      existingLeadId: conflict.leadId,
    }
  }

  // 1. O perfil nasce com o mínimo: a coleta ainda não aconteceu, e ela precisa
  //    de um `profile_id` para pendurar snapshot e jobs.
  const existingCount = await countGbpProfiles(supabase, payload.lead_id)
  const sortOrder = await nextGbpSortOrder(supabase, payload.lead_id)
  const fetchedAt = new Date().toISOString()
  const { data: created, error } = await supabase
    .from("lead_gbp_profiles")
    .insert({
      lead_id: payload.lead_id,
      place_id: payload.place_id,
      is_primary: existingCount === 0,
      sort_order: sortOrder,
      google_maps_uri: null,
      fetched_at: fetchedAt,
      fetched_by: user.id,
      payload: { placeId: payload.place_id },
      matched_website_key: null,
      notes: null,
    })
    .select("id")
    .single()

  if (error || !created) {
    if (error?.code === "23505") {
      const raced = await findGbpPlaceConflict(supabase, payload.place_id)
      if (raced.status === "taken" && raced.leadId !== payload.lead_id) {
        return {
          status: "conflict",
          message: "Este perfil do Google já está em outro lead.",
          existingLeadId: raced.leadId,
        }
      }
    }
    return { status: "error", message: GBP_COLLECT_FAILED }
  }

  const profileId = created.id as string

  // 2. A coleta completa: ficha, Q&A e os dois jobs, numa função só.
  const collected = await collectGbpProfile(supabase, {
    profileId,
    placeId: payload.place_id,
    latitude: payload.latitude,
    longitude: payload.longitude,
  })
  if (collected.status === "error") {
    // Perfil sem coleta não serve para nada e confundiria a tela — some.
    await supabase.from("lead_gbp_profiles").delete().eq("id", profileId)
    return { status: "error", message: collected.message }
  }

  // 3. O perfil recebe o que a coleta descobriu. O snapshot já foi gravado por
  //    `collectGbpProfile`, e `GBP_SELECT` o embeda — por isso a releitura vem
  //    depois, e não antes.
  const { data, error: updateError } = await supabase
    .from("lead_gbp_profiles")
    .update({
      place_id: collected.snapshot.placeId,
      google_maps_uri: collected.snapshot.googleMapsUri,
      payload: collected.snapshot,
      cid: collected.cid,
      matched_website_key: matchedKeyForSnapshot(
        collected.snapshot.websiteDomain,
        lead.websiteKeys,
      ),
    })
    .eq("id", profileId)
    .select(GBP_SELECT)
    .single()

  if (updateError || !data) {
    return { status: "error", message: GBP_COLLECT_FAILED }
  }

  const profile = rowToGbpProfile(data as Record<string, unknown>)
  if (!profile) {
    return { status: "error", message: GBP_COLLECT_FAILED }
  }

  return { status: "success", profile, refreshed: false }
}
