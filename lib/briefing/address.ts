import { digitsOnly, formatPostalCode } from "@/lib/br-documents"
import { isBrazilStateCode } from "@/lib/br-locations"
import type { BriefingCompanyPayload } from "@/lib/briefing/company"

export type ParsedBrazilianAddress = {
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  stateCode: string
  postalCode: string
  formattedAddress: string
}

export type PlaceAddressComponentLike = {
  longText: string
  shortText: string
  types: string[]
}

const POSTAL_AT_END = /,?\s*(\d{5}-?\d{3})\s*$/
const STATE_AT_END = /\s*[-–—]\s*([A-Za-z]{2})\s*$/
const FULL_ADDRESS_POSTAL = /\d{5}-?\d{3}/
const FULL_ADDRESS_STATE = /[-–—]\s*[A-Z]{2}\s*,/
const STREET_NUMBER = /^(.+?),\s*(\d+[a-zA-Z]?|s\/?n)\s*$/i
const STREET_NUMBER_TOKEN = /^(s\/?n|\d+[a-zA-Z]?)$/i
const DASH_SPLIT = /\s+[-–—]\s+/

const ADDRESS_KEYS = [
  "street",
  "number",
  "complement",
  "neighborhood",
  "city",
  "stateCode",
  "postalCode",
] as const

export function emptyParsedAddress(): ParsedBrazilianAddress {
  return {
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    stateCode: "",
    postalCode: "",
    formattedAddress: "",
  }
}

export function looksLikeFullAddress(value: string): boolean {
  const input = value.trim()
  if (!input) return false
  return FULL_ADDRESS_POSTAL.test(input) || FULL_ADDRESS_STATE.test(input)
}

export function joinBrazilianAddress(
  parts: Omit<ParsedBrazilianAddress, "formattedAddress">,
): string {
  const streetNumber = [parts.street.trim(), parts.number.trim()]
    .filter((part) => part.length > 0)
    .join(", ")
  const head = [
    streetNumber,
    parts.complement.trim(),
    parts.neighborhood.trim(),
  ]
    .filter((part) => part.length > 0)
    .join(" - ")
  const cityState = [parts.city.trim(), parts.stateCode.trim()]
    .filter((part) => part.length > 0)
    .join(" - ")
  const postal = parts.postalCode.trim()
    ? formatPostalCode(parts.postalCode)
    : ""
  return [head, cityState, postal].filter((part) => part.length > 0).join(", ")
}

export function parseBrazilianAddress(input: string): ParsedBrazilianAddress {
  const result = emptyParsedAddress()
  const trimmed = input.trim()
  if (!trimmed) return result

  result.formattedAddress = trimmed
  let rest = trimmed

  const postalMatch = rest.match(POSTAL_AT_END)
  if (postalMatch?.[1] && postalMatch.index !== undefined) {
    result.postalCode = digitsOnly(postalMatch[1])
    rest = rest.slice(0, postalMatch.index).replace(/[,\s]+$/, "")
  }

  const stateMatch = rest.match(STATE_AT_END)
  const stateCode = stateMatch?.[1]?.toUpperCase() ?? ""
  if (
    stateMatch &&
    stateMatch.index !== undefined &&
    isBrazilStateCode(stateCode)
  ) {
    result.stateCode = stateCode
    rest = rest.slice(0, stateMatch.index).replace(/[,\s]+$/, "")
  }

  if (result.stateCode || result.postalCode) {
    const lastComma = rest.lastIndexOf(",")
    if (lastComma >= 0) {
      const maybeCity = rest.slice(lastComma + 1).trim()
      const head = rest.slice(0, lastComma).trim()
      if (maybeCity && head) {
        result.city = maybeCity
        rest = head
      }
    }
  }

  applyStreetTail(rest, result)
  if (!result.formattedAddress) {
    result.formattedAddress = joinBrazilianAddress(result)
  }
  return result
}

export function addressFromPlaceComponents(
  components: PlaceAddressComponentLike[],
): ParsedBrazilianAddress {
  const result = emptyParsedAddress()
  result.street = componentText(components, ["route"])
  result.number = componentText(components, ["street_number"])
  result.complement = componentText(components, ["subpremise", "premise"])
  result.neighborhood = componentText(components, [
    "sublocality",
    "sublocality_level_1",
    "neighborhood",
  ])
  result.city = componentText(components, [
    "administrative_area_level_2",
    "locality",
  ])
  const state = componentText(
    components,
    ["administrative_area_level_1"],
    true,
  ).toUpperCase()
  result.stateCode = isBrazilStateCode(state) ? state : ""
  result.postalCode = digitsOnly(componentText(components, ["postal_code"]))
  result.formattedAddress = joinBrazilianAddress(result)
  return result
}

export function mergeAddress(
  base: ParsedBrazilianAddress,
  overlay: Partial<ParsedBrazilianAddress>,
): ParsedBrazilianAddress {
  const next = { ...base }
  for (const key of ADDRESS_KEYS) {
    const value = overlay[key]
    if (typeof value === "string" && value.trim().length > 0) {
      next[key] = value.trim()
    }
  }
  const formatted = overlay.formattedAddress?.trim()
  next.formattedAddress =
    formatted && formatted.length > 0 ? formatted : joinBrazilianAddress(next)
  return next
}

export function hydrateStructuredAddress(
  payload: BriefingCompanyPayload,
): BriefingCompanyPayload {
  if (payload.postalCode.trim() || payload.number.trim()) return payload
  const source = payload.street.trim() || payload.formattedAddress.trim()
  if (!source || !looksLikeFullAddress(source)) return payload
  const parsed = parseBrazilianAddress(source)
  return {
    ...payload,
    street: parsed.street,
    number: parsed.number,
    complement: parsed.complement || payload.complement,
    neighborhood: parsed.neighborhood || payload.neighborhood,
    city: parsed.city || payload.city,
    stateCode: parsed.stateCode || payload.stateCode,
    postalCode: parsed.postalCode || payload.postalCode,
    formattedAddress: parsed.formattedAddress || payload.formattedAddress,
  }
}

function applyStreetTail(rest: string, result: ParsedBrazilianAddress) {
  const trimmed = rest.trim()
  if (!trimmed) return

  const dashParts = trimmed
    .split(DASH_SPLIT)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  if (dashParts.length >= 2) {
    applyStreetAndNumber(dashParts[0] ?? "", result)
    if (dashParts.length === 2) {
      result.neighborhood = dashParts[1] ?? ""
      return
    }
    result.complement = dashParts.slice(1, -1).join(" - ")
    result.neighborhood = dashParts[dashParts.length - 1] ?? ""
    return
  }

  const commaParts = trimmed
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  if (commaParts.length >= 2 && STREET_NUMBER_TOKEN.test(commaParts[1] ?? "")) {
    result.street = commaParts[0] ?? ""
    result.number = commaParts[1] ?? ""
    if (commaParts.length === 3) {
      result.neighborhood = commaParts[2] ?? ""
      return
    }
    if (commaParts.length > 3) {
      result.complement = commaParts.slice(2, -1).join(", ")
      result.neighborhood = commaParts[commaParts.length - 1] ?? ""
    }
    return
  }

  applyStreetAndNumber(trimmed, result)
}

function applyStreetAndNumber(segment: string, result: ParsedBrazilianAddress) {
  const match = segment.trim().match(STREET_NUMBER)
  if (match?.[1] && match[2]) {
    result.street = match[1].trim()
    result.number = match[2].trim()
    return
  }
  result.street = segment.trim()
}

function componentText(
  components: PlaceAddressComponentLike[],
  types: string[],
  preferShort = false,
): string {
  const found = components.find((component) =>
    types.some((type) => component.types.includes(type)),
  )
  if (!found) return ""
  const preferred = preferShort ? found.shortText : found.longText
  return (preferred || found.longText || found.shortText).trim()
}
