import "server-only"

/**
 * Cliente do LocationIQ.
 *
 * Existe porque o DataForSEO não tem produto de geocoding, de autocomplete de
 * endereço nem de tile — e os três são necessários para tirar a chave do Google
 * do produto.
 *
 * **São dois tokens, e a separação é nossa, não do fornecedor.** No painel os
 * dois são "Data API token" e a mesma credencial poderia fazer tudo. Este
 * arquivo usa o de servidor, com só `GEOCODING` marcado. O de tiles vive em
 * `NEXT_PUBLIC_LOCATIONIQ_MAPS_KEY`, tem só as permissões de mapa e é restrito
 * por referrer — ele fica visível no HTML, e uma credencial visível que também
 * geocodifica é uma conta aberta para quem passar por ali.
 */

import {
  addressFromLocationIq,
  LOCATIONIQ_SUGGEST_MIN_CHARS,
  type BriefingAddressCandidate,
} from "@/lib/locationiq/address"

const SEARCH = "https://us1.locationiq.com/v1/search"
const AUTOCOMPLETE = "https://api.locationiq.com/v1/autocomplete"
const TIMEOUT_MS = 8_000

export const LOCATIONIQ_UNCONFIGURED =
  "A busca de endereços não está configurada."
const FAILED = "Não foi possível consultar o endereço. Tente novamente."
export const LOCATIONIQ_NOT_FOUND =
  "Não foi possível localizar este endereço no mapa."

export type LocationIqResult<T> =
  { status: "ok"; data: T } | { status: "error"; message: string }

export type Coordinates = { latitude: number; longitude: number }

export function locationIqKey(): string | null {
  const key = process.env.LOCATIONIQ_API_KEY
  return typeof key === "string" && key.trim().length > 0 ? key.trim() : null
}

/**
 * O LocationIQ devolve `lat` e `lon` como **string**. `Number("")` é `0`, e
 * `0,0` é um ponto no Golfo da Guiné — por isso o vazio morre antes da
 * conversão, e não depois.
 */
export function asCoordinate(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value !== "string" || value.trim().length === 0) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function getLocationIq<T>(url: URL): Promise<LocationIqResult<T>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    })
    // 404 é o "não achei" do LocationIQ, não falha de rede.
    if (response.status === 404) {
      return { status: "error", message: LOCATIONIQ_NOT_FOUND }
    }
    if (!response.ok) return { status: "error", message: FAILED }
    return { status: "ok", data: (await response.json()) as T }
  } catch {
    return { status: "error", message: FAILED }
  } finally {
    clearTimeout(timer)
  }
}

export async function geocodeAddressText(
  address: string,
): Promise<LocationIqResult<Coordinates>> {
  const key = locationIqKey()
  if (!key) return { status: "error", message: LOCATIONIQ_UNCONFIGURED }

  const query = address.trim()
  if (query.length < 3) {
    return {
      status: "error",
      message: "Informe um endereço completo para localizar no mapa.",
    }
  }

  const url = new URL(SEARCH)
  url.searchParams.set("key", key)
  url.searchParams.set("q", query)
  url.searchParams.set("format", "json")
  url.searchParams.set("countrycodes", "br")
  url.searchParams.set("limit", "1")

  const result = await getLocationIq<unknown[]>(url)
  if (result.status === "error") return result

  const first = Array.isArray(result.data) ? result.data[0] : null
  if (!first || typeof first !== "object") {
    return { status: "error", message: LOCATIONIQ_NOT_FOUND }
  }
  const row = first as Record<string, unknown>
  const latitude = asCoordinate(row.lat)
  const longitude = asCoordinate(row.lon)
  if (latitude === null || longitude === null) {
    return { status: "error", message: LOCATIONIQ_NOT_FOUND }
  }

  return { status: "ok", data: { latitude, longitude } }
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

/**
 * Sugestão de endereço enquanto o cliente digita.
 *
 * **Uma chamada, não duas.** O Places exigia autocomplete e depois detalhes,
 * porque a sugestão vinha só com texto; aqui o endereço estruturado e a
 * coordenada vêm no mesmo resultado. Foi isso que matou o `applyBriefingPlace`.
 *
 * O typeahead **fica** aqui, ao contrário da busca de estabelecimento: este
 * endpoint é feito para isso e não custa por tecla.
 */
export async function autocompleteAddresses(
  query: string,
): Promise<LocationIqResult<BriefingAddressCandidate[]>> {
  const key = locationIqKey()
  if (!key) return { status: "error", message: LOCATIONIQ_UNCONFIGURED }

  const trimmed = query.trim()
  if (trimmed.length < LOCATIONIQ_SUGGEST_MIN_CHARS) {
    return { status: "ok", data: [] }
  }

  const url = new URL(AUTOCOMPLETE)
  url.searchParams.set("key", key)
  url.searchParams.set("q", trimmed)
  url.searchParams.set("countrycodes", "br")
  url.searchParams.set("limit", "8")
  url.searchParams.set("normalizecity", "1")
  url.searchParams.set("accept-language", "pt")

  const result = await getLocationIq<unknown[]>(url)
  if (result.status === "error") {
    // Consulta sem resultado não é erro de busca: é lista vazia. O fornecedor
    // responde 404 para isso, e `getLocationIq` já o traduziu em mensagem.
    return result.message === LOCATIONIQ_NOT_FOUND
      ? { status: "ok", data: [] }
      : result
  }

  const rows = Array.isArray(result.data) ? result.data : []
  const candidates = rows.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return []
    const row = entry as Record<string, unknown>
    const id = asText(row.place_id) ?? asText(row.osm_id)
    const latitude = asCoordinate(row.lat)
    const longitude = asCoordinate(row.lon)
    const label = asText(row.display_place) ?? asText(row.display_name)
    if (!id || latitude === null || longitude === null || !label) return []
    return [
      {
        id,
        label,
        secondary: asText(row.display_address),
        latitude,
        longitude,
        address: addressFromLocationIq(row.address),
      },
    ]
  })

  return { status: "ok", data: candidates }
}
