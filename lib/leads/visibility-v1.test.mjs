import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import {
  isHomepageUrl,
  readVisibilitySnapshot,
  visibilityGapsForSnapshot,
} from "./visibility-audit.ts"
import { visibilityIntentLabel } from "./visibility-presenters.ts"
import { visibilityPages } from "./visibility-pages.ts"

/**
 * Snapshot **v1** real, gravado antes da correção de confiabilidade: `url` é o
 * caminho solto, `position`, `volume` e `difficulty` são números, e `intent` é
 * uma string sem probabilidade.
 *
 * Existe porque a tabela é append-only e a leitura é o que mantém o histórico
 * vivo. O leitor tolera o passado; o escritor só produz o presente — e a única
 * forma de garantir isso sem abrir o browser é aqui.
 */
const V1 = JSON.parse(
  readFileSync(
    new URL("./visibility-v1.fixture.json", import.meta.url),
    "utf8",
  ),
)

function snapshot() {
  const parsed = readVisibilitySnapshot(V1)
  assert.ok(parsed, "o snapshot v1 deveria ser legível")
  return parsed
}

test("o snapshot v1 continua legível e não perde nenhuma linha", () => {
  // É o pior defeito possível aqui: leitor que devolve `null` apaga histórico
  // na leitura, sem tocar no banco.
  const snap = snapshot()
  assert.equal(snap.keywords.length, V1.keywords.length)
  assert.equal(snap.domain, "buscaorganica.com.br")
})

test("declara-se v1, e é por isso que a tela pode marcar a fronteira", () => {
  assert.equal(snapshot().version, 1)
})

test("o caminho solto vira URL sem host inventado", () => {
  const row = snapshot().keywords.find(
    (item) => item.keyword === "banheiro quimico preço",
  )
  assert.equal(row.url.path, "/polyban.com.br/produtos")
  // Não dá para recuperar o host de um caminho, e inventá-lo seria repetir o
  // defeito que a correção removeu.
  assert.equal(row.url.full, null)
  assert.equal(row.url.host, null)
  assert.equal(row.url.isCanonicalHost, null)
})

test("números soltos viram os objetos novos, com procedência vazia", () => {
  const row = snapshot().keywords.find(
    (item) => item.keyword === "banheiro quimico preço",
  )
  assert.equal(row.position.value, 25)
  assert.equal(row.position.previous, null)
  assert.equal(row.position.updatedAt, null)
  assert.equal(row.volume.value, 1900)
  assert.equal(row.volume.updatedAt, null)
})

test("a regra do zero NÃO é aplicada retroativamente", () => {
  // No v1 não dá para saber se aquele `0` veio da API ou de linha sem o campo.
  // Converter às cegas trocaria um dado duvidoso por outro.
  const row = snapshot().keywords.find(
    (item) => item.keyword === "banheiro quimico preço",
  )
  assert.equal(row.difficulty.index, 0)
  assert.equal(row.difficulty.adsCompetition, null)
  assert.equal(row.difficulty.topTenReferringDomains, null)
})

test("a intenção antiga escapa do limiar em vez de sumir", () => {
  // Sem probabilidade, o rótulo que a coleta tinha continua sendo mostrado —
  // virar "—" de repente num snapshot antigo seria perder dado na leitura.
  const row = snapshot().keywords.find(
    (item) => item.keyword === "banheiro quimico preço",
  )
  assert.equal(row.intent.label, "transactional")
  assert.equal(row.intent.probability, null)
  assert.equal(visibilityIntentLabel(row.intent), "Transacional")
})

test("as leituras novas ficam vazias, nunca zeradas", () => {
  const snap = snapshot()
  assert.equal(snap.indexAge, null)
  assert.equal(snap.costUsd, null)
  assert.equal(snap.localPack, null)
  assert.equal(snap.aiOverview, null)
  assert.deepEqual(snap.hosts, [])
  assert.equal(snap.droppedRows, 0)
})

test("cobertura do v1 não afirma truncamento que não dá para saber", () => {
  const { coverage } = snapshot()
  assert.equal(coverage.returned, 3)
  assert.equal(coverage.total, null)
  assert.equal(coverage.truncated, false)
})

test("sem host, a home ainda é reconhecida pelo caminho", () => {
  const row = snapshot().keywords.find(
    (item) => item.keyword === "busca organica",
  )
  assert.equal(isHomepageUrl(row.url), true)
})

test("as regras de gap rodam no v1 sem estourar", () => {
  // A guarda de cobertura lê `coverage.truncated`, que o v1 não tinha. O
  // leitor preenche o neutro justamente para as regras não quebrarem aqui.
  const gaps = visibilityGapsForSnapshot({
    snapshot: snapshot(),
    companyName: "Busca Orgânica",
    city: "São Paulo",
  })
  assert.ok(Array.isArray(gaps))
  // Sem hosts gravados não há como acusar host não-canônico — e não acusar é o
  // certo: o v1 não sabia disso.
  assert.equal(gaps.includes("non_canonical_host_traffic"), false)
})

test("as agregações novas sobrevivem ao v1", () => {
  // `visibilityPages` agrupa por `url.full ?? url.path`: no v1 cai no caminho,
  // e a aba de Páginas continua montando em vez de ficar vazia.
  const pages = visibilityPages(snapshot())
  assert.equal(pages.length, 3)
  assert.ok(pages[0].traffic >= pages[1].traffic)
})
