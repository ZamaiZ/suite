import { parseHoursLines } from "@/lib/briefing/hours"
import {
  digitsOnly,
  isValidBrPhone,
  isValidCnpj,
  isValidCpf,
} from "@/lib/br-documents"
import { isBrazilStateCode } from "@/lib/br-locations"
import {
  DIGITAL_CHANNEL_TYPES,
  isDigitalChannelType,
  type DigitalChannelType,
} from "@/lib/leads/digital-channels"
import { normalizeWebsiteDomain } from "@/lib/leads/website"
import { z } from "zod"

export type BriefingCompanyChannel = {
  type: DigitalChannelType
  value: string
}

export type BriefingCompanyPayload = {
  companyName: string
  contactName: string
  taxId: string
  postalCode: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  stateCode: string
  formattedAddress: string
  servedAreas: string[]
  phone: string
  whatsapp: string
  email: string
  hoursLines: string[]
  channels: BriefingCompanyChannel[]
}

export function emptyCompanyPayload(): BriefingCompanyPayload {
  return {
    companyName: "",
    contactName: "",
    taxId: "",
    postalCode: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    stateCode: "",
    formattedAddress: "",
    servedAreas: [],
    phone: "",
    whatsapp: "",
    email: "",
    hoursLines: [],
    channels: [],
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

export function parseCompanyPayload(value: unknown): BriefingCompanyPayload {
  const base = emptyCompanyPayload()
  if (!value || typeof value !== "object") return base
  const row = value as Record<string, unknown>
  const channels = Array.isArray(row.channels)
    ? row.channels.flatMap((item) => {
        if (!item || typeof item !== "object") return []
        const channel = item as Record<string, unknown>
        if (!isDigitalChannelType(channel.type)) return []
        return [
          {
            type: channel.type,
            value: asString(channel.value),
          },
        ]
      })
    : []

  const stateCode = asString(row.stateCode)
  return {
    companyName: asString(row.companyName),
    contactName: asString(row.contactName),
    taxId: asString(row.taxId),
    postalCode: asString(row.postalCode),
    street: asString(row.street),
    number: asString(row.number),
    complement: asString(row.complement),
    neighborhood: asString(row.neighborhood),
    city: asString(row.city),
    stateCode: isBrazilStateCode(stateCode) ? stateCode : stateCode,
    formattedAddress: asString(row.formattedAddress),
    servedAreas: asStringList(row.servedAreas)
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
    phone: asString(row.phone),
    whatsapp: asString(row.whatsapp),
    email: asString(row.email),
    hoursLines: asStringList(row.hoursLines),
    channels,
  }
}

export function hoursLinesEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  return left.every((line, index) => line === right[index])
}

export function taxIdInputVariant(value: string): "cnpj" | "cpf" | "text" {
  const digits = digitsOnly(value)
  if (digits.length === 0) return "cnpj"
  if (digits.length <= 11 && !isValidCnpj(digits)) return "cpf"
  if (isValidCpf(digits) && digits.length === 11) return "cpf"
  return "cnpj"
}

export type CompanyMissingGroup =
  "identity" | "address" | "servedAreas" | "contact" | "hours" | "website"

export const COMPANY_MISSING_LABELS: Record<CompanyMissingGroup, string> = {
  identity: "identidade",
  address: "endereço",
  servedAreas: "bairros ou cidades atendidos",
  contact: "contato",
  hours: "horários dos dias abertos",
  website: "site",
}

function hasValidTaxId(value: string): boolean {
  const digits = digitsOnly(value)
  return isValidCpf(digits) || isValidCnpj(digits)
}

function hasValidOpenHours(hoursLines: string[]): boolean {
  const days = parseHoursLines(hoursLines)
  return days.every((day) => {
    if (day.closed) return true
    return day.open.length > 0 && day.close.length > 0
  })
}

function hasValidWebsite(channels: BriefingCompanyChannel[]): boolean {
  return channels.some(
    (channel) =>
      channel.type === "website" &&
      normalizeWebsiteDomain(channel.value) !== null,
  )
}

export function ensureWebsiteChannel(
  channels: BriefingCompanyChannel[],
): BriefingCompanyChannel[] {
  const websiteIndex = channels.findIndex(
    (channel) => channel.type === "website",
  )
  if (websiteIndex >= 0) {
    const website = channels[websiteIndex]
    const rest = channels.filter((_, index) => index !== websiteIndex)
    return [website, ...rest]
  }
  return [{ type: "website", value: "" }, ...channels]
}

export function getCompanyMissingGroups(
  payload: BriefingCompanyPayload,
): CompanyMissingGroup[] {
  const missing: CompanyMissingGroup[] = []

  if (
    payload.companyName.trim().length === 0 ||
    payload.contactName.trim().length === 0 ||
    !hasValidTaxId(payload.taxId)
  ) {
    missing.push("identity")
  }

  const postal = digitsOnly(payload.postalCode)
  if (
    postal.length !== 8 ||
    payload.street.trim().length === 0 ||
    payload.number.trim().length === 0 ||
    payload.neighborhood.trim().length === 0 ||
    payload.city.trim().length === 0 ||
    !isBrazilStateCode(payload.stateCode)
  ) {
    missing.push("address")
  }

  if (payload.servedAreas.length === 0) {
    missing.push("servedAreas")
  }

  if (
    !isValidBrPhone(payload.phone) ||
    !isValidBrPhone(payload.whatsapp) ||
    !z.email().safeParse(payload.email.trim()).success
  ) {
    missing.push("contact")
  }

  if (!hasValidOpenHours(payload.hoursLines)) {
    missing.push("hours")
  }

  if (!hasValidWebsite(payload.channels)) {
    missing.push("website")
  }

  return missing
}

export function isCompanyReadyToComplete(
  payload: BriefingCompanyPayload,
): boolean {
  return getCompanyMissingGroups(payload).length === 0
}

export { DIGITAL_CHANNEL_TYPES }
