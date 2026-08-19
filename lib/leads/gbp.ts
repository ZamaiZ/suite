import { hasAnyRole, type AppRole } from "@/lib/auth/roles"
import type { LeadDigitalChannel } from "@/lib/leads/digital-channels"
import {
  GBP_CID_MAX,
  GBP_FEW_PHOTOS,
  GBP_THIN_DESCRIPTION,
  readGbpEnrichment,
  type GbpEnrichment,
} from "@/lib/leads/gbp-enrichment"
import {
  GBP_STALE_POSTS_DAYS,
  GBP_WEAK_REVIEW_REPLY_RATIO,
  readGbpJobs,
  readGbpPosts,
  readGbpQna,
  readGbpRankChecks,
  readGbpRankKeywords,
  readGbpReviews,
  type GbpJob,
  type GbpPost,
  type GbpQna,
  type GbpRankCheck,
  type GbpReviewSummary,
} from "@/lib/leads/gbp-audit"
import { normalizeWebsiteDomain } from "@/lib/leads/website"
import type { PlacesPlace } from "@/lib/places"

export type { GbpEnrichment }

export const GBP_NOTES_MAX = 2000
export const GBP_LOW_RATING = 4
export const GBP_FEW_REVIEWS = 10
export const GBP_PHOTO_API_MAX = 10

export const GBP_EDIT_ROLES = [
  "analyst",
  "commercial_manager",
  "admin",
] as const satisfies readonly AppRole[]

export const GBP_GAP_IDS = [
  "name_mismatch",
  "missing_website",
  "website_unmatched",
  "missing_hours",
  "no_photos",
  "low_rating",
  "few_reviews",
  "closed",
  "no_secondary_categories",
  "few_photos",
  "missing_description",
  "thin_description",
  "no_services",
  "unclaimed",
  "no_posts",
  "stale_posts",
  "weak_review_replies",
  "not_in_map_top3",
] as const

export type GbpGapId = (typeof GBP_GAP_IDS)[number]

export const GBP_GAP_LABELS: Record<GbpGapId, string> = {
  name_mismatch: "Nome diferente do cadastro",
  missing_website: "Perfil sem site",
  website_unmatched: "Site do perfil não está no cadastro",
  missing_hours: "Horário não informado",
  no_photos: "Sem fotos na API",
  low_rating: "Nota abaixo de 4",
  few_reviews: "Menos de 10 avaliações",
  closed: "Marcado como fechado",
  no_secondary_categories: "Sem categorias secundárias",
  few_photos: "Menos de 10 fotos",
  missing_description: "Sem descrição",
  thin_description: "Descrição curta",
  no_services: "Sem serviços",
  unclaimed: "Perfil não reivindicado",
  no_posts: "Sem postagens",
  stale_posts: "Última postagem há mais de 90 dias",
  weak_review_replies: "Menos de 80% das avaliações recentes respondidas",
  not_in_map_top3: "Fora do top 3 no Maps",
}

export type GbpSnapshot = {
  placeId: string
  displayName: string | null
  formattedAddress: string | null
  primaryType: string | null
  primaryTypeDisplayName: string | null
  types: string[]
  businessStatus: string | null
  googleMapsUri: string | null
  nationalPhoneNumber: string | null
  websiteUri: string | null
  websiteDomain: string | null
  weekdayDescriptions: string[]
  rating: number | null
  userRatingCount: number | null
  photoCount: number
  photoNames: string[]
  latitude: number | null
  longitude: number | null
}

export type LeadGbpProfile = {
  id: string
  lead_id: string
  place_id: string
  is_primary: boolean
  sort_order: number
  google_maps_uri: string | null
  fetched_at: string
  fetched_by: string
  payload: GbpSnapshot
  matched_website_key: string | null
  notes: string | null
  cid: string | null
  enrichment: GbpEnrichment | null
  enrichment_at: string | null
  posts: GbpPost[] | null
  posts_at: string | null
  reviews: GbpReviewSummary | null
  reviews_at: string | null
  qna: GbpQna | null
  qna_at: string | null
  jobs: GbpJob[]
  rank_keywords: string[]
  rankChecks: GbpRankCheck[]
}

export type GbpWebsiteCoverage = {
  uncoveredWebsiteKeys: string[]
  unmatchedProfiles: string[]
}

function foldName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

export function websiteKeysFromChannels(
  channels: LeadDigitalChannel[],
): string[] {
  return channels
    .filter((channel) => channel.type === "website")
    .map((channel) => channel.normalized_key)
}

export function matchWebsiteKey(
  websiteDomain: string | null,
  websiteKeys: string[],
): string | null {
  if (!websiteDomain) return null
  return websiteKeys.includes(websiteDomain) ? websiteDomain : null
}

export function snapshotFromPlace(place: PlacesPlace): GbpSnapshot {
  return {
    placeId: place.id,
    displayName: place.displayName,
    formattedAddress: place.formattedAddress,
    primaryType: place.primaryType,
    primaryTypeDisplayName: place.primaryTypeDisplayName,
    types: place.types,
    businessStatus: place.businessStatus,
    googleMapsUri: place.googleMapsUri,
    nationalPhoneNumber: place.nationalPhoneNumber,
    websiteUri: place.websiteUri,
    websiteDomain: place.websiteUri
      ? normalizeWebsiteDomain(place.websiteUri)
      : null,
    weekdayDescriptions: place.weekdayDescriptions,
    rating: place.rating,
    userRatingCount: place.userRatingCount,
    photoCount: place.photoNames.length,
    photoNames: place.photoNames.slice(0, GBP_PHOTO_API_MAX),
    latitude: place.latitude,
    longitude: place.longitude,
  }
}

export function hasGbpCoordinates(snapshot: GbpSnapshot): boolean {
  return snapshot.latitude !== null && snapshot.longitude !== null
}

export function readGbpSnapshot(value: unknown): GbpSnapshot | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const placeId = asString(row.placeId)
  if (!placeId) return null
  const photoNames = asStringList(row.photoNames).slice(0, GBP_PHOTO_API_MAX)
  const photoCount = asNumber(row.photoCount)
  return {
    placeId,
    displayName: asString(row.displayName),
    formattedAddress: asString(row.formattedAddress),
    primaryType: asString(row.primaryType),
    primaryTypeDisplayName: asString(row.primaryTypeDisplayName),
    types: asStringList(row.types),
    businessStatus: asString(row.businessStatus),
    googleMapsUri: asString(row.googleMapsUri),
    nationalPhoneNumber: asString(row.nationalPhoneNumber),
    websiteUri: asString(row.websiteUri),
    websiteDomain: asString(row.websiteDomain),
    weekdayDescriptions: asStringList(row.weekdayDescriptions),
    rating: asNumber(row.rating),
    userRatingCount: asNumber(row.userRatingCount),
    photoCount: photoCount ?? photoNames.length,
    photoNames,
    latitude: asNumber(row.latitude),
    longitude: asNumber(row.longitude),
  }
}

export function gbpGapsForProfile(
  snapshot: GbpSnapshot,
  companyName: string,
  matchedWebsiteKey: string | null,
  enrichment?: GbpEnrichment | null,
  audit?: {
    posts: GbpPost[] | null
    postsReady: boolean
    reviews: GbpReviewSummary | null
    reviewsReady: boolean
    rankKeywords?: string[]
    rankChecks?: GbpRankCheck[]
  },
): GbpGapId[] {
  const gaps: GbpGapId[] = []
  const placeName = snapshot.displayName
  if (placeName && foldName(placeName) !== foldName(companyName)) {
    gaps.push("name_mismatch")
  }
  if (!snapshot.websiteUri) gaps.push("missing_website")
  else if (!matchedWebsiteKey) gaps.push("website_unmatched")
  if (snapshot.weekdayDescriptions.length === 0) gaps.push("missing_hours")
  if (!enrichment && snapshot.photoCount === 0) gaps.push("no_photos")
  if (snapshot.rating !== null && snapshot.rating < GBP_LOW_RATING) {
    gaps.push("low_rating")
  }
  if (
    snapshot.userRatingCount !== null &&
    snapshot.userRatingCount < GBP_FEW_REVIEWS
  ) {
    gaps.push("few_reviews")
  }
  if (snapshot.businessStatus?.startsWith("CLOSED")) gaps.push("closed")
  if (enrichment) {
    if (enrichment.additionalCategories.length === 0) {
      gaps.push("no_secondary_categories")
    }
    if (
      enrichment.source !== "serpapi" &&
      enrichment.totalPhotos !== null &&
      enrichment.totalPhotos < GBP_FEW_PHOTOS
    ) {
      gaps.push("few_photos")
    }
    if (!enrichment.description) gaps.push("missing_description")
    else if (enrichment.description.length < GBP_THIN_DESCRIPTION) {
      gaps.push("thin_description")
    }
    if (enrichment.source !== "serpapi" && enrichment.services.length === 0) {
      gaps.push("no_services")
    }
    if (enrichment.isClaimed === false) gaps.push("unclaimed")
  }
  if (audit?.postsReady) {
    const posts = audit.posts ?? []
    if (posts.length === 0) gaps.push("no_posts")
    else {
      const newest = posts.reduce<number | null>((latest, post) => {
        if (!post.publishedAt) return latest
        const ms = Date.parse(post.publishedAt)
        if (!Number.isFinite(ms)) return latest
        return latest === null || ms > latest ? ms : latest
      }, null)
      if (
        newest !== null &&
        Date.now() - newest > GBP_STALE_POSTS_DAYS * 24 * 60 * 60 * 1000
      ) {
        gaps.push("stale_posts")
      }
    }
  }
  if (
    audit?.reviewsReady &&
    audit.reviews &&
    audit.reviews.sampled > 0 &&
    audit.reviews.sortBy === "newest"
  ) {
    if (
      audit.reviews.replied / audit.reviews.sampled <
      GBP_WEAK_REVIEW_REPLY_RATIO
    ) {
      gaps.push("weak_review_replies")
    }
  }
  const rankKeywords = audit?.rankKeywords ?? []
  const rankChecks = audit?.rankChecks ?? []
  if (rankKeywords.length > 0 && rankChecks.length > 0) {
    const current = new Set(rankKeywords.map((keyword) => keyword.toLowerCase()))
    const relevant = rankChecks.filter((check) =>
      current.has(check.keyword.toLowerCase()),
    )
    if (
      relevant.length > 0 &&
      relevant.some(
        (check) => !check.in_top3 || check.maps_position === null,
      )
    ) {
      gaps.push("not_in_map_top3")
    }
  }
  return gaps
}

export function gbpWebsiteCoverage(
  websiteKeys: string[],
  profiles: Array<{ matched_website_key: string | null }>,
): GbpWebsiteCoverage {
  const covered = new Set(
    profiles
      .map((profile) => profile.matched_website_key)
      .filter((key): key is string => Boolean(key)),
  )
  return {
    uncoveredWebsiteKeys: websiteKeys.filter((key) => !covered.has(key)),
    unmatchedProfiles: profiles
      .filter((profile) => !profile.matched_website_key)
      .map((_, index) => String(index)),
  }
}

export function canEditLeadGbp(
  lead: {
    status: string
    assigned_sdr_id: string | null
    assigned_closer_id: string | null
  },
  userId: string,
  roles: readonly AppRole[],
): boolean {
  if (lead.status !== "interested") return false
  if (lead.assigned_sdr_id === userId) return true
  if (lead.assigned_closer_id === userId) return true
  return hasAnyRole(roles, GBP_EDIT_ROLES)
}

export function canListAllOpportunities(roles: readonly AppRole[]): boolean {
  return hasAnyRole(roles, GBP_EDIT_ROLES)
}

function asCid(value: unknown): string | null {
  const text = asString(value)
  if (!text || text.length > GBP_CID_MAX) return null
  return text
}

export function readLeadGbpProfileRow(
  row: Record<string, unknown>,
): LeadGbpProfile | null {
  const id = "id" in row ? row.id : null
  const lead_id = "lead_id" in row ? row.lead_id : null
  const place_id = "place_id" in row ? row.place_id : null
  const is_primary = "is_primary" in row ? row.is_primary : null
  const sort_order = "sort_order" in row ? row.sort_order : null
  const google_maps_uri =
    "google_maps_uri" in row ? row.google_maps_uri : null
  const fetched_at = "fetched_at" in row ? row.fetched_at : null
  const fetched_by = "fetched_by" in row ? row.fetched_by : null
  const payload = "payload" in row ? readGbpSnapshot(row.payload) : null
  const matched_website_key =
    "matched_website_key" in row ? row.matched_website_key : null
  const notes = "notes" in row ? row.notes : null
  if (typeof id !== "string" || typeof lead_id !== "string") return null
  if (typeof place_id !== "string") return null
  if (typeof is_primary !== "boolean" || typeof sort_order !== "number") {
    return null
  }
  if (typeof fetched_at !== "string" || typeof fetched_by !== "string") {
    return null
  }
  if (!payload) return null
  const enrichment = readGbpEnrichment(row.enrichment)
  const enrichment_at = enrichment
    ? (asString(row.enrichment_at) ?? enrichment.fetchedAt)
    : null
  const posts = readGbpPosts(row.posts)
  const reviews = readGbpReviews(row.reviews)
  const qna = readGbpQna(row.qna)
  return {
    id,
    lead_id,
    place_id,
    is_primary,
    sort_order,
    google_maps_uri: asString(google_maps_uri),
    fetched_at,
    fetched_by,
    payload,
    matched_website_key: asString(matched_website_key),
    notes: asString(notes),
    cid: asCid(row.cid),
    enrichment,
    enrichment_at,
    posts,
    posts_at: posts ? asString(row.posts_at) : null,
    reviews,
    reviews_at: reviews ? asString(row.reviews_at) : null,
    qna,
    qna_at: qna ? asString(row.qna_at) : null,
    jobs: readGbpJobs(row.lead_gbp_jobs),
    rank_keywords: readGbpRankKeywords(row.rank_keywords),
    rankChecks: readGbpRankChecks(row.lead_gbp_rank_checks),
  }
}

export function readLeadGbpProfiles(embed: unknown): LeadGbpProfile[] {
  if (!Array.isArray(embed)) return []
  const profiles: LeadGbpProfile[] = []
  const seen = new Set<string>()
  for (const row of embed) {
    if (!row || typeof row !== "object") continue
    const profile = readLeadGbpProfileRow(row as Record<string, unknown>)
    if (!profile || seen.has(profile.id)) continue
    seen.add(profile.id)
    profiles.push(profile)
  }
  profiles.sort((left, right) => {
    if (left.is_primary !== right.is_primary) return left.is_primary ? -1 : 1
    return left.sort_order - right.sort_order
  })
  return profiles
}
