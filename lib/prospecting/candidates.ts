import { toStoredPhone } from "@/lib/br-documents"
import { gbpBusinessStatusFromDataForSeo } from "@/lib/leads/gbp-business-info-map"
import { normalizeWebsiteDomain } from "@/lib/leads/website"
import {
  pointInMunicipality,
  type MunicipalityGeometry,
} from "@/lib/prospecting/geometry"
import type {
  CandidateClassification,
  MissingCandidateIdentity,
  NormalizedAdditionalCategory,
  NormalizedProspectingCandidate,
} from "@/lib/prospecting/types"

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value.flatMap((item) => {
        const parsed = text(item)
        return parsed ? [parsed] : []
      }),
    ),
  ]
}

function additionalCategories(value: unknown): NormalizedAdditionalCategory[] {
  if (!Array.isArray(value)) return []
  const categories: NormalizedAdditionalCategory[] = []
  for (const item of value) {
    if (typeof item === "string") {
      const id = text(item)
      if (id) categories.push({ id, name: null })
      continue
    }
    const row = record(item)
    if (!row) continue
    const id = text(row.category_id) ?? text(row.id)
    const name = text(row.category) ?? text(row.name)
    if (id || name) categories.push({ id, name })
  }
  return categories
}

function timestamp(value: unknown): string | null {
  const parsed = text(value)
  if (!parsed) return null
  const date = new Date(parsed)
  return Number.isNaN(date.valueOf()) ? null : date.toISOString()
}

function normalizedPhone(value: unknown): string | null {
  const phone = text(value)
  if (!phone) return null
  return toStoredPhone(phone)
}

export function normalizeBusinessListing(
  value: Record<string, unknown>,
  observedAt: string,
): NormalizedProspectingCandidate | MissingCandidateIdentity {
  const placeId = text(value.place_id)
  if (!placeId) return { status: "rejected", reason: "missing_identity" }

  const website = text(value.url)
  const rating = record(value.rating)
  const workTime = record(value.work_time)
  return {
    placeId,
    cid: text(value.cid),
    featureId: text(value.feature_id),
    companyName: text(value.title),
    description: text(value.description),
    primaryCategory: text(value.category),
    categoryIds: stringList(value.category_ids),
    additionalCategories: additionalCategories(value.additional_categories),
    address: text(value.address),
    addressInfo: record(value.address_info),
    phone: normalizedPhone(value.phone),
    website,
    websiteDomain: website ? normalizeWebsiteDomain(website) : null,
    latitude: finite(value.latitude),
    longitude: finite(value.longitude),
    rating: finite(rating?.value),
    reviewsCount: finite(rating?.votes_count),
    isClaimed: typeof value.is_claimed === "boolean" ? value.is_claimed : null,
    businessStatus:
      gbpBusinessStatusFromDataForSeo(
        workTime?.current_status ?? value.business_status,
      ) ?? text(workTime?.current_status) ?? text(value.business_status),
    logoUrl: text(value.logo),
    mainImageUrl: text(value.main_image),
    totalPhotos: finite(value.total_photos),
    checkUrl: text(value.check_url),
    vendorFirstSeen: timestamp(value.first_seen),
    vendorUpdatedAt: timestamp(value.last_updated_time),
    observedAt,
  }
}

export function isPermanentlyClosedBusiness(status: string | null): boolean {
  if (!status) return false
  const normalized = status.trim().toLowerCase()
  return (
    normalized === "closed_forever" ||
    normalized === "permanently_closed" ||
    normalized === "closed_permanently"
  )
}

export function classifyCandidate(
  candidate: NormalizedProspectingCandidate,
  requestedCategories: readonly string[],
  geometry: MunicipalityGeometry,
): CandidateClassification {
  const requested = new Set(requestedCategories)
  const primaryId = candidate.categoryIds[0] ?? null
  const additionalIds = new Set([
    ...candidate.categoryIds.slice(1),
    ...candidate.additionalCategories.flatMap((category) =>
      category.id ? [category.id] : [],
    ),
  ])
  const category = primaryId && requested.has(primaryId)
    ? "exact"
    : [...additionalIds].some((id) => requested.has(id))
      ? "related"
      : "mismatch"

  const territory =
    candidate.latitude === null || candidate.longitude === null
      ? "ambiguous"
      : pointInMunicipality(geometry, {
          latitude: candidate.latitude,
          longitude: candidate.longitude,
        })
        ? "inside"
        : "outside"

  const blockedReason =
    territory === "outside"
      ? "outside_city"
      : territory === "ambiguous"
        ? "ambiguous_location"
        : category === "mismatch"
          ? "category_mismatch"
          : isPermanentlyClosedBusiness(candidate.businessStatus)
            ? "closed_forever"
            : !candidate.companyName
              ? "missing_name"
            : !candidate.phone && !candidate.websiteDomain
              ? "missing_contact"
              : null

  return {
    territory,
    category,
    importableFromDiscovery: blockedReason === null,
    blockedReason,
  }
}
