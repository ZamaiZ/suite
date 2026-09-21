/**
 * Trava a resolução de cidade → `location_code`.
 *
 * A fixture é recorte real de `serp/google/locations/BR`, e inclui de propósito
 * o caso que quebra parser ingênuo: `Manaus,Manaus,State of Amazonas,Brazil`,
 * com a cidade repetida dentro do próprio município. Ler o estado do índice 1
 * daria "Manaus" como estado.
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import test from "node:test"
import assert from "node:assert/strict"

import {
  matchCityLocation,
  matchStateLocation,
  parseLocationName,
  resolveCities,
} from "./location-match.ts"

const aqui = dirname(fileURLToPath(import.meta.url))
const { result: LOCS } = JSON.parse(
  readFileSync(join(aqui, "location-match.fixture.json"), "utf8"),
)

const achar = (city, stateName) =>
  matchCityLocation({ city, stateName, locations: LOCS })

/* -------------------------------------------------------------------------- */
/*  Parser do nome                                                            */
/* -------------------------------------------------------------------------- */

test("três segmentos: nome e estado", () => {
  assert.deepEqual(parseLocationName("Itu,State of Sao Paulo,Brazil"), {
    name: "Itu",
    state: "Sao Paulo",
  })
})

test("quatro segmentos: o estado é o penúltimo, não o índice 1", () => {
  assert.deepEqual(parseLocationName("Manaus,Manaus,State of Amazonas,Brazil"), {
    name: "Manaus",
    state: "Amazonas",
  })
})

test("nome curto demais não vira localidade", () => {
  assert.equal(parseLocationName("Brazil"), null)
  assert.equal(parseLocationName(""), null)
})

/* -------------------------------------------------------------------------- */
/*  Casamento de cidade                                                       */
/* -------------------------------------------------------------------------- */

test("acha Itu pelo par cidade + estado", () => {
  const m = achar("Itu", "São Paulo")
  assert.equal(m.locationCode, 1031728)
  assert.equal(m.granularity, "city")
})

test("acento no briefing não impede o casamento", () => {
  // A lista do provedor vem sem acento: "State of Sao Paulo".
  assert.equal(achar("Itu", "São Paulo").locationCode, 1031728)
  assert.equal(achar("São Paulo", "São Paulo").locationCode, 1001773)
})

test("caixa é indiferente", () => {
  assert.equal(achar("ITU", "sao paulo").locationCode, 1031728)
})

test("cidade certa, estado errado, não casa", () => {
  // Sem esta regra, uma Salto de outra UF viraria a Salto/SP do cliente.
  assert.equal(achar("Salto", "Amazonas"), null)
})

test("homônimo entre UFs resolve pelo estado", () => {
  const m = achar("Manaus", "Amazonas")
  assert.notEqual(m, null)
  assert.equal(m.granularity, "city")
})

test("entre duas formas da mesma cidade, vence a canônica mais curta", () => {
  // `Manaus,State of Amazonas,Brazil` ganha de
  // `Manaus,Manaus,State of Amazonas,Brazil`.
  const m = achar("Manaus", "Amazonas")
  assert.equal(m.locationCode, 1001511)
  assert.equal(m.locationName.split(",").length, 3)
})

test("cidade inexistente devolve null, nunca o país", () => {
  // Cair para o país em silêncio é o defeito que a auditoria já tem: a
  // consulta funciona, não acusa nada, e mede outro mercado.
  assert.equal(achar("Cidade Que Não Existe", "São Paulo"), null)
})

test("bairro não é confundido com cidade", () => {
  assert.equal(achar("Parque dos Pinheiros", "São Paulo"), null)
})

test("entrada vazia não casa", () => {
  assert.equal(achar("", "São Paulo"), null)
  assert.equal(achar("Itu", ""), null)
})

/* -------------------------------------------------------------------------- */
/*  Queda para o estado                                                       */
/* -------------------------------------------------------------------------- */

test("estado é achado e marcado como granularidade menor", () => {
  const m = matchStateLocation({ stateName: "São Paulo", locations: LOCS })
  assert.equal(m.locationCode, 20106)
  assert.equal(m.granularity, "state")
})

/* -------------------------------------------------------------------------- */
/*  Resolução em lote                                                         */
/* -------------------------------------------------------------------------- */

test("resolve várias cidades e preserva as que não casaram", () => {
  const r = resolveCities({
    cities: [
      { name: "Itu", stateCode: "SP", stateName: "São Paulo" },
      { name: "Salto", stateCode: "SP", stateName: "São Paulo" },
      { name: "Vilarejo Inexistente", stateCode: "SP", stateName: "São Paulo" },
    ],
    locations: LOCS,
  })
  assert.equal(r.length, 3)
  assert.equal(r[0].match.locationCode, 1031728)
  assert.equal(r[1].match.locationCode, 1031984)
  // Não vira erro da execução inteira: sai do plano e entra no relatório.
  assert.equal(r[2].match, null)
})

test("sem fallback, cidade ausente fica sem código", () => {
  const r = resolveCities({
    cities: [{ name: "Inexistente", stateCode: "SP", stateName: "São Paulo" }],
    locations: LOCS,
  })
  assert.equal(r[0].match, null)
})

test("com fallback, cai para o estado e diz que caiu", () => {
  const r = resolveCities({
    cities: [{ name: "Inexistente", stateCode: "SP", stateName: "São Paulo" }],
    locations: LOCS,
    fallbackToState: true,
  })
  assert.equal(r[0].match.granularity, "state")
  assert.equal(r[0].match.locationCode, 20106)
})

test("lista de localidades vazia não quebra", () => {
  const r = resolveCities({
    cities: [{ name: "Itu", stateCode: "SP", stateName: "São Paulo" }],
    locations: [],
  })
  assert.equal(r[0].match, null)
})
