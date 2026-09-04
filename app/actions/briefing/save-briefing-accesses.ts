"use server"

import {
  emptyAccessesPayload,
  isAccessesReadyToComplete,
  secretKindsAllowedToKeep,
  type BriefingSecretFlags,
} from "@/lib/briefing/accesses"
import { BRIEFING_STEP_ACCESSES } from "@/lib/briefing/steps"
import { touchBriefingContentUpdatedAt } from "@/lib/briefing/touch-content"
import {
  readBriefingClientId,
  requireBriefingWriter,
  stripBriefingClientId,
  withBriefingClientId,
  type BriefingWriterContext,
} from "@/lib/briefing/writer"
import {
  briefingAccessesPayloadSchema,
  toAccessesPayload,
} from "@/lib/validations/briefing-accesses"

export type SaveBriefingAccessesState =
  | { status: "success"; updatedAt: string; completedAt: string | null }
  | { status: "error"; message: string }
  | { status: "unauthenticated" }

async function loadSecretFlags(
  admin: BriefingWriterContext["admin"],
  clientId: string,
): Promise<BriefingSecretFlags | null> {
  const { data, error } = await admin
    .from("client_briefing_secrets")
    .select("kind")
    .eq("client_id", clientId)

  if (error) return null

  const flags: BriefingSecretFlags = {}
  for (const row of data ?? []) {
    if (typeof row.kind === "string" && row.kind.length > 0) {
      flags[row.kind] = true
    }
  }
  return flags
}

async function purgeOrphanSecrets(
  admin: BriefingWriterContext["admin"],
  clientId: string,
  keep: Set<string>,
): Promise<boolean> {
  const { data, error } = await admin
    .from("client_briefing_secrets")
    .select("kind")
    .eq("client_id", clientId)

  if (error) return false

  const orphanKinds = (data ?? [])
    .map((row) => row.kind)
    .filter(
      (kind): kind is string => typeof kind === "string" && !keep.has(kind),
    )

  if (orphanKinds.length === 0) return true

  const { error: deleteError } = await admin
    .from("client_briefing_secrets")
    .delete()
    .eq("client_id", clientId)
    .in("kind", orphanKinds)

  return !deleteError
}

export async function saveBriefingAccesses(
  input: unknown,
): Promise<SaveBriefingAccessesState> {
  const loaded = await requireBriefingWriter(readBriefingClientId(input))
  if (loaded.status !== "ok") return loaded

  const parsed = briefingAccessesPayloadSchema.safeParse(
    stripBriefingClientId(input),
  )
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revise os dados.",
    }
  }

  const payload = toAccessesPayload(parsed.data)
  const { client, admin } = loaded.context
  const now = new Date().toISOString()

  const { data: existing, error: loadError } = await admin
    .from("client_briefing_steps")
    .select("id, completed_at")
    .eq("client_id", client.id)
    .eq("step", BRIEFING_STEP_ACCESSES)
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
  } else {
    const { error } = await admin.from("client_briefing_steps").insert({
      client_id: client.id,
      step: BRIEFING_STEP_ACCESSES,
      payload,
      source_snapshot: emptyAccessesPayload(),
      updated_at: now,
    })

    if (error) {
      return { status: "error", message: "Não foi possível salvar." }
    }
  }

  const purged = await purgeOrphanSecrets(
    admin,
    client.id,
    secretKindsAllowedToKeep(payload),
  )
  if (!purged) {
    return { status: "error", message: "Não foi possível salvar." }
  }

  await touchBriefingContentUpdatedAt(admin, client.id)

  return {
    status: "success",
    updatedAt: now,
    completedAt:
      existing && typeof existing.completed_at === "string"
        ? existing.completed_at
        : null,
  }
}

export async function completeBriefingAccesses(
  input: unknown,
): Promise<SaveBriefingAccessesState> {
  const clientId = readBriefingClientId(input)
  const loaded = await requireBriefingWriter(clientId)
  if (loaded.status !== "ok") return loaded

  const parsed = briefingAccessesPayloadSchema.safeParse(
    stripBriefingClientId(input),
  )
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revise os dados.",
    }
  }

  const payload = toAccessesPayload(parsed.data)
  const flags = await loadSecretFlags(
    loaded.context.admin,
    loaded.context.client.id,
  )
  if (!flags) {
    return { status: "error", message: "Não foi possível salvar." }
  }

  if (!isAccessesReadyToComplete(payload, flags)) {
    return {
      status: "error",
      message: "Complete todos os campos obrigatórios para avançar.",
    }
  }

  const saved = await saveBriefingAccesses(
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
    .eq("step", BRIEFING_STEP_ACCESSES)

  if (error) {
    return { status: "error", message: "Não foi possível concluir a etapa." }
  }

  return { status: "success", updatedAt: now, completedAt: now }
}
