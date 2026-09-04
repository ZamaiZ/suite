"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import type { LeadGbpProfile } from "@/lib/leads/gbp"
import {
  readUpdateLeadGbpFields,
  updateLeadGbpSchema,
} from "@/lib/validations/lead-gbp"
import { createClient } from "@/lib/supabase/server"
import {
  denyGbpEdit,
  GBP_SELECT,
  loadGbpProfileRow,
  rowToGbpProfile,
  setGbpPrimary,
} from "./gbp-access"

export type UpdateLeadGbpState =
  | { status: "success"; profile: LeadGbpProfile }
  | { status: "error"; message: string }

export async function updateLeadGbpProfile(
  formData: FormData,
): Promise<UpdateLeadGbpState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = updateLeadGbpSchema.safeParse(readUpdateLeadGbpFields(formData))
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revise os dados.",
    }
  }

  const supabase = await createClient()
  const loaded = await loadGbpProfileRow(supabase, parsed.data.profile_id)
  if (loaded.status === "error") {
    return {
      status: "error",
      message: "Não foi possível salvar. Tente novamente.",
    }
  }
  if (loaded.status === "not_found") {
    return { status: "error", message: "Perfil não encontrado." }
  }

  const denied = denyGbpEdit(loaded.lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  if (parsed.data.set_primary && !loaded.profile.is_primary) {
    const ok = await setGbpPrimary(
      supabase,
      loaded.lead.id,
      parsed.data.profile_id,
    )
    if (!ok) {
      return {
        status: "error",
        message: "Não foi possível definir o perfil principal.",
      }
    }
  }

  const { data, error } = await supabase
    .from("lead_gbp_profiles")
    .update({
      notes: parsed.data.notes,
      reputation_note: parsed.data.reputation_note,
    })
    .eq("id", parsed.data.profile_id)
    .select(GBP_SELECT)
    .single()

  if (error || !data) {
    return {
      status: "error",
      message: "Não foi possível salvar. Tente novamente.",
    }
  }

  const profile = rowToGbpProfile(data as Record<string, unknown>)
  if (!profile) {
    return {
      status: "error",
      message: "Não foi possível salvar. Tente novamente.",
    }
  }

  return { status: "success", profile }
}
