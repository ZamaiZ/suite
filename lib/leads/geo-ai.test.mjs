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
  mapGeoCitationPrompts,
  mapGeoCitations,
  matchesDomain,
  mentionsFromCitations,
  promptConcentration,
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

test("citações: montadas das perguntas, com autoridade marcada", () => {
  const citations = mapGeoCitations({
    result: fixture.searchMentions,
    leadDomain: "buscaorganica.com.br",
    authorityDomains: ["wikipedia.org", "reddit.com", "youtube.com"],
    limit: 50,
  })
  assert.ok(citations)
  assert.equal(citations.source, "llm_mentions_google")
  // O número e a lista saem da MESMA chamada. Antes `mentions` vinha do
  // `multi_target` e dizia 2 com sete perguntas listadas abaixo — contradição
  // visível na tela do analista.
  assert.equal(citations.mentions, fixture.searchMentions.total_count)
  assert.equal(citations.prompts?.length, 2)
  assert.ok(citations.sources.length > 0)
  const autoridade = citations.sources.find((source) => source.isAuthority)
  if (autoridade) assert.equal(autoridade.isAuthority, true)
})

test("citações: o domínio é contado uma vez por pergunta", () => {
  const duasVezesNaMesma = {
    total_count: 1,
    items: [
      {
        question: "quem faz seo",
        ai_search_volume: 10,
        last_response_at: "2026-01-01 00:00:00 +00:00",
        sources: [
          { domain: "rival.com.br", url: "https://rival.com.br/a", rank: 1 },
          { domain: "rival.com.br", url: "https://rival.com.br/b", rank: 2 },
        ],
      },
    ],
  }
  const citations = mapGeoCitations({
    result: duasVezesNaMesma,
    leadDomain: "buscaorganica.com.br",
    authorityDomains: [],
    limit: 50,
  })
  // Duas âncoras da mesma página na mesma resposta não são duas citações:
  // contá-las inflaria o domínio pela forma da citação, não pela frequência.
  assert.equal(citations?.sources[0].mentions, 1)
})

test("comparação: derivada das fontes, universo declarado", () => {
  const citations = mapGeoCitations({
    result: fixture.searchMentions,
    leadDomain: "buscaorganica.com.br",
    authorityDomains: ["youtube.com"],
    limit: 50,
  })
  assert.ok(citations)
  const mentions = mentionsFromCitations({
    citations,
    leadDomain: "buscaorganica.com.br",
    leadLabel: "Busca Orgânica",
    limit: 6,
  })
  assert.ok(mentions)
  assert.equal(mentions.source, "prompt_sources")
  // O universo vai gravado: sem ele, o percentual vira "participação de
  // mercado" na leitura de quem abre a tela.
  assert.equal(mentions.promptCount, citations.prompts?.length)

  // Todos medidos pelo MESMO critério, o lead inclusive. A versão anterior
  // media o lead por nome e domínio e os rivais só por domínio, e o lead saía
  // favorecido pela própria medição.
  assert.ok(mentions.targets.every((t) => t.measuredBy === "domain"))
})

test("comparação: denominador conta TODAS as citações, não só as exibidas", () => {
  const citations = mapGeoCitations({
    result: {
      total_count: 1,
      items: [
        {
          question: "melhores agências de seo",
          sources: [
            { domain: "buscaorganica.com.br", url: "https://a", rank: 1 },
            { domain: "www.youtube.com", url: "https://b", rank: 2 },
            { domain: "support.google.com", url: "https://c", rank: 3 },
            { domain: "rival.com.br", url: "https://d", rank: 4 },
          ],
        },
      ],
    },
    leadDomain: "buscaorganica.com.br",
    authorityDomains: ["youtube.com"],
    limit: 50,
  })
  const mentions = mentionsFromCitations({
    citations,
    leadDomain: "buscaorganica.com.br",
    leadLabel: "Busca Orgânica",
    limit: 6,
  })
  // A lista esconde YouTube (autoridade) e support.google (genérico), mas as
  // quatro citações contam no denominador. Contar só as exibidas inflaria a
  // participação do lead por construção: daria 50% em vez de 25%.
  assert.equal(mentions?.targets.length, 2)
  assert.equal(mentions?.share, 0.25)
})

test("comparação: uma pergunta dominante é sinalizada", () => {
  const citations = mapGeoCitations({
    result: {
      total_count: 2,
      items: [
        {
          question: "como ganhar dinheiro na internet",
          sources: Array.from({ length: 9 }, (_, index) => ({
            domain: `portal${index}.com.br`,
            url: `https://p${index}`,
            rank: index + 1,
          })),
        },
        {
          question: "agência de seo",
          sources: [
            { domain: "buscaorganica.com.br", url: "https://a", rank: 1 },
          ],
        },
      ],
    },
    leadDomain: "buscaorganica.com.br",
    authorityDomains: [],
    limit: 50,
  })
  const concentracao = promptConcentration(citations)
  // Medido em 2026-09-11: uma pergunta genérica trouxe 22 das 66 citações e
  // arrastou hospedagem e finanças pessoais para a lista de "concorrentes".
  assert.equal(concentracao?.question, "como ganhar dinheiro na internet")
  assert.equal(concentracao?.share, 0.9)
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
    hasCompetitorBrands: true,
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

test("sondagem: sem marca de concorrente, dominância é `null`, nunca 100%", () => {
  const run = buildGeoPromptRun({
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
    costUsd: 0.02,
  })

  // Medido em 2026-09-11: a lista de concorrentes veio vazia, só o nome do
  // lead entrou no casamento, e a conta deu 100% de dominância sobre um
  // universo de uma marca — a própria. O número mais lisonjeiro que a tela
  // poderia mostrar, e o que a spec chama de "dominância sobre um universo que
  // ninguém mediu".
  const semRivais = buildGeoPromptVisibility({
    promptSetVersion: 1,
    runs: [run],
    hasCompetitorBrands: false,
  })
  assert.equal(semRivais.metrics.dominance, null)

  const comRivais = buildGeoPromptVisibility({
    promptSetVersion: 1,
    runs: [run],
    hasCompetitorBrands: true,
  })
  assert.equal(comRivais.metrics.dominance, 1)
})
