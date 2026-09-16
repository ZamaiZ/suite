import assert from "node:assert/strict"
import { test } from "node:test"

import {
  extractWebsitePsiStrategy,
  websiteMinPerformance,
} from "./website-pagespeed.ts"

/**
 * Forma do resultado do `on_page/lighthouse/live/json`, medida em 2026-09-15:
 * o JSON do Lighthouse na raiz, sem o `lighthouseResult` que o PSI envolvia em
 * volta e sem o `loadingExperience` que só o Google anexa.
 */
const LIGHTHOUSE = {
  categories: {
    performance: { score: 0.72 },
    accessibility: { score: 0.91 },
  },
  audits: {
    "largest-contentful-paint": { numericValue: 3200 },
    "cumulative-layout-shift": { numericValue: 0.08 },
    "meta-viewport": { score: 1 },
    "is-on-https": { score: 1 },
    "is-crawlable": { score: 1 },
    "color-contrast": { score: 0, details: { items: [{}, {}, {}] } },
  },
}

test("lê o Lighthouse cru, sem envelope do PSI", () => {
  const strategy = extractWebsitePsiStrategy(LIGHTHOUSE)
  assert.equal(strategy.performance, 72)
  assert.equal(strategy.accessibility, 91)
  assert.equal(strategy.lcpMs, 3200)
  assert.equal(strategy.cls, 0.08)
  assert.equal(strategy.contrastFails, 3)
})

test("continua lendo o envelope antigo do PSI", () => {
  // Payload gravado antes da virada ainda precisa abrir.
  const strategy = extractWebsitePsiStrategy({ lighthouseResult: LIGHTHOUSE })
  assert.equal(strategy.performance, 72)
})

test("lê o viewport pelo nome novo do audit", () => {
  // O `viewport` virou `meta-viewport` no Lighthouse 13.4.0, que é o que o
  // DataForSEO roda. Lido pelo nome antigo, `auditScoreOne` devolveria `true`
  // por ausência e o check passaria sempre, sem medir nada.
  assert.equal(
    extractWebsitePsiStrategy({
      ...LIGHTHOUSE,
      audits: { ...LIGHTHOUSE.audits, "meta-viewport": { score: 0 } },
    }).viewportOk,
    false,
  )
})

test("ainda lê o nome antigo, para payload gravado antes da virada", () => {
  const semNovo = { ...LIGHTHOUSE.audits }
  delete semNovo["meta-viewport"]
  assert.equal(
    extractWebsitePsiStrategy({
      ...LIGHTHOUSE,
      audits: { ...semNovo, viewport: { score: 0 } },
    }).viewportOk,
    false,
  )
})

test("os três campos de campo saem nulos, nunca zero", () => {
  const strategy = extractWebsitePsiStrategy(LIGHTHOUSE)
  assert.equal(strategy.fieldLcpMs, null)
  assert.equal(strategy.fieldInpMs, null)
  assert.equal(strategy.fieldCls, null)
})

test("o INP ausente é nulo, e não um zero que passaria no limiar", () => {
  assert.equal(extractWebsitePsiStrategy(LIGHTHOUSE).inpMs, null)
})

test("execução com erro não vira estratégia", () => {
  assert.equal(
    extractWebsitePsiStrategy({ ...LIGHTHOUSE, runtimeError: { code: "x" } }),
    null,
  )
  assert.equal(extractWebsitePsiStrategy(null), null)
  assert.equal(extractWebsitePsiStrategy({ audits: {} }), null)
})

test("a pior das duas estratégias é a que vale", () => {
  const strategy = extractWebsitePsiStrategy(LIGHTHOUSE)
  assert.equal(
    websiteMinPerformance({ url: "x", mobile: strategy, desktop: null }),
    72,
  )
})
