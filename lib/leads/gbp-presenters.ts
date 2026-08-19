import { GBP_PHOTO_API_MAX, type LeadGbpProfile } from "@/lib/leads/gbp"
import type { GbpRankCheck } from "@/lib/leads/gbp-audit"

const HOURS_24 = /24\s*hora/i

export const GBP_BUSINESS_STATUS_LABEL: Record<string, string> = {
  OPERATIONAL: "Operante",
  CLOSED_TEMPORARILY: "Fechado temporariamente",
  CLOSED_PERMANENTLY: "Fechado",
  FUTURE_OPENING: "Abertura futura",
}

export type GbpAuditStatus = "processing" | "analyzed" | "pending" | "error"

export const GBP_AUDIT_STATUS_LABEL: Record<GbpAuditStatus, string> = {
  processing: "Em análise",
  analyzed: "Analisado",
  pending: "Pendente",
  error: "Erro",
}

export type OpeningHoursSummary = {
  summary: string | null
  details: string[]
  isAlwaysOpen: boolean
}

export function summarizeOpeningHours(lines: string[]): OpeningHoursSummary {
  if (lines.length === 0) {
    return { summary: null, details: [], isAlwaysOpen: false }
  }
  const isAlwaysOpen = lines.every((line) => HOURS_24.test(line))
  return {
    summary: isAlwaysOpen
      ? "Aberto 24 horas, todos os dias"
      : (lines[0] ?? null),
    details: lines,
    isAlwaysOpen,
  }
}

export function gbpAuditStatus(
  profile: LeadGbpProfile | null,
): GbpAuditStatus {
  if (!profile) return "pending"
  if (profile.jobs.some((job) => job.status === "queued")) return "processing"
  if (profile.jobs.some((job) => job.status === "failed")) return "error"
  if (profile.enrichment_at) return "analyzed"
  return "pending"
}

export function latestGbpCollectedAt(profile: LeadGbpProfile): string {
  const stamps = [
    profile.fetched_at,
    profile.enrichment_at,
    profile.posts_at,
    profile.reviews_at,
  ].filter((value): value is string => Boolean(value))
  return stamps.reduce((latest, stamp) =>
    Date.parse(stamp) > Date.parse(latest) ? stamp : latest,
  )
}

export function bestMapsPosition(
  keywords: string[],
  checks: GbpRankCheck[],
): number | null {
  const current = new Set(keywords.map((keyword) => keyword.toLowerCase()))
  const positions = checks
    .filter((check) => current.has(check.keyword.toLowerCase()))
    .map((check) => check.maps_position)
    .filter((position): position is number => position !== null)
  if (positions.length === 0) return null
  return Math.min(...positions)
}

export function formatGbpRating(value: number | null): string | null {
  if (value === null) return null
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

export function formatGbpCount(value: number | null): string | null {
  if (value === null) return null
  return value.toLocaleString("pt-BR")
}

export function gbpPhotosLabel(profile: LeadGbpProfile): {
  value: string | null
  complement: string
} {
  const total = profile.enrichment?.totalPhotos
  if (total != null) {
    return {
      value: total.toLocaleString("pt-BR"),
      complement: "no perfil",
    }
  }
  return {
    value: profile.payload.photoCount.toLocaleString("pt-BR"),
    complement: `na API (máx. ${GBP_PHOTO_API_MAX})`,
  }
}

export function gbpBusinessStatusLabel(status: string | null): string | null {
  if (!status) return null
  return GBP_BUSINESS_STATUS_LABEL[status] ?? status
}
