/**
 * Julgamento do analista na etapa de Visibilidade.
 *
 * Vive em `lead_visibility_reviews`, por lead, e **não** dentro do snapshot:
 * `lead_visibility_audits` é append-only, e julgamento humano gravado ali seria
 * versionado junto com a coleta e duplicado a cada análise. Mesmo desenho de
 * `website-review.ts`.
 *
 * Cada critério existe porque a máquina **erra de um jeito conhecido** naquele
 * ponto — não porque sobrou espaço na tela.
 */

export const VISIBILITY_NOTES_MAX = 2000
export const VISIBILITY_REVIEW_NOTE_MAX = 400

export const VISIBILITY_REVIEW_CRITERION_IDS = [
  "host_intent",
  "brand_terms",
  "cannibalization",
  "local_fit",
  "other",
] as const

export type VisibilityReviewCriterionId =
  (typeof VISIBILITY_REVIEW_CRITERION_IDS)[number]

export type VisibilityReviewVerdict = "ok" | "issue" | "na"

export type VisibilityReviewAnswer = {
  verdict: VisibilityReviewVerdict | null
  note: string
  updatedAt: string | null
  updatedBy: string | null
}

export type VisibilityReview = Record<
  VisibilityReviewCriterionId,
  VisibilityReviewAnswer
>

export type VisibilityReviewImpact = "high" | "medium"

export type VisibilityReviewCriterion = {
  id: VisibilityReviewCriterionId
  label: string
  /** Vira o título da oportunidade quando o veredito é `issue`. */
  title: string
  impact: VisibilityReviewImpact
  allowsNa: boolean
  hasVerdict: boolean
  placeholder: string
}

export const VISIBILITY_REVIEW_VERDICT_LABEL: Record<
  VisibilityReviewVerdict,
  string
> = {
  ok: "Ok",
  issue: "Problema",
  na: "N/A",
}

/**
 * Os critérios que entram no denominador do progresso. `other` fica de fora:
 * é nota livre, sem veredito, e contá-lo faria a etapa nunca chegar a 100%.
 */
export const VISIBILITY_REVIEW_CHIP_IDS = [
  "host_intent",
  "brand_terms",
  "cannibalization",
  "local_fit",
] as const satisfies readonly VisibilityReviewCriterionId[]

export const VISIBILITY_REVIEW_CATALOG: readonly VisibilityReviewCriterion[] = [
  {
    id: "host_intent",
    label: "Subdomínio fora do principal",
    title: "Consolidar o tráfego no domínio principal",
    impact: "high",
    allowsNa: true,
    hasVerdict: true,
    // A máquina vê o host; só o humano sabe se ele é homologação, ambiente de
    // cliente ou produto de verdade. No primeiro lead medido, 77 das 110
    // keywords ranqueavam num `aprov.` — e nenhum dado dizia o que ele era.
    placeholder: "Esse host é homologação, cliente ou produto?",
  },
  {
    id: "brand_terms",
    label: "Termos de marca",
    title: "Ranquear além dos termos de marca",
    impact: "high",
    allowsNa: false,
    hasVerdict: true,
    // `isBrandKeyword` casa por token do nome da empresa. "Busca Orgânica" é
    // literalmente um termo genérico — a heurística não separa marca de
    // categoria, e no top 10 essa diferença decide o diagnóstico.
    placeholder: "As keywords do topo são marca ou categoria?",
  },
  {
    id: "cannibalization",
    label: "Canibalização entre páginas",
    title: "Resolver páginas disputando a mesma busca",
    impact: "medium",
    allowsNa: false,
    hasVerdict: true,
    // `ranked_keywords` devolve uma linha por keyword. Duas páginas disputando
    // o mesmo termo é padrão *entre* linhas, que nenhuma regra por linha vê.
    placeholder: "Há duas URLs disputando a mesma busca?",
  },
  {
    id: "local_fit",
    label: "Aderência local",
    title: "Alinhar as buscas locais à região atendida",
    impact: "medium",
    allowsNa: true,
    hasVerdict: true,
    // `isLocalKeyword` casa `\bem\b` e o nome da cidade. Grosseiro por
    // construção, e cego para a região que o negócio de fato atende.
    placeholder: "As buscas locais batem com a área atendida?",
  },
  {
    id: "other",
    label: "Outro achado",
    title: "Tratar achado do analista",
    impact: "medium",
    allowsNa: false,
    hasVerdict: false,
    placeholder: "O que mais apareceu nesta coleta?",
  },
]

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function readVerdict(
  value: unknown,
  allowsNa: boolean,
): VisibilityReviewVerdict | null {
  if (value === "ok" || value === "issue") return value
  if (value === "na" && allowsNa) return "na"
  return null
}

function readNote(value: unknown): string {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  if (trimmed.length <= VISIBILITY_REVIEW_NOTE_MAX) return trimmed
  return trimmed.slice(0, VISIBILITY_REVIEW_NOTE_MAX)
}

function emptyAnswer(): VisibilityReviewAnswer {
  return { verdict: null, note: "", updatedAt: null, updatedBy: null }
}

export function emptyVisibilityReview(): VisibilityReview {
  return Object.fromEntries(
    VISIBILITY_REVIEW_CRITERION_IDS.map((id) => [id, emptyAnswer()]),
  ) as VisibilityReview
}

/**
 * Veredito fora do enum vira `null` e **não** derruba a nota junto: o texto que
 * o analista escreveu é o trabalho dele, e perdê-lo por causa de um campo
 * vizinho inválido seria o pior dos dois resultados.
 */
export function readVisibilityReview(value: unknown): VisibilityReview {
  const review = emptyVisibilityReview()
  const row = objectRecord(value)
  if (!row) return review
  for (const criterion of VISIBILITY_REVIEW_CATALOG) {
    const item = objectRecord(row[criterion.id])
    if (!item) continue
    review[criterion.id] = {
      verdict: criterion.hasVerdict
        ? readVerdict(item.verdict, criterion.allowsNa)
        : null,
      note: readNote(item.note),
      updatedAt: asString(item.updatedAt),
      updatedBy: asString(item.updatedBy),
    }
  }
  return review
}

export type LeadVisibilityReview = {
  review: VisibilityReview
  notes: string | null
  updated_at: string | null
  updated_by: string | null
}

export function emptyLeadVisibilityReview(): LeadVisibilityReview {
  return {
    review: emptyVisibilityReview(),
    notes: null,
    updated_at: null,
    updated_by: null,
  }
}

/**
 * Devolve o vazio quando a linha não existe — **nunca `null`**. Lead nunca
 * julgado não é lead com julgamento perdido: a tela precisa dos critérios em
 * branco para montar, e um `null` obrigaria cada consumidor a repetir o
 * fallback.
 */
export function readLeadVisibilityReviewRow(
  row: Record<string, unknown> | null | undefined,
): LeadVisibilityReview {
  if (!row) return emptyLeadVisibilityReview()
  return {
    review: readVisibilityReview(row.review),
    notes: asString(row.notes),
    updated_at: asString(row.updated_at),
    updated_by: asString(row.updated_by),
  }
}

/**
 * Só o que o analista de fato escolheu. Os carimbos saem: o rascunho da tela é
 * comparado com o do servidor para decidir se há o que salvar, e comparar
 * timestamps faria toda digitação parecer mudança.
 */
export function visibilityReviewDraft(
  review: VisibilityReview,
): VisibilityReview {
  const next = emptyVisibilityReview()
  for (const id of VISIBILITY_REVIEW_CRITERION_IDS) {
    next[id] = {
      verdict: review[id].verdict,
      note: review[id].note,
      updatedAt: null,
      updatedBy: null,
    }
  }
  return next
}

export function serializeVisibilityReviewDraft(
  review: VisibilityReview,
): string {
  const payload: Record<
    string,
    { verdict: VisibilityReviewVerdict | null; note: string }
  > = {}
  for (const id of VISIBILITY_REVIEW_CRITERION_IDS) {
    payload[id] = { verdict: review[id].verdict, note: review[id].note }
  }
  return JSON.stringify(payload)
}

/**
 * Carimba autor e data **só nos critérios que têm conteúdo**.
 *
 * Diverge de propósito de `stampWebsiteReview`, que carimba os sete de uma vez:
 * ali, um critério nunca tocado sai do banco dizendo que foi atualizado agora,
 * por este usuário. Numa etapa cujo trabalho inteiro foi parar de afirmar mais
 * do que o dado sustenta, um timestamp que mente sobre quem julgou o quê não
 * passa. Critério em branco continua com `updatedAt: null`.
 */
export function stampVisibilityReview(
  review: VisibilityReview,
  userId: string,
  updatedAt: string,
): VisibilityReview {
  const next = emptyVisibilityReview()
  for (const id of VISIBILITY_REVIEW_CRITERION_IDS) {
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

export function visibilityReviewProgress(review: VisibilityReview): {
  done: number
  total: number
} {
  const done = VISIBILITY_REVIEW_CHIP_IDS.filter(
    (id) => review[id].verdict !== null,
  ).length
  return { done, total: VISIBILITY_REVIEW_CHIP_IDS.length }
}

export function visibilityReviewOpportunityId(
  id: VisibilityReviewCriterionId,
): string {
  return `review:${id}`
}

function noteReady(note: string): boolean {
  return note.trim().length > 0
}

/**
 * Critério com veredito só vira oportunidade em `issue`. `other` não tem
 * veredito, então vale a nota. **Campo em branco não gera gap** — a etapa não
 * acusa o analista de não ter julgado ainda.
 */
export function visibilityReviewHasOpportunity(
  criterion: VisibilityReviewCriterion,
  answer: VisibilityReviewAnswer,
): boolean {
  if (!criterion.hasVerdict) return noteReady(answer.note)
  return answer.verdict === "issue"
}
