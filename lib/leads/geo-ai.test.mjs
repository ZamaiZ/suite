/**
 * Trava as leituras da Presença em IA contra **payload real**.
 *
 * Não é teste de comportamento: é o que impede a próxima suposição de forma de
 * sobreviver seis meses sem execução. A documentação do provider errou três
 * vezes nesta etapa, e as três produziriam zero silencioso em vez de erro —
 * `annotations` no nível errado, filtro de domínio sem `www.`, e
 * `brand_entities` documentado como existente onde vem vazio.
 *
 * A fixture é recorte dos payloads em
 * `docs/auditoria/evidencias/2026-09-10-presenca-em-ia/`.
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import test from "node:test"
import assert from "node:assert/strict"

import { mapAiDemand } from "./geo-demand.ts"
import {
  mapAiMentions,
  mapGeoCitationPrompts,
  mapGeoCitations,
  matchesDomain,
} from "./geo-mentions.ts"
import {
  buildGeoPromptRun,
  buildGeoPromptVisibility,
  matchBrands,
  readLlmAnnotations,
} from "./geo-prompt-visibility.ts"
import { brandVariants, deriveGeoPromptSet } from "./geo-prompts.ts"

const here = dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(
  readFileSync(join(here, "geo-ai.fixture.json"), "utf8"),
)

/* -------------------------------------------------------------------------- */
/*  Demanda em IA                                                             */
/* -------------------------------------------------------------------------- */

test("demanda: o item tem três chaves e `0` é medida, não ausência", () => {
  const demand = mapAiDemand({
    result: fixture.aiKeywordData,
    locationLabel: "Brazil",
    languageCode: "pt",
  })
  assert.ok(demand)
  assert.equal(demand.keywords.length, 2)

  // 61 das 110 keywords vieram positivas e 49 vieram **zero**, nenhuma nula.
  // Ler `0` como ausência foi o defeito do `keyword_difficulty`.
  const zero = demand.keywords.find((row) => row.keyword === "pallets de paulla")
  assert.equal(zero?.aiSearchVolume, 0)
  assert.notEqual(zero?.aiSearchVolume, null)

  // Total soma só o que foi medido.
  assert.equal(demand.totalAiSearchVolume, 6)
})

test("demanda: lista vazia devolve total `null`, nunca `0`", () => {
  const demand = mapAiDemand({
    result: { items: [] },
    locationLabel: "Brazil",
    languageCode: "pt",
  })
  // Somar nada e mostrar zero afirmaria ausência de demanda onde não houve
  // medida nenhuma.
  assert.equal(demand?.totalAiSearchVolume, null)
})

test("demanda: soma mensal casa por ano-mês, não por índice", () => {
  const demand = mapAiDemand({
    result: fixture.aiKeywordData,
    locationLabel: "Brazil",
    languageCode: "pt",
  })
  const agosto = demand?.monthlyTotals.find(
    (row) => row.year === 2026 && row.month === 8,
  )
  assert.ok(agosto)
  // Somar por índice casaria meses diferentes de keywords diferentes e
  // produziria um gráfico plausível e errado.
  assert.equal(agosto.volume, 6)
})

test("demanda: resultado ausente devolve `null` — não coletado", () => {
  assert.equal(
    mapAiDemand({ result: null, locationLabel: "Brazil", languageCode: "pt" }),
    null,
  )
})

/* -------------------------------------------------------------------------- */
/*  Menções e citações                                                        */
/* -------------------------------------------------------------------------- */

test("menções: a forma do `multi_target_metrics` mapeia por alvo", () => {
  const mentions = mapAiMentions({
    result: fixture.multiTarget,
    leadKey: "lead",
    labels: { lead: "Busca Orgânica", conversion: "Conversion" },
    measuredBy: { lead: "brand_and_domain", conversion: "domain" },
  })
  assert.ok(mentions)
  assert.equal(mentions.source, "llm_mentions_google")
  assert.equal(mentions.targets.length, 3)

  // Ordenado por menções, do maior para o menor.
  assert.equal(mentions.targets[0].mentions, 50)
  const lead = mentions.targets.find((target) => target.isLead)
  assert.equal(lead?.mentions, 2)
  assert.equal(lead?.label, "Busca Orgânica")
})

test("menções: o critério de medição vai gravado por alvo", () => {
  const mentions = mapAiMentions({
    result: fixture.multiTarget,
    leadKey: "lead",
    labels: {},
    measuredBy: { lead: "brand_and_domain" },
  })
  const lead = mentions?.targets.find((target) => target.isLead)
  // Sem isto, a tela compara em pé de igualdade quem foi medido por nome **e**
  // domínio com quem foi medido só pelo domínio — e o lead, o único com nome
  // garantido, sai favorecido pela própria medição.
  assert.equal(lead?.measuredBy, "brand_and_domain")
  const outro = mentions?.targets.find((target) => !target.isLead)
  assert.equal(outro?.measuredBy, "domain")
})

test("menções: `share` com denominador zero é `null`, não `0`", () => {
  const mentions = mapAiMentions({
    result: { items: [{ key: "lead", total: { mentions: 0 } }] },
    leadKey: "lead",
    labels: {},
    measuredBy: {},
  })
  // "0% de participação" leria como derrota onde o que houve foi mercado sem
  // medida nenhuma.
  assert.equal(mentions?.share, null)
})

test("citações: `sources_domain` do alvo do lead, com autoridade marcada", () => {
  const citations = mapGeoCitations({
    result: fixture.multiTarget,
    leadKey: "lead",
    leadDomain: "buscaorganica.com.br",
    authorityDomains: ["wikipedia.org", "reddit.com", "youtube.com"],
    limit: 50,
  })
  assert.ok(citations)
  assert.equal(citations.mentions, 2)
  assert.equal(citations.source, "llm_mentions_google")
  // `prompts` nasce `null`: a leitura por pergunta é uma segunda chamada paga,
  // e `null` significa **não pedido**, nunca "pedido e vazio".
  assert.equal(citations.prompts, null)
})

test("citações: casamento de domínio honra `www.` e subdomínio", () => {
  // Igualdade exata contra a forma nua foi o que fez o filtro de backlinks
  // devolver zero contra um domínio com dez links provados em Reddit e
  // YouTube. Um falso negativo aqui vira "seu site não é citado" num
  // documento comercial.
  assert.equal(matchesDomain("www.reddit.com", "reddit.com"), true)
  assert.equal(matchesDomain("pt.wikipedia.org", "wikipedia.org"), true)
  assert.equal(matchesDomain("m.youtube.com", "youtube.com"), true)
  assert.equal(matchesDomain("reddit.com", "www.reddit.com"), true)
  // E não casa o que não é sufixo de rótulo.
  assert.equal(matchesDomain("notreddit.com", "reddit.com"), false)
})

test("citações por pergunta: lê `question` e `sources` do payload real", () => {
  const prompts = mapGeoCitationPrompts({
    result: fixture.searchMentions,
    leadDomain: "buscaorganica.com.br",
  })
  assert.ok(prompts)
  assert.equal(prompts.length, 2)
  assert.ok(prompts[0].question.length > 0)
  assert.ok(prompts[0].sources.length > 0)
  assert.ok(typeof prompts[0].sources[0].domain === "string")
})

test("citações por pergunta: resultado ausente é `null`, vazio é `[]`", () => {
  // `null` é "não pedido"; `[]` é "pedido e veio vazio". Confundir os dois foi
  // o defeito que esta etapa inteira existe para evitar.
  assert.equal(
    mapGeoCitationPrompts({ result: null, leadDomain: "x.com" }),
    null,
  )
  assert.deepEqual(
    mapGeoCitationPrompts({ result: { items: [] }, leadDomain: "x.com" }),
    [],
  )
})

/* -------------------------------------------------------------------------- */
/*  Sondagem                                                                  */
/* -------------------------------------------------------------------------- */

test("sondagem: `annotations` mora em items[].sections[].annotations[]", () => {
  const annotations = readLlmAnnotations(fixture.llmResponseClaude)
  // A documentação descreve o campo no nível do item. A onda 0 leu por lá e
  // obteve zero numa resposta que tinha três, todas apontando para o domínio
  // do lead. É o teste que impede a onda seguinte de repetir a leitura errada.
  assert.equal(annotations.length, 3)
  assert.ok(annotations.every((entry) => entry.url))
  assert.ok(annotations[0].url.includes("buscaorganica"))
})

test("sondagem: nada em `items[].annotations` — o caminho documentado é vazio", () => {
  const errado = (fixture.llmResponseClaude.items ?? []).flatMap(
    (item) => item.annotations ?? [],
  )
  assert.equal(errado.length, 0)
})

test("sondagem: posição é ordem de ocorrência entre as marcas detectadas", () => {
  const texto =
    "Entre as opções, a Conversion aparece primeiro, depois a Busca Orgânica e a Agência Mestre."
  const marcas = matchBrands(texto, [
    "Busca Orgânica",
    "Conversion",
    "Agência Mestre",
  ])
  assert.deepEqual(
    marcas.map((item) => `${item.position}:${item.name}`),
    ["1:Conversion", "2:Busca Orgânica", "3:Agência Mestre"],
  )
})

test("sondagem: casamento de marca ignora acento e caixa", () => {
  const marcas = matchBrands("procurei a agencia mestre ontem", [
    "Agência Mestre",
  ])
  assert.equal(marcas.length, 1)
  assert.equal(marcas[0].position, 1)
})

test("sondagem: execução que falhou não vira `mentioned: false` contado", () => {
  const falha = buildGeoPromptRun({
    promptId: "brand-1",
    provider: "gemini",
    status: "provider_unavailable",
    statusMessage: "rate_limit_exceeded",
    modelName: "gemini-2.5-flash",
    at: "2026-09-11T00:00:00.000Z",
    result: null,
    leadBrands: ["Busca Orgânica"],
    competitorBrands: [],
    domain: "buscaorganica.com.br",
    costUsd: null,
  })
  assert.equal(falha.status, "provider_unavailable")
  assert.equal(falha.statusMessage, "rate_limit_exceeded")

  const ok = buildGeoPromptRun({
    promptId: "brand-1",
    provider: "claude",
    status: "ok",
    statusMessage: null,
    modelName: "claude-haiku-4-5",
    at: "2026-09-11T00:00:00.000Z",
    result: fixture.llmResponseClaude,
    leadBrands: ["Busca Orgânica"],
    competitorBrands: [],
    domain: "buscaorganica.com.br",
    costUsd: 0.0238,
  })
  assert.equal(ok.domainCited, true)

  const visibility = buildGeoPromptVisibility({
    promptSetVersion: 1,
    runs: [falha, ok],
  })
  // Duas execuções, uma falhou: o denominador é 1, não 2. Contar a que o
  // provedor recusou derrubaria a taxa por um motivo que não tem nada a ver
  // com o lead.
  assert.equal(visibility.metrics.mentionRate, 1)
  assert.equal(visibility.runs.length, 2)
  assert.equal(visibility.metrics.byProvider.length, 1)
})

test("prompt set: a família de marca sempre existe, mesmo sem segmento", () => {
  const semSegmento = deriveGeoPromptSet({
    company: "Busca Orgânica",
    segment: null,
    city: null,
    fixedAt: "2026-09-11T00:00:00.000Z",
  })
  // É a família mais barata e a de maior sinal: responde se a LLM sabe que o
  // lead existe, que é a pergunta da qual todas as outras dependem.
  assert.equal(semSegmento.items.length, 2)
  assert.ok(semSegmento.items.every((item) => item.family === "brand"))

  const completo = deriveGeoPromptSet({
    company: "Busca Orgânica",
    segment: "agência de SEO",
    city: "Curitiba",
    fixedAt: "2026-09-11T00:00:00.000Z",
  })
  assert.equal(completo.items.length, 8)
  assert.ok(completo.items.every((item) => item.text.length <= 500))
})

test("prompt set: variantes da marca cobrem o nome sem sufixo jurídico", () => {
  const variantes = brandVariants("Busca Orgânica Marketing Digital Ltda.")
  // A LLM escreve "Busca Orgânica", não a razão social. Sem a variante, um
  // falso negativo vira "as IAs não reconhecem a marca" no documento.
  assert.ok(variantes.includes("Busca Orgânica"))
  assert.ok(variantes.includes("Busca Orgânica Marketing Digital"))
})
