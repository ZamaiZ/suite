import {
  RiBarChart2Line,
  RiMoneyDollarCircleLine,
  RiSearchLine,
  RiTrafficLightLine,
} from "react-icons/ri"
import { LeadIconWell } from "@/components/custom/LeadDetailDialog/LeadIconWell"
import { formatVisibilityMetric } from "@/lib/leads/visibility-presenters"
import type { VisibilitySnapshot } from "@/lib/leads/visibility-audit"

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: typeof RiSearchLine
  label: string
  value: string
}) {
  return (
    <div className="flex min-h-16 items-center gap-2 rounded-xl border border-border-subtle bg-surface px-3 py-2">
      <LeadIconWell icon={icon} />
      <div className="min-w-0">
        <p className="font-sans text-caption text-fg-muted">{label}</p>
        <p className="font-sans text-caption font-semibold text-fg">{value}</p>
      </div>
    </div>
  )
}

export function LeadVisibilitySummaryCards({
  snapshot,
}: {
  snapshot: VisibilitySnapshot
}) {
  const buckets = snapshot.metrics.positionBuckets
  const bucketLabel = buckets
    ? `Top3 ${buckets.top3} · 4–10 ${buckets.pos4to10}`
    : "—"

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard
        icon={RiSearchLine}
        label="Keywords"
        value={formatVisibilityMetric(snapshot.metrics.keywordCount)}
      />
      <MetricCard
        icon={RiTrafficLightLine}
        label="Tráfego est."
        value={formatVisibilityMetric(snapshot.metrics.estimatedTraffic, 1)}
      />
      <MetricCard
        icon={RiMoneyDollarCircleLine}
        label="Custo tráfego"
        value={formatVisibilityMetric(
          snapshot.metrics.estimatedTrafficCost,
          1,
        )}
      />
      <MetricCard
        icon={RiBarChart2Line}
        label="Posições"
        value={bucketLabel}
      />
    </div>
  )
}
