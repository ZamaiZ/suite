"use server"

import { requirePortalClient } from "@/lib/clients/portal-session"

export type BriefingMetaState =
  | {
      status: "success"
      finalizedAt: string | null
      contentUpdatedAt: string | null
    }
  | { status: "error"; message: string }
  | { status: "unauthenticated" }

export async function loadBriefingMeta(): Promise<BriefingMetaState> {
  const loaded = await requirePortalClient()
  if (loaded.status === "unauthenticated") return loaded

  const { client, admin } = loaded.context
  const { data, error } = await admin
    .from("clients")
    .select("briefing_finalized_at, briefing_content_updated_at")
    .eq("id", client.id)
    .maybeSingle()

  if (error || !data) {
    return {
      status: "error",
      message: "Não foi possível carregar o briefing.",
    }
  }

  return {
    status: "success",
    finalizedAt:
      typeof data.briefing_finalized_at === "string"
        ? data.briefing_finalized_at
        : null,
    contentUpdatedAt:
      typeof data.briefing_content_updated_at === "string"
        ? data.briefing_content_updated_at
        : null,
  }
}
