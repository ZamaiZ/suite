import {
  type VisibilityAdsCompetition,
  type VisibilityIntent,
  type VisibilityKeywordRow,
  type VisibilitySource,
  VISIBILITY_INTENT_LABELS,
  VISIBILITY_INTENT_MIN_PROBABILITY,
  VISIBILITY_STALE_SERP_DAYS,
} from "./visibility-audit.ts"

export function visibilitySourceLabel(source: VisibilitySource): string {
  if (source === "dataforseo_labs") return "DataForSEO · índice"
  return "SerpAPI · checagem ao vivo"
}

export function formatVisibilityMetric(
  value: number | null,
  digits = 0,
): string {
  if (value === null) return "—"
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  })
}

/**
 * Rótulo curto da disputa do Google Ads. Cabe na célula, e é sinal separado do
 * KD — não uma tradução dele. Onde o KD tem buraco, este costuma ter resposta.
 */
export function visibilityAdsCompetitionLabel(
  value: VisibilityAdsCompetition,
): string {
  if (value === "LOW") return "baixa"
  if (value === "MEDIUM") return "média"
  return "alta"
}

/** Dias entre a data do índice e a da coleta. `null` quando falta qualquer uma. */
export function visibilityRowAgeDays(
  updatedAt: string | null,
  collectedAt: string,
): number | null {
  if (!updatedAt) return null
  const ms = Date.parse(collectedAt) - Date.parse(updatedAt)
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 86_400_000)) : null
}

/**
 * Linha velha continua na tabela, mas esmaecida: some seria pior, porque a
 * keyword provavelmente ainda ranqueia — o que não se sabe é a posição de hoje.
 */
export function isVisibilityRowStale(
  updatedAt: string | null,
  collectedAt: string,
): boolean {
  const days = visibilityRowAgeDays(updatedAt, collectedAt)
  return days !== null && days > VISIBILITY_STALE_SERP_DAYS
}

/**
 * Cala abaixo do limiar. Antes a tela mostrava uma letra — `T`, `C`, `I`, `N` —
 * e uma classificação de 0,37 ficava visualmente idêntica a uma de 0,98.
 *
 * `probability: null` é linha v1, que não tinha o dado: ela escapa do limiar e
 * mostra o rótulo que tinha, em vez de sumir de repente num snapshot antigo.
 */
export function visibilityIntentLabel(intent: VisibilityIntent | null): string {
  if (!intent) return "—"
  if (
    intent.probability !== null &&
    intent.probability < VISIBILITY_INTENT_MIN_PROBABILITY
  ) {
    return "—"
  }
  return VISIBILITY_INTENT_LABELS[intent.label] ?? "—"
}

/** Texto do `title`: a probabilidade e as intenções secundárias medidas. */
export function visibilityIntentDetail(
  intent: VisibilityIntent | null,
): string {
  if (!intent) return "Intenção não coletada"
  const parts = [
    intent.probability === null
      ? VISIBILITY_INTENT_LABELS[intent.label]
      : `${VISIBILITY_INTENT_LABELS[intent.label]} · ${Math.round(intent.probability * 100)}%`,
  ]
  for (const item of intent.secondary) {
    parts.push(`${item.label} · ${Math.round(item.probability * 100)}%`)
  }
  return parts.join(" | ")
}

/**
 * Os recursos de SERP que viram ícone na linha.
 *
 * Sete, não catorze, e o corte tem critério: **feature presente em quase toda
 * SERP não é sinal.** Medido em 2026-09-10 sobre 110 SERPs — `related_searches`
 * aparece em 92% e `breadcrumb` em 100%, então um ícone para eles acenderia
 * sempre e viraria decoração. Os que ficaram acendem entre 1% e 83%, e quando
 * acendem querem dizer alguma coisa.
 *
 * `people_also_ask` entra a pedido, mesmo acendendo em 83%: é o mais fraco dos
 * sete como discriminante, e vale saber disso ao ler a coluna.
 */
export const VISIBILITY_SERP_FEATURES: ReadonlyArray<{
  id: string
  label: string
  /** Presença medida em 2026-09-10, para calibrar a leitura. */
  share: string
}> = [
  { id: "featured_snippet", label: "Featured snippet", share: "1%" },
  { id: "local_pack", label: "Pacote local", share: "16%" },
  { id: "popular_products", label: "Shopping", share: "24%" },
  { id: "knowledge_graph", label: "Knowledge graph", share: "32%" },
  { id: "ai_overview", label: "AI Overview", share: "45%" },
  { id: "people_also_ask", label: "Perguntas relacionadas", share: "83%" },
]

export type VisibilityRowFlag = {
  id: string
  label: string
  /** `feature` é o que a SERP tem; `quality` é ressalva sobre o próprio dado. */
  kind: "feature" | "quality"
}

/**
 * Tudo que a linha precisa anunciar, numa lista só — os recursos da SERP mais
 * as ressalvas sobre o dado. Um tooltip por linha lê daqui, em vez de cada
 * ícone carregar o próprio texto.
 */
export function visibilityRowFlags(
  row: VisibilityKeywordRow,
  collectedAt: string,
): VisibilityRowFlag[] {
  const flags: VisibilityRowFlag[] = []
  for (const feature of VISIBILITY_SERP_FEATURES) {
    if (row.serpFeatures.includes(feature.id)) {
      flags.push({ id: feature.id, label: feature.label, kind: "feature" })
    }
  }
  // O esmaecimento sozinho é aviso só visual — não existe para leitor de tela
  // e some num print em escala de cinza. O flag põe a idade em texto, dentro do
  // tooltip que a linha já tem.
  const age = visibilityRowAgeDays(row.position.updatedAt, collectedAt)
  if (age !== null && age > VISIBILITY_STALE_SERP_DAYS) {
    flags.push({
      id: "stale",
      label: `Posição de ${age.toLocaleString("pt-BR")} dias atrás`,
      kind: "quality",
    })
  }
  if (row.languageMismatch) {
    flags.push({
      id: "language_mismatch",
      label: "Idioma detectado diverge do da coleta",
      kind: "quality",
    })
  }
  return flags
}
