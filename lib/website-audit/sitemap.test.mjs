import assert from "node:assert/strict"
import test from "node:test"

import {
  extractSitemapLocs,
  parseRobotsSitemaps,
  pickSitemapSample,
  sitemapSnapshotFromSample,
} from "./sitemap.ts"

test("parseRobotsSitemaps reads sitemap declarations", () => {
  const urls = parseRobotsSitemaps(`
User-agent: *
Disallow: /admin
Sitemap: https://exemplo.com.br/sitemap.xml
sitemap: https://exemplo.com.br/news.xml
`)
  assert.deepEqual(urls, [
    "https://exemplo.com.br/sitemap.xml",
    "https://exemplo.com.br/news.xml",
  ])
})

test("extractSitemapLocs counts urlset loc tags", () => {
  const xml = `<?xml version="1.0"?>
<urlset>
  <url><loc>https://exemplo.com.br/</loc></url>
  <url><loc>https://exemplo.com.br/sobre</loc></url>
</urlset>`
  const parsed = extractSitemapLocs(xml)
  assert.equal(parsed.kind, "urlset")
  assert.equal(parsed.locs.length, 2)
})

test("extractSitemapLocs detects a sitemap index", () => {
  const xml = `<sitemapindex>
  <sitemap><loc>https://exemplo.com.br/sitemap-pages.xml</loc></sitemap>
</sitemapindex>`
  const parsed = extractSitemapLocs(xml)
  assert.equal(parsed.kind, "index")
  assert.equal(parsed.locs[0], "https://exemplo.com.br/sitemap-pages.xml")
})

test("pickSitemapSample keeps start middle and end", () => {
  const urls = Array.from({ length: 40 }, (_, index) => `https://x.com/${index}`)
  const sample = pickSitemapSample(urls, 5)
  assert.equal(sample[0], "https://x.com/0")
  assert.equal(sample.at(-1), "https://x.com/39")
  assert.equal(sample.length, 5)
})

test("sitemapSnapshotFromSample counts 404s in the sample", () => {
  const snapshot = sitemapSnapshotFromSample(true, 22000, [
    { url: "https://x.com/1", status: 404 },
    { url: "https://x.com/2", status: 404 },
    { url: "https://x.com/3", status: 200 },
  ])
  assert.equal(snapshot.sampleChecked, 3)
  assert.equal(snapshot.sampleNotFound, 2)
})
