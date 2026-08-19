"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import {
  readLeadWebsiteAuditRow,
  type LeadWebsiteAudit,
} from "@/lib/leads/website-audit"
import {
  readUpdateWebsiteAuditFields,
  updateWebsiteAuditSchema,
} from "@/lib/validations/lead-website"
import { createClient } from "@/lib/supabase/server"
import {
  denyWebsiteEdit,
  loadWebsiteAuditRow,
  WEBSITE_SELECT,
} from "./website-access"

export type UpdateLeadWebsiteAuditState =
  | { status: "success"; audit: LeadWebsiteAudit }
  | { status: "error"; message: string }

const SAVE_FAILED = "Não foi possível salvar. Tente novamente."

export async function updateLeadWebsiteAudit(
  formData: FormData,
): Promise<UpdateLeadWebsiteAuditState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = updateWebsiteAuditSchema.safeParse(
    readUpdateWebsiteAuditFields(formData),
  )
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revise os dados.",
    }
  }

  const supabase = await createClient()
  const loaded = await loadWebsiteAuditRow(supabase, parsed.data.audit_id)
  if (loaded.status === "error") {
    return { status: "error", message: SAVE_FAILED }
  }
  if (loaded.status === "not_found") {
    return { status: "error", message: "Auditoria não encontrada." }
  }

  const denied = denyWebsiteEdit(loaded.lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  const { data, error } = await supabase
    .from("lead_website_audits")
    .update({ notes: parsed.data.notes })
    .eq("id", parsed.data.audit_id)
    .select(WEBSITE_SELECT)
    .single()

  if (error || !data) {
    return { status: "error", message: SAVE_FAILED }
  }

  const audit = readLeadWebsiteAuditRow(data as Record<string, unknown>)
  if (!audit) {
    return { status: "error", message: SAVE_FAILED }
  }
  return { status: "success", audit }
}
