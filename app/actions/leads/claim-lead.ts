"use server"

import { z } from "zod"
import { requireCommercialMember } from "@/lib/auth/session"
import { readEmbeddedName, type LeadBoardItem } from "@/lib/leads/board-item"
import { createClient } from "@/lib/supabase/server"

const leadIdSchema = z.object({
  lead_id: z.uuid("Lead inválido."),
})

export type LeadAssignmentPatch = Pick<
  LeadBoardItem,
  "assigned_sdr_id" | "status" | "assignee_name" | "next_follow_up_at" | "from_denial"
>

export type ClaimLeadState =
  | { status: "success"; message: string; patch: LeadAssignmentPatch }
  | { status: "error"; message: string }

export async function claimLead(formData: FormData): Promise<ClaimLeadState> {
  const { user } = await requireCommercialMember()
  const parsed = leadIdSchema.safeParse({ lead_id: formData.get("lead_id") })

  if (!parsed.success) {
    return { status: "error", message: "Lead inválido." }
  }

  const leadId = parsed.data.lead_id
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("leads")
    .update({
      assigned_sdr_id: user.id,
      status: "contacting",
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId)
    .is("assigned_sdr_id", null)
    .eq("status", "new")
    .select("assigned_sdr_id, status, users!assigned_sdr_id(name)")
    .maybeSingle()

  if (error) {
    return {
      status: "error",
      message: "Não foi possível reivindicar o lead. Tente novamente.",
    }
  }

  if (!data) {
    return {
      status: "error",
      message: "Este lead já foi reivindicado.",
    }
  }

  return {
    status: "success",
    message: "Lead atribuído a você.",
    patch: {
      assigned_sdr_id: data.assigned_sdr_id,
      status: "contacting",
      assignee_name: readEmbeddedName(
        data.users as { name: string } | { name: string }[] | null,
      ),
      next_follow_up_at: null,
      from_denial: false,
    },
  }
}

export async function unclaimLead(formData: FormData): Promise<ClaimLeadState> {
  await requireCommercialMember()
  const parsed = leadIdSchema.safeParse({ lead_id: formData.get("lead_id") })

  if (!parsed.success) {
    return { status: "error", message: "Lead inválido." }
  }

  const leadId = parsed.data.lead_id
  const supabase = await createClient()
  const { data: lead, error: loadError } = await supabase
    .from("leads")
    .select("id, status, assigned_sdr_id")
    .eq("id", leadId)
    .maybeSingle()

  if (loadError) {
    return {
      status: "error",
      message: "Não foi possível devolver o lead. Tente novamente.",
    }
  }

  if (!lead) {
    return { status: "error", message: "Lead não encontrado." }
  }

  if (lead.status === "interested") {
    return {
      status: "error",
      message: "Lead com interesse não volta para a fila.",
    }
  }

  if (!lead.assigned_sdr_id) {
    return { status: "error", message: "Este lead já está na fila." }
  }

  const { error } = await supabase
    .from("leads")
    .update({
      assigned_sdr_id: null,
      status: "new",
      next_follow_up_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId)
    .not("assigned_sdr_id", "is", null)
    .neq("status", "interested")

  if (error) {
    return {
      status: "error",
      message: "Não foi possível devolver o lead. Tente novamente.",
    }
  }

  return {
    status: "success",
    message: "Lead devolvido à fila.",
    patch: {
      assigned_sdr_id: null,
      status: "new",
      assignee_name: null,
      next_follow_up_at: null,
      from_denial: false,
    },
  }
}
