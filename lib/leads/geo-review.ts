/**
 * Julgamento do analista na etapa de Presença em IA.
 *
 * Vive em `lead_geo_reviews`, por lead, e **não** dentro do snapshot:
 * `lead_geo_audits` é append-only, e julgamento humano gravado ali seria
 * versionado junto com a coleta e duplicado a cada análise. Mesmo desenho de
 * `visibility-review.ts`.
 *
 * Três critérios, e cada um existe porque **não há dado que responda**: nenhum
 * campo de API diz se a página deixa claro que entidade ela representa. Não é
 * espaço sobrando na tela — é a fronteira do que a máquina alcança.
 *
 * Nenhuma LLM julga isto. A decisão é explícita: nesta etapa a LLM é objeto de
 * medição, nunca instrumento de análise.
 */

export const GEO_REVIEW_NOTE_MAX = 400

export const GEO_REVIEW_CRITERION_IDS = [
  "entity_definition",
  "citation_readiness",
  "authority_trust",
  "other",
] as const

export type GeoReviewCriterionId = (typeof GEO_REVIEW_CRITERION_IDS)[number]

export type GeoReviewVerdict = "ok" | "issue" | "na"

export type GeoReviewAnswer = {
  verdict: GeoReviewVerdict | null
  note: string
  updatedAt: string | null
  updatedBy: string | null
}

export type GeoReview = Record<GeoReviewCriterionId, GeoReviewAnswer>

export type GeoReviewImpact = "high" | "medium"

export type GeoReviewCriterion = {
  id: GeoReviewCriterionId
  label: string
  /** Vira o título da oportunidade quando o veredito é `issue`. */
  title: string
  impact: GeoReviewImpact
  allowsNa: boolean
  hasVerdict: boolean
  placeholder: string
}

export const GEO_REVIEW_VERDICT_LABEL: Record<GeoReviewVerdict, string> = {
  ok: "Ok",
  issue: "Problema",
  na: "N/A",
}

/**
 * Os critérios que entram no denominador do progresso. `other` fica de fora:
 * é nota livre, sem veredito, e contá-lo faria a etapa nunca chegar a 100%.
 */
export const GEO_REVIEW_CHIP_IDS = [
  "entity_definition",
  "citation_readiness",
  "authority_trust",
] as const satisfies readonly GeoReviewCriterionId[]

export const GEO_REVIEW_CATALOG: readonly GeoReviewCriterion[] = [
  {
    id: "entity_definition",
    label: "Definição de entidade",
    title: "Deixar claro que empresa a página representa",
    impact: "high",
    allowsNa: false,
    hasVerdict: true,
    placeholder:
      "A home diz em uma frase o que a empresa faz, para quem e onde?",
  },
  {
    id: "citation_readiness",
    label: "Pronto para ser citado",
    title: "Criar fatos citáveis no conteúdo",
    impact: "medium",
    allowsNa: false,
    hasVerdict: true,
    placeholder:
      "Existe número, prazo ou frase autocontida que uma IA possa citar sem reescrever?",
  },
  {
    id: "authority_trust",
    label: "Autoridade e confiança",
    title: "Expor prova de autoridade verificável",
    impact: "medium",
    allowsNa: false,
    hasVerdict: true,
    placeholder:
      "Tempo de mercado, certificação, licença, prova social com fonte?",
  },
  {
    id: "other",
    label: "Outras observações",
    title: "",
    impact: "medium",
    allowsNa: false,
    hasVerdict: false,
    placeholder: "O que mais chamou atenção e não cabe nos itens acima.",
  },
]

export function emptyGeoReviewAnswer(): GeoReviewAnswer {
  return { verdict: null, note: "", updatedAt: null, updatedBy: null }
}

export function emptyGeoReview(): GeoReview {
  const review = {} as GeoReview
  for (const id of GEO_REVIEW_CRITERION_IDS) {
    review[id] = emptyGeoReviewAnswer()
  }
  return review
}

export type GeoPromptSetItem = {
  id: string
  text: string
  family: "discovery" | "problem" | "comparison" | "brand"
}

export type GeoPromptSet = {
  version: number
  fixedAt: string
  items: GeoPromptSetItem[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

const FAMILIES = new Set(["discovery", "problem", "comparison", "brand"])

/**
 * `null` significa **não fixado**, nunca "fixado e vazio".
 *
 * O conjunto de prompts é fixado na primeira sondagem e reusado depois, pelo
 * mesmo motivo que `audit_paths` fixou a amostra de páginas: prompt que muda
 * entre coletas transforma taxa de menção em número sem significado.
 */
export function readGeoPromptSet(value: unknown): GeoPromptSet | null {
  const row = asRecord(value)
  if (!row) return null
  const fixedAt = asString(row.fixedAt)
  if (!fixedAt || !Array.isArray(row.items)) return null
  const items = row.items.flatMap((entry) => {
    const item = asRecord(entry)
    const id = asString(item?.id)
    const text = asString(item?.text)
    const family = asString(item?.family)
    if (!id || !text || !family || !FAMILIES.has(family)) return []
    return [{ id, text, family: family as GeoPromptSetItem["family"] }]
  })
  if (items.length === 0) return null
  return {
    version:
      typeof row.version === "number" && Number.isFinite(row.version)
        ? row.version
        : 1,
    fixedAt,
    items,
  }
}

/**
 * Lê o objeto de review isolado, venha ele do banco ou do JSON do formulário.
 * Nunca inventa veredito: campo em branco continua em branco, porque ausência
 * de resposta não é ausência de problema.
 */
export function readGeoReview(value: unknown): GeoReview {
  const review = emptyGeoReview()
  const raw = asRecord(value)
  if (!raw) return review
  for (const id of GEO_REVIEW_CRITERION_IDS) {
    const answer = asRecord(raw[id])
    if (!answer) continue
    const verdict = asString(answer.verdict)
    review[id] = {
      verdict:
        verdict === "ok" || verdict === "issue" || verdict === "na"
          ? verdict
          : null,
      note: asString(answer.note) ?? "",
      updatedAt: asString(answer.updatedAt),
      updatedBy: asString(answer.updatedBy),
    }
  }
  return review
}

/**
 * Carimba autor e data **por critério**, e só nos que foram respondidos.
 *
 * Critério em branco fica sem carimbo: marcar todos a cada salvamento faria
 * parecer que o analista revisou tudo agora, e a data por critério é o que
 * permite saber quando cada julgamento foi dado.
 */
export function stampGeoReview(
  review: GeoReview,
  userId: string,
  updatedAt: string,
): GeoReview {
  const next = emptyGeoReview()
  for (const id of GEO_REVIEW_CRITERION_IDS) {
    const answer = review[id]
    const answered = answer.verdict !== null || answer.note.trim().length > 0
    next[id] = {
      verdict: answer.verdict,
      note: answer.note,
      updatedAt: answered ? updatedAt : null,
      updatedBy: answered ? userId : null,
    }
  }
  return next
}

export function geoReviewProgress(review: GeoReview): {
  done: number
  total: number
} {
  const done = GEO_REVIEW_CHIP_IDS.filter(
    (id) => review[id].verdict !== null,
  ).length
  return { done, total: GEO_REVIEW_CHIP_IDS.length }
}

export type LeadGeoReview = {
  review: GeoReview
  /** `null` = nunca sondado. Ver `readGeoPromptSet`. */
  promptSet: GeoPromptSet | null
  notes: string | null
  updated_at: string | null
  updated_by: string | null
}

export function emptyLeadGeoReview(): LeadGeoReview {
  return {
    review: emptyGeoReview(),
    promptSet: null,
    notes: null,
    updated_at: null,
    updated_by: null,
  }
}

/** Linha ausente lê como review vazio — lead nunca julgado não gera gap. */
export function readLeadGeoReviewRow(
  row: Record<string, unknown> | null,
): LeadGeoReview {
  if (!row) return emptyLeadGeoReview()
  return {
    review: readGeoReview(row.review),
    promptSet: readGeoPromptSet(row.prompt_set),
    notes: asString(row.notes),
    updated_at: asString(row.updated_at),
    updated_by: asString(row.updated_by),
  }
}

/**
 * Rascunho de edição: o mesmo julgamento sem carimbo.
 *
 * O carimbo é do servidor. Mantê-lo no rascunho faria a comparação de "mudou
 * alguma coisa?" acusar diferença a cada salvamento, e o autosave entraria em
 * laço gravando o que já estava gravado.
 */
export function geoReviewDraft(review: GeoReview): GeoReview {
  const next = emptyGeoReview()
  for (const id of GEO_REVIEW_CRITERION_IDS) {
    next[id] = {
      verdict: review[id].verdict,
      note: review[id].note,
      updatedAt: null,
      updatedBy: null,
    }
  }
  return next
}

export function serializeGeoReviewDraft(review: GeoReview): string {
  const payload: Record<
    string,
    { verdict: GeoReviewVerdict | null; note: string }
  > = {}
  for (const id of GEO_REVIEW_CRITERION_IDS) {
    payload[id] = { verdict: review[id].verdict, note: review[id].note }
  }
  return JSON.stringify(payload)
}
