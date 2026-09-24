"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  RiAlertLine,
  RiArrowRightLine,
  RiCheckLine,
  RiDownloadLine,
  RiErrorWarningLine,
  RiRefreshLine,
} from "react-icons/ri"
import {
  importProspectingCandidateAction,
  type ImportCandidateOutcome,
  type ImportCandidateResult,
} from "@/app/actions/prospecting"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import type { ProspectingCandidateListItem } from "@/lib/prospecting/reads"

type ImportPhase =
  | "waiting"
  | "revalidating"
  | "imported"
  | "conflict"
  | "stale"
  | "blocked"
  | "failed"

type ImportRow = {
  candidate: ProspectingCandidateListItem
  phase: ImportPhase
  blockReason: string | null
  warning: string | null
  result: ImportCandidateResult | null
}

function blockReason(candidate: ProspectingCandidateListItem) {
  if (candidate.importedLeadId || candidate.reviewState === "imported") {
    return "Este candidato já foi importado."
  }
  if (candidate.conflictSeverity === "block" || candidate.reviewState === "duplicate") {
    return "Já existe um lead para esta empresa."
  }
  if (candidate.territoryClass === "outside") {
    return "A empresa está fora do município."
  }
  if (
    candidate.territoryClass === "ambiguous" ||
    candidate.reviewState === "ambiguous_location"
  ) {
    return "A localização precisa ser revisada."
  }
  if (candidate.categoryClass === "mismatch") {
    return "A categoria não corresponde à pesquisa."
  }
  if (candidate.reviewState === "closed") {
    return "A empresa aparece como encerrada."
  }
  if (candidate.reviewState === "ignored") {
    return "Este candidato foi ignorado."
  }
  return null
}

function warning(candidate: ProspectingCandidateListItem) {
  if (candidate.conflictSeverity === "warning") {
    return "Possível conflito; a duplicidade será conferida novamente."
  }
  if (candidate.reviewState === "missing_contact") {
    return "Sem contato na descoberta; o perfil será revalidado."
  }
  if (candidate.reviewState === "missing_name") {
    return "Sem nome na descoberta; o perfil será revalidado."
  }
  return null
}

function initialRows(candidates: ProspectingCandidateListItem[]): ImportRow[] {
  return candidates.map((candidate) => {
    const reason = blockReason(candidate)
    return {
      candidate,
      phase: reason ? "blocked" : "waiting",
      blockReason: reason,
      warning: reason ? null : warning(candidate),
      result: null,
    }
  })
}

function phaseForOutcome(outcome: ImportCandidateOutcome): ImportPhase {
  if (outcome === "imported") return "imported"
  if (outcome === "conflict") return "conflict"
  if (outcome === "stale") return "stale"
  if (outcome === "error") return "failed"
  return "blocked"
}

function phaseBadge(row: ImportRow) {
  if (row.phase === "waiting") return <Badge variant="muted">Aguardando</Badge>
  if (row.phase === "revalidating") {
    return (
      <Badge variant="primary">
        <Spinner className="size-2.5" />
        Revalidando
      </Badge>
    )
  }
  if (row.phase === "imported") return <Badge variant="success">Importado</Badge>
  if (row.phase === "conflict") return <Badge variant="warning">Conflito</Badge>
  if (row.phase === "stale") return <Badge variant="warning">Desatualizado</Badge>
  if (row.phase === "failed") return <Badge variant="destructive">Falha</Badge>
  return <Badge variant="destructive">Bloqueado</Badge>
}

export function ProspectingImportDialog({
  runId,
  candidates,
  onResult,
  onFinished,
}: {
  runId: string
  candidates: ProspectingCandidateListItem[]
  onResult: (result: ImportCandidateResult) => void
  onFinished: () => void
}) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [inFlightId, setInFlightId] = useState<string | null>(null)
  const [batchRunning, setBatchRunning] = useState(false)
  const [started, setStarted] = useState(false)
  const [announcement, setAnnouncement] = useState("")

  const eligibleCount = useMemo(
    () => rows.filter((row) => row.blockReason === null).length,
    [rows],
  )
  const blockedCount = rows.length - eligibleCount
  const warningCount = rows.filter((row) => row.warning !== null).length
  const failedCount = rows.filter((row) => row.phase === "failed").length
  const busy = batchRunning || inFlightId !== null

  function updateRow(candidateId: string, patch: Partial<ImportRow>) {
    setRows((current) =>
      current.map((row) =>
        row.candidate.id === candidateId ? { ...row, ...patch } : row,
      ),
    )
  }

  async function importOne(row: ImportRow) {
    setInFlightId(row.candidate.id)
    updateRow(row.candidate.id, { phase: "revalidating" })
    setAnnouncement(`Revalidando ${row.candidate.companyName ?? "candidato"}.`)
    let result: ImportCandidateResult
    try {
      const state = await importProspectingCandidateAction({
        runId,
        candidateId: row.candidate.id,
      })
      result =
        state.status === "success"
          ? state.result
          : {
              candidateId: row.candidate.id,
              outcome: "error",
              message: state.message,
            }
    } catch {
      result = {
        candidateId: row.candidate.id,
        outcome: "error",
        message: "A conexão foi interrompida durante a importação.",
      }
    }
    updateRow(row.candidate.id, {
      phase: phaseForOutcome(result.outcome),
      result,
    })
    onResult(result)
    setAnnouncement(
      result.outcome === "imported"
        ? `${row.candidate.companyName ?? "Candidato"} importado.`
        : `${row.candidate.companyName ?? "Candidato"}: ${result.message ?? "importação não concluída"}.`,
    )
    setInFlightId(null)
    return result
  }

  async function startBatch() {
    if (busy || eligibleCount === 0) return
    setStarted(true)
    setBatchRunning(true)
    const eligible = rows.filter((row) => row.blockReason === null)
    for (const row of eligible) {
      await importOne(row)
    }
    setBatchRunning(false)
    setAnnouncement("Lote de importação concluído.")
    onFinished()
  }

  async function retry(row: ImportRow) {
    if (busy || row.phase !== "failed") return
    await importOne(row)
    onFinished()
  }

  function openDialog() {
    setRows(initialRows(candidates))
    setStarted(false)
    setAnnouncement("")
    setOpen(true)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          openDialog()
          return
        }
        if (!busy) setOpen(false)
      }}
    >
      <DialogTrigger
        render={<Button />}
        disabled={candidates.length === 0}
      >
        <RiDownloadLine aria-hidden />
        Importar {candidates.length > 0 ? candidates.length : ""}
      </DialogTrigger>
      <DialogContent
        className="grid-rows-[auto_minmax(0,1fr)_auto] max-w-2xl overflow-hidden"
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>Importar candidatos como leads</DialogTitle>
          <DialogDescription>
            Cada empresa será revalidada individualmente antes da criação do
            lead. Nenhuma auditoria completa será iniciada.
          </DialogDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="success">{eligibleCount} elegíveis</Badge>
            {warningCount > 0 ? (
              <Badge variant="warning">{warningCount} com aviso</Badge>
            ) : null}
            {blockedCount > 0 ? (
              <Badge variant="destructive">{blockedCount} bloqueados</Badge>
            ) : null}
          </div>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto rounded-lg border border-border">
          <ul className="divide-y divide-border">
            {rows.map((row) => {
              const resultMessage = row.result?.message
              const detail = row.blockReason ?? resultMessage ?? row.warning
              return (
                <li
                  key={row.candidate.id}
                  className="flex items-start gap-3 p-3"
                >
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
                    {row.phase === "imported" ? (
                      <RiCheckLine aria-hidden />
                    ) : row.phase === "failed" || row.phase === "blocked" ? (
                      <RiAlertLine aria-hidden />
                    ) : (
                      <RiErrorWarningLine aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium">
                        {row.candidate.companyName ?? "Empresa sem nome"}
                      </span>
                      {phaseBadge(row)}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {row.candidate.websiteDomain ??
                        row.candidate.phone ??
                        row.candidate.address ??
                        "Sem contato"}
                    </p>
                    {detail ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {detail}
                      </p>
                    ) : null}
                  </div>
                  {row.phase === "imported" && row.result?.leadId ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/leads?lead=${row.result.leadId}`} />}
                    >
                      Abrir lead
                      <RiArrowRightLine aria-hidden />
                    </Button>
                  ) : null}
                  {row.phase === "conflict" && row.result?.relatedLeadId ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/leads?lead=${row.result.relatedLeadId}`} />}
                    >
                      Ver lead
                      <RiArrowRightLine aria-hidden />
                    </Button>
                  ) : null}
                  {row.phase === "failed" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void retry(row)}
                      disabled={busy}
                    >
                      {inFlightId === row.candidate.id ? (
                        <Spinner className="size-3" />
                      ) : (
                        <RiRefreshLine aria-hidden />
                      )}
                      Tentar novamente
                    </Button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>

        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            {started ? "Fechar" : "Cancelar"}
          </Button>
          {!started ? (
            <Button
              type="button"
              onClick={() => void startBatch()}
              disabled={busy || eligibleCount === 0}
            >
              {batchRunning ? <Spinner className="size-3" /> : null}
              Importar {eligibleCount}{" "}
              {eligibleCount === 1 ? "lead" : "leads"}
            </Button>
          ) : failedCount > 0 ? (
            <span className="self-center text-xs text-muted-foreground">
              {failedCount} {failedCount === 1 ? "falha recuperável" : "falhas recuperáveis"}
            </span>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
