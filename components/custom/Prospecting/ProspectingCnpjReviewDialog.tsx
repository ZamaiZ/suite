"use client"

import { useEffect, useState } from "react"
import {
  confirmProspectingCandidateCnpjAction,
  listProspectingCnpjMatchesAction,
} from "@/app/actions/prospecting"
import type { CnpjResearchMatch } from "@/lib/prospecting/cnpj-files"
import type { ProspectingCandidateListItem } from "@/lib/prospecting/reads"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"

function statusLabel(status: ProspectingCandidateListItem["cnpjStatus"]) {
  const labels: Record<ProspectingCandidateListItem["cnpjStatus"], string> = {
    not_searched: "Não pesquisado",
    suggestion: "Sugestão",
    needs_review: "Revisar",
    confirmed: "Confirmado",
    not_found: "Não encontrado",
  }
  return labels[status]
}

export function ProspectingCnpjReviewDialog({
  runId,
  candidate,
  city,
  stateCode,
  open,
  onOpenChange,
  onConfirmed,
}: {
  runId: string
  candidate: ProspectingCandidateListItem
  city: string
  stateCode: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirmed: (candidateId: string, cnpj: string) => void
}) {
  const [matches, setMatches] = useState<CnpjResearchMatch[]>([])
  const [loading, setLoading] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setMessage("")
    void listProspectingCnpjMatchesAction({
      runId,
      candidateId: candidate.id,
    }).then((result) => {
      if (cancelled) return
      setLoading(false)
      if (result.status === "error") setMessage(result.message)
      else setMatches(result.matches)
    }).catch(() => {
      if (cancelled) return
      setLoading(false)
      setMessage("Não foi possível carregar os resultados CNPJ.")
    })
    return () => {
      cancelled = true
    }
  }, [candidate.id, open, runId])

  async function confirm(match: CnpjResearchMatch) {
    setPendingId(match.id)
    setMessage("")
    let result: Awaited<ReturnType<typeof confirmProspectingCandidateCnpjAction>>
    try {
      result = await confirmProspectingCandidateCnpjAction({
        runId,
        candidateId: candidate.id,
        matchId: match.id,
      })
    } catch {
      setPendingId(null)
      setMessage("Não foi possível confirmar este resultado.")
      return
    }
    setPendingId(null)
    if (result.status === "success") {
      onConfirmed(candidate.id, match.cnpj)
      onOpenChange(false)
    } else {
      setMessage(result.message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(42rem,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Revisar CNPJ — {candidate.companyName ?? "Empresa"}</DialogTitle>
          <DialogDescription>
            Compare nome e município antes de confirmar. A confirmação grava o CNPJ no lead importado quando existir.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3 text-xs sm:grid-cols-2">
          <p><span className="text-muted-foreground">Empresa pesquisada:</span> {candidate.companyName ?? "—"}</p>
          <p><span className="text-muted-foreground">Categoria:</span> {candidate.primaryCategory ?? "—"}</p>
          <p><span className="text-muted-foreground">Endereço:</span> {candidate.address ?? "—"}</p>
          <p><span className="text-muted-foreground">Cidade/UF:</span> {city}/{stateCode}</p>
          <p><span className="text-muted-foreground">Telefone:</span> {candidate.phone ?? "—"}</p>
          <p className="sm:col-span-2"><span className="text-muted-foreground">Site:</span> {candidate.websiteDomain ?? candidate.website ?? "—"}</p>
          <p className="sm:col-span-2"><span className="text-muted-foreground">Estado:</span> {statusLabel(candidate.cnpjStatus)}</p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-5 text-muted-foreground"><Spinner className="size-4" />Carregando resultados…</div>
        ) : matches.length === 0 ? (
          <p className="rounded-lg border border-border px-3 py-4 text-muted-foreground">
            {candidate.cnpjStatus === "needs_review"
              ? "A pesquisa ficou ambígua e não gerou uma sugestão de CNPJ. Confira os dados do estabelecimento antes de pesquisar novamente."
              : "Nenhuma correspondência válida foi encontrada para revisão."}
          </p>
        ) : (
          <ul className="grid gap-2">
            {matches.map((match) => (
              <li key={match.id} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 font-medium">
                    <span>{match.legalName ?? "Razão social não informada"}</span>
                    {match.registrationStatus ? <Badge variant="muted">{match.registrationStatus}</Badge> : null}
                  </div>
                  <p className="text-muted-foreground">Nome fantasia: {match.tradeName ?? "—"}</p>
                  <p className="font-mono text-foreground">{match.cnpj}</p>
                  <p className="text-muted-foreground">{[match.city, match.stateCode].filter(Boolean).join(" / ") || "Localização não informada"}{match.primaryCnae ? ` · CNAE ${match.primaryCnae}` : ""}</p>
                  <a className="text-primary underline underline-offset-2" href={match.sourceUrl} target="_blank" rel="noreferrer noopener">{match.source === "ai_research" ? "Fonte da pesquisa" : match.source === "receita_local_index" ? `Dados abertos da Receita${match.datasetVersion ? ` · ${match.datasetVersion}` : ""}` : "Fonte OpenCNPJ (histórico)"}{match.sourceCheckedAt ? ` · consulta ${new Date(match.sourceCheckedAt).toLocaleDateString("pt-BR")}` : ""}</a>
                </div>
                <Button onClick={() => void confirm(match)} disabled={pendingId !== null}>
                  {pendingId === match.id ? <Spinner className="size-3" /> : null}
                  Confirmar este CNPJ
                </Button>
              </li>
            ))}
          </ul>
        )}
        {message ? <p role="alert" className="text-destructive">{message}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
