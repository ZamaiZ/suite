import type { NormalizedProspectingCandidate } from "./types"

export type ProspectingCandidateRejectionCode =
  | "invalid_coordinates"
  | "invalid_rating"
  | "invalid_reviews_count"
  | "invalid_total_photos"
  | "company_name_too_long"

const POSTGRES_INTEGER_MAX = 2_147_483_647

export function validateNormalizedCandidate(
  candidate: NormalizedProspectingCandidate,
): ProspectingCandidateRejectionCode | null {
  const hasLatitude = candidate.latitude !== null
  const hasLongitude = candidate.longitude !== null
  if (hasLatitude !== hasLongitude) return "invalid_coordinates"
  if (
    (candidate.latitude !== null &&
      (candidate.latitude < -90 || candidate.latitude > 90)) ||
    (candidate.longitude !== null &&
      (candidate.longitude < -180 || candidate.longitude > 180))
  ) {
    return "invalid_coordinates"
  }

  if (
    candidate.rating !== null &&
    (candidate.rating < 0 || candidate.rating > 5)
  ) {
    return "invalid_rating"
  }

  if (
    candidate.reviewsCount !== null &&
    (!Number.isInteger(candidate.reviewsCount) ||
      candidate.reviewsCount < 0 ||
      candidate.reviewsCount > POSTGRES_INTEGER_MAX)
  ) {
    return "invalid_reviews_count"
  }

  if (
    candidate.totalPhotos !== null &&
    (!Number.isInteger(candidate.totalPhotos) ||
      candidate.totalPhotos < 0 ||
      candidate.totalPhotos > POSTGRES_INTEGER_MAX)
  ) {
    return "invalid_total_photos"
  }

  if (
    candidate.companyName !== null &&
    Array.from(candidate.companyName.trim()).length > 300
  ) {
    return "company_name_too_long"
  }

  return null
}
