import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { mapRankedKeywordsLiveResult } from "./visibility-labs-map.ts"
import {
  visibilityCanonicalTrafficShare,
  visibilityIntentBreakdown,
  visibilityPages,
} from "./visibility-pages.ts"

/** O mesmo payload real de 2026-09-10 que trava o mapeador. */
const FIXTURE = JSON.parse(
  readFileSync(
    new URL("./visibility-labs-map.fixture.json", import.meta.url),
    "utf8",
  ),
)

const SNAPSHOT = mapRankedKeywordsLiveResult({
  domain: "buscaorganica.com.br",
  result: FIXTURE,
  collectedAt: "2026-09-10T22:24:09.546Z",
  locationLabel: "Brazil",
  languageCode: "pt",
  intents: new Map([
    [
      "consultoria de seo",
      {
        label: "commercial",
        probability: 0.91,
        secondary: [],
        updatedAt: null,
      },
    ],
    [
      "banheiro quimico preço",
      // Abaixo do limiar de 0,6: entra como sem classificação confiável.
      {
        label: "commercial",
        probability: 0.42,
        secondary: [],
        updatedAt: null,
      },
    ],
  ]),
})

test("agrupa por URL completa e soma o tráfego", () => {
  const pages = visibilityPages(SNAPSHOT)
  const home = pages.find(
    (page) => page.url.full === "https://www.buscaorganica.com.br/",
  )
  assert.ok(home, "a home deveria estar entre as páginas")
  assert.equal(home.keywords, 1)
  assert.ok(home.traffic > 0)
})

test("ordena por tráfego, não por contagem de keywords", () => {
  const pages = visibilityPages(SNAPSHOT)
  for (let i = 1; i < pages.length; i++) {
    assert.ok(
      pages[i - 1].traffic >= pages[i].traffic,
      "páginas fora de ordem por tráfego",
    )
  }
})

test("guarda a melhor posição de cada página", () => {
  const pages = visibilityPages(SNAPSHOT)
  for (const page of pages) {
    assert.ok(page.bestPosition === null || page.bestPosition >= 1)
  }
})

test("a intenção sem classificação confiável é uma linha, não um buraco", () => {
  const rows = visibilityIntentBreakdown(SNAPSHOT)
  const unclassified = rows.find((row) => row.id === "unclassified")
  assert.ok(unclassified, "faltou a linha de sem classificação")
  // Nenhuma keyword some da conta.
  assert.equal(
    rows.reduce((sum, row) => sum + row.keywords, 0),
    SNAPSHOT.keywords.length,
  )
})

test("a ressalva fica por último mesmo quando é a maior fatia", () => {
  const rows = visibilityIntentBreakdown(SNAPSHOT)
  assert.equal(rows[rows.length - 1].id, "unclassified")
})

test("classificação acima do limiar conta com o próprio rótulo", () => {
  const rows = visibilityIntentBreakdown(SNAPSHOT)
  const commercial = rows.find((row) => row.id === "commercial")
  assert.ok(commercial)
  // Só `consultoria de seo` passou do limiar; `banheiro quimico preço` não.
  assert.equal(commercial.keywords, 1)
  assert.equal(commercial.label, "Comercial")
})

test("sem hosts ou sem tráfego não há fração", () => {
  assert.equal(visibilityCanonicalTrafficShare([]), null)
  assert.equal(
    visibilityCanonicalTrafficShare([
      { host: "www.x.com.br", keywords: 3, traffic: 0, isCanonical: true },
    ]),
    null,
  )
})

test("host único e canônico responde por todo o tráfego", () => {
  assert.equal(
    visibilityCanonicalTrafficShare([
      { host: "www.x.com.br", keywords: 10, traffic: 100, isCanonical: true },
    ]),
    1,
  )
})

test("a fração cai quando o host secundário carrega tráfego", () => {
  const share = visibilityCanonicalTrafficShare([
    { host: "www.x.com.br", keywords: 33, traffic: 348, isCanonical: true },
    { host: "aprov.x.com.br", keywords: 77, traffic: 119, isCanonical: false },
  ])
  assert.ok(share > 0.74 && share < 0.75, `esperava ~0,745, veio ${share}`)
})
