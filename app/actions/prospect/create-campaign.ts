"use server"

import { revalidatePath } from "next/cache"

import { requireCommercialMember } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { isBrazilStateCode, normalizeCityMatch } from "@/lib/br-locations"
import {
  validateCampaignInput,
  type CampaignEstimate,
  type ProspectFilters,
} from "@/lib/prospect/campaign-input"
import { cityCenter } from "@/lib/locationiq/city-center"

import { CAMPAIGN_WRITE_ERROR } from "./campaign-access"

export type CreateCampaignInput = {
  name: string
  categories: string[]
  city: string
  stateCode: string
  radiusKm: number
  targetCount: number
  filters?: ProspectFilters
  /** Estimativa já paga em `estimateCampaign`, para não refazer a chamada. */
  estimate?: CampaignEstimate | null
  /** Custo da estimativa, que a campanha herda. */
  estimateCostUsd?: number
}

export type CreateCampaignState =
  | { status: "success"; campaignId: string }
  | {
      status: "error"
      message: string
      fieldErrors?: Record<string, string>
    }

/**
 * Cria a campanha em `draft`. **Não gasta nada.**
 *
 * A descoberta é um passo separado, disparado pela tela da campanha. É o mesmo
 * corte de `startResearch`: a linha nasce antes da compra, para que uma falha
 * de rede no meio não deixe tarefa paga sem onde ser registrada.
 */
export async function createProspectCampaign(
  input: CreateCampaignInput,
): Promise<CreateCampaignState> {
  const { user } = await requireCommercialMember()

  if (!isBrazilStateCode(input.stateCode)) {
    return {
      status: "error",
      message: "Escolha uma cidade válida.",
      fieldErrors: { city: "UF inválida." },
    }
  }
  const cidade = normalizeCityMatch(input.stateCode, input.city)
  if (!cidade) {
    return {
      status: "error",
      message: "Cidade inválida para a UF selecionada.",
      fieldErrors: { city: "Cidade inválida para a UF selecionada." },
    }
  }

  const centro = await cityCenter(cidade, input.stateCode)
  if (centro.status === "error") {
    return {
      status: "error",
      message: centro.message,
      fieldErrors: { city: centro.message },
    }
  }

  const campanha = {
    name: input.name.trim(),
    categories: input.categories,
    latitude: centro.data.latitude,
    longitude: centro.data.longitude,
    radiusKm: input.radiusKm,
    targetCount: input.targetCount,
    filters: input.filters ?? {},
  }

  const issues = validateCampaignInput(campanha)
  if (issues.length > 0) {
    return {
      status: "error",
      message: issues[0].message,
      fieldErrors: Object.fromEntries(issues.map((i) => [i.field, i.message])),
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("prospect_campaigns")
    .insert({
      name: campanha.name,
      categories: campanha.categories,
      state_code: input.stateCode,
      city: cidade,
      center_lat: campanha.latitude,
      center_lng: campanha.longitude,
      radius_km: campanha.radiusKm,
      filters: campanha.filters,
      target_count: campanha.targetCount,
      estimate: input.estimate ?? null,
      // O agregado já foi pago em `estimateCampaign`. Sem herdar o número, o
      // custo da campanha começaria mentindo para baixo.
      discovery_cost_usd: input.estimateCostUsd ?? 0,
      status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single()

  if (error || !data) {
    return { status: "error", message: CAMPAIGN_WRITE_ERROR }
  }

  revalidatePath("/prospeccao")
  return { status: "success", campaignId: data.id as string }
}

export type DeleteCampaignState =
  | { status: "success" }
  | { status: "error"; message: string }

/**
 * Apaga a campanha e tudo que pende dela.
 *
 * O `on delete cascade` leva prospects, tarefas e coletas junto — e é
 * deliberado: prospect sem campanha não tem procedência, e coleta sem
 * procedência não pode ser mostrada como fato. Prospect já promovido sobrevive
 * como lead, porque `prospects.promoted_lead_id` aponta para `leads`, e não o
 * contrário.
 */
export async function deleteProspectCampaign(
  campaignId: string,
): Promise<DeleteCampaignState> {
  await requireCommercialMember()
  const supabase = await createClient()

  const { error } = await supabase
    .from("prospect_campaigns")
    .delete()
    .eq("id", campaignId)

  if (error) {
    return {
      status: "error",
      message: "Não foi possível excluir a campanha.",
    }
  }
  revalidatePath("/prospeccao")
  return { status: "success" }
}
