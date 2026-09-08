import type { GbpReviewSummary } from "./gbp-audit.ts"
import type { GbpRatingDistribution } from "./gbp-enrichment.ts"

/**
 * Leitura de reputação a partir de um snapshot só.
 *
 * A distribuição por estrela dá a soma exata de todas as notas do perfil; a
 * amostra cronológica dá a soma das mais recentes. Subtrair uma da outra revela
 * a média de tudo que veio antes — "nas 50 recentes a média é 4,1; nas 380
 * anteriores era 4,6" — sem precisar de histórico nenhum.
 *
 * O módulo é dividido em duas metades de propósito. A metade da amostra
 * (janelas, taxa de resposta) depende só das avaliações e sempre responde. A
 * metade histórica depende de duas chamadas diferentes se encontrarem, e por
 * isso pode bloquear — e quando bloqueia, diz por quê em vez de devolver um
 * número com aparência de verdade.
 */

/** Janelas medidas, em dias. */
export const GBP_REPUTATION_WINDOWS = [30, 60, 90] as const

export type GbpReputationWindowDays = (typeof GBP_REPUTATION_WINDOWS)[number]

export type GbpReputationWindow = {
  days: GbpReputationWindowDays
  count: number
  /**
   * `false` quando a amostra não alcança o início da janela: aí a contagem é um
   * piso, não um total, e apresentar como total mentiria.
   */
  complete: boolean
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
  repliedCount: number
  replyRate: number | null
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

function publishedMs(value: string | null): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

/**
 * Devolve a soma bruta das notas junto com a amostra: reconstruí-la depois a
 * partir da média multiplicada pela contagem acumularia erro de ponto
 * flutuante justo na subtração que dá o resultado.
 */
function readSample(
  reviews: GbpReviewSummary,
  nowMs: number,
): { sample: GbpReputationSample; ratedSum: number } {
  const ratings: number[] = []
  const timestamps: number[] = []
  for (const item of reviews.items) {
    if (item.rating !== null) ratings.push(item.rating)
    const ms = publishedMs(item.publishedAt)
    if (ms !== null) timestamps.push(ms)
  }

  const oldest = timestamps.length > 0 ? Math.min(...timestamps) : null
  const newest = timestamps.length > 0 ? Math.max(...timestamps) : null

  const windows = GBP_REPUTATION_WINDOWS.map((days) => {
    const start = nowMs - days * DAY_MS
    return {
      days,
      count: timestamps.filter((ms) => ms >= start).length,
      // A amostra é truncada em `GBP_REVIEW_DEPTH`. Se a mais antiga dela ainda
      // é mais nova que o início da janela, existem avaliações no período que
      // não vieram.
      complete: oldest !== null && oldest <= start,
    }
  })

  const ratedSum = ratings.reduce((sum, value) => sum + value, 0)

  return {
    ratedSum,
    sample: {
      size: reviews.items.length,
      ratedCount: ratings.length,
      average: ratings.length > 0 ? ratedSum / ratings.length : null,
      windows,
      spanDays:
        oldest !== null && newest !== null
          ? Math.round((newest - oldest) / DAY_MS)
          : null,
      repliedCount: reviews.replied,
      replyRate:
        reviews.sampled > 0 ? reviews.replied / reviews.sampled : null,
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
  const priorCount = total - sample.ratedCount
  if (priorCount <= 0) {
    return { status: "blocked", reason: "sample_covers_all" }
  }

  // A distribuição vem de `my_business_info` e as avaliações de um job
  // separado, disparado depois. Quando as duas descrevem momentos diferentes a
  // subtração sai fora da escala — e uma média de 6,2 estrelas é pior que
  // nenhuma.
  const priorSum = ratingSum(distribution) - ratedSum
  const priorAverage = priorSum / priorCount
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
    history: readHistory(
      input.reviews,
      input.distribution,
      sample,
      ratedSum,
    ),
  }
}
