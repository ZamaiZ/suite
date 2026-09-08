export const DIAGNOSIS_PILLARS = [
  "google",
  "website",
  "presence",
  "visibility",
] as const

export type DiagnosisPillar = (typeof DIAGNOSIS_PILLARS)[number]

export const DIAGNOSIS_PILLAR_LABELS: Record<DiagnosisPillar, string> = {
  google: "Perfil no Google",
  website: "Website",
  presence: "Presença digital",
  visibility: "Visibilidade",
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
}

export type DiagnosisFinding = {
  id: string
  title: string
  detail: string
  pillars: DiagnosisPillar[]
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

export type DiagnosisFacts = {
  scorecard: Record<DiagnosisPillar, DiagnosisPillarScore>
  findings: DiagnosisFinding[]
  roadmap: DiagnosisRoadmapItem[]
  pillars: Record<DiagnosisPillar, DiagnosisPillarFacts>
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
export const DIAGNOSIS_PROSE_MAX = 2000
export const DIAGNOSIS_HOOK_MAX = 400

export function emptyPillarScore(): DiagnosisPillarScore {
  return { score: 100, highCount: 0, mediumCount: 0 }
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
  }
}

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
}): string {
  return [
    input.gbpFetchedAt ?? "",
    input.gbpEnrichmentAt ?? "",
    input.websiteFetchedAt ?? "",
    input.websitePagespeedAt ?? "",
    input.presenceUpdatedAt ?? "",
    input.visibilityFetchedAt ?? "",
    input.backlinksFetchedAt ?? "",
  ].join("|")
}
