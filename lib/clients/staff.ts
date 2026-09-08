import "server-only"

import { requireCommercialMember } from "@/lib/auth/session"
import { canManageClientPortal, canViewClient } from "@/lib/clients/access"
import { parseClientRow } from "@/lib/clients/parse"
import { CLIENT_PORTAL_SELECT, type ClientRecord } from "@/lib/clients/types"
import { createClient } from "@/lib/supabase/server"
import type { AppRole } from "@/lib/auth/roles"
import type { SessionUser } from "@/lib/auth/session"

export type StaffClientContext = {
  user: SessionUser
  roles: AppRole[]
  client: ClientRecord
  supabase: Awaited<ReturnType<typeof createClient>>
}

export async function loadStaffClient(
  clientId: string,
): Promise<
  | { status: "ok"; context: StaffClientContext }
  | { status: "error"; message: string }
> {
  const { user, roles } = await requireCommercialMember()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_PORTAL_SELECT)
    .eq("id", clientId)
    .maybeSingle()

  if (error) {
    return {
      status: "error",
      message: "Não foi possível carregar o cliente.",
    }
  }
  if (!data) {
    return { status: "error", message: "Cliente não encontrado." }
  }

  const client = parseClientRow(data)
  if (!client) {
    return { status: "error", message: "Cliente inválido." }
  }

  return { status: "ok", context: { user, roles, client, supabase } }
}

export function denyUnlessCanManage(
  context: StaffClientContext,
): { status: "error"; message: string } | null {
  if (
    canManageClientPortal(
      context.roles,
      context.user.id,
      context.client.closer_id,
    )
  ) {
    return null
  }
  return {
    status: "error",
    message: "Você não pode gerenciar o acesso deste cliente.",
  }
}

export function denyUnlessCanView(
  context: StaffClientContext,
): { status: "error"; message: string } | null {
  if (canViewClient(context.roles, context.user.id, context.client.closer_id)) {
    return null
  }
  return {
    status: "error",
    message: "Você não pode visualizar este cliente.",
  }
}
