"use server"

import {
  emptyAccessesPayload,
  parseAccessesPayload,
  type BriefingAccessesPayload,
  type BriefingSecretFlags,
} from "@/lib/briefing/accesses"
import { BRIEFING_STEP_ACCESSES } from "@/lib/briefing/steps"
import { requirePortalClient } from "@/lib/clients/portal-session"

export type BriefingAccessesState =
  | {
      status: "success"
      payload: BriefingAccessesPayload
      sourceSnapshot: BriefingAccessesPayload
      secretFlags: BriefingSecretFlags
      completedAt: string | null
      updatedAt: string | null
      isNew: boolean
    }
  | { status: "error"; message: string }
  | { status: "unauthenticated" }

export async function loadBriefingAccesses(): Promise<BriefingAccessesState> {
  const loaded = await requirePortalClient()
  if (loaded.status === "unauthenticated") return loaded

  const { client, admin } = loaded.context
  const { data, error } = await admin
    .from("client_briefing_steps")
    .select("payload, source_snapshot, completed_at, updated_at")
    .eq("client_id", client.id)
    .eq("step", BRIEFING_STEP_ACCESSES)
    .maybeSingle()

  if (error) {
    return {
      status: "error",
      message: "Não foi possível carregar o briefing.",
    }
  }

  const { data: secretRows, error: secretError } = await admin
    .from("client_briefing_secrets")
    .select("kind")
    .eq("client_id", client.id)

  if (secretError) {
    return {
      status: "error",
      message: "Não foi possível carregar o briefing.",
    }
  }

  const secretFlags: BriefingSecretFlags = {}
  for (const row of secretRows ?? []) {
    if (typeof row.kind === "string" && row.kind.length > 0) {
      secretFlags[row.kind] = true
    }
  }

  if (data) {
    return {
      status: "success",
      payload: parseAccessesPayload(data.payload),
      sourceSnapshot: parseAccessesPayload(data.source_snapshot),
      secretFlags,
      completedAt:
        typeof data.completed_at === "string" ? data.completed_at : null,
      updatedAt: typeof data.updated_at === "string" ? data.updated_at : null,
      isNew: false,
    }
  }

  const empty = emptyAccessesPayload()
  return {
    status: "success",
    payload: empty,
    sourceSnapshot: empty,
    secretFlags,
    completedAt: null,
    updatedAt: null,
    isNew: true,
  }
}
