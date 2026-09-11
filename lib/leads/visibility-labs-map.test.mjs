import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { mapRankedKeywordsLiveResult } from "./visibility-labs-map.ts"

/**
 * Fixture recortado do payload real de `buscaorganica.com.br` em 2026-09-10.
 *
 * O mapeador viveu seis meses sem nunca ter rodado contra resposta de verdade;
 * quando rodou, três campos estavam errados. Este arquivo existe para que a
 * próxima suposição de forma morra aqui e não numa reunião com o cliente.
 *
 * Os três itens são os casos-limite da medição: host canônico com KD real,
 * host **não-canônico** com KD zero, e o único que divergiu do endpoint
 * dedicado de dificuldade.
 */
const FIXTURE = JSON.parse(
  readFileSync(
    new URL("./visibility-labs-map.fixture.json", import.meta.url),
    "utf8",
  ),
)

function snapshot() {
  return mapRankedKeywordsLiveResult({
    domain: "buscaorganica.com.br",
    result: FIXTURE,
    collectedAt: "2026-09-10T22:24:09.546Z",
    locationLabel: "Brazil",
    languageCode: "pt",
  })
}

function rowFor(keyword) {
  const found = snapshot().keywords.find((row) => row.keyword === keyword)
  assert.ok(found, `keyword ausente no snapshot: ${keyword}`)
  return found
}

test("grava a URL completa, e não o caminho relativo", () => {
  assert.equal(
    rowFor("banheiro quimico preço").url.full,
    "https://aprov.buscaorganica.com.br/polyban.com.br/produtos",
  )
  assert.equal(
    rowFor("banheiro quimico preço").url.path,
    "/polyban.com.br/produtos",
  )
})

test("separa host de domínio registrável e marca host não-canônico", () => {
  const url = rowFor("banheiro quimico preço").url
  assert.equal(url.host, "aprov.buscaorganica.com.br")
  assert.equal(url.mainDomain, "buscaorganica.com.br")
  assert.equal(url.isCanonicalHost, false)
})

test("www conta como host canônico", () => {
  const url = rowFor("busca organica").url
  assert.equal(url.host, "www.buscaorganica.com.br")
  assert.equal(url.isCanonicalHost, true)
})

test("o snapshot novo se declara v2", () => {
  assert.equal(snapshot().version, 2)
})

test("ecoa a procedência recebida em vez de repetir literais", () => {
  const snap = snapshot()
  assert.equal(snap.locationLabel, "Brazil")
  assert.equal(snap.languageCode, "pt")
})

test("KD 0 da API é ausência de dado, não dificuldade zero", () => {
  // Medido em 2026-09-10: 98 das 110 keywords vieram com 0 e nenhuma com null.
  // O endpoint dedicado `bulk_keyword_difficulty` devolveu os mesmos 98 zeros.
  // Naquela base, 0 quer dizer "não sei" — e a tela imprimia "0%".
  assert.equal(rowFor("banheiro quimico preço").difficulty.index, null)
})

test("KD real atravessa intacto", () => {
  assert.equal(rowFor("busca organica").difficulty.index, 40)
  assert.equal(rowFor("consultoria de seo").difficulty.index, 8)
})

test("a disputa do Google Ads preenche o buraco do KD", () => {
  // A mesma keyword com KD 0 tem competition_level HIGH e competition 1,0, com
  // 1.900 buscas/mês. São dois sinais diferentes, e o segundo não tem buraco.
  const difficulty = rowFor("banheiro quimico preço").difficulty
  assert.equal(difficulty.adsCompetition, "HIGH")
  assert.equal(difficulty.adsCompetitionScore, 1)
})

test("traz os domínios de referência do top-10", () => {
  const difficulty = rowFor("busca organica").difficulty
  assert.equal(Math.round(difficulty.topTenReferringDomains), 43)
})

test("declara a cobertura da amostra em vez de fingir que é tudo", () => {
  const snap = snapshot()
  assert.equal(snap.coverage.returned, 3)
  assert.equal(snap.coverage.total, 110)
  assert.equal(snap.coverage.truncated, true)
})

test("quebra o footprint por host", () => {
  // Foi assim que apareceu que 70% do domínio ranqueava num subdomínio de
  // homologação. Sem esta quebra o dado existe na resposta e ninguém vê.
  const hosts = snapshot().hosts
  const aprov = hosts.find((h) => h.host === "aprov.buscaorganica.com.br")
  assert.equal(aprov.keywords, 1)
  assert.equal(aprov.isCanonical, false)
  const www = hosts.find((h) => h.host === "www.buscaorganica.com.br")
  assert.equal(www.keywords, 2)
  assert.equal(www.isCanonical, true)
})

test("metrics é sempre o footprint, nunca a amostra", () => {
  // 3 itens no fixture, 110 no footprint. Antes os dois significados moravam
  // no mesmo campo e nada os distinguia.
  const snap = snapshot()
  assert.equal(snap.metrics.keywordCount, 110)
  assert.equal(snap.keywords.length, 3)
})

test("as seções não-orgânicas de metrics param de ser descartadas", () => {
  const snap = snapshot()
  assert.equal(snap.localPack.count, 0)
  assert.equal(snap.aiOverview.count, 0)
})

test("guarda o que a SERP daquela keyword realmente contém", () => {
  // 49 das 110 SERPs medidas têm ai_overview. É evidência observada, não
  // palpite de modelo — e responde parte da pergunta de intenção de graça.
  const features = rowFor("banheiro quimico preço").serpFeatures
  assert.ok(features.includes("ai_overview"))
  assert.ok(features.includes("popular_products"))
})

test("guarda de qual item_type a linha veio", () => {
  assert.equal(rowFor("busca organica").itemType, "organic")
})

test("conta as linhas que o leitor descartou", () => {
  assert.equal(snapshot().droppedRows, 0)
})

test("guarda a data do índice da SERP, que é o que envelhece", () => {
  // Medido: mediana 59 dias, máximo 108. Esta é a linha mais velha do fixture,
  // e a posição que a tela mostra é dessa data, não da coleta.
  const position = rowFor("banheiro quimico preço").position
  assert.equal(position.updatedAt, "2026-05-25T08:15:36.000Z")
  assert.equal(position.value, 25)
  assert.equal(position.previous, null)
})

test("guarda a data do volume, que envelhece em outro ritmo", () => {
  const volume = rowFor("banheiro quimico preço").volume
  assert.equal(volume.value, 1900)
  assert.equal(volume.updatedAt, "2026-08-26T17:35:56.000Z")
})

test("resume a idade do índice no snapshot", () => {
  const age = snapshot().indexAge
  assert.equal(typeof age.serpMedianDays, "number")
  assert.ok(age.serpMaxDays >= age.serpMedianDays)
  // A SERP mais velha do fixture é de 2026-05-25 08:15, coletada em
  // 2026-09-10 22:24 — 108 dias e 14 horas, que arredondam para 109.
  assert.equal(age.serpMaxDays, 109)
  // Sem a chamada dedicada não há intenção, logo não há idade de intenção —
  // seria desonesto reportar a idade de um dado que a tela não mostra.
  assert.equal(age.intentMedianDays, null)
})

test("usa a intenção dedicada quando ela existe", () => {
  const snap = mapRankedKeywordsLiveResult({
    domain: "buscaorganica.com.br",
    result: FIXTURE,
    collectedAt: "2026-09-10T22:24:09.546Z",
    locationLabel: "Brazil",
    languageCode: "pt",
    intents: new Map([
      [
        "banheiro quimico preço",
        {
          label: "commercial",
          probability: 0.7866,
          secondary: [{ label: "transactional", probability: 0.2 }],
          updatedAt: "2026-04-25T20:00:26.000Z",
        },
      ],
    ]),
  })
  const row = snap.keywords.find((r) => r.keyword === "banheiro quimico preço")
  assert.equal(row.intent.label, "commercial")
  assert.equal(row.intent.probability, 0.7866)
  assert.equal(row.intent.secondary.length, 1)
})

test("sem a chamada dedicada, a intenção fica nula em vez de chutar", () => {
  // O `main_intent` do `ranked_keywords` diz "transactional" para esta keyword
  // e o índice dedicado diz "commercial" (p=0,79). Preencher com o mais fraco
  // esconderia que a fonte falhou.
  assert.equal(rowFor("banheiro quimico preço").intent, null)
})

test("marca a keyword que o detector de idioma classificou errado", () => {
  // "busca organica" é português e veio como `en`. Foi assim em 36 das 110, e
  // 28 delas têm KD 0 — é a pista mais forte de por que o índice tem buraco.
  assert.equal(rowFor("busca organica").languageMismatch, true)
  assert.equal(rowFor("banheiro quimico preço").languageMismatch, false)
})
