import assert from "node:assert/strict"
import { test } from "node:test"

import {
  emptyVisibilityReview,
  readLeadVisibilityReviewRow,
  stampVisibilityReview,
  visibilityReviewHasOpportunity,
  visibilityReviewProgress,
  VISIBILITY_REVIEW_CATALOG,
  VISIBILITY_REVIEW_CHIP_IDS,
} from "./visibility-review.ts"

function criterion(id) {
  const found = VISIBILITY_REVIEW_CATALOG.find((item) => item.id === id)
  assert.ok(found, `critério ausente no catálogo: ${id}`)
  return found
}

test("o progresso conta os critérios com veredito, e ignora `other`", () => {
  const review = emptyVisibilityReview()
  assert.deepEqual(visibilityReviewProgress(review), { done: 0, total: 4 })
  review.host_intent.verdict = "ok"
  review.other.note = "texto solto não é veredito"
  assert.deepEqual(visibilityReviewProgress(review), { done: 1, total: 4 })
})

test("`other` fica de fora da lista de critérios com chip", () => {
  assert.equal(VISIBILITY_REVIEW_CHIP_IDS.includes("other"), false)
  assert.equal(VISIBILITY_REVIEW_CHIP_IDS.length, 4)
})

test("linha ausente lê como review vazio, não como null", () => {
  // Lead nunca julgado não é lead com julgamento perdido: a tela precisa dos
  // quatro critérios em branco para montar.
  const parsed = readLeadVisibilityReviewRow(null)
  assert.deepEqual(visibilityReviewProgress(parsed.review), {
    done: 0,
    total: 4,
  })
  assert.equal(parsed.notes, null)
})

test("veredito inválido vira null sem derrubar a nota junto", () => {
  const parsed = readLeadVisibilityReviewRow({
    review: { host_intent: { verdict: "talvez", note: "é homologação" } },
    notes: "nota da etapa",
  })
  assert.equal(parsed.review.host_intent.verdict, null)
  assert.equal(parsed.review.host_intent.note, "é homologação")
  assert.equal(parsed.notes, "nota da etapa")
})

test("`na` só passa onde o critério permite", () => {
  // `brand_terms` não tem N/A: toda etapa com coleta tem termos de topo.
  const parsed = readLeadVisibilityReviewRow({
    review: {
      host_intent: { verdict: "na", note: "" },
      brand_terms: { verdict: "na", note: "" },
    },
  })
  assert.equal(parsed.review.host_intent.verdict, "na")
  assert.equal(parsed.review.brand_terms.verdict, null)
})

test("campo em branco do analista não vira oportunidade", () => {
  const review = emptyVisibilityReview()
  for (const item of VISIBILITY_REVIEW_CATALOG) {
    assert.equal(
      visibilityReviewHasOpportunity(item, review[item.id]),
      false,
      `${item.id} não deveria gerar oportunidade em branco`,
    )
  }
})

test("só `issue` vira oportunidade; `ok` e `na` não", () => {
  const review = emptyVisibilityReview()
  review.host_intent.verdict = "ok"
  assert.equal(
    visibilityReviewHasOpportunity(
      criterion("host_intent"),
      review.host_intent,
    ),
    false,
  )
  review.host_intent.verdict = "na"
  assert.equal(
    visibilityReviewHasOpportunity(
      criterion("host_intent"),
      review.host_intent,
    ),
    false,
  )
  review.host_intent.verdict = "issue"
  assert.equal(
    visibilityReviewHasOpportunity(
      criterion("host_intent"),
      review.host_intent,
    ),
    true,
  )
})

test("o carimbo só marca o que foi julgado", () => {
  // O gêmeo do Website carimba os sete critérios de uma vez, e um critério
  // nunca tocado sai do banco dizendo que foi atualizado agora. Aqui não.
  const review = emptyVisibilityReview()
  review.host_intent.verdict = "issue"
  review.other.note = "achado solto"
  const stamped = stampVisibilityReview(
    review,
    "user-1",
    "2026-09-10T00:00:00.000Z",
  )

  assert.equal(stamped.host_intent.updatedAt, "2026-09-10T00:00:00.000Z")
  assert.equal(stamped.host_intent.updatedBy, "user-1")
  assert.equal(stamped.other.updatedAt, "2026-09-10T00:00:00.000Z")
  // Nunca julgado, nunca carimbado.
  assert.equal(stamped.brand_terms.updatedAt, null)
  assert.equal(stamped.brand_terms.updatedBy, null)
})

test("`other` vale pela nota, porque não tem veredito", () => {
  const review = emptyVisibilityReview()
  assert.equal(
    visibilityReviewHasOpportunity(criterion("other"), review.other),
    false,
  )
  review.other.note = "canibalização entre as duas landing pages de pallets"
  assert.equal(
    visibilityReviewHasOpportunity(criterion("other"), review.other),
    true,
  )
})
