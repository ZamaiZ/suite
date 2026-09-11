import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { geoAccessibilityFromCrawl, isExtendedCrawl } from "./geo-accessibility.ts"
import { geoGapsForSnapshot } from "./geo-audit.ts"
import { geoContentFromCrawl } from "./geo-content.ts"
import { emptyGeoReview } from "./geo-review.ts"
import { mergeGeoOpportunities } from "./geo-opportunities.ts"
import { readWebsiteCrawl } from "./website-audit.ts"

/**
 * Dois crawls reais, lidos de `lead_website_audits` em 2026-09-10.
 *
 * `modern` é `qualitysmi.com.br`, da coleta ampliada: doze agentes de IA com
 * **dois bloqueados**, `llms.txt` presente, headings preenchidos.
 *
 * `legacy` é `ruk.com.br`, de 2026-09-01, **anterior** à coleta ampliada:
 * `llmsTxt` ausente, `robots.groups` vazio, `aiAgents` vazio, `headings`
 * vazio. Ele existe aqui porque `readWebsiteCrawl` normaliza esses ausentes
 * para vazio, e vazio é indistinguível de "checamos e não tem" — é o caso que
 * gera gap falso se ninguém o separar.
 *
 * O arquivo existe porque o mapeador de visibilidade viveu meses sem nunca ter
 * rodado contra payload de verdade, e quando rodou, três campos estavam
 * errados.
 */
const FIXTURE = JSON.parse(
  readFileSync(new URL("./geo-audit.fixture.json", import.meta.url), "utf8"),
)

const MODERN = readWebsiteCrawl(FIXTURE.modern)
const LEGACY = readWebsiteCrawl(FIXTURE.legacy)

test("os dois crawls do fixture são legíveis", () => {
  assert.ok(MODERN, "readWebsiteCrawl devolveu null para o crawl moderno")
  assert.ok(LEGACY, "readWebsiteCrawl devolveu null para o crawl antigo")
})

test("crawl antigo é reconhecido como anterior à coleta ampliada", () => {
  assert.equal(isExtendedCrawl(MODERN), true)
  assert.equal(isExtendedCrawl(LEGACY), false)
})

test("agente de IA bloqueado é contado, liberado não", () => {
  const access = geoAccessibilityFromCrawl(MODERN)
  assert.equal(access.aiCrawlers.length, 12)
  assert.equal(access.blockedAiCrawlers, 2)
  assert.deepEqual(
    access.aiCrawlers.filter((entry) => entry.blocked).map((e) => e.agent),
    ["meta-externalagent", "amazonbot"],
  )
})

test("llms.txt encontrado traz o status junto", () => {
  const access = geoAccessibilityFromCrawl(MODERN)
  assert.equal(access.llmsTxt.found, true)
  assert.equal(access.llmsTxt.status, 200)
})

/**
 * Este é o teste que protege contra o gap falso. No crawl antigo o llms.txt
 * **nunca foi checado**, e a normalização o faz parecer ausente. A leitura
 * pode devolver `found: false` — o que ela não pode é deixar alguém concluir
 * ausência sem olhar `isExtendedCrawl`.
 */
test("crawl antigo devolve llms.txt vazio, e só isExtendedCrawl desfaz o engano", () => {
  const access = geoAccessibilityFromCrawl(LEGACY)
  assert.equal(access.llmsTxt.found, false)
  assert.equal(access.llmsTxt.status, null)
  assert.equal(access.aiCrawlers.length, 0)
  assert.equal(
    isExtendedCrawl(LEGACY),
    false,
    "sem esta bandeira os dois campos acima viram afirmação",
  )
})

test("home com 1672 palavras não é casca de SPA", () => {
  const access = geoAccessibilityFromCrawl(MODERN)
  assert.equal(access.serverRenderedWords, 1672)
  assert.equal(access.contentRequiresJs, false)
})

test("wordCount vale no crawl antigo também — sempre existiu", () => {
  const access = geoAccessibilityFromCrawl(LEGACY)
  assert.equal(access.serverRenderedWords, 324)
  assert.equal(access.contentRequiresJs, false)
})

test("schema de identidade é reconhecido, e FAQ vem do agregado das páginas", () => {
  const content = geoContentFromCrawl(MODERN)
  assert.deepEqual(content.identitySchema, ["person", "professionalservice"])
  // `faqpage` está na segunda página, não na home: o agregado é o certo.
  assert.equal(content.hasFaqSchema, true)
})

test("crawl antigo ainda resolve identidade — schemaTypes sempre existiu", () => {
  const content = geoContentFromCrawl(LEGACY)
  assert.deepEqual(content.identitySchema, ["organization"])
})

test("heading interrogativo é contado, e a profundidade é medida", () => {
  const content = geoContentFromCrawl(MODERN)
  assert.equal(content.questionHeadings, 3)
  assert.equal(content.headingDepth.levels, 3)
  assert.equal(content.headingDepth.skips, false)
})

test("crawl antigo tem zero headings porque não foram coletados", () => {
  const content = geoContentFromCrawl(LEGACY)
  assert.equal(content.questionHeadings, 0)
  assert.equal(content.headingDepth.levels, 0)
})

test("comprimento de title e meta sai do texto real, sem faixa embutida", () => {
  const content = geoContentFromCrawl(MODERN)
  assert.equal(content.titleLength, 53)
  assert.equal(content.metaDescriptionLength, 148)
})

test("crawl sem schemaDates reporta frescor NÃO COLETADO, não ausente", () => {
  for (const crawl of [MODERN, LEGACY]) {
    const content = geoContentFromCrawl(crawl)
    assert.equal(content.freshness.collected, false)
    assert.equal(content.freshness.datePublished, null)
    assert.equal(content.freshness.dateModified, null)
  }
})

/**
 * O outro lado da mesma moeda: com o campo presente, a data vira dado. Sem este
 * teste, um leitor que devolvesse `collected: false` sempre passaria no teste
 * de cima e a extensão do parser não serviria para nada.
 */
test("crawl com schemaDates reporta frescor coletado, com as duas datas", () => {
  const withDates = readWebsiteCrawl({
    ...FIXTURE.modern,
    pages: FIXTURE.modern.pages.map((page, index) =>
      index === 0
        ? {
            ...page,
            schemaDates: {
              published: "2026-03-01T10:00:00Z",
              modified: "2026-08-22T09:30:00Z",
            },
          }
        : page,
    ),
    sitemap: { ...FIXTURE.modern.sitemap, lastmod: "2026-07-19" },
  })
  const content = geoContentFromCrawl(withDates)
  assert.equal(content.freshness.collected, true)
  assert.equal(content.freshness.datePublished, "2026-03-01T10:00:00Z")
  assert.equal(content.freshness.dateModified, "2026-08-22T09:30:00Z")
  assert.equal(content.freshness.sitemapLastmod, "2026-07-19")
})

/**
 * Monta o snapshot da etapa a partir de um crawl, como `analyzeLeadGeo` faz.
 * `websiteCrawlExtended` é o campo que separa "medimos e não tem" de "nunca
 * checamos", e é ele que os dois testes abaixo exercitam.
 */
function snapshotFrom(crawl, overrides = {}) {
  return {
    version: 1,
    domain: "exemplo.com.br",
    collectedAt: "2026-09-10T12:00:00.000Z",
    costUsd: null,
    sources: {
      websiteAuditAt: "2026-09-07T00:00:00.000Z",
      visibilityAuditAt: null,
      backlinkAuditAt: null,
      websiteCrawlExtended: isExtendedCrawl(crawl),
    },
    accessibility: geoAccessibilityFromCrawl(crawl),
    content: geoContentFromCrawl(crawl),
    citations: null,
    aiOverview: null,
    aiDemand: null,
    promptVisibility: null,
    ...overrides,
  }
}

test("crawl moderno com dois agentes bloqueados gera o gap de crawler", () => {
  const gaps = geoGapsForSnapshot({ snapshot: snapshotFrom(MODERN) })
  assert.ok(gaps.includes("ai_crawlers_blocked"))
  // llms.txt existe neste site: o gap não pode aparecer.
  assert.equal(gaps.includes("no_llms_txt"), false)
  // Três headings interrogativos e `faqpage` no agregado: também não.
  assert.equal(gaps.includes("no_faq_content"), false)
})

/**
 * O teste que protege o passado. No crawl antigo o llms.txt nunca foi buscado e
 * os headings nunca foram gravados; a normalização os faz parecer ausentes.
 * Sem a bandeira, todo lead auditado antes da coleta ampliada ganharia dois
 * gaps que ninguém mediu.
 */
test("crawl antigo NÃO gera gap de llms.txt nem de FAQ", () => {
  const gaps = geoGapsForSnapshot({ snapshot: snapshotFrom(LEGACY) })
  assert.equal(gaps.includes("no_llms_txt"), false, "llms.txt nunca foi checado")
  assert.equal(gaps.includes("no_faq_content"), false, "headings não coletados")
  // E o que é medível no crawl antigo continua valendo:
  assert.equal(gaps.includes("no_identity_schema"), false, "tem Organization")
})

test("frescor e citações nulos não afirmam ausência", () => {
  for (const crawl of [MODERN, LEGACY]) {
    const gaps = geoGapsForSnapshot({ snapshot: snapshotFrom(crawl) })
    assert.equal(gaps.includes("no_freshness_signals"), false)
    assert.equal(gaps.includes("no_authority_citations"), false)
  }
})

test("citações coletadas e vazias JÁ afirmam ausência", () => {
  const gaps = geoGapsForSnapshot({
    snapshot: snapshotFrom(MODERN, {
      citations: { catalogVersion: 1, sources: [], truncated: false },
    }),
  })
  assert.ok(gaps.includes("no_authority_citations"))
})

test("AI Overview só acusa quem ranqueia no orgânico", () => {
  const semFootprint = geoGapsForSnapshot({
    snapshot: snapshotFrom(MODERN, {
      aiOverview: { keywords: [], count: 0, etv: null, hasOrganicFootprint: false },
    }),
  })
  assert.equal(semFootprint.includes("no_ai_overview_presence"), false)

  const comFootprint = geoGapsForSnapshot({
    snapshot: snapshotFrom(MODERN, {
      aiOverview: { keywords: [], count: 0, etv: null, hasOrganicFootprint: true },
    }),
  })
  assert.ok(comFootprint.includes("no_ai_overview_presence"))
})

test("os três gaps de sondagem não existem sem sondagem", () => {
  const gaps = geoGapsForSnapshot({ snapshot: snapshotFrom(MODERN) })
  for (const id of [
    "brand_unknown_to_llms",
    "absent_from_discovery_prompts",
    "outranked_by_competitors",
  ]) {
    assert.equal(gaps.includes(id), false, `${id} não deveria existir`)
  }
})

test("veredito em branco do analista não gera oportunidade", () => {
  const items = mergeGeoOpportunities({
    snapshot: snapshotFrom(MODERN),
    review: emptyGeoReview(),
  })
  assert.equal(items.some((item) => item.source === "analyst"), false)
})

test("veredito issue vira oportunidade, ok e na não", () => {
  const review = emptyGeoReview()
  review.entity_definition = {
    verdict: "issue",
    note: "A home não diz o que a empresa faz.",
    updatedAt: null,
    updatedBy: null,
  }
  review.citation_readiness = { verdict: "ok", note: "", updatedAt: null, updatedBy: null }
  review.authority_trust = { verdict: "na", note: "", updatedAt: null, updatedBy: null }

  const items = mergeGeoOpportunities({ snapshot: snapshotFrom(MODERN), review })
  const doAnalista = items.filter((item) => item.source === "analyst")
  assert.equal(doAnalista.length, 1)
  assert.equal(doAnalista[0].id, "analyst:entity_definition")
  assert.equal(doAnalista[0].impact, "high")
  assert.equal(doAnalista[0].detail, "A home não diz o que a empresa faz.")
})

test("oportunidades saem ordenadas com as de alto impacto primeiro", () => {
  const items = mergeGeoOpportunities({
    snapshot: snapshotFrom(MODERN),
    review: emptyGeoReview(),
  })
  const primeiroMedio = items.findIndex((item) => item.impact === "medium")
  const ultimoAlto = items.map((item) => item.impact).lastIndexOf("high")
  if (primeiroMedio !== -1 && ultimoAlto !== -1) {
    assert.ok(ultimoAlto < primeiroMedio, "high tem que vir antes de medium")
  }
})
