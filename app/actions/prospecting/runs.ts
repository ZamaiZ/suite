"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireCommercialMember } from "@/lib/auth/session"
import {
  isBrazilStateCode,
  normalizeCityMatch,
  type BrazilStateCode,
} from "@/lib/br-locations"
import { fetchBusinessListingsPage } from "@/lib/dataforseo/business-listings"
import { fetchDataForSeoUserData } from "@/lib/dataforseo/user-data"
import {
  businessListingsRate,
  estimateBusinessListingsPageCost,
  type BusinessListingsRate,
} from "@/lib/prospecting/cost"
import {
  classifyCandidate,
  normalizeBusinessListing,
} from "@/lib/prospecting/candidates"
import { validateNormalizedCandidate } from "@/lib/prospecting/candidate-validation"
import { findProspectingConflicts } from "@/lib/prospecting/conflicts"
import {
  readMunicipalityGeometry,
  type MunicipalityGeometry,
} from "@/lib/prospecting/geometry"
import { loadProspectingBoundary } from "@/lib/prospecting/ibge"
import { isProspectingRunStatus } from "@/lib/prospecting/reads"
import { createClient } from "@/lib/supabase/server"

const runIdSchema = z.uuid("Pesquisa inválida.")
type ProspectingFailureStage =
  | "normalize"
  | "conflicts"
  | "classify"
  | "complete_rpc"

const SAFE_PROSPECTING_CONSTRAINTS = new Set([
  "prospecting_runs_status_check",
  "prospecting_runs_pause_reason_check",
  "prospecting_runs_state_check",
  "prospecting_runs_categories_check",
  "prospecting_runs_geometry_check",
  "prospecting_runs_coordinates_check",
  "prospecting_runs_counts_check",
  "prospecting_runs_limits_check",
  "prospecting_runs_lease_check",
  "prospecting_runs_error_length_check",
  "prospecting_run_pages_status_check",
  "prospecting_run_pages_counts_check",
  "prospecting_run_pages_lease_check",
  "prospecting_run_pages_error_length_check",
  "prospecting_candidates_name_check",
  "prospecting_candidates_coordinates_check",
  "prospecting_candidates_rating_check",
  "prospecting_candidates_counts_check",
  "prospecting_run_candidates_position_check",
  "prospecting_run_candidates_territory_check",
  "prospecting_run_candidates_category_check",
  "prospecting_run_candidates_review_check",
  "prospecting_run_candidates_conflict_check",
])

function safeDatabaseFailure(
  error:
    | {
        code?: string
        message?: string
      }
    | null
    | undefined,
) {
  const matchedConstraint = error?.message?.match(
    /constraint "([a-zA-Z0-9_]+)"/i,
  )?.[1]
  return {
    code: error?.code ?? "unknown",
    constraint:
      matchedConstraint && SAFE_PROSPECTING_CONSTRAINTS.has(matchedConstraint)
        ? matchedConstraint
        : null,
  }
}

function databaseFailureCause(error: unknown) {
  const cause = error instanceof Error ? (error.cause ?? error) : error
  if (!cause || typeof cause !== "object") return null
  const record = cause as Record<string, unknown>
  return {
    code: typeof record.code === "string" ? record.code : undefined,
    message: typeof record.message === "string" ? record.message : undefined,
  }
}

const prepareSchema = z
  .object({
    segmentId: z.uuid(),
    city: z.string().trim().min(1).max(160),
    stateCode: z.string().trim().length(2),
    categoryNames: z.array(z.string().trim().min(1).max(160)).min(1).max(10),
    primaryCategory: z.string().trim().min(1).max(160),
    resultLimit: z.number().int().min(1).max(100_000),
    budgetUsd: z.number().positive().multipleOf(0.000001),
  })
  .superRefine((value, context) => {
    const unique = new Set(value.categoryNames)
    if (unique.size !== value.categoryNames.length) {
      context.addIssue({
        code: "custom",
        path: ["categoryNames"],
        message: "Não repita categorias.",
      })
    }
    if (!unique.has(value.primaryCategory)) {
      context.addIssue({
        code: "custom",
        path: ["primaryCategory"],
        message: "A categoria principal deve fazer parte da seleção.",
      })
    }
  })

const claimSchema = z.object({
  outcome: z.string(),
  pageId: z.string().optional(),
  inputOffset: z.number().int().nonnegative().optional(),
  inputOffsetToken: z.string().nullable().optional(),
  itemLimit: z.number().int().min(1).max(1000).optional(),
  categories: z.array(z.string()).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  radiusKm: z.number().positive().optional(),
})

type RunCommandState =
  | { status: "success"; outcome: string; runId: string }
  | { status: "error"; message: string }

export type PrepareRunState =
  | {
      status: "success"
      runId: string
      confirmation: {
        city: string
        stateCode: BrazilStateCode
        ibgeCode: string
        categories: string[]
        resultLimit: number
        budgetUsd: number
        firstPageLimit: number
        maximumFirstPageCostUsd: number
        rate: BusinessListingsRate
        centerLatitude: number
        centerLongitude: number
        radiusKm: number
      }
    }
  | { status: "error"; message: string }

export type AdvanceRunState =
  | {
      status: "success"
      outcome:
        | "busy"
        | "completed"
        | "paused"
        | "collected"
        | "already_completed"
      runId: string
    }
  | {
      status: "error"
      message: string
      unknownCost?: boolean
      runId?: string
      started?: boolean
    }

function revalidateProspecting(runId?: string) {
  revalidatePath("/prospecting")
  if (runId) revalidatePath(`/prospecting/${runId}`)
}

async function currentRate(): Promise<BusinessListingsRate | null> {
  const userData = await fetchDataForSeoUserData()
  if (userData.status === "error") return null
  return businessListingsRate(userData.data.prices)
}

async function commandRun(
  runId: string,
  command: "start" | "pause" | "resume" | "cancel",
  pauseReason: "user" | "budget" | "vendor_price_change" | null = null,
): Promise<RunCommandState> {
  const parsed = runIdSchema.safeParse(runId)
  if (!parsed.success) return { status: "error", message: "Pesquisa inválida." }
  const { user } = await requireCommercialMember()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("command_prospecting_run", {
    p_run_id: parsed.data,
    p_actor_id: user.id,
    p_command: command,
    p_pause_reason: pauseReason,
  })
  if (error || !data || typeof data !== "object") {
    return { status: "error", message: "Não foi possível alterar a pesquisa." }
  }
  const outcome =
    "outcome" in data && typeof data.outcome === "string"
      ? data.outcome
      : "invalid"
  if (outcome !== "ok") {
    return {
      status: "error",
      message:
        outcome === "busy"
          ? "A página atual ainda está sendo processada."
          : "Esta transição não é permitida para a pesquisa.",
    }
  }
  revalidateProspecting(runId)
  return { status: "success", outcome, runId }
}

async function boundaryForRun(
  city: string,
  stateCode: BrazilStateCode,
  actorId: string,
) {
  const supabase = await createClient()
  const { data: cached, error } = await supabase
    .from("prospecting_city_boundaries")
    .select(
      "ibge_code, geometry, center_latitude, center_longitude, radius_km, source_updated_at, fetched_at",
    )
    .eq("state_code", stateCode)
    .eq("city", city)
    .maybeSingle()
  if (!error && cached) {
    const geometry = readMunicipalityGeometry(cached.geometry)
    if (
      geometry &&
      typeof cached.center_latitude === "number" &&
      typeof cached.center_longitude === "number" &&
      typeof cached.radius_km === "number"
    ) {
      return {
        status: "ok" as const,
        data: {
          code: String(cached.ibge_code),
          city,
          stateCode,
          geometry,
          circle: {
            latitude: cached.center_latitude,
            longitude: cached.center_longitude,
            radiusKm: cached.radius_km,
          },
        },
      }
    }
  }

  const fetched = await loadProspectingBoundary(city, stateCode)
  if (fetched.status === "error") return fetched
  const { error: saveError } = await supabase.rpc(
    "upsert_prospecting_city_boundary",
    {
      p_actor_id: actorId,
      p_state_code: fetched.data.stateCode,
      p_city: fetched.data.city,
      p_ibge_code: fetched.data.code,
      p_geometry: fetched.data.geometry,
      p_center_latitude: fetched.data.circle.latitude,
      p_center_longitude: fetched.data.circle.longitude,
      p_radius_km: fetched.data.circle.radiusKm,
      p_source_updated_at: fetched.data.sourceUpdatedAt,
      p_fetched_at: fetched.data.fetchedAt,
    },
  )
  if (saveError) {
    return {
      status: "error" as const,
      message: "Não foi possível salvar os limites do município.",
    }
  }
  return { status: "ok" as const, data: fetched.data }
}

export async function prepareProspectingRunAction(
  input: z.input<typeof prepareSchema>,
): Promise<PrepareRunState> {
  const { user } = await requireCommercialMember()
  const parsed = prepareSchema.safeParse(input)
  if (!parsed.success) {
    return { status: "error", message: "Configuração de pesquisa inválida." }
  }
  const stateCode = parsed.data.stateCode.toUpperCase()
  if (!isBrazilStateCode(stateCode)) {
    return { status: "error", message: "UF inválida." }
  }
  const city = normalizeCityMatch(stateCode, parsed.data.city)
  if (!city) return { status: "error", message: "Município inválido." }

  const boundary = await boundaryForRun(city, stateCode, user.id)
  if (boundary.status === "error") return boundary
  const rate = await currentRate()
  if (!rate) {
    return {
      status: "error",
      message: "Não foi possível ler a tarifa da conta DataForSEO.",
    }
  }
  const firstPageLimit = Math.min(1000, parsed.data.resultLimit)
  const maximumFirstPageCostUsd = estimateBusinessListingsPageCost(
    rate,
    firstPageLimit,
  )
  if (parsed.data.budgetUsd < maximumFirstPageCostUsd) {
    return {
      status: "error",
      message: "O orçamento não cobre a primeira página da pesquisa.",
    }
  }

  const supabase = await createClient()
  const [{ data: segment, error: segmentError }, { data: categories, error: categoriesError }] =
    await Promise.all([
      supabase
        .from("segments")
        .select("id")
        .eq("id", parsed.data.segmentId)
        .maybeSingle(),
      supabase
        .from("prospecting_category_catalog")
        .select("category_name")
        .in("category_name", parsed.data.categoryNames),
    ])
  if (
    segmentError ||
    categoriesError ||
    !segment ||
    (categories ?? []).length !== parsed.data.categoryNames.length
  ) {
    return {
      status: "error",
      message: "Segmento ou categorias não estão disponíveis.",
    }
  }

  const { error: mappingError } = await supabase.rpc(
    "replace_prospecting_segment_categories",
    {
      p_actor_id: user.id,
      p_segment_id: parsed.data.segmentId,
      p_category_names: parsed.data.categoryNames,
      p_primary_category: parsed.data.primaryCategory,
    },
  )
  if (mappingError) {
    return { status: "error", message: "Não foi possível salvar as categorias." }
  }

  const { data: runId, error: runError } = await supabase.rpc(
    "create_prospecting_run",
    {
      p_actor_id: user.id,
      p_segment_id: parsed.data.segmentId,
      p_city: city,
      p_state_code: stateCode,
      p_category_names: parsed.data.categoryNames,
      p_primary_category: parsed.data.primaryCategory,
      p_ibge_code: boundary.data.code,
      p_boundary_geometry: boundary.data.geometry,
      p_center_latitude: boundary.data.circle.latitude,
      p_center_longitude: boundary.data.circle.longitude,
      p_radius_km: boundary.data.circle.radiusKm,
      p_result_limit: parsed.data.resultLimit,
      p_budget_usd: parsed.data.budgetUsd,
      p_estimated_cost_usd: maximumFirstPageCostUsd,
      p_price_per_request_usd: rate.perRequest,
      p_price_per_result_usd: rate.perResult,
    },
  )
  if (runError || typeof runId !== "string") {
    return { status: "error", message: "Não foi possível preparar a pesquisa." }
  }
  revalidateProspecting(runId)
  return {
    status: "success",
    runId,
    confirmation: {
      city,
      stateCode,
      ibgeCode: boundary.data.code,
      categories: parsed.data.categoryNames,
      resultLimit: parsed.data.resultLimit,
      budgetUsd: parsed.data.budgetUsd,
      firstPageLimit,
      maximumFirstPageCostUsd,
      rate,
      centerLatitude: boundary.data.circle.latitude,
      centerLongitude: boundary.data.circle.longitude,
      radiusKm: boundary.data.circle.radiusKm,
    },
  }
}

export async function startProspectingRunAction(
  runId: string,
): Promise<AdvanceRunState> {
  const started = await commandRun(runId, "start")
  if (started.status === "error") return started
  try {
    const advanced = await advanceProspectingRunAction(runId)
    return advanced.status === "error"
      ? { ...advanced, runId, started: true }
      : advanced
  } catch {
    return {
      status: "error",
      message:
        "A pesquisa foi iniciada, mas não foi possível confirmar a primeira coleta.",
      runId,
      started: true,
    }
  }
}

export async function pauseProspectingRunAction(
  runId: string,
): Promise<RunCommandState> {
  return commandRun(runId, "pause", "user")
}

export async function resumeProspectingRunAction(
  runId: string,
): Promise<RunCommandState> {
  const rate = await currentRate()
  if (!rate) {
    return { status: "error", message: "Não foi possível validar a tarifa." }
  }
  return commandRun(runId, "resume")
}

export async function cancelProspectingRunAction(
  runId: string,
): Promise<RunCommandState> {
  return commandRun(runId, "cancel")
}

async function failPage(input: {
  pageId: string
  actorId: string
  runId: string
  knownEnvelope: boolean
  cost: number | null
  message: string
}): Promise<{ ok: true } | { ok: false }> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc("fail_prospecting_page", {
      p_page_id: input.pageId,
      p_actor_id: input.actorId,
      p_known_envelope: input.knownEnvelope,
      p_cost_usd: input.cost,
      p_error_message: input.message,
    })
    if (!error && data) return { ok: true }
    console.error("[prospecting] failed to finalize page failure", {
      databaseFailure: safeDatabaseFailure(error),
      pageId: input.pageId,
      runId: input.runId,
      knownEnvelope: input.knownEnvelope,
    })
  } catch (error) {
    console.error("[prospecting] failed to finalize page failure", {
      errorType: error instanceof Error ? error.name : "UnknownError",
      databaseFailure: safeDatabaseFailure(databaseFailureCause(error)),
      pageId: input.pageId,
      runId: input.runId,
      knownEnvelope: input.knownEnvelope,
    })
  }
  return { ok: false }
}

async function haltRunAfterPageFailure(runId: string) {
  try {
    const halted = await commandRun(runId, "pause", "user")
    if (halted.status === "error") {
      console.error("[prospecting] failed to halt run after page failure", {
        runId,
        status: halted.status,
      })
    }
  } catch (error) {
    console.error("[prospecting] failed to halt run after page failure", {
      runId,
      errorType: error instanceof Error ? error.name : "UnknownError",
      databaseFailure: safeDatabaseFailure(databaseFailureCause(error)),
    })
  }
}

export async function advanceProspectingRunAction(
  runId: string,
): Promise<AdvanceRunState> {
  const parsedId = runIdSchema.safeParse(runId)
  if (!parsedId.success) {
    return { status: "error", message: "Pesquisa inválida." }
  }
  const { user } = await requireCommercialMember()
  const supabase = await createClient()
  const { data: run, error: runError } = await supabase
    .from("prospecting_runs")
    .select(
      "id, status, city, category_names, boundary_geometry, price_per_request_usd, price_per_result_usd",
    )
    .eq("id", parsedId.data)
    .maybeSingle()
  if (runError || !run || !isProspectingRunStatus(run.status)) {
    return { status: "error", message: "Pesquisa não encontrada." }
  }
  if (run.status !== "collecting") {
    return {
      status: "success",
      outcome: run.status === "completed" ? "completed" : "paused",
      runId,
    }
  }

  const rate = await currentRate()
  if (
    !rate ||
    rate.perRequest > Number(run.price_per_request_usd) ||
    rate.perResult > Number(run.price_per_result_usd)
  ) {
    await commandRun(runId, "pause", "vendor_price_change")
    return { status: "success", outcome: "paused", runId }
  }

  const geometry = readMunicipalityGeometry(run.boundary_geometry)
  if (!geometry) {
    return { status: "error", message: "Limite municipal inválido." }
  }
  const { data: claimed, error: claimError } = await supabase.rpc(
    "claim_prospecting_page",
    {
      p_run_id: runId,
      p_actor_id: user.id,
      p_lease_seconds: 90,
    },
  )
  const claim = claimSchema.safeParse(claimed)
  if (claimError || !claim.success) {
    return { status: "error", message: "Não foi possível reservar a página." }
  }
  if (claim.data.outcome === "busy") {
    return { status: "success", outcome: "busy", runId }
  }
  if (
    claim.data.outcome === "completed" ||
    claim.data.outcome === "already_completed"
  ) {
    revalidateProspecting(runId)
    return {
      status: "success",
      outcome: claim.data.outcome,
      runId,
    }
  }
  if (claim.data.outcome === "paused") {
    revalidateProspecting(runId)
    return { status: "success", outcome: "paused", runId }
  }
  // Uma página reservada e nunca prestada de contas pode ter sido cobrada. O
  // cursor não é refeito e a conta fica em aberto para uma pessoa conferir no
  // painel do fornecedor — repetir aqui pagaria de novo pelo mesmo cursor.
  if (claim.data.outcome === "unknown") {
    revalidateProspecting(runId)
    return {
      status: "error",
      message:
        "Uma página ficou sem recibo e o custo dela é desconhecido. Confira o gasto no painel da DataForSEO antes de criar outra pesquisa.",
      unknownCost: true,
      runId,
    }
  }
  if (
    claim.data.outcome !== "claimed" ||
    !claim.data.pageId ||
    claim.data.itemLimit === undefined ||
    !claim.data.categories ||
    claim.data.latitude === undefined ||
    claim.data.longitude === undefined ||
    claim.data.radiusKm === undefined
  ) {
    return { status: "error", message: "A página não pode ser processada." }
  }

  let collected: Awaited<ReturnType<typeof fetchBusinessListingsPage>>
  try {
    collected = await fetchBusinessListingsPage({
      categories: claim.data.categories,
      latitude: claim.data.latitude,
      longitude: claim.data.longitude,
      radiusKm: claim.data.radiusKm,
      limit: claim.data.itemLimit,
      offset: claim.data.inputOffset,
      offsetToken: claim.data.inputOffsetToken,
    })
  } catch (error) {
    console.error("[prospecting] unexpected collection failure", {
      runId,
      pageId: claim.data.pageId,
      errorType: error instanceof Error ? error.name : "UnknownError",
      databaseFailure: safeDatabaseFailure(databaseFailureCause(error)),
    })
    const finalized = await failPage({
      pageId: claim.data.pageId,
      actorId: user.id,
      runId,
      knownEnvelope: false,
      cost: null,
      message: "A resposta da coleta ficou desconhecida.",
    })
    if (!finalized.ok) await haltRunAfterPageFailure(runId)
    revalidateProspecting(runId)
    return {
      status: "error",
      message: "A resposta da coleta ficou desconhecida.",
      unknownCost: true,
      runId,
    }
  }
  if (collected.status !== "ok") {
    const unknown = collected.status === "unknown"
    const finalized = await failPage({
      pageId: claim.data.pageId,
      actorId: user.id,
      runId,
      knownEnvelope: !unknown,
      cost:
        collected.status === "rejected" ||
        collected.status === "invalid_response"
          ? collected.cost
          : null,
      message: collected.message,
    })
    if (!finalized.ok) {
      await haltRunAfterPageFailure(runId)
    }
    revalidateProspecting(runId)
    return {
      status: "error",
      message: collected.message,
      unknownCost: unknown,
    }
  }

  let stage: ProspectingFailureStage = "normalize"
  const itemCount = collected.page.items.length
  try {
  const observedAt = new Date().toISOString()
  let rejectedCount = 0
  const rejectedByCode: Record<string, number> = {}
  const rejectCandidate = (code: string) => {
    rejectedCount += 1
    rejectedByCode[code] = (rejectedByCode[code] ?? 0) + 1
  }
  const normalizedItems = collected.page.items.flatMap((raw, index) => {
    const normalized = normalizeBusinessListing(raw, observedAt)
    if ("status" in normalized) {
      rejectCandidate(normalized.reason)
      return []
    }
    const rejectionCode = validateNormalizedCandidate(normalized)
    if (rejectionCode) {
      rejectCandidate(rejectionCode)
      return []
    }
    return [{ normalized, index }]
  })
  stage = "conflicts"
  const conflicts = await findProspectingConflicts(
    supabase,
    normalizedItems.map(({ normalized }) => normalized),
    run.city,
  )
  stage = "classify"
  const items = normalizedItems.map(({ normalized, index }) => {
    const classification = classifyCandidate(
      normalized,
      claim.data.categories ?? [],
      geometry,
    )
    const conflict = conflicts.get(normalized.placeId) ?? null
    return {
        place_id: normalized.placeId,
        cid: normalized.cid,
        feature_id: normalized.featureId,
        company_name: normalized.companyName,
        description: normalized.description,
        primary_category: normalized.primaryCategory,
        category_ids: normalized.categoryIds,
        additional_categories: normalized.additionalCategories,
        address: normalized.address,
        address_info: normalized.addressInfo,
        phone: normalized.phone,
        website: normalized.website,
        website_domain: normalized.websiteDomain,
        latitude: normalized.latitude,
        longitude: normalized.longitude,
        rating: normalized.rating,
        reviews_count: normalized.reviewsCount,
        is_claimed: normalized.isClaimed,
        business_status: normalized.businessStatus,
        logo_url: normalized.logoUrl,
        main_image_url: normalized.mainImageUrl,
        total_photos: normalized.totalPhotos,
        check_url: normalized.checkUrl,
        vendor_first_seen: normalized.vendorFirstSeen,
        vendor_updated_at: normalized.vendorUpdatedAt,
        observed_at: normalized.observedAt,
        discovery_position: (claim.data.inputOffset ?? 0) + index,
        territory_class: classification.territory,
        category_class: classification.category,
        blocked_reason: classification.blockedReason,
        conflict_kind: conflict?.kind ?? null,
        conflict_severity: conflict?.severity ?? null,
        related_lead_id: conflict?.relatedLeadId ?? null,
      }
  })

  stage = "complete_rpc"
  const { data: completed, error: completionError } = await supabase.rpc(
    "complete_prospecting_page",
    {
      p_page_id: claim.data.pageId,
      p_actor_id: user.id,
      p_total_count: collected.page.totalCount,
      p_next_offset: collected.page.nextOffset,
      p_next_offset_token: collected.page.nextOffsetToken,
      p_items: items,
      p_rejected_count: rejectedCount,
      p_cost_usd: collected.page.cost,
    },
  )
  if (completionError || !completed) {
    console.error("[prospecting] page completion RPC failed", {
      runId,
      pageId: claim.data.pageId,
      stage,
      databaseFailure: safeDatabaseFailure(completionError),
      costUsd: collected.page.cost,
      itemCount,
      normalizedCandidateCount: items.length,
      rejectedCount,
      rejectedByCode,
    })
    const finalized = await failPage({
      pageId: claim.data.pageId,
      actorId: user.id,
      runId,
      knownEnvelope: true,
      cost: collected.page.cost,
      message: "A página foi recebida, mas não pôde ser persistida.",
    })
    if (!finalized.ok) await haltRunAfterPageFailure(runId)
    revalidateProspecting(runId)
    return {
      status: "error",
      message: "A página foi recebida, mas não pôde ser persistida.",
    }
  }
  revalidateProspecting(runId)
  const outcome =
    typeof completed === "object" &&
    "outcome" in completed &&
    completed.outcome === "completed"
      ? "completed"
      : "collected"
  return { status: "success", outcome, runId }
  } catch (error) {
    console.error("[prospecting] unexpected page persistence failure", {
      runId,
      pageId: claim.data.pageId,
      stage,
      errorType: error instanceof Error ? error.name : "UnknownError",
      databaseFailure: safeDatabaseFailure(databaseFailureCause(error)),
      costUsd: collected.page.cost,
      itemCount,
      rejectedByCode,
    })
    const finalized = await failPage({
      pageId: claim.data.pageId,
      actorId: user.id,
      runId,
      knownEnvelope: true,
      cost: collected.page.cost,
      message: "A página foi recebida, mas não pôde ser persistida.",
    })
    if (!finalized.ok) await haltRunAfterPageFailure(runId)
    revalidateProspecting(runId)
    return {
      status: "error",
      message: "A página foi recebida, mas não pôde ser persistida.",
      runId,
    }
  }
}
