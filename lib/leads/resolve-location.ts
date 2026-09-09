import type { BrazilStateCode } from "@/lib/br-locations"
import { cityFromFormattedAddress } from "@/lib/leads/visibility-audit"

type LeadLocationInput = {
  city: string | null
  state_code: BrazilStateCode | null
  segment?: { name: string } | null
}

type GbpLocationInput = {
  formattedAddress: string | null
} | null

function parseStateFromFormattedAddress(
  address: string | null,
): BrazilStateCode | null {
  if (!address) return null
  const match = address.match(/-\s*([A-Z]{2})\b/)
  const code = match?.[1]
  return code && /^[A-Z]{2}$/.test(code) ? (code as BrazilStateCode) : null
}

/**
 * Nomeado para poder ser exigido como argumento. A cobertura de termos é
 * montada dentro de `gbpGapsForProfile`, e os três montadores precisam entregar
 * a mesma coisa — tipo anônimo deixaria cada um inventar a sua.
 */
export type LeadLocation = {
  city: string | null
  stateCode: BrazilStateCode | null
  segmentName: string | null
}

export function resolveLeadLocation(
  lead: LeadLocationInput,
  gbpProfile?: GbpLocationInput,
): LeadLocation {
  const gbpAddress = gbpProfile?.formattedAddress ?? null
  return {
    city: lead.city ?? cityFromFormattedAddress(gbpAddress),
    stateCode: lead.state_code ?? parseStateFromFormattedAddress(gbpAddress),
    segmentName: lead.segment?.name ?? null,
  }
}

export function leadLocationSearchHint(
  lead: LeadLocationInput,
  companyName: string,
): string | null {
  const location = resolveLeadLocation(lead, null)
  const parts = [companyName.trim()]
  if (location.city) parts.push(location.city)
  if (location.stateCode) parts.push(location.stateCode)
  if (parts.length <= 1) return null
  return parts.join(" ")
}

export function applyLocationHintToQuery(
  query: string,
  hint: string | null | undefined,
): string {
  const trimmed = query.trim()
  if (!hint) return trimmed
  const normalizedQuery = trimmed.toLowerCase()
  const missing = hint
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((part) => !normalizedQuery.includes(part.toLowerCase()))
  if (missing.length === 0) return trimmed
  return `${trimmed} ${missing.join(" ")}`.trim()
}
