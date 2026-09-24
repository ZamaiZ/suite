import Link from "next/link"
import { RiArrowRightSLine } from "react-icons/ri"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ProspectingRunSummary } from "@/lib/prospecting/reads"
import type { ProspectingRunStatus } from "@/lib/prospecting/types"

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

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value)
}

function dateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date)
}

export function ProspectingRunTable({
  runs,
}: {
  runs: ProspectingRunSummary[]
}) {
  if (runs.length === 0) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-lg border border-border bg-card px-6 text-center text-sm text-muted-foreground">
        Nenhuma pesquisa ainda. Crie uma pesquisa por segmento e cidade.
      </div>
    )
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Segmento</TableHead>
            <TableHead>Cidade/UF</TableHead>
            <TableHead className="min-w-44">Progresso</TableHead>
            <TableHead>Custo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="w-8">
              <span className="sr-only">Abrir</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => {
            const status = STATUS[run.status]
            const progress =
              run.totalCount !== null && run.totalCount > 0
                ? Math.min(100, (run.fetchedCount / run.totalCount) * 100)
                : null
            return (
              <TableRow key={run.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/prospecting/${run.id}`}
                    className="rounded-sm outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/30"
                  >
                    {run.segment.name}
                  </Link>
                </TableCell>
                <TableCell>
                  {run.city}/{run.stateCode}
                </TableCell>
                <TableCell>
                  <div className="grid min-w-36 gap-1.5">
                    <span className="text-muted-foreground tabular-nums">
                      {run.fetchedCount.toLocaleString("pt-BR")}/
                      {run.totalCount === null
                        ? "—"
                        : run.totalCount.toLocaleString("pt-BR")}
                    </span>
                    {progress !== null ? (
                      <Progress
                        value={progress}
                        aria-label={`${progress.toFixed(0)}% coletado`}
                      />
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="tabular-nums">
                  {money(run.actualCostUsd)} / {money(run.budgetUsd)}
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {dateTime(run.createdAt)}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/prospecting/${run.id}`}
                    className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
                    aria-label={`Abrir pesquisa de ${run.segment.name} em ${run.city}`}
                  >
                    <RiArrowRightSLine aria-hidden />
                  </Link>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
