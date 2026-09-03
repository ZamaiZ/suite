"use server"

import { hydrateStructuredAddress } from "@/lib/briefing/address"
import {
  parseCompanyPayload,
  type BriefingCompanyPayload,
} from "@/lib/briefing/company"
import { prefillCompanyFromLead } from "@/lib/briefing/prefill"
import { BRIEFING_STEP_COMPANY } from "@/lib/briefing/steps"
import { requirePortalClient } from "@/lib/clients/portal-session"

export type BriefingCompanyState =
  | {
      status: "success"
      payload: BriefingCompanyPayload
      sourceSnapshot: BriefingCompanyPayload
      completedAt: string | null
      updatedAt: string | null
      isNew: boolean
    }
  | { status: "error"; message: string }
  | { status: "unauthenticated" }

export async function loadBriefingCompany(): Promise<BriefingCompanyState> {
  const loaded = await requirePortalClient()
  if (loaded.status === "unauthenticated") return loaded

  const { client, admin } = loaded.context
  const { data, error } = await admin
    .from("client_briefing_steps")
    .select("payload, source_snapshot, completed_at, updated_at")
    .eq("client_id", client.id)
    .eq("step", BRIEFING_STEP_COMPANY)
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
      payload: hydrateStructuredAddress(parseCompanyPayload(data.payload)),
      sourceSnapshot: hydrateStructuredAddress(
        parseCompanyPayload(data.source_snapshot),
      ),
      completedAt:
        typeof data.completed_at === "string" ? data.completed_at : null,
      updatedAt: typeof data.updated_at === "string" ? data.updated_at : null,
      isNew: false,
    }
  }

  const prefill = await prefillCompanyFromLead(admin, client.lead_id)
  return {
    status: "success",
    payload: prefill,
    sourceSnapshot: prefill,
    completedAt: null,
    updatedAt: null,
    isNew: true,
  }
}
