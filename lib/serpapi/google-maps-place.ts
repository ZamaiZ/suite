import "server-only"

import {
  GBP_CID_MAX,
  type GbpEnrichment,
  type GbpPeopleAlsoSearch,
  type GbpRatingDistribution,
} from "@/lib/leads/gbp-enrichment"
import {
  dataForSeoTimeToIso,
  type GbpPost,
  type GbpQna,
  type GbpQnaItem,
  type GbpReviewSampleItem,
  type GbpReviewSummary,
} from "@/lib/leads/gbp-audit"
import { getSerpApiJson } from "./client"

const NOT_FOUND = "Não foi possível encontrar este perfil no Google."

export type SerpApiPlacePack = {
  enrichment: GbpEnrichment
  posts: GbpPost[] | null
  reviews: GbpReviewSummary | null
  qna: GbpQna | null
}

export type FetchSerpApiPlacePackResult =
  | { status: "ok"; pack: SerpApiPlacePack }
  | { status: "not_found"; message: string }
  | { status: "error"; message: string }

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asCid(value: unknown): string | null {
  const text = asString(value)
  if (!text || text.length > GBP_CID_MAX) return null
  return text
}

function cidFromDataId(dataId: string | null): string | null {
  if (!dataId) return null
  const hex = dataId.split(":")[1]?.trim()
  if (!hex) return null
  try {
    const digits = BigInt(hex).toString(10)
    if (digits.length > GBP_CID_MAX) return null
    return digits
  } catch {
    return null
  }
}

function asIsoTimestamp(value: unknown): string | null {
  const fromDfs = dataForSeoTimeToIso(value)
  if (fromDfs) return fromDfs
  const text = asString(value)
  if (!text) return null
  const folded = text.toLowerCase()
  if (folded.includes("ago") || folded.includes("há ")) return null
  const ms = Date.parse(text)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}

function readDescription(value: unknown): string | null {
  const direct = asString(value)
  if (direct) return direct
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  return asString(row.snippet)
}

function readTypes(value: unknown): string[] {
  if (typeof value === "string") {
    const text = value.trim()
    return text ? [text] : []
  }
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const text = asString(item)
    return text ? [text] : []
  })
}

function readRatingDistribution(value: unknown): GbpRatingDistribution | null {
  if (!Array.isArray(value)) return null
  const result: GbpRatingDistribution = {
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
  }
  let seen = false
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const stars = asNumber(row.stars)
    const amount = asNumber(row.amount)
    if (stars === null || amount === null) continue
    const key = String(Math.trunc(stars))
    if (key !== "1" && key !== "2" && key !== "3" && key !== "4" && key !== "5") {
      continue
    }
    result[key] = Math.max(0, Math.trunc(amount))
    seen = true
  }
  return seen ? result : null
}

function readPeopleAlsoSearch(value: unknown): GbpPeopleAlsoSearch[] {
  if (!Array.isArray(value)) return []
  const items: GbpPeopleAlsoSearch[] = []
  const seen = new Set<string>()
  for (const group of value) {
    if (!group || typeof group !== "object") continue
    const row = group as Record<string, unknown>
    const local = Array.isArray(row.local_results) ? row.local_results : []
    for (const place of local) {
      if (!place || typeof place !== "object") continue
      const item = place as Record<string, unknown>
      const title = asString(item.title)
      if (!title || seen.has(title)) continue
      seen.add(title)
      items.push({
        title,
        cid: asCid(item.data_cid) ?? cidFromDataId(asString(item.data_id)),
      })
    }
  }
  return items
}

function readMainImageUrl(place: Record<string, unknown>): string | null {
  const thumbnail = asString(place.thumbnail)
  if (thumbnail) return thumbnail
  if (!Array.isArray(place.images)) return null
  for (const image of place.images) {
    if (!image || typeof image !== "object") continue
    const url = asString((image as Record<string, unknown>).thumbnail)
    if (url) return url
  }
  return null
}

function mapPosts(value: unknown): GbpPost[] | null {
  if (value === undefined) return null
  if (!Array.isArray(value)) return null
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    const text = asString(row.description) ?? asString(row.title)
    const publishedAt =
      asIsoTimestamp(row.posted_at) ?? asIsoTimestamp(row.date)
    const url = asString(row.post_link) ?? asString(row.link)
    const imageUrl =
      asString(row.media) ??
      (Array.isArray(row.thumbnails) ? asString(row.thumbnails[0]) : null)
    if (!text && !publishedAt && !url && !imageUrl) return []
    return [{ text, publishedAt, url, imageUrl }]
  })
}

function mapReviews(value: unknown): GbpReviewSummary | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  if (!Array.isArray(row.most_relevant)) return null
  const items: GbpReviewSampleItem[] = []
  for (const item of row.most_relevant) {
    if (!item || typeof item !== "object") continue
    const review = item as Record<string, unknown>
    items.push({
      rating: asNumber(review.rating),
      text: asString(review.description),
      publishedAt:
        asIsoTimestamp(review.date_iso8601) ?? asIsoTimestamp(review.date),
      ownerAnswer: null,
    })
  }
  if (items.length === 0) return null
  return {
    sampled: items.length,
    replied: 0,
    unrepliedLowRating: 0,
    sortBy: "relevant",
    items,
  }
}

function mapQna(
  value: unknown,
  establishmentTitle: string | null,
): GbpQna | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const items: GbpQnaItem[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") continue
    const row = item as Record<string, unknown>
    const questionRow =
      row.question && typeof row.question === "object"
        ? (row.question as Record<string, unknown>)
        : null
    const question = questionRow ? asString(questionRow.text) : null
    if (!question) continue
    const answerRow =
      row.answer && typeof row.answer === "object"
        ? (row.answer as Record<string, unknown>)
        : null
    const answerText = answerRow ? asString(answerRow.text) : null
    const answerUser =
      answerRow && answerRow.user && typeof answerRow.user === "object"
        ? asString((answerRow.user as Record<string, unknown>).name)
        : null
    const title = establishmentTitle?.trim().toLowerCase() ?? null
    const answers = answerText
      ? [
          {
            text: answerText,
            isOwner: Boolean(
              answerUser && title && answerUser.trim().toLowerCase() === title,
            ),
          },
        ]
      : []
    items.push({
      question,
      askedAt: questionRow ? asIsoTimestamp(questionRow.date) : null,
      answers,
    })
  }
  if (items.length === 0) return null
  const unansweredCount = items.filter((item) => item.answers.length === 0).length
  return {
    questionCount: items.length,
    unansweredCount,
    items,
  }
}

function mapPlacePack(
  body: Record<string, unknown>,
  fetchedAt: string,
  establishmentTitle: string | null,
): SerpApiPlacePack | null {
  const place = body.place_results
  if (!place || typeof place !== "object") return null
  const row = place as Record<string, unknown>
  const types = readTypes(row.type)
  const dataId = asString(row.data_id)
  const metadata =
    body.search_metadata && typeof body.search_metadata === "object"
      ? (body.search_metadata as Record<string, unknown>)
      : null
  const enrichment: GbpEnrichment = {
    source: "serpapi",
    fetchedAt,
    cid: asCid(row.data_cid) ?? cidFromDataId(dataId),
    dataId,
    isClaimed: row.unclaimed_listing === true ? false : null,
    description: readDescription(row.description),
    category: types[0] ?? null,
    additionalCategories: types.slice(1),
    totalPhotos: null,
    mainImageUrl: readMainImageUrl(row),
    services: [],
    ratingDistribution: readRatingDistribution(row.rating_summary),
    peopleAlsoSearch: readPeopleAlsoSearch(row.people_also_search_for),
    checkUrl:
      asString(row.place_id_search) ??
      (metadata ? asString(metadata.google_maps_url) : null),
  }
  return {
    enrichment,
    posts: mapPosts(row.posts),
    reviews: mapReviews(row.user_reviews),
    qna: mapQna(row.questions_and_answers, establishmentTitle),
  }
}

export async function fetchSerpApiPlacePack(input: {
  placeId: string
  establishmentTitle: string | null
}): Promise<FetchSerpApiPlacePackResult> {
  const fetched = await getSerpApiJson({
    engine: "google_maps",
    place_id: input.placeId,
  })
  if (fetched.status === "error") return fetched
  const pack = mapPlacePack(
    fetched.data,
    new Date().toISOString(),
    input.establishmentTitle,
  )
  if (!pack) {
    return { status: "not_found", message: NOT_FOUND }
  }
  return { status: "ok", pack }
}
