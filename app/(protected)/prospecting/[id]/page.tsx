import { notFound } from "next/navigation"
import {
  getProspectingRun,
  listProspectingCandidatesAction,
} from "@/app/actions/prospecting"
import {
  ProspectingRunPage,
  type ProspectingCandidateFilters,
} from "@/components/custom/Prospecting"
import { requireCommercialMember } from "@/lib/auth/session"
import { firstSearchParam } from "@/lib/leads/queues"
import type { ProspectingCandidateFilter } from "@/lib/prospecting/reads"

const FILTERS = new Set<ProspectingCandidateFilter>([
  "available",
  "ambiguous",
  "duplicate",
  "imported",
  "ignored",
])

export default async function ProspectingDetailPage({
  params,
  searchParams,
}: PageProps<"/prospecting/[id]">) {
  await requireCommercialMember()
  const { id } = await params
  const run = await getProspectingRun(id)
  if (!run) notFound()

  const query = await searchParams
  const q = (firstSearchParam(query.q) ?? "")
    .replace(/[%*,()\\]/g, "")
    .trim()
    .slice(0, 100)
  const rawFilter = firstSearchParam(query.filter)
  const filter = FILTERS.has(rawFilter as ProspectingCandidateFilter)
    ? (rawFilter as ProspectingCandidateFilter)
    : "available"
  const rawPage = Number(firstSearchParam(query.page))
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1
  const filters: ProspectingCandidateFilters = { q, filter, page }
  const candidates = await listProspectingCandidatesAction({
    runId: id,
    query: q,
    filter,
    page,
    pageSize: 50,
  })

  return (
    <ProspectingRunPage
      initialRun={run}
      initialCandidates={
        candidates.status === "success"
          ? candidates.result
          : { items: [], page, pageSize: 50, total: 0 }
      }
      initialCandidateError={
        candidates.status === "error" ? candidates.message : null
      }
      filters={filters}
    />
  )
}
