import assert from "node:assert/strict"
import { test } from "node:test"

import { visibilityGapsForSnapshot } from "./visibility-audit.ts"

const ARGS = { companyName: "Busca Orgânica", city: "São Paulo" }

function row(overrides) {
  return {
    keyword: "x",
    position: { value: 5, previous: null, updatedAt: null },
    url: {
      full: null,
      host: "www.buscaorganica.com.br",
      mainDomain: null,
      path: "/x",
      isCanonicalHost: true,
    },
    volume: { value: 10, updatedAt: null },
    traffic: 1,
    difficulty: {
      index: null,
      adsCompetition: null,
      adsCompetitionScore: null,
      topTenReferringDomains: null,
    },
    intent: null,
    serpFeatures: [],
    itemType: "organic",
    languageMismatch: false,
    ...overrides,
  }
}

function snapshotWith(overrides) {
  return {
    version: 2,
    source: "dataforseo_labs",
    domain: "buscaorganica.com.br",
    locationLabel: "Brazil",
    languageCode: "pt",
    collectedAt: "2026-09-10T00:00:00.000Z",
    searchCount: 1,
    indexAge: null,
    coverage: { returned: 1, total: 1, truncated: false },
    hosts: [],
    costUsd: null,
    droppedRows: 0,
    metrics: {
      keywordCount: 110,
      estimatedTraffic: 500,
      estimatedTrafficCost: null,
      positionBuckets: null,
    },
    localPack: null,
    aiOverview: null,
    keywords: [row()],
    ...overrides,
  }
}

function gapsFor(overrides) {
  return visibilityGapsForSnapshot({
    snapshot: snapshotWith(overrides),
    ...ARGS,
  })
}

test("acusa tráfego concentrado fora do host principal", () => {
  // O caso medido: 77 das 110 keywords num subdomínio de homologação.
  const gaps = gapsFor({
    hosts: [
      {
        host: "www.buscaorganica.com.br",
        keywords: 33,
        traffic: 348,
        isCanonical: true,
      },
      {
        host: "aprov.buscaorganica.com.br",
        keywords: 77,
        traffic: 119,
        isCanonical: false,
      },
    ],
  })
  assert.ok(gaps.includes("non_canonical_host_traffic"))
})

test("não acusa quando tudo está no host principal", () => {
  const gaps = gapsFor({
    hosts: [
      {
        host: "www.buscaorganica.com.br",
        keywords: 110,
        traffic: 467,
        isCanonical: true,
      },
    ],
  })
  assert.equal(gaps.includes("non_canonical_host_traffic"), false)
})

test("cala sobre homepage_only quando a amostra está truncada", () => {
  // A amostra vem ordenada por tráfego e a home lidera o ETV. Sem esta guarda a
  // regra dispara em domínio grande por construção, não por diagnóstico.
  const gaps = gapsFor({
    coverage: { returned: 1000, total: 4312, truncated: true },
    keywords: [
      row({
        keyword: "marca",
        position: { value: 1, previous: null, updatedAt: null },
        url: {
          full: null,
          host: "www.buscaorganica.com.br",
          mainDomain: null,
          path: "/",
          isCanonicalHost: true,
        },
        traffic: 118,
      }),
    ],
  })
  assert.equal(gaps.includes("homepage_only"), false)
  assert.equal(gaps.includes("brand_only_visibility"), false)
  assert.equal(gaps.includes("no_local_top20"), false)
})

test("acusa homepage_only quando a amostra cobre o footprint", () => {
  const gaps = gapsFor({
    coverage: { returned: 1, total: 1, truncated: false },
    keywords: [
      row({
        url: {
          full: null,
          host: "www.buscaorganica.com.br",
          mainDomain: null,
          path: "/",
          isCanonicalHost: true,
        },
      }),
    ],
  })
  assert.ok(gaps.includes("homepage_only"))
})

test("página em host não-canônico nunca conta como home", () => {
  // Antes, `isHomepageUrl` montava `https://dominio${path}` e lia a raiz de um
  // subdomínio como sendo a home do domínio principal.
  const gaps = gapsFor({
    coverage: { returned: 1, total: 1, truncated: false },
    keywords: [
      row({
        url: {
          full: "https://aprov.buscaorganica.com.br/",
          host: "aprov.buscaorganica.com.br",
          mainDomain: "buscaorganica.com.br",
          path: "/",
          isCanonicalHost: false,
        },
      }),
    ],
  })
  assert.equal(gaps.includes("homepage_only"), false)
})
