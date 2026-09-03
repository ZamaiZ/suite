import type { PlacesResult } from "@/lib/places/client"

export type GeocodeCoordinates = {
  latitude: number
  longitude: number
}

type PlaceLocation = { latitude?: number; longitude?: number }

type SearchTextPlaceJson = {
  location?: PlaceLocation
}

type SearchTextResponse = {
  places?: SearchTextPlaceJson[]
}

function placesApiKey(): string | null {
  const key = process.env.GOOGLE_PLACES_API_KEY
  return typeof key === "string" && key.trim().length > 0 ? key.trim() : null
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

async function readPlacesError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string; status?: string }
    }
    const status = body.error?.status
    if (status === "NOT_FOUND" || status === "NOT_FOUND_ERROR") {
      return "Endereço não encontrado."
    }
    if (status === "INVALID_ARGUMENT") {
      return "Não foi possível localizar o endereço."
    }
  } catch {
    return "Não foi possível consultar o Google. Tente novamente."
  }
  return "Não foi possível consultar o Google. Tente novamente."
}

export async function geocodeAddressText(
  address: string,
): Promise<PlacesResult<GeocodeCoordinates>> {
  const key = placesApiKey()
  if (!key) {
    return {
      status: "error",
      message: "A busca de endereços não está configurada.",
    }
  }

  const query = address.trim()
  if (query.length < 3) {
    return {
      status: "error",
      message: "Informe um endereço completo para localizar no mapa.",
    }
  }

  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.location",
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: "pt-BR",
        regionCode: "BR",
        maxResultCount: 1,
      }),
    },
  )

  if (!response.ok) {
    return { status: "error", message: await readPlacesError(response) }
  }

  const body = (await response.json()) as SearchTextResponse
  const places = Array.isArray(body.places) ? body.places : []
  for (const place of places) {
    const latitude = asNumber(place.location?.latitude)
    const longitude = asNumber(place.location?.longitude)
    if (latitude !== null && longitude !== null) {
      return { status: "ok", data: { latitude, longitude } }
    }
  }

  return {
    status: "error",
    message: "Não foi possível localizar este endereço no mapa.",
  }
}
