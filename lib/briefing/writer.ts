import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { requirePortalClient } from "@/lib/clients/portal-session"
import { denyUnlessCanManage, loadStaffClient } from "@/lib/clients/staff"
import type { ClientRecord } from "@/lib/clients/types"

export type BriefingWriterContext = {
  client: ClientRecord
  admin: ReturnType<typeof createAdminClient>
}

export type BriefingWriterState =
  | { status: "ok"; context: BriefingWriterContext }
  | { status: "unauthenticated" }
  | { status: "error"; message: string }

export function readBriefingClientId(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined
  const value = (input as Record<string, unknown>).clientId
  return typeof value === "string" && value.length > 0 ? value : undefined
}

export function stripBriefingClientId(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input
  const { clientId: _clientId, ...rest } = input as Record<string, unknown>
  return rest
}

export function withBriefingClientId<T extends object>(
  payload: T,
  clientId: string | undefined,
): T | (T & { clientId: string }) {
  if (!clientId) return payload
  return { ...payload, clientId }
}

export async function requireBriefingWriter(
  clientId?: string,
): Promise<BriefingWriterState> {
  if (!clientId) {
    return requirePortalClient()
  }

  const loaded = await loadStaffClient(clientId)
  if (loaded.status === "error") return loaded
  const denied = denyUnlessCanManage(loaded.context)
  if (denied) return denied

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("clients")
    .select("briefing_finalized_at")
    .eq("id", loaded.context.client.id)
    .maybeSingle()

  if (error || !data) {
    return { status: "error", message: "Não foi possível salvar." }
  }

  if (typeof data.briefing_finalized_at !== "string") {
    return {
      status: "error",
      message: "O briefing ainda não foi enviado.",
    }
  }

  return {
    status: "ok",
    context: { client: loaded.context.client, admin },
  }
}
