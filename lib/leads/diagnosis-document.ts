export const DIAGNOSIS_PILLARS = [
  "google",
  "website",
  "presence",
  "visibility",
  "geo",
] as const

export type DiagnosisPillar = (typeof DIAGNOSIS_PILLARS)[number]

export const DIAGNOSIS_PILLAR_LABELS: Record<DiagnosisPillar, string> = {
  google: "Perfil no Google",
  website: "Website",
  presence: "Presença digital",
  visibility: "Visibilidade",
  geo: "Presença em IA",
}

export type DiagnosisImpact = "high" | "medium"

export type DiagnosisSourceLabel =
  | "Google Places"
  | "DataForSEO"
  | "SerpAPI"
  | "PageSpeed Insights"
  | "Coleta do site"
  | "Revisão do analista"

export type DiagnosisOpportunityRef = {
  id: string
  title: string
  impact: DiagnosisImpact
  source: "machine" | "analyst"
  detail?: string
}

export type DiagnosisKeyMetric = {
  id: string
  label: string
  value: string
}

export type DiagnosisPillarScore = {
  score: number
  highCount: number
  mediumCount: number
  /**
   * Pilar sem coleta não pontua 100.
   *
   * `emptyPillarScore()` devolvia `score: 100`, e um pilar vazio afirmava
   * perfeição. Enquanto os quatro pilares originais eram sempre medidos — o
   * Diagnóstico só destrava com as cinco etapas prontas — o defeito ficava
   * latente. Com um quinto pilar e documentos já salvos que não têm a chave
   * `geo`, ele passa a aparecer no relatório do cliente: `readFacts` resolve
   * pilar ausente com `emptyPillarScore()`, e o lead ganharia nota cheia numa
   * dimensão que ninguém mediu.
   */
  measured: boolean
}

export type DiagnosisFinding = {
  id: string
  title: string
  detail: string
  pillars: DiagnosisPillar[]
}

/**
 * O que está bom, com o número que prova. Exibição apenas: não entra em
 * `scorePillarOpportunities()`, senão o scorecard passaria a somar duas escalas
 * e o score de todo lead já auditado mudaria de significado.
 */
export type DiagnosisStrength = {
  id: string
  title: string
  pillar: DiagnosisPillar
  detail: string
}

export type DiagnosisRoadmapItem = {
  id: string
  pillar: DiagnosisPillar
  title: string
  impact: DiagnosisImpact
  evidence: string
}

export type DiagnosisPillarFacts = {
  opportunities: DiagnosisOpportunityRef[]
  keyMetrics: DiagnosisKeyMetric[]
}

/**
 * A evidência de Presença em IA que vai no documento do cliente.
 *
 * **É a parte que o lead reconhece.** Uma pergunta que alguém de fato fez a uma
 * IA, e a frase que a IA copiou do site dele, valem mais num documento
 * comercial que qualquer nota de pilar — é o que o relatório de referência faz
 * nas seções de citação, e o que os indicadores agregados não conseguem dizer.
 *
 * Opcional, e **ausente quando não foi coletada**. Seção vazia num documento
 * comercial lê como fraqueza do lead, não como lacuna da nossa auditoria.
 */
export type DiagnosisGeoEvidence = {
  /** Perguntas de IA em que o negócio aparece. */
  prompts: Array<{ question: string; leadCited: boolean }>
  /** Citações na visão geral de IA do Google, com o trecho citado. */
  aiOverview: Array<{
    keyword: string
    position: number | null
    citedText: string | null
  }>
}

export type DiagnosisFacts = {
  scorecard: Record<DiagnosisPillar, DiagnosisPillarScore>
  findings: DiagnosisFinding[]
  roadmap: DiagnosisRoadmapItem[]
  pillars: Record<DiagnosisPillar, DiagnosisPillarFacts>
  /**
   * Opcional na leitura: rascunho salvo antes da onda 9 não tem o campo, e
   * exigi-lo faria todo documento antigo deixar de abrir.
   */
  strengths?: DiagnosisStrength[]
  /**
   * Opcional na leitura, pelo mesmo motivo de `strengths`: documento salvo
   * antes da onda 4 da Presença em IA não tem o campo.
   */
  geoEvidence?: DiagnosisGeoEvidence
}

export type DiagnosisProse = {
  executiveSummary: string
  commercialHook: string
  pillarNarratives: Record<DiagnosisPillar, string>
}

export type DiagnosisMeta = {
  companyName: string
  domain: string
  city: string | null
  generatedAt: string
  sources: DiagnosisSourceLabel[]
}

export type DiagnosisDocument = {
  version: 1
  meta: DiagnosisMeta
  facts: DiagnosisFacts
  prose: DiagnosisProse
  limitations: string[]
}

export type LeadDiagnosisDraft = {
  lead_id: string
  document: DiagnosisDocument
  facts_fingerprint: string
  updated_at: string
  updated_by: string
}

export type LeadDiagnosisExport = {
  id: string
  lead_id: string
  document: DiagnosisDocument
  storage_path: string
  file_name: string
  is_current: boolean
  exported_at: string
  exported_by: string
}

export const DIAGNOSIS_ROADMAP_CAP = 10

/**
 * Quanta evidência de Presença em IA cabe no documento do cliente.
 *
 * Seis perguntas e quatro citações: o relatório de referência mostra dez de
 * cada, mas ele é um documento de página cheia e o nosso é um pilar entre seis.
 * O que importa é que o lead reconheça a pergunta e a própria frase — a lista
 * completa mora na tela do analista.
 */
export const DIAGNOSIS_GEO_PROMPTS_CAP = 6
export const DIAGNOSIS_GEO_CITATIONS_CAP = 4
export const DIAGNOSIS_PROSE_MAX = 2000
export const DIAGNOSIS_HOOK_MAX = 400

export function emptyPillarScore(): DiagnosisPillarScore {
  return { score: 0, highCount: 0, mediumCount: 0, measured: false }
}

export function emptyPillarFacts(): DiagnosisPillarFacts {
  return { opportunities: [], keyMetrics: [] }
}

export function emptyDiagnosisProse(): DiagnosisProse {
  return {
    executiveSummary: "",
    commercialHook: "",
    pillarNarratives: {
      google: "",
      website: "",
      presence: "",
      visibility: "",
      geo: "",
    },
  }
}

export function scorePillarOpportunities(
  items: ReadonlyArray<{ impact: DiagnosisImpact }>,
): DiagnosisPillarScore {
  let highCount = 0
  let mediumCount = 0
  for (const item of items) {
    if (item.impact === "high") highCount += 1
    else mediumCount += 1
  }
  const raw = 100 - highCount * 12 - mediumCount * 6
  return {
    score: Math.max(0, Math.min(100, raw)),
    highCount,
    mediumCount,
    // Quem chega aqui tem coleta: a lista de oportunidades saiu de um snapshot.
    measured: true,
  }
}

/**
 * Versão do catálogo de achados. Incrementar sempre que uma onda mudar quais
 * achados existem ou como eles são calculados.
 *
 * Sem isto o fingerprint é feito só de timestamps de coleta, e uma regra nova
 * não marca rascunho nenhum como desatualizado: o achado passa a existir no
 * código e não aparece em nenhum documento já salvo, porque ninguém sabe que
 * precisa recompilar. A onda 9 é inteiramente retroativa e seria invisível.
 *
 * Não recompila sozinho — recompilar é decisão de quem vende, e a prosa escrita
 * pelo analista está no rascunho.
 *
 * 2 = onda 9: cobertura de descrição, categoria × segmento, pontos fortes.
 */
export const DIAGNOSIS_RULES_VERSION = 2

export function diagnosisFactsFingerprint(input: {
  gbpEnrichmentAt: string | null
  gbpFetchedAt: string | null
  websiteFetchedAt: string | null
  websitePagespeedAt: string | null
  presenceUpdatedAt: string | null
  visibilityFetchedAt: string | null
  /** Backlinks tem cadência própria: sem ele aqui, recoletar não marca o
   * rascunho como desatualizado e a tela segue exibindo autoridade antiga. */
  backlinksFetchedAt: string | null
  /**
   * Rascunho compilado antes desta entrega vira "desatualizado" ao entrar este
   * campo, e isso **nao se mitiga**: aquele documento genuinamente nao tem o
   * pilar de Presenca em IA. O stale esta certo.
   */
  geoFetchedAt: string | null
}): string {
  return [
    `v${DIAGNOSIS_RULES_VERSION}`,
    input.gbpFetchedAt ?? "",
    input.gbpEnrichmentAt ?? "",
    input.websiteFetchedAt ?? "",
    input.websitePagespeedAt ?? "",
    input.presenceUpdatedAt ?? "",
    input.visibilityFetchedAt ?? "",
    input.backlinksFetchedAt ?? "",
    input.geoFetchedAt ?? "",
  ].join("|")
}
