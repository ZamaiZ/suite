import { LeadGbpCard } from "@/components/custom/LeadGbpPanel/LeadGbpCard"
import {
  formatVisibilityMetric,
  sortVisibilityKeywords,
  visibilityKeywordIntentLabel,
} from "@/lib/leads/visibility-presenters"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { VisibilityKeywordRow } from "@/lib/leads/visibility-audit"

export function LeadVisibilityKeywordsTable({
  keywords,
}: {
  keywords: ReadonlyArray<VisibilityKeywordRow>
}) {
  const rows = sortVisibilityKeywords(keywords)

  return (
    <LeadGbpCard title="Keywords orgânicas">
      {rows.length === 0 ? (
        <p className="text-xs/relaxed text-muted-foreground">
          Nenhuma keyword nesta coleta.
        </p>
      ) : (
        <Table className="w-full min-w-[36rem] border-collapse text-left">
          <TableHeader>
            <TableRow className="border-b border-border/70">
              <TableHead className="px-1 py-2 text-xs/relaxed font-medium text-muted-foreground">
                Keyword
              </TableHead>
              <TableHead className="px-1 py-2 text-xs/relaxed font-medium text-muted-foreground">
                Intenção
              </TableHead>
              <TableHead className="px-1 py-2 text-xs/relaxed font-medium text-muted-foreground">
                Pos.
              </TableHead>
              <TableHead className="px-1 py-2 text-xs/relaxed font-medium text-muted-foreground">
                Tráfego
              </TableHead>
              <TableHead className="px-1 py-2 text-xs/relaxed font-medium text-muted-foreground">
                Volume
              </TableHead>
              <TableHead className="px-1 py-2 text-xs/relaxed font-medium text-muted-foreground">
                KD
              </TableHead>
              <TableHead className="px-1 py-2 text-xs/relaxed font-medium text-muted-foreground">
                URL
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.keyword}
                className="border-b border-border/50 last:border-b-0"
              >
                <TableCell className="max-w-[12rem] truncate px-1 py-2 text-xs/relaxed text-foreground">
                  {row.keyword}
                </TableCell>
                <TableCell className="px-1 py-2 text-xs/relaxed text-muted-foreground">
                  {visibilityKeywordIntentLabel(row.intent)}
                </TableCell>
                <TableCell className="px-1 py-2 text-xs/relaxed text-foreground">
                  {formatVisibilityMetric(row.position)}
                </TableCell>
                <TableCell className="px-1 py-2 text-xs/relaxed text-foreground">
                  {formatVisibilityMetric(row.traffic, 1)}
                </TableCell>
                <TableCell className="px-1 py-2 text-xs/relaxed text-foreground">
                  {formatVisibilityMetric(row.volume)}
                </TableCell>
                <TableCell className="px-1 py-2 text-xs/relaxed text-foreground">
                  {row.difficulty === null
                    ? "—"
                    : `${row.difficulty.toLocaleString("pt-BR")}%`}
                </TableCell>
                <TableCell className="max-w-[10rem] truncate px-1 py-2 text-xs/relaxed text-muted-foreground">
                  {row.url ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </LeadGbpCard>
  )
}
