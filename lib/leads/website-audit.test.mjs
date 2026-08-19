import assert from "node:assert/strict"
import test from "node:test"

import {
  readLeadWebsiteAuditRow,
  readWebsiteCrawl,
  websiteGapsForAudit,
} from "./website-audit.ts"

function page(overrides = {}) {
  return {
    url: "https://exemplo.com.br/",
    status: 200,
    title: "Funerária São José em Campinas",
    metaDescription: "Atendimento 24 horas em Campinas e região.",
    h1: ["Funerária São José"],
    h2: ["Serviços"],
    wordCount: 420,
    imageCount: 4,
    imagesWithoutAlt: 0,
    internalLinkCount: 8,
    internalPaths: ["/sobre", "/servicos", "/contato", "/blog"],
    schemaTypes: ["LocalBusiness"],
    hasTel: true,
    hasWhatsapp: true,
    hasMailto: false,
    contactInFooterOnly: false,
    phones: ["1932510000"],
    textExcerpt:
      "Funerária São José Rua das Flores 100 Campinas telefone 1932510000",
    ...overrides,
  }
}

function crawl(overrides = {}) {
  return {
    finalUrl: "https://exemplo.com.br/",
    https: true,
    pages: [page()],
    robots: { found: true, sitemapUrls: ["https://exemplo.com.br/sitemap.xml"] },
    sitemap: {
      found: true,
      urlCount: 12,
      sampleChecked: 8,
      sampleNotFound: 0,
      sampleStatuses: [],
    },
    ...overrides,
  }
}

test("readWebsiteCrawl rejects a payload that is not an object", () => {
  assert.equal(readWebsiteCrawl(null), null)
  assert.equal(readWebsiteCrawl([]), null)
})

test("readWebsiteCrawl accepts a compact crawl snapshot", () => {
  const parsed = readWebsiteCrawl(crawl())
  assert.ok(parsed)
  assert.equal(parsed.https, true)
  assert.equal(parsed.pages[0]?.title, "Funerária São José em Campinas")
  assert.equal(parsed.pages[0]?.phones[0], "1932510000")
})

test("readWebsiteCrawl rejects a page with a non-array h1", () => {
  assert.equal(
    readWebsiteCrawl(crawl({ pages: [page({ h1: "oops" })] })),
    null,
  )
})

test("readLeadWebsiteAuditRow maps a database row", () => {
  const row = {
    id: "11111111-1111-1111-1111-111111111111",
    lead_id: "22222222-2222-2222-2222-222222222222",
    channel_id: "33333333-3333-3333-3333-333333333333",
    url: "https://exemplo.com.br",
    fetched_at: "2026-08-19T15:00:00.000Z",
    fetched_by: "44444444-4444-4444-4444-444444444444",
    crawl: crawl(),
    notes: "Vitrine estática",
  }
  const audit = readLeadWebsiteAuditRow(row)
  assert.ok(audit)
  assert.equal(audit.channel_id, row.channel_id)
  assert.equal(audit.notes, "Vitrine estática")
})

test("websiteGapsForAudit is empty for a healthy local site", () => {
  const gaps = websiteGapsForAudit(crawl(), "Funerária São José", {
    phone: "(19) 3251-0000",
    address: "Rua das Flores, 100, Campinas",
  })
  assert.deepEqual(gaps, [])
})

test("websiteGapsForAudit flags http, missing sitemap and thin on-page", () => {
  const gaps = websiteGapsForAudit(
    crawl({
      finalUrl: "http://exemplo.com.br/",
      https: false,
      pages: [
        page({
          title: "Página Inicial",
          metaDescription: null,
          h1: [],
          wordCount: 40,
          imageCount: 3,
          imagesWithoutAlt: 3,
          internalLinkCount: 0,
          internalPaths: [],
          schemaTypes: [],
          hasTel: false,
          hasWhatsapp: false,
          hasMailto: false,
        }),
      ],
      sitemap: {
        found: false,
        urlCount: 0,
        sampleChecked: 0,
        sampleNotFound: 0,
        sampleStatuses: [],
      },
    }),
    "Funerária São José",
  )

  for (const id of [
    "no_https",
    "missing_sitemap",
    "few_pages",
    "no_service_pages",
    "no_blog",
    "generic_title",
    "missing_meta_description",
    "missing_h1",
    "thin_content",
    "images_missing_alt",
    "no_internal_links",
    "no_schema",
    "weak_cta",
  ]) {
    assert.ok(gaps.includes(id), `expected ${id}`)
  }
  assert.equal(gaps.includes("no_local_schema"), false)
})

test("websiteGapsForAudit flags sitemap bloat when the sample is mostly 404", () => {
  const gaps = websiteGapsForAudit(
    crawl({
      sitemap: {
        found: true,
        urlCount: 22000,
        sampleChecked: 20,
        sampleNotFound: 18,
        sampleStatuses: [],
      },
    }),
    "Funerária São José",
  )
  assert.ok(gaps.includes("sitemap_bloat"))
})

test("websiteGapsForAudit does not flag sitemap bloat on a large healthy sitemap", () => {
  const gaps = websiteGapsForAudit(
    crawl({
      sitemap: {
        found: true,
        urlCount: 22000,
        sampleChecked: 20,
        sampleNotFound: 1,
        sampleStatuses: [],
      },
    }),
    "Funerária São José",
  )
  assert.equal(gaps.includes("sitemap_bloat"), false)
})

test("websiteGapsForAudit flags duplicate h1 across pages and unfriendly urls", () => {
  const gaps = websiteGapsForAudit(
    crawl({
      pages: [
        page({
          h1: ["Início", "Início"],
          internalPaths: ["/pagina.php?id=12", "/servicos", "/blog"],
        }),
        page({
          url: "https://exemplo.com.br/pagina.php?id=12",
          h1: ["Início"],
          internalPaths: [],
        }),
      ],
    }),
    "Funerária São José",
  )
  assert.ok(gaps.includes("duplicate_h1"))
  assert.ok(gaps.includes("unfriendly_urls"))
})

test("websiteGapsForAudit flags schema without local types", () => {
  const gaps = websiteGapsForAudit(
    crawl({
      pages: [page({ schemaTypes: ["WebSite", "WebPage"] })],
    }),
    "Funerária São José",
  )
  assert.ok(gaps.includes("no_local_schema"))
  assert.equal(gaps.includes("no_schema"), false)
})

test("websiteGapsForAudit flags contact hidden in the footer", () => {
  const gaps = websiteGapsForAudit(
    crawl({
      pages: [page({ contactInFooterOnly: true })],
    }),
    "Funerária São José",
  )
  assert.ok(gaps.includes("contact_only_in_footer"))
})

test("websiteGapsForAudit skips NAP when no Google profile is linked", () => {
  const gaps = websiteGapsForAudit(
    crawl({
      pages: [
        page({
          phones: [],
          textExcerpt: "Bem-vindo ao site",
        }),
      ],
    }),
    "Funerária São José",
    null,
  )
  assert.equal(gaps.includes("nap_mismatch"), false)
})

test("websiteGapsForAudit flags NAP mismatch against the Google profile", () => {
  const gaps = websiteGapsForAudit(
    crawl({
      pages: [
        page({
          phones: ["1133334444"],
          textExcerpt: "Av Paulista 1000 Sao Paulo",
        }),
      ],
    }),
    "Funerária São José",
    {
      phone: "(19) 3251-0000",
      address: "Rua das Flores, 100, Campinas",
    },
  )
  assert.ok(gaps.includes("nap_mismatch"))
})
