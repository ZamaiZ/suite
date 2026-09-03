"use server"

import { revalidatePath } from "next/cache"
import { createPortalAccess } from "@/lib/clients/access"
import { buildPortalUrl } from "@/lib/clients/portal-session"
import {
  issuePortalAccessSchema,
  readClientIdField,
} from "@/lib/validations/client-portal"
import { denyUnlessCanManage, loadStaffClient } from "@/lib/clients/staff"

export type IssuePortalAccessState =
  | { status: "success"; code: string; url: string }
  | { status: "error"; message: string }

export async function issuePortalAccess(
  formData: FormData,
): Promise<IssuePortalAccessState> {
  const parsed = issuePortalAccessSchema.safeParse(readClientIdField(formData))
  if (!parsed.success) {
    return { status: "error", message: "Cliente inválido." }
  }

  const loaded = await loadStaffClient(parsed.data.client_id)
  if (loaded.status === "error") return loaded
  const denied = denyUnlessCanManage(loaded.context)
  if (denied) return denied

  const { client, supabase } = loaded.context
  if (client.portal_code_hash) {
    return {
      status: "error",
      message: "Este cliente já possui um código de acesso. Use a rotação.",
    }
  }

  let issued: ReturnType<typeof createPortalAccess>
  try {
    issued = createPortalAccess()
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
      portal_slug: issued.slug,
      portal_code_hash: issued.hash,
      portal_code_generated_at: now,
      portal_code_rotated_at: null,
      portal_code_rotated_by: null,
      portal_auth_failures: 0,
      portal_locked_until: null,
    })
    .eq("id", client.id)
    .is("portal_code_hash", null)

  if (error) {
    return {
      status: "error",
      message: "Não foi possível gerar o acesso. Tente novamente.",
    }
  }

  revalidatePath("/clients")
  return {
    status: "success",
    code: issued.code,
    url: await buildPortalUrl(issued.slug),
  }
}
