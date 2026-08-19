"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import {
  gbpProfileIdSchema,
  readGbpProfileIdFields,
} from "@/lib/validations/lead-gbp"
import { createClient } from "@/lib/supabase/server"
import { denyGbpEdit, loadGbpProfileRow, setGbpPrimary } from "./gbp-access"

export type RemoveLeadGbpState =
  | { status: "success"; profileId: string }
  | { status: "error"; message: string }

export async function removeLeadGbpProfile(
  formData: FormData,
): Promise<RemoveLeadGbpState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = gbpProfileIdSchema.safeParse(readGbpProfileIdFields(formData))
  if (!parsed.success) {
    return { status: "error", message: "Perfil inválido." }
  }

  const supabase = await createClient()
  const loaded = await loadGbpProfileRow(supabase, parsed.data.profile_id)
  if (loaded.status === "error") {
    return {
      status: "error",
      message: "Não foi possível remover o perfil. Tente novamente.",
    }
  }
  if (loaded.status === "not_found") {
    return { status: "error", message: "Perfil não encontrado." }
  }

  const denied = denyGbpEdit(loaded.lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  const wasPrimary = loaded.profile.is_primary
  const { error } = await supabase
    .from("lead_gbp_profiles")
    .delete()
    .eq("id", parsed.data.profile_id)

  if (error) {
    return {
      status: "error",
      message: "Não foi possível remover o perfil. Tente novamente.",
    }
  }

  if (wasPrimary) {
    const { data: next } = await supabase
      .from("lead_gbp_profiles")
      .select("id")
      .eq("lead_id", loaded.lead.id)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle()
    if (next && typeof next.id === "string") {
      await setGbpPrimary(supabase, loaded.lead.id, next.id)
    }
  }

  return { status: "success", profileId: parsed.data.profile_id }
}
