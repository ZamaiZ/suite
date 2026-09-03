"use server"

import {
  emptyClosingPayload,
  parseClosingPayload,
  type BriefingClosingPayload,
} from "@/lib/briefing/closing"
import { BRIEFING_STEP_CLOSING } from "@/lib/briefing/steps"
import { requirePortalClient } from "@/lib/clients/portal-session"

export type BriefingClosingState =
  | {
      status: "success"
      payload: BriefingClosingPayload
      sourceSnapshot: BriefingClosingPayload
      completedAt: string | null
      updatedAt: string | null
      isNew: boolean
    }
  | { status: "error"; message: string }
  | { status: "unauthenticated" }

export async function loadBriefingClosing(): Promise<BriefingClosingState> {
  const loaded = await requirePortalClient()
  if (loaded.status === "unauthenticated") return loaded

  const { client, admin } = loaded.context
  const { data, error } = await admin
    .from("client_briefing_steps")
    .select("payload, source_snapshot, completed_at, updated_at")
    .eq("client_id", client.id)
    .eq("step", BRIEFING_STEP_CLOSING)
    .maybeSingle()

  if (error) {
    return {
      status: "error",
      message: "Não foi possível carregar o briefing.",
    }
  }

  if (data) {
    return {
      status: "success",
      payload: parseClosingPayload(data.payload),
      sourceSnapshot: parseClosingPayload(data.source_snapshot),
      completedAt:
        typeof data.completed_at === "string" ? data.completed_at : null,
      updatedAt: typeof data.updated_at === "string" ? data.updated_at : null,
      isNew: false,
    }
  }

  const empty = emptyClosingPayload()
  return {
    status: "success",
    payload: empty,
    sourceSnapshot: empty,
    completedAt: null,
    updatedAt: null,
    isNew: true,
  }
}
