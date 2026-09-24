import type { SupabaseClient } from "@supabase/supabase-js"
import type { NormalizedProspectingCandidate } from "@/lib/prospecting/types"

export type ProspectingConflictKind =
  | "prospecting_place_id"
  | "gbp_place_id"
  | "domain"
  | "phone_company_city"
  | "shared_phone"

export type ProspectingConflict = {
  kind: ProspectingConflictKind
  severity: "block" | "warning"
  relatedLeadId: string
}

type CandidateConflictInput = Pick<
  NormalizedProspectingCandidate,
  "placeId" | "websiteDomain" | "phone" | "companyName"
>

type LeadIdentityRow = {
  id: string
  company_name: string
  city: string | null
  phone: string | null
  website_domain?: string | null
}

type ChunkQueryError = {
  code: string
  message: string
  details: string
  hint: string
}

type ChunkQueryResult<T> = {
  data: T[] | null
  error: ChunkQueryError | null
}

const MAX_ENCODED_IN_FILTER_LENGTH = 3500

function inFilterChunks(values: readonly string[]): string[][] {
  const chunks: string[][] = []
  let current: string[] = []
  let currentValuesLength = 0
  const fixedFilterLength = "in.%28%29".length

  for (const value of values) {
    const encodedValueLength =
      new URLSearchParams({ value: `"${value}"` }).toString().length -
      "value=".length
    const separatorLength = current.length > 0 ? "%2C".length : 0
    const nextFilterLength =
      fixedFilterLength + currentValuesLength + separatorLength + encodedValueLength

    if (
      current.length > 0 &&
      nextFilterLength > MAX_ENCODED_IN_FILTER_LENGTH
    ) {
      chunks.push(current)
      current = []
      currentValuesLength = 0
    }

    if (current.length > 0) currentValuesLength += "%2C".length
    current.push(value)
    currentValuesLength += encodedValueLength
  }

  if (current.length > 0) chunks.push(current)
  return chunks
}

async function queryInChunks<T>(
  values: readonly string[],
  query: (chunk: string[]) => PromiseLike<ChunkQueryResult<T>>,
): Promise<ChunkQueryResult<T>> {
  const rows: T[] = []
  for (const chunk of inFilterChunks(values)) {
    const result = await query(chunk)
    if (result.error) return { data: null, error: result.error }
    rows.push(...(result.data ?? []))
  }
  return { data: rows, error: null }
}

function fold(value: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase()
    .trim()
}

function unique(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

export async function findProspectingConflicts(
  supabase: SupabaseClient,
  candidates: readonly CandidateConflictInput[],
  city: string,
): Promise<Map<string, ProspectingConflict>> {
  const conflicts = new Map<string, ProspectingConflict>()
  if (candidates.length === 0) return conflicts

  const placeIds = unique(candidates.map((candidate) => candidate.placeId))
  const domains = unique(
    candidates.map((candidate) => candidate.websiteDomain),
  )
  const phones = unique(candidates.map((candidate) => candidate.phone))

  const [
    importedCandidates,
    gbpProfiles,
    directDomains,
    channelDomains,
    phoneLeads,
  ] = await Promise.all([
    queryInChunks<{ place_id: string; imported_lead_id: string | null }>(
      placeIds,
      (chunk) =>
        supabase
          .from("prospecting_candidates")
          .select("place_id, imported_lead_id")
          .in("place_id", chunk)
          .not("imported_lead_id", "is", null),
    ),
    queryInChunks<{ place_id: string | null; lead_id: string }>(
      placeIds,
      (chunk) =>
        supabase
          .from("lead_gbp_profiles")
          .select("place_id, lead_id")
          .in("place_id", chunk),
    ),
    queryInChunks<{ id: string; website_domain: string | null }>(
      domains,
      (chunk) =>
        supabase
          .from("leads")
          .select("id, website_domain")
          .in("website_domain", chunk),
    ),
    queryInChunks<{ lead_id: string; normalized_key: string }>(
      domains,
      (chunk) =>
        supabase
          .from("lead_digital_channels")
          .select("lead_id, normalized_key")
          .eq("type", "website")
          .in("normalized_key", chunk),
    ),
    queryInChunks<{
      id: string
      company_name: string
      city: string | null
      phone: string | null
    }>(
      phones,
      (chunk) =>
        supabase
          .from("leads")
          .select("id, company_name, city, phone")
          .in("phone", chunk),
    ),
  ])

  const firstError = [
    importedCandidates.error,
    gbpProfiles.error,
    directDomains.error,
    channelDomains.error,
    phoneLeads.error,
  ].find(Boolean)
  if (firstError) {
    throw new Error("Unable to inspect prospecting conflicts.", {
      cause: firstError,
    })
  }

  const importedByPlace = new Map<string, string>()
  for (const row of importedCandidates.data ?? []) {
    if (
      typeof row.place_id === "string" &&
      typeof row.imported_lead_id === "string"
    ) {
      importedByPlace.set(row.place_id, row.imported_lead_id)
    }
  }
  const gbpByPlace = new Map<string, string>()
  for (const row of gbpProfiles.data ?? []) {
    if (typeof row.place_id === "string" && typeof row.lead_id === "string") {
      gbpByPlace.set(row.place_id, row.lead_id)
    }
  }
  const leadByDomain = new Map<string, string>()
  for (const row of directDomains.data ?? []) {
    if (
      typeof row.website_domain === "string" &&
      typeof row.id === "string"
    ) {
      leadByDomain.set(row.website_domain, row.id)
    }
  }
  for (const row of channelDomains.data ?? []) {
    if (
      typeof row.normalized_key === "string" &&
      typeof row.lead_id === "string" &&
      !leadByDomain.has(row.normalized_key)
    ) {
      leadByDomain.set(row.normalized_key, row.lead_id)
    }
  }
  const leadsByPhone = new Map<string, LeadIdentityRow[]>()
  for (const raw of phoneLeads.data ?? []) {
    if (
      typeof raw.id !== "string" ||
      typeof raw.company_name !== "string" ||
      typeof raw.phone !== "string"
    ) {
      continue
    }
    const list = leadsByPhone.get(raw.phone) ?? []
    list.push({
      id: raw.id,
      company_name: raw.company_name,
      city: typeof raw.city === "string" ? raw.city : null,
      phone: raw.phone,
    })
    leadsByPhone.set(raw.phone, list)
  }

  for (const candidate of candidates) {
    const importedLeadId = importedByPlace.get(candidate.placeId)
    if (importedLeadId) {
      conflicts.set(candidate.placeId, {
        kind: "prospecting_place_id",
        severity: "block",
        relatedLeadId: importedLeadId,
      })
      continue
    }
    const gbpLeadId = gbpByPlace.get(candidate.placeId)
    if (gbpLeadId) {
      conflicts.set(candidate.placeId, {
        kind: "gbp_place_id",
        severity: "block",
        relatedLeadId: gbpLeadId,
      })
      continue
    }
    const domainLeadId = candidate.websiteDomain
      ? leadByDomain.get(candidate.websiteDomain)
      : null
    if (domainLeadId) {
      conflicts.set(candidate.placeId, {
        kind: "domain",
        severity: "block",
        relatedLeadId: domainLeadId,
      })
      continue
    }
    const samePhone = candidate.phone
      ? (leadsByPhone.get(candidate.phone) ?? [])
      : []
    const likelySameCompany = samePhone.find(
      (lead) =>
        candidate.companyName !== null &&
        fold(lead.company_name) === fold(candidate.companyName) &&
        fold(lead.city) === fold(city),
    )
    if (likelySameCompany) {
      conflicts.set(candidate.placeId, {
        kind: "phone_company_city",
        severity: "warning",
        relatedLeadId: likelySameCompany.id,
      })
      continue
    }
    const sharedPhone = samePhone[0]
    if (sharedPhone) {
      conflicts.set(candidate.placeId, {
        kind: "shared_phone",
        severity: "warning",
        relatedLeadId: sharedPhone.id,
      })
    }
  }
  return conflicts
}
