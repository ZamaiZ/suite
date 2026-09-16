import type { LeadGbpProfile } from "@/lib/leads/gbp"
import type { GbpRankCheck } from "@/lib/leads/gbp-audit"
import type {
  GbpReputationHistoryBlock,
  GbpReputationSample,
  GbpReputationWindow,
} from "@/lib/leads/gbp-reputation"
import type {
  GbpReputationDelta,
  GbpReputationDeltaBlock,
} from "@/lib/leads/gbp-reputation-compare"

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

export function gbpAuditStatus(profile: LeadGbpProfile | null): GbpAuditStatus {
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
    complement: "no perfil",
  }
}

export function gbpBusinessStatusLabel(status: string | null): string | null {
  if (!status) return null
  return GBP_BUSINESS_STATUS_LABEL[status] ?? status
}

const REPUTATION_BLOCK_LABEL: Record<GbpReputationHistoryBlock, string> = {
  no_distribution: "A distribuição por estrela ainda não foi coletada.",
  not_chronological:
    "Esta coleta trouxe as avaliações por relevância, não em ordem cronológica.",
  no_rated_reviews: "Nenhuma avaliação da amostra tem nota.",
  sample_covers_all: "A amostra já cobre todas as avaliações do perfil.",
  out_of_sync:
    "A distribuição e a amostra vieram de coletas em momentos diferentes.",
}

export function gbpReputationBlockLabel(
  reason: GbpReputationHistoryBlock,
): string {
  return REPUTATION_BLOCK_LABEL[reason]
}

/**
 * Janela truncada vira "ou mais". A amostra tem teto, então um número absoluto
 * afirmaria um total que ninguém mediu.
 */
export function gbpReputationWindowLabel(window: GbpReputationWindow): string {
  const count = window.count.toLocaleString("pt-BR")
  return window.complete
    ? `${count} em ${window.days} dias`
    : `${count} ou mais em ${window.days} dias`
}

/**
 * O período que a amostra cobre. Cinquenta avaliações são três semanas num
 * perfil grande e três anos num pequeno — sem declarar, comparar duas coletas
 * compara períodos diferentes.
 */
export function gbpReputationSpanLabel(spanDays: number | null): string | null {
  if (spanDays === null || spanDays <= 0) return null
  if (spanDays < 60) return `${spanDays} dias`
  const months = Math.round(spanDays / 30)
  if (months < 24) return `${months} meses`
  return `${Math.round(spanDays / 365)} anos`
}

export function gbpReplyRateLabel(rate: number | null): string | null {
  if (rate === null) return null
  return `${Math.round(rate * 100)}%`
}

/**
 * A rajada em uma frase. É o achado que a média e as janelas não contam: um
 * perfil pode ter nota alta e ritmo aparentemente saudável com quase tudo
 * concentrado em dois dias.
 */
export function gbpBurstLabel(sample: GbpReputationSample): string | null {
  const burst = sample.burst
  if (!burst) return null
  const dias = burst.days.length
  const share = Math.round(burst.share * 100)
  return (
    `${burst.count.toLocaleString("pt-BR")} de` +
    ` ${sample.size.toLocaleString("pt-BR")} avaliações em ${dias}` +
    ` ${dias === 1 ? "dia" : "dias"} (${share}%)`
  )
}

export function gbpFrequencyLabel(sample: GbpReputationSample): string | null {
  const parts: string[] = []
  if (sample.perMonth !== null) {
    parts.push(
      `${sample.perMonth.toLocaleString("pt-BR", {
        maximumFractionDigits: 1,
      })} por mês`,
    )
  }
  if (sample.daysSinceLast !== null) {
    parts.push(`última há ${sample.daysSinceLast.toLocaleString("pt-BR")} dias`)
  }
  if (sample.trend) {
    parts.push(
      `${sample.trend.recent} nos últimos ${sample.trend.days} dias` +
        ` contra ${sample.trend.previous} nos ${sample.trend.days} anteriores`,
    )
  }
  return parts.length > 0 ? parts.join(" · ") : null
}

/**
 * Taxa por faixa de nota. A taxa geral esconde o caso em que se responde todo
 * elogio e nenhuma crítica.
 */
export function gbpReplyByBandLabel(
  sample: GbpReputationSample,
): string | null {
  const high = sample.replyByBand.find((band) => band.band === "high")
  const low = sample.replyByBand.find((band) => band.band === "low")
  if (high?.replyRate == null || low?.replyRate == null) return null
  const pct = (value: number) => `${Math.round(value * 100)}%`
  return (
    `${pct(high.replyRate)} das notas altas respondidas` +
    ` · ${pct(low.replyRate)} das baixas`
  )
}

export function gbpAuthorsLabel(sample: GbpReputationSample): string | null {
  const pct = (value: number | null) =>
    value === null ? null : `${Math.round(value * 100)}%`
  const parts: string[] = []
  const withoutText = pct(sample.authors.withoutTextShare)
  if (withoutText) parts.push(`${withoutText} sem texto`)
  const withPhotos = pct(sample.authors.withPhotosShare)
  if (withPhotos) parts.push(`${withPhotos} com foto`)
  const localGuide = pct(sample.authors.localGuideShare)
  if (localGuide) parts.push(`${localGuide} local guides`)
  const lowActivity = pct(sample.authors.lowActivityShare)
  if (lowActivity) parts.push(`${lowActivity} de autores novos`)
  return parts.length > 0 ? parts.join(" · ") : null
}

const REVIEWS_DELTA_BLOCK_LABEL: Record<GbpReputationDeltaBlock, string> = {
  no_previous:
    "A comparação entre coletas aparece a partir da segunda análise.",
  no_ids:
    "A coleta anterior é antiga demais para comparar avaliação a avaliação.",
  not_chronological: "Uma das coletas veio por relevância, não em ordem.",
}

export function gbpReviewsDeltaLabel(delta: GbpReputationDelta): string {
  if (delta.status === "blocked") {
    return REVIEWS_DELTA_BLOCK_LABEL[delta.reason]
  }
  const parts = [`${delta.added.toLocaleString("pt-BR")} novas`]
  if (delta.removed > 0) {
    parts.push(`${delta.removed.toLocaleString("pt-BR")} removidas`)
  }
  if (delta.totalDelta !== null && delta.totalDelta !== 0) {
    const signal = delta.totalDelta > 0 ? "+" : ""
    parts.push(`total ${signal}${delta.totalDelta.toLocaleString("pt-BR")}`)
  }
  return `Desde a coleta anterior: ${parts.join(" · ")}`
}
