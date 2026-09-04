"use server"

import { z } from "zod"
import { hydrateStructuredAddress } from "@/lib/briefing/address"
import {
  emptyAccessesPayload,
  parseAccessesPayload,
  type BriefingAccessesPayload,
  type BriefingSecretFlags,
} from "@/lib/briefing/accesses"
import {
  emptyAudiencePayload,
  parseAudiencePayload,
  type BriefingAudiencePayload,
} from "@/lib/briefing/audience"
import {
  emptyBrandPayload,
  parseBrandPayload,
  type ProductOrService,
} from "@/lib/briefing/brand"
import {
  emptyClosingPayload,
  parseClosingPayload,
  type BriefingClosingPayload,
} from "@/lib/briefing/closing"
import {
  emptyCompanyPayload,
  parseCompanyPayload,
  type BriefingCompanyPayload,
} from "@/lib/briefing/company"
import {
  emptyFinancePayload,
  parseFinancePayload,
  type BriefingFinancePayload,
} from "@/lib/briefing/finance"
import {
  emptyHistoryPayload,
  parseHistoryPayload,
  type BriefingHistoryPayload,
} from "@/lib/briefing/history"
import {
  deriveBriefingReviewStepState,
  type BriefingReviewStepState,
} from "@/lib/briefing/review-step-state"
import {
  BRIEFING_STEPS,
  type BriefingStepId,
} from "@/lib/briefing/steps"
import {
  emptyWebsitePayload,
  parseWebsitePayload,
  type BriefingWebsitePayload,
} from "@/lib/briefing/website"
import { denyUnlessCanView, loadStaffClient } from "@/lib/clients/staff"
import { createAdminClient } from "@/lib/supabase/admin"

function isBriefingStepId(value: unknown): value is BriefingStepId {
  return (
    typeof value === "string" &&
    BRIEFING_STEPS.some((step) => step.id === value)
  )
}

type StepMeta = {
  state: BriefingReviewStepState
  updatedAt: string | null
  completedAt: string | null
  isNew: boolean
}

export type StaffBriefingStepResult =
  | {
      status: "success"
      step: "company"
      payload: BriefingCompanyPayload
      sourceSnapshot: BriefingCompanyPayload
      meta: StepMeta
    }
  | {
      status: "success"
      step: "brand"
      payload: BriefingBrandPayload
      meta: StepMeta
    }
  | {
      status: "success"
      step: "audience"
      payload: BriefingAudiencePayload
      meta: StepMeta
    }
  | {
      status: "success"
      step: "history"
      payload: BriefingHistoryPayload
      meta: StepMeta
    }
  | {
      status: "success"
      step: "finance"
      payload: BriefingFinancePayload
      productName: string | null
      serviceName: string | null
      productsAndServices: ProductOrService[]
      meta: StepMeta
    }
  | {
      status: "success"
      step: "website"
      payload: BriefingWebsitePayload
      meta: StepMeta
    }
  | {
      status: "success"
      step: "accesses"
      payload: BriefingAccessesPayload
      secretFlags: BriefingSecretFlags
      meta: StepMeta
    }
  | {
      status: "success"
      step: "closing"
      payload: BriefingClosingPayload
      meta: StepMeta
    }
  | { status: "error"; message: string }

export type LoadStaffBriefingStepState = StaffBriefingStepResult

export async function loadStaffBriefingStep(
  clientId: string,
  stepId: string,
): Promise<LoadStaffBriefingStepState> {
  const parsedId = z.uuid().safeParse(clientId)
  if (!parsedId.success) {
    return { status: "error", message: "Cliente inválido." }
  }
  if (!isBriefingStepId(stepId)) {
    return { status: "error", message: "Etapa inválida." }
  }

  const loaded = await loadStaffClient(parsedId.data)
  if (loaded.status === "error") return loaded
  const denied = denyUnlessCanView(loaded.context)
  if (denied) return denied

  const { client } = loaded.context
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("client_briefing_steps")
    .select("payload, source_snapshot, completed_at, updated_at")
    .eq("client_id", client.id)
    .eq("step", stepId)
    .maybeSingle()

  if (error) {
    return {
      status: "error",
      message: "Não foi possível carregar o briefing.",
    }
  }

  const completedAt =
    data && typeof data.completed_at === "string" ? data.completed_at : null
  const updatedAt =
    data && typeof data.updated_at === "string" ? data.updated_at : null
  const meta: StepMeta = {
    state: deriveBriefingReviewStepState(
      data ? { completedAt, updatedAt } : null,
    ),
    updatedAt,
    completedAt,
    isNew: !data,
  }

  switch (stepId) {
    case "company": {
      const payload = data
        ? hydrateStructuredAddress(parseCompanyPayload(data.payload))
        : emptyCompanyPayload()
      const sourceSnapshot = data
        ? hydrateStructuredAddress(parseCompanyPayload(data.source_snapshot))
        : emptyCompanyPayload()
      return {
        status: "success",
        step: "company",
        payload,
        sourceSnapshot,
        meta,
      }
    }
    case "brand": {
      const payload = data
        ? parseBrandPayload(data.payload)
        : emptyBrandPayload()
      return { status: "success", step: "brand", payload, meta }
    }
    case "audience": {
      const payload = data
        ? parseAudiencePayload(data.payload)
        : emptyAudiencePayload()
      return { status: "success", step: "audience", payload, meta }
    }
    case "history": {
      const payload = data
        ? parseHistoryPayload(data.payload)
        : emptyHistoryPayload()
      return { status: "success", step: "history", payload, meta }
    }
    case "finance": {
      const payload = data
        ? parseFinancePayload(data.payload)
        : emptyFinancePayload()
      const { data: brandRow } = await admin
        .from("client_briefing_steps")
        .select("payload")
        .eq("client_id", client.id)
        .eq("step", "brand")
        .maybeSingle()
      const brand = brandRow
        ? parseBrandPayload(brandRow.payload)
        : emptyBrandPayload()
      const productName =
        brand.productsAndServices.find(
          (item) => item.id === payload.highestProfitProductId,
        )?.name ?? null
      const serviceName =
        brand.productsAndServices.find(
          (item) => item.id === payload.highestProfitServiceId,
        )?.name ?? null
      return {
        status: "success",
        step: "finance",
        payload,
        productName,
        serviceName,
        productsAndServices: brand.productsAndServices,
        meta,
      }
    }
    case "website": {
      const payload = data
        ? parseWebsitePayload(data.payload)
        : emptyWebsitePayload()
      return { status: "success", step: "website", payload, meta }
    }
    case "accesses": {
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

      const payload = data
        ? parseAccessesPayload(data.payload)
        : emptyAccessesPayload()
      return {
        status: "success",
        step: "accesses",
        payload,
        secretFlags,
        meta,
      }
    }
    case "closing": {
      const payload = data
        ? parseClosingPayload(data.payload)
        : emptyClosingPayload()
      return { status: "success", step: "closing", payload, meta }
    }
  }
}
