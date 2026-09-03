"use server"

import {
  emptyBrandPayload,
  parseBrandPayload,
} from "@/lib/briefing/brand"
import {
  emptyFinancePayload,
  isFinanceReadyToComplete,
} from "@/lib/briefing/finance"
import {
  BRIEFING_STEP_BRAND,
  BRIEFING_STEP_FINANCE,
} from "@/lib/briefing/steps"
import { touchBriefingContentUpdatedAt } from "@/lib/briefing/touch-content"
import { requirePortalClient } from "@/lib/clients/portal-session"
import {
  briefingFinancePayloadSchema,
  toFinancePayload,
} from "@/lib/validations/briefing-finance"

export type SaveBriefingFinanceState =
  | { status: "success"; updatedAt: string; completedAt: string | null }
  | { status: "error"; message: string }
  | { status: "unauthenticated" }

export async function saveBriefingFinance(
  input: unknown,
): Promise<SaveBriefingFinanceState> {
  const loaded = await requirePortalClient()
  if (loaded.status === "unauthenticated") return loaded

  const parsed = briefingFinancePayloadSchema.safeParse(input)
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revise os dados.",
    }
  }

  const payload = toFinancePayload(parsed.data)
  const { client, admin } = loaded.context
  const now = new Date().toISOString()

  const { data: existing, error: loadError } = await admin
    .from("client_briefing_steps")
    .select("id, completed_at")
    .eq("client_id", client.id)
    .eq("step", BRIEFING_STEP_FINANCE)
    .maybeSingle()

  if (loadError) {
    return { status: "error", message: "Não foi possível salvar." }
  }

  if (existing) {
    const { error } = await admin
      .from("client_briefing_steps")
      .update({
        payload,
        updated_at: now,
      })
      .eq("id", existing.id)

    if (error) {
      return { status: "error", message: "Não foi possível salvar." }
    }

    await touchBriefingContentUpdatedAt(admin, client.id)

    return {
      status: "success",
      updatedAt: now,
      completedAt:
        typeof existing.completed_at === "string" ? existing.completed_at : null,
    }
  }

  const { error } = await admin.from("client_briefing_steps").insert({
    client_id: client.id,
    step: BRIEFING_STEP_FINANCE,
    payload,
    source_snapshot: emptyFinancePayload(),
    updated_at: now,
  })

  if (error) {
    return { status: "error", message: "Não foi possível salvar." }
  }

  await touchBriefingContentUpdatedAt(admin, client.id)

  return { status: "success", updatedAt: now, completedAt: null }
}

export async function completeBriefingFinance(
  input: unknown,
): Promise<SaveBriefingFinanceState> {
  const loaded = await requirePortalClient()
  if (loaded.status === "unauthenticated") return loaded

  const parsed = briefingFinancePayloadSchema.safeParse(input)
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revise os dados.",
    }
  }

  const payload = toFinancePayload(parsed.data)
  const { client, admin } = loaded.context

  const { data: brandRow, error: brandError } = await admin
    .from("client_briefing_steps")
    .select("payload")
    .eq("client_id", client.id)
    .eq("step", BRIEFING_STEP_BRAND)
    .maybeSingle()

  if (brandError) {
    return { status: "error", message: "Não foi possível validar o catálogo." }
  }

  const brandPayload = brandRow
    ? parseBrandPayload(brandRow.payload)
    : emptyBrandPayload()

  if (!isFinanceReadyToComplete(payload, brandPayload.productsAndServices)) {
    return {
      status: "error",
      message: "Complete todos os campos obrigatórios para avançar.",
    }
  }

  const saved = await saveBriefingFinance(payload)
  if (saved.status !== "success") return saved

  const again = await requirePortalClient()
  if (again.status === "unauthenticated") return again

  const now = new Date().toISOString()
  const { error } = await again.context.admin
    .from("client_briefing_steps")
    .update({
      completed_at: now,
      updated_at: now,
    })
    .eq("client_id", again.context.client.id)
    .eq("step", BRIEFING_STEP_FINANCE)

  if (error) {
    return { status: "error", message: "Não foi possível concluir a etapa." }
  }

  return { status: "success", updatedAt: now, completedAt: now }
}
