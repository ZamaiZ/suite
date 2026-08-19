import "server-only"

import { GBP_VENDOR_UNCONFIGURED, SERPAPI_QUOTA_EMPTY, SERPAPI_QUOTA_RANK } from "@/lib/gbp-vendor"

const SERPAPI_SEARCH = "https://serpapi.com/search.json"
const SERPAPI_ACCOUNT = "https://serpapi.com/account.json"
const REQUEST_TIMEOUT_MS = 20_000

export const SERPAPI_VENDOR_ERROR =
  "Não foi possível analisar o perfil. Tente novamente."
export const SERPAPI_RANK_ERROR =
  "Não foi possível checar o ranking. Tente novamente."

export async function requireSerpApiQuota(
  minSearches: number,
): Promise<SerpApiResult<true>> {
  const account = await getSerpApiAccount()
  if (account.status === "error") return account
  if (account.data.planSearchesLeft < minSearches) {
    return {
      status: "error",
      message: minSearches > 1 ? SERPAPI_QUOTA_RANK : SERPAPI_QUOTA_EMPTY,
    }
  }
  return { status: "ok", data: true }
}

export type SerpApiResult<T> =
  | { status: "ok"; data: T }
  | { status: "error"; message: string }

function apiKey(): string | null {
  const key = process.env.SERPAPI_API_KEY?.trim()
  return key ? key : null
}

async function timedGet(
  url: string,
  errorMessage: string,
): Promise<SerpApiResult<Response>> {
  if (!apiKey()) {
    return { status: "error", message: GBP_VENDOR_UNCONFIGURED }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
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

export async function getSerpApiJson(
  params: Record<string, string>,
  errorMessage = SERPAPI_VENDOR_ERROR,
): Promise<SerpApiResult<Record<string, unknown>>> {
  const key = apiKey()
  if (!key) {
    return { status: "error", message: GBP_VENDOR_UNCONFIGURED }
  }

  const search = new URL(SERPAPI_SEARCH)
  for (const [name, value] of Object.entries(params)) {
    search.searchParams.set(name, value)
  }
  search.searchParams.set("api_key", key)
  search.searchParams.set("hl", "pt")
  search.searchParams.set("gl", "br")
  search.searchParams.set("google_domain", "google.com.br")

  const fetched = await timedGet(search.toString(), errorMessage)
  if (fetched.status === "error") return fetched

  try {
    const body = (await fetched.data.json()) as unknown
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { status: "error", message: errorMessage }
    }
    const row = body as Record<string, unknown>
    const error = row.error
    if (typeof error === "string" && error.trim()) {
      return { status: "error", message: errorMessage }
    }
    return { status: "ok", data: row }
  } catch {
    return { status: "error", message: errorMessage }
  }
}

export async function getSerpApiAccount(): Promise<
  SerpApiResult<{
    planSearchesLeft: number
    searchesPerMonth: number
  }>
> {
  const key = apiKey()
  if (!key) {
    return { status: "error", message: GBP_VENDOR_UNCONFIGURED }
  }

  const url = new URL(SERPAPI_ACCOUNT)
  url.searchParams.set("api_key", key)
  const fetched = await timedGet(url.toString(), SERPAPI_VENDOR_ERROR)
  if (fetched.status === "error") return fetched

  try {
    const body = (await fetched.data.json()) as Record<string, unknown>
    const planSearchesLeft =
      typeof body.plan_searches_left === "number" &&
      Number.isFinite(body.plan_searches_left)
        ? Math.trunc(body.plan_searches_left)
        : typeof body.total_searches_left === "number" &&
            Number.isFinite(body.total_searches_left)
          ? Math.trunc(body.total_searches_left)
          : null
    const searchesPerMonth =
      typeof body.searches_per_month === "number" &&
      Number.isFinite(body.searches_per_month)
        ? Math.trunc(body.searches_per_month)
        : null
    if (planSearchesLeft === null || searchesPerMonth === null) {
      return { status: "error", message: SERPAPI_VENDOR_ERROR }
    }
    return {
      status: "ok",
      data: { planSearchesLeft, searchesPerMonth },
    }
  } catch {
    return { status: "error", message: SERPAPI_VENDOR_ERROR }
  }
}
