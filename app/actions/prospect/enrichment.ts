"use server"

import { randomUUID } from "node:crypto"

import { requireCommercialMember } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { isValidCnpj } from "@/lib/br-documents"
import { isDataForSeoConfigured } from "@/lib/dataforseo/configured"
import {
  getDataForSeoTask,
  postDataForSeoTasks,
} from "@/lib/dataforseo/client"
import {
  mapSerpOrganic,
  serpOrganicTask,
  SERP_ORGANIC_TASK_GET_PATH,
  SERP_ORGANIC_TASK_POST_PATH,
} from "@/lib/dataforseo/serp-organic"
import { lookupCnpj } from "@/lib/cnpj/public-api"
import {
  canAutoConfirm,
  rankCandidates,
  scoreCandidate,
  type ScoredCandidate,
} from "@/lib/prospect/cnpj-match"
import {
  PROSPECT_PASS_BUDGET_MS,
  STAGE_CONFIG,
  nextStageToWork,
  pipelineProgress,
  selectForPoll,
  selectForPost,
  stagesToEnqueue,
  type ProspectTaskRow,
} from "@/lib/prospect/pipeline"
import { fetchSiteFindings } from "@/lib/prospect/site-fetch"
import {
  personQuery,
  primaryPartner,
  socialFromSerpUrl,
  socialQuery,
  taxIdQuery,
  taxIdsFromSerpText,
} from "@/lib/prospect/serp-queries"
import { budgetExhausted, queueTaskTag, parseQueueTaskTag } from "@/lib/queue/task-queue"
import type {
  ProspectContact,
  ProspectIdentity,
  ProspectStage,
} from "@/lib/prospect/types"

import { CAMPAIGN_NOT_FOUND, loadCampaign } from "./campaign-access"

/**
 * O enriquecimento: enfileirar, trabalhar, e parar na hora certa.
 *
 * Segue à risca o contrato de fila que este repositório pagou caro para
 * aprender — `task_id` antes de tudo, lease por UPDATE atômico, teto de
 * tentativa, quatro estados — e acrescenta o que faltava na implementação de
 * referência: **orçamento de parede**. `pollResearchSerpTasks` itera
 * sequencialmente sem teto de relógio, e com 200 linhas e um `task_get` de até
 * 20 s estoura no meio do `maxDuration`, deixando lease preso.
 *
 * Duas naturezas na mesma tabela: `site` e `identity` são trabalho nosso e
 * fecham numa passada (`pending → done`); `social` e `person` compram tarefa e
 * passam por `queued`.
 */

const BR_LOCATION_CODE = 2076 // Brasil
const SERP_LANGUAGE = "pt"

/* ========================================================================== */
/*  Enfileirar                                                                */
/* ========================================================================== */

export type EnqueueEnrichmentState =
  | { status: "success"; runId: string; queued: number }
  | { status: "error"; message: string }

type ProspectGateRow = {
  id: string
  domain: string | null
  listing: Record<string, unknown> | null
}

export async function enqueueProspectEnrichment(
  campaignId: string,
  prospectIds: string[],
): Promise<EnqueueEnrichmentState> {
  await requireCommercialMember()
  if (prospectIds.length === 0) {
    return { status: "error", message: "Selecione ao menos uma empresa." }
  }

  const supabase = await createClient()
  const campanha = await loadCampaign(supabase, campaignId)
  if (!campanha) return { status: "error", message: CAMPAIGN_NOT_FOUND }

  const { data: prospects } = await supabase
    .from("prospects")
    .select("id, domain, listing")
    .eq("campaign_id", campaignId)
    .in("id", prospectIds.slice(0, 1000))
    .in("stage", ["discovered", "enriching", "enriched"])

  if (!prospects || prospects.length === 0) {
    return { status: "error", message: "Nenhuma empresa elegível." }
  }

  const runId = randomUUID()
  const linhas: Array<Record<string, unknown>> = []

  for (const row of prospects as ProspectGateRow[]) {
    const stages = stagesToEnqueue({
      prospectId: row.id,
      hasDomain: Boolean(row.domain),
      hasSocialFromListing: false,
      siteSettled: false,
      siteFoundSocial: false,
      identitySettled: false,
      identityFoundPerson: false,
      personRequested: false,
    })
    for (const stage of stages) {
      linhas.push({
        campaign_id: campaignId,
        prospect_id: row.id,
        run_id: runId,
        stage,
        status: "pending",
      })
    }
  }

  if (linhas.length === 0) {
    return { status: "error", message: "Nada a enriquecer nesta seleção." }
  }

  const { error } = await supabase
    .from("prospect_enrichment_tasks")
    .insert(linhas)
  if (error) {
    return { status: "error", message: "Não foi possível iniciar o enriquecimento." }
  }

  await supabase
    .from("prospects")
    .update({ stage: "enriching", updated_at: new Date().toISOString() })
    .eq("campaign_id", campaignId)
    .in(
      "id",
      (prospects as ProspectGateRow[]).map((p) => p.id),
    )

  return { status: "success", runId, queued: linhas.length }
}

/* ========================================================================== */
/*  A passada de trabalho                                                     */
/* ========================================================================== */

export type PollEnrichmentState =
  | {
      status: "success"
      progress: ReturnType<typeof pipelineProgress>
      worked: number
      costUsd: number
    }
  | { status: "idle" }
  | { status: "error"; message: string }

type TarefaRow = {
  id: string
  prospect_id: string
  run_id: string
  stage: ProspectStage
  status: "pending" | "queued" | "done" | "failed"
  task_id: string | null
  attempts: number
  polling_at: string | null
  found: boolean | null
}

function toQueueRow(row: TarefaRow): ProspectTaskRow {
  return {
    id: row.id,
    prospectId: row.prospect_id,
    stage: row.stage,
    status: row.status,
    taskId: row.task_id,
    attempts: row.attempts,
    pollingAt: row.polling_at,
    found: row.found,
  }
}

export async function pollProspectEnrichment(
  campaignId: string,
): Promise<PollEnrichmentState> {
  const iniciou = Date.now()
  await requireCommercialMember()
  const supabase = await createClient()

  const { data: brutas } = await supabase
    .from("prospect_enrichment_tasks")
    .select(
      "id, prospect_id, run_id, stage, status, task_id, attempts, polling_at, found",
    )
    .eq("campaign_id", campaignId)

  const tarefas = (brutas ?? []) as TarefaRow[]
  if (tarefas.length === 0) return { status: "idle" }

  const fila = tarefas.map(toQueueRow)
  const stage = nextStageToWork(fila)
  if (!stage) {
    return {
      status: "success",
      progress: pipelineProgress(fila),
      worked: 0,
      costUsd: 0,
    }
  }

  const porId = new Map(tarefas.map((t) => [t.id, t]))
  let worked = 0
  let costUsd = 0

  if (stage === "site" || stage === "identity") {
    const alvos = selectForPost(fila, stage)
    for (const alvo of alvos) {
      if (budgetExhausted(iniciou, Date.now(), PROSPECT_PASS_BUDGET_MS)) break
      const linha = porId.get(alvo.id)
      if (!linha) continue
      const travada = await leaseTask(supabase, linha.id, "pending")
      if (!travada) continue
      const gasto =
        stage === "site"
          ? await workSiteStage(supabase, linha)
          : await workIdentityStage(supabase, linha)
      costUsd += gasto
      worked += 1
    }
  } else {
    const gasto = await workPaidStage(supabase, campaignId, stage, fila, porId, iniciou)
    costUsd += gasto.costUsd
    worked += gasto.worked
  }

  if (costUsd > 0) {
    const campanha = await loadCampaign(supabase, campaignId)
    if (campanha) {
      await supabase
        .from("prospect_campaigns")
        .update({
          enrichment_cost_usd: Number(campanha.enrichment_cost_usd) + costUsd,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId)
    }
  }

  const { data: depois } = await supabase
    .from("prospect_enrichment_tasks")
    .select(
      "id, prospect_id, run_id, stage, status, task_id, attempts, polling_at, found",
    )
    .eq("campaign_id", campaignId)

  return {
    status: "success",
    progress: pipelineProgress(((depois ?? []) as TarefaRow[]).map(toQueueRow)),
    worked,
    costUsd,
  }
}

/* -------------------------------------------------------------------------- */
/*  Lease                                                                     */
/* -------------------------------------------------------------------------- */

type Db = Awaited<ReturnType<typeof createClient>>

/**
 * A trava. `UPDATE ... WHERE` atômico, nunca comparação de status contra ele
 * mesmo: duas abas abertas na mesma campanha passavam as duas.
 */
async function leaseTask(
  supabase: Db,
  taskRowId: string,
  fromStatus: "pending" | "queued",
): Promise<boolean> {
  const agora = new Date().toISOString()
  const limite = new Date(Date.now() - STAGE_CONFIG.site.leaseMs).toISOString()
  const { data } = await supabase
    .from("prospect_enrichment_tasks")
    .update({ polling_at: agora, updated_at: agora })
    .eq("id", taskRowId)
    .eq("status", fromStatus)
    .or(`polling_at.is.null,polling_at.lt.${limite}`)
    .select("id")
    .maybeSingle()
  return Boolean(data)
}

async function settleTask(
  supabase: Db,
  taskRowId: string,
  patch: {
    /** `pending` é a repescagem: a linha volta para a fila. */
    status: "done" | "failed" | "queued" | "pending"
    found?: boolean | null
    result?: unknown
    error?: string | null
    taskId?: string | null
    costUsd?: number | null
    attempts?: number
  },
) {
  const update: Record<string, unknown> = {
    status: patch.status,
    // A constraint do banco exige `found` nulo fora de `done`: resposta antes
    // da pergunta é o que faria o portão da etapa seguinte abrir cedo.
    found: patch.status === "done" ? (patch.found ?? false) : null,
    result: patch.result ?? null,
    error_message: patch.error ?? null,
    cost_usd: patch.costUsd ?? null,
    polling_at: null,
    updated_at: new Date().toISOString(),
  }
  if (patch.attempts !== undefined) update.attempts = patch.attempts
  // `"taskId" in patch` e não `?? undefined`: passar `null` aqui significa
  // LIMPAR o identificador, e o coalescing transformaria essa intenção em
  // "não mexe" — deixando a linha apontando para uma tarefa que falhou.
  if ("taskId" in patch) update.task_id = patch.taskId

  await supabase
    .from("prospect_enrichment_tasks")
    .update(update)
    .eq("id", taskRowId)
}

async function recordEnrichment(
  supabase: Db,
  input: {
    prospectId: string
    stage: ProspectStage
    source: string
    payload: unknown
    confidence?: number | null
    costUsd?: number | null
    requestedBy?: string | null
  },
) {
  await supabase.from("prospect_enrichments").insert({
    prospect_id: input.prospectId,
    stage: input.stage,
    source: input.source,
    payload: input.payload,
    confidence: input.confidence ?? null,
    cost_usd: input.costUsd ?? null,
    requested_by: input.requestedBy ?? null,
  })
}

/* -------------------------------------------------------------------------- */
/*  Etapa: site                                                               */
/* -------------------------------------------------------------------------- */

async function workSiteStage(supabase: Db, linha: TarefaRow): Promise<number> {
  const { data: prospect } = await supabase
    .from("prospects")
    .select("id, domain")
    .eq("id", linha.prospect_id)
    .maybeSingle()

  const domain = (prospect as { domain: string | null } | null)?.domain
  if (!domain) {
    // Sem domínio a etapa não tinha por que existir. `done` vazio, e não
    // `failed`: não houve falha nenhuma.
    await settleTask(supabase, linha.id, { status: "done", found: false })
    return 0
  }

  const visitado = await fetchSiteFindings(domain)

  if (visitado.status === "blocked") {
    // `Disallow` é uma resposta, não um erro. Retentar seria insistir contra
    // uma decisão explícita do dono do site.
    await settleTask(supabase, linha.id, {
      status: "done",
      found: false,
      result: { blocked: visitado.reason },
    })
    return 0
  }

  if (visitado.status === "error") {
    const tentativas = linha.attempts + 1
    await settleTask(supabase, linha.id, {
      status: tentativas >= STAGE_CONFIG.site.maxAttempts ? "failed" : "pending",
      error: visitado.message,
      attempts: tentativas,
    })
    return 0
  }

  await recordEnrichment(supabase, {
    prospectId: linha.prospect_id,
    stage: "site",
    source: "site_crawl",
    payload: {
      taxIds: visitado.findings.taxIds,
      contacts: visitado.findings.contacts,
      pagesFetched: visitado.pagesFetched,
    },
  })

  await settleTask(supabase, linha.id, {
    status: "done",
    found: visitado.findings.found,
    result: {
      taxIds: visitado.findings.taxIds,
      contactCount: visitado.findings.contacts.length,
    },
  })
  return 0
}

/* -------------------------------------------------------------------------- */
/*  Etapa: identidade                                                         */
/* -------------------------------------------------------------------------- */

type ProspectForMatch = {
  id: string
  title: string
  phone_e164: string | null
  zip: string | null
  street_number: string | null
  city: string | null
  domain: string | null
}

async function workIdentityStage(
  supabase: Db,
  linha: TarefaRow,
): Promise<number> {
  const { data } = await supabase
    .from("prospects")
    .select("id, title, phone_e164, zip, street_number, city, domain")
    .eq("id", linha.prospect_id)
    .maybeSingle()
  const prospect = data as ProspectForMatch | null
  if (!prospect) {
    await settleTask(supabase, linha.id, { status: "done", found: false })
    return 0
  }

  // Os CNPJs que a etapa `site` já trouxe. É a fonte exata e gratuita, e por
  // isso vem primeiro: rodar a busca paga antes dela seria pagar por um
  // "provável" que o auto-declarado teria derrubado.
  const { data: doSite } = await supabase
    .from("prospect_enrichments")
    .select("payload")
    .eq("prospect_id", linha.prospect_id)
    .eq("stage", "site")
    .order("collected_at", { ascending: false })
    .limit(1)

  const candidatosDoSite: string[] = []
  const payload = (doSite ?? [])[0]?.payload as
    | { taxIds?: unknown }
    | undefined
  if (Array.isArray(payload?.taxIds)) {
    for (const t of payload.taxIds) {
      if (typeof t === "string" && isValidCnpj(t)) candidatosDoSite.push(t)
    }
  }

  const listing = {
    title: prospect.title,
    phoneE164: prospect.phone_e164,
    zip: prospect.zip,
    streetNumber: prospect.street_number,
    city: prospect.city,
    domain: prospect.domain,
  }

  const pontuados: ScoredCandidate[] = []
  let identityEscolhida: ProspectIdentity | null = null

  for (const taxId of candidatosDoSite.slice(0, 3)) {
    const consulta = await lookupCnpj(taxId)
    if (consulta.status !== "ok") continue
    const c = scoreCandidate(listing, consulta.identity, "cnpj_site")
    pontuados.push(c)
    if (!identityEscolhida) identityEscolhida = consulta.identity
  }

  const resultado = rankCandidates(pontuados)

  // Sem CNPJ do site, a etapa fecha sem achar — e a busca paga fica para a
  // etapa `social`/SERP ou para o espelho da Receita, quando existir. Não se
  // compra busca aqui dentro: esta passada é a gratuita, e misturar as duas
  // tornaria o custo da etapa imprevisível.
  if (!resultado.best || !identityEscolhida) {
    await settleTask(supabase, linha.id, {
      status: "done",
      found: false,
      result: {
        candidates: resultado.candidates.map((c) => ({
          taxId: c.taxId,
          confidence: c.confidence,
          reason: c.reason,
          method: c.method,
        })),
        ambiguous: resultado.ambiguous,
      },
    })
    return 0
  }

  const ficha =
    pontuados.find((c) => c.taxId === resultado.best?.taxId) ?? resultado.best

  await recordEnrichment(supabase, {
    prospectId: linha.prospect_id,
    stage: "identity",
    source: "public_cnpj_api",
    payload: {
      identity: identityEscolhida,
      match: {
        method: ficha.method,
        reason: ficha.reason,
        signals: ficha.signals,
        conflicts: ficha.conflicts,
      },
    },
    confidence: ficha.confidence,
  })

  // Só o CNPJ que a própria empresa publicou é gravado como veredito. Todo o
  // resto espera o humano — inclusive um match de 85 pontos, porque 85 pontos
  // continuam sendo inferência nossa.
  if (canAutoConfirm(ficha)) {
    await supabase.from("prospect_reviews").upsert(
      {
        prospect_id: linha.prospect_id,
        cnpj: ficha.taxId,
        cnpj_verdict: "confirmed",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "prospect_id" },
    )
  }

  await settleTask(supabase, linha.id, {
    status: "done",
    found: true,
    result: {
      taxId: ficha.taxId,
      confidence: ficha.confidence,
      reason: ficha.reason,
      method: ficha.method,
    },
  })
  return 0
}

/* -------------------------------------------------------------------------- */
/*  Etapas pagas: social e pessoa                                             */
/* -------------------------------------------------------------------------- */

async function workPaidStage(
  supabase: Db,
  campaignId: string,
  stage: ProspectStage,
  fila: ProspectTaskRow[],
  porId: Map<string, TarefaRow>,
  iniciou: number,
): Promise<{ costUsd: number; worked: number }> {
  if (!isDataForSeoConfigured()) return { costUsd: 0, worked: 0 }

  let costUsd = 0
  let worked = 0

  /* --- resgate do que já foi pago --------------------------------------- */
  const paraBuscar = selectForPoll(fila, stage, Date.now())
  for (const alvo of paraBuscar) {
    if (budgetExhausted(iniciou, Date.now(), PROSPECT_PASS_BUDGET_MS)) {
      return { costUsd, worked }
    }
    const linha = porId.get(alvo.id)
    if (!linha?.task_id) continue
    if (!(await leaseTask(supabase, linha.id, "queued"))) continue

    const resposta = await getDataForSeoTask<Record<string, unknown>>(
      SERP_ORGANIC_TASK_GET_PATH,
      linha.task_id,
    )
    if (resposta.status === "pending") {
      await supabase
        .from("prospect_enrichment_tasks")
        .update({ polling_at: null, updated_at: new Date().toISOString() })
        .eq("id", linha.id)
      continue
    }
    if (resposta.status === "error") {
      const tentativas = linha.attempts + 1
      await settleTask(supabase, linha.id, {
        status:
          tentativas >= STAGE_CONFIG[stage].maxAttempts ? "failed" : "pending",
        error: resposta.message,
        attempts: tentativas,
        // O identificador é descartado de propósito na repescagem: reusar o de
        // uma tarefa que falhou pediria de novo um resultado que não existe.
        taskId: null,
      })
      continue
    }

    costUsd += resposta.cost ?? 0
    await absorbSerpResult(supabase, linha, stage, resposta.data)
    worked += 1
  }

  /* --- compra do que falta ---------------------------------------------- */
  const paraComprar = selectForPost(fila, stage)
  if (paraComprar.length === 0 || budgetExhausted(iniciou, Date.now(), PROSPECT_PASS_BUDGET_MS)) {
    return { costUsd, worked }
  }

  const runId = porId.get(paraComprar[0].id)?.run_id ?? campaignId
  const tarefas: Array<Record<string, unknown>> = []
  const enviadas: string[] = []

  for (const alvo of paraComprar) {
    const linha = porId.get(alvo.id)
    if (!linha) continue
    const keyword = await buildKeyword(supabase, linha, stage)
    if (!keyword) {
      await settleTask(supabase, linha.id, { status: "done", found: false })
      continue
    }
    if (!(await leaseTask(supabase, linha.id, "pending"))) continue
    tarefas.push(
      serpOrganicTask({
        keyword,
        locationCode: BR_LOCATION_CODE,
        languageCode: SERP_LANGUAGE,
        tag: queueTaskTag(runId, linha.id),
        depth: 20,
      }),
    )
    enviadas.push(linha.id)
  }

  if (tarefas.length === 0) return { costUsd, worked }

  const postada = await postDataForSeoTasks(SERP_ORGANIC_TASK_POST_PATH, tarefas)
  if (postada.status === "error") {
    for (const id of enviadas) {
      const linha = porId.get(id)
      const tentativas = (linha?.attempts ?? 0) + 1
      await settleTask(supabase, id, {
        status:
          tentativas >= STAGE_CONFIG[stage].maxAttempts ? "failed" : "pending",
        error: postada.message,
        attempts: tentativas,
      })
    }
    return { costUsd, worked }
  }

  costUsd += postada.cost

  // O `task_id` é a PRIMEIRA escrita depois da compra. Sem ele, a tarefa paga
  // vira órfã e a próxima passada compra tudo de novo — foi assim que 121
  // tarefas da malha viraram treze vezes o mesmo trabalho.
  for (const criada of postada.created) {
    const rowId = parseQueueTaskTag(runId, criada.tag)
    if (!rowId || !enviadas.includes(rowId)) continue
    await supabase
      .from("prospect_enrichment_tasks")
      .update({
        task_id: criada.id,
        status: "queued",
        polling_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rowId)
    worked += 1
  }

  for (const recusada of postada.rejected) {
    const rowId = parseQueueTaskTag(runId, recusada.tag)
    if (!rowId) continue
    await settleTask(supabase, rowId, {
      status: "failed",
      error: recusada.message,
      attempts: STAGE_CONFIG[stage].maxAttempts,
    })
  }

  return { costUsd, worked }
}

async function buildKeyword(
  supabase: Db,
  linha: TarefaRow,
  stage: ProspectStage,
): Promise<string | null> {
  const { data } = await supabase
    .from("prospects")
    .select("title, city, phone_e164")
    .eq("id", linha.prospect_id)
    .maybeSingle()
  const p = data as
    | { title: string; city: string | null; phone_e164: string | null }
    | null
  if (!p) return null

  if (stage === "social") {
    return socialQuery({ title: p.title, city: p.city })
  }

  if (stage === "person") {
    const { data: coleta } = await supabase
      .from("prospect_enrichments")
      .select("payload")
      .eq("prospect_id", linha.prospect_id)
      .eq("stage", "identity")
      .order("collected_at", { ascending: false })
      .limit(1)
    const identity = (coleta ?? [])[0]?.payload as
      | { identity?: ProspectIdentity }
      | undefined
    const socio = primaryPartner(identity?.identity?.partners ?? [])
    if (!socio) return null
    return personQuery({
      partnerName: socio.name,
      companyName: p.title,
      city: p.city,
    })
  }

  return taxIdQuery({ title: p.title, city: p.city, phoneE164: p.phone_e164 })
}

async function absorbSerpResult(
  supabase: Db,
  linha: TarefaRow,
  stage: ProspectStage,
  data: unknown,
) {
  const snapshot = mapSerpOrganic(data)
  const itens = snapshot?.organic ?? []

  const contatos: ProspectContact[] = []
  const cnpjs: string[] = []

  for (const item of itens) {
    const url = (item as { url?: string }).url ?? ""
    const titulo = (item as { title?: string }).title ?? ""
    const trecho = (item as { description?: string }).description ?? ""

    const perfil = socialFromSerpUrl(url)
    if (perfil) {
      contatos.push({
        kind: perfil.kind,
        value: url,
        key: perfil.key,
        source: "serp",
        // Menos que o link no próprio site da empresa: aqui é o buscador
        // associando, não a empresa declarando.
        confidence: 60,
        evidence: url,
      })
    }
    for (const t of taxIdsFromSerpText(`${titulo} ${trecho}`, isValidCnpj)) {
      if (!cnpjs.includes(t)) cnpjs.push(t)
    }
  }

  await recordEnrichment(supabase, {
    prospectId: linha.prospect_id,
    stage,
    source: "serp_organic",
    payload: { contacts: contatos, taxIds: cnpjs },
  })

  await settleTask(supabase, linha.id, {
    status: "done",
    found: contatos.length > 0 || cnpjs.length > 0,
    result: { contactCount: contatos.length, taxIdCount: cnpjs.length },
  })
}

/* ========================================================================== */
/*  A busca do dono — sempre sob pedido                                       */
/* ========================================================================== */

export type RequestPersonState =
  | { status: "success" }
  | { status: "error"; message: string }

/**
 * Enfileira a etapa `person` para um prospect.
 *
 * Nunca em lote, e nunca automaticamente. É a etapa mais cara, a mais lenta e
 * a única que trata dado de pessoa física — e `requested_by` guarda quem
 * pediu, porque coleta de dado pessoal sem autor registrado não tem como ser
 * auditada depois.
 */
export async function requestPersonLookup(
  campaignId: string,
  prospectId: string,
): Promise<RequestPersonState> {
  const { user } = await requireCommercialMember()
  const supabase = await createClient()

  const { data: coleta } = await supabase
    .from("prospect_enrichments")
    .select("payload")
    .eq("prospect_id", prospectId)
    .eq("stage", "identity")
    .order("collected_at", { ascending: false })
    .limit(1)

  const identity = (coleta ?? [])[0]?.payload as
    | { identity?: ProspectIdentity }
    | undefined
  const socio = primaryPartner(identity?.identity?.partners ?? [])
  if (!socio) {
    return {
      status: "error",
      message:
        "Ainda não há sócio identificado. Encontre o CNPJ antes de buscar o dono.",
    }
  }

  const runId = randomUUID()
  const { error } = await supabase.from("prospect_enrichment_tasks").insert({
    campaign_id: campaignId,
    prospect_id: prospectId,
    run_id: runId,
    stage: "person",
    status: "pending",
  })
  if (error) {
    return { status: "error", message: "Não foi possível pedir a busca." }
  }

  await recordEnrichment(supabase, {
    prospectId,
    stage: "person",
    source: "serp_organic",
    payload: { requested: true, partner: socio.name },
    requestedBy: user.id,
  })

  return { status: "success" }
}
