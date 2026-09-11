"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { fetchLlmSearchMentionsLive } from "@/lib/dataforseo/ai-optimization"
import {
  GEO_AUTHORITY_DOMAINS,
  GEO_MENTIONS_COMPETITORS_LIMIT,
  LLM_MENTIONS_LIMIT,
} from "@/lib/dataforseo/limits"
import {
  readLeadGeoAuditRow,
  type GeoSnapshot,
  type LeadGeoAudit,
} from "@/lib/leads/geo-audit"
import {
  mapGeoCitations,
  mentionsFromCitations,
} from "@/lib/leads/geo-mentions"
import { analyzeGeoSchema, readAnalyzeGeoFields } from "@/lib/validations/lead-geo"
import { denyGeoEdit, GEO_SELECT, loadGeoAuditByLead } from "./geo-access"

export type CollectGeoMentionsState =
  | { status: "success"; audit: LeadGeoAudit }
  | { status: "error"; message: string }

const FAILED = "Não foi possível coletar as menções em IA. Tente novamente."
const NO_BASE =
  "Rode a análise de Presença em IA antes: as menções entram no snapshot dela."
/**
 * Menções em IA — a chamada paga da etapa.
 *
 * **Uma chamada só**, de US$ 0,10 + US$ 0,001 por linha.
 *
 * `search_mentions` traz as perguntas em que a IA cita o lead, com as fontes de
 * cada resposta. Disso sai tudo: quantas respostas citam o negócio, quais
 * domínios a IA lê no mercado dele, e a comparação com quem aparece ao lado.
 *
 * A segunda chamada — `multi_target_metrics` — foi tentada e **reprovada**: ela
 * mede o total de cada domínio no dataset inteiro, que é outro universo, e o
 * percentual que saía dali era lisonjeiro ou esmagador conforme os portais
 * grandes que entrassem na amostra.
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

  const leadDomain = base.domain
  const leadName = loaded.lead.company_name.trim() || null

  // 1. As perguntas primeiro. É a chamada que traz, de uma vez, quantas
  //    respostas citam o lead E quais domínios a IA cita ao lado dele.
  const detail = await fetchLlmSearchMentionsLive({ domain: leadDomain })
  if (detail.status === "error") {
    return { status: "error", message: detail.message }
  }
  const costUsd = detail.cost ?? 0

  const citations = mapGeoCitations({
    result: detail.result,
    leadDomain,
    authorityDomains: GEO_AUTHORITY_DOMAINS,
    limit: LLM_MENTIONS_LIMIT,
  })

  // 2. A comparação sai das MESMAS fontes, sem segunda chamada.
  //
  //    `multi_target_metrics` foi tentado e reprovado em 2026-09-11: ele mede
  //    o total de cada domínio no dataset INTEIRO, não nas respostas do lead.
  //    Trouxe `mobills.com.br` com 17.919 menções contra as 2 do lead, e o
  //    "share" virou 0,007%. Antes disso, com concorrentes de backlink, tinha
  //    dado 67%. Os dois números errados pela mesma causa — universo errado.
  //
  //    Derivada das fontes das perguntas medidas, a conta dá 10,6% para este
  //    lead, que é a ordem de grandeza dos 9% do relatório de referência. E
  //    economiza US$ 0,10 por lead.
  const aiMentions = citations
    ? mentionsFromCitations({
        citations,
        leadDomain,
        leadLabel: leadName ?? leadDomain,
        limit: GEO_MENTIONS_COMPETITORS_LIMIT + 1,
      })
    : null

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
