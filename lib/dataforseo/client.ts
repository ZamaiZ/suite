import "server-only"

const DATAFORSEO_BASE = "https://api.dataforseo.com/v3"
const DATAFORSEO_OK = 20000
const DATAFORSEO_TASK_CREATED = 20100
const DATAFORSEO_TASK_PENDING = new Set([40601, 40602])
const REQUEST_TIMEOUT_MS = 20_000

export const DATAFORSEO_UNCONFIGURED =
  "A análise do perfil não está configurada."
export const DATAFORSEO_VENDOR_ERROR =
  "Não foi possível analisar o perfil. Tente novamente."
export const DATAFORSEO_COLLECT_ERROR =
  "Não foi possível coletar os dados. Tente novamente."

export type DataForSeoResult<T> =
  | { status: "ok"; data: T }
  | { status: "error"; message: string }

export type DataForSeoTaskGetResult<T> =
  | { status: "ok"; data: T | null }
  | { status: "pending" }
  | { status: "error"; message: string }

type DataForSeoEnvelope<T> = {
  status_code?: number
  tasks?: Array<{
    id?: string
    status_code?: number
    result?: T[] | null
  }>
}

function credentials(): { login: string; password: string } | null {
  const login = process.env.DATAFORSEO_LOGIN?.trim()
  const password = process.env.DATAFORSEO_PASSWORD?.trim()
  if (!login || !password) return null
  return { login, password }
}

function authHeader(login: string, password: string): string {
  return `Basic ${Buffer.from(`${login}:${password}`, "utf8").toString("base64")}`
}

export function dataForSeoLocationCoordinate(
  latitude: number,
  longitude: number,
): string {
  return `${Number(latitude.toFixed(7))},${Number(longitude.toFixed(7))},200`
}

export function dataForSeoMapsCoordinate(
  latitude: number,
  longitude: number,
): string {
  return `${Number(latitude.toFixed(7))},${Number(longitude.toFixed(7))},17z`
}

async function timedFetch(
  url: string,
  init: RequestInit,
  errorMessage: string,
): Promise<DataForSeoResult<Response>> {
  const auth = credentials()
  if (!auth) {
    return { status: "error", message: DATAFORSEO_UNCONFIGURED }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
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

export async function postDataForSeo<T>(
  path: string,
  task: Record<string, unknown>,
): Promise<DataForSeoResult<T | null>> {
  const fetched = await timedFetch(
    `${DATAFORSEO_BASE}${path}`,
    { method: "POST", body: JSON.stringify([task]) },
    DATAFORSEO_VENDOR_ERROR,
  )
  if (fetched.status === "error") return fetched

  try {
    const body = (await fetched.data.json()) as DataForSeoEnvelope<T>
    if (body.status_code !== DATAFORSEO_OK) {
      return { status: "error", message: DATAFORSEO_VENDOR_ERROR }
    }
    const taskRow = body.tasks?.[0]
    if (!taskRow || taskRow.status_code !== DATAFORSEO_OK) {
      return { status: "error", message: DATAFORSEO_VENDOR_ERROR }
    }
    return { status: "ok", data: taskRow.result?.[0] ?? null }
  } catch {
    return { status: "error", message: DATAFORSEO_VENDOR_ERROR }
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
    if (body.status_code !== DATAFORSEO_OK) {
      return { status: "error", message: DATAFORSEO_COLLECT_ERROR }
    }
    const taskRow = body.tasks?.[0]
    const taskId =
      typeof taskRow?.id === "string" && taskRow.id.trim().length > 0
        ? taskRow.id.trim()
        : null
    if (!taskRow || taskRow.status_code !== DATAFORSEO_TASK_CREATED || !taskId) {
      return { status: "error", message: DATAFORSEO_COLLECT_ERROR }
    }
    return { status: "ok", data: taskId }
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
    if (body.status_code !== DATAFORSEO_OK) {
      return { status: "error", message: DATAFORSEO_COLLECT_ERROR }
    }
    const taskRow = body.tasks?.[0]
    if (!taskRow) {
      return { status: "error", message: DATAFORSEO_COLLECT_ERROR }
    }
    if (
      typeof taskRow.status_code === "number" &&
      DATAFORSEO_TASK_PENDING.has(taskRow.status_code)
    ) {
      return { status: "pending" }
    }
    if (taskRow.status_code !== DATAFORSEO_OK) {
      return { status: "error", message: DATAFORSEO_COLLECT_ERROR }
    }
    return { status: "ok", data: taskRow.result?.[0] ?? null }
  } catch {
    return { status: "error", message: DATAFORSEO_COLLECT_ERROR }
  }
}
