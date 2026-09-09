import type { GbpReviewSampleItem, GbpReviewSummary } from "./gbp-audit.ts"
import type { GbpRatingDistribution } from "./gbp-enrichment.ts"

/**
 * Leitura de reputação a partir de um snapshot só.
 *
 * A distribuição por estrela dá a soma exata de todas as notas do perfil; a
 * amostra cronológica dá a soma das mais recentes. Subtrair uma da outra revela
 * a média de tudo que veio antes — sem precisar de histórico nenhum.
 *
 * O módulo é dividido em duas metades de propósito. A metade da amostra
 * (volume, frequência, rajada, resposta, autores) depende só das avaliações e
 * sempre responde. A metade histórica depende de duas chamadas diferentes se
 * encontrarem, e por isso pode bloquear — e quando bloqueia, diz por quê em vez
 * de devolver um número com aparência de verdade.
 *
 * Toda razão sobre campo ausente devolve `null`, nunca zero: a coleta ampliada
 * é recente, e amostra antiga não pode parecer um perfil sem autor e sem
 * resposta datada.
 */

/** Janelas medidas, em dias. */
export const GBP_REPUTATION_WINDOWS = [30, 60, 90, 180, 365] as const

export type GbpReputationWindowDays = (typeof GBP_REPUTATION_WINDOWS)[number]

/** Sem avaliação nova por mais que isto, o perfil está parado. */
export const GBP_REPUTATION_DORMANT_DAYS = 90

/** Janela usada para comparar o ritmo recente com o anterior. */
export const GBP_REPUTATION_TREND_DAYS = 90

/**
 * Um dia vira rajada quando concentra pelo menos cinco avaliações **e** um
 * décimo da amostra. O corte é relativo ao perfil: dezoito num dia é rajada num
 * perfil de 46 e rotina num de 5.000.
 */
export const GBP_BURST_MIN_REVIEWS = 5
export const GBP_BURST_SAMPLE_SHARE = 0.1

/** Nota a partir da qual a avaliação conta como elogio. */
export const GBP_REPUTATION_HIGH_RATING = 4

/** Autor com menos avaliações que isto tem pouco lastro. */
export const GBP_REPUTATION_LOW_ACTIVITY_REVIEWS = 3

/**
 * Quanto o total declarado na coleta das avaliações pode divergir do total da
 * distribuição antes de as duas serem consideradas de momentos diferentes.
 */
export const GBP_REPUTATION_SYNC_TOLERANCE = 0.05

export type GbpReputationWindow = {
  days: GbpReputationWindowDays
  count: number
  /**
   * `false` quando a amostra não alcança o início da janela: aí a contagem é um
   * piso, não um total, e apresentar como total mentiria.
   */
  complete: boolean
}

export type GbpReputationBurstDay = {
  /** Dia civil em UTC, como `YYYY-MM-DD`. */
  date: string
  count: number
}

export type GbpReputationBurst = {
  days: GbpReputationBurstDay[]
  /** Avaliações que caem nesses dias. */
  count: number
  /** Fração da amostra concentrada neles. */
  share: number
}

export type GbpReputationTrend = {
  days: number
  recent: number
  previous: number
}

export type GbpReplyBand = "high" | "low"

export type GbpReplyByBand = {
  band: GbpReplyBand
  count: number
  repliedCount: number
  replyRate: number | null
  /**
   * Mediana em dias; `null` enquanto a coleta não trouxer a data da resposta.
   */
  medianDays: number | null
}

export type GbpReputationAuthors = {
  withoutTextShare: number | null
  withPhotosShare: number | null
  localGuideShare: number | null
  lowActivityShare: number | null
}

export type GbpReputationSample = {
  /** Avaliações na amostra, incluindo as sem nota. */
  size: number
  /** Só as que têm nota — as únicas que entram em média. */
  ratedCount: number
  average: number | null
  windows: GbpReputationWindow[]
  /** Dias entre a avaliação mais antiga e a mais nova da amostra. */
  spanDays: number | null
  /** Ritmo na janela coberta. */
  perMonth: number | null
  /** Dias desde a avaliação mais recente. */
  daysSinceLast: number | null
  /** Maior intervalo sem avaliação dentro da amostra. */
  longestGapDays: number | null
  trend: GbpReputationTrend | null
  burst: GbpReputationBurst | null
  repliedCount: number
  replyRate: number | null
  /** Mediana do tempo de resposta; `null` sem a data da resposta. */
  replyMedianDays: number | null
  daysSinceLastReply: number | null
  /** A mais recente está sem resposta — o que um analista fala primeiro. */
  latestUnanswered: boolean | null
  replyByBand: GbpReplyByBand[]
  authors: GbpReputationAuthors
}

export type GbpReputationHistoryBlock =
  | "no_distribution"
  | "not_chronological"
  | "no_rated_reviews"
  | "sample_covers_all"
  | "out_of_sync"

export type GbpReputationHistory =
  | {
      status: "ok"
      /** Total de avaliações segundo a distribuição. */
      total: number
      recentCount: number
      recentAverage: number
      priorCount: number
      priorAverage: number
    }
  | { status: "blocked"; reason: GbpReputationHistoryBlock }

export type GbpReputation = {
  sample: GbpReputationSample
  history: GbpReputationHistory
}

const DAY_MS = 24 * 60 * 60 * 1000

function ratingSum(distribution: GbpRatingDistribution): number {
  return (
    distribution["1"] +
    distribution["2"] * 2 +
    distribution["3"] * 3 +
    distribution["4"] * 4 +
    distribution["5"] * 5
  )
}

function ratingTotal(distribution: GbpRatingDistribution): number {
  return (
    distribution["1"] +
    distribution["2"] +
    distribution["3"] +
    distribution["4"] +
    distribution["5"]
  )
}

function parseMs(value: string | null): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? (sorted[middle] as number)
    : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
}

/**
 * Participação sobre os itens que **responderam** a pergunta. Item sem o campo
 * fica fora do numerador e do denominador: amostra antiga não tem os campos de
 * autor, e contá-los como `false` afirmaria que ninguém é local guide.
 */
function shareOf(
  items: readonly GbpReviewSampleItem[],
  pick: (item: GbpReviewSampleItem) => boolean | null,
): number | null {
  let known = 0
  let hits = 0
  for (const item of items) {
    const value = pick(item)
    if (value === null) continue
    known += 1
    if (value) hits += 1
  }
  return known === 0 ? null : hits / known
}

function burstFrom(
  timestamps: readonly number[],
  sampleSize: number,
): GbpReputationBurst | null {
  if (timestamps.length === 0 || sampleSize === 0) return null
  const perDay = new Map<string, number>()
  for (const ms of timestamps) {
    const date = new Date(ms).toISOString().slice(0, 10)
    perDay.set(date, (perDay.get(date) ?? 0) + 1)
  }
  const threshold = Math.max(
    GBP_BURST_MIN_REVIEWS,
    Math.ceil(sampleSize * GBP_BURST_SAMPLE_SHARE),
  )
  const days: GbpReputationBurstDay[] = []
  for (const [date, count] of perDay) {
    if (count >= threshold) days.push({ date, count })
  }
  if (days.length === 0) return null
  days.sort((left, right) => right.count - left.count)
  const count = days.reduce((total, day) => total + day.count, 0)
  return { days, count, share: count / sampleSize }
}

/**
 * Taxa e tempo de resposta por faixa de nota — é o que separa "responde bem" de
 * "responde elogio e ignora crítica", que a taxa geral esconde.
 */
function replyBand(
  items: readonly GbpReviewSampleItem[],
  band: GbpReplyBand,
): GbpReplyByBand {
  const inBand = items.filter((item) => {
    if (item.rating === null) return false
    return band === "high"
      ? item.rating >= GBP_REPUTATION_HIGH_RATING
      : item.rating < GBP_REPUTATION_HIGH_RATING
  })
  const replied = inBand.filter((item) => item.ownerAnswer)
  const latencies: number[] = []
  for (const item of replied) {
    const asked = parseMs(item.publishedAt)
    const answered = parseMs(item.answeredAt)
    if (asked === null || answered === null || answered < asked) continue
    latencies.push((answered - asked) / DAY_MS)
  }
  return {
    band,
    count: inBand.length,
    repliedCount: replied.length,
    replyRate: inBand.length === 0 ? null : replied.length / inBand.length,
    medianDays: median(latencies),
  }
}

function readSample(
  reviews: GbpReviewSummary,
  nowMs: number,
): { sample: GbpReputationSample; ratedSum: number } {
  const ratings: number[] = []
  const timestamps: number[] = []
  const latencies: number[] = []
  const replyTimestamps: number[] = []

  for (const item of reviews.items) {
    if (item.rating !== null) ratings.push(item.rating)
    const asked = parseMs(item.publishedAt)
    if (asked !== null) timestamps.push(asked)
    const answered = parseMs(item.answeredAt)
    if (answered !== null) {
      replyTimestamps.push(answered)
      if (asked !== null && answered >= asked) {
        latencies.push((answered - asked) / DAY_MS)
      }
    }
  }

  const oldest = timestamps.length > 0 ? Math.min(...timestamps) : null
  const newest = timestamps.length > 0 ? Math.max(...timestamps) : null
  const spanDays =
    oldest !== null && newest !== null
      ? Math.round((newest - oldest) / DAY_MS)
      : null

  const windows = GBP_REPUTATION_WINDOWS.map((days) => {
    const start = nowMs - days * DAY_MS
    return {
      days,
      count: timestamps.filter((ms) => ms >= start).length,
      // A amostra é truncada. Se a mais antiga dela ainda é mais nova que o
      // início da janela, existem avaliações no período que não vieram.
      complete: oldest !== null && oldest <= start,
    }
  })

  // Maior silêncio dentro da amostra: um perfil pode ter média boa e ter
  // passado dois anos sem nenhuma avaliação nova.
  const sorted = [...timestamps].sort((left, right) => left - right)
  let longestGapDays: number | null = null
  for (let index = 1; index < sorted.length; index += 1) {
    const gap =
      ((sorted[index] as number) - (sorted[index - 1] as number)) / DAY_MS
    if (longestGapDays === null || gap > longestGapDays) longestGapDays = gap
  }

  // A tendência só existe se a amostra alcançar a janela anterior inteira —
  // senão "caiu pela metade" seria só o efeito do truncamento.
  const trendStart = nowMs - GBP_REPUTATION_TREND_DAYS * DAY_MS
  const trendPrevious = trendStart - GBP_REPUTATION_TREND_DAYS * DAY_MS
  const trend =
    oldest !== null && oldest <= trendPrevious
      ? {
          days: GBP_REPUTATION_TREND_DAYS,
          recent: timestamps.filter((ms) => ms >= trendStart).length,
          previous: timestamps.filter(
            (ms) => ms >= trendPrevious && ms < trendStart,
          ).length,
        }
      : null

  const ratedSum = ratings.reduce((sum, value) => sum + value, 0)
  const latest = reviews.items.find((item) => item.publishedAt !== null) ?? null

  return {
    ratedSum,
    sample: {
      size: reviews.items.length,
      ratedCount: ratings.length,
      average: ratings.length > 0 ? ratedSum / ratings.length : null,
      windows,
      spanDays,
      perMonth:
        spanDays !== null && spanDays > 0
          ? reviews.items.length / (spanDays / 30.44)
          : null,
      daysSinceLast:
        newest === null ? null : Math.round((nowMs - newest) / DAY_MS),
      longestGapDays:
        longestGapDays === null ? null : Math.round(longestGapDays),
      trend,
      burst: burstFrom(timestamps, reviews.items.length),
      repliedCount: reviews.replied,
      replyRate:
        reviews.sampled > 0 ? reviews.replied / reviews.sampled : null,
      replyMedianDays: median(latencies),
      daysSinceLastReply:
        replyTimestamps.length === 0
          ? null
          : Math.round((nowMs - Math.max(...replyTimestamps)) / DAY_MS),
      latestUnanswered: latest === null ? null : !latest.ownerAnswer,
      replyByBand: [
        replyBand(reviews.items, "high"),
        replyBand(reviews.items, "low"),
      ],
      authors: {
        withoutTextShare: shareOf(reviews.items, (item) => !item.text),
        withPhotosShare: shareOf(reviews.items, (item) => item.hasPhotos),
        localGuideShare: shareOf(
          reviews.items,
          (item) => item.authorIsLocalGuide,
        ),
        lowActivityShare: shareOf(reviews.items, (item) =>
          item.authorReviewCount === null
            ? null
            : item.authorReviewCount < GBP_REPUTATION_LOW_ACTIVITY_REVIEWS,
        ),
      },
    },
  }
}

function readHistory(
  reviews: GbpReviewSummary,
  distribution: GbpRatingDistribution | null,
  sample: GbpReputationSample,
  ratedSum: number,
): GbpReputationHistory {
  // Amostra por relevância não é o começo da série — subtrair produziria lixo
  // com aparência de número. Vale para todo snapshot vindo do SerpAPI.
  if (reviews.sortBy !== "newest") {
    return { status: "blocked", reason: "not_chronological" }
  }
  if (!distribution) return { status: "blocked", reason: "no_distribution" }
  if (sample.ratedCount === 0 || sample.average === null) {
    return { status: "blocked", reason: "no_rated_reviews" }
  }

  const total = ratingTotal(distribution)

  // A distribuição vem de `my_business_info` e as avaliações de outra chamada.
  // O total declarado na própria coleta das avaliações é a régua direta dessa
  // dessincronia; antes ela só era percebida quando a subtração já tinha saído
  // fora da escala.
  if (reviews.total !== null && total > 0) {
    const drift = Math.abs(reviews.total - total) / total
    if (drift > GBP_REPUTATION_SYNC_TOLERANCE) {
      return { status: "blocked", reason: "out_of_sync" }
    }
  }

  const priorCount = total - sample.ratedCount
  if (priorCount <= 0) {
    return { status: "blocked", reason: "sample_covers_all" }
  }

  const priorSum = ratingSum(distribution) - ratedSum
  const priorAverage = priorSum / priorCount
  // Rede final: média fora de 1–5 só acontece quando os dois lados descrevem
  // momentos diferentes, e uma média de 6,2 estrelas é pior que nenhuma.
  if (priorAverage < 1 || priorAverage > 5) {
    return { status: "blocked", reason: "out_of_sync" }
  }

  return {
    status: "ok",
    total,
    recentCount: sample.ratedCount,
    recentAverage: sample.average,
    priorCount,
    priorAverage,
  }
}

export function gbpReputation(input: {
  reviews: GbpReviewSummary | null
  distribution: GbpRatingDistribution | null
  /** Referência de "hoje", recebida em vez de lida, para a função ser pura. */
  today: string
}): GbpReputation | null {
  if (!input.reviews || input.reviews.items.length === 0) return null
  const nowMs = Date.parse(input.today)
  const { sample, ratedSum } = readSample(
    input.reviews,
    Number.isFinite(nowMs) ? nowMs : Date.now(),
  )
  return {
    sample,
    history: readHistory(input.reviews, input.distribution, sample, ratedSum),
  }
}
