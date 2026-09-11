"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import {
  fetchLlmMultiTargetLive,
  fetchLlmSearchMentionsLive,
  type GeoMentionTargetInput,
} from "@/lib/dataforseo/ai-optimization"
import {
  GEO_AUTHORITY_DOMAINS,
  GEO_MENTIONS_COMPETITORS_LIMIT,
  LLM_MENTIONS_LIMIT,
} from "@/lib/dataforseo/limits"
import {
  readLeadGeoAuditRow,
  type GeoMentionMeasuredBy,
  type GeoSnapshot,
  type LeadGeoAudit,
} from "@/lib/leads/geo-audit"
import {
  mapAiMentions,
  mapGeoCitationPrompts,
  mapGeoCitations,
} from "@/lib/leads/geo-mentions"
import { readLeadBacklinkAuditRow } from "@/lib/leads/backlinks-audit"
import { analyzeGeoSchema, readAnalyzeGeoFields } from "@/lib/validations/lead-geo"
import { denyGeoEdit, GEO_SELECT, loadGeoAuditByLead } from "./geo-access"

export type CollectGeoMentionsState =
  | { status: "success"; audit: LeadGeoAudit }
  | { status: "error"; message: string }

const FAILED = "Não foi possível coletar as menções em IA. Tente novamente."
const NO_BASE =
  "Rode a análise de Presença em IA antes: as menções entram no snapshot dela."
const NO_COMPETITORS =
  "Rode a análise de Backlinks antes: a comparação precisa de pelo menos um concorrente."

const LEAD_KEY = "lead"

/**
 * Menções em IA — a chamada paga da etapa.
 *
 * **Uma chamada sempre, uma condicional.** `multi_target_metrics` entrega duas
 * coisas de uma vez: quantas respostas de IA citam cada alvo, e quais domínios
 * a IA cita nas respostas em que o lead aparece. US$ 0,10 + US$ 0,001 por
 * linha.
 *
 * A segunda — `search_mentions`, o detalhe por pergunta — **só roda quando o
 * lead tem menção**. A chamada custa os mesmos US$ 0,10 mesmo devolvendo zero
 * linha, e lead sem menção vai ser a maioria.
 *
 * **Append-only.** Grava um snapshot novo com o resto recopiado da coleta base
 * mais recente, em vez de dar `update`. A tabela é append-only desde o dia 1 e
 * a pergunta "qual das cópias vale?" não pode passar a existir.
 */
export async function collectLeadGeoMentions(
  formData: FormData,
): Promise<CollectGeoMentionsState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = analyzeGeoSchema.safeParse(readAnalyzeGeoFields(formData))
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? FAILED,
    }
  }

  const supabase = await createClient()
  const loaded = await loadGeoAuditByLead(supabase, parsed.data.lead_id)
  if (loaded.status === "error") return { status: "error", message: FAILED }
  if (loaded.status === "not_found") {
    return { status: "error", message: "Lead não encontrado." }
  }

  const denied = denyGeoEdit(loaded.lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  // A base é o que esta action estende. Sem ela não há snapshot onde encaixar.
  const base = loaded.audit
  if (!base) return { status: "error", message: NO_BASE }

  const { data: backlinkRow } = await supabase
    .from("lead_backlink_audits")
    .select("id, lead_id, domain, snapshot, fetched_at, fetched_by")
    .eq("lead_id", parsed.data.lead_id)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const backlinks = backlinkRow
    ? readLeadBacklinkAuditRow(backlinkRow as Record<string, unknown>)
    : null

  const leadDomain = base.domain
  const leadName = loaded.lead.company_name.trim() || null

  const measuredBy: Record<string, GeoMentionMeasuredBy> = {
    [LEAD_KEY]: leadName ? "brand_and_domain" : "domain",
  }
  const labels: Record<string, string> = {
    [LEAD_KEY]: leadName ?? leadDomain,
  }
  const targets: GeoMentionTargetInput[] = [
    { key: LEAD_KEY, brand: leadName, domain: leadDomain },
  ]

  for (const competitor of (backlinks?.snapshot.competitors ?? []).slice(
    0,
    GEO_MENTIONS_COMPETITORS_LIMIT,
  )) {
    const domain = competitor.domain.trim().toLowerCase()
    if (!domain || domain === leadDomain) continue
    const key = `c_${targets.length}`
    targets.push({ key, brand: null, domain })
    // Concorrente de backlink vem com domínio e sem nome. Derivar o nome do
    // domínio erra em casos comuns, então ele é medido só pelo domínio — e a
    // tela precisa marcar isso, senão a comparação favorece o lead por
    // construção.
    measuredBy[key] = "domain"
    labels[key] = domain
  }

  // A API recusa `multi_target_metrics` com um alvo só.
  if (targets.length < 2) {
    return { status: "error", message: NO_COMPETITORS }
  }

  const multi = await fetchLlmMultiTargetLive({ targets })
  if (multi.status === "error") {
    return { status: "error", message: multi.message }
  }

  let costUsd = multi.cost ?? 0

  const aiMentions = mapAiMentions({
    result: multi.result,
    leadKey: LEAD_KEY,
    labels,
    measuredBy,
  })
  const citations = mapGeoCitations({
    result: multi.result,
    leadKey: LEAD_KEY,
    leadDomain,
    authorityDomains: GEO_AUTHORITY_DOMAINS,
    limit: LLM_MENTIONS_LIMIT,
  })

  // A condicional. Lead sem menção não paga US$ 0,10 por uma chamada que não
  // pode trazer nada — e `prompts` continua `null`, que é "não pedido", nunca
  // "pedido e vazio".
  if (citations && citations.mentions > 0) {
    const detail = await fetchLlmSearchMentionsLive({ domain: leadDomain })
    if (detail.status === "ok") {
      costUsd += detail.cost ?? 0
      citations.prompts = mapGeoCitationPrompts({
        result: detail.result,
        leadDomain,
      })
    }
    // Falhar aqui **não** derruba a coleta: o agregado é a entrega principal e
    // o detalhe degrada para "não pedido". Mesmo desenho do benchmark de
    // backlinks.
  }

  const collectedAt = new Date().toISOString()
  const snapshot: GeoSnapshot = {
    ...base.snapshot,
    collectedAt,
    // Soma o que a base já gastou: o snapshot novo substitui o anterior na
    // leitura, e um custo que só contasse esta chamada esconderia a demanda em
    // IA que a coleta base pagou.
    costUsd: (base.snapshot.costUsd ?? 0) + costUsd,
    citations,
    aiMentions,
  }

  const { data, error } = await supabase
    .from("lead_geo_audits")
    .insert({
      lead_id: parsed.data.lead_id,
      domain: leadDomain,
      snapshot,
      fetched_at: collectedAt,
      fetched_by: user.id,
    })
    .select(GEO_SELECT)
    .single()

  if (error || !data) return { status: "error", message: FAILED }
  const audit = readLeadGeoAuditRow(data as Record<string, unknown>)
  if (!audit) return { status: "error", message: FAILED }
  return { status: "success", audit }
}
