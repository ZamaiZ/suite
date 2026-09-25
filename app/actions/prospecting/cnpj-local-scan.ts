"use server"

import { revalidatePath } from "next/cache"
import { existsSync } from "node:fs"
import path from "node:path"
import { z } from "zod"
import { requireCommercialMember } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { resolveLocalCnpjPaths, isLocalCnpjRuntimeAvailable, isReadableDirectory } from "@/lib/prospecting/local-cnpj-scan/config"
import type { CnpjSearchCandidate, LocalCnpjCleanupPreview, LocalCnpjCleanupSummary, LocalCnpjScanEvent, LocalCnpjScanState, LocalCnpjSourceInspection, LocalCnpjSourceInspectionState } from "@/lib/prospecting/local-cnpj-scan/contracts"
import { acquireCnpjScanCommitLease, appendCnpjScanEvent, claimCnpjScanCommit, clearLocalCnpjArtifacts, localCnpjArtifacts, readActiveCnpjScanState, readAnyActiveCnpjScanState, readCnpjScanEvents, readCnpjScanResults, readCnpjScanState, releaseCnpjScanLock, requestCnpjScanCancellation, runLocalCnpjWorker, startCnpjScanWorker, waitForCnpjWorkerExit, writeCnpjScanStatus } from "@/lib/prospecting/local-cnpj-scan/worker-client"
import { abortProspectingCnpjFileImportAction, commitProspectingCnpjFileImportAction, stageProspectingCnpjFileChunkAction } from "./cnpj"

const uuid = z.uuid()
const runInput = z.object({ runId: uuid }).strict()
const executionInput = z.object({ executionId: uuid }).strict()

function emptyScanState(enabled = false, status: LocalCnpjScanState["status"] = "idle", message: string | null = null): LocalCnpjScanState {
  return { enabled, executionId: null, runId: null, snapshotKey: null, datasetVersion: null, status, phase: "preparing", currentFile: null, bytesRead: 0, totalBytes: 0, rowsRead: 0, completedFiles: 0, totalFiles: 20, candidateTotal: 0, candidatesProcessed: 0, freeBytes: null, rateBytesPerSecond: null, startedAt: null, updatedAt: null, finishedAt: null, importId: null, summary: null, message }
}

function emptyInspection(enabled: boolean, status: LocalCnpjSourceInspectionState["status"], message: string | null, stateDirectory: string | null): LocalCnpjSourceInspectionState {
  const artifacts = stateDirectory ? (() => { try { const paths = resolveLocalCnpjPaths(); return paths ? localCnpjArtifacts(paths) : { bytes: 0, events: 0 } } catch { return { bytes: 0, events: 0 } } })() : { bytes: 0, events: 0 }
  return { enabled, status, message, stateDirectory, activeExecution: false, localStateBytes: artifacts.bytes, localEventCount: artifacts.events, snapshotKey: "", competence: null, files: [], totalBytes: 0, missingFiles: [], layoutErrors: [], ready: false }
}

async function canAccessRun(runId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from("prospecting_runs").select("id").eq("id", runId).maybeSingle()
  return !error && Boolean(data)
}

async function authorizedExecution(executionId: string) {
  const paths = resolveLocalCnpjPaths()
  if (!paths) return { paths: null, state: emptyScanState(false, "failed", "A pasta de estado local não está configurada.") }
  const state = await readCnpjScanState(paths, executionId)
  if (!state.runId || !(await canAccessRun(state.runId))) throw new Error("Execução local não encontrada para esta conta.")
  return { paths, state }
}

function updateStatus(paths: NonNullable<ReturnType<typeof resolveLocalCnpjPaths>>, state: LocalCnpjScanState, updates: Partial<LocalCnpjScanState>, event?: LocalCnpjScanEvent) {
  const next = { ...state, ...updates, updatedAt: new Date().toISOString() }
  writeCnpjScanStatus(paths, state.executionId!, next)
  if (event) appendCnpjScanEvent(paths, state.executionId!, event)
  return next
}

export async function inspectLocalCnpjSourceAction(): Promise<LocalCnpjSourceInspectionState> {
  await requireCommercialMember()
  const paths = resolveLocalCnpjPaths()
  if (!paths || !isLocalCnpjRuntimeAvailable()) return emptyInspection(false, "not_configured", "Configure PROSPECTING_CNPJ_DATA_DIR e PROSPECTING_CNPJ_STATE_DIR no .env.local e reinicie o Suite.", null)
  if (!isReadableDirectory(paths.dataDir)) return emptyInspection(true, "missing", "A pasta local da Receita não está acessível neste computador.", paths.stateDir)
  try {
    const inspection = await runLocalCnpjWorker<LocalCnpjSourceInspection>(paths, "inspect")
    const artifacts = localCnpjArtifacts(paths)
    const active = await readAnyActiveCnpjScanState(paths)
    return { ...inspection, enabled: true, status: inspection.ready ? "source_ready" : "failed", message: inspection.ready ? null : [...inspection.missingFiles, ...inspection.layoutErrors].slice(0, 4).join(" "), stateDirectory: paths.stateDir, localStateBytes: artifacts.bytes, localEventCount: artifacts.events, activeExecution: Boolean(active) }
  } catch {
    return emptyInspection(true, "failed", "Não foi possível inspecionar os CSVs locais. Confira acesso, integridade e nomes das 20 partições.", paths.stateDir)
  }
}

export async function startLocalCnpjScanAction(input: unknown): Promise<LocalCnpjScanState> {
  await requireCommercialMember()
  const parsed = runInput.safeParse(input)
  if (!parsed.success) return emptyScanState(true, "failed", "Execução de prospecção inválida.")
  const paths = resolveLocalCnpjPaths()
  if (!paths || !isLocalCnpjRuntimeAvailable() || !isReadableDirectory(paths.dataDir)) return emptyScanState(false, "failed", "A base local não está configurada ou acessível neste computador.")
  const active = await readActiveCnpjScanState(paths, parsed.data.runId)
  if (active) return active
  if (!(await canAccessRun(parsed.data.runId))) return emptyScanState(true, "failed", "A execução de prospecção não está disponível.")
  const supabase = await createClient()
  const { data: run, error: runError } = await supabase.from("prospecting_runs").select("city, state_code").eq("id", parsed.data.runId).maybeSingle()
  if (runError || !run) return emptyScanState(true, "failed", "A execução de prospecção não está disponível.")
  const inspection = await runLocalCnpjWorker<LocalCnpjSourceInspection>(paths, "inspect").catch(() => null)
  if (!inspection?.ready || !inspection.competence) return emptyScanState(true, "failed", "Os CSVs não passaram na validação das 20 partições.")
  const candidateRows: Array<{ candidate_id: string; prospecting_candidates: unknown }> = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from("prospecting_run_candidates")
      .select("candidate_id, prospecting_candidates(id, company_name, primary_category, address, phone, website, website_domain, cnpj)")
      .eq("run_id", parsed.data.runId).order("candidate_id").range(from, from + 499)
    if (error || !data) return emptyScanState(true, "failed", "Não foi possível carregar todos os candidatos desta execução.")
    candidateRows.push(...data)
    if (candidateRows.length > 20_000) return emptyScanState(true, "failed", "Esta execução excede o limite de 20.000 candidatos por pesquisa local.")
    if (data.length < 500) break
  }
  type Candidate = { company_name: string | null; primary_category: string | null; address: string | null; phone: string | null; website: string | null; website_domain: string | null; cnpj: string | null }
  const candidates: CnpjSearchCandidate[] = candidateRows.flatMap((relation) => {
    const nested = Array.isArray(relation.prospecting_candidates) ? relation.prospecting_candidates[0] : relation.prospecting_candidates
    if (!nested || typeof nested !== "object") return []
    const item = nested as Candidate
    return [{ run_id: parsed.data.runId, candidate_id: relation.candidate_id, company_name: item.company_name ?? "", primary_category: item.primary_category ?? "", address: item.address ?? "", phone: item.phone ?? "", website: item.website ?? "", website_domain: item.website_domain ?? "", city: run.city ?? "", state_code: run.state_code ?? "", existing_cnpj: item.cnpj ?? "" }]
  })
  if (!candidates.length || candidates.length !== candidateRows.length) return emptyScanState(true, "failed", "A execução não tem candidatos válidos para pesquisar.")
  const executionId = crypto.randomUUID()
  const started = await startCnpjScanWorker(paths, executionId, parsed.data.runId, inspection.snapshotKey, candidates)
  if (!started) return emptyScanState(true, "failed", "Já existe uma execução local ativa ou o worker não pôde ser iniciado.")
  const state = await readCnpjScanState(paths, executionId)
  if (state.status === "failed") return state
  appendCnpjScanEvent(paths, executionId, { at: new Date().toISOString(), type: "phase", phase: "preparing", message: "Pesquisa iniciada por membro autorizado." })
  return state
}

export async function getLocalCnpjScanStateAction(input: unknown): Promise<LocalCnpjScanState> {
  await requireCommercialMember()
  const parsed = executionInput.safeParse(input)
  if (!parsed.success) return emptyScanState(true, "failed", "Identificador de execução inválido.")
  return (await authorizedExecution(parsed.data.executionId)).state
}

export async function getActiveLocalCnpjScanStateAction(input: unknown): Promise<LocalCnpjScanState | null> {
  await requireCommercialMember()
  const parsed = runInput.safeParse(input)
  if (!parsed.success || !(await canAccessRun(parsed.data.runId))) return null
  const paths = resolveLocalCnpjPaths()
  return paths ? readActiveCnpjScanState(paths, parsed.data.runId) : null
}

export async function getLocalCnpjScanEventsAction(input: unknown): Promise<LocalCnpjScanEvent[]> {
  await requireCommercialMember()
  const parsed = executionInput.safeParse(input)
  if (!parsed.success) return []
  const { paths, state } = await authorizedExecution(parsed.data.executionId)
  return paths && state.runId ? readCnpjScanEvents(paths, parsed.data.executionId) : []
}

export async function cancelLocalCnpjScanAction(input: unknown): Promise<LocalCnpjScanState> {
  await requireCommercialMember()
  const parsed = executionInput.safeParse(input)
  if (!parsed.success) return emptyScanState(true, "failed", "Identificador de execução inválido.")
  const { paths, state } = await authorizedExecution(parsed.data.executionId)
  if (!paths || !state.executionId) return state
  if (state.status === "committing" || state.status === "commit_pending") return { ...state, message: "A finalização atômica já começou; confirme o resultado antes de cancelar." }
  if (!requestCnpjScanCancellation(paths, parsed.data.executionId)) {
    const current = await readCnpjScanState(paths, parsed.data.executionId)
    return current.status === "committing" || current.status === "commit_pending"
      ? { ...current, message: "A finalização atômica já começou; confirme o resultado antes de cancelar." }
      : current
  }
  appendCnpjScanEvent(paths, parsed.data.executionId, { at: new Date().toISOString(), type: "cancel_requested", phase: state.phase, message: "Cancelamento solicitado." })
  return { ...state, message: state.status === "scanning"
    ? "Cancelamento solicitado; aguardando o worker interromper a leitura com segurança."
    : "Cancelamento solicitado; a próxima etapa vai abortar a gravação temporária com segurança." }
}

export async function stageNextLocalCnpjScanChunkAction(input: unknown): Promise<LocalCnpjScanState> {
  const { user } = await requireCommercialMember()
  const parsed = executionInput.safeParse(input)
  if (!parsed.success) return emptyScanState(true, "failed", "Identificador de execução inválido.")
  const { paths, state: initial } = await authorizedExecution(parsed.data.executionId)
  if (!paths || !initial.executionId || !["scan_complete", "staging"].includes(initial.status)) return initial
  let state = initial
  if (existsSync(path.join(paths.stateDir, parsed.data.executionId, "cancel.json"))) {
    if (!(await waitForCnpjWorkerExit(paths, parsed.data.executionId))) return { ...state, message: "Cancelamento solicitado; aguardando o worker encerrar." }
    if (state.importId) await abortProspectingCnpjFileImportAction({ importId: state.importId })
    const cancelled = updateStatus(paths, state, { status: "cancelled", phase: "finished", finishedAt: new Date().toISOString(), message: "Pesquisa cancelada. Importação temporária abortada." }, { at: new Date().toISOString(), type: "terminal", phase: "finished", message: "Pesquisa cancelada durante a gravação." })
    await releaseCnpjScanLock(paths, parsed.data.executionId)
    return cancelled
  }
  const supabase = await createClient()
  try {
    const output = readCnpjScanResults(paths, parsed.data.executionId)
    if (output.snapshotKey !== state.snapshotKey || output.results.length !== state.candidateTotal) throw new Error("O arquivo local não corresponde à execução atual.")
    if (!state.importId) {
      const created = await supabase.rpc("create_prospecting_cnpj_local_scan_import", { p_run_id: state.runId, p_actor_id: user.id, p_dataset_version: state.datasetVersion, p_execution_id: state.executionId })
      if (created.error || typeof created.data !== "string") throw new Error("Não foi possível criar a importação temporária no Supabase.")
      state = updateStatus(paths, state, { status: "staging", phase: "staging", importId: created.data }, { at: new Date().toISOString(), type: "staging", phase: "staging", message: "Importação temporária criada no Supabase." })
    }
    const from = state.summary?.chunksStaged ?? 0
    const to = Math.min(from + 10, state.summary?.chunksTotal ?? 0)
    for (let chunkIndex = from; chunkIndex < to; chunkIndex += 1) {
      if (existsSync(path.join(paths.stateDir, parsed.data.executionId, "cancel.json"))) {
        await abortProspectingCnpjFileImportAction({ importId: state.importId! })
        const cancelled = updateStatus(paths, state, { status: "cancelled", phase: "finished", finishedAt: new Date().toISOString(), message: "Pesquisa cancelada. Importação temporária abortada." }, { at: new Date().toISOString(), type: "terminal", phase: "finished", message: "Pesquisa cancelada durante a gravação." })
        await releaseCnpjScanLock(paths, parsed.data.executionId)
        return cancelled
      }
      const resultSlice = output.results.slice(chunkIndex * 50, (chunkIndex + 1) * 50)
      const ids = resultSlice.map((row) => row.candidate_id)
      const [{ data: run, error: runError }, { data: candidates, error: candidatesError }] = await Promise.all([
        supabase.from("prospecting_runs").select("city, state_code").eq("id", state.runId).maybeSingle(),
        supabase.from("prospecting_run_candidates").select("candidate_id, prospecting_candidates(company_name, primary_category, address, phone, website, website_domain, cnpj)").eq("run_id", state.runId).in("candidate_id", ids),
      ])
      if (runError || candidatesError || !run || candidates?.length !== ids.length) throw new Error("Não foi possível confirmar os candidatos durante o staging.")
      const byCandidate = new Map(candidates.map((relation) => {
        const candidate = Array.isArray(relation.prospecting_candidates) ? relation.prospecting_candidates[0] : relation.prospecting_candidates
        return [relation.candidate_id, candidate as Record<string, string | null>]
      }))
      const sourceCheckedAt = new Date().toISOString()
      const rows = resultSlice.map((result, itemIndex) => {
        const original = byCandidate.get(result.candidate_id)
        if (!original) throw new Error("Um candidato deixou de pertencer à execução.")
        const context: CnpjSearchCandidate = { run_id: state.runId!, candidate_id: result.candidate_id, company_name: original.company_name ?? "", primary_category: original.primary_category ?? "", address: original.address ?? "", phone: original.phone ?? "", website: original.website ?? "", website_domain: original.website_domain ?? "", city: run.city ?? "", state_code: run.state_code ?? "", existing_cnpj: original.cnpj ?? "" }
        return { ...context, research_status: original.cnpj || result.research_status === "skipped" ? "not_found" : result.research_status, cnpj: result.cnpj ?? "", legal_name: result.legal_name ?? "", trade_name: result.trade_name ?? "", registration_status: result.registration_status ?? "", matched_city: result.matched_city ?? "", matched_state_code: result.matched_state_code ?? "", primary_cnae: result.primary_cnae ?? "", source_url: result.research_status === "found" ? result.source_url ?? "" : "", source_checked_at: result.research_status === "found" ? result.source_checked_at ?? sourceCheckedAt : "", source_row_number: chunkIndex * 50 + itemIndex + 2 }
      })
      const staged = await stageProspectingCnpjFileChunkAction({ importId: state.importId, chunkIndex, rows })
      if (staged.status !== "success") throw new Error(staged.message)
      const summary = { ...state.summary!, chunksStaged: chunkIndex + 1 }
      const candidatesProcessed = Math.min((chunkIndex + 1) * 50, state.candidateTotal)
      state = updateStatus(paths, state, { summary, candidatesProcessed, message: `Gravados ${summary.chunksStaged} de ${summary.chunksTotal} blocos.` }, { at: new Date().toISOString(), type: "progress", phase: "staging", chunksStaged: summary.chunksStaged, candidatesProcessed })
    }
    return state
  } catch (error) {
    if (state.importId) await abortProspectingCnpjFileImportAction({ importId: state.importId })
    const message = error instanceof Error ? error.message.slice(0, 500) : "O staging falhou."
    const failed = updateStatus(paths, state, { status: "failed", phase: "finished", finishedAt: new Date().toISOString(), message }, { at: new Date().toISOString(), type: "error", phase: "finished", message })
    await releaseCnpjScanLock(paths, parsed.data.executionId)
    return failed
  }
}

export async function commitLocalCnpjScanAction(input: unknown): Promise<LocalCnpjScanState> {
  const { paths, state: initial } = await authorizedExecutionInput(input)
  if (!paths || !initial.executionId || (initial.status !== "staging" && initial.status !== "committing" && initial.status !== "commit_pending") || !initial.importId || initial.summary?.chunksStaged !== initial.summary?.chunksTotal) return initial
  const releaseCommitLease = acquireCnpjScanCommitLease(paths, initial.executionId)
  if (!releaseCommitLease) return await readCnpjScanState(paths, initial.executionId)
  try {
  if (!claimCnpjScanCommit(paths, initial.executionId)) return await readCnpjScanState(paths, initial.executionId)
  let state = await readCnpjScanState(paths, initial.executionId)
  appendCnpjScanEvent(paths, initial.executionId, { at: new Date().toISOString(), type: "commit", phase: "committing", message: "Commit atômico iniciado." })
  const first = await commitProspectingCnpjFileImportAction({ importId: state.importId })
  const retried = first.status === "success" ? first : await commitProspectingCnpjFileImportAction({ importId: state.importId })
  let committedSummary = retried.status === "success" ? retried.summary : undefined
  if (!committedSummary) {
    const { user } = await requireCommercialMember()
    const supabase = await createClient()
    const reconciled = await supabase.rpc("get_prospecting_cnpj_local_scan_import_state", { p_import_id: state.importId, p_actor_id: user.id })
    const data = reconciled.data && typeof reconciled.data === "object" ? reconciled.data as Record<string, unknown> : null
    const rawSummary = data?.summary && typeof data.summary === "object" ? data.summary as Record<string, unknown> : null
    if (!reconciled.error && data?.status === "committed" && rawSummary) {
      const counts = [rawSummary.suggestions, rawSummary.notFound, rawSummary.ambiguous, rawSummary.skipped]
      if (counts.every((value) => Number.isInteger(value) && Number(value) >= 0)) {
        committedSummary = { suggestions: Number(rawSummary.suggestions), notFound: Number(rawSummary.notFound), ambiguous: Number(rawSummary.ambiguous), skipped: Number(rawSummary.skipped) }
      }
    }
    if (!committedSummary) {
      const message = !reconciled.error && data?.status === "staging"
        ? "O banco confirmou que o import continua em staging. Tente finalizar novamente ou solicite o cancelamento."
        : "Não foi possível confirmar o resultado do commit. A execução está protegida contra uma nova pesquisa."
      return updateStatus(paths, state, { status: "commit_pending", message }, { at: new Date().toISOString(), type: "error", phase: "committing", message })
    }
  }
  const summary = { ...state.summary!, suggestions: committedSummary.suggestions, notFound: committedSummary.notFound, ambiguous: committedSummary.ambiguous, skipped: committedSummary.skipped, failed: 0, elapsedMs: state.startedAt ? Date.now() - new Date(state.startedAt).getTime() : state.summary!.elapsedMs }
  state = updateStatus(paths, state, { status: "completed", phase: "finished", finishedAt: new Date().toISOString(), summary, message: "Pesquisa local concluída. Revise as sugestões antes de confirmar CNPJs." }, { at: new Date().toISOString(), type: "terminal", phase: "finished", suggestions: summary.suggestions, ambiguous: summary.ambiguous, notFound: summary.notFound, message: "Pesquisa concluída e importada." })
  await releaseCnpjScanLock(paths, state.executionId!)
  revalidatePath(`/prospecting/${state.runId}`)
  return state
  } finally {
    releaseCommitLease()
  }
}

async function authorizedExecutionInput(input: unknown) {
  await requireCommercialMember()
  const parsed = executionInput.safeParse(input)
  if (!parsed.success) return { paths: null, state: emptyScanState(true, "failed", "Identificador de execução inválido.") }
  return authorizedExecution(parsed.data.executionId)
}

export async function clearLocalCnpjScanArtifactsAction() {
  await requireCommercialMember()
  const paths = resolveLocalCnpjPaths()
  if (!paths) throw new Error("A pasta de estado local não está configurada.")
  return clearLocalCnpjArtifacts(paths)
}

async function localCleanupRpc(name: string, runId: string) {
  const { user } = await requireCommercialMember()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(name, { p_run_id: runId, p_actor_id: user.id })
  if (error || !data || typeof data !== "object") throw new Error("Não foi possível concluir a operação nos resultados locais desta prospecção.")
  return data as Record<string, unknown>
}

function cleanupCounts(value: Record<string, unknown>, deleting = false): LocalCnpjCleanupPreview | LocalCnpjCleanupSummary {
  const keys = ["imports", "batches", "attempts", "matches", "confirmedMatches"]
  const counts = Object.fromEntries(keys.map((key) => [key, Number.isInteger(value[key]) && Number(value[key]) >= 0 ? Number(value[key]) : 0])) as unknown as LocalCnpjCleanupPreview
  if (!deleting) return counts
  return { ...counts, deletedImports: Number(value.deletedImports) || 0, deletedBatches: Number(value.deletedBatches) || 0, deletedAttempts: Number(value.deletedAttempts) || 0, deletedMatches: Number(value.deletedMatches) || 0, resetCandidates: Number(value.resetCandidates) || 0 }
}

export async function previewLocalCnpjCleanupAction(input: unknown): Promise<LocalCnpjCleanupPreview> {
  const parsed = runInput.safeParse(input)
  if (!parsed.success) throw new Error("Execução de prospecção inválida.")
  return cleanupCounts(await localCleanupRpc("preview_prospecting_cnpj_local_cleanup", parsed.data.runId)) as LocalCnpjCleanupPreview
}

export async function deleteLocalCnpjResultsAction(input: unknown): Promise<LocalCnpjCleanupSummary> {
  const parsed = runInput.safeParse(input)
  if (!parsed.success) throw new Error("Execução de prospecção inválida.")
  const result = cleanupCounts(await localCleanupRpc("delete_prospecting_cnpj_local_results", parsed.data.runId), true) as LocalCnpjCleanupSummary
  revalidatePath(`/prospecting/${parsed.data.runId}`)
  return result
}
