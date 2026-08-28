"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { toLeadBoardItem, type LeadBoardItem } from "@/lib/leads/board-item"
import { DIGITAL_CHANNEL_TAKEN_MESSAGE } from "@/lib/leads/digital-channels"
import { parseTagNames } from "@/lib/leads/tags"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import {
  leadFieldsSchema,
  readLeadFormFields,
  type LeadFieldName,
} from "@/lib/validations/lead"
import { findChannelConflict, syncLeadChannels } from "./sync-lead-channels"
import { ensureSegment } from "./sync-lead-segment"
import { syncLeadTags } from "./sync-lead-tags"

export type CreateLeadState =
  | {
      status: "success"
      message: string
      item: LeadBoardItem
    }
  | {
      status: "error"
      message?: string
      existingLeadId?: string
      fieldErrors?: Partial<Record<LeadFieldName, string[]>>
    }

export async function createLead(formData: FormData): Promise<CreateLeadState> {
  const { user } = await requireCommercialMember()
  const fields = readLeadFormFields(formData)
  const parsed = leadFieldsSchema.safeParse(fields)

  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: parsed.error.flatten().fieldErrors as Partial<
        Record<LeadFieldName, string[]>
      >,
    }
  }

  const payload = parsed.data
  const supabase = await createClient()
  const conflict = await findChannelConflict(supabase, payload.channels)
  if (conflict.status === "error") {
    return {
      status: "error",
      message: "Não foi possível cadastrar o lead. Tente novamente.",
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

  const { data, error } = await supabase
    .from("leads")
    .insert({
      company_name: payload.company_name,
      website: payload.website,
      website_domain: payload.website_domain,
      contact_name: payload.contact_name,
      phone: payload.phone,
      email: payload.email,
      segment_id: segment.id,
      state_code: payload.state_code,
      city: payload.city,
      status: "new",
      assigned_sdr_id: null,
      created_by: user.id,
    })
    .select(
      "id, company_name, website, website_domain, status, next_follow_up_at, created_at, assigned_sdr_id, assigned_closer_id, closing_meeting_at, state_code, city, segments(name)",
    )
    .single()

  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("leads")
        .select("id")
        .eq("website_domain", payload.website_domain)
        .maybeSingle()

      return {
        status: "error",
        message: DIGITAL_CHANNEL_TAKEN_MESSAGE.website,
        existingLeadId: existing?.id,
      }
    }

    return {
      status: "error",
      message: "Não foi possível cadastrar o lead. Tente novamente.",
    }
  }

  const synced = await syncLeadChannels(supabase, data.id, payload.channels)
  if (synced.status !== "ok") {
    try {
      await createAdminClient().from("leads").delete().eq("id", data.id)
    } catch {}
    if (synced.status === "conflict") {
      return {
        status: "error",
        message: synced.message,
        existingLeadId: synced.existingLeadId || undefined,
      }
    }
    return {
      status: "error",
      message: "Não foi possível cadastrar o lead. Tente novamente.",
    }
  }

  const tags = await syncLeadTags(
    supabase,
    data.id,
    parseTagNames(fields.tags),
  )
  const item = toLeadBoardItem(data, {
    tags: tags ?? [],
    segment: segment,
    state_code: payload.state_code,
    city: payload.city,
  })
  if (!item) {
    return {
      status: "error",
      message: "Não foi possível cadastrar o lead. Tente novamente.",
    }
  }

  if (!tags) {
    return {
      status: "success",
      message: "Lead cadastrado, mas as tags não foram salvas.",
      item,
    }
  }

  return { status: "success", message: "Lead cadastrado.", item }
}
