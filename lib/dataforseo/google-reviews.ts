import "server-only"

import {
  dataForSeoLocationCoordinate,
  getDataForSeoTask,
  postDataForSeoTask,
} from "@/lib/dataforseo/client"
import {
  GBP_REVIEW_DEPTH,
  mapDataForSeoReviews,
  type GbpReviewSummary,
} from "@/lib/leads/gbp-audit"

/**
 * O resultado inteiro, não só `items`: `reviews_count` e `rating` moram neste
 * nível e são o total e a média do perfil medidos na mesma chamada da amostra.
 */
type ReviewsTaskResult = Record<string, unknown>

export async function postGoogleReviewsTask(input: {
  placeId: string
  latitude: number
  longitude: number
}) {
  return postDataForSeoTask("/business_data/google/reviews/task_post", {
    language_code: "pt",
    place_id: input.placeId,
    location_coordinate: dataForSeoLocationCoordinate(
      input.latitude,
      input.longitude,
    ),
    depth: GBP_REVIEW_DEPTH,
    sort_by: "newest",
  })
}

export async function getGoogleReviewsTask(
  taskId: string,
): Promise<
  | { status: "ok"; reviews: GbpReviewSummary }
  | { status: "pending" }
  | { status: "error"; message: string }
> {
  const got = await getDataForSeoTask<ReviewsTaskResult>(
    "/business_data/google/reviews/task_get",
    taskId,
  )
  if (got.status !== "ok") return got
  return {
    status: "ok",
    reviews: mapDataForSeoReviews(got.data),
  }
}
