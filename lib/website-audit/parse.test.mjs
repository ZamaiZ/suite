import assert from "node:assert/strict"
import test from "node:test"

import { crawlTargetsFromHome, parseHtmlPage } from "./parse.ts"

const HTML = `<!doctype html>
<html>
  <head>
    <title>Funerária São José em Campinas</title>
    <meta name="description" content="Atendimento 24 horas em Campinas." />
    <script type="application/ld+json">
      {"@type":"LocalBusiness","name":"Funerária São José"}
    </script>
  </head>
  <body>
    <header><a href="/sobre">Sobre</a></header>
    <h1>Funerária São José</h1>
    <h2>Serviços</h2>
    <p>${"palavra ".repeat(80)}</p>
    <img src="/foto.jpg" alt="Sala" />
    <img src="/logo.png" />
    <nav>
      <a href="/servicos">Serviços</a>
      <a href="/blog">Blog</a>
      <a href="/contato">Contato</a>
      <a href="https://outrosite.com.br/x">Externo</a>
      <a href="/arquivo.pdf">PDF</a>
    </nav>
    <footer>
      <a href="tel:+551932510000">Telefone</a>
      <a href="https://wa.me/5519999999999">WhatsApp</a>
    </footer>
  </body>
</html>`

test("parseHtmlPage extracts on-page signals from a local business home", () => {
  const page = parseHtmlPage(HTML, "https://exemplo.com.br/", 200)
  assert.equal(page.title, "Funerária São José em Campinas")
  assert.equal(page.metaDescription, "Atendimento 24 horas em Campinas.")
  assert.deepEqual(page.h1, ["Funerária São José"])
  assert.ok(page.wordCount > 50)
  assert.equal(page.imageCount, 2)
  assert.equal(page.imagesWithoutAlt, 1)
  assert.ok(page.internalPaths.includes("/servicos"))
  assert.equal(page.internalPaths.includes("/arquivo.pdf"), false)
  assert.ok(page.schemaTypes.includes("LocalBusiness"))
  assert.equal(page.hasTel, true)
  assert.equal(page.hasWhatsapp, true)
  assert.equal(page.contactInFooterOnly, true)
})

test("crawlTargetsFromHome keeps same-origin paths without tracking query", () => {
  const page = parseHtmlPage(HTML, "https://exemplo.com.br/", 200)
  const targets = crawlTargetsFromHome(page, new URL("https://exemplo.com.br/"))
  assert.ok(targets.some((url) => url.endsWith("/servicos")))
  assert.equal(targets.some((url) => url.includes("arquivo.pdf")), false)
})
