import type { BrazilStateCode } from "@/lib/br-locations"
import type { MunicipalityGeometry } from "@/lib/prospecting/geometry"
import type {
  ProspectingPauseReason,
  ProspectingRunStatus,
} from "@/lib/prospecting/types"

export type ProspectingRunCollectionSnapshot = {
  id: string
  status: ProspectingRunStatus
  pauseReason: ProspectingPauseReason | null
  categories: string[]
  boundaryGeometry: MunicipalityGeometry
  city: string
  stateCode: BrazilStateCode
  latitude: number
  longitude: number
  radiusKm: number
  nextOffset: number
  offsetToken: string | null
  resultLimit: number
  fetchedCount: number
  totalCount: number | null
  budgetUsd: number
  actualCostUsd: number
  pricePerRequestUsd: number
  pricePerResultUsd: number
}

export type ProspectingCandidateFilter =
  | "available"
  | "ambiguous"
  | "duplicate"
  | "imported"
  | "ignored"

export type ProspectingCnpjStatus =
  | "not_searched"
  | "suggestion"
  | "needs_review"
  | "confirmed"
  | "not_found"

export type ProspectingCandidateListItem = {
  id: string
  placeId: string
  companyName: string | null
  primaryCategory: string | null
  address: string | null
  phone: string | null
  website: string | null
  websiteDomain: string | null
  rating: number | null
  reviewsCount: number | null
  vendorUpdatedAt: string | null
  territoryClass: "inside" | "outside" | "ambiguous"
  categoryClass: "exact" | "related" | "mismatch"
  reviewState: string
  conflictKind: string | null
  conflictSeverity: "block" | "warning" | null
  relatedLeadId: string | null
  importedLeadId: string | null
  checkUrl: string | null
  discoveryPosition: number
  cnpj: string | null
  cnpjStatus: ProspectingCnpjStatus
  cnpjLastAttemptAt: string | null
  cnpjConfirmedAt: string | null
  cnpjSourceUpdatedAt: string | null
}

export function isProspectingCnpjStatus(
  value: unknown,
): value is ProspectingCnpjStatus {
  return (
    value === "not_searched" ||
    value === "suggestion" ||
    value === "needs_review" ||
    value === "confirmed" ||
    value === "not_found"
  )
}

export type ProspectingCandidatePage = {
  items: ProspectingCandidateListItem[]
  page: number
  pageSize: number
  total: number
}

export type ProspectingRunSummary = {
  id: string
  segment: { id: string; name: string }
  city: string
  stateCode: BrazilStateCode
  status: ProspectingRunStatus
  pauseReason: ProspectingPauseReason | null
  totalCount: number | null
  fetchedCount: number
  acceptedCount: number
  ambiguousCount: number
  duplicateCount: number
  rejectedCount: number
  budgetUsd: number
  actualCostUsd: number
  createdAt: string
  updatedAt: string
}

export type ProspectingRunPage = {
  items: ProspectingRunSummary[]
  page: number
  pageSize: number
  total: number
}

export type ProspectingRunDetail = ProspectingRunSummary & {
  categories: string[]
  primaryCategory: string
  ibgeCode: string
  centerLatitude: number
  centerLongitude: number
  radiusKm: number
  nextOffset: number
  resultLimit: number
  estimatedCostUsd: number
  pricePerRequestUsd: number
  pricePerResultUsd: number
  errorMessage: string | null
  startedAt: string | null
  finishedAt: string | null
  hasUnknownCost: boolean
  canStart: boolean
  canPause: boolean
  canResume: boolean
  canCancel: boolean
}

export function isProspectingRunStatus(
  value: unknown,
): value is ProspectingRunStatus {
  return (
    value === "draft" ||
    value === "collecting" ||
    value === "paused" ||
    value === "completed" ||
    value === "failed" ||
    value === "cancelled"
  )
}

export function isProspectingPauseReason(
  value: unknown,
): value is ProspectingPauseReason {
  return (
    value === "user" ||
    value === "budget" ||
    value === "vendor_price_change"
  )
}
