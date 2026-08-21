export const WEBSITE_REVIEW_NOTE_MAX = 400

export const WEBSITE_REVIEW_CRITERION_IDS = [
  "design",
  "cta_visible",
  "narrow_layout",
  "sample_pages",
  "nap_group",
  "content_quality",
  "other",
] as const

export type WebsiteReviewCriterionId =
  (typeof WEBSITE_REVIEW_CRITERION_IDS)[number]

export type WebsiteReviewVerdict = "ok" | "issue" | "na"

export type WebsiteReviewAnswer = {
  verdict: WebsiteReviewVerdict | null
  note: string
  updatedAt: string | null
  updatedBy: string | null
}

export type WebsiteReview = Record<
  WebsiteReviewCriterionId,
  WebsiteReviewAnswer
>

export type WebsiteReviewImpact = "high" | "medium"

export type WebsiteReviewCriterion = {
  id: WebsiteReviewCriterionId
  label: string
  title: string
  impact: WebsiteReviewImpact
  allowsNa: boolean
  hasVerdict: boolean
  placeholder: string
}

export const WEBSITE_REVIEW_VERDICT_LABEL: Record<
  WebsiteReviewVerdict,
  string
> = {
  ok: "Ok",
  issue: "Problema",
  na: "N/A",
}

export const WEBSITE_REVIEW_CHIP_IDS = [
  "design",
  "cta_visible",
  "narrow_layout",
  "sample_pages",
  "nap_group",
  "content_quality",
] as const satisfies readonly WebsiteReviewCriterionId[]

export const WEBSITE_REVIEW_CATALOG: readonly WebsiteReviewCriterion[] = [
  {
    id: "design",
    label: "Design e layout",
    title: "Melhorar confiança do layout",
    impact: "high",
    allowsNa: false,
    hasVerdict: true,
    placeholder: "O layout transmite confiança?",
  },
  {
    id: "cta_visible",
    label: "CTA visível nas telas",
    title: "Destacar o CTA nas telas",
    impact: "high",
    allowsNa: false,
    hasVerdict: true,
    placeholder: "O botão existe no HTML, mas some no print?",
  },
  {
    id: "narrow_layout",
    label: "Layout em tela estreita",
    title: "Corrigir layout em tela estreita",
    impact: "high",
    allowsNa: false,
    hasVerdict: true,
    placeholder: "O layout quebra abaixo de 1024px?",
  },
  {
    id: "sample_pages",
    label: "Páginas de serviço e local",
    title: "Criar páginas de serviço e local",
    impact: "medium",
    allowsNa: false,
    hasVerdict: true,
    placeholder: "Essas URLs são serviço ou local de verdade?",
  },
  {
    id: "nap_group",
    label: "NAP se houver mais de um ponto",
    title: "Alinhar NAP entre as unidades",
    impact: "medium",
    allowsNa: true,
    hasVerdict: true,
    placeholder: "O endereço do grupo bate com o perfil?",
  },
  {
    id: "content_quality",
    label: "Conteúdo vs chrome",
    title: "Tratar conteúdo raso ou só chrome",
    impact: "medium",
    allowsNa: false,
    hasVerdict: true,
    placeholder: "As palavras são conteúdo ou só estrutura da página?",
  },
  {
    id: "other",
    label: "Outro achado",
    title: "Registrar achado visual",
    impact: "medium",
    allowsNa: false,
    hasVerdict: false,
    placeholder: "Algo que a coleta não viu",
  },
] as const

export const WEBSITE_REVIEW_CRITERION_BY_ID: Record<
  WebsiteReviewCriterionId,
  WebsiteReviewCriterion
> = Object.fromEntries(
  WEBSITE_REVIEW_CATALOG.map((item) => [item.id, item]),
) as Record<WebsiteReviewCriterionId, WebsiteReviewCriterion>

const VERDICTS = new Set<WebsiteReviewVerdict>(["ok", "issue", "na"])

function emptyAnswer(): WebsiteReviewAnswer {
  return {
    verdict: null,
    note: "",
    updatedAt: null,
    updatedBy: null,
  }
}

export function emptyWebsiteReview(): WebsiteReview {
  return {
    design: emptyAnswer(),
    cta_visible: emptyAnswer(),
    narrow_layout: emptyAnswer(),
    sample_pages: emptyAnswer(),
    nap_group: emptyAnswer(),
    content_quality: emptyAnswer(),
    other: emptyAnswer(),
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function readVerdict(
  value: unknown,
  allowsNa: boolean,
): WebsiteReviewVerdict | null {
  if (value === null || value === undefined) return null
  if (typeof value !== "string" || !VERDICTS.has(value as WebsiteReviewVerdict)) {
    return null
  }
  const verdict = value as WebsiteReviewVerdict
  if (verdict === "na" && !allowsNa) return null
  return verdict
}

function readNote(value: unknown): string {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  if (trimmed.length <= WEBSITE_REVIEW_NOTE_MAX) return trimmed
  return trimmed.slice(0, WEBSITE_REVIEW_NOTE_MAX)
}

function isReviewEmpty(review: WebsiteReview): boolean {
  return WEBSITE_REVIEW_CRITERION_IDS.every((id) => {
    const answer = review[id]
    return answer.verdict === null && answer.note.length === 0
  })
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function readWebsiteReview(
  value: unknown,
  fallbackNotes: string | null = null,
): WebsiteReview {
  const review = emptyWebsiteReview()
  const row = objectRecord(value)
  if (row) {
    for (const criterion of WEBSITE_REVIEW_CATALOG) {
      const item = objectRecord(row[criterion.id])
      if (!item) continue
      const verdict = criterion.hasVerdict
        ? readVerdict(item.verdict, criterion.allowsNa)
        : null
      review[criterion.id] = {
        verdict,
        note: readNote(item.note),
        updatedAt: asString(item.updatedAt),
        updatedBy: asString(item.updatedBy),
      }
    }
  }
  if (isReviewEmpty(review) && fallbackNotes) {
    review.other = {
      ...emptyAnswer(),
      note: readNote(fallbackNotes),
    }
  }
  return review
}

export function websiteReviewDraft(review: WebsiteReview): WebsiteReview {
  const next = emptyWebsiteReview()
  for (const id of WEBSITE_REVIEW_CRITERION_IDS) {
    next[id] = {
      verdict: review[id].verdict,
      note: review[id].note,
      updatedAt: null,
      updatedBy: null,
    }
  }
  return next
}

export function serializeWebsiteReviewDraft(review: WebsiteReview): string {
  const payload: Record<
    string,
    { verdict: WebsiteReviewVerdict | null; note: string }
  > = {}
  for (const id of WEBSITE_REVIEW_CRITERION_IDS) {
    payload[id] = { verdict: review[id].verdict, note: review[id].note }
  }
  return JSON.stringify(payload)
}

export function stampWebsiteReview(
  review: WebsiteReview,
  userId: string,
  updatedAt: string,
): WebsiteReview {
  const next = emptyWebsiteReview()
  for (const id of WEBSITE_REVIEW_CRITERION_IDS) {
    next[id] = {
      verdict: review[id].verdict,
      note: review[id].note,
      updatedAt,
      updatedBy: userId,
    }
  }
  return next
}

export function websiteReviewProgress(review: WebsiteReview): {
  done: number
  total: number
} {
  const done = WEBSITE_REVIEW_CHIP_IDS.filter(
    (id) => review[id].verdict !== null,
  ).length
  return { done, total: WEBSITE_REVIEW_CHIP_IDS.length }
}

export function websiteReviewOpportunityId(
  id: WebsiteReviewCriterionId,
): string {
  return `review:${id}`
}

function noteReady(note: string): boolean {
  return note.trim().length > 0
}

export function websiteReviewHasOpportunity(
  criterion: WebsiteReviewCriterion,
  answer: WebsiteReviewAnswer,
): boolean {
  if (!criterion.hasVerdict) return noteReady(answer.note)
  return answer.verdict === "issue"
}
