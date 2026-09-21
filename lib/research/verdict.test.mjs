/**
 * Trava o veredito — a única saída da pesquisa que pede decisão humana.
 *
 * A distinção que mais importa aqui é entre **sem busca** e **sem medida**.
 * Medido no dump real: 1.274 candidatas com volume zero e 1.514 com volume
 * nulo. Chamar as nulas de "sem volume" mandaria o profissional apagar do
 * briefing palavras que talvez funcionem.
 */

import test from "node:test"
import assert from "node:assert/strict"

import { PLATFORM_SHARE_LIMIT, buildVerdicts, verdictSummary } from "./verdict.ts"

const SELF = "leotintas.com.br"

const candidata = (keyword, searchVolume, volumeLocationCode = 1031728) => ({
  keyword,
  sources: ["briefing"],
  searchVolume,
  volumeLocationCode,
  nationalVolume: null,
  monthlySearches: null,
  competition: null,
  competitionIndex: null,
  cpc: null,
  difficulty: null,
  intent: null,
  secondaryIntents: null,
  serpUrls: null,
  serpStatus: "done",
  serpLocationCode: 1031728,
})

const LOCAIS = [
  "segtintas.com.br",
  "itutintas.com.br",
  "grupoitutintas.com.br",
  "decorcolors.com.br",
]

const rodar = (over) =>
  buildVerdicts({
    seeds: ["tinta emborrachada"],
    candidates: [candidata("tinta emborrachada", 170)],
    clusters: [],
    serpDomains: { "tinta emborrachada": LOCAIS },
    selfDomain: SELF,
    ...over,
  })

/* -------------------------------------------------------------------------- */
/*  Sem busca não é sem medida                                                */
/* -------------------------------------------------------------------------- */

test("volume zero medido é sem_volume", () => {
  const v = rodar({ candidates: [candidata("tinta emborrachada", 0)] })
  assert.equal(v[0].label, "sem_volume")
})

test("volume nulo é viável, com a ressalva no texto", () => {
  const v = rodar({ candidates: [candidata("tinta emborrachada", null)] })
  assert.equal(v[0].label, "viavel")
  assert.match(v[0].reason, /não informou volume|não pôde ser medida/i)
})

test("volume presente entra no texto com a localidade certa", () => {
  const v = rodar({})
  assert.equal(v[0].label, "viavel")
  assert.match(v[0].reason, /170 buscas/)
  assert.match(v[0].reason, /na cidade/)
})

test("volume só nacional é dito como nacional", () => {
  const v = rodar({
    candidates: [candidata("tinta emborrachada", 60500, 2076)],
  })
  assert.match(v[0].reason, /no país/)
})

/* -------------------------------------------------------------------------- */
/*  SERP incompatível                                                         */
/* -------------------------------------------------------------------------- */

test("SERP dominada por marketplace é incompatível com loja local", () => {
  const v = rodar({
    serpDomains: {
      "tinta emborrachada": [
        "mercadolivre.com.br",
        "amazon.com.br",
        "leroymerlin.com.br",
        "segtintas.com.br",
      ],
    },
  })
  assert.equal(v[0].label, "serp_incompativel")
  assert.match(v[0].reason, /75%/)
})

test("abaixo do limiar ainda é viável — sobra espaço para loja local", () => {
  const v = rodar({
    serpDomains: {
      "tinta emborrachada": [
        "mercadolivre.com.br",
        "segtintas.com.br",
        "itutintas.com.br",
        "decorcolors.com.br",
      ],
    },
  })
  assert.equal(v[0].label, "viavel")
})

test("exatamente no limiar já é incompatível", () => {
  const v = rodar({
    serpDomains: {
      "tinta emborrachada": [
        "mercadolivre.com.br",
        "amazon.com.br",
        "segtintas.com.br",
        "itutintas.com.br",
      ],
    },
  })
  assert.equal(PLATFORM_SHARE_LIMIT, 0.5)
  assert.equal(v[0].label, "serp_incompativel")
})

/* -------------------------------------------------------------------------- */
/*  Canibalização, nas duas formas                                            */
/* -------------------------------------------------------------------------- */

test("duas páginas próprias no top 10 é canibalização", () => {
  const v = rodar({
    serpDomains: {
      "tinta emborrachada": [
        "leotintas.com.br",
        "loja.leotintas.com.br",
        "segtintas.com.br",
        "itutintas.com.br",
      ],
    },
  })
  assert.equal(v[0].label, "canibalizada")
  assert.match(v[0].reason, /2 posições/)
})

test("uma página própria no top 10 é bom, não canibalização", () => {
  const v = rodar({
    serpDomains: {
      "tinta emborrachada": ["leotintas.com.br", ...LOCAIS],
    },
  })
  assert.equal(v[0].label, "viavel")
})

test("duas seeds do briefing no mesmo cluster é canibalização", () => {
  const v = buildVerdicts({
    seeds: ["tinta emborrachada", "tinta borracha"],
    candidates: [
      candidata("tinta emborrachada", 170),
      candidata("tinta borracha", 90),
    ],
    clusters: [
      {
        id: "c1",
        keywords: ["tinta emborrachada", "tinta borracha"],
        headKeyword: "tinta emborrachada",
        totalVolume: 260,
        sharedUrls: [],
      },
    ],
    serpDomains: {
      "tinta emborrachada": LOCAIS,
      "tinta borracha": LOCAIS,
    },
    selfDomain: SELF,
  })
  assert.equal(v[0].label, "canibalizada")
  assert.equal(v[1].label, "canibalizada")
  assert.match(v[0].reason, /tinta borracha/)
})

test("seed sozinha no cluster com candidatas descobertas não é canibalização", () => {
  const v = buildVerdicts({
    seeds: ["tinta emborrachada"],
    candidates: [candidata("tinta emborrachada", 170)],
    clusters: [
      {
        id: "c1",
        keywords: ["tinta emborrachada", "tinta para telhado"],
        headKeyword: "tinta emborrachada",
        totalVolume: 260,
        sharedUrls: [],
      },
    ],
    serpDomains: { "tinta emborrachada": LOCAIS },
    selfDomain: SELF,
  })
  assert.equal(v[0].label, "viavel")
})

/* -------------------------------------------------------------------------- */
/*  Substitutas                                                               */
/* -------------------------------------------------------------------------- */

test("substituta sai do mesmo cluster, por volume", () => {
  const v = buildVerdicts({
    seeds: ["tinta emborrachada"],
    candidates: [
      candidata("tinta emborrachada", 0),
      candidata("tinta para telhado", 300),
      candidata("tinta impermeável", 900),
    ],
    clusters: [
      {
        id: "c1",
        keywords: [
          "tinta emborrachada",
          "tinta para telhado",
          "tinta impermeável",
        ],
        headKeyword: "tinta impermeável",
        totalVolume: 1200,
        sharedUrls: [],
      },
    ],
    serpDomains: { "tinta emborrachada": LOCAIS },
    selfDomain: SELF,
  })
  assert.equal(v[0].label, "sem_volume")
  assert.deepEqual(v[0].alternatives, ["tinta impermeável", "tinta para telhado"])
})

test("veredito viável não sugere substituta — não há o que substituir", () => {
  const v = rodar({})
  assert.deepEqual(v[0].alternatives, [])
})

test("sem cluster, não há substituta a oferecer", () => {
  const v = rodar({ candidates: [candidata("tinta emborrachada", 0)] })
  assert.deepEqual(v[0].alternatives, [])
})

/* -------------------------------------------------------------------------- */
/*  Escopo e resumo                                                           */
/* -------------------------------------------------------------------------- */

test("só as keywords do briefing recebem veredito", () => {
  const v = buildVerdicts({
    seeds: ["tinta emborrachada"],
    candidates: [
      candidata("tinta emborrachada", 170),
      candidata("suvinil tintas", 60500),
    ],
    clusters: [],
    serpDomains: { "tinta emborrachada": LOCAIS },
    selfDomain: SELF,
  })
  assert.equal(v.length, 1)
  assert.equal(v[0].keyword, "tinta emborrachada")
})

test("seed sem SERP e sem candidata ainda recebe veredito", () => {
  const v = buildVerdicts({
    seeds: ["termo órfão"],
    candidates: [],
    clusters: [],
    serpDomains: {},
    selfDomain: SELF,
  })
  assert.equal(v.length, 1)
  assert.equal(v[0].label, "viavel")
})

test("resumo conta os quatro rótulos", () => {
  const resumo = verdictSummary([
    { keyword: "a", label: "viavel", reason: "", alternatives: [] },
    { keyword: "b", label: "viavel", reason: "", alternatives: [] },
    { keyword: "c", label: "sem_volume", reason: "", alternatives: [] },
  ])
  assert.deepEqual(resumo, {
    viavel: 2,
    sem_volume: 1,
    serp_incompativel: 0,
    canibalizada: 0,
  })
})
