import {
  DIAGNOSIS_PILLARS,
  emptyDiagnosisProse,
  emptyPillarFacts,
  emptyPillarScore,
  type DiagnosisDocument,
  type DiagnosisFacts,
  type DiagnosisFinding,
  type DiagnosisImpact,
  type DiagnosisKeyMetric,
  type DiagnosisMeta,
  type DiagnosisOpportunityRef,
  type DiagnosisPillar,
  type DiagnosisProse,
  type DiagnosisRoadmapItem,
  type DiagnosisSourceLabel,
  type LeadDiagnosisDraft,
  type LeadDiagnosisExport,
} from "./diagnosis-document.ts"

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asImpact(value: unknown): DiagnosisImpact | null {
  return value === "high" || value === "medium" ? value : null
}

function asPillar(value: unknown): DiagnosisPillar | null {
  return typeof value === "string" &&
    (DIAGNOSIS_PILLARS as readonly string[]).includes(value)
    ? (value as DiagnosisPillar)
    : null
}

function readOpportunity(value: unknown): DiagnosisOpportunityRef | null {
  const row = objectRecord(value)
  if (!row) return null
  const id = asString(row.id)
  const title = asString(row.title)
  const impact = asImpact(row.impact)
  if (!id || !title || !impact) return null
  const source = row.source === "analyst" ? "analyst" : "machine"
  const detail = asString(row.detail) ?? undefined
  return {
    id,
    title,
    impact,
    source,
    ...(detail ? { detail } : {}),
  }
}

function readMetric(value: unknown): DiagnosisKeyMetric | null {
  const row = objectRecord(value)
  if (!row) return null
  const id = asString(row.id)
  const label = asString(row.label)
  const metricValue = asString(row.value)
  if (!id || !label || metricValue === null) return null
  return { id, label, value: metricValue }
}

function readFinding(value: unknown): DiagnosisFinding | null {
  const row = objectRecord(value)
  if (!row) return null
  const id = asString(row.id)
  const title = asString(row.title)
  const detail = asString(row.detail)
  if (!id || !title || !detail) return null
  const pillars = Array.isArray(row.pillars)
    ? row.pillars.flatMap((item) => {
        const pillar = asPillar(item)
        return pillar ? [pillar] : []
      })
    : []
  return { id, title, detail, pillars }
}

function readRoadmapItem(value: unknown): DiagnosisRoadmapItem | null {
  const row = objectRecord(value)
  if (!row) return null
  const id = asString(row.id)
  const title = asString(row.title)
  const impact = asImpact(row.impact)
  const evidence = asString(row.evidence)
  const pillar = asPillar(row.pillar)
  if (!id || !title || !impact || !evidence || !pillar) return null
  return { id, pillar, title, impact, evidence }
}

function readProse(value: unknown): DiagnosisProse {
  const empty = emptyDiagnosisProse()
  const row = objectRecord(value)
  if (!row) return empty
  const narratives = objectRecord(row.pillarNarratives)
  const pillarNarratives = { ...empty.pillarNarratives }
  if (narratives) {
    for (const pillar of DIAGNOSIS_PILLARS) {
      const text = asString(narratives[pillar])
      if (text) pillarNarratives[pillar] = text
    }
  }
  return {
    executiveSummary: asString(row.executiveSummary) ?? "",
    commercialHook: asString(row.commercialHook) ?? "",
    pillarNarratives,
  }
}

function readFacts(value: unknown): DiagnosisFacts | null {
  const row = objectRecord(value)
  if (!row) return null

  const scorecardRaw = objectRecord(row.scorecard)
  const pillarsRaw = objectRecord(row.pillars)
  if (!scorecardRaw || !pillarsRaw) return null

  const scorecard = Object.fromEntries(
    DIAGNOSIS_PILLARS.map((pillar) => {
      const cell = objectRecord(scorecardRaw[pillar])
      if (!cell) return [pillar, emptyPillarScore()]
      const score =
        typeof cell.score === "number" && Number.isFinite(cell.score)
          ? Math.max(0, Math.min(100, Math.trunc(cell.score)))
          : 100
      const highCount =
        typeof cell.highCount === "number" && Number.isFinite(cell.highCount)
          ? Math.max(0, Math.trunc(cell.highCount))
          : 0
      const mediumCount =
        typeof cell.mediumCount === "number" &&
        Number.isFinite(cell.mediumCount)
          ? Math.max(0, Math.trunc(cell.mediumCount))
          : 0
      return [pillar, { score, highCount, mediumCount }]
    }),
  ) as DiagnosisFacts["scorecard"]

  const pillars = Object.fromEntries(
    DIAGNOSIS_PILLARS.map((pillar) => {
      const cell = objectRecord(pillarsRaw[pillar])
      if (!cell) return [pillar, emptyPillarFacts()]
      const opportunities = Array.isArray(cell.opportunities)
        ? cell.opportunities.flatMap((item) => {
            const parsed = readOpportunity(item)
            return parsed ? [parsed] : []
          })
        : []
      const keyMetrics = Array.isArray(cell.keyMetrics)
        ? cell.keyMetrics.flatMap((item) => {
            const parsed = readMetric(item)
            return parsed ? [parsed] : []
          })
        : []
      return [pillar, { opportunities, keyMetrics }]
    }),
  ) as DiagnosisFacts["pillars"]

  const findings = Array.isArray(row.findings)
    ? row.findings.flatMap((item) => {
        const parsed = readFinding(item)
        return parsed ? [parsed] : []
      })
    : []
  const roadmap = Array.isArray(row.roadmap)
    ? row.roadmap.flatMap((item) => {
        const parsed = readRoadmapItem(item)
        return parsed ? [parsed] : []
      })
    : []

  return { scorecard, findings, roadmap, pillars }
}

function readMeta(value: unknown): DiagnosisMeta | null {
  const row = objectRecord(value)
  if (!row) return null
  const companyName = asString(row.companyName)
  const domain = asString(row.domain)
  const generatedAt = asString(row.generatedAt)
  if (!companyName || !domain || !generatedAt) return null
  const sources = Array.isArray(row.sources)
    ? row.sources.filter(
        (item): item is DiagnosisSourceLabel => typeof item === "string",
      )
    : []
  return {
    companyName,
    domain,
    city: asString(row.city),
    generatedAt,
    sources,
  }
}

export function readDiagnosisDocument(
  value: unknown,
): DiagnosisDocument | null {
  const row = objectRecord(value)
  if (!row || row.version !== 1) return null
  const meta = readMeta(row.meta)
  const facts = readFacts(row.facts)
  if (!meta || !facts) return null
  const limitations = Array.isArray(row.limitations)
    ? row.limitations.filter(
        (item): item is string => typeof item === "string",
      )
    : []
  return {
    version: 1,
    meta,
    facts,
    prose: readProse(row.prose),
    limitations,
  }
}

export function readLeadDiagnosisDraftRow(
  row: Record<string, unknown>,
): LeadDiagnosisDraft | null {
  const lead_id = asString(row.lead_id)
  const facts_fingerprint = asString(row.facts_fingerprint)
  const updated_at = asString(row.updated_at)
  const updated_by = asString(row.updated_by)
  const document = readDiagnosisDocument(row.document)
  if (
    !lead_id ||
    !facts_fingerprint ||
    !updated_at ||
    !updated_by ||
    !document
  ) {
    return null
  }
  return {
    lead_id,
    document,
    facts_fingerprint,
    updated_at,
    updated_by,
  }
}

export function readLeadDiagnosisExportRow(
  row: Record<string, unknown>,
): LeadDiagnosisExport | null {
  const id = asString(row.id)
  const lead_id = asString(row.lead_id)
  const storage_path = asString(row.storage_path)
  const file_name = asString(row.file_name)
  const exported_at = asString(row.exported_at)
  const exported_by = asString(row.exported_by)
  const document = readDiagnosisDocument(row.document)
  if (
    !id ||
    !lead_id ||
    !storage_path ||
    !file_name ||
    !exported_at ||
    !exported_by ||
    !document
  ) {
    return null
  }
  return {
    id,
    lead_id,
    document,
    storage_path,
    file_name,
    is_current: row.is_current === true,
    exported_at,
    exported_by,
  }
}
