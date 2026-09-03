"use server"

import {
  PORTAL_AUTH_LOCKOUT_MS,
  PORTAL_AUTH_MAX_FAILURES,
  portalCodeMatches,
} from "@/lib/clients/access"
import { writePortalSession } from "@/lib/clients/portal-session"
import { CLIENT_PORTAL_SELECT } from "@/lib/clients/types"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  authenticateClientPortalSchema,
  readPortalAuthFields,
} from "@/lib/validations/client-portal"
import { parseClientRow } from "@/lib/clients/parse"

export type AuthenticateClientPortalState =
  | { status: "success" }
  | { status: "error"; message: string }

const INVALID_CODE_MESSAGE = "Código inválido."
const LOCKED_MESSAGE = "Tente mais tarde."

export async function authenticateClientPortal(
  formData: FormData,
): Promise<AuthenticateClientPortalState> {
  const parsed = authenticateClientPortalSchema.safeParse(
    readPortalAuthFields(formData),
  )
  if (!parsed.success) {
    return { status: "error", message: INVALID_CODE_MESSAGE }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("clients")
    .select(CLIENT_PORTAL_SELECT)
    .eq("portal_slug", parsed.data.slug)
    .maybeSingle()

  if (error || !data) {
    return { status: "error", message: INVALID_CODE_MESSAGE }
  }

  const client = parseClientRow(data)
  if (!client?.portal_code_hash) {
    return { status: "error", message: INVALID_CODE_MESSAGE }
  }

  const now = Date.now()
  if (
    client.portal_locked_until &&
    Date.parse(client.portal_locked_until) > now
  ) {
    return { status: "error", message: LOCKED_MESSAGE }
  }

  let matches = false
  try {
    matches = portalCodeMatches(parsed.data.code, client.portal_code_hash)
  } catch {
    return { status: "error", message: INVALID_CODE_MESSAGE }
  }

  if (matches) {
    const { error: clearError } = await admin
      .from("clients")
      .update({
        portal_auth_failures: 0,
        portal_locked_until: null,
      })
      .eq("id", client.id)

    if (clearError) {
      return { status: "error", message: INVALID_CODE_MESSAGE }
    }

    await writePortalSession({
      clientId: client.id,
      version: client.portal_session_version,
    })
    return { status: "success" }
  }

  const failures = client.portal_auth_failures + 1
  const locked =
    failures >= PORTAL_AUTH_MAX_FAILURES
      ? new Date(now + PORTAL_AUTH_LOCKOUT_MS).toISOString()
      : null

  await admin
    .from("clients")
    .update({
      portal_auth_failures: locked ? 0 : failures,
      portal_locked_until: locked,
    })
    .eq("id", client.id)

  if (locked) {
    return { status: "error", message: LOCKED_MESSAGE }
  }

  return { status: "error", message: INVALID_CODE_MESSAGE }
}
