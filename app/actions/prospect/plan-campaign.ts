"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { isDataForSeoConfigured } from "@/lib/dataforseo/configured"
import {
  aggregateCategories,
  fetchBusinessCategories,
  type BusinessCategory,
} from "@/lib/dataforseo/business-listings"
import { cityCenter } from "@/lib/locationiq/city-center"
import {
  validateCampaignInput,
  type CampaignEstimate,
  type ProspectFilters,
} from "@/lib/prospect/campaign-input"
import { isBrazilStateCode } from "@/lib/br-locations"

/**
 * O passo gratuito — e o passo que custa antes de gastar de verdade.
 *
 * O desenho é o mesmo de `planResearch` / `startResearch`: separar "o que eu
 * vou receber" de "compre". Um botão só esconderia do SDR o único número que
 * ele precisa ver antes de gastar.
 *
 * `listProspectCategories` é gratuito de verdade. `estimateCampaign` custa
 * como uma busca — US$ 0,048 medido, e o `limit` não barateia — e por isso o
 * resultado é guardado na campanha, não refeito a cada abertura da tela.
 */

export type ListCategoriesState =
  | { status: "success"; categories: BusinessCategory[] }
  | { status: "error"; message: string }

export async function listProspectCategories(): Promise<ListCategoriesState> {
  await requireCommercialMember()
  if (!isDataForSeoConfigured()) {
    return {
      status: "error",
      message: "A fonte de dados não está configurada.",
    }
  }

  const fetched = await fetchBusinessCategories()
  if (fetched.status === "error") {
    return { status: "error", message: fetched.message }
  }
  return { status: "success", categories: fetched.categories }
}

export type EstimateCampaignInput = {
  categories: string[]
  city: string
  stateCode: string
  radiusKm: number
  targetCount: number
  filters?: ProspectFilters
}

export type EstimateCampaignState =
  | {
      status: "success"
      estimate: CampaignEstimate
      latitude: number
      longitude: number
      costUsd: number
    }
  | {
      status: "error"
      message: string
      fieldErrors?: Record<string, string>
    }

export async function estimateCampaign(
  input: EstimateCampaignInput,
): Promise<EstimateCampaignState> {
  await requireCommercialMember()
  if (!isDataForSeoConfigured()) {
    return { status: "error", message: "A fonte de dados não está configurada." }
  }

  if (!isBrazilStateCode(input.stateCode)) {
    return {
      status: "error",
      message: "Escolha uma cidade válida.",
      fieldErrors: { city: "UF inválida." },
    }
  }

  // A coordenada vem do centroide do município, e não de `location_code`. A
  // onda 0 mediu que o código do país devolve outro estado e o de cidade
  // devolve o interior — ver P5 em
  // `docs/auditoria/evidencias/2026-09-15-migracao-dataforseo/README.md`.
  const centro = await cityCenter(input.city, input.stateCode)
  if (centro.status === "error") {
    return {
      status: "error",
      message: centro.message,
      fieldErrors: { city: centro.message },
    }
  }

  const campanha = {
    name: "temporária",
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

  const agregado = await aggregateCategories(campanha, input.targetCount)
  if (agregado.status === "error") {
    return { status: "error", message: agregado.message }
  }

  // A estimativa é paga. Gravar o custo antes de a campanha existir não tem
  // onde — mas a campanha criada em seguida herda o número, e é por isso que
  // `createProspectCampaign` recebe `estimateCostUsd`.
  return {
    status: "success",
    estimate: agregado.estimate,
    latitude: centro.data.latitude,
    longitude: centro.data.longitude,
    costUsd: agregado.costUsd,
  }
}

export type CampaignCostSummary = {
  discoveryUsd: number
  enrichmentUsd: number
  totalUsd: number
}

/** Quanto a prospecção já custou no total. Some na tela de campanhas. */
export async function prospectCostSummary(): Promise<CampaignCostSummary> {
  await requireCommercialMember()
  const supabase = await createClient()
  const { data } = await supabase
    .from("prospect_campaigns")
    .select("discovery_cost_usd, enrichment_cost_usd")

  let discoveryUsd = 0
  let enrichmentUsd = 0
  for (const row of data ?? []) {
    const r = row as { discovery_cost_usd: number; enrichment_cost_usd: number }
    discoveryUsd += Number(r.discovery_cost_usd) || 0
    enrichmentUsd += Number(r.enrichment_cost_usd) || 0
  }
  return {
    discoveryUsd,
    enrichmentUsd,
    totalUsd: discoveryUsd + enrichmentUsd,
  }
}
