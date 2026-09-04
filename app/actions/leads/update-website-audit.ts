"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import type { LeadWebsiteAudit } from "@/lib/leads/website-audit"
import { stampWebsiteReview } from "@/lib/leads/website-review"
import {
  readUpdateWebsiteAuditFields,
  updateWebsiteAuditSchema,
} from "@/lib/validations/lead-website"
import { createClient } from "@/lib/supabase/server"
import { denyWebsiteEdit, loadWebsiteAuditRow } from "./website-access"

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

  // A revisao vive por canal, fora do snapshot: uma nova analise nao a apaga e
  // ela nao se duplica a cada coleta.
  const now = new Date().toISOString()
  const review = stampWebsiteReview(parsed.data.review, user.id, now)
  const { error } = await supabase.from("lead_website_reviews").upsert(
    {
      lead_id: loaded.audit.lead_id,
      channel_id: loaded.audit.channel_id,
      review,
      updated_at: now,
      updated_by: user.id,
    },
    { onConflict: "channel_id" },
  )

  if (error) {
    return { status: "error", message: SAVE_FAILED }
  }

  return { status: "success", audit: { ...loaded.audit, review } }
}
