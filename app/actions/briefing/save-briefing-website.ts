"use server"

import {
  clearedStoragePaths,
  emptyWebsitePayload,
  isWebsiteReadyToComplete,
  parseWebsitePayload,
  sanitizeWebsitePayload,
} from "@/lib/briefing/website"
import { BRIEFING_STEP_WEBSITE } from "@/lib/briefing/steps"
import { touchBriefingContentUpdatedAt } from "@/lib/briefing/touch-content"
import {
  readBriefingClientId,
  requireBriefingWriter,
  stripBriefingClientId,
  withBriefingClientId,
} from "@/lib/briefing/writer"
import {
  briefingWebsitePayloadSchema,
  toWebsitePayload,
} from "@/lib/validations/briefing-website"
import { BRIEFING_ASSETS_BUCKET } from "@/lib/briefing/website"

export type SaveBriefingWebsiteState =
  | { status: "success"; updatedAt: string; completedAt: string | null }
  | { status: "error"; message: string }
  | { status: "unauthenticated" }

export async function saveBriefingWebsite(
  input: unknown,
): Promise<SaveBriefingWebsiteState> {
  const loaded = await requireBriefingWriter(readBriefingClientId(input))
  if (loaded.status !== "ok") return loaded

  const parsed = briefingWebsitePayloadSchema.safeParse(
    stripBriefingClientId(input),
  )
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revise os dados.",
    }
  }

  const payload = toWebsitePayload(parsed.data)
  const { client, admin } = loaded.context
  const now = new Date().toISOString()

  const { data: existing, error: loadError } = await admin
    .from("client_briefing_steps")
    .select("id, payload, completed_at")
    .eq("client_id", client.id)
    .eq("step", BRIEFING_STEP_WEBSITE)
    .maybeSingle()

  if (loadError) {
    return { status: "error", message: "Não foi possível salvar." }
  }

  if (existing) {
    const previous = parseWebsitePayload(existing.payload)
    const orphanPaths = clearedStoragePaths(previous, payload)
    if (orphanPaths.length > 0) {
      await admin.storage.from(BRIEFING_ASSETS_BUCKET).remove(orphanPaths)
    }

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
    step: BRIEFING_STEP_WEBSITE,
    payload,
    source_snapshot: emptyWebsitePayload(),
    updated_at: now,
  })

  if (error) {
    return { status: "error", message: "Não foi possível salvar." }
  }

  await touchBriefingContentUpdatedAt(admin, client.id)

  return { status: "success", updatedAt: now, completedAt: null }
}

export async function completeBriefingWebsite(
  input: unknown,
): Promise<SaveBriefingWebsiteState> {
  const clientId = readBriefingClientId(input)
  const parsed = briefingWebsitePayloadSchema.safeParse(
    stripBriefingClientId(input),
  )
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revise os dados.",
    }
  }

  const payload = sanitizeWebsitePayload(toWebsitePayload(parsed.data))

  if (!isWebsiteReadyToComplete(payload)) {
    return {
      status: "error",
      message: "Complete todos os campos obrigatórios para avançar.",
    }
  }

  const saved = await saveBriefingWebsite(
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
    .eq("step", BRIEFING_STEP_WEBSITE)

  if (error) {
    return { status: "error", message: "Não foi possível concluir a etapa." }
  }

  return { status: "success", updatedAt: now, completedAt: now }
}
