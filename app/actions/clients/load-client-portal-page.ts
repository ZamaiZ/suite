"use server"

import { readPortalSession } from "@/lib/clients/portal-session"
import { CLIENT_PORTAL_SELECT } from "@/lib/clients/types"
import { createAdminClient } from "@/lib/supabase/admin"
import { parseClientRow } from "@/lib/clients/parse"

export type ClientPortalPageState =
  | { status: "not_found" }
  | { status: "gate"; slug: string }
  | { status: "ready"; companyName: string; clientId: string }

export async function loadClientPortalPage(
  slug: string,
): Promise<ClientPortalPageState> {
  const trimmed = slug.trim()
  if (!trimmed) return { status: "not_found" }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("clients")
    .select(CLIENT_PORTAL_SELECT)
    .eq("portal_slug", trimmed)
    .maybeSingle()

  if (error || !data) return { status: "not_found" }

  const client = parseClientRow(data)
  if (!client?.portal_code_hash || !client.portal_slug) {
    return { status: "not_found" }
  }

  const session = await readPortalSession()
  if (
    session &&
    session.clientId === client.id &&
    session.version === client.portal_session_version
  ) {
    return {
      status: "ready",
      companyName: client.company_name,
      clientId: client.id,
    }
  }

  return { status: "gate", slug: client.portal_slug }
}
