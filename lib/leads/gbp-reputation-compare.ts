import type { GbpReviewSummary } from "./gbp-audit.ts"

/**
 * O que mudou entre duas coletas de avaliações.
 *
 * Perfil que **perde** avaliações é sinal de risco e era invisível: sem um
 * identificador por avaliação não havia como saber o que sumiu. `review_id`
 * resolve isso.
 *
 * Não custa consulta nem chamada — `GBP_SELECT` já traz todos os snapshots e o
 * anterior é escolhido em memória.
 */

export type GbpReputationDeltaBlock =
  | "no_previous"
  | "no_ids"
  | "not_chronological"

export type GbpReputationDelta =
  | {
      status: "ok"
      previousAt: string
      /** Novas desde a coleta anterior. */
      added: number
      /** Sumiram do perfil, e não apenas da amostra. */
      removed: number
      /** Variação da média da amostra. */
      averageDelta: number | null
      /** Variação do total declarado pelo perfil. */
      totalDelta: number | null
    }
  | { status: "blocked"; reason: GbpReputationDeltaBlock }

function idsOf(reviews: GbpReviewSummary): Set<string> {
  const ids = new Set<string>()
  for (const item of reviews.items) {
    if (item.id) ids.add(item.id)
  }
  return ids
}

function oldestPublishedAt(reviews: GbpReviewSummary): string | null {
  let oldest: string | null = null
  for (const item of reviews.items) {
    if (!item.publishedAt) continue
    if (oldest === null || item.publishedAt < oldest) oldest = item.publishedAt
  }
  return oldest
}

function averageOf(reviews: GbpReviewSummary): number | null {
  const ratings = reviews.items
    .map((item) => item.rating)
    .filter((value): value is number => value !== null)
  if (ratings.length === 0) return null
  return ratings.reduce((sum, value) => sum + value, 0) / ratings.length
}

export function gbpReputationDelta(input: {
  current: GbpReviewSummary | null
  previous: GbpReviewSummary | null
  previousAt: string | null
}): GbpReputationDelta {
  const { current, previous } = input
  if (!current || !previous || !input.previousAt) {
    return { status: "blocked", reason: "no_previous" }
  }
  if (current.sortBy !== "newest" || previous.sortBy !== "newest") {
    return { status: "blocked", reason: "not_chronological" }
  }

  const currentIds = idsOf(current)
  const previousIds = idsOf(previous)
  // Amostra sem identificador é anterior a este campo: sem ele, "sumiu" e
  // "nunca soubemos qual era" seriam indistinguíveis.
  if (currentIds.size === 0 || previousIds.size === 0) {
    return { status: "blocked", reason: "no_ids" }
  }

  let added = 0
  for (const id of currentIds) {
    if (!previousIds.has(id)) added += 1
  }

  /**
   * Só conta como removida a avaliação que **caberia** na amostra atual.
   *
   * A amostra é truncada por profundidade, então tudo mais antigo que a mais
   * antiga de agora está fora do alcance desta coleta — sumir da amostra não é
   * sumir do perfil. Sem este corte, mudar a profundidade de 50 para 200
   * acusaria dezenas de remoções que nunca aconteceram.
   */
  const horizon = oldestPublishedAt(current)
  let removed = 0
  for (const item of previous.items) {
    if (!item.id || currentIds.has(item.id)) continue
    if (!item.publishedAt) continue
    if (horizon !== null && item.publishedAt < horizon) continue
    removed += 1
  }

  const currentAverage = averageOf(current)
  const previousAverage = averageOf(previous)

  return {
    status: "ok",
    previousAt: input.previousAt,
    added,
    removed,
    averageDelta:
      currentAverage === null || previousAverage === null
        ? null
        : currentAverage - previousAverage,
    totalDelta:
      current.total === null || previous.total === null
        ? null
        : current.total - previous.total,
  }
}
