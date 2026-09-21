/**
 * Trava o agrupamento por sobreposição de SERP.
 *
 * Os casos que importam são os quatro do plano — SERP idêntica, SERP disjunta,
 * transitividade e SERP falha — mais dois que só apareceram ao escrever o
 * algoritmo: URL exata contra domínio, e `done` sem orgânico, que não é falha.
 */

import test from "node:test"
import assert from "node:assert/strict"

import { MIN_OVERLAP, buildClusters, overlapBetween } from "./cluster.ts"

const feita = (keyword, urls, searchVolume = 10) => ({
  keyword,
  urls,
  status: "done",
  searchVolume,
})

const U = (n) => `https://exemplo${n}.com.br/pagina`

/* -------------------------------------------------------------------------- */
/*  O núcleo                                                                  */
/* -------------------------------------------------------------------------- */

test("SERPs idênticas viram um cluster", () => {
  const r = buildClusters({
    entries: [
      feita("tinta emborrachada", [U(1), U(2), U(3), U(4)]),
      feita("tinta borracha", [U(1), U(2), U(3), U(4)]),
    ],
  })
  assert.equal(r.clusters.length, 1)
  assert.equal(r.clusters[0].keywords.length, 2)
})

test("SERPs sem URL em comum viram clusters separados", () => {
  const r = buildClusters({
    entries: [
      feita("tinta emborrachada", [U(1), U(2), U(3)]),
      feita("piso vinílico", [U(7), U(8), U(9)]),
    ],
  })
  assert.equal(r.clusters.length, 2)
  assert.ok(r.clusters.every((c) => c.keywords.length === 1))
})

test("abaixo do limiar não junta", () => {
  const r = buildClusters({
    entries: [
      feita("a", [U(1), U(2), U(5)]),
      feita("b", [U(1), U(2), U(6)]), // 2 em comum, limiar é 3
    ],
  })
  assert.equal(r.clusters.length, 2)
})

test("exatamente no limiar junta", () => {
  const r = buildClusters({
    entries: [
      feita("a", [U(1), U(2), U(3), U(5)]),
      feita("b", [U(1), U(2), U(3), U(6)]),
    ],
  })
  assert.equal(r.clusters.length, 1)
  assert.equal(MIN_OVERLAP, 3)
})

test("transitividade: A–B e B–C põem os três juntos", () => {
  // A e C não se tocam diretamente, mas o Google já disse que B é dos dois.
  const r = buildClusters({
    entries: [
      feita("a", [U(1), U(2), U(3)]),
      feita("b", [U(1), U(2), U(3), U(4), U(5)]),
      feita("c", [U(3), U(4), U(5)]),
    ],
  })
  assert.equal(r.clusters.length, 1)
  assert.deepEqual(r.clusters[0].keywords.sort(), ["a", "b", "c"])
})

/* -------------------------------------------------------------------------- */
/*  URL exata, não domínio                                                    */
/* -------------------------------------------------------------------------- */

test("páginas diferentes do mesmo site NÃO juntam", () => {
  // Este é o sinal que a fase existe para capturar: mesmo domínio, páginas
  // diferentes, intenções diferentes. Agrupar por domínio apagaria isso.
  const r = buildClusters({
    entries: [
      feita("a", [
        "https://loja.com.br/tinta-acrilica",
        "https://outro.com.br/x",
        "https://mais.com.br/y",
      ]),
      feita("b", [
        "https://loja.com.br/tinta-emborrachada",
        "https://outro.com.br/z",
        "https://mais.com.br/w",
      ]),
    ],
  })
  assert.equal(r.clusters.length, 2)
})

test("barra final não cria URL distinta", () => {
  const r = buildClusters({
    entries: [
      feita("a", ["https://x.com/p/", "https://y.com/p/", "https://z.com/p/"]),
      feita("b", ["https://x.com/p", "https://y.com/p", "https://z.com/p"]),
    ],
  })
  assert.equal(r.clusters.length, 1)
})

test("URL repetida na mesma SERP conta uma vez", () => {
  const r = buildClusters({
    entries: [
      feita("a", [U(1), U(1), U(1), U(2)]),
      feita("b", [U(1), U(3), U(4)]),
    ],
  })
  // Sem o dedup, `a` e `b` teriam 3 "sobreposições" da mesma URL.
  assert.equal(r.clusters.length, 2)
})

/* -------------------------------------------------------------------------- */
/*  Falha não é ausência, e ausência não é vazio                              */
/* -------------------------------------------------------------------------- */

test("SERP falha fica fora do grafo, não vira cluster de um", () => {
  const r = buildClusters({
    entries: [
      feita("boa", [U(1), U(2), U(3)]),
      { keyword: "quebrada", urls: null, status: "failed", searchVolume: 999 },
    ],
  })
  assert.equal(r.clusters.length, 1)
  assert.deepEqual(r.excluded, [
    { keyword: "quebrada", reason: "serp_falhou" },
  ])
})

test("SERP não coletada é ausência, com motivo próprio", () => {
  const r = buildClusters({
    entries: [
      { keyword: "nova", urls: null, status: "pending", searchVolume: 10 },
    ],
  })
  assert.equal(r.excluded[0].reason, "serp_ausente")
})

test("done sem orgânico é medido e vazio, não falha", () => {
  const r = buildClusters({ entries: [feita("rara", [])] })
  assert.equal(r.excluded[0].reason, "sem_organico")
  assert.equal(r.clusters.length, 0)
})

/* -------------------------------------------------------------------------- */
/*  Saída                                                                     */
/* -------------------------------------------------------------------------- */

test("headKeyword é a de maior volume do cluster", () => {
  const r = buildClusters({
    entries: [
      feita("menor", [U(1), U(2), U(3)], 50),
      feita("maior", [U(1), U(2), U(3)], 900),
    ],
  })
  assert.equal(r.clusters[0].headKeyword, "maior")
  assert.equal(r.clusters[0].totalVolume, 950)
})

test("sharedUrls é a evidência do porquê juntos", () => {
  const r = buildClusters({
    entries: [
      feita("a", [U(1), U(2), U(3), U(8)]),
      feita("b", [U(1), U(2), U(3), U(9)]),
    ],
  })
  const compartilhadas = r.clusters[0].sharedUrls.sort()
  assert.deepEqual(compartilhadas, [U(1), U(2), U(3)].sort())
})

test("cluster maior vem primeiro; no empate, o de maior volume", () => {
  const r = buildClusters({
    entries: [
      feita("solo", [U(20), U(21), U(22)], 5000),
      feita("a", [U(1), U(2), U(3)], 10),
      feita("b", [U(1), U(2), U(3)], 10),
    ],
  })
  assert.equal(r.clusters[0].keywords.length, 2)
  assert.equal(r.clusters[1].keywords.length, 1)
})

test("volume nulo não quebra a soma", () => {
  const r = buildClusters({
    entries: [feita("a", [U(1), U(2), U(3)], null), feita("b", [U(1), U(2), U(3)], 10)],
  })
  assert.equal(r.clusters[0].totalVolume, 10)
  assert.equal(r.clusters[0].headKeyword, "b")
})

test("estatística fecha", () => {
  const r = buildClusters({
    entries: [
      feita("a", [U(1), U(2), U(3)]),
      feita("b", [U(1), U(2), U(3)]),
      feita("solo", [U(9), U(8), U(7)]),
      { keyword: "x", urls: null, status: "failed", searchVolume: null },
    ],
  })
  assert.equal(r.stats.entries, 4)
  assert.equal(r.stats.clustered, 1)
  assert.equal(r.stats.singletons, 1)
  assert.equal(r.stats.excluded, 1)
})

/* -------------------------------------------------------------------------- */
/*  Utilitário e borda                                                        */
/* -------------------------------------------------------------------------- */

test("overlapBetween conta URLs em comum, normalizando", () => {
  assert.equal(
    overlapBetween(
      ["https://a.com/p/", "https://b.com/p", "https://c.com/p"],
      ["https://a.com/p", "https://b.com/p/", "https://z.com/p"],
    ),
    2,
  )
})

test("lista vazia é resultado vazio, não erro", () => {
  const r = buildClusters({ entries: [] })
  assert.deepEqual(r.clusters, [])
  assert.equal(r.stats.entries, 0)
})

test("limiar configurável", () => {
  const r = buildClusters({
    entries: [feita("a", [U(1), U(5)]), feita("b", [U(1), U(6)])],
    minOverlap: 1,
  })
  assert.equal(r.clusters.length, 1)
})
