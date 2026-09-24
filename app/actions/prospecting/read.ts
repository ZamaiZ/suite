"use server"

import { z } from "zod"
import { requireCommercialMember } from "@/lib/auth/session"
import { isBrazilStateCode } from "@/lib/br-locations"
import type {
  ProspectingCandidateFilter,
  ProspectingCandidateListItem,
  ProspectingCandidatePage,
  ProspectingRunDetail,
  ProspectingRunPage,
  ProspectingRunSummary,
} from "@/lib/prospecting/reads"
import {
  isProspectingPauseReason,
  isProspectingRunStatus,
} from "@/lib/prospecting/reads"
import { createClient } from "@/lib/supabase/server"

const candidateListSchema = z.object({
  runId: z.uuid(),
  query: z.string().trim().max(100).optional().default(""),
  filter: z
    .enum(["available", "ambiguous", "duplicate", "imported", "ignored"])
    .optional()
    .default("available"),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(50),
})

const runListSchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  status: z
    .enum([
      "all",
      "draft",
      "collecting",
      "paused",
      "completed",
      "failed",
      "cancelled",
    ])
    .optional()
    .default("all"),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(50).optional().default(20),
})

const runIdSchema = z.uuid()

type SegmentEmbed = { id: string; name: string }

type RunReadRow = {
  id: string
  segment_id: string
  city: string
  state_code: string
  status: string
  pause_reason: string | null
  total_count: number | null
  fetched_count: number
  accepted_count: number
  ambiguous_count: number
  duplicate_count: number
  rejected_count: number
  budget_usd: number | string
  actual_cost_usd: number | string
  created_at: string
  updated_at: string
  segments: SegmentEmbed | SegmentEmbed[] | null
}

type RunDetailRow = RunReadRow & {
  category_names: string[]
  primary_category: string
  ibge_code: string
  center_latitude: number
  center_longitude: number
  radius_km: number | string
  next_offset: number
  result_limit: number
  estimated_cost_usd: number | string
  price_per_request_usd: number | string
  price_per_result_usd: number | string
  error_message: string | null
  started_at: string | null
  finished_at: string | null
}

const RUN_SUMMARY_SELECT =
  "id, segment_id, city, state_code, status, pause_reason, total_count, fetched_count, accepted_count, ambiguous_count, duplicate_count, rejected_count, budget_usd, actual_cost_usd, created_at, updated_at, segments(id, name)"

const RUN_DETAIL_SELECT = `${RUN_SUMMARY_SELECT}, category_names, primary_category, ibge_code, center_latitude, center_longitude, radius_km, next_offset, result_limit, estimated_cost_usd, price_per_request_usd, price_per_result_usd, error_message, started_at, finished_at`

type CandidateEmbed = {
  id: string
  place_id: string
  company_name: string | null
  primary_category: string | null
  address: string | null
  phone: string | null
  website: string | null
  website_domain: string | null
  rating: number | null
  reviews_count: number | null
  vendor_updated_at: string | null
  imported_lead_id: string | null
  check_url: string | null
}

function candidateFromEmbed(
  value: CandidateEmbed | CandidateEmbed[] | null,
): CandidateEmbed | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function statesForFilter(filter: ProspectingCandidateFilter): string[] {
  if (filter === "available") {
    return [
      "available",
      "selected",
      "closed",
      "missing_contact",
      "missing_name",
    ]
  }
  if (filter === "ambiguous") return ["ambiguous_location"]
  if (filter === "duplicate") return ["duplicate"]
  if (filter === "imported") return ["imported"]
  return ["ignored"]
}

function sanitizeSearch(value: string): string {
  return value
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function segmentFromEmbed(
  value: SegmentEmbed | SegmentEmbed[] | null,
): SegmentEmbed | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function runSummary(row: RunReadRow): ProspectingRunSummary | null {
  const segment = segmentFromEmbed(row.segments)
  const budgetUsd = finiteNumber(row.budget_usd)
  const actualCostUsd = finiteNumber(row.actual_cost_usd)
  if (
    !segment ||
    !isBrazilStateCode(row.state_code) ||
    !isProspectingRunStatus(row.status) ||
    (row.pause_reason !== null && !isProspectingPauseReason(row.pause_reason)) ||
    budgetUsd === null ||
    actualCostUsd === null
  ) {
    return null
  }
  return {
    id: row.id,
    segment,
    city: row.city,
    stateCode: row.state_code,
    status: row.status,
    pauseReason: row.pause_reason,
    totalCount: row.total_count,
    fetchedCount: row.fetched_count,
    acceptedCount: row.accepted_count,
    ambiguousCount: row.ambiguous_count,
    duplicateCount: row.duplicate_count,
    rejectedCount: row.rejected_count,
    budgetUsd,
    actualCostUsd,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listProspectingRuns(input: {
  q?: string
  status?:
    | "all"
    | "draft"
    | "collecting"
    | "paused"
    | "completed"
    | "failed"
    | "cancelled"
  page?: number
  pageSize?: number
} = {}): Promise<ProspectingRunPage> {
  await requireCommercialMember()
  const parsed = runListSchema.safeParse(input)
  if (!parsed.success) {
    return { items: [], page: 1, pageSize: 20, total: 0 }
  }
  const supabase = await createClient()
  const query = sanitizeSearch(parsed.data.q)
  let segmentIds: string[] = []
  if (query) {
    const { data, error } = await supabase
      .from("segments")
      .select("id")
      .ilike("name", `%${query}%`)
      .limit(100)
    if (error) {
      throw new Error("Unable to search prospecting segments.", {
        cause: error,
      })
    }
    segmentIds = (data ?? []).flatMap((row) =>
      typeof row.id === "string" ? [row.id] : [],
    )
  }

  const from = (parsed.data.page - 1) * parsed.data.pageSize
  const to = from + parsed.data.pageSize - 1
  let listQuery = supabase
    .from("prospecting_runs")
    .select(RUN_SUMMARY_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to)
  if (parsed.data.status !== "all") {
    listQuery = listQuery.eq("status", parsed.data.status)
  }
  if (query) {
    const segmentFilter =
      segmentIds.length > 0 ? `,segment_id.in.(${segmentIds.join(",")})` : ""
    listQuery = listQuery.or(`city.ilike.%${query}%${segmentFilter}`)
  }
  const { data, error, count } = await listQuery
  if (error) {
    throw new Error("Unable to list prospecting runs.", { cause: error })
  }
  const items = (data ?? []).flatMap((row) => {
    const summary = runSummary(row as unknown as RunReadRow)
    return summary ? [summary] : []
  })
  return {
    items,
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    total: count ?? 0,
  }
}

export async function getProspectingRun(
  runId: string,
): Promise<ProspectingRunDetail | null> {
  await requireCommercialMember()
  const parsed = runIdSchema.safeParse(runId)
  if (!parsed.success) return null
  const supabase = await createClient()
  const [{ data, error }, unknownCost] = await Promise.all([
    supabase
      .from("prospecting_runs")
      .select(RUN_DETAIL_SELECT)
      .eq("id", parsed.data)
      .maybeSingle(),
    supabase
      .from("prospecting_run_pages")
      .select("id", { count: "exact", head: true })
      .eq("run_id", parsed.data)
      .eq("status", "unknown"),
  ])
  if (error || unknownCost.error) {
    throw new Error("Unable to load prospecting run.", {
      cause: error ?? unknownCost.error,
    })
  }
  if (!data) return null
  const row = data as unknown as RunDetailRow
  const summary = runSummary(row)
  const radiusKm = finiteNumber(row.radius_km)
  const estimatedCostUsd = finiteNumber(row.estimated_cost_usd)
  const pricePerRequestUsd = finiteNumber(row.price_per_request_usd)
  const pricePerResultUsd = finiteNumber(row.price_per_result_usd)
  if (
    !summary ||
    radiusKm === null ||
    estimatedCostUsd === null ||
    pricePerRequestUsd === null ||
    pricePerResultUsd === null ||
    !Array.isArray(row.category_names)
  ) {
    throw new Error("Prospecting run has an invalid persisted contract.")
  }
  return {
    ...summary,
    categories: row.category_names,
    primaryCategory: row.primary_category,
    ibgeCode: row.ibge_code,
    centerLatitude: row.center_latitude,
    centerLongitude: row.center_longitude,
    radiusKm,
    nextOffset: row.next_offset,
    resultLimit: row.result_limit,
    estimatedCostUsd,
    pricePerRequestUsd,
    pricePerResultUsd,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    hasUnknownCost: (unknownCost.count ?? 0) > 0,
    canStart: row.status === "draft",
    canPause: row.status === "collecting",
    canResume: row.status === "paused",
    canCancel:
      row.status === "draft" ||
      row.status === "collecting" ||
      row.status === "paused",
  }
}

export async function listProspectingCandidatesAction(input: {
  runId: string
  query?: string
  filter?: ProspectingCandidateFilter
  page?: number
  pageSize?: number
}): Promise<
  | { status: "success"; result: ProspectingCandidatePage }
  | { status: "error"; message: string }
> {
  await requireCommercialMember()
  const parsed = candidateListSchema.safeParse(input)
  if (!parsed.success) {
    return { status: "error", message: "Filtros de candidatos inválidos." }
  }
  const query = sanitizeSearch(parsed.data.query)
  const supabase = await createClient()
  let matchingCandidateIds: string[] | null = null
  if (query) {
    const { data, error } = await supabase
      .from("prospecting_candidates")
      .select("id")
      .or(
        `company_name.ilike.%${query}%,website_domain.ilike.%${query}%,phone.ilike.%${query}%`,
      )
      .limit(2000)
    if (error) {
      return { status: "error", message: "Não foi possível buscar candidatos." }
    }
    matchingCandidateIds = (data ?? []).flatMap((row) =>
      typeof row.id === "string" ? [row.id] : [],
    )
  }

  if (matchingCandidateIds?.length === 0) {
    return {
      status: "success",
      result: {
        items: [],
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        total: 0,
      },
    }
  }

  const from = (parsed.data.page - 1) * parsed.data.pageSize
  const to = from + parsed.data.pageSize - 1
  let listQuery = supabase
    .from("prospecting_run_candidates")
    .select(
      "candidate_id, discovery_position, territory_class, category_class, review_state, conflict_kind, conflict_severity, related_lead_id, prospecting_candidates(id, place_id, company_name, primary_category, address, phone, website, website_domain, rating, reviews_count, vendor_updated_at, imported_lead_id, check_url)",
      { count: "exact" },
    )
    .eq("run_id", parsed.data.runId)
    .in("review_state", statesForFilter(parsed.data.filter))
    .order("discovery_position", { ascending: true })
    .range(from, to)
  if (matchingCandidateIds) {
    listQuery = listQuery.in("candidate_id", matchingCandidateIds)
  }
  const { data, error, count } = await listQuery
  if (error) {
    return { status: "error", message: "Não foi possível listar candidatos." }
  }

  const items: ProspectingCandidateListItem[] = (data ?? []).flatMap((row) => {
    const candidate = candidateFromEmbed(
      row.prospecting_candidates as CandidateEmbed | CandidateEmbed[] | null,
    )
    if (
      !candidate ||
      typeof row.discovery_position !== "number" ||
      (row.territory_class !== "inside" &&
        row.territory_class !== "outside" &&
        row.territory_class !== "ambiguous") ||
      (row.category_class !== "exact" &&
        row.category_class !== "related" &&
        row.category_class !== "mismatch")
    ) {
      return []
    }
    return [
      {
        id: candidate.id,
        placeId: candidate.place_id,
        companyName: candidate.company_name,
        primaryCategory: candidate.primary_category,
        address: candidate.address,
        phone: candidate.phone,
        website: candidate.website,
        websiteDomain: candidate.website_domain,
        rating: candidate.rating,
        reviewsCount: candidate.reviews_count,
        vendorUpdatedAt: candidate.vendor_updated_at,
        territoryClass: row.territory_class,
        categoryClass: row.category_class,
        reviewState: row.review_state,
        conflictKind: row.conflict_kind,
        conflictSeverity:
          row.conflict_severity === "block" ||
          row.conflict_severity === "warning"
            ? row.conflict_severity
            : null,
        relatedLeadId: row.related_lead_id,
        importedLeadId: candidate.imported_lead_id,
        checkUrl: candidate.check_url,
        discoveryPosition: row.discovery_position,
      },
    ]
  })
  return {
    status: "success",
    result: {
      items,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      total: count ?? 0,
    },
  }
}
