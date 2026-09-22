"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { scoreProspect, type ProspectScore } from "@/lib/prospect/score"
import { confidenceBand, type ConfidenceBand } from "@/lib/prospect/cnpj-match"
import { pipelineProgress, type ProspectTaskRow } from "@/lib/prospect/pipeline"
import type {
  ProspectContact,
  ProspectIdentity,
  ProspectLifecycle,
  ProspectStage,
} from "@/lib/prospect/types"

import { CAMPAIGN_SELECT, PROSPECT_SELECT, type CampaignRow } from "./campaign-access"

/**
 * A leitura da campanha.
 *
 * O score é calculado **aqui**, na leitura, e não gravado: é função sobre o
 * que as etapas já escreveram, e como coluna envelheceria no instante em que a
 * etapa seguinte assentasse.
 */

export type ProspectView = {
  id: string
  placeId: string | null
  title: string
  category: string | null
  phone: string | null
  phoneRaw: string | null
  domain: string | null
  url: string | null
  address: string | null
  city: string | null
  rating: number | null
  votesCount: number | null
  isClaimed: boolean | null
  listingUpdatedAt: string | null
  stage: ProspectLifecycle
  promotedLeadId: string | null
  dismissedReason: string | null
  /* enriquecimento */
  taxId: string | null
  taxIdConfidence: number
  taxIdBand: ConfidenceBand
  taxIdReason: string | null
  taxIdVerdict: "confirmed" | "rejected" | "unknown"
  identity: ProspectIdentity | null
  contacts: ProspectContact[]
  candidates: Array<{ taxId: string; confidence: number; reason: string }>
  score: ProspectScore
}

export type CampaignView = {
  campaign: CampaignRow
  prospects: ProspectView[]
  progress: ReturnType<typeof pipelineProgress>
  counts: {
    total: number
    withTaxId: number
    withContact: number
    promoted: number
    dismissed: number
  }
}

export type LoadCampaignState =
  | { status: "success"; view: CampaignView }
  | { status: "not_found" }

export async function loadProspectCampaign(
  campaignId: string,
): Promise<LoadCampaignState> {
  await requireCommercialMember()
  const supabase = await createClient()

  const { data: campanha } = await supabase
    .from("prospect_campaigns")
    .select(CAMPAIGN_SELECT)
    .eq("id", campaignId)
    .maybeSingle()
  if (!campanha) return { status: "not_found" }

  const [{ data: linhas }, { data: coletas }, { data: reviews }, { data: tarefas }] =
    await Promise.all([
      supabase
        .from("prospects")
        .select(PROSPECT_SELECT)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true }),
      supabase
        .from("prospect_enrichments")
        .select("prospect_id, stage, payload, confidence, collected_at")
        .in(
          "prospect_id",
          // Subconsulta não: o PostgREST não a tem, e trazer as coletas da
          // campanha inteira numa leitura só é mais barato que N leituras.
          (
            await supabase
              .from("prospects")
              .select("id")
              .eq("campaign_id", campaignId)
          ).data?.map((r) => (r as { id: string }).id) ?? [],
        )
        .order("collected_at", { ascending: true }),
      supabase
        .from("prospect_reviews")
        .select("prospect_id, cnpj, cnpj_verdict"),
      supabase
        .from("prospect_enrichment_tasks")
        .select("id, prospect_id, stage, status, task_id, attempts, polling_at, found")
        .eq("campaign_id", campaignId),
    ])

  /* --- coletas agrupadas ------------------------------------------------- */
  type Coleta = {
    prospect_id: string
    stage: ProspectStage
    payload: Record<string, unknown>
    confidence: number | null
  }

  const identityPorProspect = new Map<
    string,
    { identity: ProspectIdentity; confidence: number; reason: string | null }
  >()
  const contatosPorProspect = new Map<string, ProspectContact[]>()
  const candidatosPorProspect = new Map<
    string,
    Array<{ taxId: string; confidence: number; reason: string }>
  >()

  for (const bruta of (coletas ?? []) as unknown as Coleta[]) {
    const payload = bruta.payload ?? {}
    if (bruta.stage === "identity" && payload.identity) {
      const match = payload.match as { reason?: string } | undefined
      identityPorProspect.set(bruta.prospect_id, {
        identity: payload.identity as ProspectIdentity,
        confidence: bruta.confidence ?? 0,
        reason: match?.reason ?? null,
      })
    }
    if (Array.isArray(payload.contacts)) {
      const atual = contatosPorProspect.get(bruta.prospect_id) ?? []
      for (const c of payload.contacts as ProspectContact[]) {
        // Um por tipo+chave, e o de maior confiança: a mesma rede achada no
        // site e na busca não é dois contatos.
        const existente = atual.find(
          (x) => x.kind === c.kind && x.key === c.key,
        )
        if (!existente) atual.push(c)
        else if (c.confidence > existente.confidence) {
          Object.assign(existente, c)
        }
      }
      contatosPorProspect.set(bruta.prospect_id, atual)
    }
    if (Array.isArray(payload.candidates)) {
      candidatosPorProspect.set(
        bruta.prospect_id,
        payload.candidates as Array<{
          taxId: string
          confidence: number
          reason: string
        }>,
      )
    }
  }

  const reviewPorProspect = new Map(
    ((reviews ?? []) as Array<{
      prospect_id: string
      cnpj: string | null
      cnpj_verdict: "confirmed" | "rejected" | "unknown"
    }>).map((r) => [r.prospect_id, r]),
  )

  /* --- montagem ---------------------------------------------------------- */
  const prospects: ProspectView[] = []
  let withTaxId = 0
  let withContact = 0
  let promoted = 0
  let dismissed = 0

  for (const bruta of (linhas ?? []) as unknown as Array<
    Record<string, unknown>
  >) {
    const id = bruta.id as string
    const identidade = identityPorProspect.get(id)
    const review = reviewPorProspect.get(id)
    const contatos = contatosPorProspect.get(id) ?? []

    const taxId = review?.cnpj ?? identidade?.identity.taxId ?? null
    const confidence =
      review?.cnpj_verdict === "confirmed" ? 100 : (identidade?.confidence ?? 0)

    const listing = {
      isClaimed: (bruta.is_claimed as boolean | null) ?? null,
      rating: bruta.rating === null ? null : Number(bruta.rating),
      votesCount: (bruta.votes_count as number | null) ?? null,
      domain: (bruta.domain as string | null) ?? null,
      phoneE164: (bruta.phone_e164 as string | null) ?? null,
    }

    // O telefone do mapa também é um contato: é o canal mais disponível da
    // amostra (71% a 85%), e deixá-lo de fora do score faria o alcance de
    // metade da lista parecer zero.
    const todos: ProspectContact[] = listing.phoneE164
      ? [
          {
            kind: "phone",
            value: listing.phoneE164,
            key: listing.phoneE164,
            source: "listing",
            confidence: 75,
            evidence: null,
          },
          ...contatos,
        ]
      : contatos

    const score = scoreProspect({
      listing,
      identity: identidade?.identity ?? null,
      contacts: todos,
      taxIdConfidence: confidence,
    })

    const stage = bruta.stage as ProspectLifecycle
    if (taxId) withTaxId += 1
    if (todos.length > 0) withContact += 1
    if (stage === "promoted") promoted += 1
    if (stage === "dismissed") dismissed += 1

    prospects.push({
      id,
      placeId: (bruta.place_id as string | null) ?? null,
      title: bruta.title as string,
      category: (bruta.category as string | null) ?? null,
      phone: listing.phoneE164,
      phoneRaw: (bruta.phone_raw as string | null) ?? null,
      domain: listing.domain,
      url: (bruta.url as string | null) ?? null,
      address: (bruta.address as string | null) ?? null,
      city: (bruta.city as string | null) ?? null,
      rating: listing.rating,
      votesCount: listing.votesCount,
      isClaimed: listing.isClaimed,
      listingUpdatedAt: (bruta.listing_updated_at as string | null) ?? null,
      stage,
      promotedLeadId: (bruta.promoted_lead_id as string | null) ?? null,
      dismissedReason: (bruta.dismissed_reason as string | null) ?? null,
      taxId,
      taxIdConfidence: confidence,
      taxIdBand: confidenceBand(confidence),
      taxIdReason: identidade?.reason ?? null,
      taxIdVerdict: review?.cnpj_verdict ?? "unknown",
      identity: identidade?.identity ?? null,
      contacts: todos,
      candidates: candidatosPorProspect.get(id) ?? [],
      score,
    })
  }

  const fila: ProspectTaskRow[] = ((tarefas ?? []) as Array<
    Record<string, unknown>
  >).map((t) => ({
    id: t.id as string,
    prospectId: t.prospect_id as string,
    stage: t.stage as ProspectStage,
    status: t.status as ProspectTaskRow["status"],
    taskId: (t.task_id as string | null) ?? null,
    attempts: (t.attempts as number) ?? 0,
    pollingAt: (t.polling_at as string | null) ?? null,
    found: (t.found as boolean | null) ?? null,
  }))

  return {
    status: "success",
    view: {
      campaign: campanha as unknown as CampaignRow,
      prospects,
      progress: pipelineProgress(fila),
      counts: {
        total: prospects.length,
        withTaxId,
        withContact,
        promoted,
        dismissed,
      },
    },
  }
}

export type CampaignListItem = {
  id: string
  name: string
  city: string
  stateCode: string
  categories: string[]
  status: string
  discoveredCount: number
  targetCount: number
  universeCount: number | null
  promotedCount: number
  costUsd: number
  createdAt: string
}

export async function listProspectCampaigns(): Promise<CampaignListItem[]> {
  await requireCommercialMember()
  const supabase = await createClient()

  const { data } = await supabase
    .from("prospect_campaigns")
    .select(
      "id, name, city, state_code, categories, status, discovered_count, target_count, universe_count, discovery_cost_usd, enrichment_cost_usd, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100)

  const campanhas = (data ?? []) as Array<Record<string, unknown>>
  if (campanhas.length === 0) return []

  const { data: promovidos } = await supabase
    .from("prospects")
    .select("campaign_id")
    .eq("stage", "promoted")
    .in(
      "campaign_id",
      campanhas.map((c) => c.id as string),
    )

  const porCampanha = new Map<string, number>()
  for (const row of promovidos ?? []) {
    const id = (row as { campaign_id: string }).campaign_id
    porCampanha.set(id, (porCampanha.get(id) ?? 0) + 1)
  }

  return campanhas.map((c) => ({
    id: c.id as string,
    name: c.name as string,
    city: c.city as string,
    stateCode: c.state_code as string,
    categories: (c.categories as string[]) ?? [],
    status: c.status as string,
    discoveredCount: (c.discovered_count as number) ?? 0,
    targetCount: (c.target_count as number) ?? 0,
    universeCount: (c.universe_count as number | null) ?? null,
    promotedCount: porCampanha.get(c.id as string) ?? 0,
    // Os dois somados: separados no banco para saber qual estourou, somados na
    // lista porque é o total que interessa a quem olha de fora.
    costUsd:
      (Number(c.discovery_cost_usd) || 0) + (Number(c.enrichment_cost_usd) || 0),
    createdAt: c.created_at as string,
  }))
}
