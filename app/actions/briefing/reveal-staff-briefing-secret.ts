"use server"

import { z } from "zod"
import {
  decryptSecret,
  isBriefingSecretKind,
  isSecretsKeyConfigured,
} from "@/lib/briefing/secrets"
import { denyUnlessCanManage, loadStaffClient } from "@/lib/clients/staff"
import { createAdminClient } from "@/lib/supabase/admin"

export type RevealStaffBriefingSecretState =
  | { status: "success"; kind: string; value: string }
  | { status: "error"; message: string }

export async function revealStaffBriefingSecret(
  clientId: string,
  kind: string,
): Promise<RevealStaffBriefingSecretState> {
  const parsedId = z.uuid().safeParse(clientId)
  if (!parsedId.success) {
    return { status: "error", message: "Cliente inválido." }
  }
  if (!isBriefingSecretKind(kind)) {
    return { status: "error", message: "Tipo de segredo inválido." }
  }
  if (!isSecretsKeyConfigured()) {
    return {
      status: "error",
      message: "Criptografia de acessos não configurada.",
    }
  }

  const loaded = await loadStaffClient(parsedId.data)
  if (loaded.status === "error") return loaded
  const denied = denyUnlessCanManage(loaded.context)
  if (denied) return denied

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("client_briefing_secrets")
    .select("ciphertext, iv")
    .eq("client_id", loaded.context.client.id)
    .eq("kind", kind)
    .maybeSingle()

  if (error) {
    return {
      status: "error",
      message: "Não foi possível revelar o segredo.",
    }
  }
  if (
    !data ||
    typeof data.ciphertext !== "string" ||
    typeof data.iv !== "string"
  ) {
    return { status: "error", message: "Segredo não encontrado." }
  }

  try {
    const value = decryptSecret(data.ciphertext, data.iv)
    return { status: "success", kind, value }
  } catch {
    return {
      status: "error",
      message: "Não foi possível revelar o segredo.",
    }
  }
}
