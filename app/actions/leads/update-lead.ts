"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { canViewLead } from "@/lib/leads/access"
import { DIGITAL_CHANNEL_TAKEN_MESSAGE } from "@/lib/leads/digital-channels"
import type { LeadSegment } from "@/lib/leads/segments"
import { parseTagNames, type LeadTag } from "@/lib/leads/tags"
import { createClient } from "@/lib/supabase/server"
import type { LeadWritePayload } from "@/lib/leads/types"
import {
  leadFieldsSchema,
  readLeadFormFields,
  updateLeadSchema,
  type LeadFieldName,
} from "@/lib/validations/lead"
import { findChannelConflict, syncLeadChannels } from "./sync-lead-channels"
import { ensureSegment } from "./sync-lead-segment"
import { syncLeadTags } from "./sync-lead-tags"

export type UpdateLeadState =
  | {
      status: "success"
      message: string
      fields: LeadWritePayload
      tags: LeadTag[]
      segment: LeadSegment
    }
  | {
      status: "error"
      message?: string
      existingLeadId?: string
      fieldErrors?: Partial<Record<LeadFieldName, string[]>>
    }

export async function updateLead(formData: FormData): Promise<UpdateLeadState> {
  const { user, roles } = await requireCommercialMember()

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
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("status, assigned_sdr_id, assigned_closer_id")
    .eq("id", leadId)
    .maybeSingle()

  if (
    leadError ||
    !lead ||
    !canViewLead(lead, user.id, roles) ||
    lead.status === "converted"
  ) {
    return {
      status: "error",
      message: "Este lead não pode ser alterado.",
    }
  }

  const conflict = await findChannelConflict(supabase, payload.channels, leadId)
  if (conflict.status === "error") {
    return {
      status: "error",
      message: "Não foi possível atualizar o lead. Tente novamente.",
    }
  }
  if (conflict.status === "conflict") {
    return {
      status: "error",
      message: DIGITAL_CHANNEL_TAKEN_MESSAGE[conflict.type],
      existingLeadId: conflict.existingLeadId,
    }
  }

  const segment = await ensureSegment(supabase, payload.segment)
  if (!segment) {
    return {
      status: "error",
      message: "Não foi possível salvar o segmento. Tente novamente.",
    }
  }

  const { error } = await supabase
    .from("leads")
    .update({
      company_name: payload.company_name,
      website: payload.website,
      website_domain: payload.website_domain,
      contact_name: payload.contact_name,
      phone: payload.phone,
      email: payload.email,
      observations: payload.observations,
      segment_id: segment.id,
      state_code: payload.state_code,
      city: payload.city,
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
        message: DIGITAL_CHANNEL_TAKEN_MESSAGE.website,
        existingLeadId: existing?.id,
      }
    }

    return {
      status: "error",
      message: "Não foi possível atualizar o lead. Tente novamente.",
    }
  }

  const synced = await syncLeadChannels(supabase, leadId, payload.channels)
  if (synced.status === "conflict") {
    return {
      status: "error",
      message: synced.message,
      existingLeadId: synced.existingLeadId || undefined,
    }
  }
  if (synced.status !== "ok") {
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
    fields: { ...payload, channels: synced.channels },
    tags,
    segment,
  }
}
