import "server-only"

/**
 * Coordenada do mapa de raio: do perfil do Google quando o endereço bate, do
 * geocoder quando não bate.
 *
 * `server-only` de propósito. As três funções puras que o cliente usa moram em
 * `address-fingerprint.ts`, e a separação existe para que importá-las não
 * arraste o geocoder — com a chave de API junto — para o bundle do navegador.
 *
 * O import é do módulo específico, e **não** do barril `@/lib/locationiq`: o
 * barril reexporta `cityCenter`, que também é `server-only`, e isso volta a
 * envenenar qualquer cadeia que o cliente toque.
 */

import {
  companyAddressFingerprint,
  companyFormattedAddress,
  normalizeAddressFingerprint,
} from "@/lib/briefing/address-fingerprint"
import type { BriefingCompanyPayload } from "@/lib/briefing/company"
import { hasGbpCoordinates, type GbpSnapshot } from "@/lib/leads/gbp"
import { geocodeAddressText } from "@/lib/locationiq/client"

export type ResolvedMapCoordinates = {
  latitude: number
  longitude: number
  addressKey: string
  source: "gbp" | "geocode"
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
      source: "geocode",
    },
  }
}
