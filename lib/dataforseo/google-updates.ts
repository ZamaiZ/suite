import "server-only"

import {
  dataForSeoLocationCoordinate,
  getDataForSeoTask,
  postDataForSeoTask,
} from "@/lib/dataforseo/client"
import {
  GBP_UPDATES_DEPTH,
  mapDataForSeoPosts,
  type GbpPost,
} from "@/lib/leads/gbp-audit"

type UpdatesTaskResult = {
  items?: unknown
}

export async function postGoogleUpdatesTask(input: {
  placeId: string
  latitude: number
  longitude: number
}) {
  return postDataForSeoTask(
    "/business_data/google/my_business_updates/task_post",
    {
      language_code: "pt",
      keyword: `place_id:${input.placeId}`,
      location_coordinate: dataForSeoLocationCoordinate(
        input.latitude,
        input.longitude,
      ),
      depth: GBP_UPDATES_DEPTH,
    },
  )
}

export async function getGoogleUpdatesTask(taskId: string): Promise<
  | { status: "ok"; posts: GbpPost[] }
  | { status: "pending" }
  | { status: "error"; message: string }
> {
  const got = await getDataForSeoTask<UpdatesTaskResult>(
    "/business_data/google/my_business_updates/task_get",
    taskId,
  )
  if (got.status !== "ok") return got
  return {
    status: "ok",
    posts: mapDataForSeoPosts(got.data?.items),
  }
}
