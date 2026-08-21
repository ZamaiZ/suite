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
        <p className="font-sans text-caption text-fg-muted">
          Nenhuma keyword nesta coleta.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="px-1 py-2 font-sans text-caption font-medium text-fg-muted">
                  Keyword
                </th>
                <th className="px-1 py-2 font-sans text-caption font-medium text-fg-muted">
                  Intenção
                </th>
                <th className="px-1 py-2 font-sans text-caption font-medium text-fg-muted">
                  Pos.
                </th>
                <th className="px-1 py-2 font-sans text-caption font-medium text-fg-muted">
                  Tráfego
                </th>
                <th className="px-1 py-2 font-sans text-caption font-medium text-fg-muted">
                  Volume
                </th>
                <th className="px-1 py-2 font-sans text-caption font-medium text-fg-muted">
                  KD
                </th>
                <th className="px-1 py-2 font-sans text-caption font-medium text-fg-muted">
                  URL
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.keyword}
                  className="border-b border-border-subtle/70 last:border-b-0"
                >
                  <td className="max-w-[12rem] truncate px-1 py-2 font-sans text-caption text-fg">
                    {row.keyword}
                  </td>
                  <td className="px-1 py-2 font-sans text-caption text-fg-secondary">
                    {visibilityKeywordIntentLabel(row.intent)}
                  </td>
                  <td className="px-1 py-2 font-sans text-caption text-fg">
                    {formatVisibilityMetric(row.position)}
                  </td>
                  <td className="px-1 py-2 font-sans text-caption text-fg">
                    {formatVisibilityMetric(row.traffic, 1)}
                  </td>
                  <td className="px-1 py-2 font-sans text-caption text-fg">
                    {formatVisibilityMetric(row.volume)}
                  </td>
                  <td className="px-1 py-2 font-sans text-caption text-fg">
                    {row.difficulty === null
                      ? "—"
                      : `${row.difficulty.toLocaleString("pt-BR")}%`}
                  </td>
                  <td className="max-w-[10rem] truncate px-1 py-2 font-sans text-caption text-fg-muted">
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
