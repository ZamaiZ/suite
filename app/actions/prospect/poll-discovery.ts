"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { isDataForSeoConfigured } from "@/lib/dataforseo/configured"
import { searchBusinessListings } from "@/lib/dataforseo/business-listings"
import {
  PROSPECT_PAGE_MAX,
  type CampaignInput,
} from "@/lib/prospect/campaign-input"
import type { ProspectListing } from "@/lib/prospect/types"

import {
  knownPlaceIds,
  loadCampaign,
  loadOptOuts,
  CAMPAIGN_NOT_FOUND,
  type CampaignRow,
} from "./campaign-access"

/**
 * A descoberta paginada.
 *
 * É uma fila de **uma linha só**, e o lease mora na própria campanha — mesmo
 * desenho de `lead_gbp_grid_scans`, onde o scan inteiro é uma linha. Não há
 * `task_id` porque o endpoint é `live`: ele cobra e devolve na mesma chamada,
 * então não existe tarefa órfã a readotar. O que existe é **página já paga**,
 * e é isso que `discovery_offset` e `discovery_token` protegem: sem eles, um
 * retry recompraria a lista inteira.
 *
 * Uma passada traz até `PROSPECT_PAGE_MAX` por vez e para no orçamento de
 * parede, nunca no meio de uma escrita.
 */

const LEASE_MS = 120_000

export type PollDiscoveryState =
  | {
      status: "success"
      discovered: number
      total: number
      universeCount: number | null
      settled: boolean
      costUsd: number
    }
  | { status: "busy" }
  | { status: "error"; message: string }

function campaignToInput(row: CampaignRow): CampaignInput {
  return {
    name: row.name,
    categories: row.categories,
    latitude: row.center_lat,
    longitude: row.center_lng,
    radiusKm: Number(row.radius_km),
    targetCount: row.target_count,
    filters: row.filters ?? {},
  }
}

export async function pollProspectDiscovery(
  campaignId: string,
): Promise<PollDiscoveryState> {
  await requireCommercialMember()
  if (!isDataForSeoConfigured()) {
    return { status: "error", message: "A fonte de dados não está configurada." }
  }

  const supabase = await createClient()
  const campanha = await loadCampaign(supabase, campaignId)
  if (!campanha) return { status: "error", message: CAMPAIGN_NOT_FOUND }

  if (campanha.status === "discovered") {
    return {
      status: "success",
      discovered: campanha.discovered_count,
      total: campanha.target_count,
      universeCount: campanha.universe_count,
      settled: true,
      costUsd: Number(campanha.discovery_cost_usd),
    }
  }

  // Lease por UPDATE atômico. Comparar o status contra ele mesmo não trava
  // nada: duas abas abertas na mesma campanha passavam as duas e compravam a
  // mesma página duas vezes.
  const agora = new Date().toISOString()
  const limite = new Date(Date.now() - LEASE_MS).toISOString()
  const { data: travada } = await supabase
    .from("prospect_campaigns")
    .update({
      polling_at: agora,
      status: "discovering",
      started_at: campanha.started_at ?? agora,
      updated_at: agora,
    })
    .eq("id", campaignId)
    .in("status", ["draft", "discovering"])
    .or(`polling_at.is.null,polling_at.lt.${limite}`)
    .select("id")
    .maybeSingle()

  if (!travada) return { status: "busy" }

  const restante = campanha.target_count - campanha.discovered_count
  if (restante <= 0) {
    await supabase
      .from("prospect_campaigns")
      .update({
        status: "discovered",
        polling_at: null,
        finished_at: agora,
        updated_at: agora,
      })
      .eq("id", campaignId)
    return {
      status: "success",
      discovered: campanha.discovered_count,
      total: campanha.target_count,
      universeCount: campanha.universe_count,
      settled: true,
      costUsd: Number(campanha.discovery_cost_usd),
    }
  }

  const entrada = campaignToInput(campanha)
  const buscada = await searchBusinessListings(entrada, {
    limit: Math.min(restante, PROSPECT_PAGE_MAX),
    offset: campanha.discovery_offset,
    offsetToken: campanha.discovery_token,
  })

  if (buscada.status === "error") {
    const tentativas = campanha.attempts + 1
    await supabase
      .from("prospect_campaigns")
      .update({
        polling_at: null,
        attempts: tentativas,
        // Duas tentativas e para. Sem teto, campanha que falha de verdade é
        // reenviada a cada passada — e cada reenvio é pago.
        status: tentativas >= 2 ? "failed" : "discovering",
        error_message: buscada.message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId)
    return { status: "error", message: buscada.message }
  }

  const custo = Number(campanha.discovery_cost_usd) + buscada.costUsd

  const jaVistos = await knownPlaceIds(supabase, campaignId)
  const optOuts = await loadOptOuts(supabase)

  const novos: ProspectListing[] = []
  for (const item of buscada.page.items) {
    if (item.placeId && jaVistos.has(item.placeId)) continue
    if (item.placeId && optOuts.placeIds.has(item.placeId)) continue
    if (item.phoneE164 && optOuts.phones.has(item.phoneE164)) continue
    if (item.domain && optOuts.domains.has(item.domain)) continue
    novos.push(item)
  }

  if (novos.length > 0) {
    const { error: erroInsert } = await supabase.from("prospects").insert(
      novos.map((item) => ({
        campaign_id: campaignId,
        place_id: item.placeId,
        cid: item.cid,
        title: item.title,
        category: item.category,
        category_ids: item.categoryIds,
        phone_raw: item.phoneRaw,
        phone_e164: item.phoneE164,
        domain: item.domain,
        url: item.url,
        address: item.address,
        zip: item.zip,
        street_number: item.streetNumber,
        city: item.city,
        region: item.region,
        latitude: item.latitude,
        longitude: item.longitude,
        rating: item.rating,
        votes_count: item.votesCount,
        is_claimed: item.isClaimed,
        work_time: item.workTime,
        attributes: item.attributes,
        listing: item.listing,
        listing_updated_at: item.listingUpdatedAt,
      })),
    )
    if (erroInsert) {
      // A página foi paga. O custo sobe mesmo com a gravação falhando: fingir
      // que não gastou é como o incidente das 121 tarefas começou.
      await supabase
        .from("prospect_campaigns")
        .update({
          polling_at: null,
          discovery_cost_usd: custo,
          error_message: "Empresas encontradas, mas não foi possível gravar.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId)
      return {
        status: "error",
        message:
          "As empresas foram encontradas mas não puderam ser salvas. Tente continuar a coleta.",
      }
    }
  }

  const descobertas = campanha.discovered_count + novos.length
  const acabaramAsPaginas =
    buscada.page.items.length === 0 || !buscada.page.offsetToken
  const atingiuOAlvo = descobertas >= campanha.target_count
  const terminou = acabaramAsPaginas || atingiuOAlvo

  await supabase
    .from("prospect_campaigns")
    .update({
      // O token manda no offset: ele é o cursor do provedor, e o offset só
      // existe como reserva para quando ele não vem.
      discovery_token: buscada.page.offsetToken,
      discovery_offset: campanha.discovery_offset + buscada.page.items.length,
      discovered_count: descobertas,
      universe_count: buscada.page.totalCount ?? campanha.universe_count,
      discovery_cost_usd: custo,
      status: terminou ? "discovered" : "discovering",
      finished_at: terminou ? new Date().toISOString() : null,
      polling_at: null,
      attempts: 0,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId)

  return {
    status: "success",
    discovered: descobertas,
    total: campanha.target_count,
    universeCount: buscada.page.totalCount ?? campanha.universe_count,
    // Estourar o orçamento de parede **não** fecha a campanha: só encerra
    // esta passada. A próxima retoma no `offset_token`, sem recomprar nada —
    // que é a razão de o token ser gravado antes de qualquer outra coisa.
    settled: terminou,
    costUsd: custo,
  }
}

export type ResetDiscoveryState =
  | { status: "success" }
  | { status: "error"; message: string }

/**
 * Destrava uma campanha que ficou com o lease preso.
 *
 * Acontece quando a aba morre no meio de uma passada: o `polling_at` fica
 * marcado e nada avança até ele vencer. O botão existe para o SDR não esperar
 * dois minutos olhando uma barra parada.
 */
export async function resumeProspectDiscovery(
  campaignId: string,
): Promise<ResetDiscoveryState> {
  await requireCommercialMember()
  const supabase = await createClient()
  const { error } = await supabase
    .from("prospect_campaigns")
    .update({
      polling_at: null,
      attempts: 0,
      error_message: null,
      status: "discovering",
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
    .in("status", ["discovering", "failed"])

  if (error) {
    return { status: "error", message: "Não foi possível retomar a coleta." }
  }
  return { status: "success" }
}
