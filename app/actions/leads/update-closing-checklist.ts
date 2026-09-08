"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { canEditClosingChecklist, isClosingStage } from "@/lib/leads/closing"
import { isLeadStatus } from "@/lib/leads/status"
import { createClient } from "@/lib/supabase/server"
import {
  readClosingChecklistFormFields,
  updateClosingChecklistSchema,
} from "@/lib/validations/lead-closing"

export type UpdateClosingChecklistField =
  | "legal_name"
  | "tax_id"
  | "signer_name"
  | "contract_ref"
  | "invoice_ref"
  | "contract_sent_at"
  | "contract_signed_at"
  | "invoice_sent_at"
  | "paid_at"

export type ClosingChecklistPatch = {
  legal_name: string | null
  tax_id: string | null
  signer_name: string | null
  contract_ref: string | null
  invoice_ref: string | null
  contract_sent_at: string | null
  contract_signed_at: string | null
  invoice_sent_at: string | null
  paid_at: string | null
}

export type UpdateClosingChecklistState =
  | {
      status: "success"
      message: string
      patch: ClosingChecklistPatch
    }
  | {
      status: "error"
      message: string
      fieldErrors?: Partial<Record<UpdateClosingChecklistField, string[]>>
    }

export async function updateClosingChecklist(
  formData: FormData,
): Promise<UpdateClosingChecklistState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = updateClosingChecklistSchema.safeParse(
    readClosingChecklistFormFields(formData),
  )

  if (!parsed.success) {
    return {
      status: "error",
      message: "Revise os dados do acordo.",
      fieldErrors: parsed.error.flatten().fieldErrors as Partial<
        Record<UpdateClosingChecklistField, string[]>
      >,
    }
  }

  const payload = parsed.data
  const supabase = await createClient()
  const { data: lead, error: loadError } = await supabase
    .from("leads")
    .select("id, status, assigned_sdr_id, assigned_closer_id, closing_stage")
    .eq("id", payload.lead_id)
    .maybeSingle()

  if (loadError) {
    return {
      status: "error",
      message: "Não foi possível salvar. Tente novamente.",
    }
  }

  if (!lead) {
    return { status: "error", message: "Lead não encontrado." }
  }

  if (!isLeadStatus(lead.status) || !isClosingStage(lead.closing_stage)) {
    return { status: "error", message: "Lead inválido para consolidação." }
  }

  if (
    !canEditClosingChecklist(
      {
        status: lead.status,
        assigned_sdr_id: lead.assigned_sdr_id,
        assigned_closer_id: lead.assigned_closer_id,
        closing_stage: lead.closing_stage,
      },
      user.id,
      roles,
    )
  ) {
    return {
      status: "error",
      message: "Você não pode editar a consolidação deste acordo.",
    }
  }

  const patch: ClosingChecklistPatch = {
    legal_name: payload.legal_name,
    tax_id: payload.tax_id,
    signer_name: payload.signer_name,
    contract_ref: payload.contract_ref,
    invoice_ref: payload.invoice_ref,
    contract_sent_at: payload.contract_sent_at,
    contract_signed_at: payload.contract_signed_at,
    invoice_sent_at: payload.invoice_sent_at,
    paid_at: payload.paid_at,
  }

  const { error: updateError } = await supabase
    .from("leads")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payload.lead_id)
    .eq("status", "interested")
    .eq("closing_stage", "won_pending")

  if (updateError) {
    return {
      status: "error",
      message: "Não foi possível salvar. Tente novamente.",
    }
  }

  return {
    status: "success",
    message: "Dados do acordo salvos.",
    patch,
  }
}
