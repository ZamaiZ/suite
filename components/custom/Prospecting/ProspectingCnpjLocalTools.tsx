"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import {
  cancelLocalCnpjScanAction, clearLocalCnpjScanArtifactsAction, commitLocalCnpjScanAction,
  deleteLocalCnpjResultsAction, getActiveLocalCnpjScanStateAction, getLocalCnpjScanEventsAction,
  getLocalCnpjScanStateAction, inspectLocalCnpjSourceAction, previewLocalCnpjCleanupAction,
  stageNextLocalCnpjScanChunkAction, startLocalCnpjScanAction,
} from "@/app/actions/prospecting"
import type { LocalCnpjCleanupPreview, LocalCnpjScanEvent, LocalCnpjScanState, LocalCnpjSourceInspectionState } from "@/lib/prospecting/local-cnpj-scan/contracts"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { Toaster, toast } from "@/components/ui/toast"
import { RiDeleteBinLine, RiHardDrive2Line, RiSearchLine, RiStopCircleLine } from "react-icons/ri"

const STATUS_LABEL: Record<LocalCnpjScanState["status"], string> = {
  idle: "Pronta", scanning: "Varredura em andamento", scan_complete: "Varredura concluída", staging: "Gravando resultados", committing: "Finalizando importação", commit_pending: "Finalização pendente", completed: "Concluída", cancelled: "Cancelada", failed: "Falhou",
}
function formatBytes(value: number | null) {
  if (value === null) return "—"
  if (value < 1024 ** 3) return (value / 1024 ** 2).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + " MB"
  return (value / 1024 ** 3).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " GB"
}
function formatDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  return seconds < 60 ? seconds + " s" : Math.floor(seconds / 60) + " min " + seconds % 60 + " s"
}
function formatTimestamp(value: string | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value)) : "—"
}
function eventLabel(event: LocalCnpjScanEvent) {
  const label = event.message ?? ({ preparing: "Preparando a pesquisa", companies: "Lendo empresas", establishments: "Lendo estabelecimentos", matching: "Validando correspondências", staging: "Gravando resultados", committing: "Finalizando importação", finished: "Execução encerrada" } as const)[event.phase]
  const summary = [event.suggestions === undefined ? null : event.suggestions + " sugestões", event.ambiguous === undefined ? null : event.ambiguous + " ambíguos", event.notFound === undefined ? null : event.notFound + " sem correspondência"].filter(Boolean).join(" · ")
  return summary ? label + " · " + summary : label
}
const initialScan: LocalCnpjScanState = { enabled: false, executionId: null, runId: null, snapshotKey: null, datasetVersion: null, status: "idle", phase: "preparing", currentFile: null, bytesRead: 0, totalBytes: 0, rowsRead: 0, completedFiles: 0, totalFiles: 20, candidateTotal: 0, candidatesProcessed: 0, freeBytes: null, rateBytesPerSecond: null, startedAt: null, updatedAt: null, finishedAt: null, importId: null, summary: null, message: null }

export function ProspectingCnpjLocalTools({ runId, onImported }: { runId: string; onImported: () => void }) {
  const [source, setSource] = useState<LocalCnpjSourceInspectionState | null>(null)
  const [state, setState] = useState<LocalCnpjScanState>(initialScan)
  const [events, setEvents] = useState<LocalCnpjScanEvent[]>([])
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [cleanupPreview, setCleanupPreview] = useState<LocalCnpjCleanupPreview | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, startTransition] = useTransition()
  const mounted = useRef(false)
  const completedExecution = useRef<string | null>(null)
  const notificationExecution = useRef<string | null>(null)
  const notifiedExecutions = useRef(new Set<string>())
  const audioContext = useRef<AudioContext | null>(null)
  const stopWait = useRef<(() => void) | null>(null)
  const driveRef = useRef<((executionId: string) => void) | null>(null)
  const onImportedRef = useRef(onImported)
  onImportedRef.current = onImported
  const loadEvents = useCallback(async (executionId: string) => setEvents(await getLocalCnpjScanEventsAction({ executionId })), [])

  const unlockOutcomeSound = useCallback(() => {
    if (typeof window === "undefined" || !("AudioContext" in window)) return
    try {
      audioContext.current ??= new window.AudioContext()
      if (audioContext.current.state === "suspended") void audioContext.current.resume()
    } catch {}
  }, [])

  const notifyOutcome = useCallback((executionId: string, status: "completed" | "cancelled" | "failed", message: string | null, summary: LocalCnpjScanState["summary"]) => {
    if (notifiedExecutions.current.has(executionId)) return
    notifiedExecutions.current.add(executionId)
    const isSuccess = status === "completed"
    const title = isSuccess ? "Pesquisa de CNPJ concluída" : status === "cancelled" ? "Pesquisa de CNPJ cancelada" : "Pesquisa de CNPJ falhou"
    const description = isSuccess && summary
      ? `${summary.suggestions.toLocaleString("pt-BR")} encontrados · ${summary.ambiguous.toLocaleString("pt-BR")} ambíguos · ${summary.notFound.toLocaleString("pt-BR")} sem correspondência.`
      : message ?? (status === "cancelled" ? "A pesquisa foi interrompida." : "Ocorreu uma falha durante a pesquisa.")
    toast.add({ title, description, type: isSuccess ? "success" : status === "cancelled" ? "warning" : "error" })

    const context = audioContext.current
    if (!context) return
    void context.resume().then(() => {
      const notes = status === "completed" ? [660, 880] : status === "cancelled" ? [520] : [440, 330]
      const startAt = context.currentTime + 0.02
      for (const [index, frequency] of notes.entries()) {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        const noteStart = startAt + index * 0.15
        oscillator.type = "sine"
        oscillator.frequency.setValueAtTime(frequency, noteStart)
        gain.gain.setValueAtTime(0.0001, noteStart)
        gain.gain.exponentialRampToValueAtTime(0.045, noteStart + 0.025)
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.12)
        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.start(noteStart)
        oscillator.stop(noteStart + 0.13)
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!state.executionId || notificationExecution.current !== state.executionId) return
    if (state.status === "completed" || state.status === "cancelled" || state.status === "failed") {
      notifyOutcome(state.executionId, state.status, state.message, state.summary)
    }
  }, [notifyOutcome, state.executionId, state.message, state.status, state.summary])

  useEffect(() => {
    mounted.current = true
    let stopped = false
    async function wait(ms: number) {
      await new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, ms)
        stopWait.current = () => { window.clearTimeout(timer); resolve() }
      })
      stopWait.current = null
    }
    async function drive(executionId: string) {
      while (!stopped) {
        try {
          const next = await getLocalCnpjScanStateAction({ executionId })
          if (stopped) return
          setState(next); await loadEvents(executionId)
          if (next.status === "scan_complete" || next.status === "staging") {
            const staged = await stageNextLocalCnpjScanChunkAction({ executionId })
            if (stopped) return
            setState(staged); await loadEvents(executionId)
            if (staged.status === "staging" && staged.summary?.chunksStaged === staged.summary?.chunksTotal) {
              const committed = await commitLocalCnpjScanAction({ executionId })
              if (stopped) return
              setState(committed); await loadEvents(executionId)
              if (committed.status === "completed" && completedExecution.current !== executionId) { completedExecution.current = executionId; onImportedRef.current(); return }
              if (committed.status === "failed" || committed.status === "cancelled") return
              if (committed.status === "commit_pending") return
              await wait(1400); continue
            }
            if (staged.status === "failed" || staged.status === "cancelled") return
            await wait(250); continue
          }
          if (next.status === "completed") {
            if (completedExecution.current !== executionId) { completedExecution.current = executionId; onImportedRef.current() }
            return
          }
          if (next.status === "cancelled" || next.status === "failed" || next.status === "idle") return
          if (next.status === "commit_pending") return
          if (next.status === "committing") {
            const resumed = await commitLocalCnpjScanAction({ executionId })
            if (stopped) return
            setState(resumed); await loadEvents(executionId)
            if (resumed.status === "completed") {
              if (completedExecution.current !== executionId) { completedExecution.current = executionId; onImportedRef.current() }
              return
            }
            if (resumed.status === "commit_pending") return
          }
          await wait(next.status === "committing" ? 1800 : 1500)
        } catch {
          if (stopped) return
          setError("Não foi possível atualizar a execução. A próxima consulta tentará novamente.")
          await wait(2500)
        }
      }
    }
    driveRef.current = (executionId) => { void drive(executionId) }
    void (async () => {
      try {
        setSource(await inspectLocalCnpjSourceAction())
        const active = await getActiveLocalCnpjScanStateAction({ runId })
        if (stopped) return
        if (active?.executionId) { notificationExecution.current = active.executionId; setState(active); driveRef.current?.(active.executionId) }
      } catch { if (!stopped) setError("Não foi possível validar a base local da Receita.") }
    })()
    return () => { stopped = true; mounted.current = false; driveRef.current = null; stopWait.current?.(); stopWait.current = null }
  }, [loadEvents, runId])

  const active = ["scanning", "scan_complete", "staging", "committing", "commit_pending"].includes(state.status)
  const progress = state.totalBytes > 0 ? Math.min(100, Math.round(state.bytesRead / state.totalBytes * 100)) : null
  const elapsed = state.startedAt ? Date.now() - new Date(state.startedAt).getTime() : 0
  const remaining = state.rateBytesPerSecond && state.rateBytesPerSecond > 0 && state.totalBytes > state.bytesRead ? (state.totalBytes - state.bytesRead) / state.rateBytesPerSecond : null

  function startScan() {
    unlockOutcomeSound()
    setError(""); setNotice(""); setEvents([]); setState({ ...initialScan, enabled: true })
    startTransition(async () => {
      try {
        const next = await startLocalCnpjScanAction({ runId })
        if (next.executionId) notificationExecution.current = next.executionId
        setState(next)
        if (next.status === "failed") {
          setError(next.message ?? "Não foi possível iniciar a pesquisa.")
          if (!next.executionId) notifyOutcome(`start-${Date.now()}`, "failed", next.message, next.summary)
        }
        else if (next.executionId) {
          await loadEvents(next.executionId)
          driveRef.current?.(next.executionId)
        }
      } catch {
        const message = "Não foi possível iniciar a pesquisa local."
        setError(message)
        notifyOutcome(`start-${Date.now()}`, "failed", message, null)
      }
    })
  }
  function cancelScan() {
    if (!state.executionId) return
    setError("")
    startTransition(async () => {
      try {
        const executionId = state.executionId!
        const next = await cancelLocalCnpjScanAction({ executionId })
        setState(next); await loadEvents(executionId)
        if (next.status === "failed") setError(next.message ?? "Não foi possível cancelar a pesquisa.")
      } catch { setError("Não foi possível solicitar o cancelamento.") }
    })
  }
  function retryCommit() {
    if (!state.executionId || state.status !== "commit_pending") return
    setError("")
    startTransition(async () => {
      try {
        const next = await commitLocalCnpjScanAction({ executionId: state.executionId! })
        setState(next)
        if (next.status === "completed" && completedExecution.current !== next.executionId) {
          completedExecution.current = next.executionId
          onImportedRef.current()
        }
      } catch { setError("Não foi possível retomar a finalização do import.") }
    })
  }
  function clearLocal() {
    setError(""); setNotice("")
    startTransition(async () => {
      try {
        const result = await clearLocalCnpjScanArtifactsAction()
        setNotice(formatBytes(result.deletedBytes) + " removidos · " + result.deletedEvents.toLocaleString("pt-BR") + " eventos apagados.")
        setEvents([]); setState(initialScan); setSource(await inspectLocalCnpjSourceAction())
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível limpar o estado local.") }
    })
  }
  function previewRemoteCleanup() {
    setError(""); setCleanupPreview(null)
    startTransition(async () => {
      try { setCleanupPreview(await previewLocalCnpjCleanupAction({ runId })); setDeleteOpen(true) }
      catch { setError("Não foi possível consultar as contagens dos resultados locais.") }
    })
  }
  function deleteRemoteResults() {
    setDeleteOpen(false); setError(""); setNotice("")
    startTransition(async () => {
      try {
        const result = await deleteLocalCnpjResultsAction({ runId })
        setNotice(result.deletedMatches.toLocaleString("pt-BR") + " matches e " + result.resetCandidates.toLocaleString("pt-BR") + " CNPJs confirmados removidos.")
        setCleanupPreview(null); onImported()
      } catch { setError("Não foi possível apagar os resultados locais desta prospecção.") }
    })
  }

  return (
    <Toaster>
    <section aria-label="Pesquisa local de CNPJ" onPointerDownCapture={unlockOutcomeSound} className="grid gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Pesquisa local de CNPJ</h2>
            <Badge variant={state.status === "completed" ? "success" : active ? "primary" : state.status === "failed" ? "destructive" : state.status === "cancelled" ? "muted" : "outline"}>
              {state.executionId ? STATUS_LABEL[state.status] : source?.status === "source_ready" ? "Base pronta" : source?.status === "not_configured" ? "Não configurada" : source?.status === "missing" ? "Base indisponível" : source?.status === "failed" ? "Validação falhou" : "Verificando base"}
            </Badge>
          </div>
          <p className="max-w-3xl text-xs text-muted-foreground">O Suite lê os CSVs originais em sequência. Cada pesquisa percorre a base local; nenhum índice duplicado é criado.</p>
          {source?.competence ? <p className="text-xs text-muted-foreground">Competência da Receita: D{source.competence} · {source.files.length} arquivos · {formatBytes(source.totalBytes)}</p> : null}
          {source?.message ? <p className="text-xs text-muted-foreground" role="status">{source.message}</p> : null}
          {state.message ? <p className="text-xs text-muted-foreground" role="status">{state.message}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" disabled={!source?.ready || active || busy} onClick={startScan}>
            {busy && !active ? <Spinner className="size-3" aria-hidden /> : <RiSearchLine aria-hidden />}Pesquisar CNPJs
          </Button>
          {active && state.status !== "commit_pending" ? <Button size="sm" variant="outline" disabled={busy || state.status === "committing"} onClick={() => setCancelOpen(true)}><RiStopCircleLine aria-hidden />Cancelar pesquisa</Button> : null}
          {state.status === "commit_pending" ? <Button size="sm" variant="outline" disabled={busy} onClick={retryCommit}>{busy ? <Spinner className="size-3" aria-hidden /> : null}Tentar finalizar</Button> : null}
        </div>
      </div>
      {state.executionId && active ? (
        <div className="grid gap-2 rounded-md border border-border bg-muted/30 p-3" role="status" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-medium text-foreground">{state.currentFile ?? STATUS_LABEL[state.status]}</span><span className="tabular-nums text-muted-foreground">{progress === null ? "—" : progress + "%"} · {formatBytes(state.bytesRead)} de {formatBytes(state.totalBytes)}</span></div>
          {progress !== null ? <Progress value={progress} aria-label="Progresso da leitura dos CSVs" /> : null}
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
            <p>{state.rowsRead.toLocaleString("pt-BR")} linhas lidas</p><p>{state.candidatesProcessed.toLocaleString("pt-BR")} de {state.candidateTotal.toLocaleString("pt-BR")} candidatos</p>
            <p>Decorrido: {formatDuration(elapsed)}</p><p>{remaining === null ? "Tempo restante: —" : "Estimativa: " + formatDuration(remaining * 1000)}</p>
            <p>Velocidade: {state.rateBytesPerSecond ? formatBytes(state.rateBytesPerSecond) + "/s" : "—"}</p><p>Espaço livre: {formatBytes(state.freeBytes)}</p>
            <p>Última atividade: {formatTimestamp(state.updatedAt)}</p><p>{state.completedFiles} de {state.totalFiles} arquivos concluídos</p>
          </div>
          {state.status === "committing" || state.status === "commit_pending" ? <p className="text-xs text-muted-foreground">O commit já foi iniciado. O Suite confirma o resultado antes de liberar outra pesquisa ou permitir cancelamento.</p> : null}
        </div>
      ) : null}
      {state.summary && (state.status === "completed" || state.status === "failed" || state.status === "cancelled") ? (
        <div className="grid gap-2 rounded-md border border-border p-3 text-xs sm:grid-cols-2 lg:grid-cols-5" role="status">
          <p>{state.summary.processed.toLocaleString("pt-BR")} candidatos processados</p><p>{state.summary.suggestions.toLocaleString("pt-BR")} sugestões</p><p>{state.summary.ambiguous.toLocaleString("pt-BR")} ambíguos</p><p>{state.summary.notFound.toLocaleString("pt-BR")} sem correspondência</p><p>{state.summary.skipped.toLocaleString("pt-BR")} já confirmados</p>
        </div>
      ) : null}
      {events.length ? (
        <details className="rounded-md border border-border px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-foreground">Histórico da execução <span className="font-normal text-muted-foreground">· {events.length} eventos recentes</span></summary>
          <ol className="mt-2 grid max-h-52 gap-1 overflow-y-auto border-t border-border pt-2">{events.slice(-100).reverse().map((item, index) => <li key={item.at + ":" + index} className="flex flex-wrap gap-x-2 text-xs"><time className="shrink-0 tabular-nums text-muted-foreground">{formatTimestamp(item.at)}</time><span className="text-foreground">{eventLabel(item)}</span></li>)}</ol>
        </details>
      ) : null}
      <div className="grid gap-2 border-t border-border pt-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-w-0 space-y-1 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5"><RiHardDrive2Line aria-hidden />Estado local: {source?.stateDirectory ?? "não configurado"}</p>
          <p>{formatBytes(source?.localStateBytes ?? 0)} · {source?.localEventCount ?? 0} eventos. Os resultados temporários são removidos ao concluir ou cancelar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy || active || !(source?.localStateBytes)} onClick={clearLocal}><RiDeleteBinLine aria-hidden />Limpar estado local</Button>
          <Button size="sm" variant="outline" disabled={busy || active || !source?.enabled} onClick={previewRemoteCleanup}><RiDeleteBinLine aria-hidden />Apagar resultados desta prospecção</Button>
        </div>
      </div>
      {notice ? <p className="text-xs text-muted-foreground" role="status">{notice}</p> : null}
      {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogMedia><RiStopCircleLine className="text-destructive" aria-hidden /></AlertDialogMedia><AlertDialogTitle>Cancelar pesquisa?</AlertDialogTitle><AlertDialogDescription>A leitura será interrompida de forma cooperativa. Se a gravação já começou, o import temporário será abortado; nenhum resultado parcial será mantido.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Continuar pesquisa</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => { setCancelOpen(false); cancelScan() }}>Cancelar pesquisa</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogMedia><RiDeleteBinLine className="text-destructive" aria-hidden /></AlertDialogMedia><AlertDialogTitle>Apagar resultados locais?</AlertDialogTitle><AlertDialogDescription>Serão removidos apenas os dados da fonte local desta prospecção. Confirmações baseadas em outra fonte permanecem intactas.</AlertDialogDescription></AlertDialogHeader>
          {cleanupPreview ? <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-border bg-muted/30 p-3 text-xs"><dt className="text-muted-foreground">Imports</dt><dd className="text-right tabular-nums">{cleanupPreview.imports}</dd><dt className="text-muted-foreground">Lotes</dt><dd className="text-right tabular-nums">{cleanupPreview.batches}</dd><dt className="text-muted-foreground">Tentativas</dt><dd className="text-right tabular-nums">{cleanupPreview.attempts}</dd><dt className="text-muted-foreground">Matches</dt><dd className="text-right tabular-nums">{cleanupPreview.matches}</dd><dt className="text-muted-foreground">CNPJs locais confirmados</dt><dd className="text-right tabular-nums">{cleanupPreview.confirmedMatches}</dd></dl> : null}
          <AlertDialogFooter><AlertDialogCancel>Manter resultados</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={busy} onClick={deleteRemoteResults}>Apagar resultados locais</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
    </Toaster>
  )
}
