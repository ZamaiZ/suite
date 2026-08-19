"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import type { LeadGbpProfile } from "@/lib/leads/gbp"
import {
  readGbpRankKeywordsFields,
  updateGbpRankKeywordsSchema,
} from "@/lib/validations/lead-gbp"
import { createClient } from "@/lib/supabase/server"
import {
  denyGbpEdit,
  deleteGbpRankChecksNotIn,
  GBP_SELECT,
  loadGbpProfileRow,
  rowToGbpProfile,
} from "./gbp-access"

export type UpdateLeadGbpRankKeywordsState =
  | { status: "success"; profile: LeadGbpProfile }
  | { status: "error"; message: string }

const SAVE_FAILED = "Não foi possível salvar. Tente novamente."

export async function updateLeadGbpRankKeywords(
  formData: FormData,
): Promise<UpdateLeadGbpRankKeywordsState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = updateGbpRankKeywordsSchema.safeParse(
    readGbpRankKeywordsFields(formData),
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

  const { error: updateError } = await supabase
    .from("lead_gbp_profiles")
    .update({ rank_keywords: parsed.data.rank_keywords })
    .eq("id", parsed.data.profile_id)
  if (updateError) {
    return { status: "error", message: SAVE_FAILED }
  }

  const deleted = await deleteGbpRankChecksNotIn(
    supabase,
    parsed.data.profile_id,
    parsed.data.rank_keywords,
  )
  if (!deleted) {
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
