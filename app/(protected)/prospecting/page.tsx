import { listLeadSegments } from "@/app/actions/leads"
import { listProspectingRuns } from "@/app/actions/prospecting"
import {
  ProspectingRunsPage,
  type ProspectingRunFilters,
} from "@/components/custom/Prospecting"
import { requireCommercialMember } from "@/lib/auth/session"
import { firstSearchParam } from "@/lib/leads/queues"
import { isProspectingRunStatus } from "@/lib/prospecting/reads"

export default async function ProspectingPage({
  searchParams,
}: PageProps<"/prospecting">) {
  await requireCommercialMember()
  const params = await searchParams
  const q = (firstSearchParam(params.q) ?? "")
    .replace(/[%*,()\\]/g, "")
    .trim()
    .slice(0, 100)
  const rawStatus = firstSearchParam(params.status)
  const status = isProspectingRunStatus(rawStatus) ? rawStatus : "all"
  const rawPage = Number(firstSearchParam(params.page))
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1
  const filters: ProspectingRunFilters = { q, status, page }
  const [result, segments] = await Promise.all([
    listProspectingRuns({ q, status, page, pageSize: 20 }),
    listLeadSegments(),
  ])

  return (
    <ProspectingRunsPage
      result={result}
      filters={filters}
      segments={segments}
    />
  )
}
