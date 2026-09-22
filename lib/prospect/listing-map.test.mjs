/**
 * Trava o mapeador contra o payload REAL.
 *
 * A fixture foi capturada em 2026-09-21 do `business_listings/search/live`
 * para dentista num raio de 10 km de Guarulhos, e os quatro itens foram
 * escolhidos por serem os casos que quebram mapeador: um completo, um sem
 * site, um sem telefone e um com perfil não reivindicado.
 *
 * Ausência não é erro aqui. 60% a 79% das empresas de um segmento local não
 * têm site e 15% a 29% não têm telefone — se o mapeador tratasse isso como
 * falha, a campanha perderia justamente os leads mais quentes.
 */

import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import {
  dedupeListings,
  mapBusinessListing,
  readBusinessListingsPage,
} from "./listing-map.ts"

const AQUI = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(
  readFileSync(join(AQUI, "listing.fixture.json"), "utf8"),
)
const ITENS = fixture.items

const porTitulo = (t) => ITENS.find((i) => i.title === t)

/* -------------------------------------------------------------------------- */

test("item completo mapeia os campos que o funil usa", () => {
  const m = mapBusinessListing(porTitulo("Dr. Negreiros Odontologia"))
  assert.ok(m)
  assert.equal(typeof m.placeId, "string")
  assert.equal(typeof m.cid, "string")
  assert.equal(m.title, "Dr. Negreiros Odontologia")
  assert.equal(m.isClaimed, true)
  assert.ok(m.zip && /^\d{8}$/.test(m.zip), "CEP sai sem máscara")
  assert.ok(m.phoneE164 && m.phoneE164.startsWith("55"))
  assert.ok(m.domain && !m.domain.startsWith("www."), "domínio perde o www")
})

test("empresa sem site vira null, não string vazia", () => {
  const m = mapBusinessListing(porTitulo("Você Sorrindo"))
  assert.ok(m)
  assert.equal(m.url, null)
  assert.equal(m.domain, null)
  // Mas o telefone existe, e é por ele que o CNPJ vai ser procurado.
  assert.ok(m.phoneE164)
})

test("empresa sem telefone continua sendo prospect", () => {
  const m = mapBusinessListing(porTitulo("Dentista Daniela R. Pavan"))
  assert.ok(m, "não pode ser descartada")
  assert.equal(m.phoneE164, null)
  assert.equal(m.phoneRaw, null)
  assert.equal(m.isClaimed, false)
})

test("perfil não reivindicado carrega o false, não o nulo", () => {
  const m = mapBusinessListing(porTitulo("Divya Implantes"))
  assert.ok(m)
  // A diferença importa: `false` é "não reivindicado" e vale ouro para uma
  // agência de GBP; `null` é "o provedor não sabe".
  assert.equal(m.isClaimed, false)
  assert.notEqual(m.isClaimed, null)
})

test("category_ids em snake_case é o que casa com o catálogo", () => {
  const m = mapBusinessListing(porTitulo("Dr. Negreiros Odontologia"))
  assert.ok(m.categoryIds.length > 0)
  assert.ok(
    m.categoryIds.every((id) => /^[a-z0-9_]+$/.test(id)),
    "id de categoria não tem espaço nem maiúscula",
  )
})

test("o payload cru é guardado inteiro", () => {
  const bruto = porTitulo("Divya Implantes")
  const m = mapBusinessListing(bruto)
  assert.deepEqual(m.listing, bruto)
})

/* -------------------------------------------------------------------------- */

test("item sem nome é descartado, e o descarte é contado", () => {
  const page = readBusinessListingsPage({
    items: [...ITENS, { type: "business_listing" }, null],
    total_count: 2401,
    offset: 0,
    offset_token: "abc",
  })
  assert.equal(page.items.length, ITENS.length)
  assert.equal(page.skipped, 2)
  assert.equal(page.totalCount, 2401)
  assert.equal(page.offsetToken, "abc")
})

test("página vazia não é erro", () => {
  const page = readBusinessListingsPage({ items: [], total_count: 0 })
  assert.equal(page.items.length, 0)
  assert.equal(page.totalCount, 0)
  assert.equal(page.offsetToken, null)
})

test("result que não é objeto vira null, não exceção", () => {
  assert.equal(readBusinessListingsPage(null), null)
  assert.equal(readBusinessListingsPage("texto"), null)
  assert.equal(mapBusinessListing(undefined), null)
})

test("data absurda vira ausência, não 1970", () => {
  const m = mapBusinessListing({
    title: "X",
    last_updated_time: "não é data",
  })
  assert.equal(m.listingUpdatedAt, null)
})

test("data real vira ISO", () => {
  const m = mapBusinessListing({
    title: "X",
    last_updated_time: "2026-06-15 10:00:00 +00:00",
  })
  assert.ok(m.listingUpdatedAt?.startsWith("2026-06-15"))
})

/* -------------------------------------------------------------------------- */

test("dedupe por place_id protege a sobreposição de páginas", () => {
  const mapeados = ITENS.map(mapBusinessListing)
  const comRepetido = [...mapeados, mapeados[0]]
  assert.equal(dedupeListings(comRepetido).length, mapeados.length)
})

test("sem place_id, o dedupe cai em nome mais CEP", () => {
  const a = { ...mapBusinessListing(ITENS[0]), placeId: null }
  const b = { ...a }
  assert.equal(dedupeListings([a, b]).length, 1)
})
