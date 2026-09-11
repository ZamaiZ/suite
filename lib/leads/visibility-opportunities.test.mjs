import assert from "node:assert/strict"
import { test } from "node:test"

import {
  visibilityOpportunitiesByTheme,
  visibilityOpportunityTheme,
  visibilityReviewOpportunities,
} from "./visibility-opportunities.ts"
import { emptyVisibilityReview } from "./visibility-review.ts"

function machine(id) {
  return { id, title: id, impact: "high", source: "machine" }
}

test("o Record cobre exatamente as quatro abas", () => {
  assert.deepEqual(Object.keys(visibilityOpportunitiesByTheme([])).sort(), [
    "keywords",
    "paginas",
    "panorama",
    "validacao",
  ])
})

test("o host não-canônico cai na aba de páginas", () => {
  const byTheme = visibilityOpportunitiesByTheme([
    machine("non_canonical_host_traffic"),
  ])
  assert.equal(byTheme.paginas.length, 1)
  assert.equal(byTheme.panorama.length, 0)
})

test("cada gap tem tema, e nenhum cai no default por acidente", () => {
  const expected = {
    not_ranking: "panorama",
    thin_keyword_footprint: "panorama",
    low_organic_traffic: "panorama",
    brand_only_visibility: "keywords",
    no_local_top20: "keywords",
    homepage_only: "paginas",
    non_canonical_host_traffic: "paginas",
  }
  for (const [id, theme] of Object.entries(expected)) {
    assert.equal(visibilityOpportunityTheme(id), theme, `tema errado em ${id}`)
  }
})

test("o achado do analista cai na aba de validação", () => {
  assert.equal(visibilityOpportunityTheme("review:host_intent"), "validacao")
  assert.equal(visibilityOpportunityTheme("review:qualquer_coisa"), "validacao")
})

test("review em branco não produz oportunidade nenhuma", () => {
  assert.deepEqual(visibilityReviewOpportunities(emptyVisibilityReview()), [])
})

test("veredito `issue` vira oportunidade do analista, com a nota no detalhe", () => {
  const review = emptyVisibilityReview()
  review.host_intent.verdict = "issue"
  review.host_intent.note = "aprov. é homologação indexada por engano"
  const items = visibilityReviewOpportunities(review)
  assert.equal(items.length, 1)
  assert.equal(items[0].id, "review:host_intent")
  assert.equal(items[0].source, "analyst")
  assert.equal(items[0].impact, "high")
  assert.match(items[0].detail, /homologação/)
})
