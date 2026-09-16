import assert from "node:assert/strict"
import { test } from "node:test"

import { addressFromLocationIq } from "./address.ts"

/** Forma real do objeto `address` do autocomplete do LocationIQ. */
const PAULISTA = {
  name: "Avenida Paulista",
  house_number: "1578",
  road: "Avenida Paulista",
  suburb: "Bela Vista",
  city: "São Paulo",
  state: "São Paulo",
  postcode: "01310-200",
  country: "Brasil",
  country_code: "br",
}

test("lê rua, número, bairro, cidade, estado e CEP", () => {
  const parsed = addressFromLocationIq(PAULISTA)
  assert.equal(parsed.street, "Avenida Paulista")
  assert.equal(parsed.number, "1578")
  assert.equal(parsed.neighborhood, "Bela Vista")
  assert.equal(parsed.city, "São Paulo")
  assert.equal(parsed.stateName, "São Paulo")
  assert.equal(parsed.postalCode, "01310200")
})

test("o CEP sai só com dígitos, para casar com o que o formulário grava", () => {
  assert.equal(
    addressFromLocationIq({ postcode: "01310-200" }).postalCode,
    "01310200",
  )
  assert.equal(
    addressFromLocationIq({ postcode: "cep 01310200" }).postalCode,
    "01310200",
  )
})

test("neighbourhood britânico vale tanto quanto suburb", () => {
  assert.equal(
    addressFromLocationIq({ neighbourhood: "Pinheiros" }).neighborhood,
    "Pinheiros",
  )
  // `suburb` vence quando os dois vêm: é o mais específico dos dois no Brasil.
  assert.equal(
    addressFromLocationIq({ neighbourhood: "Zona Oeste", suburb: "Pinheiros" })
      .neighborhood,
    "Pinheiros",
  )
})

test("cai para town, village e municipality quando não há city", () => {
  assert.equal(addressFromLocationIq({ town: "Itu" }).city, "Itu")
  assert.equal(addressFromLocationIq({ village: "Cunha" }).city, "Cunha")
  assert.equal(
    addressFromLocationIq({ municipality: "Bertioga" }).city,
    "Bertioga",
  )
})

test("entrada inválida vira endereço vazio, nunca erro", () => {
  const vazio = addressFromLocationIq(null)
  assert.equal(vazio.street, "")
  assert.equal(vazio.city, "")
  assert.deepEqual(addressFromLocationIq("nada"), vazio)
})
