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
import { latestGbpGridScan, type LeadGbpGridScan } from "@/lib/leads/gbp-grid"
import {
  gbpReputation,
  GBP_REPUTATION_DORMANT_DAYS,
} from "@/lib/leads/gbp-reputation"
import {
  gbpReputationDelta,
  type GbpReputationDelta,
} from "@/lib/leads/gbp-reputation-compare"
import {
  gbpDirectoriesInState,
  gbpReplyTimeIsSlow,
  readGbpAnalystReview,
  type GbpAnalystReview,
} from "@/lib/leads/gbp-analyst-review"
import {
  pickLatestGbpSnapshotRow,
  pickPreviousGbpSnapshotRow,
  type LeadGbpSnapshot,
} from "@/lib/leads/gbp-snapshot"
import { normalizeWebsiteDomain } from "@/lib/leads/website"
import type { PlacesPlace } from "@/lib/places"

export type { GbpEnrichment }

export const GBP_NOTES_MAX = 2000
export const GBP_LOW_RATING = 4
export const GBP_FEW_REVIEWS = 10
export const GBP_PHOTO_API_MAX = 10

/** Fração da amostra em poucos dias a partir da qual o achado existe. */
export const GBP_REVIEW_BURST_GAP_SHARE = 0.3

/** Abaixo disto a faixa de nota baixa é pequena demais para comparar taxas. */
export const GBP_REVIEW_BAND_MIN_COUNT = 2

/** Taxa da faixa baixa em relação à alta a partir da qual há descaso. */
export const GBP_REVIEW_BAND_GAP_RATIO = 0.5

/** Mediana de resposta acima disto, em dias, deixa de ser resposta oportuna. */
export const GBP_REPLY_SLOW_DAYS = 7

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
  "unanswered_questions",
  "unreplied_negative_reviews",
  "slow_review_replies",
  "missing_directory_listings",
  "directory_nap_mismatch",
  "review_burst",
  "latest_review_unanswered",
  "negative_replies_ignored",
  "dormant_reviews",
  "reviews_removed",
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
  unanswered_questions: "Perguntas sem resposta no perfil",
  unreplied_negative_reviews: "Avaliação negativa sem resposta",
  slow_review_replies: "Demora para responder avaliações",
  missing_directory_listings: "Ausente em diretórios locais",
  directory_nap_mismatch: "NAP divergente em diretórios",
  review_burst: "Avaliações concentradas em poucos dias",
  latest_review_unanswered: "Avaliação mais recente sem resposta",
  negative_replies_ignored: "Responde elogio e ignora crítica",
  dormant_reviews: "Sem avaliações novas há muito tempo",
  reviews_removed: "Avaliações desapareceram desde a última coleta",
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
  /** Leitura humana da reputação: sentimento, temas e o que os números não contam. */
  reputation_note: string | null
  /** Respostas estruturadas do analista: tempo de resposta e diretórios. */
  analyst_review: GbpAnalystReview
  /**
   * O que mudou desde a coleta anterior. Calculado na leitura, com o snapshot
   * penúltimo que já vem no mesmo embed — sem consulta nova.
   */
  reviews_delta: GbpReputationDelta
  cid: string | null
  enrichment: GbpEnrichment | null
  enrichment_at: string | null
  posts: GbpPost[] | null
  posts_at: string | null
  reviews: GbpReviewSummary | null
  reviews_at: string | null
  qna: GbpQna | null
  qna_at: string | null
  /** Snapshot append-only que originou os campos variaveis acima. */
  snapshot: LeadGbpSnapshot<GbpSnapshot> | null
  /** Malha geográfica mais recente deste perfil, quando houver. */
  gridScan: LeadGbpGridScan | null
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
    qna?: GbpQna | null
    rankKeywords?: string[]
    rankChecks?: GbpRankCheck[]
    /**
     * Obrigatórios de propósito: `gbpGapsForProfile` é montado em três
     * lugares — o pilar, o contador da trilha e a lista — e campo opcional
     * deixaria a divergência entre eles possível e silenciosa.
     */
    analystReview: GbpAnalystReview
    /** Referência de "hoje" para janelas e dormência. */
    today: string
    reviewsDelta: GbpReputationDelta
  },
): GbpGapId[] {
  const gaps: GbpGapId[] = []
  /** Mediana medida do tempo de resposta, quando a amostra a trouxer. */
  let measuredReplyMedianDays: number | null = null
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
    // `null` significa que a coleta não trouxe o campo — só lista vazia é gap.
    if (
      enrichment.source !== "serpapi" &&
      enrichment.services !== null &&
      enrichment.services.length === 0
    ) {
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
    // Negativa sem resposta ja era contada e gravada, mas nunca virava
    // oportunidade. Fica dormente no SerpAPI, que nao devolve owner_answer.
    if (audit.reviews.unrepliedLowRating > 0) {
      gaps.push("unreplied_negative_reviews")
    }

    // As contas da amostra. Cada uma exige que o insumo tenha vindo: métrica
    // nula é ausência de medida, não ausência de problema.
    const reputation = gbpReputation({
      reviews: audit.reviews,
      distribution: enrichment?.ratingDistribution ?? null,
      today: audit.today,
    })
    const sample = reputation?.sample ?? null

    if (sample?.burst && sample.burst.share >= GBP_REVIEW_BURST_GAP_SHARE) {
      gaps.push("review_burst")
    }
    if (sample?.latestUnanswered === true) {
      gaps.push("latest_review_unanswered")
    }
    if (
      sample?.daysSinceLast !== null &&
      sample?.daysSinceLast !== undefined &&
      sample.daysSinceLast > GBP_REPUTATION_DORMANT_DAYS
    ) {
      gaps.push("dormant_reviews")
    }

    // Responder elogio e ignorar crítica: a taxa geral esconde, a comparação
    // entre faixas mostra.
    measuredReplyMedianDays = sample?.replyMedianDays ?? null

    const high = sample?.replyByBand.find((band) => band.band === "high")
    const low = sample?.replyByBand.find((band) => band.band === "low")
    if (
      high?.replyRate != null &&
      low?.replyRate != null &&
      low.count >= GBP_REVIEW_BAND_MIN_COUNT &&
      low.replyRate <= high.replyRate * GBP_REVIEW_BAND_GAP_RATIO
    ) {
      gaps.push("negative_replies_ignored")
    }
  }

  if (
    audit?.reviewsDelta.status === "ok" &&
    audit.reviewsDelta.removed > 0
  ) {
    gaps.push("reviews_removed")
  }

  // Q&A ja era coletado e exibido nos dois provedores, mas nao chegava ao
  // roadmap nem ao PDF do diagnostico.
  if (audit?.qna && audit.qna.unansweredCount > 0) {
    gaps.push("unanswered_questions")
  }
  const rankKeywords = audit?.rankKeywords ?? []
  const rankChecks = audit?.rankChecks ?? []
  if (rankKeywords.length > 0 && rankChecks.length > 0) {
    const current = new Set(
      rankKeywords.map((keyword) => keyword.toLowerCase()),
    )
    const relevant = rankChecks.filter((check) =>
      current.has(check.keyword.toLowerCase()),
    )
    if (
      relevant.length > 0 &&
      relevant.some((check) => !check.in_top3 || check.maps_position === null)
    ) {
      gaps.push("not_in_map_top3")
    }
  }

  // Julgamento do analista. Sem resposta preenchida não há gap: campo em branco
  // é ausência de medida, não ausência de problema.
  const analystReview = audit?.analystReview
  if (analystReview) {
    // O medido manda; a faixa observada é reserva para perfil ainda sem
    // `owner_timestamp` na amostra. Duas fontes para o mesmo número precisam de
    // uma ordem, senão discordam sem ninguém saber qual seguir.
    if (measuredReplyMedianDays !== null) {
      if (measuredReplyMedianDays > GBP_REPLY_SLOW_DAYS) {
        gaps.push("slow_review_replies")
      }
    } else if (gbpReplyTimeIsSlow(analystReview)) {
      gaps.push("slow_review_replies")
    }
    if (gbpDirectoriesInState(analystReview, "absent").length > 0) {
      gaps.push("missing_directory_listings")
    }
    if (gbpDirectoriesInState(analystReview, "nap_mismatch").length > 0) {
      gaps.push("directory_nap_mismatch")
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
  const google_maps_uri = "google_maps_uri" in row ? row.google_maps_uri : null
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
  // Os dados variaveis vivem em lead_gbp_snapshots, append-only. O perfil
  // continua expondo os campos achatados para nao propagar a mudanca de
  // contrato por gaps, rail, diagnostico e componentes; eles passam a vir do
  // snapshot mais recente em vez de colunas mutaveis.
  const snapshotRow = pickLatestGbpSnapshotRow(row.lead_gbp_snapshots)
  const captured_at = snapshotRow ? asString(snapshotRow.captured_at) : null
  const enrichment = readGbpEnrichment(snapshotRow?.enrichment)
  const enrichment_at = enrichment
    ? (captured_at ?? enrichment.fetchedAt)
    : null
  const posts = readGbpPosts(snapshotRow?.posts)
  const reviews = readGbpReviews(snapshotRow?.reviews)
  // O anterior sai do mesmo embed: comparar duas coletas não custa consulta.
  const previousRow = pickPreviousGbpSnapshotRow(row.lead_gbp_snapshots)
  const reviews_delta = gbpReputationDelta({
    current: reviews,
    previous: readGbpReviews(previousRow?.reviews),
    previousAt: previousRow ? asString(previousRow.captured_at) : null,
  })
  const qna = readGbpQna(snapshotRow?.qna)
  const snapshot: LeadGbpSnapshot<GbpSnapshot> | null =
    snapshotRow && typeof snapshotRow.id === "string" && captured_at
      ? {
          id: snapshotRow.id,
          profile_id: id,
          captured_at,
          payload: readGbpSnapshot(snapshotRow.payload) ?? payload,
          enrichment,
          reviews,
          posts,
          qna,
        }
      : null
  return {
    snapshot,
    gridScan: latestGbpGridScan(row.lead_gbp_grid_scans),
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
    reputation_note: asString(row.reputation_note),
    reviews_delta,
    analyst_review: readGbpAnalystReview(row.analyst_review),
    cid: asCid(row.cid),
    enrichment,
    enrichment_at,
    posts,
    posts_at: posts ? captured_at : null,
    reviews,
    reviews_at: reviews ? captured_at : null,
    qna,
    qna_at: qna ? captured_at : null,
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
