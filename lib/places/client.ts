import { parsePlaceInput } from "@/lib/places/parse-input"

export const PLACES_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "addressComponents",
  "types",
  "primaryType",
  "primaryTypeDisplayName",
  "businessStatus",
  "googleMapsUri",
  "nationalPhoneNumber",
  "websiteUri",
  "regularOpeningHours",
  "rating",
  "userRatingCount",
  "photos",
  "location",
].join(",")

export const PLACES_SUGGEST_MIN_CHARS = 3

export type PlacesAutocompleteIntent = "establishment" | "address"

export type PlaceSuggestion = {
  placeId: string
  name: string
  address: string | null
}

export type PlaceAddressComponent = {
  longText: string
  shortText: string
  types: string[]
}

export type PlacesPlace = {
  id: string
  displayName: string | null
  formattedAddress: string | null
  addressComponents: PlaceAddressComponent[]
  types: string[]
  primaryType: string | null
  primaryTypeDisplayName: string | null
  businessStatus: string | null
  googleMapsUri: string | null
  nationalPhoneNumber: string | null
  websiteUri: string | null
  weekdayDescriptions: string[]
  rating: number | null
  userRatingCount: number | null
  photoNames: string[]
  latitude: number | null
  longitude: number | null
}

export type PlacesResult<T> =
  { status: "ok"; data: T } | { status: "error"; message: string }

type LocalizedText = { text?: string }
type PlacePhoto = { name?: string }
type OpeningHours = { weekdayDescriptions?: string[] }
type PlaceLocation = { latitude?: number; longitude?: number }
type AddressComponentJson = {
  longText?: string
  shortText?: string
  types?: string[]
}

type PlaceJson = {
  id?: string
  displayName?: LocalizedText
  formattedAddress?: string
  addressComponents?: AddressComponentJson[]
  types?: string[]
  primaryType?: string
  primaryTypeDisplayName?: LocalizedText
  businessStatus?: string
  googleMapsUri?: string
  nationalPhoneNumber?: string
  websiteUri?: string
  regularOpeningHours?: OpeningHours
  rating?: number
  userRatingCount?: number
  photos?: PlacePhoto[]
  location?: PlaceLocation
}

type SuggestionJson = {
  placePrediction?: {
    placeId?: string
    structuredFormat?: {
      mainText?: LocalizedText
      secondaryText?: LocalizedText
    }
    text?: LocalizedText
  }
}

function placesApiKey(): string | null {
  const key = process.env.GOOGLE_PLACES_API_KEY
  return typeof key === "string" && key.trim().length > 0 ? key.trim() : null
}

function missingKeyResult<T>(): PlacesResult<T> {
  return {
    status: "error",
    message: "A busca de estabelecimentos não está configurada.",
  }
}

function readText(value: LocalizedText | undefined): string | null {
  const text = value?.text?.trim()
  return text ? text : null
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function mapPlace(json: PlaceJson): PlacesPlace | null {
  const id = asString(json.id)
  if (!id) return null
  const photos = Array.isArray(json.photos) ? json.photos : []
  const descriptions = json.regularOpeningHours?.weekdayDescriptions
  const components = Array.isArray(json.addressComponents)
    ? json.addressComponents
    : []
  return {
    id,
    displayName: readText(json.displayName),
    formattedAddress: asString(json.formattedAddress),
    addressComponents: components.flatMap((item) => {
      const longText = asString(item.longText) ?? ""
      const shortText = asString(item.shortText) ?? ""
      const types = Array.isArray(item.types)
        ? item.types.filter((type): type is string => typeof type === "string")
        : []
      if (!longText && !shortText) return []
      return [{ longText, shortText, types }]
    }),
    types: Array.isArray(json.types)
      ? json.types.filter((item): item is string => typeof item === "string")
      : [],
    primaryType: asString(json.primaryType),
    primaryTypeDisplayName: readText(json.primaryTypeDisplayName),
    businessStatus: asString(json.businessStatus),
    googleMapsUri: asString(json.googleMapsUri),
    nationalPhoneNumber: asString(json.nationalPhoneNumber),
    websiteUri: asString(json.websiteUri),
    weekdayDescriptions: Array.isArray(descriptions)
      ? descriptions.filter((item): item is string => typeof item === "string")
      : [],
    rating: asNumber(json.rating),
    userRatingCount: asNumber(json.userRatingCount),
    photoNames: photos
      .map((photo) => asString(photo.name))
      .filter((name): name is string => Boolean(name))
      .slice(0, 10),
    latitude: asNumber(json.location?.latitude),
    longitude: asNumber(json.location?.longitude),
  }
}

async function readPlacesError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string; status?: string }
    }
    const status = body.error?.status
    if (status === "NOT_FOUND" || status === "NOT_FOUND_ERROR") {
      return "Estabelecimento não encontrado."
    }
    if (status === "INVALID_ARGUMENT") {
      return "Não foi possível identificar o estabelecimento."
    }
  } catch {
    return "Não foi possível consultar o Google. Tente novamente."
  }
  return "Não foi possível consultar o Google. Tente novamente."
}

export async function autocompletePlaces(
  input: string,
  sessionToken: string,
  intent: PlacesAutocompleteIntent = "establishment",
): Promise<PlacesResult<PlaceSuggestion[]>> {
  const key = placesApiKey()
  if (!key) return missingKeyResult()

  const query = input.trim()
  if (query.length < PLACES_SUGGEST_MIN_CHARS) {
    return { status: "ok", data: [] }
  }

  const directId = parsePlaceInput(query)
  if (directId) {
    return {
      status: "ok",
      data: [
        {
          placeId: directId,
          name: directId,
          address: "Place ID",
        },
      ],
    }
  }

  const response = await fetch(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
      },
      body: JSON.stringify({
        input: query,
        sessionToken,
        languageCode: "pt-BR",
        includedRegionCodes: ["br"],
        includedPrimaryTypes:
          intent === "address" ? ["geocode"] : ["establishment"],
      }),
    },
  )

  if (!response.ok) {
    return { status: "error", message: await readPlacesError(response) }
  }

  const body = (await response.json()) as { suggestions?: SuggestionJson[] }
  const suggestions = (body.suggestions ?? []).flatMap((item) => {
    const prediction = item.placePrediction
    const placeId = asString(prediction?.placeId)
    if (!placeId) return []
    const name =
      readText(prediction?.structuredFormat?.mainText) ??
      readText(prediction?.text)
    if (!name) return []
    return [
      {
        placeId,
        name,
        address: readText(prediction?.structuredFormat?.secondaryText),
      },
    ]
  })

  return { status: "ok", data: suggestions }
}

export async function fetchPlaceDetails(
  placeId: string,
  sessionToken?: string | null,
): Promise<PlacesResult<PlacesPlace>> {
  const key = placesApiKey()
  if (!key) return missingKeyResult()

  const id = parsePlaceInput(placeId) ?? placeId.trim()
  if (!id) {
    return {
      status: "error",
      message: "Não foi possível identificar o estabelecimento.",
    }
  }

  const params = new URLSearchParams({
    languageCode: "pt-BR",
    regionCode: "BR",
  })
  if (sessionToken) params.set("sessionToken", sessionToken)

  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?${params}`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": PLACES_FIELD_MASK,
      },
    },
  )

  if (!response.ok) {
    return { status: "error", message: await readPlacesError(response) }
  }

  const json = (await response.json()) as PlaceJson
  const place = mapPlace(json)
  if (!place) {
    return {
      status: "error",
      message: "Estabelecimento não encontrado.",
    }
  }

  return { status: "ok", data: place }
}
