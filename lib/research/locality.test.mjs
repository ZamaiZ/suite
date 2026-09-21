/**
 * Trava a sonda de localidade.
 *
 * O que está em jogo: se o eixo cidade não for provado e a matriz for gerada
 * mesmo assim, o projeto desenha páginas que competem entre si pelo mesmo
 * resultado — canibalização de propósito. Se for provado e a matriz não for
 * gerada, o cliente não existe na busca com cidade, que é a que converte.
 */

import test from "node:test"
import assert from "node:assert/strict"

import {
  LOCALITY_CONVERGENCE_MIN,
  NEIGHBORHOOD_SAMPLE_SIZE,
  localityMatrix,
  planLocalityProbes,
  probeLocality,
  summarizeLocality,
} from "./locality.ts"

const U = (n) => `https://exemplo${n}.com.br/p`
const BASE = [U(1), U(2), U(3), U(4), U(5), U(6)]

/* -------------------------------------------------------------------------- */
/*  A sonda                                                                   */
/* -------------------------------------------------------------------------- */

test("SERP do lugar igual à do tema: convergiu, uma página serve", () => {
  const p = probeLocality({
    cluster: "loja de tintas",
    place: "Itu",
    kind: "city",
    baseUrls: BASE,
    placeUrls: BASE,
  })
  assert.equal(p.converged, true)
  assert.equal(p.overlapWithBase, 6)
})

test("SERP do lugar diferente: eixo próprio, pede página própria", () => {
  const p = probeLocality({
    cluster: "loja de tintas",
    place: "Itu",
    kind: "city",
    baseUrls: BASE,
    placeUrls: [U(20), U(21), U(22), U(23)],
  })
  assert.equal(p.converged, false)
  assert.equal(p.overlapWithBase, 0)
})

test("no limiar exato, convergiu", () => {
  const p = probeLocality({
    cluster: "c",
    place: "Itu",
    kind: "city",
    baseUrls: BASE,
    placeUrls: [U(1), U(2), U(3), U(4), U(5), U(99)],
  })
  assert.equal(p.overlapWithBase, LOCALITY_CONVERGENCE_MIN)
  assert.equal(p.converged, true)
})

test("um abaixo do limiar, não convergiu", () => {
  const p = probeLocality({
    cluster: "c",
    place: "Itu",
    kind: "city",
    baseUrls: BASE,
    placeUrls: [U(1), U(2), U(3), U(4), U(98), U(99)],
  })
  assert.equal(p.converged, false)
})

test("sonda não coletada devolve null — ausência de medida não é medida", () => {
  const p = probeLocality({
    cluster: "c",
    place: "Itu",
    kind: "city",
    baseUrls: BASE,
    placeUrls: null,
  })
  assert.equal(p, null)
})

/* -------------------------------------------------------------------------- */
/*  Consolidação                                                              */
/* -------------------------------------------------------------------------- */

const sonda = (kind, converged, place = "X") => ({
  cluster: "c",
  place,
  kind,
  overlapWithBase: converged ? 6 : 0,
  converged,
})

test("maioria divergindo: eixo é próprio", () => {
  const f = summarizeLocality([
    sonda("city", false, "Itu"),
    sonda("city", false, "Salto"),
    sonda("city", true, "Sorocaba"),
  ])
  assert.equal(f.cityAxisOwn, true)
})

test("maioria convergindo: eixo não é próprio, a cidade herda", () => {
  const f = summarizeLocality([
    sonda("city", true, "Itu"),
    sonda("city", true, "Salto"),
    sonda("city", false, "Sorocaba"),
  ])
  assert.equal(f.cityAxisOwn, false)
})

test("sem sonda de bairro, o veredito é null e nunca false", () => {
  // Bairro ausente do briefing não vira "bairro não tem eixo próprio" — vira
  // "ninguém perguntou".
  const f = summarizeLocality([sonda("city", false)])
  assert.equal(f.neighborhoodAxisOwn, null)
  assert.notEqual(f.neighborhoodAxisOwn, false)
})

test("sem sonda nenhuma, os dois eixos ficam não medidos", () => {
  const f = summarizeLocality([])
  assert.equal(f.cityAxisOwn, null)
  assert.equal(f.neighborhoodAxisOwn, null)
})

/* -------------------------------------------------------------------------- */
/*  Plano de sondas — onde o custo é contido                                  */
/* -------------------------------------------------------------------------- */

test("cidade: todas, contra os clusters âncora", () => {
  const plano = planLocalityProbes({
    clusters: ["a", "b"],
    cities: ["Itu", "Salto", "Sorocaba"],
  })
  assert.equal(plano.length, 6)
  assert.ok(plano.every((p) => p.kind === "city"))
})

test("sem bairro no briefing, nenhuma sonda de bairro é planejada", () => {
  const plano = planLocalityProbes({ clusters: ["a"], cities: ["Itu"] })
  assert.equal(plano.filter((p) => p.kind === "neighborhood").length, 0)
})

test("bairro entra por amostra, não por varredura", () => {
  const bairros = Array.from({ length: 30 }, (_, i) => ({
    name: `Bairro ${i}`,
    city: "Itu",
  }))
  const plano = planLocalityProbes({
    clusters: ["a"],
    cities: ["Itu"],
    neighborhoods: bairros,
  })
  const deBairro = plano.filter((p) => p.kind === "neighborhood")
  assert.equal(deBairro.length, NEIGHBORHOOD_SAMPLE_SIZE)
  // 30 sondas viram 5: é a diferença entre custo proporcional à matriz e custo
  // proporcional à resposta.
  assert.ok(deBairro.length < bairros.length)
})

test("a amostra é por cidade — uma cidade não consome a cota da outra", () => {
  const bairros = [
    ...Array.from({ length: 20 }, (_, i) => ({ name: `A${i}`, city: "Itu" })),
    { name: "B1", city: "Salto" },
    { name: "B2", city: "Salto" },
  ]
  const plano = planLocalityProbes({
    clusters: ["a"],
    cities: ["Itu", "Salto"],
    neighborhoods: bairros,
  })
  const deBairro = plano.filter((p) => p.kind === "neighborhood")
  assert.equal(deBairro.length, NEIGHBORHOOD_SAMPLE_SIZE + 2)
  assert.ok(deBairro.some((p) => p.place === "B1"))
})

/* -------------------------------------------------------------------------- */
/*  Matriz                                                                    */
/* -------------------------------------------------------------------------- */

test("eixo provado: a matriz tema × cidade é gerada", () => {
  const m = localityMatrix({
    clusters: ["a", "b"],
    cities: ["Itu", "Salto"],
    findings: summarizeLocality([sonda("city", false), sonda("city", false)]),
  })
  assert.equal(m.length, 4)
})

test("eixo não provado: matriz vazia — páginas competiriam entre si", () => {
  const m = localityMatrix({
    clusters: ["a", "b"],
    cities: ["Itu", "Salto"],
    findings: summarizeLocality([sonda("city", true), sonda("city", true)]),
  })
  assert.deepEqual(m, [])
})

test("eixo não medido também não gera matriz", () => {
  const m = localityMatrix({
    clusters: ["a"],
    cities: ["Itu"],
    findings: summarizeLocality([]),
  })
  assert.deepEqual(m, [])
})
