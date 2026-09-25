"use client"

import Link from "next/link"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import { useRouter } from "next/navigation"
import {
  RiArrowLeftLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiBuilding2Line,
  RiCloseCircleLine,
  RiPauseLine,
  RiPlayLine,
  RiSearchLine,
} from "react-icons/ri"
import {
  advanceProspectingRunAction,
  cancelProspectingRunAction,
  getProspectingRun,
  listProspectingCandidatesAction,
  pauseProspectingRunAction,
  resumeProspectingRunAction,
  startProspectingRunAction,
  advanceProspectingCnpjBatchAction,
  getActiveProspectingCnpjBatchAction,
  startProspectingCnpjBatchAction,
} from "@/app/actions/prospecting"
import type { ImportCandidateResult } from "@/app/actions/prospecting"
import {
  ProspectingCandidateTable,
  isProspectingCandidateSelectable,
} from "./ProspectingCandidateTable"
import { ProspectingImportDialog } from "./ProspectingImportDialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import type {
  ProspectingCandidateFilter,
  ProspectingCandidatePage,
  ProspectingRunDetail,
} from "@/lib/prospecting/reads"
import type { ProspectingRunStatus } from "@/lib/prospecting/types"
import type { ProspectingCnpjBatchProgress } from "@/lib/prospecting/reads"

export type ProspectingCandidateFilters = {
  q: string
  filter: ProspectingCandidateFilter
  page: number
}

const FILTER_ITEMS: Array<{
  value: ProspectingCandidateFilter
  label: string
}> = [
  { value: "available", label: "Disponíveis" },
  { value: "ambiguous", label: "Ambíguos" },
  { value: "duplicate", label: "Duplicados" },
  { value: "imported", label: "Importados" },
  { value: "ignored", label: "Ignorados" },
]

const STATUS: Record<
  ProspectingRunStatus,
  { label: string; variant: "muted" | "primary" | "warning" | "success" | "destructive" }
> = {
  draft: { label: "Rascunho", variant: "muted" },
  collecting: { label: "Coletando", variant: "primary" },
  paused: { label: "Pausada", variant: "warning" },
  completed: { label: "Concluída", variant: "success" },
  failed: { label: "Falhou", variant: "destructive" },
  cancelled: { label: "Cancelada", variant: "muted" },
}

function runHref(runId: string, filters: ProspectingCandidateFilters) {
  const params = new URLSearchParams()
  const query = filters.q.trim()
  if (query) params.set("q", query)
  if (filters.filter !== "available") params.set("filter", filters.filter)
  if (filters.page > 1) params.set("page", String(filters.page))
  const search = params.toString()
  return search ? `/prospecting/${runId}?${search}` : `/prospecting/${runId}`
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value)
}

function pauseMessage(run: ProspectingRunDetail) {
  if (run.status === "failed") {
    return run.errorMessage ?? "A pesquisa falhou durante a coleta."
  }
  if (run.status !== "paused") return null
  if (run.pauseReason === "budget") {
    return "A pesquisa foi pausada porque o orçamento foi atingido."
  }
  if (run.pauseReason === "vendor_price_change") {
    return "A pesquisa foi pausada porque a tarifa DataForSEO mudou. Revise o custo antes de retomar."
  }
  return "A pesquisa foi pausada manualmente."
}

export function ProspectingRunPage({
  initialRun,
  initialCandidates,
  initialCandidateError,
  filters,
}: {
  initialRun: ProspectingRunDetail
  initialCandidates: ProspectingCandidatePage
  initialCandidateError: string | null
  filters: ProspectingCandidateFilters
}) {
  const router = useRouter()
  const pollingInFlight = useRef(false)
  const [run, setRun] = useState(initialRun)
  const [candidates, setCandidates] = useState(initialCandidates)
  const [candidateError, setCandidateError] = useState(initialCandidateError)
  const [pollError, setPollError] = useState("")
  const [query, setQuery] = useState(filters.q)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [cancelOpen, setCancelOpen] = useState(false)
  const [commandName, setCommandName] = useState<
    "start" | "pause" | "resume" | "cancel" | null
  >(null)
  const [routePending, startRouteTransition] = useTransition()
  const [commandPending, startCommandTransition] = useTransition()
  const [cnpjBatch, setCnpjBatch] = useState<ProspectingCnpjBatchProgress | null>(null)
  const [cnpjMessage, setCnpjMessage] = useState("")
  const [cnpjRunning, setCnpjRunning] = useState(false)
  const [cnpjPending, setCnpjPending] = useState(false)
  const [cnpjActiveLoading, setCnpjActiveLoading] = useState(true)

  const [syncedRunStamp, setSyncedRunStamp] = useState(initialRun.updatedAt)
  if (syncedRunStamp !== initialRun.updatedAt) {
    setSyncedRunStamp(initialRun.updatedAt)
    setRun(initialRun)
  }
  const initialCandidateKey = `${filters.q}:${filters.filter}:${filters.page}:${initialCandidates.total}:${initialCandidates.items.map((item) => `${item.id}:${item.cnpjStatus}:${item.cnpj ?? ""}:${item.reviewState}:${item.importedLeadId ?? ""}`).join(",")}`
  const [syncedCandidateKey, setSyncedCandidateKey] = useState(initialCandidateKey)
  if (syncedCandidateKey !== initialCandidateKey) {
    setSyncedCandidateKey(initialCandidateKey)
    setCandidates(initialCandidates)
    setCandidateError(initialCandidateError)
  }
  const [syncedQuery, setSyncedQuery] = useState(filters.q)
  if (syncedQuery !== filters.q) {
    setSyncedQuery(filters.q)
    setQuery(filters.q)
  }

  useEffect(() => {
    let cancelled = false
    void getActiveProspectingCnpjBatchAction({ runId: run.id })
      .then((active) => { if (!cancelled) setCnpjBatch(active) })
      .catch(() => { if (!cancelled) setCnpjMessage("Não foi possível verificar se há um lote CNPJ em andamento.") })
      .finally(() => { if (!cancelled) setCnpjActiveLoading(false) })
    return () => { cancelled = true }
  }, [run.id])

  useEffect(() => {
    if (!cnpjRunning || !cnpjBatch) return
    let cancelled = false
    let timer: number | undefined
    async function tick() {
      if (cancelled || !cnpjBatch) return
      let result: Awaited<ReturnType<typeof advanceProspectingCnpjBatchAction>>
      try {
        result = await advanceProspectingCnpjBatchAction({ batchId: cnpjBatch.batchId })
      } catch {
        if (!cancelled) {
          setCnpjMessage("A pesquisa não pôde avançar. Você pode retomá-la explicitamente.")
          setCnpjRunning(false)
        }
        return
      }
      if (cancelled) return
      if (result.status !== "success" || !result.progress) {
        setCnpjMessage(result.status === "success" ? "O lote não retornou progresso." : result.message)
        setCnpjRunning(false)
        return
      }
      setCnpjBatch(result.progress)
      if (["completed", "source_limited", "source_unavailable"].includes(result.progress.status)) {
        setCnpjRunning(false)
        if (result.progress.status === "source_limited") setCnpjMessage("O limite gratuito ou a quota do BigQuery foi atingido. Nenhum CNPJ foi confirmado automaticamente.")
        else if (result.progress.status === "source_unavailable") setCnpjMessage("A fonte não respondeu. Você pode iniciar uma nova tentativa depois.")
        else setCnpjMessage("Pesquisa concluída. Revise as sugestões de CNPJ na tabela.")
        const fresh = await listProspectingCandidatesAction({ runId: run.id, query: filters.q, filter: filters.filter, page: filters.page, pageSize: candidates.pageSize })
        if (!cancelled && fresh.status === "success") setCandidates(fresh.result)
        if (!cancelled) router.refresh()
        return
      }
      timer = window.setTimeout(() => void tick(), 1500)
    }
    timer = window.setTimeout(() => void tick(), 0)
    return () => { cancelled = true; if (timer !== undefined) window.clearTimeout(timer) }
  }, [candidates.pageSize, cnpjBatch, cnpjRunning, filters.filter, filters.page, filters.q, router, run.id])

  async function startCnpjSearch() {
    if (cnpjPending) return
    setCnpjPending(true)
    setCnpjMessage("")
    let result: Awaited<ReturnType<typeof startProspectingCnpjBatchAction>>
    try {
      result = await startProspectingCnpjBatchAction({ runId: run.id, candidateIds: [...selectedIds] })
    } catch {
      setCnpjPending(false)
      setCnpjMessage("Não foi possível iniciar a pesquisa CNPJ.")
      return
    }
    setCnpjPending(false)
    if (result.status !== "success" || !result.batchId || !result.progress) {
      setCnpjMessage(result.status === "success" ? "Não foi possível preparar o lote." : result.message)
      return
    }
    setCnpjBatch(result.progress)
    setCnpjRunning(true)
    setSelectedIds(new Set())
  }

  function resumeCnpjSearch() {
    if (!cnpjBatch || cnpjPending) return
    setCnpjMessage("")
    setCnpjRunning(true)
  }

  function handleCnpjConfirmed(candidateId: string, cnpj: string) {
    setCandidates((current) => ({
      ...current,
      items: current.items.map((candidate) => candidate.id === candidateId
        ? { ...candidate, cnpj, cnpjStatus: "confirmed", cnpjConfirmedAt: new Date().toISOString() }
        : candidate),
    }))
  }

  const visibleSelectableIds = useMemo(
    () =>
      candidates.items
        .filter(isProspectingCandidateSelectable)
        .map((candidate) => candidate.id),
    [candidates.items],
  )
  // Trocar filtro ou página troca quem está selecionável. A poda acompanha o
  // resto do arquivo e acontece no render, não num efeito: assim a contagem de
  // selecionados nunca é pintada com um candidato que saiu da lista.
  const visibleSelectableKey = visibleSelectableIds.join(",")
  const [syncedSelectableKey, setSyncedSelectableKey] =
    useState(visibleSelectableKey)
  if (syncedSelectableKey !== visibleSelectableKey) {
    setSyncedSelectableKey(visibleSelectableKey)
    const visible = new Set(visibleSelectableIds)
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => visible.has(id)))
      return next.size === current.size ? current : next
    })
  }
  const selectedCandidates = useMemo(
    () => candidates.items.filter((candidate) => selectedIds.has(candidate.id)),
    [candidates.items, selectedIds],
  )

  useEffect(() => {
    if (query.trim() === filters.q.trim()) return
    const timer = window.setTimeout(() => {
      startRouteTransition(() => {
        router.replace(
          runHref(run.id, { ...filters, q: query.trim(), page: 1 }),
          { scroll: false },
        )
      })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [filters.filter, filters.page, filters.q, query, router, run.id])

  useEffect(() => {
    if (run.status !== "collecting") return
    let stopped = false
    let timer: number | undefined

    function schedule(delay = 1200) {
      if (!stopped) timer = window.setTimeout(tick, delay)
    }

    async function tick() {
      if (stopped) return
      if (pollingInFlight.current) {
        schedule(500)
        return
      }
      pollingInFlight.current = true
      let nextStatus: ProspectingRunStatus = "collecting"
      let continuePolling = true
      try {
        const advanced = await advanceProspectingRunAction(run.id)
        if (stopped) return
        if (advanced.status === "error") {
          setPollError(advanced.message)
          continuePolling = false
          const freshRun = await getProspectingRun(run.id)
          if (freshRun) {
            nextStatus = freshRun.status
            setRun(freshRun)
          }
          return
        }
        if (advanced.outcome === "busy") {
          schedule()
          return
        }

        const freshRun = await getProspectingRun(run.id)
        if (stopped) return
        if (!freshRun) {
          setPollError("A pesquisa não está mais disponível.")
          return
        }
        nextStatus = freshRun.status
        setRun(freshRun)
        setPollError("")

        const freshCandidates = await listProspectingCandidatesAction({
          runId: run.id,
          query: filters.q,
          filter: filters.filter,
          page: filters.page,
          pageSize: candidates.pageSize,
        })
        if (stopped) return
        if (freshCandidates.status === "error") {
          setCandidateError(freshCandidates.message)
        } else {
          setCandidates(freshCandidates.result)
          setCandidateError(null)
        }
      } catch {
        if (!stopped) {
          setPollError("Não foi possível atualizar a pesquisa.")
          continuePolling = false
        }
      } finally {
        pollingInFlight.current = false
      }
      if (continuePolling && nextStatus === "collecting") schedule()
      else router.refresh()
    }

    schedule(500)
    return () => {
      stopped = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [
    candidates.pageSize,
    filters.filter,
    filters.page,
    filters.q,
    router,
    run.id,
    run.status,
  ])

  function replaceFilters(next: Partial<ProspectingCandidateFilters>) {
    startRouteTransition(() => {
      router.replace(runHref(run.id, { ...filters, ...next }), {
        scroll: false,
      })
    })
  }

  async function refreshRun() {
    try {
      const fresh = await getProspectingRun(run.id)
      if (fresh) setRun(fresh)
      router.refresh()
    } catch {
      setPollError("O comando foi aplicado, mas o estado não pôde ser atualizado.")
    }
  }

  function command(kind: "start" | "pause" | "resume" | "cancel") {
    setCommandName(kind)
    setPollError("")
    startCommandTransition(async () => {
      const result =
        kind === "start"
          ? await startProspectingRunAction(run.id)
          : kind === "pause"
          ? await pauseProspectingRunAction(run.id)
          : kind === "resume"
            ? await resumeProspectingRunAction(run.id)
            : await cancelProspectingRunAction(run.id)
      if (result.status === "error") {
        setPollError(result.message)
        // Só o início devolve `started`: pausar, retomar e cancelar compartilham
        // um estado de erro mais estreito, então o campo é conferido em runtime.
        if (kind === "start" && "started" in result && result.started) {
          await refreshRun()
        }
        setCommandName(null)
        return
      }
      await refreshRun()
      setCommandName(null)
    })
  }

  function handleImportResult(result: ImportCandidateResult) {
    setCandidates((current) => ({
      ...current,
      items: current.items.map((candidate) => {
        if (candidate.id !== result.candidateId) return candidate
        if (result.outcome === "imported") {
          return {
            ...candidate,
            reviewState: "imported",
            importedLeadId: result.leadId ?? candidate.importedLeadId,
            conflictKind: null,
            conflictSeverity: null,
          }
        }
        if (result.outcome === "conflict") {
          return {
            ...candidate,
            reviewState: "duplicate",
            conflictKind: result.conflictKind ?? "existing_lead",
            conflictSeverity: "block",
            relatedLeadId: result.relatedLeadId ?? null,
          }
        }
        if (result.outcome === "stale") {
          return { ...candidate, reviewState: "stale" }
        }
        if (result.outcome === "closed") {
          return { ...candidate, reviewState: "closed" }
        }
        if (result.outcome === "no_contact") {
          return { ...candidate, reviewState: "missing_contact" }
        }
        if (result.outcome === "outside") {
          return {
            ...candidate,
            territoryClass: "outside",
            reviewState: "outside_city",
          }
        }
        if (result.outcome === "mismatch") {
          return {
            ...candidate,
            categoryClass: "mismatch",
            reviewState: "category_mismatch",
          }
        }
        return candidate
      }),
    }))
    if (result.outcome !== "error") {
      setSelectedIds((current) => {
        const next = new Set(current)
        next.delete(result.candidateId)
        return next
      })
    }
  }

  async function syncAfterImport() {
    try {
      const freshRun = await getProspectingRun(run.id)
      if (freshRun) setRun(freshRun)
      const freshCandidates = await listProspectingCandidatesAction({
        runId: run.id,
        query: filters.q,
        filter: filters.filter,
        page: filters.page,
        pageSize: candidates.pageSize,
      })
      if (freshCandidates.status === "success") {
        setCandidates(freshCandidates.result)
        setCandidateError(null)
      } else {
        setCandidateError(freshCandidates.message)
      }
      router.refresh()
    } catch {
      setCandidateError("A importação terminou, mas a lista não pôde ser atualizada.")
    }
  }

  const status = STATUS[run.status]
  const progress =
    run.totalCount !== null && run.totalCount > 0
      ? Math.min(100, (run.fetchedCount / run.totalCount) * 100)
      : null
  const message = pauseMessage(run)
  const pageCount = Math.max(1, Math.ceil(candidates.total / candidates.pageSize))
  const previousHref = runHref(run.id, {
    ...filters,
    page: Math.max(1, filters.page - 1),
  })
  const nextHref = runHref(run.id, {
    ...filters,
    page: Math.min(pageCount, filters.page + 1),
  })

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 px-[var(--page-padding-x)] pt-[var(--page-padding-y)]">
        <div className="mx-auto grid w-full max-w-[96rem] gap-4 border-b border-border pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href="/prospecting" />}
                className="-ml-2 text-muted-foreground"
              >
                <RiArrowLeftLine aria-hidden />
                Pesquisas
              </Button>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold">
                  {run.segment.name} em {run.city}/{run.stateCode}
                </h1>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {run.categories.length} {run.categories.length === 1 ? "categoria" : "categorias"}
                {" · "}raio de {run.radiusKm.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {run.canStart ? (
                <Button
                  onClick={() => command("start")}
                  disabled={commandPending}
                >
                  {commandPending && commandName === "start" ? (
                    <Spinner className="size-3" />
                  ) : (
                    <RiPlayLine aria-hidden />
                  )}
                  Iniciar pesquisa
                </Button>
              ) : null}
              {run.canPause ? (
                <Button
                  variant="outline"
                  onClick={() => command("pause")}
                  disabled={commandPending}
                >
                  {commandPending && commandName === "pause" ? <Spinner className="size-3" /> : <RiPauseLine aria-hidden />}
                  Pausar
                </Button>
              ) : null}
              {run.canResume ? (
                <Button onClick={() => command("resume")} disabled={commandPending}>
                  {commandPending && commandName === "resume" ? <Spinner className="size-3" /> : <RiPlayLine aria-hidden />}
                  Retomar
                </Button>
              ) : null}
              {run.canCancel ? (
                <Button
                  variant="destructive"
                  onClick={() => setCancelOpen(true)}
                  disabled={commandPending}
                >
                  <RiCloseCircleLine aria-hidden />
                  Cancelar
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-xs text-muted-foreground">Coleta</div>
              <div className="mt-1 flex items-center gap-2 text-sm font-semibold tabular-nums">
                {run.fetchedCount.toLocaleString("pt-BR")}/
                {run.totalCount === null ? "—" : run.totalCount.toLocaleString("pt-BR")}
                {run.totalCount === null && run.status === "collecting" ? <Spinner className="size-3 text-primary" /> : null}
              </div>
              {progress !== null ? (
                <Progress value={progress} className="mt-2" aria-label={`${progress.toFixed(0)}% coletado`} />
              ) : null}
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-xs text-muted-foreground">Aceitos</div>
              <div className="mt-1 text-sm font-semibold tabular-nums">
                {run.acceptedCount.toLocaleString("pt-BR")}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {run.ambiguousCount.toLocaleString("pt-BR")} ambíguos
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-xs text-muted-foreground">Duplicados</div>
              <div className="mt-1 text-sm font-semibold tabular-nums">
                {run.duplicateCount.toLocaleString("pt-BR")}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {run.rejectedCount.toLocaleString("pt-BR")} rejeitados
              </div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="text-xs text-muted-foreground">Custo</div>
              <div className="mt-1 text-sm font-semibold tabular-nums">
                {money(run.actualCostUsd)} / {money(run.budgetUsd)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {run.hasUnknownCost ? "Custo pendente de confirmação" : "Custo confirmado"}
              </div>
            </div>
          </div>

          {message || pollError ? (
            <div
              className="rounded-lg border border-border bg-accent px-3 py-2 text-xs text-accent-foreground"
              role={pollError ? "alert" : "status"}
              aria-live="polite"
            >
              {pollError || message}
            </div>
          ) : null}
          {run.hasUnknownCost ? (
            <div
              className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning"
              role="status"
            >
              Existe uma chamada com custo ainda não confirmado.
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 px-[var(--page-padding-x)] pb-[var(--page-padding-y)]">
        <div className="mx-auto flex h-full w-full max-w-[96rem] flex-col gap-3 pt-4">
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <InputGroup className="min-w-0 flex-1 sm:max-w-sm">
              <InputGroupAddon>
                <RiSearchLine aria-hidden />
              </InputGroupAddon>
              <InputGroupInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Empresa, site ou telefone"
                aria-label="Buscar candidatos"
                aria-busy={routePending}
              />
              {routePending ? (
                <InputGroupAddon align="inline-end">
                  <Spinner className="size-3 text-primary" aria-label="Buscando" />
                </InputGroupAddon>
              ) : null}
            </InputGroup>
            <Select
              items={FILTER_ITEMS}
              value={filters.filter}
              onValueChange={(next) =>
                replaceFilters({
                  filter: String(next) as ProspectingCandidateFilter,
                  page: 1,
                })
              }
            >
              <SelectTrigger className="w-40" aria-label="Filtrar candidatos">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {FILTER_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ProspectingImportDialog
              runId={run.id}
              candidates={selectedCandidates}
              onResult={handleImportResult}
              onFinished={() => void syncAfterImport()}
            />
            {cnpjBatch && (cnpjBatch.status === "queued" || cnpjBatch.status === "processing") ? (
              <Button variant="outline" onClick={resumeCnpjSearch} disabled={cnpjRunning || cnpjPending || cnpjActiveLoading}>
                {cnpjRunning ? <Spinner className="size-3" /> : <RiBuilding2Line aria-hidden />}
                {cnpjRunning ? `Pesquisando ${cnpjBatch.processedCount}/${cnpjBatch.totalCount}` : "Retomar pesquisa CNPJ"}
              </Button>
            ) : (
              <Button variant="outline" onClick={() => void startCnpjSearch()} disabled={selectedIds.size === 0 || selectedIds.size > 50 || cnpjPending || cnpjRunning || cnpjActiveLoading}>
                {cnpjPending || cnpjRunning ? <Spinner className="size-3" /> : <RiBuilding2Line aria-hidden />}
                {cnpjPending ? "Preparando pesquisa" : cnpjRunning ? "Pesquisando CNPJ" : `Pesquisar CNPJ${selectedIds.size ? ` (${selectedIds.size})` : ""}`}
              </Button>
            )}
            <span className="text-xs text-muted-foreground tabular-nums sm:ml-auto">
              {selectedIds.size > 0
                ? `${selectedIds.size} selecionado${selectedIds.size === 1 ? "" : "s"} · `
                : ""}
              {candidates.total.toLocaleString("pt-BR")} candidatos
            </span>
          </div>

          {cnpjMessage ? (
            <div role="status" className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">{cnpjMessage}</div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {candidateError ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
                {candidateError}
              </div>
            ) : (
              <ProspectingCandidateTable
                runId={run.id}
                city={run.city}
                stateCode={run.stateCode}
                candidates={candidates.items}
                selectedIds={selectedIds}
                onSelectedIdsChange={setSelectedIds}
                onCnpjConfirmed={handleCnpjConfirmed}
              />
            )}
          </div>

          {candidates.total > candidates.pageSize ? (
            <nav aria-label="Paginar candidatos" className="flex shrink-0 items-center justify-between gap-4">
              {filters.page > 1 ? (
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={previousHref} />}
                >
                  <RiArrowLeftSLine aria-hidden />
                  Anterior
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  <RiArrowLeftSLine aria-hidden />
                  Anterior
                </Button>
              )}
              <span className="text-xs text-muted-foreground tabular-nums">
                Página {Math.min(filters.page, pageCount)} de {pageCount}
              </span>
              {filters.page < pageCount ? (
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<Link href={nextHref} />}
                >
                  Próxima
                  <RiArrowRightSLine aria-hidden />
                </Button>
              ) : (
                <Button variant="outline" disabled>
                  Próxima
                  <RiArrowRightSLine aria-hidden />
                </Button>
              )}
            </nav>
          ) : null}
        </div>
      </div>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <RiCloseCircleLine className="text-destructive" aria-hidden />
            </AlertDialogMedia>
            <AlertDialogTitle>Cancelar pesquisa?</AlertDialogTitle>
            <AlertDialogDescription>
              A coleta será encerrada e não poderá ser retomada. Os
              candidatos já encontrados continuarão disponíveis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setCancelOpen(false)
                command("cancel")
              }}
            >
              Cancelar pesquisa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
