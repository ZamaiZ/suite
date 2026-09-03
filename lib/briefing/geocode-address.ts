import {
  joinBrazilianAddress,
  type ParsedBrazilianAddress,
} from "@/lib/briefing/address"
import type { BriefingCompanyPayload } from "@/lib/briefing/company"
import {
  hasGbpCoordinates,
  type GbpSnapshot,
} from "@/lib/leads/gbp"
import { geocodeAddressText } from "@/lib/places/geocode"

export type ResolvedMapCoordinates = {
  latitude: number
  longitude: number
  addressKey: string
  source: "gbp" | "places"
}

export function normalizeAddressFingerprint(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

export function companyAddressFingerprint(
  payload: BriefingCompanyPayload,
): string {
  const formatted = payload.formattedAddress.trim()
  if (formatted) return normalizeAddressFingerprint(formatted)

  const parts: ParsedBrazilianAddress = {
    street: payload.street,
    number: payload.number,
    complement: payload.complement,
    neighborhood: payload.neighborhood,
    city: payload.city,
    stateCode: payload.stateCode,
    postalCode: payload.postalCode,
    formattedAddress: "",
  }
  return normalizeAddressFingerprint(joinBrazilianAddress(parts))
}

export function companyFormattedAddress(
  payload: BriefingCompanyPayload,
): string {
  const formatted = payload.formattedAddress.trim()
  if (formatted) return formatted
  return joinBrazilianAddress({
    street: payload.street,
    number: payload.number,
    complement: payload.complement,
    neighborhood: payload.neighborhood,
    city: payload.city,
    stateCode: payload.stateCode,
    postalCode: payload.postalCode,
  })
}

export async function resolveAudienceMapCoordinates(input: {
  company: BriefingCompanyPayload
  gbp: GbpSnapshot | null
}): Promise<
  | { status: "ok"; data: ResolvedMapCoordinates }
  | { status: "error"; message: string }
> {
  const addressKey = companyAddressFingerprint(input.company)
  if (!addressKey) {
    return {
      status: "error",
      message: "Complete o endereço da empresa antes de definir o raio.",
    }
  }

  const formatted = companyFormattedAddress(input.company)
  const gbp = input.gbp
  if (gbp && hasGbpCoordinates(gbp)) {
    const gbpKey = normalizeAddressFingerprint(gbp.formattedAddress ?? "")
    if (gbpKey && gbpKey === addressKey) {
      return {
        status: "ok",
        data: {
          latitude: gbp.latitude as number,
          longitude: gbp.longitude as number,
          addressKey,
          source: "gbp",
        },
      }
    }
  }

  const geocoded = await geocodeAddressText(formatted)
  if (geocoded.status === "error") {
    return { status: "error", message: geocoded.message }
  }

  return {
    status: "ok",
    data: {
      latitude: geocoded.data.latitude,
      longitude: geocoded.data.longitude,
      addressKey,
      source: "places",
    },
  }
}
