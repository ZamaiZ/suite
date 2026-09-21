/**
 * Trava o leitor da SERP contra payload real.
 *
 * A fixture é `loja de tintas em itu` consultada com `location_code: 1031728`
 * (Itu/SP) em 2026-09-18. Três coisas dependem deste leitor — clustering,
 * concorrentes e PAA —, e as três saem da mesma resposta.
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import test from "node:test"
import assert from "node:assert/strict"

import {
  SERP_OVERLAP_DEPTH,
  mapSerpOrganic,
  overlapUrls,
} from "./serp-organic.ts"

const aqui = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(
  readFileSync(join(aqui, "serp-organic.fixture.json"), "utf8"),
)

const snap = mapSerpOrganic(fixture)

test("lê a SERP real com as três seções", () => {
  assert.equal(snap.keyword, "loja de tintas em itu")
  assert.equal(snap.locationCode, 1031728)
  assert.equal(snap.languageCode, "pt")
  assert.equal(snap.organic.length, 19)
  assert.equal(snap.localPack.length, 3)
  assert.equal(snap.peopleAlsoAsk.length, 4)
})

test("item orgânico traz URL completa, não só domínio", () => {
  const primeiro = snap.organic[0]
  assert.ok(primeiro.url.startsWith("https://"))
  assert.equal(primeiro.domain, "leotintas.com.br")
})

test("posição orgânica não é posição na página — e o relatório usa a primeira", () => {
  const primeiro = snap.organic[0]
  // O cliente é o 1º orgânico, mas o 4º item da tela: há três resultados de
  // local pack antes dele. Dizer "4º lugar" seria mentir sobre a disputa
  // orgânica; dizer "1º" sem contexto esconde o que o olho vê primeiro.
  assert.equal(primeiro.rankGroup, 1)
  assert.equal(primeiro.rankAbsolute, 4)
  assert.equal(snap.localPack.length, 3)
})

test("o cliente também ocupa o local pack, em 2º", () => {
  const dele = snap.localPack.find((l) => l.domain === "leotintas.com.br")
  assert.equal(dele.rankGroup, 2)
})

test("a SERP das keywords-alvo traz concorrentes reais do ramo", () => {
  // É a tese da Task 6: aqui aparecem lojas de tinta, e não as redes sociais
  // e bases de CNPJ que o competitors_domain devolveu para o mesmo cliente.
  const dominios = snap.organic.map((o) => o.domain)
  assert.ok(dominios.includes("segtintas.com.br"))
  assert.ok(dominios.includes("www.itutintas.com.br"))
  assert.ok(dominios.includes("www.grupoitutintas.com.br"))
})

test("PAA vem do mesmo payload, sem chamada extra", () => {
  assert.ok(
    snap.peopleAlsoAsk.includes("Onde posso encontrar as tintas mais baratas?"),
  )
})

test("featureTypes registra o que a SERP tem", () => {
  assert.ok(snap.featureTypes.includes("local_pack"))
  assert.ok(snap.featureTypes.includes("organic"))
  assert.ok(snap.featureTypes.includes("people_also_ask"))
})

/* -------------------------------------------------------------------------- */
/*  Sobreposição                                                              */
/* -------------------------------------------------------------------------- */

test("overlapUrls corta na profundidade e ordena por rank", () => {
  const urls = overlapUrls(snap)
  assert.equal(urls.length, SERP_OVERLAP_DEPTH)
  assert.equal(urls[0], snap.organic[0].url)
})

test("profundidade menor que o coletado — comparar fundos diferentes inventaria sobreposição", () => {
  assert.equal(overlapUrls(snap, 3).length, 3)
})

test("SERP com menos resultados que a profundidade devolve o que tem", () => {
  const curta = {
    ...snap,
    organic: snap.organic.slice(0, 2),
  }
  assert.equal(overlapUrls(curta).length, 2)
})

/* -------------------------------------------------------------------------- */
/*  Falha não é vazio                                                         */
/* -------------------------------------------------------------------------- */

test("tarefa com erro devolve null, não snapshot vazio", () => {
  const falhou = {
    tasks: [{ status_code: 40501, status_message: "Invalid Field", result: null }],
  }
  assert.equal(mapSerpOrganic(falhou), null)
})

test("envelope inválido devolve null", () => {
  for (const lixo of [null, 42, {}, { tasks: [] }, { tasks: [{}] }]) {
    assert.equal(mapSerpOrganic(lixo), null)
  }
})

test("SERP sem orgânico é snapshot com lista vazia, não null", () => {
  // Coletada e sem resultado é diferente de não coletada — o clustering
  // precisa distinguir para não inventar cluster de um item só.
  const semOrganico = {
    tasks: [
      {
        status_code: 20000,
        result: [{ keyword: "termo raro", location_code: 1031728, items: [] }],
      },
    ],
  }
  const s = mapSerpOrganic(semOrganico)
  assert.notEqual(s, null)
  assert.deepEqual(s.organic, [])
})

test("item orgânico sem url é descartado — não serve para sobreposição", () => {
  const semUrl = {
    tasks: [
      {
        status_code: 20000,
        result: [
          {
            keyword: "x",
            items: [
              { type: "organic", domain: "a.com" },
              { type: "organic", domain: "b.com", url: "https://b.com/p" },
            ],
          },
        ],
      },
    ],
  }
  assert.equal(mapSerpOrganic(semUrl).organic.length, 1)
})
