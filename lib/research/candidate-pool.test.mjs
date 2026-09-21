/**
 * Trava o merge das duas fontes de expansão.
 *
 * As fixtures são as mesmas da Task 4 — payload real de 2026-09-18. As duas
 * juntas exercitam o caso que importa: `keywords_for_keywords` mediu na cidade
 * (`location_code: 1031728`, Itu) e `keyword_ideas` mediu no país
 * (`location_code: 2076`). São números da mesma keyword que **não são
 * comparáveis**, e o merge não pode fingir que são.
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import test from "node:test"
import assert from "node:assert/strict"

import {
  mapKeywordIdeas,
  mapKeywordsForKeywords,
} from "../dataforseo/keyword-expansion.ts"
import { buildCandidatePool, intentBatches } from "./candidate-pool.ts"

const aqui = dirname(fileURLToPath(import.meta.url))
const ler = (nome) =>
  JSON.parse(readFileSync(join(aqui, "..", "dataforseo", nome), "utf8"))

const local = mapKeywordsForKeywords(ler("keyword-expansion.fixture.json"))
const national = mapKeywordIdeas(ler("keyword-ideas.fixture.json"))

const achar = (pool, nome) => pool.candidates.find((c) => c.keyword === nome)

/* -------------------------------------------------------------------------- */
/*  Merge das duas fontes reais                                               */
/* -------------------------------------------------------------------------- */

test("junta as duas fontes sem perder ninguém", () => {
  const pool = buildCandidatePool({ seeds: [], local, national })
  // 7 locais + 5 nacionais, sem sobreposição entre as fixtures.
  assert.equal(pool.candidates.length, 12)
  assert.equal(pool.stats.total, 12)
})

test("candidata local guarda o location da cidade", () => {
  const pool = buildCandidatePool({ seeds: [], local, national })
  const kw = achar(pool, "tinta emborrachada")
  assert.equal(kw.searchVolume, 170)
  assert.equal(kw.volumeLocationCode, 1031728)
  assert.deepEqual(kw.sources, ["keywords_for_keywords"])
})

test("candidata nacional guarda o location do país e o volume nacional", () => {
  const pool = buildCandidatePool({ seeds: [], local, national })
  const kw = achar(pool, "suvinil tintas")
  assert.equal(kw.searchVolume, 60500)
  assert.equal(kw.volumeLocationCode, 2076)
  assert.equal(kw.nationalVolume, 60500)
})

test("difficulty e intent só chegam pela fonte que os tem", () => {
  const pool = buildCandidatePool({ seeds: [], local, national })
  assert.equal(achar(pool, "suvinil tintas").difficulty, 17)
  assert.equal(achar(pool, "suvinil tintas").intent.label, "transactional")
  // A fonte local não traz nenhum dos dois.
  assert.equal(achar(pool, "tinta emborrachada").difficulty, null)
  assert.equal(achar(pool, "tinta emborrachada").intent, null)
})

/* -------------------------------------------------------------------------- */
/*  O volume local manda — e o nacional não o substitui                       */
/* -------------------------------------------------------------------------- */

const mesmaKeyword = {
  local: [
    {
      keyword: "tinta suvinil",
      searchVolume: 30,
      monthlySearches: [{ year: 2026, month: 8, searchVolume: 30 }],
      competition: "MEDIUM",
      competitionIndex: 50,
      cpc: 1.2,
      locationCode: 1031728,
      difficulty: null,
      mainIntent: null,
    },
  ],
  national: [
    {
      keyword: "tinta suvinil",
      searchVolume: 60500,
      monthlySearches: [{ year: 2026, month: 8, searchVolume: 60500 }],
      competition: "HIGH",
      competitionIndex: 1,
      cpc: 0.11,
      locationCode: 2076,
      difficulty: 17,
      mainIntent: "transactional",
    },
  ],
}

test("com as duas medidas, o volume local vence — 30 e não 60.500", () => {
  const pool = buildCandidatePool({ seeds: [], ...mesmaKeyword })
  const kw = achar(pool, "tinta suvinil")
  assert.equal(kw.searchVolume, 30)
  assert.equal(kw.volumeLocationCode, 1031728)
})

test("o nacional continua acessível, em campo próprio", () => {
  const pool = buildCandidatePool({ seeds: [], ...mesmaKeyword })
  const kw = achar(pool, "tinta suvinil")
  assert.equal(kw.nationalVolume, 60500)
  assert.notEqual(kw.searchVolume, kw.nationalVolume)
})

test("difficulty e intent do nacional sobrevivem ao merge", () => {
  const pool = buildCandidatePool({ seeds: [], ...mesmaKeyword })
  const kw = achar(pool, "tinta suvinil")
  assert.equal(kw.difficulty, 17)
  assert.equal(kw.intent.label, "transactional")
  assert.deepEqual(kw.sources.sort(), ["keyword_ideas", "keywords_for_keywords"])
})

test("sazonalidade vem da mesma fonte que o volume escolhido", () => {
  const pool = buildCandidatePool({ seeds: [], ...mesmaKeyword })
  const kw = achar(pool, "tinta suvinil")
  assert.equal(kw.monthlySearches[0].searchVolume, 30)
})

/* -------------------------------------------------------------------------- */
/*  Seed do briefing nunca some                                               */
/* -------------------------------------------------------------------------- */

test("seed sem volume e sem expansão continua no pool", () => {
  const pool = buildCandidatePool({
    seeds: ["serviço que ninguém busca"],
    local: [],
    national: [],
  })
  assert.equal(pool.candidates.length, 1)
  const kw = pool.candidates[0]
  assert.deepEqual(kw.sources, ["briefing"])
  assert.equal(kw.searchVolume, null)
  assert.deepEqual(pool.stats.unconfirmedSeeds, ["serviço que ninguém busca"])
})

test("seed confirmada pela expansão acumula as duas origens", () => {
  const pool = buildCandidatePool({
    seeds: ["tinta emborrachada"],
    local,
    national: [],
  })
  const kw = achar(pool, "tinta emborrachada")
  assert.deepEqual(kw.sources.sort(), ["briefing", "keywords_for_keywords"])
  assert.equal(kw.searchVolume, 170)
  assert.deepEqual(pool.stats.unconfirmedSeeds, [])
})

test("seed casa ignorando caixa e acento", () => {
  const pool = buildCandidatePool({
    seeds: ["TINTA ACRÍLICA SEMI BRILHO 18 LITROS PREÇO"],
    local,
    national: [],
  })
  const encontrada = pool.candidates.filter((c) =>
    c.sources.includes("briefing"),
  )
  assert.equal(encontrada.length, 1)
  assert.deepEqual(encontrada[0].sources.sort(), [
    "briefing",
    "keywords_for_keywords",
  ])
})

/* -------------------------------------------------------------------------- */
/*  Estatística — o número que a Fase 4 usa                                   */
/* -------------------------------------------------------------------------- */

test("descobertas são as que o cliente não tinha listado", () => {
  const pool = buildCandidatePool({
    seeds: ["tinta emborrachada"],
    local,
    national,
  })
  assert.equal(pool.stats.fromBriefing, 1)
  assert.equal(pool.stats.discovered, 11)
  assert.equal(pool.stats.fromBriefing + pool.stats.discovered, pool.stats.total)
})

test("withLocalVolume não conta quem só tem número nacional", () => {
  const pool = buildCandidatePool({ seeds: [], local, national })
  const comLocal = pool.candidates.filter(
    (c) => c.volumeLocationCode === 1031728 && c.searchVolume !== null,
  )
  assert.equal(pool.stats.withLocalVolume, comLocal.length)
  assert.ok(pool.stats.withLocalVolume < pool.stats.total)
})

/* -------------------------------------------------------------------------- */
/*  Grafia                                                                    */
/* -------------------------------------------------------------------------- */

const duasGrafias = (volA, volB) => [
  {
    keyword: "tinta acrilica",
    searchVolume: volA,
    monthlySearches: null,
    competition: null,
    competitionIndex: null,
    cpc: null,
    locationCode: 1031728,
    difficulty: null,
    mainIntent: null,
  },
  {
    keyword: "tinta acrílica",
    searchVolume: volB,
    monthlySearches: null,
    competition: null,
    competitionIndex: null,
    cpc: null,
    locationCode: 1031728,
    difficulty: null,
    mainIntent: null,
  },
]

test("maior volume decide a grafia", () => {
  const pool = buildCandidatePool({
    seeds: [],
    local: duasGrafias(500, 10),
    national: [],
  })
  assert.equal(pool.candidates.length, 1)
  assert.equal(pool.candidates[0].keyword, "tinta acrilica")
})

test("no empate, ganha a grafia com acento", () => {
  const pool = buildCandidatePool({
    seeds: [],
    local: duasGrafias(100, 100),
    national: [],
  })
  assert.equal(pool.candidates.length, 1)
  assert.equal(pool.candidates[0].keyword, "tinta acrílica")
})

/* -------------------------------------------------------------------------- */
/*  Lotes de intenção                                                         */
/* -------------------------------------------------------------------------- */

test("quem já tem intenção fica fora do lote — poupa chamada", () => {
  const pool = buildCandidatePool({ seeds: [], local, national })
  const lotes = intentBatches(pool.candidates)
  const noLote = lotes.flat()
  // As cinco do keyword_ideas trouxeram main_intent e não entram.
  assert.equal(noLote.length, pool.stats.needingIntent)
  assert.ok(!noLote.includes("suvinil tintas"))
  assert.ok(noLote.includes("tinta emborrachada"))
})

test("fatia no teto medido de 20 por chamada", () => {
  const muitas = Array.from({ length: 45 }, (_, i) => ({
    keyword: `kw ${i}`,
    searchVolume: 10,
    monthlySearches: null,
    competition: null,
    competitionIndex: null,
    cpc: null,
    locationCode: 1031728,
    difficulty: null,
    mainIntent: null,
  }))
  const pool = buildCandidatePool({ seeds: [], local: muitas, national: [] })
  const lotes = intentBatches(pool.candidates)
  assert.equal(lotes.length, 3)
  assert.deepEqual(
    lotes.map((l) => l.length),
    [20, 20, 5],
  )
})

test("sem pendência, sem lote — não inventa chamada paga", () => {
  const pool = buildCandidatePool({ seeds: [], local: [], national })
  assert.deepEqual(intentBatches(pool.candidates), [])
})

/* -------------------------------------------------------------------------- */
/*  Entrada hostil                                                            */
/* -------------------------------------------------------------------------- */

test("pool vazio é pool vazio, não erro", () => {
  const pool = buildCandidatePool({ seeds: [], local: [], national: [] })
  assert.deepEqual(pool.candidates, [])
  assert.equal(pool.stats.total, 0)
})

test("seed em branco não vira candidata", () => {
  const pool = buildCandidatePool({
    seeds: ["", "   ", "válida"],
    local: [],
    national: [],
  })
  assert.equal(pool.candidates.length, 1)
  assert.equal(pool.candidates[0].keyword, "válida")
})
