/**
 * Trava o leitor da expansão contra **payload real**.
 *
 * A fixture é recorte de `02-keywords-for-keywords.json`, medido em 2026-09-18
 * contra `leotintas.com.br` / Itu. Os sete itens não foram escolhidos por
 * conveniência: cada um cobre uma forma que apareceu no dump de 4.831
 * candidatas.
 *
 * A armadilha central é silenciosa: `search_volume` vem `null` em 1.514 itens e
 * `0` em outros 1.274. Um leitor que faça `?? 0` devolve lista com cara de
 * resultado e joga 31% do conjunto na mesma cesta de "sem busca".
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import test from "node:test"
import assert from "node:assert/strict"

import {
  KEYWORDS_FOR_KEYWORDS_MAX_SEEDS,
  keywordsForKeywordsTasks,
  mapKeywordIdeas,
  mapKeywordsForKeywords,
  peakMonth,
  yearlyVolume,
} from "./keyword-expansion.ts"

const aqui = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(
  readFileSync(join(aqui, "keyword-expansion.fixture.json"), "utf8"),
)
const fixtureIdeas = JSON.parse(
  readFileSync(join(aqui, "keyword-ideas.fixture.json"), "utf8"),
)

const candidatas = mapKeywordsForKeywords(fixture)
const porNome = (nome) => candidatas.find((c) => c.keyword === nome)

const ideas = mapKeywordIdeas(fixtureIdeas)
const ideaPorNome = (nome) => ideas.find((c) => c.keyword === nome)

/* -------------------------------------------------------------------------- */
/*  Leitura do payload real                                                   */
/* -------------------------------------------------------------------------- */

test("lê as sete candidatas da fixture", () => {
  assert.equal(candidatas.length, 7)
})

test("resultado fica em tasks[].result[] direto, não em result[0].items[]", () => {
  // O Labs usa result[0].items[]; keywords_data não. Ler a forma errada
  // devolve lista vazia sem erro nenhum.
  assert.ok(candidatas.length > 0)
  assert.equal(typeof fixture.tasks[0].result[0].keyword, "string")
  assert.equal(fixture.tasks[0].result[0].items, undefined)
})

test("mapeia a candidata de maior volume com todos os campos", () => {
  const kw = porNome("tinta emborrachada")
  assert.deepEqual(
    {
      searchVolume: kw.searchVolume,
      competition: kw.competition,
      competitionIndex: kw.competitionIndex,
      cpc: kw.cpc,
      locationCode: kw.locationCode,
      meses: kw.monthlySearches.length,
    },
    {
      searchVolume: 170,
      competition: "HIGH",
      competitionIndex: 100,
      cpc: 0.18,
      locationCode: 1031728,
      meses: 12,
    },
  )
})

/* -------------------------------------------------------------------------- */
/*  null nunca vira zero — a armadilha central                                */
/* -------------------------------------------------------------------------- */

test("search_volume null continua null, não vira 0", () => {
  const kw = porNome("loja de tintas porto alegre")
  assert.equal(kw.searchVolume, null)
  assert.notEqual(kw.searchVolume, 0)
})

test("search_volume 0 continua 0, não vira null", () => {
  const kw = porNome("tinta acrilica semi brilho 18 litros preço")
  assert.equal(kw.searchVolume, 0)
  assert.notEqual(kw.searchVolume, null)
})

test("volume nulo e volume zero são candidatas distintas no mesmo conjunto", () => {
  const nulos = candidatas.filter((c) => c.searchVolume === null)
  const zeros = candidatas.filter((c) => c.searchVolume === 0)
  assert.equal(nulos.length, 1)
  assert.equal(zeros.length, 1)
  assert.notEqual(nulos[0].keyword, zeros[0].keyword)
})

test("monthly_searches null continua null, não vira lista vazia", () => {
  const kw = porNome("loja de tintas porto alegre")
  assert.equal(kw.monthlySearches, null)
})

test("volume zero ainda pode ter histórico — zero não é ausência de medida", () => {
  const kw = porNome("tinta acrilica semi brilho 18 litros preço")
  assert.equal(kw.searchVolume, 0)
  assert.equal(kw.monthlySearches.length, 12)
})

test("competition e cpc nulos continuam nulos com volume presente", () => {
  const kw = porNome("tinta borracha liquida decor colors")
  assert.equal(kw.searchVolume, 10)
  assert.equal(kw.competition, null)
  assert.equal(kw.cpc, null)
})

test("acento no termo sobrevive intacto", () => {
  const kw = porNome("massa acrílica")
  assert.equal(kw.searchVolume, 70)
})

/* -------------------------------------------------------------------------- */
/*  Sazonalidade — de graça, no mesmo payload                                 */
/* -------------------------------------------------------------------------- */

test("yearlyVolume soma os doze meses", () => {
  const kw = porNome("tinta emborrachada")
  const soma = kw.monthlySearches.reduce((t, m) => t + m.searchVolume, 0)
  assert.equal(yearlyVolume(kw), soma)
  assert.equal(yearlyVolume(kw), 1850)
})

test("peakMonth acha o pico, que não é a média", () => {
  const kw = porNome("tinta emborrachada")
  const pico = peakMonth(kw)
  assert.equal(pico.searchVolume, 210)
  assert.equal(kw.searchVolume, 170)
  // Média 170 contra pico 210: quem monta calendário precisa do pico.
  assert.ok(pico.searchVolume > kw.searchVolume)
})

test("sem histórico, sazonalidade é null e não zero", () => {
  const kw = porNome("loja de tintas porto alegre")
  assert.equal(yearlyVolume(kw), null)
  assert.equal(peakMonth(kw), null)
})

/* -------------------------------------------------------------------------- */
/*  Construtor da tarefa                                                      */
/* -------------------------------------------------------------------------- */

test("fatia os seeds no teto por chamada", () => {
  const seeds = Array.from({ length: 50 }, (_, i) => `kw ${i}`)
  const tarefas = keywordsForKeywordsTasks({
    seeds,
    locationCode: 1031728,
    languageCode: "pt",
  })
  assert.equal(tarefas.length, Math.ceil(50 / KEYWORDS_FOR_KEYWORDS_MAX_SEEDS))
  assert.ok(
    tarefas.every((t) => t.keywords.length <= KEYWORDS_FOR_KEYWORDS_MAX_SEEDS),
  )
  assert.equal(tarefas.flatMap((t) => t.keywords).length, 50)
})

test("uma chamada só quando cabe", () => {
  const tarefas = keywordsForKeywordsTasks({
    seeds: ["loja de tintas", "tinta emborrachada"],
    locationCode: 1031728,
    languageCode: "pt",
  })
  assert.equal(tarefas.length, 1)
  assert.deepEqual(tarefas[0], {
    keywords: ["loja de tintas", "tinta emborrachada"],
    location_code: 1031728,
    language_code: "pt",
  })
})

test("dedup e trim antes de fatiar — seed repetida não ocupa vaga", () => {
  const tarefas = keywordsForKeywordsTasks({
    seeds: ["  tinta  ", "TINTA", "tinta", "massa", ""],
    locationCode: 2076,
    languageCode: "pt",
  })
  assert.deepEqual(tarefas[0].keywords, ["tinta", "massa"])
})

test("sem seed, sem tarefa — não inventa chamada paga", () => {
  const tarefas = keywordsForKeywordsTasks({
    seeds: ["", "   "],
    locationCode: 2076,
    languageCode: "pt",
  })
  assert.deepEqual(tarefas, [])
})

/* -------------------------------------------------------------------------- */
/*  Envelope hostil                                                           */
/* -------------------------------------------------------------------------- */

test("envelope inválido devolve lista vazia, não explode", () => {
  for (const lixo of [null, undefined, 42, "texto", [], {}, { tasks: null }]) {
    assert.deepEqual(mapKeywordsForKeywords(lixo), [])
  }
})

test("tarefa sem result é ignorada, as outras continuam", () => {
  const misto = {
    tasks: [
      { status_code: 40501, result: null },
      fixture.tasks[0],
    ],
  }
  assert.equal(mapKeywordsForKeywords(misto).length, 7)
})

test("item sem keyword é descartado, o resto sobrevive", () => {
  const sujo = {
    tasks: [
      {
        result: [
          { search_volume: 10 },
          { keyword: "  ", search_volume: 10 },
          { keyword: "válida", search_volume: 10 },
        ],
      },
    ],
  }
  const lidas = mapKeywordsForKeywords(sujo)
  assert.equal(lidas.length, 1)
  assert.equal(lidas[0].keyword, "válida")
})

test("dedup entre tarefas — o mesmo termo não entra duas vezes", () => {
  const duplicado = { tasks: [fixture.tasks[0], fixture.tasks[0]] }
  assert.equal(mapKeywordsForKeywords(duplicado).length, 7)
})

/* -------------------------------------------------------------------------- */
/*  keyword_ideas — outra forma, mesmo destino                                */
/* -------------------------------------------------------------------------- */

test("lê os cinco itens aninhados em result[0].items[]", () => {
  assert.equal(ideas.length, 5)
  // A forma é aninhada aqui e plana no outro endpoint. Ler a forma errada
  // devolve lista vazia sem erro.
  assert.equal(fixtureIdeas.tasks[0].result[0].items.length, 5)
  assert.equal(fixtureIdeas.tasks[0].result[0].keyword, undefined)
})

test("o leitor do outro endpoint não lê este — as formas não se cruzam", () => {
  assert.deepEqual(mapKeywordsForKeywords(fixtureIdeas), [])
  assert.deepEqual(mapKeywordIdeas(fixture), [])
})

test("competition vira o rótulo, não o número", () => {
  const kw = ideaPorNome("suvinil tintas")
  // `competition: 1` com `competition_level: "HIGH"`. Ler o número como rótulo
  // produziria "1" onde deveria estar "HIGH".
  assert.equal(kw.competition, "HIGH")
  assert.equal(kw.competitionIndex, 1)
})

test("competition 0 é LOW medido, não ausência", () => {
  const kw = ideaPorNome("cores com t")
  assert.equal(kw.competition, "LOW")
  assert.equal(kw.competitionIndex, 0)
  assert.notEqual(kw.competitionIndex, null)
})

test("difficulty 0 é dificuldade medida, não ausência", () => {
  const kw = ideaPorNome("tinta suvinil preço 18 litros")
  assert.equal(kw.difficulty, 0)
  assert.notEqual(kw.difficulty, null)
})

test("item sem métrica nenhuma vem todo nulo, sem virar zero", () => {
  const kw = ideaPorNome("tinta acrilica emborrachada 18 litros")
  assert.equal(kw.searchVolume, null)
  assert.equal(kw.competition, null)
  assert.equal(kw.competitionIndex, null)
  assert.equal(kw.cpc, null)
  assert.equal(kw.difficulty, null)
})

test("traz intenção de graça — poupa chamada de search_intent", () => {
  assert.equal(ideaPorNome("suvinil tintas").mainIntent, "transactional")
  assert.equal(ideaPorNome("psicologia das cores").mainIntent, "informational")
})

test("volume alto é lido de keyword_info, não da raiz do item", () => {
  const kw = ideaPorNome("suvinil tintas")
  assert.equal(kw.searchVolume, 60500)
  assert.equal(kw.monthlySearches.length, 12)
  assert.equal(kw.locationCode, 2076)
})

test("os dois leitores produzem o mesmo formato — o pool consome um só tipo", () => {
  const chavesKfk = Object.keys(candidatas[0]).sort()
  const chavesIdeas = Object.keys(ideas[0]).sort()
  assert.deepEqual(chavesKfk, chavesIdeas)
})

test("keyword_ideas: envelope hostil devolve lista vazia", () => {
  for (const lixo of [null, 42, {}, { tasks: [{ result: null }] }]) {
    assert.deepEqual(mapKeywordIdeas(lixo), [])
  }
})

test("keyword_ideas: dedup entre resultados", () => {
  const dobrado = {
    tasks: [{ result: [fixtureIdeas.tasks[0].result[0], fixtureIdeas.tasks[0].result[0]] }],
  }
  assert.equal(mapKeywordIdeas(dobrado).length, 5)
})
