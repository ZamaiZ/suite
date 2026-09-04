"use server"

import {
  emptyAudiencePayload,
  isAudienceReadyToComplete,
} from "@/lib/briefing/audience"
import { BRIEFING_STEP_AUDIENCE } from "@/lib/briefing/steps"
import { touchBriefingContentUpdatedAt } from "@/lib/briefing/touch-content"
import {
  readBriefingClientId,
  requireBriefingWriter,
  stripBriefingClientId,
  withBriefingClientId,
} from "@/lib/briefing/writer"
import {
  briefingAudiencePayloadSchema,
  toAudiencePayload,
} from "@/lib/validations/briefing-audience"

export type SaveBriefingAudienceState =
  | { status: "success"; updatedAt: string; completedAt: string | null }
  | { status: "error"; message: string }
  | { status: "unauthenticated" }

export async function saveBriefingAudience(
  input: unknown,
): Promise<SaveBriefingAudienceState> {
  const loaded = await requireBriefingWriter(readBriefingClientId(input))
  if (loaded.status !== "ok") return loaded

  const parsed = briefingAudiencePayloadSchema.safeParse(
    stripBriefingClientId(input),
  )
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revise os dados.",
    }
  }

  const payload = toAudiencePayload(parsed.data)
  const { client, admin } = loaded.context
  const now = new Date().toISOString()

  const { data: existing, error: loadError } = await admin
    .from("client_briefing_steps")
    .select("id, completed_at")
    .eq("client_id", client.id)
    .eq("step", BRIEFING_STEP_AUDIENCE)
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
    step: BRIEFING_STEP_AUDIENCE,
    payload,
    source_snapshot: emptyAudiencePayload(),
    updated_at: now,
  })

  if (error) {
    return { status: "error", message: "Não foi possível salvar." }
  }

  await touchBriefingContentUpdatedAt(admin, client.id)

  return { status: "success", updatedAt: now, completedAt: null }
}

export async function completeBriefingAudience(
  input: unknown,
): Promise<SaveBriefingAudienceState> {
  const clientId = readBriefingClientId(input)
  const parsed = briefingAudiencePayloadSchema.safeParse(
    stripBriefingClientId(input),
  )
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revise os dados.",
    }
  }

  const payload = toAudiencePayload(parsed.data)
  if (!isAudienceReadyToComplete(payload)) {
    return {
      status: "error",
      message: "Complete todos os campos obrigatórios para avançar.",
    }
  }

  const saved = await saveBriefingAudience(
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
    .eq("step", BRIEFING_STEP_AUDIENCE)

  if (error) {
    return { status: "error", message: "Não foi possível concluir a etapa." }
  }

  return { status: "success", updatedAt: now, completedAt: now }
}
