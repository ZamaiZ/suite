import "server-only"

import {
  getDataForSeoTask,
  getDataForSeoTasksReady,
  postDataForSeo,
  postDataForSeoTasks,
  type DataForSeoCreatedTask,
  type DataForSeoReadyTask,
  type DataForSeoRejectedTask,
} from "@/lib/dataforseo/client"
import { googleMapsTask } from "@/lib/dataforseo/maps-task"
import {
  mapDataForSeoGridPoint,
  type GbpGridPointResult,
} from "@/lib/leads/gbp-audit"

const MAPS_LIVE_PATH = "/serp/google/maps/live/advanced"
const MAPS_TASK_POST_PATH = "/serp/google/maps/task_post"
const MAPS_TASK_GET_PATH = "/serp/google/maps/task_get/advanced"
const MAPS_TASKS_READY_PATH = "/serp/google/maps/tasks_ready"

const EMPTY_RESULT = "A busca voltou sem resultado para este ponto."

type MapsResult = Record<string, unknown>

export type GridPointFetchResult =
  | {
      status: "ok"
      point: GbpGridPointResult
      /** Resultado cru, para o ponto central alimentar o histórico avulso. */
      raw: MapsResult
      cost: number
    }
  | { status: "error"; message: string }

/** Modo live: resposta em segundos, usado nas malhas pequenas. */
export async function fetchGoogleMapsGridPoint(input: {
  keyword: string
  placeId: string
  latitude: number
  longitude: number
  zoom: number
}): Promise<GridPointFetchResult> {
  const posted = await postDataForSeo<MapsResult>(
    MAPS_LIVE_PATH,
    googleMapsTask(input),
  )
  if (posted.status === "error") return posted
  // Resposta sem resultado não é "o perfil não aparece": é coleta que não
  // aconteceu. Tratar como sucesso pintaria o ponto de vermelho para sempre.
  if (posted.data === null) {
    return { status: "error", message: EMPTY_RESULT }
  }
  return {
    status: "ok",
    point: mapDataForSeoGridPoint({
      placeId: input.placeId,
      result: posted.data,
    }),
    raw: posted.data,
    cost: posted.cost ?? 0,
  }
}

export type GridTaskInput = {
  tag: string
  keyword: string
  latitude: number
  longitude: number
  zoom: number
}

export type PostGridTasksResult =
  | {
      status: "ok"
      created: DataForSeoCreatedTask[]
      rejected: DataForSeoRejectedTask[]
      cost: number
    }
  | { status: "error"; message: string }

/**
 * Enfileira **um** lote de pontos. O `task_post` aceita 100 tarefas por
 * requisição, e o laço que antes emendava vários lotes numa chamada só escondia
 * uma falha no meio: o segundo lote quebrava, o primeiro já estava pago e nada
 * era gravado. Um lote por passada torna a gravação do que foi criado trivial.
 */
export async function postGoogleMapsGridTasks(
  points: readonly GridTaskInput[],
): Promise<PostGridTasksResult> {
  return postDataForSeoTasks(
    MAPS_TASK_POST_PATH,
    points.map((point) => googleMapsTask(point)),
  )
}

export type GridTaskGetResult =
  | {
      status: "ok"
      point: GbpGridPointResult
      raw: MapsResult
      cost: number
    }
  | { status: "pending" }
  | { status: "error"; message: string }

export async function getGoogleMapsGridTask(input: {
  taskId: string
  placeId: string
}): Promise<GridTaskGetResult> {
  const got = await getDataForSeoTask<MapsResult>(
    MAPS_TASK_GET_PATH,
    input.taskId,
  )
  if (got.status !== "ok") return got
  if (got.data === null) {
    return { status: "error", message: EMPTY_RESULT }
  }
  return {
    status: "ok",
    point: mapDataForSeoGridPoint({
      placeId: input.placeId,
      result: got.data,
    }),
    raw: got.data,
    cost: got.cost ?? 0,
  }
}

/**
 * Tarefas de Maps prontas e ainda não coletadas na conta. Serve só para readotar
 * tarefas órfãs — uma malha paga cujo identificador se perdeu antes de ser
 * gravado ainda aparece aqui por três dias, com o `tag` que diz de que ponto é.
 */
export async function readyGoogleMapsGridTasks(): Promise<
  | { status: "ok"; tasks: DataForSeoReadyTask[] }
  | { status: "error"; message: string }
> {
  const got = await getDataForSeoTasksReady(MAPS_TASKS_READY_PATH)
  if (got.status === "error") return got
  return { status: "ok", tasks: got.data }
}
