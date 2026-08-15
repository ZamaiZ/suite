"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { parseTagNames, type LeadTag } from "@/lib/leads/tags"
import { createClient } from "@/lib/supabase/server"
import type { LeadWritePayload } from "@/lib/leads/types"
import {
  leadFieldsSchema,
  readLeadFormFields,
  updateLeadSchema,
  type LeadFieldName,
} from "@/lib/validations/lead"
import { syncLeadTags } from "./sync-lead-tags"

export type UpdateLeadState =
  | {
      status: "success"
      message: string
      fields: LeadWritePayload
      tags: LeadTag[]
    }
  | {
      status: "error"
      message?: string
      existingLeadId?: string
      fieldErrors?: Partial<Record<LeadFieldName, string[]>>
    }

export async function updateLead(formData: FormData): Promise<UpdateLeadState> {
  await requireCommercialMember()

  const idParsed = updateLeadSchema.safeParse({
    lead_id: formData.get("lead_id"),
  })
  const formFields = readLeadFormFields(formData)
  const fieldsParsed = leadFieldsSchema.safeParse(formFields)

  if (!idParsed.success || !fieldsParsed.success) {
    return {
      status: "error",
      message: "Revise os dados do lead.",
      fieldErrors: fieldsParsed.success
        ? undefined
        : (fieldsParsed.error.flatten().fieldErrors as Partial<
            Record<LeadFieldName, string[]>
          >),
    }
  }

  const payload = fieldsParsed.data
  const leadId = idParsed.data.lead_id
  const supabase = await createClient()
  const { error } = await supabase
    .from("leads")
    .update({
      company_name: payload.company_name,
      website: payload.website,
      website_domain: payload.website_domain,
      instagram: payload.instagram,
      linkedin: payload.linkedin,
      contact_name: payload.contact_name,
      phone: payload.phone,
      email: payload.email,
      observations: payload.observations,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId)

  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("leads")
        .select("id")
        .eq("website_domain", payload.website_domain)
        .neq("id", leadId)
        .maybeSingle()

      return {
        status: "error",
        message: "Este site já está cadastrado.",
        existingLeadId: existing?.id,
      }
    }

    return {
      status: "error",
      message: "Não foi possível atualizar o lead. Tente novamente.",
    }
  }

  const tags = await syncLeadTags(
    supabase,
    leadId,
    parseTagNames(formFields.tags),
  )
  if (!tags) {
    return {
      status: "error",
      message: "Não foi possível salvar as tags. Tente novamente.",
    }
  }

  return {
    status: "success",
    message: "Lead atualizado.",
    fields: payload,
    tags,
  }
}
