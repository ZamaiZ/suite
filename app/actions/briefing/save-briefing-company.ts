"use server"

import { isCompanyReadyToComplete } from "@/lib/briefing/company"
import { BRIEFING_STEP_COMPANY } from "@/lib/briefing/steps"
import { touchBriefingContentUpdatedAt } from "@/lib/briefing/touch-content"
import {
  readBriefingClientId,
  requireBriefingWriter,
  stripBriefingClientId,
  withBriefingClientId,
} from "@/lib/briefing/writer"
import {
  briefingCompanyPayloadSchema,
  toCompanyPayload,
} from "@/lib/validations/briefing-company"
import { prefillCompanyFromLead } from "@/lib/briefing/prefill"

export type SaveBriefingCompanyState =
  | { status: "success"; updatedAt: string; completedAt: string | null }
  | { status: "error"; message: string }
  | { status: "unauthenticated" }

export async function saveBriefingCompany(
  input: unknown,
): Promise<SaveBriefingCompanyState> {
  const loaded = await requireBriefingWriter(readBriefingClientId(input))
  if (loaded.status !== "ok") return loaded

  const parsed = briefingCompanyPayloadSchema.safeParse(
    stripBriefingClientId(input),
  )
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revise os dados.",
    }
  }

  const payload = toCompanyPayload(parsed.data)
  const { client, admin } = loaded.context
  const now = new Date().toISOString()

  const { data: existing, error: loadError } = await admin
    .from("client_briefing_steps")
    .select("id, source_snapshot, completed_at")
    .eq("client_id", client.id)
    .eq("step", BRIEFING_STEP_COMPANY)
    .maybeSingle()

  if (loadError) {
    return { status: "error", message: "Não foi possível salvar." }
  }

  if (existing) {
    const { error } = await admin
      .from("client_briefing_steps")
      .update({
        payload,
        updated_at: now,
      })
      .eq("id", existing.id)

    if (error) {
      return { status: "error", message: "Não foi possível salvar." }
    }

    await touchBriefingContentUpdatedAt(admin, client.id)

    return {
      status: "success",
      updatedAt: now,
      completedAt:
        typeof existing.completed_at === "string" ? existing.completed_at : null,
    }
  }

  const sourceSnapshot = await prefillCompanyFromLead(admin, client.lead_id)
  const { error } = await admin.from("client_briefing_steps").insert({
    client_id: client.id,
    step: BRIEFING_STEP_COMPANY,
    payload,
    source_snapshot: sourceSnapshot,
    updated_at: now,
  })

  if (error) {
    return { status: "error", message: "Não foi possível salvar." }
  }

  await touchBriefingContentUpdatedAt(admin, client.id)

  return { status: "success", updatedAt: now, completedAt: null }
}

export async function completeBriefingCompany(
  input: unknown,
): Promise<SaveBriefingCompanyState> {
  const clientId = readBriefingClientId(input)
  const parsed = briefingCompanyPayloadSchema.safeParse(
    stripBriefingClientId(input),
  )
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revise os dados.",
    }
  }

  const payload = toCompanyPayload(parsed.data)
  if (!isCompanyReadyToComplete(payload)) {
    return {
      status: "error",
      message: "Complete todos os campos obrigatórios para avançar.",
    }
  }

  const saved = await saveBriefingCompany(
    withBriefingClientId(payload, clientId),
  )
  if (saved.status !== "success") return saved

  const loaded = await requireBriefingWriter(clientId)
  if (loaded.status !== "ok") return loaded

  const now = new Date().toISOString()
  const { error } = await loaded.context.admin
    .from("client_briefing_steps")
    .update({
      completed_at: now,
      updated_at: now,
    })
    .eq("client_id", loaded.context.client.id)
    .eq("step", BRIEFING_STEP_COMPANY)

  if (error) {
    return { status: "error", message: "Não foi possível concluir a etapa." }
  }

  return { status: "success", updatedAt: now, completedAt: now }
}
