"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"

import { requireCommercialMember } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeCityMatch, isBrazilStateCode } from "@/lib/br-locations"
import { leadFromProspectSchema } from "@/lib/validations/lead"
import type { DigitalChannelDraft } from "@/lib/leads/digital-channels"
import type { ProspectIdentity } from "@/lib/prospect/types"

import { ensureSegment } from "../leads/sync-lead-segment"
import { CAMPAIGN_NOT_FOUND, loadCampaign, loadOptOuts } from "./campaign-access"

/**
 * Prospect vira lead.
 *
 * É o ponto onde a prospecção encontra o módulo que já existia, e onde três
 * coisas precisam ser verdade ao mesmo tempo:
 *
 * **1. Não duplicar o board.** A chave forte é o `place_id`, que já é único
 * global em `lead_gbp_profiles`. Uma campanha em Guarulhos vai redescobrir
 * leads que já existem, e criar de novo seria pior que não promover.
 *
 * **2. Promover quem não tem site.** Entre 60% e 79% das empresas de um
 * segmento local não têm — e, para uma agência de SEO, é justamente esse o
 * lead mais quente. Deles, o canal primário é o perfil no Google.
 *
 * **3. Honrar o descadastro.** A consulta é refeita aqui, e não só na
 * descoberta: o pedido pode ter chegado depois de a lista estar montada.
 */

export type PromoteProspectsState =
  | {
      status: "success"
      created: number
      /** Já existiam no board, com o id do lead para a tela linkar. */
      existing: Array<{ prospectId: string; leadId: string; title: string }>
      /** Recusados, com o porquê em português. */
      refused: Array<{ prospectId: string; title: string; reason: string }>
      message: string
    }
  | { status: "error"; message: string }

type ProspectToPromote = {
  id: string
  place_id: string | null
  title: string
  domain: string | null
  url: string | null
  phone_e164: string | null
  city: string | null
  category: string | null
  stage: string
}

export async function promoteProspectsToLeads(
  campaignId: string,
  prospectIds: string[],
): Promise<PromoteProspectsState> {
  const { user } = await requireCommercialMember()
  if (prospectIds.length === 0) {
    return { status: "error", message: "Selecione ao menos uma empresa." }
  }
  if (prospectIds.length > 200) {
    return {
      status: "error",
      message: "Promova no máximo 200 empresas por vez.",
    }
  }

  const supabase = await createClient()
  const campanha = await loadCampaign(supabase, campaignId)
  if (!campanha) return { status: "error", message: CAMPAIGN_NOT_FOUND }
  if (!isBrazilStateCode(campanha.state_code)) {
    return { status: "error", message: "A campanha está sem UF válida." }
  }

  const { data } = await supabase
    .from("prospects")
    .select("id, place_id, title, domain, url, phone_e164, city, category, stage")
    .eq("campaign_id", campaignId)
    .in("id", prospectIds)

  const prospects = (data ?? []) as ProspectToPromote[]
  if (prospects.length === 0) {
    return { status: "error", message: "Nenhuma empresa encontrada." }
  }

  const optOuts = await loadOptOuts(supabase)

  /* --- quem já é lead ---------------------------------------------------- */
  const placeIds = prospects
    .map((p) => p.place_id)
    .filter((id): id is string => Boolean(id))

  const jaSaoLeads = new Map<string, string>()

  if (placeIds.length > 0) {
    const { data: perfis } = await supabase
      .from("lead_gbp_profiles")
      .select("place_id, lead_id")
      .in("place_id", placeIds)
    for (const row of perfis ?? []) {
      const r = row as { place_id: string; lead_id: string }
      jaSaoLeads.set(r.place_id, r.lead_id)
    }

    const { data: canais } = await supabase
      .from("lead_digital_channels")
      .select("normalized_key, lead_id")
      .eq("type", "google_business")
      .in("normalized_key", placeIds)
    for (const row of canais ?? []) {
      const r = row as { normalized_key: string; lead_id: string }
      if (!jaSaoLeads.has(r.normalized_key)) {
        jaSaoLeads.set(r.normalized_key, r.lead_id)
      }
    }
  }

  const dominios = prospects
    .map((p) => p.domain)
    .filter((d): d is string => Boolean(d))
  const dominioParaLead = new Map<string, string>()
  if (dominios.length > 0) {
    const { data: canais } = await supabase
      .from("lead_digital_channels")
      .select("normalized_key, lead_id")
      .eq("type", "website")
      .in("normalized_key", dominios)
    for (const row of canais ?? []) {
      const r = row as { normalized_key: string; lead_id: string }
      dominioParaLead.set(r.normalized_key, r.lead_id)
    }
  }

  /* --- montagem ---------------------------------------------------------- */
  const cidadeCampanha =
    normalizeCityMatch(campanha.state_code, campanha.city) ?? campanha.city

  const existing: Array<{
    prospectId: string
    leadId: string
    title: string
  }> = []
  const refused: Array<{ prospectId: string; title: string; reason: string }> = []
  const aCriar: Array<{
    prospect: ProspectToPromote
    leadId: string
    payload: ReturnType<typeof leadFromProspectSchema.parse>
    segmentName: string
  }> = []

  for (const p of prospects) {
    if (p.stage === "promoted") {
      refused.push({
        prospectId: p.id,
        title: p.title,
        reason: "Já promovida.",
      })
      continue
    }
    if (p.place_id && optOuts.placeIds.has(p.place_id)) {
      refused.push({ prospectId: p.id, title: p.title, reason: "Descadastrada." })
      continue
    }
    if (p.phone_e164 && optOuts.phones.has(p.phone_e164)) {
      refused.push({ prospectId: p.id, title: p.title, reason: "Descadastrada." })
      continue
    }
    if (p.domain && optOuts.domains.has(p.domain)) {
      refused.push({ prospectId: p.id, title: p.title, reason: "Descadastrada." })
      continue
    }

    const leadExistente =
      (p.place_id ? jaSaoLeads.get(p.place_id) : undefined) ??
      (p.domain ? dominioParaLead.get(p.domain) : undefined)
    if (leadExistente) {
      existing.push({ prospectId: p.id, leadId: leadExistente, title: p.title })
      continue
    }

    const channels: DigitalChannelDraft[] = []
    if (p.url) channels.push({ type: "website", value: p.url, is_primary: true })
    if (p.place_id) {
      channels.push({
        type: "google_business",
        value: p.place_id,
        // Primário quando não há site: é o canal que dá a chave de dedupe.
        is_primary: !p.url,
      })
    }

    if (channels.length === 0) {
      refused.push({
        prospectId: p.id,
        title: p.title,
        reason: "Sem site e sem perfil no Google — não há como deduplicar.",
      })
      continue
    }

    const cidade = p.city
      ? (normalizeCityMatch(campanha.state_code, p.city) ?? cidadeCampanha)
      : cidadeCampanha

    const segmentName = p.category?.trim() || campanha.name

    const parsed = leadFromProspectSchema.safeParse({
      company_name: p.title.slice(0, 200),
      channels,
      contact_name: "",
      phone: p.phone_e164 ?? "",
      email: "",
      observations: "",
      segment: segmentName.slice(0, 64),
      state_code: campanha.state_code,
      city: cidade,
    })

    if (!parsed.success) {
      refused.push({
        prospectId: p.id,
        title: p.title,
        reason: parsed.error.issues[0]?.message ?? "Dados incompletos.",
      })
      continue
    }

    aCriar.push({
      prospect: p,
      leadId: randomUUID(),
      payload: parsed.data,
      segmentName: segmentName.slice(0, 64),
    })
  }

  /* --- gravação ---------------------------------------------------------- */
  let created = 0

  for (const item of aCriar) {
    const segment = await ensureSegment(supabase, item.segmentName)
    if (!segment) {
      refused.push({
        prospectId: item.prospect.id,
        title: item.prospect.title,
        reason: "Não foi possível salvar o segmento.",
      })
      continue
    }

    const { error } = await supabase.from("leads").insert({
      id: item.leadId,
      company_name: item.payload.company_name,
      website: item.payload.website,
      website_domain: item.payload.website_domain,
      contact_name: item.payload.contact_name,
      phone: item.payload.phone,
      email: item.payload.email,
      segment_id: segment.id,
      state_code: item.payload.state_code,
      city: item.payload.city,
      status: "new",
      assigned_sdr_id: null,
      created_by: user.id,
    })

    if (error) {
      refused.push({
        prospectId: item.prospect.id,
        title: item.prospect.title,
        reason:
          error.code === "23505"
            ? "Já existe um lead com esse site."
            : "Não foi possível criar o lead.",
      })
      continue
    }

    const { error: erroCanais } = await supabase
      .from("lead_digital_channels")
      .insert(
        item.payload.channels.map((c) => ({
          lead_id: item.leadId,
          type: c.type,
          value: c.value,
          normalized_key: c.normalized_key,
          is_primary: c.is_primary,
          sort_order: c.sort_order,
        })),
      )

    if (erroCanais) {
      // Rollback manual com service role: `leads` não recebe grant de delete,
      // e lead sem canal não tem chave de dedupe — voltaria a cada campanha.
      try {
        await createAdminClient().from("leads").delete().eq("id", item.leadId)
      } catch {}
      refused.push({
        prospectId: item.prospect.id,
        title: item.prospect.title,
        reason:
          erroCanais.code === "23505"
            ? "Um dos canais já está cadastrado em outro lead."
            : "Não foi possível criar o lead.",
      })
      continue
    }

    await supabase
      .from("prospects")
      .update({
        stage: "promoted",
        promoted_lead_id: item.leadId,
        promoted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.prospect.id)

    created += 1
  }

  revalidatePath("/leads")
  revalidatePath(`/prospeccao/${campaignId}`)

  const partes: string[] = []
  if (created > 0) partes.push(`${created} lead${created > 1 ? "s" : ""} criado${created > 1 ? "s" : ""}`)
  if (existing.length > 0) partes.push(`${existing.length} já no board`)
  if (refused.length > 0) partes.push(`${refused.length} recusado${refused.length > 1 ? "s" : ""}`)

  return {
    status: "success",
    created,
    existing,
    refused,
    message: partes.join(", ") || "Nada a promover.",
  }
}

/* ========================================================================== */

export type DismissProspectsState =
  | { status: "success"; dismissed: number }
  | { status: "error"; message: string }

export async function dismissProspects(
  campaignId: string,
  prospectIds: string[],
  reason: string,
): Promise<DismissProspectsState> {
  await requireCommercialMember()
  if (prospectIds.length === 0) {
    return { status: "error", message: "Selecione ao menos uma empresa." }
  }
  const motivo = reason.trim().slice(0, 200)
  if (motivo.length < 2) {
    return { status: "error", message: "Diga por que está descartando." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("prospects")
    .update({
      stage: "dismissed",
      dismissed_at: new Date().toISOString(),
      dismissed_reason: motivo,
      updated_at: new Date().toISOString(),
    })
    .eq("campaign_id", campaignId)
    .in("id", prospectIds)
    .neq("stage", "promoted")
    .select("id")

  if (error) {
    return { status: "error", message: "Não foi possível descartar." }
  }
  revalidatePath(`/prospeccao/${campaignId}`)
  return { status: "success", dismissed: (data ?? []).length }
}

/* ========================================================================== */

export type RegisterOptOutState =
  | { status: "success" }
  | { status: "error"; message: string }

/**
 * Registra um descadastro.
 *
 * Bloqueia na origem: a descoberta filtra contra esta tabela antes de gravar o
 * prospect, e a promoção consulta de novo. Guardar o pedido numa planilha à
 * parte seria o mesmo que não ter — e honrar opt-out é o que sustenta
 * prospecção fria por legítimo interesse.
 *
 * O prospect correspondente é descartado na mesma operação: manter na lista
 * quem pediu para sair é o erro que o registro existe para evitar.
 */
export async function registerProspectOptOut(input: {
  kind: "tax_id" | "domain" | "email" | "phone" | "place_id"
  value: string
  reason?: string
}): Promise<RegisterOptOutState> {
  const { user } = await requireCommercialMember()
  const valor = input.value.trim().toLowerCase()
  if (valor.length < 3) {
    return { status: "error", message: "Informe o contato a descadastrar." }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("prospect_optouts").upsert(
    {
      kind: input.kind,
      value_key: valor,
      reason: input.reason?.trim().slice(0, 500) ?? null,
      created_by: user.id,
    },
    { onConflict: "kind,value_key" },
  )

  if (error) {
    return { status: "error", message: "Não foi possível registrar." }
  }

  const coluna =
    input.kind === "phone"
      ? "phone_e164"
      : input.kind === "domain"
        ? "domain"
        : input.kind === "place_id"
          ? "place_id"
          : null

  if (coluna) {
    await supabase
      .from("prospects")
      .update({
        stage: "dismissed",
        dismissed_at: new Date().toISOString(),
        dismissed_reason: "Descadastro solicitado.",
        updated_at: new Date().toISOString(),
      })
      .eq(coluna, valor)
      .neq("stage", "promoted")
  }

  revalidatePath("/prospeccao")
  return { status: "success" }
}
