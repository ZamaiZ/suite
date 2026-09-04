"use server"

import {
  emptyHistoryPayload,
  isHistoryReadyToComplete,
} from "@/lib/briefing/history"
import { BRIEFING_STEP_HISTORY } from "@/lib/briefing/steps"
import { touchBriefingContentUpdatedAt } from "@/lib/briefing/touch-content"
import {
  readBriefingClientId,
  requireBriefingWriter,
  stripBriefingClientId,
  withBriefingClientId,
} from "@/lib/briefing/writer"
import {
  briefingHistoryPayloadSchema,
  toHistoryPayload,
} from "@/lib/validations/briefing-history"

export type SaveBriefingHistoryState =
  | { status: "success"; updatedAt: string; completedAt: string | null }
  | { status: "error"; message: string }
  | { status: "unauthenticated" }

export async function saveBriefingHistory(
  input: unknown,
): Promise<SaveBriefingHistoryState> {
  const loaded = await requireBriefingWriter(readBriefingClientId(input))
  if (loaded.status !== "ok") return loaded

  const parsed = briefingHistoryPayloadSchema.safeParse(
    stripBriefingClientId(input),
  )
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revise os dados.",
    }
  }

  const payload = toHistoryPayload(parsed.data)
  const { client, admin } = loaded.context
  const now = new Date().toISOString()

  const { data: existing, error: loadError } = await admin
    .from("client_briefing_steps")
    .select("id, completed_at")
    .eq("client_id", client.id)
    .eq("step", BRIEFING_STEP_HISTORY)
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

  const { error } = await admin.from("client_briefing_steps").insert({
    client_id: client.id,
    step: BRIEFING_STEP_HISTORY,
    payload,
    source_snapshot: emptyHistoryPayload(),
    updated_at: now,
  })

  if (error) {
    return { status: "error", message: "Não foi possível salvar." }
  }

  await touchBriefingContentUpdatedAt(admin, client.id)

  return { status: "success", updatedAt: now, completedAt: null }
}

export async function completeBriefingHistory(
  input: unknown,
): Promise<SaveBriefingHistoryState> {
  const clientId = readBriefingClientId(input)
  const parsed = briefingHistoryPayloadSchema.safeParse(
    stripBriefingClientId(input),
  )
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revise os dados.",
    }
  }

  const payload = toHistoryPayload(parsed.data)
  if (!isHistoryReadyToComplete(payload)) {
    return {
      status: "error",
      message: "Complete todos os campos obrigatórios para avançar.",
    }
  }

  const saved = await saveBriefingHistory(
    withBriefingClientId(payload, clientId),
  )
  if (saved.status !== "success") return saved

  const again = await requireBriefingWriter(clientId)
  if (again.status !== "ok") return again

  const now = new Date().toISOString()
  const { error } = await again.context.admin
    .from("client_briefing_steps")
    .update({
      completed_at: now,
      updated_at: now,
    })
    .eq("client_id", again.context.client.id)
    .eq("step", BRIEFING_STEP_HISTORY)

  if (error) {
    return { status: "error", message: "Não foi possível concluir a etapa." }
  }

  return { status: "success", updatedAt: now, completedAt: now }
}
