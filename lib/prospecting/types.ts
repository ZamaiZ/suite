import type { MunicipalityGeometry } from "@/lib/prospecting/geometry"

export type ProspectingRunStatus =
  | "draft"
  | "collecting"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"

export type ProspectingPauseReason =
  | "user"
  | "budget"
  | "vendor_price_change"

export type TerritoryClass = "inside" | "outside" | "ambiguous"
export type CategoryClass = "exact" | "related" | "mismatch"

export type NormalizedAdditionalCategory = {
  id: string | null
  name: string | null
}

export type NormalizedProspectingCandidate = {
  placeId: string
  cid: string | null
  featureId: string | null
  companyName: string | null
  description: string | null
  primaryCategory: string | null
  categoryIds: string[]
  additionalCategories: NormalizedAdditionalCategory[]
  address: string | null
  addressInfo: Record<string, unknown> | null
  phone: string | null
  website: string | null
  websiteDomain: string | null
  latitude: number | null
  longitude: number | null
  rating: number | null
  reviewsCount: number | null
  isClaimed: boolean | null
  businessStatus: string | null
  logoUrl: string | null
  mainImageUrl: string | null
  totalPhotos: number | null
  checkUrl: string | null
  vendorFirstSeen: string | null
  vendorUpdatedAt: string | null
  observedAt: string
}

export type MissingCandidateIdentity = {
  status: "rejected"
  reason: "missing_identity"
}

export type CandidateClassification = {
  territory: TerritoryClass
  category: CategoryClass
  importableFromDiscovery: boolean
  blockedReason:
    | "outside_city"
    | "ambiguous_location"
    | "category_mismatch"
    | "closed_forever"
    | "missing_name"
    | "missing_contact"
    | null
}

export type ProspectingBoundarySnapshot = {
  geometry: MunicipalityGeometry
  latitude: number
  longitude: number
  radiusKm: number
}
