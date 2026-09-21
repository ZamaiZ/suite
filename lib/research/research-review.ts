/**
 * Julgamento do analista sobre a pesquisa. Puro.
 *
 * Mora fora do snapshot pelo mesmo argumento das migrations `20260919`,
 * `20260926` e `20260928`: a coleta é append-only, e julgamento gravado junto
 * com ela seria versionado a cada execução e duplicado, sem resposta para "qual
 * das cópias vale?".
 *
 * **A máquina não escreve aqui.** Campo em branco do analista é ausência de
 * julgamento, nunca aprovação — e é por isso que `verdict` nasce `null` e não
 * `"ok"`.
 */

import type { ResearchCluster } from "./types.ts"

/** As dimensões que um analista julga numa pesquisa. */
export const RESEARCH_REVIEW_DIMENSIONS = [
  "clusters",
  "competitors",
  "verdicts",
  "locality",
  "other",
] as const

export type ResearchReviewDimension =
  (typeof RESEARCH_REVIEW_DIMENSIONS)[number]

/** `null` é **não julgado**. Nunca confundir com `ok`. */
export type ReviewVerdict = "ok" | "attention" | "problem" | null

export type ReviewEntry = {
  verdict: ReviewVerdict
  note: string
  updatedAt: string | null
  updatedBy: string | null
}

export type ResearchReview = Record<ResearchReviewDimension, ReviewEntry>

/** `clusterId` → nome dado pelo analista. */
export type ClusterNames = Record<string, string>

export function emptyReviewEntry(): ReviewEntry {
  return { verdict: null, note: "", updatedAt: null, updatedBy: null }
}

export function emptyResearchReview(): ResearchReview {
  const review = {} as ResearchReview
  for (const dimensao of RESEARCH_REVIEW_DIMENSIONS) {
    review[dimensao] = emptyReviewEntry()
  }
  return review
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function asTextOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null
  const texto = value.trim()
  return texto ? texto : null
}

function asVerdict(value: unknown): ReviewVerdict {
  return value === "ok" || value === "attention" || value === "problem"
    ? value
    : null
}

/**
 * Lê o jsonb gravado, tolerando o passado.
 *
 * Dimensão nova entra vazia em review antigo, e dimensão que já não existe é
 * ignorada — sem isso, acrescentar uma dimensão quebraria toda pesquisa já
 * julgada.
 */
export function readResearchReview(value: unknown): ResearchReview {
  const bruto = asRecord(value)
  const review = emptyResearchReview()

  for (const dimensao of RESEARCH_REVIEW_DIMENSIONS) {
    const entrada = asRecord(bruto[dimensao])
    review[dimensao] = {
      verdict: asVerdict(entrada.verdict),
      note: asText(entrada.note),
      updatedAt: asTextOrNull(entrada.updatedAt),
      updatedBy: asTextOrNull(entrada.updatedBy),
    }
  }

  return review
}

export function readClusterNames(value: unknown): ClusterNames {
  const bruto = asRecord(value)
  const nomes: ClusterNames = {}
  for (const [id, nome] of Object.entries(bruto)) {
    const texto = asTextOrNull(nome)
    if (texto) nomes[id] = texto
  }
  return nomes
}

/**
 * O rótulo que a tela mostra para um cluster.
 *
 * O nome do analista vence; sem ele, a keyword de maior volume serve de
 * rótulo automático. O agrupamento é determinístico e recalculável, mas o nome
 * é leitura humana — e recoletar não pode apagá-la.
 */
export function clusterLabel(
  cluster: ResearchCluster,
  names: ClusterNames,
): string {
  return names[cluster.id]?.trim() || cluster.headKeyword
}

/** Quantos clusters ainda esperam nome. Alimenta o "falta o quê" da tela. */
export function unnamedClusters(
  clusters: ResearchCluster[],
  names: ClusterNames,
): ResearchCluster[] {
  return clusters.filter((c) => !names[c.id]?.trim())
}

export type ReviewProgress = {
  total: number
  judged: number
  pending: number
  problems: number
  complete: boolean
}

/**
 * Progresso do julgamento.
 *
 * `other` fica fora da conta de obrigatórias: é campo livre, e exigir
 * julgamento dele travaria a revisão por uma dimensão que só existe para o que
 * não coube nas outras.
 */
export function reviewProgress(review: ResearchReview): ReviewProgress {
  const obrigatorias = RESEARCH_REVIEW_DIMENSIONS.filter((d) => d !== "other")
  const julgadas = obrigatorias.filter((d) => review[d].verdict !== null)
  const problemas = RESEARCH_REVIEW_DIMENSIONS.filter(
    (d) => review[d].verdict === "problem",
  )

  return {
    total: obrigatorias.length,
    judged: julgadas.length,
    pending: obrigatorias.length - julgadas.length,
    problems: problemas.length,
    complete: julgadas.length === obrigatorias.length,
  }
}

/**
 * Aplica um julgamento, preservando o que não foi tocado.
 *
 * Devolve objeto novo: mutar o review lido faria duas telas abertas
 * divergirem sem que nada acusasse.
 */
export function applyReview(
  review: ResearchReview,
  dimension: ResearchReviewDimension,
  patch: { verdict?: ReviewVerdict; note?: string },
  actor: { id: string; at: string },
): ResearchReview {
  const atual = review[dimension]
  const proximo: ReviewEntry = {
    verdict: patch.verdict !== undefined ? patch.verdict : atual.verdict,
    note: patch.note !== undefined ? patch.note : atual.note,
    updatedAt: actor.at,
    updatedBy: actor.id,
  }
  return { ...review, [dimension]: proximo }
}
