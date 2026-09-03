"use server"

import { revalidatePath } from "next/cache"
import {
  generatePortalCode,
  hashPortalCode,
} from "@/lib/clients/access"
import { buildPortalUrl } from "@/lib/clients/portal-session"
import {
  rotatePortalAccessSchema,
  readClientIdField,
} from "@/lib/validations/client-portal"
import { denyUnlessCanManage, loadStaffClient } from "@/lib/clients/staff"

export type RotatePortalAccessState =
  | { status: "success"; code: string; url: string }
  | { status: "error"; message: string }

export async function rotatePortalAccess(
  formData: FormData,
): Promise<RotatePortalAccessState> {
  const parsed = rotatePortalAccessSchema.safeParse(readClientIdField(formData))
  if (!parsed.success) {
    return { status: "error", message: "Cliente inválido." }
  }

  const loaded = await loadStaffClient(parsed.data.client_id)
  if (loaded.status === "error") return loaded
  const denied = denyUnlessCanManage(loaded.context)
  if (denied) return denied

  const { client, supabase, user } = loaded.context
  if (!client.portal_slug || !client.portal_code_hash) {
    return {
      status: "error",
      message: "Este cliente ainda não possui acesso. Gere o código primeiro.",
    }
  }

  let code: string
  let hash: string
  try {
    code = generatePortalCode()
    hash = hashPortalCode(code)
  } catch {
    return {
      status: "error",
      message:
        "Acesso do cliente não configurado. Defina CLIENT_PORTAL_PEPPER.",
    }
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from("clients")
    .update({
      portal_code_hash: hash,
      portal_code_rotated_at: now,
      portal_code_rotated_by: user.id,
      portal_session_version: client.portal_session_version + 1,
      portal_auth_failures: 0,
      portal_locked_until: null,
    })
    .eq("id", client.id)

  if (error) {
    return {
      status: "error",
      message: "Não foi possível rotacionar o acesso. Tente novamente.",
    }
  }

  revalidatePath("/clients")
  return {
    status: "success",
    code,
    url: await buildPortalUrl(client.portal_slug),
  }
}
