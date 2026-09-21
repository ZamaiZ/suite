/**
 * Trava o portão da pesquisa contra briefing real e contra os valores que o
 * cadastro aceita mas que não viram pesquisa.
 *
 * O caso 5 não foi inventado: `targetCities: ["Todas"]` e
 * `targetNeighborhoods: ["Todos"]` é o conteúdo literal do briefing do cliente
 * usado no desenho da fase. É por causa dele que este módulo existe — sem
 * portão, a pesquisa gastaria a fase inteira para descobrir no fim que não
 * havia localidade para cruzar.
 */

import test from "node:test"
import assert from "node:assert/strict"

import { buildResearchInput, MAX_SEEDS } from "./briefing-input.ts"

const FP = "ff58988df015dae38e656642f49b1b0e"

/** Briefing mínimo que passa, para cada caso mexer só no que interessa. */
const ok = (over = {}) => ({
  briefingFingerprint: FP,
  audience: {
    primaryKeyword: "tinta emborrachada",
    keywords: ["tinta emborrachada", "tinta acrílica"],
    targetCities: ["Itu", "Salto"],
    targetNeighborhoods: [],
    ...(over.audience ?? {}),
  },
  company: {
    city: "Itu",
    stateCode: "sp",
    servedAreas: [],
    ...(over.company ?? {}),
  },
  ...(over.root ?? {}),
})

const codigos = (r) => r.refusals.map((x) => x.code)

/* -------------------------------------------------------------------------- */
/*  Recusas                                                                   */
/* -------------------------------------------------------------------------- */

test("recusa sem fingerprint — sem ele não dá para saber que defasou", () => {
  const r = buildResearchInput(ok({ root: { briefingFingerprint: "  " } }))
  assert.equal(r.status, "refused")
  assert.ok(codigos(r).includes("sem_fingerprint"))
})

test("recusa sem palavra-chave principal", () => {
  const r = buildResearchInput(ok({ audience: { primaryKeyword: "" } }))
  assert.equal(r.status, "refused")
  assert.ok(codigos(r).includes("sem_keyword_principal"))
})

test("recusa sem palavras-chave nenhuma", () => {
  const r = buildResearchInput(
    ok({ audience: { primaryKeyword: "", keywords: [] } }),
  )
  assert.equal(r.status, "refused")
  assert.ok(codigos(r).includes("sem_keywords"))
})

test(`recusa acima de ${MAX_SEEDS} seeds`, () => {
  const muitas = Array.from({ length: MAX_SEEDS + 1 }, (_, i) => `kw ${i}`)
  const r = buildResearchInput(
    ok({ audience: { primaryKeyword: "kw 0", keywords: muitas } }),
  )
  assert.equal(r.status, "refused")
  assert.ok(codigos(r).includes("excesso_de_keywords"))
})

test("aceita exatamente no teto", () => {
  const noTeto = Array.from({ length: MAX_SEEDS }, (_, i) => `kw ${i}`)
  const r = buildResearchInput(
    ok({ audience: { primaryKeyword: "kw 0", keywords: noTeto } }),
  )
  assert.equal(r.status, "ok")
  assert.equal(r.input.seeds.length, MAX_SEEDS)
})

test('recusa cidade preenchida com "Todas" — o caso medido', () => {
  const r = buildResearchInput(
    ok({
      audience: { targetCities: ["Todas"], targetNeighborhoods: ["Todos"] },
      company: { city: "", servedAreas: [] },
    }),
  )
  assert.equal(r.status, "refused")
  assert.ok(codigos(r).includes("cidades_nao_enumeradas"))
  const recusa = r.refusals.find((x) => x.code === "cidades_nao_enumeradas")
  assert.deepEqual(recusa.values, ["Todas"])
})

test("recusa sem cidade alguma, com código diferente de cidade genérica", () => {
  const r = buildResearchInput(
    ok({
      audience: { targetCities: [] },
      company: { city: "", servedAreas: [] },
    }),
  )
  assert.equal(r.status, "refused")
  assert.ok(codigos(r).includes("sem_cidade"))
  assert.ok(!codigos(r).includes("cidades_nao_enumeradas"))
})

test('recusa bairro preenchido com "Todos"', () => {
  const r = buildResearchInput(
    ok({ audience: { targetNeighborhoods: ["Todos"] } }),
  )
  assert.equal(r.status, "refused")
  assert.ok(codigos(r).includes("bairros_nao_enumerados"))
})

test('"Brasil" como cidade não é cidade enumerada', () => {
  const r = buildResearchInput(
    ok({
      audience: { targetCities: ["Brasil"] },
      company: { city: "", servedAreas: [] },
    }),
  )
  assert.equal(r.status, "refused")
  assert.ok(codigos(r).includes("cidades_nao_enumeradas"))
})

/* -------------------------------------------------------------------------- */
/*  Caminho feliz                                                             */
/* -------------------------------------------------------------------------- */

test("sem bairro é o caso normal, não erro", () => {
  const r = buildResearchInput(ok())
  assert.equal(r.status, "ok")
  assert.deepEqual(r.input.neighborhoods, [])
  assert.equal(r.warnings.length, 0)
})

test("cidade da empresa vira a principal quando está entre as alvo", () => {
  const r = buildResearchInput(
    ok({
      audience: { targetCities: ["Salto", "Itu", "Sorocaba"] },
      company: { city: "Itu" },
    }),
  )
  assert.equal(r.status, "ok")
  assert.equal(r.input.cities.find((c) => c.isPrimary).name, "Itu")
  assert.equal(r.input.cities.filter((c) => c.isPrimary).length, 1)
})

test("sem casar com a cidade da empresa, a primeira da lista é a principal", () => {
  const r = buildResearchInput(
    ok({
      audience: { targetCities: ["Salto", "Sorocaba"] },
      company: { city: "Campinas" },
    }),
  )
  assert.equal(r.status, "ok")
  assert.equal(r.input.cities.find((c) => c.isPrimary).name, "Salto")
})

test("targetCities preenchida ignora a sede — a empresa atende onde ela diz", () => {
  const r = buildResearchInput(
    ok({
      audience: { targetCities: ["Salto", "Sorocaba"] },
      company: { city: "Itu", servedAreas: ["Indaiatuba"] },
    }),
  )
  assert.equal(r.status, "ok")
  assert.deepEqual(
    r.input.cities.map((c) => c.name),
    ["Salto", "Sorocaba"],
  )
})

test("sem targetCities, resgata servedAreas — briefing antigo continua rodando", () => {
  const r = buildResearchInput(
    ok({
      audience: { targetCities: [] },
      company: { city: "Itu", servedAreas: ["Itu", "Salto"] },
    }),
  )
  assert.equal(r.status, "ok")
  assert.deepEqual(
    r.input.cities.map((c) => c.name),
    ["Itu", "Salto"],
  )
  assert.equal(r.input.cities.find((c) => c.isPrimary).name, "Itu")
})

test('targetCities só com "Todas" cai no resgate antes de recusar', () => {
  const r = buildResearchInput(
    ok({
      audience: { targetCities: ["Todas"] },
      company: { city: "Itu", servedAreas: [] },
    }),
  )
  assert.equal(r.status, "ok")
  assert.deepEqual(
    r.input.cities.map((c) => c.name),
    ["Itu"],
  )
})

test("serpLocationCode nasce nulo — resolver é chamada de rede, não deste módulo", () => {
  const r = buildResearchInput(ok())
  assert.equal(r.status, "ok")
  assert.ok(r.input.cities.every((c) => c.serpLocationCode === null))
})

test("estado vem em caixa alta e cidade genérica misturada é descartada", () => {
  const r = buildResearchInput(
    ok({
      audience: { targetCities: ["Itu", "Todas", "Salto"] },
      company: { stateCode: "sp" },
    }),
  )
  assert.equal(r.status, "ok")
  assert.deepEqual(
    r.input.cities.map((c) => c.name),
    ["Itu", "Salto"],
  )
  assert.ok(r.input.cities.every((c) => c.stateCode === "SP"))
})

test("dedup ignora acento e caixa, e preserva a primeira grafia", () => {
  const r = buildResearchInput(
    ok({
      audience: {
        primaryKeyword: "Tinta Emborrachada",
        keywords: ["Tinta Emborrachada", "tinta emborrachada", "TINTA ACRÍLICA"],
        targetCities: ["Itu", "ITU", "itu"],
      },
    }),
  )
  assert.equal(r.status, "ok")
  assert.deepEqual(r.input.seeds, ["Tinta Emborrachada", "TINTA ACRÍLICA"])
  assert.deepEqual(
    r.input.cities.map((c) => c.name),
    ["Itu"],
  )
})

/* -------------------------------------------------------------------------- */
/*  Avisos — não travam                                                       */
/* -------------------------------------------------------------------------- */

test("principal fora da lista entra na frente, com aviso", () => {
  const r = buildResearchInput(
    ok({
      audience: {
        primaryKeyword: "borracha líquida",
        keywords: ["tinta acrílica"],
      },
    }),
  )
  assert.equal(r.status, "ok")
  assert.deepEqual(r.input.seeds, ["borracha líquida", "tinta acrílica"])
  assert.equal(r.warnings[0].code, "keyword_principal_ausente_da_lista")
})

test('bairro no formato "Bairro (Cidade)" casa com a cidade certa', () => {
  const r = buildResearchInput(
    ok({
      audience: {
        targetCities: ["Itu", "Salto"],
        targetNeighborhoods: ["Centro (Salto)", "Vila Leis (Itu)"],
      },
    }),
  )
  assert.equal(r.status, "ok")
  assert.deepEqual(r.input.neighborhoods, [
    { name: "Centro", city: "Salto" },
    { name: "Vila Leis", city: "Itu" },
  ])
  assert.equal(r.warnings.length, 0)
})

test("bairro sem cidade declarada cai na principal e avisa, com 2+ cidades", () => {
  const r = buildResearchInput(
    ok({
      audience: {
        targetCities: ["Itu", "Salto"],
        targetNeighborhoods: ["Vila Leis"],
      },
      company: { city: "Itu" },
    }),
  )
  assert.equal(r.status, "ok")
  assert.deepEqual(r.input.neighborhoods, [{ name: "Vila Leis", city: "Itu" }])
  assert.equal(r.warnings[0].code, "bairro_sem_cidade_declarada")
})

test("com uma cidade só, bairro sem cidade não gera aviso — seria ruído", () => {
  const r = buildResearchInput(
    ok({
      audience: {
        targetCities: ["Itu"],
        targetNeighborhoods: ["Vila Leis"],
      },
    }),
  )
  assert.equal(r.status, "ok")
  assert.deepEqual(r.input.neighborhoods, [{ name: "Vila Leis", city: "Itu" }])
  assert.equal(r.warnings.length, 0)
})

/* -------------------------------------------------------------------------- */
/*  Payload hostil — vem de jsonb                                             */
/* -------------------------------------------------------------------------- */

test("payload nulo ou de tipo errado não explode, recusa", () => {
  for (const lixo of [null, undefined, 42, "texto", []]) {
    const r = buildResearchInput({
      briefingFingerprint: FP,
      audience: lixo,
      company: lixo,
    })
    assert.equal(r.status, "refused")
  }
})

test("lista com item de tipo errado é filtrada, não quebra", () => {
  const r = buildResearchInput(
    ok({
      audience: {
        keywords: ["tinta emborrachada", null, 7, "", "  ", "tinta acrílica"],
        targetCities: ["Itu", null, 3],
      },
    }),
  )
  assert.equal(r.status, "ok")
  assert.deepEqual(r.input.seeds, ["tinta emborrachada", "tinta acrílica"])
  assert.deepEqual(
    r.input.cities.map((c) => c.name),
    ["Itu"],
  )
})
