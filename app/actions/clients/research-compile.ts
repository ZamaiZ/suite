"use server"

/**
 * Compila a execução num snapshot. **Não gasta nada** — tudo aqui é regra sobre
 * SERP já paga e gravada.
 *
 * Só roda quando a fila está `settled`. Compilar com coleta pela metade
 * produziria clusters que mudam na próxima passada, e o snapshot é append-only:
 * o errado ficaria gravado ao lado do certo sem nada distinguir os dois.
 */

import { z } from "zod"
import { requireCommercialMember } from "@/lib/auth/session"
import { buildClusters, type ClusterEntry } from "@/lib/research/cluster"
import { buildCompetitorList } from "@/lib/research/competitor-sources"
import { buildVerdicts, verdictSummary } from "@/lib/research/verdict"
import { serpQueueProgress, type SerpQueueRow } from "@/lib/research/serp-queue"
import type {
  ClientResearchSnapshot,
  ResearchCandidate,
} from "@/lib/research/types"
import { createClient } from "@/lib/supabase/server"

const schema = z.object({
  clientId: z.string().uuid(),
  runId: z.string().uuid(),
  selfDomain: z.string().trim().min(1),
  briefingFingerprint: z.string().trim().min(1),
  seeds: z.array(z.string().trim().min(1)),
  /** Deixa compilar com a fila incompleta, assumindo o buraco. */
  force: z.boolean().optional(),
})

export type CompileResearchState =
  | {
      status: "success"
      auditId: string
      clusters: number
      competitors: number
      verdicts: Record<string, number>
    }
  | { status: "incomplete"; pending: number; queued: number }
  | { status: "error"; message: string }

export async function compileResearch(
  input: unknown,
): Promise<CompileResearchState> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { status: "error", message: "Dados inválidos." }

  const { user } = await requireCommercialMember()

  const supabase = await createClient()
  const { clientId, runId, selfDomain, seeds } = parsed.data

  const { data, error } = await supabase
    .from("client_research_serp_tasks")
    .select(
      "id, keyword, status, task_id, attempts, polling_at, snapshot, cost_usd, location_code",
    )
    .eq("run_id", runId)

  if (error || !data) {
    return { status: "error", message: "Coleta não encontrada." }
  }

  const fila: SerpQueueRow[] = data.map((row) => ({
    id: row.id as string,
    keyword: row.keyword as string,
    status: row.status as SerpQueueRow["status"],
    taskId: (row.task_id as string | null) ?? null,
    attempts: (row.attempts as number) ?? 0,
    pollingAt: (row.polling_at as string | null) ?? null,
  }))

  const progresso = serpQueueProgress(fila)
  if (!progresso.settled && !parsed.data.force) {
    return {
      status: "incomplete",
      pending: progresso.pending,
      queued: progresso.queued,
    }
  }

  // --- clusters -------------------------------------------------------------

  const entradas: ClusterEntry[] = []
  const dominiosPorKeyword: Record<string, string[]> = {}
  const serpsParaConcorrente: { keyword: string; domains: string[] }[] = []
  const perguntas = new Set<string>()
  let custoTotal = 0

  for (const row of data) {
    const keyword = row.keyword as string
    const snapshot = row.snapshot as
      | {
          organic?: { url: string; domain: string; rankGroup: number | null }[]
          peopleAlsoAsk?: string[]
        }
      | null
    custoTotal += Number(row.cost_usd ?? 0)

    const organicos = snapshot?.organic ?? []
    const urls = snapshot ? organicos.map((o) => o.url) : null
    const dominios = organicos.map((o) => o.domain)

    entradas.push({
      keyword,
      urls,
      status: row.status as ClusterEntry["status"],
      searchVolume: null,
    })

    if (row.status === "done") {
      dominiosPorKeyword[keyword] = dominios
      serpsParaConcorrente.push({ keyword, domains: dominios })
      for (const pergunta of snapshot?.peopleAlsoAsk ?? []) {
        perguntas.add(pergunta)
      }
    }
  }

  const agrupamento = buildClusters({ entries: entradas })

  // --- concorrentes ---------------------------------------------------------

  const concorrentes = buildCompetitorList({
    selfDomain,
    serps: serpsParaConcorrente,
  })

  // --- vereditos ------------------------------------------------------------

  // O pool completo não é regravado aqui: o veredito precisa das keywords do
  // briefing e da SERP delas, e as duas coisas estão na fila.
  const candidatas: ResearchCandidate[] = data.map((row) => ({
    keyword: row.keyword as string,
    sources: seeds.some(
      (s) => s.toLowerCase() === (row.keyword as string).toLowerCase(),
    )
      ? ["briefing"]
      : ["keywords_for_keywords"],
    searchVolume: null,
    volumeLocationCode: (row.location_code as number) ?? null,
    nationalVolume: null,
    monthlySearches: null,
    competition: null,
    competitionIndex: null,
    cpc: null,
    difficulty: null,
    intent: null,
    secondaryIntents: null,
    serpUrls: null,
    serpStatus: row.status as ResearchCandidate["serpStatus"],
    serpLocationCode: (row.location_code as number) ?? null,
  }))

  const vereditos = buildVerdicts({
    seeds,
    candidates: candidatas,
    clusters: agrupamento.clusters,
    serpDomains: dominiosPorKeyword,
    selfDomain,
  })

  // --- grava ----------------------------------------------------------------

  const snapshot: ClientResearchSnapshot = {
    version: 1,
    collectedAt: new Date().toISOString(),
    input: {
      primaryKeyword: seeds[0] ?? "",
      seeds,
      cities: [],
      neighborhoods: [],
      briefingFingerprint: parsed.data.briefingFingerprint,
    },
    candidates: candidatas,
    clusters: agrupamento.clusters,
    competitors: concorrentes.all,
    verdicts: vereditos,
    locality: null,
    peopleAlsoAsk: [...perguntas],
    costUsd: custoTotal,
  }

  const { data: gravado, error: erroGravacao } = await supabase
    .from("client_research_audits")
    .insert({
      client_id: clientId,
      briefing_fingerprint: parsed.data.briefingFingerprint,
      snapshot,
      cost_usd: custoTotal,
      fetched_by: user.id,
    })
    .select("id")
    .single()

  if (erroGravacao || !gravado) {
    return { status: "error", message: "Não foi possível gravar a pesquisa." }
  }

  return {
    status: "success",
    auditId: gravado.id as string,
    clusters: agrupamento.clusters.length,
    competitors: concorrentes.reference.length,
    verdicts: verdictSummary(vereditos),
  }
}
