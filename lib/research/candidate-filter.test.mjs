/**
 * Trava o filtro que decide o preço da fase.
 *
 * Os casos usam as fixtures reais das duas expansões, porque as armadilhas
 * daqui são todas de dados medidos: `psicologia das cores` com 22.200 de
 * volume e assunto errado, `loja de tintas porto alegre` num cliente de Itu, e
 * a mistura de volume local com nacional que ordena errado se achatada.
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
import { buildCandidatePool } from "./candidate-pool.ts"
import {
  DEFAULT_SERP_LIMIT,
  filterCandidates,
  serpCallCount,
} from "./candidate-filter.ts"

const aqui = dirname(fileURLToPath(import.meta.url))
const ler = (nome) =>
  JSON.parse(readFileSync(join(aqui, "..", "dataforseo", nome), "utf8"))

const SEEDS = ["loja de tintas", "tinta emborrachada", "tinta acrilica"]

const pool = buildCandidatePool({
  seeds: SEEDS,
  local: mapKeywordsForKeywords(ler("keyword-expansion.fixture.json")),
  national: mapKeywordIdeas(ler("keyword-ideas.fixture.json")),
})

const rodar = (over = {}) =>
  filterCandidates({ candidates: pool.candidates, seeds: SEEDS, ...over })

const motivoDe = (r, keyword) =>
  r.rejected.find((x) => x.keyword === keyword)?.reason

/* -------------------------------------------------------------------------- */
/*  Relevância — volume alto com assunto errado                               */
/* -------------------------------------------------------------------------- */

test("corta volume alto de assunto errado", () => {
  const r = rodar()
  // 22.200 de volume e nenhum token em comum com nenhum seed.
  assert.equal(motivoDe(r, "psicologia das cores"), "irrelevante")
  assert.ok(!r.selected.some((c) => c.keyword === "psicologia das cores"))
})

test("marca do ramo passa pelo plural", () => {
  const r = rodar()
  // `suvinil tintas` compartilha `tinta` com `loja de tintas` depois do stem.
  assert.ok(r.selected.some((c) => c.keyword === "suvinil tintas"))
})

test("sem seed, a relevância não corta ninguém", () => {
  const r = filterCandidates({ candidates: pool.candidates, seeds: [] })
  assert.equal(r.stats.byReason.irrelevante, 0)
})

/* -------------------------------------------------------------------------- */
/*  null nunca é zero                                                         */
/* -------------------------------------------------------------------------- */

test("volume zero medido é cortado", () => {
  const r = rodar()
  assert.equal(
    motivoDe(r, "tinta acrilica semi brilho 18 litros preço"),
    "volume_zero",
  )
})

test("volume nulo não é cortado como zero", () => {
  const r = rodar()
  const nula = "loja de tintas porto alegre"
  assert.notEqual(motivoDe(r, nula), "volume_zero")
})

/* -------------------------------------------------------------------------- */
/*  Termos excluídos                                                          */
/* -------------------------------------------------------------------------- */

test("cidade de outra praça sai quando o chamador informa", () => {
  const r = rodar({ excludeTerms: ["porto alegre"] })
  assert.equal(motivoDe(r, "loja de tintas porto alegre"), "termo_excluido")
})

test("sem a lista, a candidata de outra praça passa — e isso é sabido", () => {
  const r = rodar()
  assert.notEqual(motivoDe(r, "loja de tintas porto alegre"), "termo_excluido")
})

/* -------------------------------------------------------------------------- */
/*  Seeds passam sempre, e fora do teto                                       */
/* -------------------------------------------------------------------------- */

test("seed entra mesmo sem volume e mesmo com o teto em zero", () => {
  const r = filterCandidates({
    candidates: pool.candidates,
    seeds: SEEDS,
    limit: 0,
  })
  assert.equal(r.stats.seedsForced, 3)
  assert.equal(r.selected.length, 3)
  for (const seed of SEEDS) {
    assert.ok(r.selected.some((c) => c.keyword.toLowerCase() === seed))
  }
})

test("seed com volume zero não é cortada — precisa de SERP para o veredito", () => {
  const r = filterCandidates({
    candidates: [
      {
        keyword: "termo morto",
        sources: ["briefing"],
        searchVolume: 0,
        volumeLocationCode: 1031728,
        nationalVolume: null,
        monthlySearches: null,
        competition: null,
        competitionIndex: null,
        cpc: null,
        difficulty: null,
        intent: null,
        secondaryIntents: null,
        serpUrls: null,
        serpStatus: "pending",
        serpLocationCode: null,
      },
    ],
    seeds: ["termo morto"],
  })
  assert.equal(r.selected.length, 1)
  assert.equal(r.rejected.length, 0)
})

/* -------------------------------------------------------------------------- */
/*  As duas faixas — local antes de nacional                                  */
/* -------------------------------------------------------------------------- */

const faixa = (keyword, local, nacional) => ({
  keyword,
  sources: local ? ["keywords_for_keywords"] : ["keyword_ideas"],
  searchVolume: local ?? nacional,
  volumeLocationCode: local ? 1031728 : 2076,
  nationalVolume: nacional,
  monthlySearches: null,
  competition: null,
  competitionIndex: null,
  cpc: null,
  difficulty: null,
  intent: null,
  secondaryIntents: null,
  serpUrls: null,
  serpStatus: "pending",
  serpLocationCode: null,
})

test("volume local de 30 vem antes de nacional de 60.500", () => {
  const r = filterCandidates({
    candidates: [
      faixa("tinta nacional", null, 60500),
      faixa("tinta local", 30, null),
    ],
    seeds: ["tinta"],
  })
  // Ordenar os dois juntos colocaria o 60.500 no topo por ser maior, não por
  // ser melhor: ele responde outra pergunta.
  assert.equal(r.selected[0].keyword, "tinta local")
  assert.equal(r.selected[1].keyword, "tinta nacional")
})

test("dentro da faixa, ordena por volume", () => {
  const r = filterCandidates({
    candidates: [
      faixa("tinta a", 10, null),
      faixa("tinta b", 500, null),
      faixa("tinta c", 90, null),
    ],
    seeds: ["tinta"],
  })
  assert.deepEqual(
    r.selected.map((c) => c.keyword),
    ["tinta b", "tinta c", "tinta a"],
  )
})

/* -------------------------------------------------------------------------- */
/*  Teto                                                                      */
/* -------------------------------------------------------------------------- */

test("o teto corta o excedente e registra o motivo", () => {
  const muitas = Array.from({ length: 10 }, (_, i) =>
    faixa(`tinta ${i}`, 100 - i, null),
  )
  const r = filterCandidates({ candidates: muitas, seeds: ["tinta"], limit: 4 })
  assert.equal(r.selected.length, 4)
  assert.equal(r.stats.byReason.acima_do_teto, 6)
  // Cortou as de menor volume.
  assert.equal(r.selected.at(-1).keyword, "tinta 3")
})

test("o teto desconta as seeds forçadas", () => {
  const candidatas = [
    faixa("tinta emborrachada", 170, null),
    ...Array.from({ length: 5 }, (_, i) => faixa(`tinta extra ${i}`, 50, null)),
  ]
  candidatas[0].sources = ["briefing", "keywords_for_keywords"]
  const r = filterCandidates({
    candidates: candidatas,
    seeds: ["tinta emborrachada"],
    limit: 3,
  })
  // 1 seed forçada + 2 de espaço restante.
  assert.equal(r.stats.seedsForced, 1)
  assert.equal(r.selected.length, 3)
})

test("pool menor que o teto não inventa candidata", () => {
  const r = rodar({ limit: DEFAULT_SERP_LIMIT })
  assert.ok(r.selected.length <= pool.candidates.length)
  assert.equal(r.stats.byReason.acima_do_teto, 0)
})

test("serpCallCount é o número que a tela mostra antes de gastar", () => {
  const r = rodar()
  assert.equal(serpCallCount(r), r.selected.length)
})

/* -------------------------------------------------------------------------- */
/*  Contabilidade                                                             */
/* -------------------------------------------------------------------------- */

test("nada some — selecionado mais rejeitado fecha o total", () => {
  const r = rodar()
  assert.equal(r.selected.length + r.rejected.length, r.stats.total)
})

test("pool vazio é resultado vazio, não erro", () => {
  const r = filterCandidates({ candidates: [], seeds: [] })
  assert.deepEqual(r.selected, [])
  assert.deepEqual(r.rejected, [])
  assert.equal(r.stats.total, 0)
})
