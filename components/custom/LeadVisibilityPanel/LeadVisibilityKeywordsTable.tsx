import { LeadGbpCard } from "@/components/custom/LeadGbpPanel/LeadGbpCard"
import {
  formatVisibilityMetric,
  sortVisibilityKeywords,
  visibilityKeywordIntentLabel,
} from "@/lib/leads/visibility-presenters"
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-border/70">
                <th className="px-1 py-2 text-xs/relaxed font-medium text-muted-foreground">
                  Keyword
                </th>
                <th className="px-1 py-2 text-xs/relaxed font-medium text-muted-foreground">
                  Intenção
                </th>
                <th className="px-1 py-2 text-xs/relaxed font-medium text-muted-foreground">
                  Pos.
                </th>
                <th className="px-1 py-2 text-xs/relaxed font-medium text-muted-foreground">
                  Tráfego
                </th>
                <th className="px-1 py-2 text-xs/relaxed font-medium text-muted-foreground">
                  Volume
                </th>
                <th className="px-1 py-2 text-xs/relaxed font-medium text-muted-foreground">
                  KD
                </th>
                <th className="px-1 py-2 text-xs/relaxed font-medium text-muted-foreground">
                  URL
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.keyword}
                  className="border-b border-border/50 last:border-b-0"
                >
                  <td className="max-w-[12rem] truncate px-1 py-2 text-xs/relaxed text-foreground">
                    {row.keyword}
                  </td>
                  <td className="px-1 py-2 text-xs/relaxed text-muted-foreground">
                    {visibilityKeywordIntentLabel(row.intent)}
                  </td>
                  <td className="px-1 py-2 text-xs/relaxed text-foreground">
                    {formatVisibilityMetric(row.position)}
                  </td>
                  <td className="px-1 py-2 text-xs/relaxed text-foreground">
                    {formatVisibilityMetric(row.traffic, 1)}
                  </td>
                  <td className="px-1 py-2 text-xs/relaxed text-foreground">
                    {formatVisibilityMetric(row.volume)}
                  </td>
                  <td className="px-1 py-2 text-xs/relaxed text-foreground">
                    {row.difficulty === null
                      ? "—"
                      : `${row.difficulty.toLocaleString("pt-BR")}%`}
                  </td>
                  <td className="max-w-[10rem] truncate px-1 py-2 text-xs/relaxed text-muted-foreground">
                    {row.url ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </LeadGbpCard>
  )
}
