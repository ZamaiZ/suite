import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { mapGbpPlaceCandidates } from "./gbp-maps-candidate.ts"

/**
 * Item real de `serp/google/maps/live/advanced`, colhido em 2026-09-15 contra a
 * Funerária Benttus — a mesma empresa das ondas anteriores.
 *
 * Existe porque o item do Maps traz 32 campos e o mapeador antigo lia três. A
 * lista do picker passa a mostrar perfil, não nome, e é este arquivo que impede
 * a próxima suposição de forma de sobreviver sem execução.
 */
const FIXTURE = JSON.parse(
  readFileSync(
    new URL("./gbp-maps-candidate.fixture.json", import.meta.url),
    "utf8",
  ),
)

test("lê o candidato com os campos que a lista mostra", () => {
  const [primeiro] = mapGbpPlaceCandidates(FIXTURE)
  assert.equal(primeiro.placeId, "ChIJkchU8A1ZzpQR99LmKcm-kT0")
  assert.equal(primeiro.title, "Funerária Benttus")
  assert.equal(primeiro.category, "Casa funerária")
  assert.equal(primeiro.domain, "grupofunerariabenttus.com.br")
  assert.equal(primeiro.isClaimed, true)
  assert.equal(primeiro.latitude, -23.5649348)
  assert.equal(primeiro.longitude, -46.6528995)
})

test("a nota vem de rating.value e o volume de rating.votes_count", () => {
  const [primeiro] = mapGbpPlaceCandidates(FIXTURE)
  assert.equal(primeiro.rating, 4.7)
  assert.equal(primeiro.votes, 401)
})

test("item sem place_id ou sem título é descartado", () => {
  const sujo = {
    items: [
      { type: "maps_search", title: "Sem id" },
      { type: "maps_search", place_id: "ChIJabc", title: null },
      ...FIXTURE.items,
    ],
  }
  assert.equal(mapGbpPlaceCandidates(sujo).length, FIXTURE.items.length)
})

test("ignora item que não é maps_search", () => {
  const misturado = {
    items: [{ type: "maps_paid", place_id: "ChIJx", title: "Anúncio" }],
  }
  assert.deepEqual(mapGbpPlaceCandidates(misturado), [])
})

test("resultado nulo ou sem items vira lista vazia, nunca erro", () => {
  assert.deepEqual(mapGbpPlaceCandidates(null), [])
  assert.deepEqual(mapGbpPlaceCandidates({}), [])
  assert.deepEqual(mapGbpPlaceCandidates({ items: "nada" }), [])
})

test("campo ausente vira null, e nunca zero", () => {
  // Zero em nota significaria "péssimo" numa tela que pinta faixa por valor.
  const [candidato] = mapGbpPlaceCandidates({
    items: [{ type: "maps_search", place_id: "ChIJabc", title: "Alvo" }],
  })
  assert.equal(candidato.rating, null)
  assert.equal(candidato.votes, null)
  assert.equal(candidato.isClaimed, null)
  assert.equal(candidato.latitude, null)
})
