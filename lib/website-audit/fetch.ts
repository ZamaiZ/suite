import { lookup } from "node:dns/promises"
import {
  WEBSITE_FETCH_MAX_BYTES,
  WEBSITE_FETCH_TIMEOUT_MS,
  WEBSITE_MAX_REDIRECTS,
} from "../leads/website-audit.ts"
import { pickSecurityHeaders } from "../leads/website-headers.ts"
import {
  isPrivateIp,
  parseHttpUrl,
  resolveRedirectUrl,
} from "./ssrf.ts"

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

export const WEBSITE_FETCH_FAILED =
  "Não foi possível acessar o site. Tente novamente."

export type SafeFetchOk = {
  status: "ok"
  url: string
  statusCode: number
  body: string
  contentType: string | null
  /** Headers selecionados por `pickSecurityHeaders`, em minusculas. */
  headers: Record<string, string>
}

export type SafeFetchResult =
  | SafeFetchOk
  | { status: "error"; message: string }

async function assertPublicHost(url: URL): Promise<string | null> {
  try {
    const records = await lookup(url.hostname, { all: true, verbatim: true })
    if (records.length === 0) return WEBSITE_FETCH_FAILED
    if (records.some((record) => isPrivateIp(record.address))) {
      return WEBSITE_FETCH_FAILED
    }
    return null
  } catch {
    return WEBSITE_FETCH_FAILED
  }
}

async function readBody(response: Response): Promise<string | null> {
  const length = response.headers.get("content-length")
  if (length && Number(length) > WEBSITE_FETCH_MAX_BYTES) return null
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength > WEBSITE_FETCH_MAX_BYTES) {
    return buffer.subarray(0, WEBSITE_FETCH_MAX_BYTES).toString("utf8")
  }
  return buffer.toString("utf8")
}

export async function safeFetch(
  input: string,
  method: "GET" | "HEAD" = "GET",
): Promise<SafeFetchResult> {
  let current = parseHttpUrl(input)
  if (!current) return { status: "error", message: WEBSITE_FETCH_FAILED }

  for (let hop = 0; hop <= WEBSITE_MAX_REDIRECTS; hop += 1) {
    const blocked = await assertPublicHost(current)
    if (blocked) return { status: "error", message: blocked }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), WEBSITE_FETCH_TIMEOUT_MS)
    try {
      const response = await fetch(current.toString(), {
        method,
        redirect: "manual",
        cache: "no-store",
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
          "User-Agent": USER_AGENT,
        },
        signal: controller.signal,
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location")
        if (!location) return { status: "error", message: WEBSITE_FETCH_FAILED }
        const next = resolveRedirectUrl(current, location)
        if (!next) return { status: "error", message: WEBSITE_FETCH_FAILED }
        current = next
        continue
      }

      if (method === "HEAD") {
        return {
          status: "ok",
          url: current.toString(),
          statusCode: response.status,
          body: "",
          contentType: response.headers.get("content-type"),
          headers: pickSecurityHeaders(response.headers),
        }
      }

      const body = await readBody(response)
      if (body === null) {
        return { status: "error", message: WEBSITE_FETCH_FAILED }
      }
      return {
        status: "ok",
        url: current.toString(),
        statusCode: response.status,
        body,
        contentType: response.headers.get("content-type"),
        headers: pickSecurityHeaders(response.headers),
      }
    } catch {
      return { status: "error", message: WEBSITE_FETCH_FAILED }
    } finally {
      clearTimeout(timer)
    }
  }

  return { status: "error", message: WEBSITE_FETCH_FAILED }
}

export async function safeFetchStatus(input: string): Promise<{
  url: string
  status: number | null
}> {
  const head = await safeFetch(input, "HEAD")
  if (head.status === "ok" && head.statusCode !== 405 && head.statusCode !== 501) {
    return { url: head.url, status: head.statusCode }
  }
  const get = await safeFetch(input, "GET")
  if (get.status === "ok") return { url: get.url, status: get.statusCode }
  return { url: input, status: null }
}
