"use server"

import {
  emptyClosingPayload,
  isClosingReadyToComplete,
} from "@/lib/briefing/closing"
import { BRIEFING_STEP_CLOSING } from "@/lib/briefing/steps"
import { touchBriefingContentUpdatedAt } from "@/lib/briefing/touch-content"
import {
  readBriefingClientId,
  requireBriefingWriter,
  stripBriefingClientId,
  withBriefingClientId,
} from "@/lib/briefing/writer"
import {
  briefingClosingPayloadSchema,
  toClosingPayload,
} from "@/lib/validations/briefing-closing"

export type SaveBriefingClosingState =
  | {
      status: "success"
      updatedAt: string
      completedAt: string | null
      finalizedAt?: string | null
    }
  | { status: "error"; message: string }
  | { status: "unauthenticated" }

export async function saveBriefingClosing(
  input: unknown,
): Promise<SaveBriefingClosingState> {
  const loaded = await requireBriefingWriter(readBriefingClientId(input))
  if (loaded.status !== "ok") return loaded

  const parsed = briefingClosingPayloadSchema.safeParse(
    stripBriefingClientId(input),
  )
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revise os dados.",
    }
  }

  const payload = toClosingPayload(parsed.data)
  const { client, admin } = loaded.context
  const now = new Date().toISOString()

  const { data: existing, error: loadError } = await admin
    .from("client_briefing_steps")
    .select("id, completed_at")
    .eq("client_id", client.id)
    .eq("step", BRIEFING_STEP_CLOSING)
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
        typeof existing.completed_at === "string"
          ? existing.completed_at
          : null,
    }
  }

  const { error } = await admin.from("client_briefing_steps").insert({
    client_id: client.id,
    step: BRIEFING_STEP_CLOSING,
    payload,
    source_snapshot: emptyClosingPayload(),
    updated_at: now,
  })

  if (error) {
    return { status: "error", message: "Não foi possível salvar." }
  }

  await touchBriefingContentUpdatedAt(admin, client.id)

  return { status: "success", updatedAt: now, completedAt: null }
}

export async function completeBriefingClosing(
  input: unknown,
): Promise<SaveBriefingClosingState> {
  const clientId = readBriefingClientId(input)
  const parsed = briefingClosingPayloadSchema.safeParse(
    stripBriefingClientId(input),
  )
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revise os dados.",
    }
  }

  const payload = toClosingPayload(parsed.data)
  if (!isClosingReadyToComplete(payload)) {
    return {
      status: "error",
      message: "Complete todos os campos obrigatórios para finalizar.",
    }
  }

  const saved = await saveBriefingClosing(
    withBriefingClientId(payload, clientId),
  )
  if (saved.status !== "success") return saved

  const again = await requireBriefingWriter(clientId)
  if (again.status !== "ok") return again

  const { client, admin } = again.context
  const now = new Date().toISOString()

  const { error: stepError } = await admin
    .from("client_briefing_steps")
    .update({
      completed_at: now,
      updated_at: now,
    })
    .eq("client_id", client.id)
    .eq("step", BRIEFING_STEP_CLOSING)

  if (stepError) {
    return { status: "error", message: "Não foi possível concluir a etapa." }
  }

  const { data: clientRow, error: clientLoadError } = await admin
    .from("clients")
    .select("briefing_finalized_at")
    .eq("id", client.id)
    .maybeSingle()

  if (clientLoadError) {
    return {
      status: "error",
      message: "Não foi possível finalizar o briefing.",
    }
  }

  const existingFinalizedAt =
    clientRow && typeof clientRow.briefing_finalized_at === "string"
      ? clientRow.briefing_finalized_at
      : null

  let finalizedAt = existingFinalizedAt
  if (!existingFinalizedAt) {
    const { error: finalizeError } = await admin
      .from("clients")
      .update({ briefing_finalized_at: now })
      .eq("id", client.id)
      .is("briefing_finalized_at", null)

    if (finalizeError) {
      return {
        status: "error",
        message: "Não foi possível finalizar o briefing.",
      }
    }
    finalizedAt = now
  }

  return {
    status: "success",
    updatedAt: now,
    completedAt: now,
    finalizedAt,
  }
}
