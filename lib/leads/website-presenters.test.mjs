import assert from "node:assert/strict"
import test from "node:test"

import { websiteCheckSections } from "./website-presenters.ts"
import { websiteOpportunitiesFromGaps } from "./website-opportunities.ts"

test("websiteCheckSections keeps PageSpeed items pending", () => {
  const sections = websiteCheckSections(
    {
      finalUrl: "https://exemplo.com.br/",
      https: true,
      pages: [
        {
          url: "https://exemplo.com.br/",
          status: 200,
          title: "Clínica",
          metaDescription: "Atendimento em Campinas",
          h1: ["Clínica"],
          h2: [],
          wordCount: 400,
          imageCount: 1,
          imagesWithoutAlt: 0,
          internalLinkCount: 4,
          internalPaths: ["/servicos", "/blog"],
          schemaTypes: ["LocalBusiness"],
          hasTel: true,
          hasWhatsapp: true,
          hasMailto: false,
          contactInFooterOnly: false,
          phones: ["1932510000"],
          textExcerpt: "Clínica Campinas",
        },
      ],
      robots: { found: true, sitemapUrls: [] },
      sitemap: {
        found: true,
        urlCount: 6,
        sampleChecked: 6,
        sampleNotFound: 0,
        sampleStatuses: [],
      },
    },
    [],
  )

  const technical = sections.find((section) => section.id === "technical")
  const speed = technical?.items.find((item) => item.id === "speed")
  const security = technical?.items.find((item) => item.id === "security")
  assert.equal(speed?.status, "pending")
  assert.equal(security?.status, "ok")
})

test("websiteOpportunitiesFromGaps sorts high impact first", () => {
  const items = websiteOpportunitiesFromGaps(["few_pages", "no_https"])
  assert.equal(items[0]?.id, "no_https")
  assert.equal(items[0]?.impact, "high")
  assert.equal(items[1]?.id, "few_pages")
})
