"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireCommercialMember } from "@/lib/auth/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { isValidCnpj, normalizeCnpj } from "@/lib/prospecting/cnpj"
import {
  getCnpjProviderConfig,
  readCnpjBigQueryJob,
  startCnpjBigQueryJob,
} from "@/lib/prospecting/cnpj-provider-adapter"
import type {
  CnpjProviderCandidate,
  CnpjProviderMatch,
} from "@/lib/prospecting/cnpj-provider"
import {
  isProspectingCnpjBatchStatus,
  type ProspectingCnpjBatchProgress,
} from "@/lib/prospecting/reads"

const startSchema = z
  .object({
    runId: z.uuid(),
    candidateIds: z.array(z.uuid()).min(1).max(50),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Set(value.candidateIds).size !== value.candidateIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["candidateIds"],
        message: "A seleção contém candidatos repetidos.",
      })
    }
  })

const batchSchema = z.object({ batchId: z.uuid() }).strict()
const candidateMatchSchema = z
  .object({ runId: z.uuid(), candidateId: z.uuid() })
  .strict()
const confirmSchema = z
  .object({ runId: z.uuid(), candidateId: z.uuid(), matchId: z.uuid() })
  .strict()

export type ProspectingCnpjActionState =
  | { status: "success"; batchId?: string; progress?: ProspectingCnpjBatchProgress }
  | {
      status:
        | "source_not_configured"
        | "source_limited"
        | "source_unavailable"
        | "error"
      message: string
    }

export type ProspectingCnpjMatchesState =
  | { status: "success"; candidateId: string; matches: CnpjProviderMatch[] }
  | { status: "error"; message: string }

type BatchRow = {
  id: string
  run_id: string
  actor_id: string
  provider_job_id: string
  provider_started_at: string | null
  status: string
  processed_count: number
  total_count: number
}

function progressFromRow(row: BatchRow): ProspectingCnpjBatchProgress | null {
  if (!isProspectingCnpjBatchStatus(row.status)) return null
  if (
    !Number.isInteger(row.processed_count) ||
    !Number.isInteger(row.total_count) ||
    row.processed_count < 0 ||
    row.total_count < 1 ||
    row.processed_count > row.total_count
  ) {
    return null
  }
  return {
    batchId: row.id,
    status: row.status,
    processedCount: row.processed_count,
    totalCount: row.total_count,
  }
}

function publicError(status: "source_limited" | "source_unavailable") {
  return status === "source_limited"
    ? "A consulta excedeu o limite gratuito configurado ou a quota do BigQuery."
    : "O BigQuery não respondeu. A tentativa ficou registrada para retomada explícita."
}

async function recordBatch(input: {
  batchId: string
  actorId: string
  status: "completed" | "source_limited" | "source_unavailable"
  bytesProcessed: string | null
  sourceUpdatedAt: string | null
  matches: CnpjProviderMatch[]
}) {
  const { data, error } = await createAdminClient().rpc(
    "record_prospecting_cnpj_batch",
    {
      p_batch_id: input.batchId,
      p_actor_id: input.actorId,
      p_status: input.status,
      p_bytes_processed: input.bytesProcessed,
      p_source_updated_at: input.sourceUpdatedAt,
      p_matches: input.matches.map((match) => ({
        candidate_id: match.candidateId,
        cnpj: match.cnpj,
        legal_name: match.legalName,
        trade_name: match.tradeName,
        registration_status: match.registrationStatus,
        city: match.city,
        state_code: match.stateCode,
        primary_cnae: match.primaryCnae,
        source_updated_at: match.sourceUpdatedAt,
        source_url: match.sourceUrl,
        structurally_valid: match.structurallyValid,
      })),
    },
  )
  if (error) throw new Error("Unable to record CNPJ batch.", { cause: error })
  return data as { status?: unknown; processedCount?: unknown; totalCount?: unknown }
}

export async function startProspectingCnpjBatchAction(
  input: unknown,
): Promise<ProspectingCnpjActionState> {
  const { user } = await requireCommercialMember()
  const parsed = startSchema.safeParse(input)
  if (!parsed.success) {
    return { status: "error", message: "Selecione entre 1 e 50 candidatos válidos." }
  }
  if (getCnpjProviderConfig().status !== "configured") {
    return {
      status: "source_not_configured",
      message: "Configure o projeto e a credencial do BigQuery no servidor para pesquisar CNPJs.",
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("create_prospecting_cnpj_batch", {
    p_run_id: parsed.data.runId,
    p_candidate_ids: parsed.data.candidateIds,
    p_actor_id: user.id,
  })
  if (error || typeof data !== "string") {
    return {
      status: "error",
      message: "Não foi possível iniciar a pesquisa. Confira se os candidatos ainda estão disponíveis.",
    }
  }
  revalidatePath(`/prospecting/${parsed.data.runId}`)
  return {
    status: "success",
    batchId: data,
    progress: {
      batchId: data,
      status: "queued",
      processedCount: 0,
      totalCount: parsed.data.candidateIds.length,
    },
  }
}

export async function getActiveProspectingCnpjBatchAction(input: {
  runId: string
}): Promise<ProspectingCnpjBatchProgress | null> {
  const { user } = await requireCommercialMember()
  const parsed = z.object({ runId: z.uuid() }).strict().safeParse(input)
  if (!parsed.success) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("prospecting_cnpj_batches")
    .select("id, run_id, actor_id, provider_job_id, provider_started_at, status, processed_count, total_count")
    .eq("run_id", parsed.data.runId)
    .eq("actor_id", user.id)
    .in("status", ["queued", "processing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return progressFromRow(data as BatchRow)
}

export async function advanceProspectingCnpjBatchAction(
  input: unknown,
): Promise<ProspectingCnpjActionState> {
  const { user } = await requireCommercialMember()
  const parsed = batchSchema.safeParse(input)
  if (!parsed.success) return { status: "error", message: "Lote CNPJ inválido." }
  const config = getCnpjProviderConfig()
  if (config.status !== "configured") {
    return {
      status: "source_not_configured",
      message: "Configure o projeto e a credencial do BigQuery no servidor para continuar.",
    }
  }

  const supabase = await createClient()
  const { data: claimed, error: claimError } = await supabase.rpc(
    "claim_prospecting_cnpj_batch",
    { p_batch_id: parsed.data.batchId, p_actor_id: user.id },
  )
  if (claimError || !claimed || typeof claimed !== "object") {
    return { status: "error", message: "Não foi possível retomar este lote." }
  }
  const claim = claimed as Record<string, unknown>
  if (!isProspectingCnpjBatchStatus(claim.status)) {
    return { status: "error", message: "O lote retornou um estado inválido." }
  }
  if (claim.status !== "processing") {
    const { data: terminal } = await supabase
      .from("prospecting_cnpj_batches")
      .select("id, run_id, actor_id, provider_job_id, provider_started_at, status, processed_count, total_count")
      .eq("id", parsed.data.batchId)
      .maybeSingle()
    const progress = terminal
      ? progressFromRow(terminal as BatchRow)
      : null
    return progress
      ? { status: "success", batchId: progress.batchId, progress }
      : { status: "error", message: "O lote não está disponível." }
  }

  const { data: batchData, error: batchError } = await supabase
    .from("prospecting_cnpj_batches")
    .select("id, run_id, actor_id, provider_job_id, provider_started_at, status, processed_count, total_count")
    .eq("id", parsed.data.batchId)
    .maybeSingle()
  if (batchError || !batchData) {
    return { status: "error", message: "Não foi possível ler o lote." }
  }
  const batch = batchData as BatchRow
  const progress = progressFromRow(batch)
  if (!progress || batch.actor_id !== user.id) {
    return { status: "error", message: "O lote não está disponível para esta pessoa." }
  }

  if (!batch.provider_started_at) {
    const [runResult, batchCandidatesResult] = await Promise.all([
      supabase
        .from("prospecting_runs")
        .select("city, state_code")
        .eq("id", batch.run_id)
        .maybeSingle(),
      supabase
        .from("prospecting_cnpj_batch_candidates")
        .select("candidate_id")
        .eq("batch_id", batch.id)
        .order("position", { ascending: true }),
    ])
    const candidateIds = (batchCandidatesResult.data ?? []).flatMap((row) =>
      typeof row.candidate_id === "string" ? [row.candidate_id] : [],
    )
    const { data: candidateRows, error: candidateError } = candidateIds.length
      ? await supabase
          .from("prospecting_candidates")
          .select("id, company_name")
          .in("id", candidateIds)
      : { data: [], error: null }
    if (
      runResult.error ||
      batchCandidatesResult.error ||
      candidateError ||
      !runResult.data ||
      candidateIds.length !== batch.total_count
    ) {
      return { status: "error", message: "Não foi possível preparar os candidatos para a pesquisa." }
    }
    const byId = new Map(
      (candidateRows ?? []).map((row) => [row.id, row.company_name]),
    )
    const candidates: CnpjProviderCandidate[] = candidateIds.flatMap((id) => {
      const companyName = byId.get(id)
      return typeof companyName === "string" && companyName.trim()
        ? [{ id, companyName }]
        : []
    })
    if (candidates.length !== batch.total_count) {
      return { status: "error", message: "Um ou mais candidatos não têm nome pesquisável." }
    }
    const started = await startCnpjBigQueryJob({
      batchId: batch.id,
      candidates,
      city: runResult.data.city,
      stateCode: runResult.data.state_code,
    })
    if (started.status === "source_not_configured") {
      return {
        status: "source_not_configured",
        message: "Configure o projeto e a credencial do BigQuery no servidor para pesquisar CNPJs.",
      }
    }
    if (started.status === "source_limited" || started.status === "source_unavailable") {
      try {
        const recorded = await recordBatch({
          batchId: batch.id,
          actorId: user.id,
          status: started.status,
          bytesProcessed: null,
          sourceUpdatedAt: null,
          matches: [],
        })
        revalidatePath(`/prospecting/${batch.run_id}`)
        return {
          status: "success",
          batchId: batch.id,
          progress: {
            batchId: batch.id,
            status: started.status,
            processedCount: Number(recorded.processedCount ?? 0),
            totalCount: Number(recorded.totalCount ?? batch.total_count),
          },
        }
      } catch {
        return { status: "error", message: "Não foi possível registrar o limite/falha do provedor." }
      }
    }
    const { error: markError } = await createAdminClient().rpc(
      "mark_prospecting_cnpj_job_started",
      { p_batch_id: batch.id, p_actor_id: user.id },
    )
    if (markError) {
      return { status: "error", message: "A consulta iniciou, mas não foi possível salvar o estado do lote." }
    }
    return {
      status: "success",
      batchId: batch.id,
      progress: { ...progress, status: "processing" },
    }
  }

  const jobState = await readCnpjBigQueryJob({
    batchId: batch.id,
    jobId: batch.provider_job_id,
  })
  if (jobState.status === "processing") {
    return {
      status: "success",
      batchId: batch.id,
      progress: { ...progress, status: "processing" },
    }
  }

  try {
    const result = await recordBatch({
      batchId: batch.id,
      actorId: user.id,
      status: jobState.status,
      bytesProcessed:
        jobState.status === "completed" ? jobState.bytesProcessed : null,
      sourceUpdatedAt:
        jobState.status === "completed" ? jobState.sourceUpdatedAt : null,
      matches: jobState.status === "completed" ? jobState.matches : [],
    })
    revalidatePath(`/prospecting/${batch.run_id}`)
    const recordedStatus = isProspectingCnpjBatchStatus(result.status)
      ? result.status
      : jobState.status
    const nextProgress: ProspectingCnpjBatchProgress = {
      batchId: batch.id,
      status: recordedStatus,
      processedCount: Number(result.processedCount ?? batch.total_count),
      totalCount: Number(result.totalCount ?? batch.total_count),
    }
    return { status: "success", batchId: batch.id, progress: nextProgress }
  } catch {
    return { status: "error", message: "Não foi possível salvar os resultados da pesquisa." }
  }
}

export async function listProspectingCnpjMatchesAction(
  input: unknown,
): Promise<ProspectingCnpjMatchesState> {
  await requireCommercialMember()
  const parsed = candidateMatchSchema.safeParse(input)
  if (!parsed.success) {
    return { status: "error", message: "Candidato CNPJ inválido." }
  }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("prospecting_cnpj_matches")
    .select("id, candidate_id, cnpj, legal_name, trade_name, registration_status, city, state_code, primary_cnae, source, source_updated_at, source_url, structurally_valid")
    .eq("run_id", parsed.data.runId)
    .eq("candidate_id", parsed.data.candidateId)
    .order("created_at", { ascending: false })
    .limit(100)
  if (error) {
    return { status: "error", message: "Não foi possível carregar os resultados CNPJ." }
  }
  const matches: CnpjProviderMatch[] = (data ?? []).flatMap((row) => {
    const cnpj = normalizeCnpj(row.cnpj)
    if (!cnpj || !isValidCnpj(cnpj) || row.source !== "opencnpj_bigquery") return []
    if (
      typeof row.id !== "string" ||
      typeof row.candidate_id !== "string" ||
      typeof row.source_url !== "string" ||
      typeof row.structurally_valid !== "boolean" ||
      !row.structurally_valid
    ) {
      return []
    }
    return [{
      id: row.id,
      candidateId: row.candidate_id,
      cnpj,
      legalName: typeof row.legal_name === "string" ? row.legal_name : null,
      tradeName: typeof row.trade_name === "string" ? row.trade_name : null,
      registrationStatus: typeof row.registration_status === "string" ? row.registration_status : null,
      city: typeof row.city === "string" ? row.city : null,
      stateCode: typeof row.state_code === "string" ? row.state_code : null,
      primaryCnae: typeof row.primary_cnae === "string" ? row.primary_cnae : null,
      source: "opencnpj_bigquery",
      sourceUpdatedAt:
        typeof row.source_updated_at === "string"
          ? row.source_updated_at
          : null,
      sourceUrl: row.source_url,
      structurallyValid: row.structurally_valid,
    }]
  })
  return { status: "success", candidateId: parsed.data.candidateId, matches }
}

export async function confirmProspectingCandidateCnpjAction(
  input: unknown,
): Promise<ProspectingCnpjActionState> {
  const { user } = await requireCommercialMember()
  const parsed = confirmSchema.safeParse(input)
  if (!parsed.success) {
    return { status: "error", message: "Escolha um resultado CNPJ válido." }
  }
  const supabase = await createClient()
  const { data: match, error: matchError } = await supabase
    .from("prospecting_cnpj_matches")
    .select("cnpj, structurally_valid, source, source_url")
    .eq("id", parsed.data.matchId)
    .eq("run_id", parsed.data.runId)
    .eq("candidate_id", parsed.data.candidateId)
    .maybeSingle()
  const cnpj = normalizeCnpj(match?.cnpj)
  if (
    matchError ||
    !match ||
    match.source !== "opencnpj_bigquery" ||
    !match.structurally_valid ||
    !cnpj ||
    !isValidCnpj(cnpj)
  ) {
    return { status: "error", message: "Este resultado não pode ser confirmado. Pesquise novamente." }
  }
  const { data, error } = await supabase.rpc(
    "confirm_prospecting_candidate_cnpj",
    {
      p_run_id: parsed.data.runId,
      p_candidate_id: parsed.data.candidateId,
      p_match_id: parsed.data.matchId,
      p_actor_id: user.id,
    },
  )
  if (error || !data || typeof data !== "object") {
    return { status: "error", message: "Não foi possível confirmar o CNPJ." }
  }
  revalidatePath(`/prospecting/${parsed.data.runId}`)
  revalidatePath("/leads")
  return { status: "success" }
}
