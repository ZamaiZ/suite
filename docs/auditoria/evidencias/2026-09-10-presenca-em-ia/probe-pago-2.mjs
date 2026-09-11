// DESCARTAVEL - Onda 0 da Presenca em IA, as CORRECOES da primeira rodada paga.
//
// `probe-pago.mjs` gastou US$ 0,34 e trouxe tres respostas e dois erros MEUS.
// Este script re-mede so os dois, e o `probe-pago.mjs` ja foi corrigido para
// que uma rodada limpa dele produza isto direto. Precedente: a onda 0 da
// visibilidade tambem terminou em dois scripts, com o segundo respondendo o que
// o primeiro deixou em aberto.
//
// ERRO 1 - `annotations` no caminho errado.
//   Li `items[].annotations[]`, que e o que a documentacao descreve. O campo
//   mora em `items[].sections[].annotations[]`. A leitura errada devolveu
//   `annotations_count: 0` numa resposta que tinha TRES, todas apontando para o
//   dominio do lead - e o veredito que sairia dali ("a plataforma nao devolve
//   annotations") e o mais caro possivel, porque mata a metrica deterministica
//   da sondagem inteira.
//   -> aqui: re-roda as tres plataformas que a primeira rodada perdeu por
//      `40501 Invalid Field`, cada uma sem o campo que ELA recusa.
//
// ERRO 2 - filtro de backlinks sem `www.`.
//   Mandei `["reddit.com","youtube.com",...]` em igualdade exata e voltou ZERO
//   nos dois alvos, incluindo o controle que tem dez links provados. Na mesma
//   medicao, `llm_mentions` devolveu `domain: "www.reddit.com"`. Concluir
//   "nao ha citacao" dali seria falso negativo nosso - a mesma classe de erro do
//   operador `site:` que a Task 0 de citacoes reprovou em 2026-09-09.
//   -> aqui: tres formas do mesmo filtro, contra o CONTROLE, para descobrir
//      qual delas o indice honra antes de declarar a via reprovada.
//
// Uso:
//   node docs/auditoria/evidencias/2026-09-10-presenca-em-ia/probe-pago-2.mjs [OUT_DIR] [TETO_USD]

import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = "C:/Users/Eduardo Zamai/Documents/suite"
const OUT = process.argv[2] ?? "."
const TETO = Number(process.argv[3] ?? "0.50")

const CONTROLE = "puroclean.com"

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
const auth =
  "Basic " +
  Buffer.from(`${e.DATAFORSEO_LOGIN}:${e.DATAFORSEO_PASSWORD}`, "utf8").toString(
    "base64",
  )

/**
 * Quais plataformas rodar, e o merge com o que ja foi medido.
 *
 * O gemini recusou DOIS campos, um de cada vez, e so a segunda rodada
 * descobriu o segundo. Sem o filtro abaixo, corrigir uma plataforma obrigaria a
 * re-pagar as outras duas e os tres backlinks - US$ 0,09 para re-medir o que ja
 * estava medido. O merge preserva o veredito anterior em vez de sobrescreve-lo
 * com um resumo parcial, que e como evidencia some sem ninguem notar.
 */
const SO = (process.argv[4] ?? "").trim()
const ALVOS = SO ? SO.split(",").map((s) => s.trim()).filter(Boolean) : null
const roda = (nome) => ALVOS === null || ALVOS.includes(nome)

let anterior = null
try {
  anterior = JSON.parse(readFileSync(join(OUT, "22-summary-correcoes.json"), "utf8"))
} catch {
  anterior = null
}

const summary = {
  at: new Date().toISOString(),
  teto_usd: TETO,
  rodou: ALVOS ?? "tudo",
  traces: anterior?.traces ?? {},
  gasto: 0,
  gasto_acumulado_todas_rodadas: Number(
    ((anterior?.gasto_acumulado_todas_rodadas ?? anterior?.gasto ?? 0)).toFixed(6),
  ),
  veredito: anterior?.veredito ?? {},
}

function dump(name, payload) {
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(payload, null, 2), "utf8")
}
function task(r) {
  return r?.json?.tasks?.[0] ?? null
}

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
// ERRO 1 - as tres plataformas que a primeira rodada perdeu, cada uma sem o
// campo que ELA recusa, e com `annotations` lidas no caminho certo.
// ===========================================================================
function lerAnnotations(items) {
  return items.flatMap((i) => (i?.sections ?? []).flatMap((s) => s?.annotations ?? []))
}

const PROVEDORES = [
  { plataforma: "chat_gpt", model_name: "gpt-5-mini", omitir: ["max_output_tokens"] },
  {
    plataforma: "gemini",
    // Recusa os DOIS campos de localizacao, um de cada vez: tirar
    // `web_search_country_iso_code` so faz ele reclamar de `web_search_city`.
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

const sondagem = summary.veredito.p9b ?? {}
for (const p of PROVEDORES) {
  if (!roda(p.plataforma)) continue
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
    `p9b_llm_${p.plataforma}`,
    `/ai_optimization/${p.plataforma}/llm_responses/live`,
    corpo,
  )
  dump(`20-llm_responses-${p.plataforma}`, r?.json ?? null)
  const res = task(r)?.result?.[0] ?? null
  const items = res?.items ?? []
  const ann = lerAnnotations(items)
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
    chaves_section: items[0]?.sections?.[0] ? Object.keys(items[0].sections[0]) : [],
    annotations_count: ann.length,
    annotations_com_url: ann.filter((a) => a?.url).length,
    // A spec queria usar `start_index`/`end_index` para posicao. Em `claude`
    // os dois vieram `null`. Se vierem null em todas, a posicao tem de sair da
    // ordem de ocorrencia no texto, e a tela precisa dizer isso.
    annotations_com_indice: ann.filter((a) => typeof a?.start_index === "number").length,
    chaves_annotation: ann[0] ? Object.keys(ann[0]) : [],
    dominio_citado: ann.some((a) =>
      typeof a?.url === "string" ? a.url.includes("buscaorganica") : false,
    ),
    marca_no_texto: /busca\s*org[aâ]nica/i.test(texto),
    amostra_annotations: ann.slice(0, 4),
  }
}
summary.veredito.p9b = sondagem

// Re-leitura do `claude` da primeira rodada, sem pagar de novo: o payload cru
// ja esta em disco, e o defeito era do leitor, nao da chamada.
try {
  const antigo = JSON.parse(
    readFileSync(join(OUT, "14-llm_responses-claude.json"), "utf8"),
  )
  const res = antigo?.tasks?.[0]?.result?.[0] ?? null
  const ann = lerAnnotations(res?.items ?? [])
  summary.veredito.p9b_claude_relido = {
    money_spent: res?.money_spent ?? null,
    input_tokens: res?.input_tokens ?? null,
    annotations_count: ann.length,
    annotations_com_url: ann.filter((a) => a?.url).length,
    annotations_com_indice: ann.filter((a) => typeof a?.start_index === "number").length,
    dominio_citado: ann.some((a) =>
      typeof a?.url === "string" ? a.url.includes("buscaorganica") : false,
    ),
    nota: "relido do payload de 14-llm_responses-claude.json. Zero chamada nova.",
  }
} catch {
  summary.veredito.p9b_claude_relido = null
}

// ===========================================================================
// ERRO 2 - qual forma do filtro o indice de backlinks honra?
//
// Tres tentativas contra o CONTROLE, que tem dez links provados. Se as tres
// derem zero, a via de backlink esta reprovada para citacao - e ai o numero
// existe para sustentar a afirmacao, em vez de ela sair de uma suposicao.
// ===========================================================================
const TENTATIVAS = [
  {
    nome: "in_com_www",
    filters: [
      [
        "domain_from",
        "in",
        ["reddit.com", "www.reddit.com", "youtube.com", "www.youtube.com",
         "wikipedia.org", "en.wikipedia.org", "pt.wikipedia.org"],
      ],
    ],
  },
  { nome: "like_reddit", filters: [["domain_from", "like", "%reddit.com"]] },
  { nome: "sem_filtro", filters: null },
]

const backlinks = summary.veredito.p8b ?? {}
for (const t of TENTATIVAS) {
  if (!roda("backlinks")) continue
  const corpo = {
    target: CONTROLE,
    mode: "one_per_domain",
    limit: t.filters ? 100 : 20,
    backlinks_status_type: "live",
  }
  if (t.filters) corpo.filters = t.filters

  const r = await call(`p8b_${t.nome}`, "/backlinks/backlinks/live", corpo)
  dump(`21-backlinks-${t.nome}`, r?.json ?? null)
  const result = task(r)?.result?.[0] ?? null
  const items = result?.items ?? []
  backlinks[t.nome] = {
    total_count: result?.total_count ?? null,
    items_count: items.length,
    // `sem_filtro` existe para UMA coisa: mostrar a forma real de
    // `domain_from` no indice. Sem ela, "zero" nao distingue filtro errado de
    // ausencia de link.
    dominios: [...new Set(items.map((i) => i?.domain_from).filter(Boolean))].slice(0, 20),
  }
}
summary.veredito.p8b = backlinks

// ===========================================================================
const reprovado = []
for (const [plat, s] of Object.entries(sondagem)) {
  if (s.annotations_count === 0 && s.money_spent !== null) {
    reprovado.push(
      `p9b: ${plat} respondeu mas nao trouxe annotations. \`domainCited\` nao existe nessa plataforma.`,
    )
  }
  if (s.money_spent === null) {
    reprovado.push(`p9b: ${plat} nao respondeu (${summary.traces[`p9b_llm_${plat}`]?.status_message ?? "-"}).`)
  }
}
const todasComIndice = Object.values(sondagem)
  .concat(summary.veredito.p9b_claude_relido ? [summary.veredito.p9b_claude_relido] : [])
  .filter((s) => (s.annotations_count ?? 0) > 0)
if (todasComIndice.length > 0 && todasComIndice.every((s) => s.annotations_com_indice === 0)) {
  reprovado.push(
    "p9b: NENHUMA plataforma preencheu `start_index`/`end_index`. A posicao da marca nao pode sair do indice do caractere - tem de sair da ordem de ocorrencia entre as marcas detectadas, que e o que a spec ja dizia, e a tela precisa dizer que nao e posicao em lista numerada.",
  )
}
if (Object.values(backlinks).every((b) => (b.items_count ?? 0) === 0)) {
  reprovado.push(
    "p8b: as tres formas do filtro deram zero contra o controle. A via de backlink NAO mede citacao em Reddit/YouTube/Wikipedia, e a onda 2 de citacoes precisa da via de `llm_mentions`.",
  )
}

summary.gasto_acumulado_todas_rodadas = Number(
  (summary.gasto_acumulado_todas_rodadas + summary.gasto).toFixed(6),
)
summary.reprovado = reprovado
dump("22-summary-correcoes", summary)
console.log(JSON.stringify(summary, null, 2))
