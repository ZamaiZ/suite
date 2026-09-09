import {
  RiBarChart2Line,
  RiMoneyDollarCircleLine,
  RiSearchLine,
  RiTrafficLightLine,
} from "react-icons/ri"
import { LeadIconWell } from "@/components/custom/LeadDetailDialog/LeadIconWell"
import { formatVisibilityMetric } from "@/lib/leads/visibility-presenters"
import { Card } from "@/components/ui/card"
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
    <Card size="sm" className="min-h-16 flex-row items-center gap-2 px-3 py-2">
      <LeadIconWell icon={icon} />
      <div className="min-w-0">
        <p className="text-xs/relaxed text-muted-foreground">{label}</p>
        <p className="text-xs/relaxed font-semibold text-foreground">{value}</p>
      </div>
    </Card>
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
        value={formatVisibilityMetric(snapshot.metrics.estimatedTrafficCost, 1)}
      />
      <MetricCard icon={RiBarChart2Line} label="Posições" value={bucketLabel} />
    </div>
  )
}
