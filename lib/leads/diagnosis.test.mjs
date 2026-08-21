import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  diagnosisFactsFingerprint,
  scorePillarOpportunities,
} from "./diagnosis-document.ts"
import { diagnosisFindingsFromThemes } from "./diagnosis-themes.ts"
import { seedDiagnosisProse } from "./diagnosis-templates.ts"
import { readDiagnosisDocument } from "./diagnosis-read.ts"

describe("scorePillarOpportunities", () => {
  it("subtracts high and medium impacts and clamps", () => {
    const score = scorePillarOpportunities([
      { impact: "high" },
      { impact: "high" },
      { impact: "medium" },
    ])
    assert.equal(score.score, 100 - 24 - 6)
    assert.equal(score.highCount, 2)
    assert.equal(score.mediumCount, 1)
  })

  it("clamps at zero", () => {
    const items = Array.from({ length: 20 }, () => ({ impact: "high" }))
    assert.equal(scorePillarOpportunities(items).score, 0)
  })
})

describe("diagnosisFindingsFromThemes", () => {
  it("matches brand content trap", () => {
    const findings = diagnosisFindingsFromThemes({
      opportunityIds: new Set([
        "brand_only_visibility",
        "homepage_only",
        "no_service_pages",
      ]),
    })
    assert.ok(findings.some((item) => item.id === "brand_content_trap"))
  })

  it("matches local seo gap", () => {
    const findings = diagnosisFindingsFromThemes({
      opportunityIds: new Set(["not_in_map_top3", "no_local_top20"]),
    })
    assert.equal(findings[0]?.id, "local_seo_gap")
  })
})

describe("diagnosisFactsFingerprint", () => {
  it("joins source stamps", () => {
    assert.equal(
      diagnosisFactsFingerprint({
        gbpFetchedAt: "a",
        gbpEnrichmentAt: "b",
        websiteFetchedAt: "c",
        websitePagespeedAt: null,
        presenceUpdatedAt: "d",
        visibilityFetchedAt: "e",
      }),
      "a|b|c||d|e",
    )
  })
})

describe("seedDiagnosisProse", () => {
  it("builds portuguese summary from facts", () => {
    const prose = seedDiagnosisProse({
      meta: {
        companyName: "Acme",
        domain: "acme.com.br",
        city: "Curitiba",
        generatedAt: "2026-08-21T00:00:00.000Z",
        sources: ["Google Places"],
      },
      facts: {
        scorecard: {
          google: { score: 70, highCount: 2, mediumCount: 1 },
          website: { score: 88, highCount: 1, mediumCount: 0 },
          presence: { score: 94, highCount: 0, mediumCount: 1 },
          visibility: { score: 40, highCount: 4, mediumCount: 2 },
        },
        findings: [
          {
            id: "local_seo_gap",
            title: "SEO local fraco",
            detail: "detalhe",
            pillars: ["google", "visibility"],
          },
        ],
        roadmap: [
          {
            id: "visibility:not_ranking",
            pillar: "visibility",
            title: "Construir visibilidade",
            impact: "high",
            evidence: "Visibilidade",
          },
        ],
        pillars: {
          google: { opportunities: [], keyMetrics: [] },
          website: { opportunities: [], keyMetrics: [] },
          presence: { opportunities: [], keyMetrics: [] },
          visibility: {
            opportunities: [
              {
                id: "not_ranking",
                title: "Construir visibilidade",
                impact: "high",
                source: "machine",
              },
            ],
            keyMetrics: [],
          },
        },
      },
    })
    assert.match(prose.executiveSummary, /Acme/)
    assert.match(prose.commercialHook, /Construir visibilidade/)
    assert.match(prose.pillarNarratives.visibility, /Visibilidade/)
  })
})

describe("readDiagnosisDocument", () => {
  it("round-trips a minimal document", () => {
    const doc = {
      version: 1,
      meta: {
        companyName: "Acme",
        domain: "acme.com.br",
        city: null,
        generatedAt: "2026-08-21T00:00:00.000Z",
        sources: ["Coleta do site"],
      },
      facts: {
        scorecard: {
          google: { score: 100, highCount: 0, mediumCount: 0 },
          website: { score: 100, highCount: 0, mediumCount: 0 },
          presence: { score: 100, highCount: 0, mediumCount: 0 },
          visibility: { score: 100, highCount: 0, mediumCount: 0 },
        },
        findings: [],
        roadmap: [],
        pillars: {
          google: { opportunities: [], keyMetrics: [] },
          website: { opportunities: [], keyMetrics: [] },
          presence: { opportunities: [], keyMetrics: [] },
          visibility: { opportunities: [], keyMetrics: [] },
        },
      },
      prose: {
        executiveSummary: "Resumo",
        commercialHook: "Hook",
        pillarNarratives: {
          google: "g",
          website: "w",
          presence: "p",
          visibility: "v",
        },
      },
      limitations: ["limite"],
    }
    const parsed = readDiagnosisDocument(doc)
    assert.ok(parsed)
    assert.equal(parsed.prose.executiveSummary, "Resumo")
    assert.equal(parsed.limitations[0], "limite")
  })
})
