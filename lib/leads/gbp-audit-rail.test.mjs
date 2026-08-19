import assert from "node:assert/strict"
import test from "node:test"

import {
  buildGbpAuditRailModel,
  type BuildGbpAuditRailInput,
} from "./gbp-audit-rail.ts"

function rail(
  overrides: Partial<BuildGbpAuditRailInput> = {},
) {
  return buildGbpAuditRailModel({
    profile: null,
    website: null,
    selectedStep: "google-profile",
    googleAlertCount: 0,
    websiteAlertCount: 0,
    ...overrides,
  })
}

const pendingProfile = {
  fetched_at: "2026-08-17T19:26:00.000Z",
  enrichment_at: null,
  jobs: [],
}

test("keeps a lead without a profile on the first audit step", () => {
  const model = rail()

  assert.equal(model.status, "pending")
  assert.equal(model.currentStep, 1)
  assert.equal(model.totalSteps, 5)
  assert.equal(model.progress, 0)
  assert.equal(model.steps[0]?.state, "current")
  assert.equal(model.steps[0]?.selectable, true)
  assert.equal(model.steps[1]?.selectable, true)
  assert.deepEqual(
    model.steps.slice(1).map((step) => step.state),
    ["upcoming", "upcoming", "upcoming", "upcoming"],
  )
})

test("marks the Google profile step as processing while collection jobs are queued", () => {
  const model = rail({
    profile: {
      fetched_at: "2026-08-17T19:26:00.000Z",
      enrichment_at: null,
      jobs: [{ status: "queued" }],
    },
    googleAlertCount: 3,
  })

  assert.equal(model.status, "processing")
  assert.equal(model.steps[0]?.state, "processing")
  assert.equal(model.alertCount, 3)
})

test("surfaces a failed collection on the Google profile step", () => {
  const model = rail({
    profile: {
      fetched_at: "2026-08-17T19:26:00.000Z",
      enrichment_at: null,
      jobs: [{ status: "failed" }],
    },
  })

  assert.equal(model.status, "error")
  assert.equal(model.steps[0]?.state, "error")
})

test("marks the Google profile step complete after enrichment finishes", () => {
  const analyzedAt = "2026-08-17T19:32:00.000Z"
  const model = rail({
    profile: {
      fetched_at: "2026-08-17T19:26:00.000Z",
      enrichment_at: analyzedAt,
      jobs: [{ status: "ready" }],
    },
    googleAlertCount: 2,
  })

  assert.equal(model.status, "analyzed")
  assert.equal(model.steps[0]?.state, "complete")
  assert.equal(model.analyzedAt, analyzedAt)
  assert.equal(model.progress, 20)
})

test("only exposes the Google alert summary after a profile is linked", () => {
  const withoutProfile = rail()
  const withProfile = rail({ profile: pendingProfile })

  assert.equal(withoutProfile.showAlerts, false)
  assert.equal(withProfile.showAlerts, true)
})

test("keeps processing precedence when queued and failed jobs coexist", () => {
  const model = rail({
    profile: {
      fetched_at: "2026-08-17T19:26:00.000Z",
      enrichment_at: "2026-08-17T19:32:00.000Z",
      jobs: [{ status: "failed" }, { status: "queued" }],
    },
    googleAlertCount: 1,
  })

  assert.equal(model.status, "processing")
  assert.equal(model.steps[0]?.state, "processing")
})

test("allows selecting the website step before the Google profile is analyzed", () => {
  const model = rail({
    profile: pendingProfile,
    selectedStep: "website",
    websiteAlertCount: 4,
  })

  assert.equal(model.currentStep, 2)
  assert.equal(model.steps[1]?.state, "current")
  assert.equal(model.steps[1]?.selected, true)
  assert.equal(model.steps[0]?.state, "upcoming")
  assert.equal(model.status, "pending")
  assert.equal(model.showAlerts, false)
})

test("marks the website step complete after a crawl exists", () => {
  const fetchedAt = "2026-08-19T15:00:00.000Z"
  const model = rail({
    profile: {
      fetched_at: "2026-08-17T19:26:00.000Z",
      enrichment_at: "2026-08-17T19:32:00.000Z",
      jobs: [{ status: "ready" }],
    },
    website: { fetched_at: fetchedAt },
    selectedStep: "website",
    websiteAlertCount: 6,
  })

  assert.equal(model.steps[0]?.state, "complete")
  assert.equal(model.steps[1]?.state, "complete")
  assert.equal(model.progress, 40)
  assert.equal(model.status, "analyzed")
  assert.equal(model.collectedAt, fetchedAt)
  assert.equal(model.analyzedAt, fetchedAt)
  assert.equal(model.alertCount, 6)
  assert.equal(model.showAlerts, true)
})

test("keeps later stages locked", () => {
  const model = rail({
    website: { fetched_at: "2026-08-19T15:00:00.000Z" },
    selectedStep: "diagnosis",
  })

  assert.equal(model.currentStep, 1)
  assert.equal(model.steps[2]?.selectable, false)
  assert.equal(model.steps[2]?.state, "upcoming")
})
