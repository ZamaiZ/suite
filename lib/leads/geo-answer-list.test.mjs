/**
 * Trava o leitor da lista ordenada contra **payload real das quatro
 * plataformas**.
 *
 * A fixture é recorte dos dumps de
 * `docs/auditoria/evidencias/2026-09-11-lista-ordenada/`, medidos em
 * 2026-09-11 com um prompt da família `discovery`. Os números aqui não foram
 * escolhidos: são o que cada modelo respondeu.
 *
 * Três armadilhas medidas, e cada uma tem caso próprio abaixo, porque as três
 * falham **caladas** — devolvem lista com cara de resultado:
 *
 *   1. o raciocínio do ChatGPT, cujos dois títulos são os únicos negritos da
 *      resposta inteira;
 *   2. o rabo de "como escolher", que três das quatro emendam na mesma
 *      marcação das empresas;
 *   3. o Perplexity, que não tem bullet nem numeração — a lista dele é tabela.
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import test from "node:test"
import assert from "node:assert/strict"

import {
  fold,
  rankOfBrand,
  readAnswerList,
  readMessageText,
} from "./geo-answer-list.ts"

const aqui = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(
  readFileSync(join(aqui, "geo-answer-list.fixture.json"), "utf8"),
)

const nomes = (plataforma) =>
  readAnswerList(fixture[plataforma], plataforma).map((item) => item.name)

/* -------------------------------------------------------------------------- */
/*  As quatro formas                                                          */
/* -------------------------------------------------------------------------- */

test("chat_gpt: bullet com travessão e link de referência", () => {
  const list = readAnswerList(fixture.chat_gpt, "chat_gpt")
  assert.equal(list.length, 8)
  assert.equal(list[0].name, "Agencia Green Digital")
  assert.equal(list[0].rank, 1)
  assert.equal(list[7].name, "Zuiqe Digital")
  assert.equal(list[7].rank, 8)
})

test("claude: numerada com negrito, sob heading", () => {
  const list = readAnswerList(fixture.claude, "claude")
  assert.equal(list.length, 6)
  assert.equal(list[0].name, "SinalizeWeb")
  assert.equal(list[5].name, "Agência SCG")
})

test("gemini: bullet com nome em negrito e dois-pontos", () => {
  const list = readAnswerList(fixture.gemini, "gemini")
  assert.equal(list.length, 11)
  assert.equal(list[0].name, "Publinet Marketing Digital")
  assert.equal(list[10].name, "MZclick")
})

test("perplexity: tabela markdown, não lista", () => {
  const list = readAnswerList(fixture.perplexity, "perplexity")
  // Zero bullet e zero linha numerada na resposta medida. Um leitor de lista
  // devolveria `[]` aqui, e a coluna inteira apareceria vazia na tela.
  assert.equal(list.length, 6)
  assert.equal(list[0].name, "Webclick")
  assert.equal(list[5].name, "Agência 4UP")
})

/* -------------------------------------------------------------------------- */
/*  As três contaminações                                                     */
/* -------------------------------------------------------------------------- */

test("o raciocínio do ChatGPT não vira empresa", () => {
  const lista = nomes("chat_gpt")
  // Os únicos dois trechos em negrito da resposta inteira do ChatGPT.
  assert.ok(!lista.includes("Searching for SEO companies"))
  assert.ok(!lista.includes("Compiling agency recommendations"))
  assert.ok(!lista.some((name) => /Searching|Compiling/.test(name)))
})

test("readMessageText descarta os items de raciocínio", () => {
  const comRaciocinio = fixture.chat_gpt.items
    .flatMap((item) => item.sections.map((section) => section.text ?? ""))
    .join("\n")
  const soResposta = readMessageText(fixture.chat_gpt)
  assert.ok(comRaciocinio.includes("Searching for SEO companies"))
  assert.ok(!soResposta.includes("Searching for SEO companies"))
  // 895 caracteres de raciocínio, medidos. O número exato não importa; o que
  // não pode é a diferença ser zero.
  assert.ok(comRaciocinio.length > soResposta.length)
})

test("o rabo de 'como escolher' não entra na lista", () => {
  const gpt = nomes("chat_gpt")
  assert.ok(!gpt.some((name) => /Transparência e relatórios/.test(name)))
  assert.ok(!gpt.some((name) => /Resultados comprovados/.test(name)))
  assert.ok(!gpt.some((name) => /Orçamento vs ROI/.test(name)))

  const gemini = nomes("gemini")
  assert.ok(!gemini.some((name) => /Experiência e Adaptabilidade/.test(name)))
  assert.ok(!gemini.some((name) => /Foco em Resultados/.test(name)))

  const claude = nomes("claude")
  assert.ok(!claude.some((name) => /Solicitar orçamentos/.test(name)))
})

test("marcador de citação e link de referência saem do nome", () => {
  for (const plataforma of ["chat_gpt", "claude", "gemini", "perplexity"]) {
    for (const name of nomes(plataforma)) {
      assert.ok(!/\[\d+\]/.test(name), `${plataforma}: "${name}" com marcador`)
      assert.ok(!/https?:/.test(name), `${plataforma}: "${name}" com URL`)
      assert.ok(!/\*\*/.test(name), `${plataforma}: "${name}" com asterisco`)
      assert.ok(!/[:–—]$/u.test(name), `${plataforma}: "${name}" com pontuação`)
    }
  }
})

/* -------------------------------------------------------------------------- */
/*  Ausência não lança, e não inventa                                         */
/* -------------------------------------------------------------------------- */

test("entrada inútil devolve lista vazia, nunca lança", () => {
  assert.deepEqual(readAnswerList(null, "claude"), [])
  assert.deepEqual(readAnswerList({}, "claude"), [])
  assert.deepEqual(readAnswerList({ items: [] }, "claude"), [])
  assert.deepEqual(readAnswerList({ items: "nao e array" }, "claude"), [])
  assert.deepEqual(readMessageText(null), "")
})

test("plataforma desconhecida devolve vazio, não palpite", () => {
  // Leitor genérico de reserva erraria calado, que é o modo de falha que esta
  // etapa recusa.
  assert.deepEqual(readAnswerList(fixture.gemini, "grok"), [])
})

/* -------------------------------------------------------------------------- */
/*  rankOfBrand                                                               */
/* -------------------------------------------------------------------------- */

test("rankOfBrand acha a marca na ordem em que ela aparece", () => {
  const list = readAnswerList(fixture.gemini, "gemini")
  assert.equal(rankOfBrand(list, ["SinalizeWeb"]), 9)
  assert.equal(rankOfBrand(list, ["Leggoo"]), 2)
})

test("rankOfBrand ignora acento e caixa", () => {
  const list = readAnswerList(fixture.claude, "claude")
  assert.equal(rankOfBrand(list, ["agencia scg"]), 6)
  assert.equal(rankOfBrand(list, ["AGÊNCIA SCG"]), 6)
})

test("rankOfBrand devolve null quando a marca não está na lista", () => {
  const list = readAnswerList(fixture.claude, "claude")
  assert.equal(rankOfBrand(list, ["Busca Orgânica"]), null)
  assert.equal(rankOfBrand(list, []), null)
  assert.equal(rankOfBrand([], ["SinalizeWeb"]), null)
})

test("fold dobra acento e caixa", () => {
  assert.equal(fold("Agência Mestre"), "agencia mestre")
  assert.equal(fold("  AGENCIA   MESTRE  "), "agencia mestre")
})
