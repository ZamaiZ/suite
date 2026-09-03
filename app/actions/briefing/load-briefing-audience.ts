"use server"

import {
  emptyAudiencePayload,
  parseAudiencePayload,
  type BriefingAudiencePayload,
} from "@/lib/briefing/audience"
import { BRIEFING_STEP_AUDIENCE } from "@/lib/briefing/steps"
import { requirePortalClient } from "@/lib/clients/portal-session"

export type BriefingAudienceState =
  | {
      status: "success"
      payload: BriefingAudiencePayload
      sourceSnapshot: BriefingAudiencePayload
      completedAt: string | null
      updatedAt: string | null
      isNew: boolean
    }
  | { status: "error"; message: string }
  | { status: "unauthenticated" }

export async function loadBriefingAudience(): Promise<BriefingAudienceState> {
  const loaded = await requirePortalClient()
  if (loaded.status === "unauthenticated") return loaded

  const { client, admin } = loaded.context
  const { data, error } = await admin
    .from("client_briefing_steps")
    .select("payload, source_snapshot, completed_at, updated_at")
    .eq("client_id", client.id)
    .eq("step", BRIEFING_STEP_AUDIENCE)
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
      payload: parseAudiencePayload(data.payload),
      sourceSnapshot: parseAudiencePayload(data.source_snapshot),
      completedAt:
        typeof data.completed_at === "string" ? data.completed_at : null,
      updatedAt: typeof data.updated_at === "string" ? data.updated_at : null,
      isNew: false,
    }
  }

  const empty = emptyAudiencePayload()
  return {
    status: "success",
    payload: empty,
    sourceSnapshot: empty,
    completedAt: null,
    updatedAt: null,
    isNew: true,
  }
}
