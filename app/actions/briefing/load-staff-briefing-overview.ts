"use server"

import { z } from "zod"
import {
  BRIEFING_LIST_STATUS_LABELS,
  deriveBriefingListStatus,
  type BriefingListStatus,
} from "@/lib/briefing/status"
import {
  deriveBriefingReviewStepState,
  type BriefingReviewStepState,
} from "@/lib/briefing/review-step-state"
import { BRIEFING_STEPS, type BriefingStepId } from "@/lib/briefing/steps"
import { denyUnlessCanManage, loadStaffClient } from "@/lib/clients/staff"
import { createAdminClient } from "@/lib/supabase/admin"

export type StaffBriefingOverviewStep = {
  id: BriefingStepId
  label: string
  state: BriefingReviewStepState
  updatedAt: string | null
  completedAt: string | null
}

export type StaffBriefingOverview = {
  clientId: string
  companyName: string
  status: BriefingListStatus
  statusLabel: string
  finalizedAt: string | null
  contentUpdatedAt: string | null
  completedCount: number
  steps: StaffBriefingOverviewStep[]
}

export type LoadStaffBriefingOverviewState =
  | { status: "success"; overview: StaffBriefingOverview }
  | { status: "error"; message: string }

export async function loadStaffBriefingOverview(
  clientId: string,
): Promise<LoadStaffBriefingOverviewState> {
  const parsed = z.uuid().safeParse(clientId)
  if (!parsed.success) {
    return { status: "error", message: "Cliente inválido." }
  }

  const loaded = await loadStaffClient(parsed.data)
  if (loaded.status === "error") return loaded
  const denied = denyUnlessCanManage(loaded.context)
  if (denied) return denied

  const { client } = loaded.context
  const admin = createAdminClient()

  const { data: clientRow, error: clientError } = await admin
    .from("clients")
    .select("company_name, briefing_finalized_at, briefing_content_updated_at")
    .eq("id", client.id)
    .maybeSingle()

  if (clientError || !clientRow) {
    return {
      status: "error",
      message: "Não foi possível carregar o briefing.",
    }
  }

  const { data: stepRows, error: stepsError } = await admin
    .from("client_briefing_steps")
    .select("step, completed_at, updated_at")
    .eq("client_id", client.id)

  if (stepsError) {
    return {
      status: "error",
      message: "Não foi possível carregar o briefing.",
    }
  }

  const byStep = new Map<
    string,
    { completedAt: string | null; updatedAt: string | null }
  >()
  for (const row of stepRows ?? []) {
    if (typeof row.step !== "string") continue
    byStep.set(row.step, {
      completedAt:
        typeof row.completed_at === "string" ? row.completed_at : null,
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    })
  }

  const steps: StaffBriefingOverviewStep[] = BRIEFING_STEPS.map((step) => {
    const row = byStep.get(step.id) ?? null
    return {
      id: step.id,
      label: step.label,
      state: deriveBriefingReviewStepState(row),
      updatedAt: row?.updatedAt ?? null,
      completedAt: row?.completedAt ?? null,
    }
  })

  const finalizedAt =
    typeof clientRow.briefing_finalized_at === "string"
      ? clientRow.briefing_finalized_at
      : null
  const contentUpdatedAt =
    typeof clientRow.briefing_content_updated_at === "string"
      ? clientRow.briefing_content_updated_at
      : null
  const status = deriveBriefingListStatus(finalizedAt, contentUpdatedAt)
  const completedCount = steps.filter((step) => step.state === "completed").length

  return {
    status: "success",
    overview: {
      clientId: client.id,
      companyName:
        typeof clientRow.company_name === "string"
          ? clientRow.company_name
          : client.company_name,
      status,
      statusLabel: BRIEFING_LIST_STATUS_LABELS[status],
      finalizedAt,
      contentUpdatedAt,
      completedCount,
      steps,
    },
  }
}
