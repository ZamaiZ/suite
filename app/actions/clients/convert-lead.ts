"use server"

import { revalidatePath } from "next/cache"
import { requireCommercialMember } from "@/lib/auth/session"
import { canViewClient, createPortalAccess } from "@/lib/clients/access"
import { buildPortalUrl } from "@/lib/clients/portal-session"
import { canConvertClosing, isClosingStage } from "@/lib/leads/closing"
import { isLeadStatus } from "@/lib/leads/status"
import { createClient } from "@/lib/supabase/server"
import {
  convertLeadSchema,
  isValidTaxId,
  readConvertLeadFormFields,
} from "@/lib/validations/lead-closing"

export type ConvertLeadState =
  | {
      status: "success"
      message: string
      clientId: string
      portalCode: string
      portalUrl: string
      patch: {
        status: "converted"
        closing_stage: null
        client_id: string
        converted_at: string
        can_view_client: boolean
      }
    }
  | { status: "error"; message: string }

export async function convertLeadToClient(
  formData: FormData,
): Promise<ConvertLeadState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = convertLeadSchema.safeParse(
    readConvertLeadFormFields(formData),
  )

  if (!parsed.success) {
    return { status: "error", message: "Lead inválido." }
  }

  const leadId = parsed.data.lead_id
  const supabase = await createClient()
  const { data: lead, error: loadError } = await supabase
    .from("leads")
    .select(
      "id, status, company_name, assigned_sdr_id, assigned_closer_id, closing_stage, legal_name, tax_id, signer_name, contract_signed_at, paid_at",
    )
    .eq("id", leadId)
    .maybeSingle()

  if (loadError) {
    return {
      status: "error",
      message: "Não foi possível converter. Tente novamente.",
    }
  }

  if (!lead) {
    return { status: "error", message: "Lead não encontrado." }
  }

  if (!isLeadStatus(lead.status) || !isClosingStage(lead.closing_stage)) {
    return { status: "error", message: "Lead inválido para conversão." }
  }

  if (
    !canConvertClosing(
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
      message: "Você não pode converter este acordo.",
    }
  }

  if (!lead.legal_name?.trim()) {
    return { status: "error", message: "Informe a razão social." }
  }
  if (!lead.tax_id || !isValidTaxId(lead.tax_id)) {
    return { status: "error", message: "Informe um CPF ou CNPJ válido." }
  }
  if (!lead.signer_name?.trim()) {
    return { status: "error", message: "Informe o nome do signatário." }
  }
  if (!lead.contract_signed_at) {
    return {
      status: "error",
      message: "Marque a data de assinatura do contrato.",
    }
  }
  if (!lead.paid_at) {
    return { status: "error", message: "Marque a data de pagamento." }
  }

  let issued: ReturnType<typeof createPortalAccess>
  try {
    issued = createPortalAccess()
  } catch {
    return {
      status: "error",
      message:
        "Acesso do cliente não configurado. Defina CLIENT_PORTAL_PEPPER.",
    }
  }

  const generatedAt = new Date().toISOString()
  const { data: client, error: insertError } = await supabase
    .from("clients")
    .insert({
      lead_id: lead.id,
      company_name: lead.company_name,
      closer_id: lead.assigned_closer_id,
      stage: "initial",
      portal_slug: issued.slug,
      portal_code_hash: issued.hash,
      portal_code_generated_at: generatedAt,
      converted_at: generatedAt,
      // Ancora o "antes" da auditoria no momento da venda: sem isso, o
      // comparativo futuro usaria a ultima coleta manual, qualquer que fosse
      // a data dela.
      baseline_at: generatedAt,
    })
    .select("id, converted_at")
    .single()

  if (insertError || !client) {
    if (insertError?.code === "23505") {
      return { status: "error", message: "Este lead já foi convertido." }
    }
    return {
      status: "error",
      message: "Não foi possível criar o cliente. Tente novamente.",
    }
  }

  const { data: updatedLead, error: updateError } = await supabase
    .from("leads")
    .update({
      status: "converted",
      closing_stage: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId)
    .eq("status", "interested")
    .eq("closing_stage", "won_pending")
    .select("id")
    .maybeSingle()

  if (updateError || !updatedLead) {
    await supabase.from("clients").delete().eq("id", client.id)
    return {
      status: "error",
      message:
        "O cliente foi criado, mas o lead não consolidou. Tente novamente.",
    }
  }

  revalidatePath("/leads")
  revalidatePath("/clients")

  return {
    status: "success",
    message: "Cliente consolidado.",
    clientId: client.id,
    portalCode: issued.code,
    portalUrl: await buildPortalUrl(issued.slug),
    patch: {
      status: "converted",
      closing_stage: null,
      client_id: client.id,
      converted_at: client.converted_at,
      can_view_client: canViewClient(roles, user.id, lead.assigned_closer_id),
    },
  }
}
