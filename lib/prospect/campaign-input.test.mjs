/**
 * Trava a validação, o corpo da chamada e a estimativa.
 *
 * O corpo é o que custa dinheiro; a estimativa é o número que o SDR lê antes
 * de autorizar o gasto. Os dois errados na mesma direção produziriam o pior
 * resultado possível: uma tela que promete barato e cobra caro.
 */

import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import {
  BUSINESS_LISTINGS_ITEM_USD,
  BUSINESS_LISTINGS_TASK_USD,
  buildAggregationTask,
  buildSearchTask,
  discoveryCostUsd,
  listingsCoordinate,
  listingsFilters,
  PROSPECT_CATEGORIES_MAX,
  readAggregation,
  validateCampaignInput,
} from "./campaign-input.ts"

const AQUI = dirname(fileURLToPath(import.meta.url))

const base = (over = {}) => ({
  name: "Dentistas · Guarulhos",
  categories: ["dentist"],
  latitude: -23.4628,
  longitude: -46.5333,
  radiusKm: 10,
  targetCount: 200,
  filters: {},
  ...over,
})

/* -------------------------------------------------------------------------- */
/*  Validação                                                                 */
/* -------------------------------------------------------------------------- */

test("campanha bem formada não tem pendência", () => {
  assert.deepEqual(validateCampaignInput(base()), [])
})

test("sem segmento não há o que buscar", () => {
  const issues = validateCampaignInput(base({ categories: [] }))
  assert.equal(issues[0].field, "categories")
})

test("acima de dez segmentos o provedor recorta sozinho — recusar antes", () => {
  const demais = Array.from({ length: PROSPECT_CATEGORIES_MAX + 1 }, (_, i) => `c${i}`)
  const issues = validateCampaignInput(base({ categories: demais }))
  assert.ok(issues.some((i) => i.field === "categories"))
})

test("sem coordenada não há região", () => {
  const issues = validateCampaignInput(base({ latitude: undefined }))
  assert.ok(issues.some((i) => i.field === "city"))
})

test("raio fora da faixa é recusado nas duas pontas", () => {
  assert.ok(validateCampaignInput(base({ radiusKm: 0 })).some((i) => i.field === "radiusKm"))
  assert.ok(validateCampaignInput(base({ radiusKm: 101 })).some((i) => i.field === "radiusKm"))
})

test("alvo fracionário ou acima do teto é recusado", () => {
  assert.ok(validateCampaignInput(base({ targetCount: 10.5 })).length > 0)
  assert.ok(validateCampaignInput(base({ targetCount: 1001 })).length > 0)
})

/* -------------------------------------------------------------------------- */
/*  Corpo da chamada                                                          */
/* -------------------------------------------------------------------------- */

test("a coordenada termina em RAIO, não em zoom", () => {
  // O `location_coordinate` da SERP do Maps termina em zoom. Mesmo nome de
  // campo, terceira posição com outro significado — trocar devolve resultado
  // plausível e errado.
  assert.equal(listingsCoordinate(-23.4628, -46.5333, 10), "-23.4628,-46.5333,10")
})

test("is_claimed é parâmetro próprio, nunca filtro", () => {
  const task = buildSearchTask(base({ filters: { onlyUnclaimed: true } }), {
    limit: 100,
  })
  assert.equal(task.is_claimed, false)
  assert.equal(task.filters, undefined, "mandar dentro de filters devolve 40501")
})

test("filtros viram cláusulas intercaladas por 'and'", () => {
  const f = listingsFilters({ onlyWithoutWebsite: true, maxRating: 4 })
  assert.deepEqual(f, [["url", "=", null], "and", ["rating.value", "<=", 4]])
})

test("sem filtro, o campo não é enviado", () => {
  const task = buildSearchTask(base(), { limit: 100 })
  assert.equal(task.filters, undefined)
  assert.equal(task.is_claimed, undefined)
})

test("o token manda no offset — enviar os dois recomeçaria a compra", () => {
  const task = buildSearchTask(base(), {
    limit: 100,
    offset: 300,
    offsetToken: "tok",
  })
  assert.equal(task.offset_token, "tok")
  assert.equal(task.offset, undefined)
})

test("sem token, o offset vale", () => {
  const task = buildSearchTask(base(), { limit: 100, offset: 300 })
  assert.equal(task.offset, 300)
  assert.equal(task.offset_token, undefined)
})

test("limite acima do teto do endpoint é recortado", () => {
  const task = buildSearchTask(base(), { limit: 5000 })
  assert.equal(task.limit, 1000)
})

test("o agregado usa limit pequeno — o preço não muda com ele", () => {
  const task = buildAggregationTask(base())
  assert.equal(task.limit, 5)
  assert.equal(task.location_coordinate, "-23.4628,-46.5333,10")
})

/* -------------------------------------------------------------------------- */
/*  Custo — conferido contra a medição de 2026-09-21                          */
/* -------------------------------------------------------------------------- */

test("cem itens custam exatamente o que foi medido", () => {
  // Medido: US$ 0,048 na conta real, contra 0,012 + 100 × 0,00036.
  assert.equal(discoveryCostUsd(100), 0.048)
})

test("mais de mil itens paga uma tarefa por página", () => {
  const esperado =
    2 * BUSINESS_LISTINGS_TASK_USD + 1500 * BUSINESS_LISTINGS_ITEM_USD
  assert.equal(discoveryCostUsd(1500), Number(esperado.toFixed(5)))
})

/* -------------------------------------------------------------------------- */
/*  Estimativa — contra o agregado REAL                                       */
/* -------------------------------------------------------------------------- */

test("a estimativa sai do agregado real, não de extrapolar a amostra", () => {
  const body = JSON.parse(
    readFileSync(
      join(
        AQUI,
        "..",
        "..",
        "docs",
        "auditoria",
        "evidencias",
        "2026-09-21-prospeccao",
        "06-aggregation-dentist.json",
      ),
      "utf8",
    ),
  )
  const est = readAggregation(body.tasks[0].result[0], 200, ["dentist"])

  assert.equal(est.universeCount, 2401, "dentistas num raio de 10 km de Guarulhos")
  assert.equal(est.withWebsiteCount, 519)
  // 22% — e a amostra de 100 dizia 40%. É por isso que a tela lê o agregado.
  assert.ok(est.withWebsiteCount / est.universeCount < 0.25)
  assert.equal(est.plannedCount, 200, "o teto da campanha manda")
  assert.equal(est.costUsd, discoveryCostUsd(200))
})

test("categoria vizinha não entra no universo — contaria a mesma empresa duas vezes", () => {
  const body = JSON.parse(
    readFileSync(
      join(
        AQUI,
        "..",
        "..",
        "docs",
        "auditoria",
        "evidencias",
        "2026-09-21-prospeccao",
        "06-aggregation-dentist.json",
      ),
      "utf8",
    ),
  )
  const est = readAggregation(body.tasks[0].result[0], 200, ["dentist"])

  // Somar os cinco itens daria 3.852 para um universo real de 2.401: clínica
  // odontológica também é dentista.
  const somaIngenua = [...est.byCategory, ...est.related].reduce(
    (t, c) => t + c.count,
    0,
  )
  assert.equal(somaIngenua, 3852)
  assert.equal(est.universeCount, 2401)

  assert.deepEqual(
    est.related.map((c) => c.category),
    ["dental_clinic", "oral_surgeon", "orthodontist", "dental_implants_provider"],
    "as vizinhas viram sugestão, ordenadas por tamanho",
  )
})

test("universo menor que o alvo reduz o planejado e o custo", () => {
  const est = readAggregation(
    { items: [{ categories: ["x"], aggregation: { count: 30, websites_count: 3 } }] },
    200,
  )
  assert.equal(est.plannedCount, 30)
  assert.equal(est.costUsd, discoveryCostUsd(30))
})

test("agregado vazio não quebra a tela", () => {
  const est = readAggregation(null, 200)
  assert.equal(est.universeCount, 0)
  assert.equal(est.byCategory.length, 0)
  assert.equal(est.plannedCount, 200)
})

test("as categorias saem ordenadas da maior para a menor", () => {
  const est = readAggregation(
    {
      items: [
        { categories: ["a"], aggregation: { count: 10, websites_count: 1 } },
        { categories: ["b"], aggregation: { count: 90, websites_count: 9 } },
      ],
    },
    200,
  )
  assert.deepEqual(
    est.byCategory.map((c) => c.category),
    ["b", "a"],
  )
})
