"use server"

import {
  encryptSecret,
  isBriefingSecretKind,
  isSecretsKeyConfigured,
} from "@/lib/briefing/secrets"
import { touchBriefingContentUpdatedAt } from "@/lib/briefing/touch-content"
import {
  readBriefingClientId,
  requireBriefingWriter,
  stripBriefingClientId,
} from "@/lib/briefing/writer"
import {
  briefingSecretDeleteSchema,
  briefingSecretUpsertSchema,
} from "@/lib/validations/briefing-accesses"

export type SaveBriefingSecretState =
  | { status: "success"; kind: string; updatedAt: string }
  | { status: "error"; message: string }
  | { status: "unauthenticated" }

export async function upsertBriefingSecret(
  input: unknown,
): Promise<SaveBriefingSecretState> {
  const loaded = await requireBriefingWriter(readBriefingClientId(input))
  if (loaded.status !== "ok") return loaded

  if (!isSecretsKeyConfigured()) {
    return {
      status: "error",
      message: "Criptografia de acessos não configurada.",
    }
  }

  const parsed = briefingSecretUpsertSchema.safeParse(
    stripBriefingClientId(input),
  )
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revise os dados.",
    }
  }

  const { kind, password } = parsed.data
  if (!isBriefingSecretKind(kind)) {
    return { status: "error", message: "Tipo de segredo inválido." }
  }

  let encrypted: ReturnType<typeof encryptSecret>
  try {
    encrypted = encryptSecret(password)
  } catch {
    return {
      status: "error",
      message: "Não foi possível salvar a senha.",
    }
  }

  const { client, admin } = loaded.context
  const now = new Date().toISOString()

  const { data: existing, error: loadError } = await admin
    .from("client_briefing_secrets")
    .select("id")
    .eq("client_id", client.id)
    .eq("kind", kind)
    .maybeSingle()

  if (loadError) {
    return { status: "error", message: "Não foi possível salvar a senha." }
  }

  if (existing) {
    const { error } = await admin
      .from("client_briefing_secrets")
      .update({
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        updated_at: now,
      })
      .eq("id", existing.id)

    if (error) {
      return { status: "error", message: "Não foi possível salvar a senha." }
    }
  } else {
    const { error } = await admin.from("client_briefing_secrets").insert({
      client_id: client.id,
      kind,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      updated_at: now,
    })

    if (error) {
      return { status: "error", message: "Não foi possível salvar a senha." }
    }
  }

  await touchBriefingContentUpdatedAt(admin, client.id)

  return { status: "success", kind, updatedAt: now }
}

export async function deleteBriefingSecret(
  input: unknown,
): Promise<SaveBriefingSecretState> {
  const loaded = await requireBriefingWriter(readBriefingClientId(input))
  if (loaded.status !== "ok") return loaded

  const parsed = briefingSecretDeleteSchema.safeParse(
    stripBriefingClientId(input),
  )
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revise os dados.",
    }
  }

  const { kind } = parsed.data
  const { client, admin } = loaded.context
  const now = new Date().toISOString()

  const { error } = await admin
    .from("client_briefing_secrets")
    .delete()
    .eq("client_id", client.id)
    .eq("kind", kind)

  if (error) {
    return { status: "error", message: "Não foi possível remover a senha." }
  }

  await touchBriefingContentUpdatedAt(admin, client.id)

  return { status: "success", kind, updatedAt: now }
}
