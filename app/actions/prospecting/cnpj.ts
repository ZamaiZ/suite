"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireCommercialMember } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { isValidCnpj, normalizeCnpj } from "@/lib/prospecting/cnpj"
import {
  CnpjCsvError,
  type CnpjCsvRow,
  type CnpjResearchMatch,
  validateCnpjCsvRow,
} from "@/lib/prospecting/cnpj-files"

const uuidSchema = z.uuid()
const startFileSchema = z.object({ runId: uuidSchema }).strict()
const stageFileSchema = z.object({
  importId: uuidSchema,
  chunkIndex: z.number().int().min(0).max(2000),
  rows: z.array(z.object({
    run_id: z.string().uuid(), candidate_id: z.string().uuid(),
    company_name: z.string().max(300), primary_category: z.string().max(300), address: z.string().max(1000),
    phone: z.string().max(100), website: z.string().max(2048), website_domain: z.string().max(253),
    city: z.string().max(160), state_code: z.string().max(2), existing_cnpj: z.string().max(14),
    research_status: z.string().max(20), cnpj: z.string().max(30), legal_name: z.string().max(300),
    trade_name: z.string().max(300), registration_status: z.string().max(80), matched_city: z.string().max(160),
    matched_state_code: z.string().max(2), primary_cnae: z.string().max(100), source_url: z.string().max(500),
    source_checked_at: z.string().max(50), source_row_number: z.number().int().min(2),
  }).strict()).min(1).max(50),
}).strict()
const importIdSchema = z.object({ importId: uuidSchema }).strict()
const candidateMatchSchema = z.object({ runId: uuidSchema, candidateId: uuidSchema }).strict()
const confirmSchema = z.object({ runId: uuidSchema, candidateId: uuidSchema, matchId: uuidSchema }).strict()

function isSafeHttpsUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password
  } catch {
    return false
  }
}

export type ProspectingCnpjFileActionState =
  | { status: "success"; importId?: string; summary?: { suggestions: number; notFound: number; ambiguous: number; skipped: number } }
  | { status: "error"; message: string }

export type ProspectingCnpjMatchesState =
  | { status: "success"; candidateId: string; matches: CnpjResearchMatch[] }
  | { status: "error"; message: string }

export async function startProspectingCnpjFileImportAction(input: unknown): Promise<ProspectingCnpjFileActionState> {
  const { user } = await requireCommercialMember()
  const parsed = startFileSchema.safeParse(input)
  if (!parsed.success) return { status: "error", message: "Execução de prospecção inválida." }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("create_prospecting_cnpj_file_import", {
    p_run_id: parsed.data.runId,
    p_actor_id: user.id,
  })
  if (error || typeof data !== "string") {
    return { status: "error", message: "Não foi possível iniciar a importação. Confira se a execução está disponível." }
  }
  return { status: "success", importId: data }
}

export async function stageProspectingCnpjFileChunkAction(input: unknown): Promise<ProspectingCnpjFileActionState> {
  const { user } = await requireCommercialMember()
  const parsed = stageFileSchema.safeParse(input)
  if (!parsed.success) return { status: "error", message: "O bloco contém dados inválidos ou excede o limite de 50 linhas." }
  const supabase = await createClient()
  const runId = parsed.data.rows[0]?.run_id
  if (!runId || parsed.data.rows.some((row) => row.run_id !== runId)) {
    return { status: "error", message: "O bloco contém linhas de execuções diferentes." }
  }
  const ids = parsed.data.rows.map((row) => row.candidate_id)
  let validatedRows: Array<{ validated: ReturnType<typeof validateCnpjCsvRow>; row: (typeof parsed.data.rows)[number] }>
  try {
    validatedRows = parsed.data.rows.map((row) => ({
      validated: validateCnpjCsvRow(row as CnpjCsvRow, row.source_row_number),
      row,
    }))
  } catch (cause) {
    if (cause instanceof CnpjCsvError) {
      return { status: "error", message: `Linha ${cause.rowNumber ?? "?"}${cause.column ? ` · ${cause.column}` : ""}: ${cause.message}` }
    }
    return { status: "error", message: "O bloco contém uma linha CSV inválida." }
  }
  const [{ data: run, error: runError }, { data: candidates, error: candidatesError }] = await Promise.all([
    supabase.from("prospecting_runs").select("city, state_code").eq("id", runId).maybeSingle(),
    supabase.from("prospecting_run_candidates")
      .select("candidate_id, prospecting_candidates(company_name, primary_category, address, phone, website, website_domain, cnpj)")
      .eq("run_id", runId)
      .in("candidate_id", ids),
  ])
  if (runError || candidatesError || !run || candidates?.length !== ids.length) {
    return { status: "error", message: "Não foi possível conferir todas as empresas deste bloco." }
  }
  type CandidateContext = {
    company_name: string | null
    primary_category: string | null
    address: string | null
    phone: string | null
    website: string | null
    website_domain: string | null
    cnpj: string | null
  }
  const contextById = new Map<string, CandidateContext>()
  for (const relation of candidates) {
    const candidate = Array.isArray(relation.prospecting_candidates)
      ? relation.prospecting_candidates[0]
      : relation.prospecting_candidates
    if (candidate) contextById.set(relation.candidate_id, candidate)
  }
  const contextColumns = [
    ["company_name", "company_name"],
    ["primary_category", "primary_category"],
    ["address", "address"],
    ["phone", "phone"],
    ["website", "website"],
    ["website_domain", "website_domain"],
  ] as const
  for (const { row, validated } of validatedRows) {
    if (validated.run_id !== runId || row.city !== run.city || row.state_code !== run.state_code) {
      return { status: "error", message: `Linha ${row.source_row_number}: o contexto da execução foi alterado.` }
    }
    const candidate = contextById.get(validated.candidate_id)
    if (!candidate) return { status: "error", message: `Linha ${row.source_row_number}: o candidato não pertence a esta execução.` }
    for (const [csvColumn, candidateColumn] of contextColumns) {
      if (row[csvColumn] !== (candidate[candidateColumn] ?? "")) {
        return { status: "error", message: `Linha ${row.source_row_number} · ${csvColumn}: o contexto da empresa foi alterado.` }
      }
    }
    if (!candidate.cnpj && row.existing_cnpj !== "") {
      return { status: "error", message: `Linha ${row.source_row_number} · existing_cnpj: o contexto da empresa foi alterado.` }
    }
  }
  const { error } = await supabase.rpc("stage_prospecting_cnpj_file_chunk", {
    p_import_id: parsed.data.importId,
    p_run_id: runId,
    p_actor_id: user.id,
    p_chunk_index: parsed.data.chunkIndex,
    p_rows: validatedRows.map(({ row, validated }) => ({
      company_name: row.company_name,
      primary_category: row.primary_category,
      address: row.address,
      phone: row.phone,
      website: row.website,
      website_domain: row.website_domain,
      city: row.city,
      state_code: row.state_code,
      existing_cnpj: row.existing_cnpj,
      ...validated,
      source_row_number: row.source_row_number,
    })),
  })
  if (error) return { status: "error", message: "Não foi possível preparar um bloco do CSV. Nenhum dado parcial foi aplicado." }
  return { status: "success" }
}

export async function commitProspectingCnpjFileImportAction(input: unknown): Promise<ProspectingCnpjFileActionState> {
  const { user } = await requireCommercialMember()
  const parsed = importIdSchema.safeParse(input)
  if (!parsed.success) return { status: "error", message: "Importação CNPJ inválida." }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("commit_prospecting_cnpj_file_import", {
    p_import_id: parsed.data.importId,
    p_actor_id: user.id,
  })
  if (error || !data || typeof data !== "object") {
    return { status: "error", message: "O CSV está incompleto ou mudou desde o download. Nenhum resultado parcial foi aplicado." }
  }
  const summary = data as Record<string, unknown>
  const counts = [summary.suggestions, summary.notFound, summary.ambiguous, summary.skipped]
  if (!counts.every((value) => Number.isInteger(value) && Number(value) >= 0)) {
    return { status: "error", message: "A importação foi processada, mas o resumo retornado é inválido. Atualize a página para conferir os dados." }
  }
  if (typeof summary.runId === "string") revalidatePath(`/prospecting/${summary.runId}`)
  return { status: "success", summary: {
    suggestions: Number(summary.suggestions),
    notFound: Number(summary.notFound),
    ambiguous: Number(summary.ambiguous),
    skipped: Number(summary.skipped),
  } }
}

export async function abortProspectingCnpjFileImportAction(input: unknown): Promise<ProspectingCnpjFileActionState> {
  const { user } = await requireCommercialMember()
  const parsed = importIdSchema.safeParse(input)
  if (!parsed.success) return { status: "error", message: "Importação CNPJ inválida." }
  const supabase = await createClient()
  const { error } = await supabase.rpc("abort_prospecting_cnpj_file_import", {
    p_import_id: parsed.data.importId,
    p_actor_id: user.id,
  })
  return error
    ? { status: "error", message: "Não foi possível encerrar a importação temporária." }
    : { status: "success" }
}

export async function listProspectingCnpjMatchesAction(input: unknown): Promise<ProspectingCnpjMatchesState> {
  await requireCommercialMember()
  const parsed = candidateMatchSchema.safeParse(input)
  if (!parsed.success) return { status: "error", message: "Candidato CNPJ inválido." }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("prospecting_cnpj_matches")
    .select("id, candidate_id, cnpj, legal_name, trade_name, registration_status, city, state_code, primary_cnae, source, dataset_version, source_updated_at, source_url, structurally_valid")
    .eq("run_id", parsed.data.runId)
    .eq("candidate_id", parsed.data.candidateId)
    .order("created_at", { ascending: false })
    .limit(100)
  if (error) return { status: "error", message: "Não foi possível carregar os resultados CNPJ." }
  const matches: CnpjResearchMatch[] = (data ?? []).flatMap((row) => {
    const cnpj = normalizeCnpj(row.cnpj)
    if (!cnpj || !isValidCnpj(cnpj) || (row.source !== "opencnpj_bigquery" && row.source !== "ai_research" && row.source !== "receita_local_index")) return []
    if (typeof row.id !== "string" || typeof row.candidate_id !== "string" || typeof row.source_url !== "string" || !isSafeHttpsUrl(row.source_url) || !row.structurally_valid) return []
    return [{
      id: row.id,
      candidateId: row.candidate_id,
      cnpj,
      legalName: row.legal_name,
      tradeName: row.trade_name,
      registrationStatus: row.registration_status,
      city: row.city,
      stateCode: row.state_code,
      primaryCnae: row.primary_cnae,
      source: row.source,
      datasetVersion: row.dataset_version,
      sourceCheckedAt: row.source_updated_at,
      sourceUrl: row.source_url,
      structurallyValid: true,
    }]
  })
  return { status: "success", candidateId: parsed.data.candidateId, matches }
}

export async function confirmProspectingCandidateCnpjAction(input: unknown): Promise<ProspectingCnpjFileActionState> {
  const { user } = await requireCommercialMember()
  const parsed = confirmSchema.safeParse(input)
  if (!parsed.success) return { status: "error", message: "Escolha um resultado CNPJ válido." }
  const supabase = await createClient()
  const { data: match, error: matchError } = await supabase
    .from("prospecting_cnpj_matches")
    .select("cnpj, structurally_valid, source")
    .eq("id", parsed.data.matchId)
    .eq("run_id", parsed.data.runId)
    .eq("candidate_id", parsed.data.candidateId)
    .maybeSingle()
  const cnpj = normalizeCnpj(match?.cnpj)
  if (matchError || !match || (match.source !== "ai_research" && match.source !== "opencnpj_bigquery" && match.source !== "receita_local_index") || !match.structurally_valid || !cnpj || !isValidCnpj(cnpj)) {
    return { status: "error", message: "Este resultado não pode ser confirmado. Revise a fonte e tente novamente." }
  }
  const { error } = await supabase.rpc("confirm_prospecting_candidate_cnpj", {
    p_run_id: parsed.data.runId,
    p_candidate_id: parsed.data.candidateId,
    p_match_id: parsed.data.matchId,
    p_actor_id: user.id,
  })
  if (error) return { status: "error", message: "Não foi possível confirmar o CNPJ." }
  revalidatePath(`/prospecting/${parsed.data.runId}`)
  revalidatePath("/leads")
  return { status: "success" }
}
