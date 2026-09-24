"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireCommercialMember } from "@/lib/auth/session"
import { fetchGoogleBusinessInfo } from "@/lib/dataforseo/google-info"
import {
  classifyCandidate,
  isPermanentlyClosedBusiness,
  normalizeBusinessListing,
} from "@/lib/prospecting/candidates"
import { findProspectingConflicts } from "@/lib/prospecting/conflicts"
import { readMunicipalityGeometry } from "@/lib/prospecting/geometry"
import type { NormalizedProspectingCandidate } from "@/lib/prospecting/types"
import { createClient } from "@/lib/supabase/server"

const candidateImportSchema = z.object({
  runId: z.uuid(),
  candidateId: z.uuid(),
})

const candidateBatchSchema = z.object({
  runId: z.uuid(),
  candidateIds: z.array(z.uuid()).min(1).max(50),
})

export type ImportCandidateOutcome =
  | "imported"
  | "conflict"
  | "stale"
  | "closed"
  | "no_contact"
  | "outside"
  | "mismatch"
  | "error"

export type ImportCandidateResult = {
  candidateId: string
  outcome: ImportCandidateOutcome
  leadId?: string
  relatedLeadId?: string
  conflictKind?: string
  message?: string
}

export type ImportCandidateState =
  | { status: "success"; result: ImportCandidateResult }
  | { status: "error"; message: string }

export type ImportBatchState =
  | { status: "success"; results: ImportCandidateResult[] }
  | { status: "error"; message: string }

type ProspectingClient = Awaited<ReturnType<typeof createClient>>

type RunRow = {
  id: string
  city: string
  category_names: string[]
  boundary_geometry: unknown
}

type RelationRow = {
  review_state: string
  territory_class: string
  category_class: string
  conflict_kind: string | null
  conflict_severity: string | null
  related_lead_id: string | null
}

type CandidateRow = {
  id: string
  place_id: string
  company_name: string | null
  phone: string | null
  website_domain: string | null
  latitude: number | null
  longitude: number | null
  business_status: string | null
  imported_lead_id: string | null
}

function result(
  candidateId: string,
  outcome: ImportCandidateOutcome,
  extras: Omit<ImportCandidateResult, "candidateId" | "outcome"> = {},
): ImportCandidateResult {
  return { candidateId, outcome, ...extras }
}

function publicMessage(outcome: ImportCandidateOutcome): string {
  if (outcome === "stale") return "O perfil não foi encontrado na revalidação."
  if (outcome === "closed") return "A empresa aparece como encerrada."
  if (outcome === "no_contact") return "A empresa não possui site nem telefone."
  if (outcome === "outside") {
    return "A empresa não pôde ser confirmada dentro do município."
  }
  if (outcome === "mismatch") {
    return "A categoria confirmada não corresponde à pesquisa."
  }
  if (outcome === "conflict") return "Já existe um lead para esta empresa."
  return "Não foi possível importar este candidato."
}

function rpcCandidate(candidate: NormalizedProspectingCandidate) {
  return {
    place_id: candidate.placeId,
    cid: candidate.cid,
    feature_id: candidate.featureId,
    company_name: candidate.companyName,
    description: candidate.description,
    primary_category: candidate.primaryCategory,
    category_ids: candidate.categoryIds,
    additional_categories: candidate.additionalCategories,
    address: candidate.address,
    address_info: candidate.addressInfo,
    phone: candidate.phone,
    website: candidate.website,
    website_domain: candidate.websiteDomain,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    rating: candidate.rating,
    reviews_count: candidate.reviewsCount,
    is_claimed: candidate.isClaimed,
    business_status: candidate.businessStatus,
    logo_url: candidate.logoUrl,
    main_image_url: candidate.mainImageUrl,
    total_photos: candidate.totalPhotos,
    check_url: candidate.checkUrl,
    vendor_first_seen: candidate.vendorFirstSeen,
    vendor_updated_at: candidate.vendorUpdatedAt,
  }
}

function resultFromRpc(
  candidateId: string,
  value: unknown,
): ImportCandidateResult | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const outcome = row.outcome
  if (outcome === "imported" && typeof row.leadId === "string") {
    return result(candidateId, "imported", { leadId: row.leadId })
  }
  if (outcome === "conflict" && typeof row.relatedLeadId === "string") {
    return result(candidateId, "conflict", {
      relatedLeadId: row.relatedLeadId,
      conflictKind:
        typeof row.conflictKind === "string" ? row.conflictKind : undefined,
      message: publicMessage("conflict"),
    })
  }
  if (
    outcome === "stale" ||
    outcome === "closed" ||
    outcome === "no_contact" ||
    outcome === "outside" ||
    outcome === "mismatch"
  ) {
    return result(candidateId, outcome, { message: publicMessage(outcome) })
  }
  if (outcome === "ambiguous") {
    return result(candidateId, "error", {
      message: "A revalidação não confirmou a localização da empresa.",
    })
  }
  if (outcome === "missing_name") {
    return result(candidateId, "error", {
      message: "A revalidação não retornou o nome da empresa.",
    })
  }
  return null
}

async function persistStale(
  supabase: ProspectingClient,
  actorId: string,
  runId: string,
  candidateId: string,
): Promise<ImportCandidateResult> {
  const { data, error } = await supabase.rpc("import_prospecting_candidate", {
    p_run_id: runId,
    p_candidate_id: candidateId,
    p_actor_id: actorId,
    p_revalidation_status: "stale",
    p_live_candidate: null,
    p_territory_class: null,
    p_category_class: null,
  })
  const parsed = error ? null : resultFromRpc(candidateId, data)
  return (
    parsed ??
    result(candidateId, "error", {
      message: "O perfil não foi encontrado, mas o estado não pôde ser salvo.",
    })
  )
}

async function importOne(
  supabase: ProspectingClient,
  actorId: string,
  input: { runId: string; candidateId: string },
): Promise<ImportCandidateResult> {
  const [{ data: run, error: runError }, { data: relation, error: relationError }, { data: candidate, error: candidateError }] =
    await Promise.all([
      supabase
        .from("prospecting_runs")
        .select("id, city, category_names, boundary_geometry")
        .eq("id", input.runId)
        .maybeSingle(),
      supabase
        .from("prospecting_run_candidates")
        .select(
          "review_state, territory_class, category_class, conflict_kind, conflict_severity, related_lead_id",
        )
        .eq("run_id", input.runId)
        .eq("candidate_id", input.candidateId)
        .maybeSingle(),
      supabase
        .from("prospecting_candidates")
        .select(
          "id, place_id, company_name, phone, website_domain, latitude, longitude, business_status, imported_lead_id",
        )
        .eq("id", input.candidateId)
        .maybeSingle(),
    ])

  if (runError || relationError || candidateError || !run || !relation || !candidate) {
    return result(input.candidateId, "error", {
      message: "Candidato não encontrado nesta pesquisa.",
    })
  }

  const runRow = run as RunRow
  const relationRow = relation as RelationRow
  const candidateRow = candidate as CandidateRow
  if (candidateRow.imported_lead_id) {
    return result(input.candidateId, "imported", {
      leadId: candidateRow.imported_lead_id,
    })
  }
  if (
    relationRow.review_state === "imported" ||
    relationRow.review_state === "ignored" ||
    relationRow.review_state === "stale"
  ) {
    return result(input.candidateId, "error", {
      message: "Este candidato não está elegível para revalidação.",
    })
  }
  if (
    relationRow.territory_class === "outside" ||
    relationRow.review_state === "outside_city"
  ) {
    return result(input.candidateId, "outside", {
      message: publicMessage("outside"),
    })
  }
  if (
    relationRow.category_class === "mismatch" ||
    relationRow.review_state === "category_mismatch"
  ) {
    return result(input.candidateId, "mismatch", {
      message: publicMessage("mismatch"),
    })
  }
  if (
    relationRow.review_state === "closed" ||
    isPermanentlyClosedBusiness(candidateRow.business_status)
  ) {
    return result(input.candidateId, "closed", {
      message: publicMessage("closed"),
    })
  }
  if (
    relationRow.conflict_severity === "block" ||
    relationRow.review_state === "duplicate"
  ) {
    try {
      const current = await findProspectingConflicts(
        supabase,
        [
          {
            placeId: candidateRow.place_id,
            companyName: candidateRow.company_name,
            phone: candidateRow.phone,
            websiteDomain: candidateRow.website_domain,
          },
        ],
        runRow.city,
      )
      const conflict = current.get(candidateRow.place_id)
      if (conflict?.severity === "block") {
        return result(input.candidateId, "conflict", {
          relatedLeadId: conflict.relatedLeadId,
          conflictKind: conflict.kind,
          message: publicMessage("conflict"),
        })
      }
    } catch {
      return result(input.candidateId, "error", {
        message: "Não foi possível conferir se o conflito ainda existe.",
      })
    }
  }
  if (!candidateRow.place_id) {
    return result(input.candidateId, "error", {
      message: "O candidato não possui identidade válida.",
    })
  }

  const geometry = readMunicipalityGeometry(runRow.boundary_geometry)
  if (!geometry || !Array.isArray(runRow.category_names)) {
    return result(input.candidateId, "error", {
      message: "A pesquisa não possui fronteira ou categorias válidas.",
    })
  }

  const live = await fetchGoogleBusinessInfo({
    placeId: candidateRow.place_id,
    latitude: candidateRow.latitude,
    longitude: candidateRow.longitude,
  })
  if (live.status === "not_found") {
    return persistStale(supabase, actorId, input.runId, input.candidateId)
  }
  if (live.status === "error") {
    return result(input.candidateId, "error", { message: live.message })
  }

  const normalized = normalizeBusinessListing(
    live.item,
    new Date().toISOString(),
  )
  if ("status" in normalized || normalized.placeId !== candidateRow.place_id) {
    return result(input.candidateId, "error", {
      message: "A revalidação retornou uma identidade incompatível.",
    })
  }
  const classification = classifyCandidate(
    normalized,
    runRow.category_names,
    geometry,
  )

  try {
    await findProspectingConflicts(supabase, [normalized], runRow.city)
  } catch {
    return result(input.candidateId, "error", {
      message: "Não foi possível repetir a verificação de duplicidade.",
    })
  }

  const { data, error } = await supabase.rpc("import_prospecting_candidate", {
    p_run_id: input.runId,
    p_candidate_id: input.candidateId,
    p_actor_id: actorId,
    p_revalidation_status: "found",
    p_live_candidate: rpcCandidate(normalized),
    p_territory_class: classification.territory,
    p_category_class: classification.category,
  })
  const parsed = error ? null : resultFromRpc(input.candidateId, data)
  return (
    parsed ??
    result(input.candidateId, "error", {
      message: "Não foi possível concluir a importação.",
    })
  )
}

function revalidateImport(runId: string, imported: boolean) {
  revalidatePath(`/prospecting/${runId}`)
  revalidatePath("/prospecting")
  if (imported) revalidatePath("/leads")
}

export async function importProspectingCandidateAction(input: {
  runId: string
  candidateId: string
}): Promise<ImportCandidateState> {
  const parsed = candidateImportSchema.safeParse(input)
  if (!parsed.success) {
    return { status: "error", message: "Candidato inválido." }
  }
  const { user } = await requireCommercialMember()
  const supabase = await createClient()
  const imported = await importOne(supabase, user.id, parsed.data)
  revalidateImport(parsed.data.runId, imported.outcome === "imported")
  return { status: "success", result: imported }
}

export async function importProspectingCandidatesAction(input: {
  runId: string
  candidateIds: string[]
}): Promise<ImportBatchState> {
  const parsed = candidateBatchSchema.safeParse(input)
  if (
    !parsed.success ||
    new Set(parsed.data.candidateIds).size !== parsed.data.candidateIds.length
  ) {
    return { status: "error", message: "Seleção de candidatos inválida." }
  }
  const { user } = await requireCommercialMember()
  const supabase = await createClient()
  const results: ImportCandidateResult[] = []
  for (const candidateId of parsed.data.candidateIds) {
    try {
      results.push(
        await importOne(supabase, user.id, {
          runId: parsed.data.runId,
          candidateId,
        }),
      )
    } catch {
      results.push(
        result(candidateId, "error", {
          message: "Não foi possível importar este candidato.",
        }),
      )
    }
  }
  revalidateImport(
    parsed.data.runId,
    results.some((item) => item.outcome === "imported"),
  )
  return { status: "success", results }
}
