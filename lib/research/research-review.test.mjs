/**
 * Trava o julgamento do analista.
 *
 * A regra que sustenta tudo: **campo em branco é ausência de julgamento, nunca
 * aprovação**. Um `null` que vira `"ok"` por descuido faz uma pesquisa não
 * revisada parecer revisada e aprovada.
 */

import test from "node:test"
import assert from "node:assert/strict"

import {
  RESEARCH_REVIEW_DIMENSIONS,
  applyReview,
  clusterLabel,
  emptyResearchReview,
  readClusterNames,
  readResearchReview,
  reviewProgress,
  unnamedClusters,
} from "./research-review.ts"

const ATOR = { id: "user-1", at: "2026-09-18T12:00:00.000Z" }

const cluster = (id, headKeyword) => ({
  id,
  keywords: [headKeyword],
  headKeyword,
  totalVolume: 100,
  sharedUrls: [],
})

/* -------------------------------------------------------------------------- */
/*  Em branco não é aprovado                                                  */
/* -------------------------------------------------------------------------- */

test("review vazio nasce com verdict null em todas as dimensões", () => {
  const review = emptyResearchReview()
  for (const d of RESEARCH_REVIEW_DIMENSIONS) {
    assert.equal(review[d].verdict, null)
    assert.notEqual(review[d].verdict, "ok")
  }
})

test("valor desconhecido no jsonb vira null, não é aceito", () => {
  const review = readResearchReview({
    clusters: { verdict: "aprovado" },
    competitors: { verdict: true },
  })
  assert.equal(review.clusters.verdict, null)
  assert.equal(review.competitors.verdict, null)
})

test("os três veredictos válidos passam", () => {
  const review = readResearchReview({
    clusters: { verdict: "ok" },
    competitors: { verdict: "attention" },
    verdicts: { verdict: "problem" },
  })
  assert.equal(review.clusters.verdict, "ok")
  assert.equal(review.competitors.verdict, "attention")
  assert.equal(review.verdicts.verdict, "problem")
})

/* -------------------------------------------------------------------------- */
/*  Leitor tolera o passado                                                   */
/* -------------------------------------------------------------------------- */

test("dimensão ausente em review antigo entra vazia", () => {
  const review = readResearchReview({ clusters: { verdict: "ok" } })
  assert.equal(review.locality.verdict, null)
  assert.equal(review.locality.note, "")
})

test("dimensão que não existe mais é ignorada sem quebrar", () => {
  const review = readResearchReview({
    clusters: { verdict: "ok" },
    dimensao_extinta: { verdict: "problem" },
  })
  assert.equal(review.clusters.verdict, "ok")
  assert.equal(Object.keys(review).length, RESEARCH_REVIEW_DIMENSIONS.length)
})

test("jsonb inválido devolve review vazio, não erro", () => {
  for (const lixo of [null, 42, "texto", []]) {
    const review = readResearchReview(lixo)
    assert.equal(review.clusters.verdict, null)
  }
})

/* -------------------------------------------------------------------------- */
/*  Nome do cluster — trabalho humano que recoleta não apaga                  */
/* -------------------------------------------------------------------------- */

test("nome do analista vence o rótulo automático", () => {
  const c = cluster("c1", "tinta emborrachada")
  const nomes = readClusterNames({ c1: "Impermeabilização" })
  assert.equal(clusterLabel(c, nomes), "Impermeabilização")
})

test("sem nome, a keyword de maior volume é o rótulo", () => {
  const c = cluster("c1", "tinta emborrachada")
  assert.equal(clusterLabel(c, {}), "tinta emborrachada")
})

test("nome em branco não substitui o rótulo automático", () => {
  const c = cluster("c1", "tinta emborrachada")
  const nomes = readClusterNames({ c1: "   " })
  assert.equal(clusterLabel(c, nomes), "tinta emborrachada")
})

test("os clusters sem nome são listados para a tela cobrar", () => {
  const clusters = [cluster("c1", "a"), cluster("c2", "b"), cluster("c3", "c")]
  const nomes = readClusterNames({ c1: "Nomeado", c3: "" })
  assert.deepEqual(
    unnamedClusters(clusters, nomes).map((c) => c.id),
    ["c2", "c3"],
  )
})

/* -------------------------------------------------------------------------- */
/*  Progresso                                                                 */
/* -------------------------------------------------------------------------- */

test("other não conta como obrigatória — é campo livre", () => {
  const p = reviewProgress(emptyResearchReview())
  assert.equal(p.total, RESEARCH_REVIEW_DIMENSIONS.length - 1)
})

test("progresso conta só as julgadas", () => {
  const review = readResearchReview({
    clusters: { verdict: "ok" },
    competitors: { verdict: "problem" },
  })
  const p = reviewProgress(review)
  assert.equal(p.judged, 2)
  assert.equal(p.pending, 2)
  assert.equal(p.problems, 1)
  assert.equal(p.complete, false)
})

test("completo exige todas as obrigatórias, e other pode ficar em branco", () => {
  const review = readResearchReview({
    clusters: { verdict: "ok" },
    competitors: { verdict: "ok" },
    verdicts: { verdict: "ok" },
    locality: { verdict: "attention" },
  })
  const p = reviewProgress(review)
  assert.equal(p.complete, true)
  assert.equal(review.other.verdict, null)
})

/* -------------------------------------------------------------------------- */
/*  Aplicar julgamento                                                        */
/* -------------------------------------------------------------------------- */

test("aplicar carimba autor e data", () => {
  const review = applyReview(
    emptyResearchReview(),
    "clusters",
    { verdict: "ok" },
    ATOR,
  )
  assert.equal(review.clusters.verdict, "ok")
  assert.equal(review.clusters.updatedBy, "user-1")
  assert.equal(review.clusters.updatedAt, ATOR.at)
})

test("aplicar só a nota preserva o veredito", () => {
  const antes = applyReview(
    emptyResearchReview(),
    "clusters",
    { verdict: "problem" },
    ATOR,
  )
  const depois = applyReview(antes, "clusters", { note: "revisar" }, ATOR)
  assert.equal(depois.clusters.verdict, "problem")
  assert.equal(depois.clusters.note, "revisar")
})

test("aplicar não muda as outras dimensões", () => {
  const antes = applyReview(
    emptyResearchReview(),
    "clusters",
    { verdict: "ok" },
    ATOR,
  )
  const depois = applyReview(antes, "competitors", { verdict: "problem" }, ATOR)
  assert.equal(depois.clusters.verdict, "ok")
  assert.equal(depois.competitors.verdict, "problem")
})

test("aplicar devolve objeto novo — duas telas abertas não se contaminam", () => {
  const original = emptyResearchReview()
  const novo = applyReview(original, "clusters", { verdict: "ok" }, ATOR)
  assert.notEqual(original, novo)
  assert.equal(original.clusters.verdict, null)
})

test("é possível desfazer um julgamento voltando a null", () => {
  const antes = applyReview(
    emptyResearchReview(),
    "clusters",
    { verdict: "ok" },
    ATOR,
  )
  const depois = applyReview(antes, "clusters", { verdict: null }, ATOR)
  assert.equal(depois.clusters.verdict, null)
})
