/**
 * A impressão digital do endereço da empresa — parte **pura**, sem rede.
 *
 * Mora fora de `geocode-address.ts` porque esses três são usados por componente
 * de cliente, e aquele arquivo chama o geocoder, que é `server-only`. Juntos,
 * qualquer import do cliente arrastava o módulo de servidor para o navegador —
 * antes em silêncio, porque o geocoder do Places não carregava marcador algum.
 */

import {
  joinBrazilianAddress,
  type ParsedBrazilianAddress,
} from "@/lib/briefing/address"
import type { BriefingCompanyPayload } from "@/lib/briefing/company"

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
