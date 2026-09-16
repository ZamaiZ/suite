import assert from "node:assert/strict"
import { test } from "node:test"

import { cityCenterCacheKey, cityCenterQuery } from "./city-key.ts"

test("a consulta identifica o município sem ambiguidade", () => {
  assert.equal(cityCenterQuery("Guarulhos", "SP"), "Guarulhos, SP, Brasil")
})

test("acento e espaço extra não mudam a consulta enviada", () => {
  // O acento FICA: é o nome real do município, e o geocoder lida melhor com ele
  // do que com a forma dobrada.
  assert.equal(cityCenterQuery("  São   Paulo ", "sp"), "São Paulo, SP, Brasil")
})

test("a chave de cache dobra acento e caixa, para não buscar duas vezes o mesmo", () => {
  assert.equal(cityCenterCacheKey("São Paulo", "SP"), "sao paulo|SP")
  assert.equal(
    cityCenterCacheKey("sao  paulo", "sp"),
    cityCenterCacheKey("São Paulo", "SP"),
  )
})

test("cidade homônima em UF diferente não colide no cache", () => {
  assert.notEqual(
    cityCenterCacheKey("Bom Jesus", "PI"),
    cityCenterCacheKey("Bom Jesus", "RS"),
  )
})
