// DESCARTAVEL - Onda 0 da Presenca em IA, metade PAGA. Nao faz parte do app.
//
// As cinco perguntas 5 a 9 da onda 0. Rodam DEPOIS de `probe.mjs`, que ja
// provou de graca que a secao `ai_optimization` esta na conta, que a assinatura
// de `llm_mentions` esta ativa, e que Brasil + `pt` estao nos dois datasets.
//
// ORDEM: da mais barata para a mais cara, de proposito. Se o teto de gasto
// interromper, o que se perde e o item de menor razao resposta/custo.
//
//   p6  ai_keyword_data          ~US$ 0,021   a demanda em IA responde em pt?
//   p5  ranked_keywords x2       ~US$ 0,030   a FORMA do `ai_overview_reference`
//   p9  llm_responses x4         ~US$ 0,002 + repasse do modelo
//   p8  backlinks x2             ~US$ 0,04    o catalogo de citacoes casa?
//   p7  llm_mentions x2          ~US$ 0,22    o dataset tem negocio BR?
//
// DOIS CONTROLES POSITIVOS. `buscaorganica.com.br` pode devolver vazio por dez
// motivos, e "vazio" sozinho nao distingue "nao tem" de "nao sabemos ler". Por
// isso p5 e p7 rodam tambem contra `puroclean.com` em US/en, que o relatorio de
// referencia do SEOptimer PROVA ter dez citacoes em AI Overview e presenca em
// Reddit e YouTube. Controle vazio reprova o leitor; controle cheio com BR
// vazio reprova a cobertura. Sao vereditos diferentes.
//
// Uso:
//   node docs/auditoria/evidencias/2026-09-10-presenca-em-ia/probe-pago.mjs [OUT_DIR] [TETO_USD]

import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = "C:/Users/Eduardo Zamai/Documents/suite"
const OUT = process.argv[2] ?? "."
const TETO = Number(process.argv[3] ?? "1.50")

const LEAD = "buscaorganica.com.br"
const CONTROLE = "puroclean.com"

/**
 * As tres fontes que o relatorio de referencia mede.
 *
 * COM E SEM `www.`. A primeira rodada mandou so a forma nua e voltou ZERO nos
 * dois alvos, incluindo o controle - que tem cinco links de Reddit e cinco de
 * YouTube provados pelo relatorio. `llm_mentions` devolveu `domain` como
 * `www.reddit.com` na mesma medicao, e e essa a forma que o indice guarda.
 *
 * Um `in` de igualdade exata contra a forma nua da zero e parece veredito.
 * Seria falso negativo nosso, apresentado como ausencia de citacao do lead -
 * a mesma classe de erro do operador `site:` que a Task 0 de citacoes reprovou.
 */
const CATALOGO = [
  "wikipedia.org",
  "www.wikipedia.org",
  "pt.wikipedia.org",
  "en.wikipedia.org",
  "reddit.com",
  "www.reddit.com",
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
]

function env() {
  const raw = readFileSync(join(ROOT, ".env.local"), "utf8")
  const out = {}
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    const quote = v[0]
    if (v.length > 1 && (quote === '"' || quote === "'") && v[v.length - 1] === quote) {
      v = v.slice(1, -1)
    }
    out[m[1]] = v
  }
  return out
}

const e = env()
if (!e.DATAFORSEO_LOGIN || !e.DATAFORSEO_PASSWORD) {
  console.error("faltam credenciais DATAFORSEO em .env.local")
  process.exit(1)
}
const auth =
  "Basic " +
  Buffer.from(`${e.DATAFORSEO_LOGIN}:${e.DATAFORSEO_PASSWORD}`, "utf8").toString(
    "base64",
  )

const summary = {
  at: new Date().toISOString(),
  teto_usd: TETO,
  lead: LEAD,
  controle: CONTROLE,
  traces: {},
  gasto: 0,
  veredito: {},
}

function dump(name, payload) {
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(payload, null, 2), "utf8")
}

function task(r) {
  return r?.json?.tasks?.[0] ?? null
}

/**
 * Teto de gasto conferido ANTES de cada chamada, com o custo real somado
 * DEPOIS. A tabela da conta e piso, nao orcamento - `usage.ts` registra isso
 * desde que o SERP cobrou 0,01 onde a tabela dizia 0,002. Estimar o proximo
 * gasto pela tabela e como estourar o teto sem perceber.
 */
async function call(nome, path, body, method = "POST") {
  if (summary.gasto >= TETO) {
    summary.traces[nome] = { pulado: `teto de US$ ${TETO} atingido` }
    console.error(`[teto] pulando ${nome}`)
    return null
  }
  let r
  try {
    const res = await fetch(`https://api.dataforseo.com/v3${path}`, {
      method,
      headers: {
        Authorization: auth,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: body ? JSON.stringify([body]) : undefined,
    })
    r = { http: res.status, json: await res.json() }
  } catch (err) {
    r = { http: null, json: null, error: String(err) }
  }
  const t = task(r)
  const cost = typeof t?.cost === "number" ? t.cost : 0
  summary.gasto = Number((summary.gasto + cost).toFixed(6))
  summary.traces[nome] = {
    path,
    http: r.http ?? null,
    error: r.error ?? null,
    status_code: t?.status_code ?? r.json?.status_code ?? null,
    status_message: t?.status_message ?? r.json?.status_message ?? null,
    cost,
    gasto_acumulado: summary.gasto,
  }
  console.error(
    `[${nome}] http ${r.http} status ${t?.status_code ?? "-"} custo ${cost} acumulado ${summary.gasto}`,
  )
  return r
}

// ===========================================================================
// p6 - `ai_search_volume` responde em portugues, ou vem 0 com cara de resposta?
//
// Esta e a pergunta que decide se a onda 2 existe. O precedente exato e o
// `keyword_difficulty`, que a onda 0 da visibilidade pegou devolvendo 0 em
// massa - zero com cara de numero, que passou seis meses na tela como se fosse
// medida. As 110 keywords vem da propria evidencia daquela onda: nao se paga
// duas vezes pelo mesmo `ranked_keywords`.
// ===========================================================================
const comparacao = JSON.parse(
  readFileSync(
    join(ROOT, "docs/auditoria/evidencias/2026-09-10-visibilidade/04-comparacao.json"),
    "utf8",
  ),
)
const keywords = [...new Set(comparacao.map((r) => r.keyword).filter(Boolean))]
const volumeLabs = new Map(comparacao.map((r) => [r.keyword, r.volume]))

const aikd = await call(
  "p6_ai_keyword_data",
  "/ai_optimization/ai_keyword_data/keywords_search_volume/live",
  { keywords, location_name: "Brazil", language_code: "pt" },
)
dump("10-ai_keyword_data", aikd?.json ?? null)

{
  const items = task(aikd)?.result?.[0]?.items ?? []
  const anat = { null: 0, zero: 0, positivo: 0, ausente: 0 }
  const cruzado = []
  for (const it of items) {
    const v = it?.ai_search_volume
    if (!("ai_search_volume" in (it ?? {}))) anat.ausente++
    else if (v === null) anat.null++
    else if (v === 0) anat.zero++
    else anat.positivo++
    cruzado.push({
      keyword: it?.keyword ?? null,
      ai_search_volume: v ?? null,
      volume_google: volumeLabs.get(it?.keyword) ?? null,
      meses: Array.isArray(it?.ai_monthly_searches)
        ? it.ai_monthly_searches.length
        : null,
    })
  }
  dump("11-ai_keyword_data-cruzado", cruzado)
  summary.veredito.p6 = {
    keywords_enviadas: keywords.length,
    itens_devolvidos: items.length,
    anatomia: anat,
    chaves_do_item: items[0] ? Object.keys(items[0]) : [],
    // A pergunta em uma linha: existe ALGUMA keyword com volume de IA > 0?
    // Se nao, a onda 2 le `0` como ausencia, nao como medida.
    tem_volume_positivo: anat.positivo > 0,
    exemplos_positivos: cruzado
      .filter((r) => typeof r.ai_search_volume === "number" && r.ai_search_volume > 0)
      .slice(0, 12),
  }
}

// ===========================================================================
// p5 - a FORMA do `serp_item` de `ai_overview_reference`
//
// A onda 0 da visibilidade ampliou `item_types` e registrou que os dois tipos
// novos vieram ZERADOS - logo a forma segue nao observada, e o mapeador e
// defensivo sobre uma suposicao. Enquanto isso nao for medido,
// `aiOverview.count: 0` significa uma de duas coisas sem que se saiba qual.
//
// O controle resolve a ambiguidade: `puroclean.com` tem dez citacoes provadas.
// ===========================================================================
function anatomiaSerpItem(r) {
  const result = task(r)?.result?.[0] ?? null
  const items = result?.items ?? []
  const first = items[0] ?? null
  return {
    total_count: result?.total_count ?? null,
    items_count: result?.items_count ?? items.length,
    metrics: result?.metrics ?? null,
    chaves_serp_item: first
      ? Object.keys(first.ranked_serp_element?.serp_item ?? {})
      : [],
    amostra: items.slice(0, 5).map((it) => ({
      keyword: it?.keyword_data?.keyword ?? null,
      volume: it?.keyword_data?.keyword_info?.search_volume ?? null,
      serp_item: it?.ranked_serp_element?.serp_item ?? null,
    })),
  }
}

const rkControle = await call(
  "p5_ranked_keywords_controle",
  "/dataforseo_labs/google/ranked_keywords/live",
  {
    target: CONTROLE,
    location_name: "United States",
    language_code: "en",
    item_types: ["ai_overview_reference"],
    limit: 50,
    order_by: ["ranked_serp_element.serp_item.etv,desc"],
  },
)
dump("12-ranked_keywords-aio-controle", rkControle?.json ?? null)
summary.veredito.p5_controle = anatomiaSerpItem(rkControle)

const rkLead = await call(
  "p5_ranked_keywords_lead",
  "/dataforseo_labs/google/ranked_keywords/live",
  {
    target: LEAD,
    location_name: "Brazil",
    language_code: "pt",
    item_types: ["ai_overview_reference"],
    limit: 50,
    order_by: ["ranked_serp_element.serp_item.etv,desc"],
  },
)
dump("13-ranked_keywords-aio-lead", rkLead?.json ?? null)
summary.veredito.p5_lead = anatomiaSerpItem(rkLead)

// ===========================================================================
// p9 - `annotations` chegam preenchidas em BR, e quanto custa de verdade?
//
// `money_spent` e o unico numero que responde o custo da sondagem: a tabela da
// conta so tem a taxa de US$ 0,0006, e o repasse do modelo nao aparece nela.
// Um modelo barato por plataforma - a escolha de modelo E a escolha de custo.
// ===========================================================================
//
// CADA PLATAFORMA REJEITA UM CAMPO DIFERENTE. Medido na primeira rodada, com
// `40501 Invalid Field` em tres das quatro:
//
//   chat_gpt    recusa `max_output_tokens`
//   gemini      recusa `web_search_country_iso_code`
//   perplexity  recusa `web_search_city`
//
// So `claude` aceitou o corpo inteiro. Um construtor unico de requisicao -
// que e o desenho obvio para quatro plataformas com o mesmo shape - falharia
// em tres delas, e `40501` nao cobra nada, entao a falha seria silenciosa no
// custo e visivel so como "essa plataforma nunca traz dado".
const PROVEDORES = [
  { plataforma: "chat_gpt", model_name: "gpt-5-mini", omitir: ["max_output_tokens"] },
  { plataforma: "claude", model_name: "claude-haiku-4-5", omitir: [] },
  {
    plataforma: "gemini",
    // Recusa os DOIS campos de localizacao, um de cada vez: tirar
    // `web_search_country_iso_code` so faz ele reclamar de `web_search_city`.
    // Gemini nao aceita localizacao nenhuma em `llm_responses` - a sondagem
    // nessa plataforma mede sem recorte geografico, e a tela precisa dizer.
    // `gemini-3.5-flash-lite` e `gemini-3.5-flash` devolveram
    // `50301 3rd Party API Service Unavailable (rate_limit_exceeded)` em tres
    // tentativas, com custo zero. Nao e campo errado nem conta sem permissao:
    // e limite do provedor, do lado de la. `gemini-2.5-flash` respondeu na
    // primeira. A sondagem precisa tratar 50301 como EXECUCAO QUE NAO
    // ACONTECEU - gravar como "nao mencionado" seria inventar ausencia.
    model_name: "gemini-2.5-flash",
    omitir: ["web_search_country_iso_code", "web_search_city"],
  },
  { plataforma: "perplexity", model_name: "sonar", omitir: ["web_search_city"] },
]
const PROMPT = "A agência de SEO Busca Orgânica é confiável? O que se sabe sobre ela?"

/**
 * `annotations` mora em `items[].sections[].annotations[]`, NAO em
 * `items[].annotations[]`.
 *
 * A documentacao descreve o campo no nivel do item, e foi assim que a primeira
 * versao deste probe leu - e concluiu `annotations_count: 0` numa resposta que
 * tinha tres, todas apontando para o dominio do lead. Ou seja: a leitura errada
 * produziria exatamente o veredito "a plataforma nao devolve annotations",
 * que e a conclusao mais cara possivel, porque mata a metrica deterministica da
 * sondagem inteira.
 *
 * `domainCited` da spec depende deste caminho. Se a onda 3 for escrita a partir
 * da documentacao em vez deste payload, ela nasce quebrada e silenciosa.
 */
function lerAnnotations(items) {
  return items.flatMap((i) =>
    (i?.sections ?? []).flatMap((s) => s?.annotations ?? []),
  )
}

const sondagem = {}
for (const p of PROVEDORES) {
  const corpo = {
    user_prompt: PROMPT,
    model_name: p.model_name,
    web_search: true,
    web_search_country_iso_code: "BR",
    web_search_city: "São Paulo",
    max_output_tokens: 800,
  }
  for (const campo of p.omitir) delete corpo[campo]

  const r = await call(
    `p9_llm_${p.plataforma}`,
    `/ai_optimization/${p.plataforma}/llm_responses/live`,
    corpo,
  )
  dump(`14-llm_responses-${p.plataforma}`, r?.json ?? null)
  const res = task(r)?.result?.[0] ?? null
  const items = res?.items ?? []
  const annotations = lerAnnotations(items)
  const texto = items
    .map((i) => (i?.sections ?? []).map((s) => s?.text ?? "").join(" "))
    .join(" ")
  sondagem[p.plataforma] = {
    model_name: res?.model_name ?? null,
    campos_omitidos: p.omitir,
    web_search: res?.web_search ?? null,
    money_spent: res?.money_spent ?? null,
    input_tokens: res?.input_tokens ?? null,
    output_tokens: res?.output_tokens ?? null,
    chaves_result: res ? Object.keys(res) : [],
    chaves_item: items[0] ? Object.keys(items[0]) : [],
    chaves_section: items[0]?.sections?.[0]
      ? Object.keys(items[0].sections[0])
      : [],
    annotations_count: annotations.length,
    // A pergunta determinista da spec: `domainCited` sai de `annotations`, e
    // precisa do campo `url`. Annotation sem url nao serve para nada aqui.
    annotations_com_url: annotations.filter((a) => a?.url).length,
    chaves_annotation: annotations[0] ? Object.keys(annotations[0]) : [],
    dominio_citado: annotations.some((a) =>
      typeof a?.url === "string" ? a.url.includes("buscaorganica") : false,
    ),
    marca_no_texto: /busca\s*org[aâ]nica/i.test(texto),
    fan_out_queries: Array.isArray(res?.fan_out_queries)
      ? res.fan_out_queries.length
      : null,
    amostra_annotations: annotations.slice(0, 5),
  }
}
summary.veredito.p9 = sondagem
summary.veredito.p9_custo_real_por_sondagem = {
  soma_money_spent: Object.values(sondagem).reduce(
    (a, s) => a + (typeof s.money_spent === "number" ? s.money_spent : 0),
    0,
  ),
  // A spec dimensiona 8 prompts x 4 provedores = 32 execucoes.
  projecao_32_execucoes:
    Object.values(sondagem).reduce(
      (a, s) => a + (typeof s.money_spent === "number" ? s.money_spent : 0),
      0,
    ) * 8,
}

// ===========================================================================
// p8 - o catalogo de citacoes casa por `filters` `in`?
//
// O filtro `in` conta como UM filtro, nao um por valor - achado da onda 8, e e
// o que torna o catalogo barato. A ressalva daquela onda continua de pe: link
// encontrado prova a citacao, link ausente NAO prova ausencia de citacao.
// O controle e quem mede o tamanho dessa ressalva: `puroclean.com` tem presenca
// provada em Reddit e YouTube. Se o controle vier vazio, a via de backlink nao
// serve para citacao, e o numero que prova isso e este.
// ===========================================================================
function anatomiaBacklinks(r) {
  const result = task(r)?.result?.[0] ?? null
  const items = result?.items ?? []
  const porDominio = {}
  for (const it of items) {
    const d = it?.domain_from ?? "(sem domain_from)"
    porDominio[d] = (porDominio[d] ?? 0) + 1
  }
  return {
    total_count: result?.total_count ?? null,
    items_count: items.length,
    por_dominio: porDominio,
    amostra: items.slice(0, 6).map((it) => ({
      domain_from: it?.domain_from ?? null,
      url_from: it?.url_from ?? null,
      url_to: it?.url_to ?? null,
      dofollow: it?.dofollow ?? null,
      first_seen: it?.first_seen ?? null,
    })),
  }
}

for (const [nome, alvo] of [
  ["p8_backlinks_lead", LEAD],
  ["p8_backlinks_controle", CONTROLE],
]) {
  const r = await call(nome, "/backlinks/backlinks/live", {
    target: alvo,
    mode: "one_per_domain",
    limit: 100,
    backlinks_status_type: "live",
    filters: [["domain_from", "in", CATALOGO]],
  })
  dump(`15-${nome}`, r?.json ?? null)
  summary.veredito[nome] = anatomiaBacklinks(r)
}

// ===========================================================================
// p7 - o dataset de `llm_mentions` tem negocio local brasileiro?
//
// O item mais caro fica por ultimo: US$ 0,10 por requisicao, oito vezes o Labs.
// `available_filters` e gratuito por tabela e roda antes - se ele enumerar os
// campos, resolve de graca parte da ambiguidade entre `search_mentions/live` e
// `search/live`, que a tabela da conta lista como entradas separadas com o
// mesmo preco.
//
// `limit: 10` de proposito: a parcela por linha e US$ 0,001, e a pergunta aqui
// e "vem alguma coisa", nao "vem tudo".
// ===========================================================================
const filtros = await call(
  "p7_available_filters",
  "/ai_optimization/llm_mentions/available_filters",
  null,
  "GET",
)
dump("16-llm_mentions-available_filters", filtros?.json ?? null)
summary.veredito.p7_filtros = task(filtros)?.result ?? null

function anatomiaMentions(r) {
  const result = task(r)?.result?.[0] ?? null
  const items = result?.items ?? result?.items_by_target ?? []
  const first = Array.isArray(items) ? items[0] : null
  return {
    chaves_result: result ? Object.keys(result) : [],
    items_count: Array.isArray(items) ? items.length : null,
    total_count: result?.total_count ?? null,
    chaves_item: first ? Object.keys(first) : [],
    // O que a spec precisa: a query, a resposta, e as fontes com url.
    amostra: Array.isArray(items)
      ? items.slice(0, 3).map((it) => ({
          keyword: it?.keyword ?? it?.query ?? null,
          platform: it?.platform ?? null,
          model_name: it?.model_name ?? null,
          ai_search_volume: it?.ai_search_volume ?? null,
          sources_count: Array.isArray(it?.sources) ? it.sources.length : null,
          sources_amostra: Array.isArray(it?.sources)
            ? it.sources.slice(0, 4)
            : null,
          answer_len: typeof it?.answer === "string" ? it.answer.length : null,
        }))
      : null,
  }
}

const mentionsControle = await call(
  "p7_search_mentions_controle",
  "/ai_optimization/llm_mentions/search_mentions/live",
  {
    target: [{ domain: CONTROLE }],
    platform: "google",
    location_name: "United States",
    language_code: "en",
    limit: 10,
  },
)
dump("17-llm_mentions-controle", mentionsControle?.json ?? null)
summary.veredito.p7_controle = anatomiaMentions(mentionsControle)

const mentionsLead = await call(
  "p7_search_mentions_lead",
  "/ai_optimization/llm_mentions/search_mentions/live",
  {
    target: [{ domain: LEAD }],
    platform: "google",
    location_name: "Brazil",
    language_code: "pt",
    limit: 10,
  },
)
dump("18-llm_mentions-lead", mentionsLead?.json ?? null)
summary.veredito.p7_lead = anatomiaMentions(mentionsLead)

// ===========================================================================
// O que isto REPROVA.
// ===========================================================================
const reprovado = []
const v = summary.veredito

if (v.p6 && !v.p6.tem_volume_positivo) {
  reprovado.push(
    "p6: `ai_search_volume` veio sem nenhum valor positivo nas 110 keywords. E o padrao do `keyword_difficulty`: zero com cara de resposta. A onda 2 precisa ler 0 como ausencia, e a demanda em IA nao entra na tela como medida.",
  )
}
if (v.p6 && v.p6.itens_devolvidos === 0) {
  reprovado.push("p6: a chamada nao devolveu item nenhum. Nao ha o que ler.")
}
if (v.p5_controle && (v.p5_controle.items_count ?? 0) === 0) {
  reprovado.push(
    "p5: o CONTROLE veio vazio. `puroclean.com` tem dez citacoes em AI Overview provadas pelo relatorio de referencia, entao `item_types: ai_overview_reference` nao devolve o que promete - e o `aiOverview.count: 0` do lead nao prova nada sobre o lead.",
  )
} else if (v.p5_lead && (v.p5_lead.items_count ?? 0) === 0) {
  reprovado.push(
    "p5: controle cheio, lead vazio. O leitor funciona e o zero do lead e real - `no_ai_overview_presence` esta certo em disparar.",
  )
}
for (const [plat, s] of Object.entries(v.p9 ?? {})) {
  if (s.annotations_count === 0) {
    reprovado.push(
      `p9: ${plat} nao devolveu \`annotations\`. \`domainCited\` e deterministico POR CAUSA desse campo; sem ele, a metrica da sondagem nessa plataforma nao existe.`,
    )
  } else if (s.annotations_com_url === 0) {
    reprovado.push(
      `p9: ${plat} devolveu annotations SEM \`url\`. Titulo sem url nao responde "o dominio foi citado".`,
    )
  }
  if (s.money_spent === null) {
    reprovado.push(
      `p9: ${plat} nao devolveu \`money_spent\`. O custo real da sondagem nao pode ser somado na linha, e a spec exige isso na tela.`,
    )
  }
}
if (v.p8_backlinks_controle && v.p8_backlinks_controle.items_count === 0) {
  reprovado.push(
    "p8: o CONTROLE veio vazio. O relatorio de referencia mostra cinco links de Reddit e cinco de YouTube para `puroclean.com`; se o filtro `in` nao os encontra, a via de backlink nao mede citacao e a onda 2 precisa da via de `llm_mentions`.",
  )
}
if (v.p7_controle && (v.p7_controle.items_count ?? 0) === 0) {
  reprovado.push(
    "p7: o CONTROLE de `llm_mentions` veio vazio em US/en, onde a cobertura e maxima. O endpoint chamado ou a forma do `target` estao errados - isto NAO e conclusao sobre o Brasil.",
  )
} else if (v.p7_lead && (v.p7_lead.items_count ?? 0) === 0) {
  reprovado.push(
    "p7: controle cheio, lead brasileiro vazio. O dataset cobre a location mas nao tem mencao deste negocio - cobertura de location nao e cobertura de dado, e a US$ 0,10 a chamada isso precisa estar na tela antes de o botao existir.",
  )
}
for (const [nome, t] of Object.entries(summary.traces)) {
  if (t.http && t.http !== 200) {
    reprovado.push(`${nome}: http ${t.http} (${t.status_message ?? "-"}).`)
  }
}

summary.reprovado = reprovado
dump("19-summary-pago", summary)
console.log(JSON.stringify(summary, null, 2))
