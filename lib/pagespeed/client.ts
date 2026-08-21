import "server-only"

import {
  extractWebsitePsiStrategy,
  PSI_FETCH_TIMEOUT_MS,
  type WebsitePsiStrategy,
  type WebsitePsiStrategyId,
} from "../leads/website-pagespeed.ts"

const PAGESPEED_ENDPOINT =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"

export const PAGESPEED_UNCONFIGURED =
  "A análise do PageSpeed não está configurada."
export const PAGESPEED_FORBIDDEN =
  "A API do PageSpeed Insights não está habilitada ou a chave não tem permissão."
export const PAGESPEED_FAILED =
  "Não foi possível obter o PageSpeed. Tente novamente."

export type PagespeedFetchResult =
  | { status: "ok"; strategy: WebsitePsiStrategy }
  | { status: "error"; message: string }

function apiKey(): string | null {
  const dedicated = process.env.PAGESPEED_API_KEY?.trim()
  if (dedicated) return dedicated
  const fallback = process.env.GOOGLE_PLACES_API_KEY?.trim()
  return fallback ? fallback : null
}

function errorMessage(status: number): string {
  if (status === 403 || status === 401) return PAGESPEED_FORBIDDEN
  if (status === 429) return PAGESPEED_FAILED
  return PAGESPEED_FAILED
}

export async function fetchPagespeedStrategy(
  url: string,
  strategy: WebsitePsiStrategyId,
): Promise<PagespeedFetchResult> {
  const key = apiKey()
  if (!key) {
    return { status: "error", message: PAGESPEED_UNCONFIGURED }
  }

  const endpoint = new URL(PAGESPEED_ENDPOINT)
  endpoint.searchParams.set("url", url)
  endpoint.searchParams.set("strategy", strategy)
  endpoint.searchParams.set("locale", "pt-BR")
  endpoint.searchParams.set("key", key)
  endpoint.searchParams.append("category", "performance")
  endpoint.searchParams.append("category", "accessibility")
  endpoint.searchParams.append("category", "best-practices")
  endpoint.searchParams.append("category", "seo")

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PSI_FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    })
    if (!response.ok) {
      return { status: "error", message: errorMessage(response.status) }
    }
    const payload: unknown = await response.json()
    const extracted = extractWebsitePsiStrategy(payload)
    if (!extracted) {
      return { status: "error", message: PAGESPEED_FAILED }
    }
    return { status: "ok", strategy: extracted }
  } catch {
    return { status: "error", message: PAGESPEED_FAILED }
  } finally {
    clearTimeout(timer)
  }
}
