"use client"

import { useState } from "react"
import {
  RiExternalLinkLine,
  RiPhoneLine,
  RiStarFill,
} from "react-icons/ri"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ProspectingCandidateListItem } from "@/lib/prospecting/reads"
import { ProspectingCnpjReviewDialog } from "./ProspectingCnpjReviewDialog"
import { Button } from "@/components/ui/button"
import { formatCnpj } from "@/lib/prospecting/cnpj"

function cnpjLabel(candidate: ProspectingCandidateListItem) {
  if (candidate.cnpjStatus === "confirmed" && candidate.cnpj) return formatCnpj(candidate.cnpj)
  const labels = {
    not_searched: "Não pesquisado",
    searching: "Pesquisando",
    suggestion: "Sugestão disponível",
    needs_review: "Revisar resultado",
    confirmed: "Confirmado",
    not_found: "Não encontrado",
    source_limited: "Limite atingido",
    source_unavailable: "Fonte indisponível",
  }
  return labels[candidate.cnpjStatus]
}

export function isProspectingCandidateSelectable(
  candidate: ProspectingCandidateListItem,
) {
  return (
    candidate.importedLeadId === null &&
    candidate.reviewState !== "imported" &&
    candidate.reviewState !== "ignored"
  )
}

function date(value: string | null) {
  if (!value) return "—"
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? "—"
    : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(parsed)
}

function territoryBadge(candidate: ProspectingCandidateListItem) {
  if (candidate.territoryClass === "inside") {
    return <Badge variant="success">Dentro</Badge>
  }
  if (candidate.territoryClass === "outside") {
    return <Badge variant="destructive">Fora</Badge>
  }
  return <Badge variant="warning">Ambíguo</Badge>
}

function categoryBadge(candidate: ProspectingCandidateListItem) {
  if (candidate.categoryClass === "exact") {
    return <Badge variant="primary">Categoria exata</Badge>
  }
  if (candidate.categoryClass === "related") {
    return <Badge variant="muted">Relacionada</Badge>
  }
  return <Badge variant="destructive">Categoria divergente</Badge>
}

function outcomeBadge(candidate: ProspectingCandidateListItem) {
  if (candidate.importedLeadId) {
    return <Badge variant="success">Importado</Badge>
  }
  if (candidate.conflictKind) {
    return (
      <Badge
        variant={
          candidate.conflictSeverity === "block" ? "destructive" : "warning"
        }
      >
        {candidate.conflictSeverity === "block"
          ? "Duplicado"
          : "Possível conflito"}
      </Badge>
    )
  }
  if (candidate.reviewState === "ignored") {
    return <Badge variant="muted">Ignorado</Badge>
  }
  if (candidate.reviewState === "closed") {
    return <Badge variant="destructive">Possivelmente encerrado</Badge>
  }
  if (candidate.reviewState === "missing_contact") {
    return <Badge variant="warning">Sem contato</Badge>
  }
  if (candidate.reviewState === "missing_name") {
    return <Badge variant="warning">Sem nome</Badge>
  }
  if (candidate.reviewState === "ambiguous_location") {
    return <Badge variant="warning">Revisar localização</Badge>
  }
  return <Badge variant="muted">Disponível</Badge>
}

export function ProspectingCandidateTable({
  candidates,
  selectedIds,
  onSelectedIdsChange,
  runId,
  city,
  stateCode,
  onCnpjConfirmed,
}: {
  candidates: ProspectingCandidateListItem[]
  selectedIds: Set<string>
  onSelectedIdsChange: (ids: Set<string>) => void
  runId: string
  city: string
  stateCode: string
  onCnpjConfirmed: (candidateId: string, cnpj: string) => void
}) {
  const [reviewing, setReviewing] = useState<ProspectingCandidateListItem | null>(null)
  if (candidates.length === 0) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-lg border border-border bg-card px-6 text-center text-sm text-muted-foreground">
        Nenhum candidato encontrado para estes filtros.
      </div>
    )
  }

  const selectableIds = candidates
    .filter(isProspectingCandidateSelectable)
    .map((candidate) => candidate.id)
  const selectedVisibleCount = selectableIds.filter((id) =>
    selectedIds.has(id),
  ).length
  const allSelected =
    selectableIds.length > 0 && selectedVisibleCount === selectableIds.length
  const partiallySelected = selectedVisibleCount > 0 && !allSelected

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                indeterminate={partiallySelected}
                disabled={selectableIds.length === 0}
                onCheckedChange={(checked) => {
                  const next = new Set(selectedIds)
                  for (const id of selectableIds) {
                    if (checked) next.add(id)
                    else next.delete(id)
                  }
                  onSelectedIdsChange(next)
                }}
                aria-label="Selecionar candidatos visíveis"
              />
            </TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Endereço/cidade</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Site</TableHead>
            <TableHead>Nota/avaliações</TableHead>
            <TableHead>Atualização</TableHead>
            <TableHead>CNPJ</TableHead>
            <TableHead>Território</TableHead>
            <TableHead>Conflito/importação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((candidate) => {
            const selectable = isProspectingCandidateSelectable(candidate)
            const companyName = candidate.companyName ?? "—"
            return (
              <TableRow
                key={candidate.id}
                data-state={selectedIds.has(candidate.id) ? "selected" : undefined}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(candidate.id)}
                    disabled={!selectable}
                    onCheckedChange={(checked) => {
                      const next = new Set(selectedIds)
                      if (checked) next.add(candidate.id)
                      else next.delete(candidate.id)
                      onSelectedIdsChange(next)
                    }}
                    aria-label={`Selecionar ${companyName}`}
                  />
                </TableCell>
                <TableCell className="max-w-56 font-medium whitespace-normal">
                  <div className="flex items-start gap-1.5">
                    <span>{companyName}</span>
                    {candidate.checkUrl ? (
                      <a
                        href={candidate.checkUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-0.5 shrink-0 rounded-sm text-muted-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/30"
                        aria-label={`Abrir ${companyName} no Google Maps`}
                      >
                        <RiExternalLinkLine aria-hidden />
                      </a>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="max-w-48 whitespace-normal">
                  {candidate.primaryCategory ?? "—"}
                </TableCell>
                <TableCell className="max-w-72 whitespace-normal text-muted-foreground">
                  {candidate.address ?? "—"}
                </TableCell>
                <TableCell>
                  {candidate.phone ? (
                    <a
                      href={`tel:${candidate.phone}`}
                      className="inline-flex items-center gap-1 rounded-sm outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/30"
                    >
                      <RiPhoneLine aria-hidden />
                      {candidate.phone}
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="max-w-56 truncate">
                  {candidate.website ? (
                    <a
                      href={candidate.website}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="rounded-sm outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/30"
                    >
                      {candidate.websiteDomain ?? candidate.website}
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {candidate.rating === null ? (
                    "—"
                  ) : (
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <RiStarFill className="text-warning" aria-hidden />
                      {candidate.rating.toLocaleString("pt-BR", {
                        maximumFractionDigits: 1,
                      })}
                      <span className="text-muted-foreground">
                        ({candidate.reviewsCount?.toLocaleString("pt-BR") ?? "—"})
                      </span>
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {date(candidate.vendorUpdatedAt)}
                </TableCell>
                <TableCell className="min-w-40">
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-mono text-[11px]">{cnpjLabel(candidate)}</span>
                    {candidate.cnpjStatus === "suggestion" || candidate.cnpjStatus === "needs_review" || candidate.cnpjStatus === "confirmed" ? (
                      <Button size="xs" variant="outline" onClick={() => setReviewing(candidate)}>
                        {candidate.cnpjStatus === "confirmed" ? "Ver confirmação" : "Revisar correspondência"}
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    {territoryBadge(candidate)}
                    {categoryBadge(candidate)}
                  </div>
                </TableCell>
                <TableCell>{outcomeBadge(candidate)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {reviewing ? (
        <ProspectingCnpjReviewDialog
          runId={runId}
          candidate={reviewing}
          city={city}
          stateCode={stateCode}
          open
          onOpenChange={(open) => { if (!open) setReviewing(null) }}
          onConfirmed={onCnpjConfirmed}
        />
      ) : null}
    </div>
  )
}
