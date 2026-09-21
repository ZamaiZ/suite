import "server-only"

import {
  DATAFORSEO_OK,
  DATAFORSEO_TASKS_PER_POST,
  dataForSeoEnvelopeCost,
  readTaskGetEnvelope,
  readTaskPostEnvelope,
  readTasksReadyEnvelope,
  type DataForSeoCreatedTask,
  type DataForSeoEnvelope,
  type DataForSeoReadyTask,
  type DataForSeoRejectedTask,
} from "./envelope"

const DATAFORSEO_BASE = "https://api.dataforseo.com/v3"
const REQUEST_TIMEOUT_MS = 20_000
/** Um `task_post` com 100 tarefas no corpo demora mais que uma busca só. */
const BATCH_TIMEOUT_MS = 30_000

export { DATAFORSEO_TASKS_PER_POST }
export type {
  DataForSeoCreatedTask,
  DataForSeoReadyTask,
  DataForSeoRejectedTask,
}

export const DATAFORSEO_UNCONFIGURED =
  "A análise do perfil não está configurada."
export const DATAFORSEO_VENDOR_ERROR =
  "Não foi possível analisar o perfil. Tente novamente."
export const DATAFORSEO_COLLECT_ERROR =
  "Não foi possível coletar os dados. Tente novamente."

/** `cost` vem em toda resposta e é o custo real em USD daquela chamada. */
export type DataForSeoResult<T> =
  | { status: "ok"; data: T; cost?: number }
  | {
      status: "error"
      message: string
      /**
       * `status_code` da tarefa, quando houve tarefa.
       *
       * Existe porque nem todo erro significa a mesma coisa para quem grava o
       * resultado. `50301` é o provedor de LLM fora do ar — execução que **não
       * aconteceu** — e `40501` é campo recusado, que é bug nosso de corpo. Os
       * dois devolvem HTTP 200 com `cost: 0`, então sem este código a sondagem
       * gravaria ausência inventada, de graça, sem nada no custo para
       * denunciar.
       */
      code?: number | null
      /** A mensagem do provedor, quando ela diz mais que a nossa. */
      vendorMessage?: string | null
    }

export type DataForSeoTaskGetResult<T> =
  | { status: "ok"; data: T | null; cost?: number }
  | { status: "pending" }
  | { status: "error"; message: string }

function credentials(): { login: string; password: string } | null {
  const login = process.env.DATAFORSEO_LOGIN?.trim()
  const password = process.env.DATAFORSEO_PASSWORD?.trim()
  if (!login || !password) return null
  return { login, password }
}

function authHeader(login: string, password: string): string {
  const encoded = Buffer.from(`${login}:${password}`, "utf8").toString("base64")
  return `Basic ${encoded}`
}

export function dataForSeoLocationCoordinate(
  latitude: number,
  longitude: number,
): string {
  return `${Number(latitude.toFixed(7))},${Number(longitude.toFixed(7))},200`
}

async function timedFetch(
  url: string,
  init: RequestInit,
  errorMessage: string,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<DataForSeoResult<Response>> {
  const auth = credentials()
  if (!auth) {
    return { status: "error", message: DATAFORSEO_UNCONFIGURED }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: {
        Authorization: authHeader(auth.login, auth.password),
        "Content-Type": "application/json; charset=utf-8",
        ...init.headers,
      },
      signal: controller.signal,
    })
    if (!response.ok) {
      return { status: "error", message: errorMessage }
    }
    return { status: "ok", data: response }
  } catch {
    return { status: "error", message: errorMessage }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Endpoint `live`: a resposta já traz o resultado. Tem o mesmo formato de um
 * `task_get` pronto, então usa o mesmo leitor — resultado ausente vira `null`,
 * como antes.
 *
 * `timeoutMs` existe porque nem todo `live` leva o mesmo tempo: uma busca no
 * Maps volta em segundos e uma execução de Lighthouse não. Sem o parâmetro, o
 * teto de 20s abortaria a segunda **sempre**, e o erro chegaria como falha de
 * rede — indistinguível de instabilidade do fornecedor.
 */
export async function postDataForSeo<T>(
  path: string,
  task: Record<string, unknown>,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<DataForSeoResult<T | null>> {
  const fetched = await timedFetch(
    `${DATAFORSEO_BASE}${path}`,
    { method: "POST", body: JSON.stringify([task]) },
    DATAFORSEO_VENDOR_ERROR,
    timeoutMs,
  )
  if (fetched.status === "error") return fetched

  try {
    const body = (await fetched.data.json()) as DataForSeoEnvelope<T>
    const read = readTaskGetEnvelope<T>(body, DATAFORSEO_VENDOR_ERROR)
    if (read.status === "ok") {
      return { status: "ok", data: read.data, cost: read.cost }
    }
    if (read.status === "empty") {
      return { status: "ok", data: null, cost: read.cost }
    }
    // `code` e `vendorMessage` sobem para quem precisa distinguir "o provedor
    // não respondeu" de "respondeu e não tem". Quem não precisa ignora.
    return {
      status: "error",
      message: DATAFORSEO_VENDOR_ERROR,
      code: read.status === "error" ? read.code : null,
      vendorMessage: read.status === "error" ? read.message : null,
    }
  } catch {
    return { status: "error", message: DATAFORSEO_VENDOR_ERROR }
  }
}

/** GET simples, para endpoints sem tarefa como `/appendix/user_data`. */
export async function getDataForSeo<T>(
  path: string,
  errorMessage = DATAFORSEO_VENDOR_ERROR,
): Promise<DataForSeoResult<T | null>> {
  const fetched = await timedFetch(
    `${DATAFORSEO_BASE}${path}`,
    { method: "GET" },
    errorMessage,
  )
  if (fetched.status === "error") return fetched

  try {
    const body = (await fetched.data.json()) as DataForSeoEnvelope<T>
    const read = readTaskGetEnvelope<T>(body, errorMessage)
    if (read.status === "ok") {
      return { status: "ok", data: read.data, cost: read.cost }
    }
    if (read.status === "empty") {
      return { status: "ok", data: null, cost: read.cost }
    }
    return { status: "error", message: errorMessage }
  } catch {
    return { status: "error", message: errorMessage }
  }
}

export async function postDataForSeoTask(
  path: string,
  task: Record<string, unknown>,
): Promise<DataForSeoResult<string>> {
  const fetched = await timedFetch(
    `${DATAFORSEO_BASE}${path}`,
    { method: "POST", body: JSON.stringify([task]) },
    DATAFORSEO_COLLECT_ERROR,
  )
  if (fetched.status === "error") return fetched

  try {
    const body = (await fetched.data.json()) as DataForSeoEnvelope<unknown>
    const read = readTaskPostEnvelope(body, DATAFORSEO_COLLECT_ERROR)
    if (read.status === "error") {
      return { status: "error", message: read.message }
    }
    const first = read.created[0]
    if (!first) return { status: "error", message: DATAFORSEO_COLLECT_ERROR }
    return { status: "ok", data: first.id, cost: read.cost }
  } catch {
    return { status: "error", message: DATAFORSEO_COLLECT_ERROR }
  }
}

export type DataForSeoBatchResult =
  | {
      status: "ok"
      created: DataForSeoCreatedTask[]
      /** Tarefas que a API recusou, com o código e a mensagem dela. */
      rejected: DataForSeoRejectedTask[]
      cost: number
    }
  | { status: "error"; message: string }

/**
 * Envio em lote. O `task_post` aceita até 100 tarefas por requisição — passar
 * disso é erro do chamador, e recortar em silêncio significaria jogar fora
 * buscas que ninguém saberia que faltaram.
 *
 * O `tag` de cada tarefa volta em `tasks[i].data.tag` e é o que correlaciona o
 * resultado com a origem; a posição na resposta é a correlação de reserva.
 */
export async function postDataForSeoTasks(
  path: string,
  tasks: ReadonlyArray<Record<string, unknown>>,
): Promise<DataForSeoBatchResult> {
  if (tasks.length === 0) {
    return { status: "ok", created: [], rejected: [], cost: 0 }
  }
  if (tasks.length > DATAFORSEO_TASKS_PER_POST) {
    return {
      status: "error",
      message: `O envio em lote aceita no máximo ${DATAFORSEO_TASKS_PER_POST} tarefas.`,
    }
  }

  const fetched = await timedFetch(
    `${DATAFORSEO_BASE}${path}`,
    { method: "POST", body: JSON.stringify(tasks) },
    DATAFORSEO_COLLECT_ERROR,
    BATCH_TIMEOUT_MS,
  )
  if (fetched.status === "error") return fetched

  try {
    const body = (await fetched.data.json()) as DataForSeoEnvelope<unknown>
    const read = readTaskPostEnvelope(body, DATAFORSEO_COLLECT_ERROR)
    if (read.status === "error") {
      return { status: "error", message: read.message }
    }
    return {
      status: "ok",
      created: read.created,
      rejected: read.rejected,
      cost: read.cost,
    }
  } catch {
    return { status: "error", message: DATAFORSEO_COLLECT_ERROR }
  }
}

export async function getDataForSeoTask<T>(
  path: string,
  taskId: string,
): Promise<DataForSeoTaskGetResult<T>> {
  const fetched = await timedFetch(
    `${DATAFORSEO_BASE}${path}/${encodeURIComponent(taskId)}`,
    { method: "GET" },
    DATAFORSEO_COLLECT_ERROR,
  )
  if (fetched.status === "error") return fetched

  try {
    const body = (await fetched.data.json()) as DataForSeoEnvelope<T>
    const read = readTaskGetEnvelope<T>(body, DATAFORSEO_COLLECT_ERROR)
    if (read.status === "pending") return { status: "pending" }
    if (read.status === "error") {
      return { status: "error", message: DATAFORSEO_COLLECT_ERROR }
    }
    // `empty` vira `data: null`: quem decide se ausência de resultado é falha é
    // o chamador, e os coletores de avaliações e postagens dependem disso.
    if (read.status === "empty") {
      return { status: "ok", data: null, cost: read.cost }
    }
    return { status: "ok", data: read.data, cost: read.cost }
  } catch {
    return { status: "error", message: DATAFORSEO_COLLECT_ERROR }
  }
}

/**
 * Lista as tarefas prontas e ainda não coletadas. Gratuito, mas limitado a 20
 * chamadas por minuto na conta inteira — por isso não entra no laço de coleta,
 * só no resgate de tarefas órfãs.
 */
export async function getDataForSeoTasksReady(
  path: string,
): Promise<DataForSeoResult<DataForSeoReadyTask[]>> {
  const fetched = await timedFetch(
    `${DATAFORSEO_BASE}${path}`,
    { method: "GET" },
    DATAFORSEO_COLLECT_ERROR,
  )
  if (fetched.status === "error") return fetched

  try {
    const body = (await fetched.data.json()) as DataForSeoEnvelope<
      Record<string, unknown>
    >
    const read = readTasksReadyEnvelope(body, DATAFORSEO_COLLECT_ERROR)
    if (read.status === "error") {
      return { status: "error", message: read.message }
    }
    return { status: "ok", data: read.tasks }
  } catch {
    return { status: "error", message: DATAFORSEO_COLLECT_ERROR }
  }
}

/**
 * GET cujo `result` é a **lista inteira**, e não um resultado único.
 *
 * Existe para `/serp/google/locations/BR`, que devolve as 5.311 localidades
 * dentro de `tasks[0].result`. `getDataForSeo` passa por `readTaskGetEnvelope`,
 * que lê `result[0]` — usá-lo aqui devolveria uma localidade só, em silêncio, e
 * a cidade do cliente nunca casaria.
 */
export async function getDataForSeoList<T>(
  path: string,
  errorMessage = DATAFORSEO_VENDOR_ERROR,
): Promise<DataForSeoResult<T[]>> {
  const fetched = await timedFetch(
    `${DATAFORSEO_BASE}${path}`,
    { method: "GET" },
    errorMessage,
    BATCH_TIMEOUT_MS,
  )
  if (fetched.status === "error") return fetched

  try {
    const body = (await fetched.data.json()) as DataForSeoEnvelope<T>
    if (body.status_code !== DATAFORSEO_OK) {
      return { status: "error", message: errorMessage }
    }
    const row = body.tasks?.[0]
    if (!row || row.status_code !== DATAFORSEO_OK) {
      return { status: "error", message: errorMessage }
    }
    return {
      status: "ok",
      data: Array.isArray(row.result) ? row.result : [],
      cost: dataForSeoEnvelopeCost(body),
    }
  } catch {
    return { status: "error", message: errorMessage }
  }
}
