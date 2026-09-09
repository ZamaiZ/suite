"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import {
  GBP_DIRECTORY_IDS,
  type GbpAnalystReview,
} from "@/lib/leads/gbp-analyst-review"
import type { LeadGbpProfile } from "@/lib/leads/gbp"
import {
  readGbpAnalystReviewFields,
  updateGbpAnalystReviewSchema,
} from "@/lib/validations/lead-gbp"
import { createClient } from "@/lib/supabase/server"
import {
  denyGbpEdit,
  GBP_SELECT,
  loadGbpProfileRow,
  rowToGbpProfile,
} from "./gbp-access"

export type UpdateLeadGbpAnalystReviewState =
  | { status: "success"; profile: LeadGbpProfile }
  | { status: "error"; message: string }

const SAVE_FAILED = "Não foi possível salvar. Tente novamente."

export async function updateLeadGbpAnalystReview(
  formData: FormData,
): Promise<UpdateLeadGbpAnalystReviewState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = updateGbpAnalystReviewSchema.safeParse(
    readGbpAnalystReviewFields(formData),
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
    return { status: "error", message: SAVE_FAILED }
  }
  if (loaded.status === "not_found") {
    return { status: "error", message: "Perfil não encontrado." }
  }

  const denied = denyGbpEdit(loaded.lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  // Provenância é carimbada aqui, nunca aceita do cliente, e só na resposta que
  // de fato mudou — reabrir a tela não pode reescrever a data de quem respondeu
  // semana passada.
  const now = new Date().toISOString()
  const before = loaded.profile.analyst_review
  const bandChanged =
    parsed.data.band !== undefined && parsed.data.band !== before.replyTime.band
  const next: GbpAnalystReview = {
    replyTime: bandChanged
      ? { band: parsed.data.band ?? null, updatedAt: now, updatedBy: user.id }
      : before.replyTime,
    directories: { ...before.directories },
  }

  // Só o que veio no corpo é considerado. Diretório não enviado fica como
  // estava — envio parcial não pode apagar resposta que ninguém tocou.
  const sent = parsed.data.directories
  for (const id of GBP_DIRECTORY_IDS) {
    if (!Object.prototype.hasOwnProperty.call(sent, id)) continue
    const incoming = sent[id] ?? null
    if (incoming === before.directories[id].state) continue
    next.directories[id] = {
      state: incoming,
      updatedAt: now,
      updatedBy: user.id,
    }
  }

  const { error: updateError } = await supabase
    .from("lead_gbp_profiles")
    .update({ analyst_review: next })
    .eq("id", parsed.data.profile_id)
  if (updateError) {
    return { status: "error", message: SAVE_FAILED }
  }

  const { data, error } = await supabase
    .from("lead_gbp_profiles")
    .select(GBP_SELECT)
    .eq("id", parsed.data.profile_id)
    .single()

  if (error || !data) {
    return { status: "error", message: SAVE_FAILED }
  }

  const profile = rowToGbpProfile(data as Record<string, unknown>)
  if (!profile) {
    return { status: "error", message: SAVE_FAILED }
  }

  return { status: "success", profile }
}
