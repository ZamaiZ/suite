// DESCARTAVEL - Onda 0 da Presenca em IA. Nao faz parte do app.
//
// As QUATRO chamadas GRATUITAS da onda 0. Nenhuma consome credito, e por isso
// esta metade roda antes de qualquer decisao de custo. Ela responde:
//
//   1. A conta tem a secao `ai_optimization` liberada, e a que preco por
//      endpoint?  -> se NAO, as ondas 2 e 3 nao existem sem decisao comercial,
//      e a onda 1 segue de pe, intacta.
//   2. Brasil + `pt` estao na cobertura de `llm_mentions` para `platform:
//      google`?  -> decide se a via de citacoes e de concorrencia em IA vale
//      para lead brasileiro.
//   3. Brasil + `pt` estao na cobertura de `ai_keyword_data`?  -> decide se a
//      demanda em IA existe.
//   4. Que modelos cada plataforma expoe em `llm_responses`?  -> decide qual
//      modelo a sondagem usa, e fixa o nome na serie temporal.
//
// Os caminhos abaixo saem da documentacao e NUNCA foram executados. Por isso o
// script guarda o HTTP e o `status_code` de cada chamada: caminho errado
// devolve 404, e 404 nao e a mesma coisa que "a conta nao tem a secao". Chamar
// as duas de "vazio" seria o defeito que a onda 0 da visibilidade veio corrigir.
//
// Uso:
//   node docs/auditoria/evidencias/2026-09-10-presenca-em-ia/probe.mjs [OUT_DIR]

import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = "C:/Users/Eduardo Zamai/Documents/suite"
const OUT = process.argv[2] ?? "."

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
  Buffer.from(
    `${e.DATAFORSEO_LOGIN}:${e.DATAFORSEO_PASSWORD}`,
    "utf8",
  ).toString("base64")

async function call(path, body, method = "POST") {
  try {
    const res = await fetch(`https://api.dataforseo.com/v3${path}`, {
      method,
      headers: {
        Authorization: auth,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: body ? JSON.stringify([body]) : undefined,
    })
    const json = await res.json()
    return { http: res.status, json }
  } catch (err) {
    return { http: null, json: null, error: String(err) }
  }
}

function dump(name, payload) {
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(payload, null, 2), "utf8")
}

function task(r) {
  return r?.json?.tasks?.[0] ?? null
}

/** HTTP + status da tarefa numa linha so. 404 nao e "vazio". */
function trace(r) {
  const t = task(r)
  return {
    http: r?.http ?? null,
    error: r?.error ?? null,
    status_code: t?.status_code ?? r?.json?.status_code ?? null,
    status_message: t?.status_message ?? r?.json?.status_message ?? null,
    cost: t?.cost ?? r?.json?.cost ?? null,
  }
}

const summary = {
  at: new Date().toISOString(),
  gratuito: true,
  traces: {},
  veredito: {},
}

// ---------------------------------------------------------------------------
// Pergunta 1 - a conta tem `ai_optimization`, e a que preco?
//
// `price` e arvore aninhada de profundidade variavel, e a folha de cada funcao
// e uma LISTA de {cost_type, cost} sob priority_low/normal/high. O achatador
// abaixo e o mesmo de `lib/dataforseo/usage.ts` reescrito em JS puro, de
// proposito: a evidencia precisa sair com os mesmos caminhos que a calculadora
// da pagina de Ferramentas vai casar. Duas leituras diferentes da mesma tabela
// foi como `usage.ts` ja mostrou "-" para toda operacao uma vez.
// ---------------------------------------------------------------------------
const PRICE_PRIORITY = "priority_normal"

function flattenPrices(value, api, trail, out) {
  if (Array.isArray(value)) {
    for (const item of value) flattenPrices(item, api, trail, out)
    return
  }
  if (!value || typeof value !== "object") return
  const cost =
    typeof value.cost === "number" && Number.isFinite(value.cost)
      ? value.cost
      : null
  if (cost !== null) {
    const last = trail[trail.length - 1]
    const priority = typeof last === "string" && last.startsWith("priority_")
    if (priority && last !== PRICE_PRIORITY) return
    out.push({
      api,
      fn: (priority ? trail.slice(0, -1) : trail).join("/") || api,
      cost_type: value.cost_type ?? null,
      cost,
    })
    return
  }
  for (const [key, child] of Object.entries(value)) {
    flattenPrices(child, api, [...trail, key], out)
  }
}

const user = await call("/appendix/user_data", null, "GET")
summary.traces.user_data = trace(user)

const userResult = task(user)?.result?.[0] ?? null
summary.balance = userResult?.money?.balance ?? null
const priceTree = userResult?.price ?? null
summary.secoes_na_conta = priceTree ? Object.keys(priceTree).sort() : null

// O cru de `user_data` sai em 443 KB por causa de `rates` e `money.limits`,
// que sao arvores de zero por endpoint e nao respondem nenhuma das quatro
// perguntas. `login` tambem sai: e o e-mail da conta, e evidencia versionada
// nao precisa carregar credencial de lugar nenhum.
//
// O que fica e o que orca as ondas 2 e 3 - e a arvore de preco do
// `ai_optimization` vai inteira em `01`, cru e achatado.
dump("00-user_data", {
  _nota:
    "cru cortado: `login`, `rates` e `money.limits` removidos. " +
    "A arvore de preco do ai_optimization esta em 01-precos-ai-optimization.json. " +
    "Regenere com probe.mjs.",
  timezone: userResult?.timezone ?? null,
  money: {
    total: userResult?.money?.total ?? null,
    balance: userResult?.money?.balance ?? null,
  },
  // Assinatura e coisa diferente de preco: a tabela diz quanto custa, estes
  // dizem se pode chamar. Vencida, viraria erro de permissao com cara de
  // resultado vazio.
  backlinks_subscription_expiry_date:
    userResult?.backlinks_subscription_expiry_date ?? null,
  llm_mentions_subscription_expiry_date:
    userResult?.llm_mentions_subscription_expiry_date ?? null,
  secoes_na_conta: summary.secoes_na_conta,
  // A baliza de comparacao, crua: o Labs ja fechou na virgula na onda 0 da
  // visibilidade, e e contra ele que o preco do ai_optimization se lê.
  price_dataforseo_labs: priceTree?.dataforseo_labs ?? null,
})

summary.assinaturas = {
  backlinks: userResult?.backlinks_subscription_expiry_date ?? null,
  llm_mentions: userResult?.llm_mentions_subscription_expiry_date ?? null,
}

const aiPrices = []
if (priceTree?.ai_optimization) {
  flattenPrices(priceTree.ai_optimization, "ai_optimization", [], aiPrices)
}
dump("01-precos-ai-optimization", {
  raw: priceTree?.ai_optimization ?? null,
  flat: aiPrices,
})

summary.veredito.p1_ai_optimization_liberada =
  priceTree === null
    ? "(indeterminado - user_data nao respondeu)"
    : aiPrices.length > 0
// A secao pode existir na arvore e vir sem folha de preco. As duas coisas
// significam "nao da para orcar", e precisam aparecer separadas.
summary.veredito.p1_secao_presente_sem_preco =
  Boolean(priceTree?.ai_optimization) && aiPrices.length === 0
summary.veredito.p1_precos = aiPrices

// Baliza de comparacao: o Labs, que a onda 0 da visibilidade ja fechou na
// virgula (0,012 + 110 x 0,00012 = 0,0252). Serve para dizer se o preco do
// `ai_optimization` e da mesma ordem ou de outra.
const labsPrices = []
if (priceTree?.dataforseo_labs) {
  flattenPrices(priceTree.dataforseo_labs, "dataforseo_labs", [], labsPrices)
}
summary.veredito.p1_baliza_labs = labsPrices.filter((p) =>
  p.fn.includes("ranked_keywords"),
)

// ---------------------------------------------------------------------------
// Perguntas 2 e 3 - Brasil e `pt` estao na cobertura?
//
// A FORMA dessas duas respostas nunca foi observada: a documentacao mostra tres
// locations de exemplo e nao diz se o agrupamento e por plataforma. O leitor
// abaixo e deliberadamente cego a forma - varre a arvore inteira atras de
// qualquer objeto com `location_name`, e reporta o caminho onde achou. Supor a
// forma e o erro que `mapRankedKeywordsLiveResult` carregou por seis meses.
// ---------------------------------------------------------------------------
function collectLocations(value, trail, out) {
  if (Array.isArray(value)) {
    for (const item of value) collectLocations(item, trail, out)
    return
  }
  if (!value || typeof value !== "object") return
  if (typeof value.location_name === "string") {
    out.push({ trail: trail.join("."), row: value })
    return
  }
  for (const [key, child] of Object.entries(value)) {
    collectLocations(child, [...trail, key], out)
  }
}

function languagesOf(row) {
  const raw = row.available_languages ?? row.languages ?? null
  if (!Array.isArray(raw)) return null
  return raw.map((l) =>
    typeof l === "string" ? l : (l?.language_code ?? l?.language_name ?? l),
  )
}

function brasil(payload) {
  const found = []
  collectLocations(payload, [], found)
  const br = found.filter(
    (f) =>
      /brazil|brasil/i.test(f.row.location_name) || f.row.location_code === 2076,
  )
  return {
    locations_total: found.length,
    caminhos: [...new Set(found.map((f) => f.trail))],
    brasil_encontrado: br.length > 0,
    brasil: br.map((f) => ({
      trail: f.trail,
      location_code: f.row.location_code ?? null,
      location_name: f.row.location_name,
      languages: languagesOf(f.row),
    })),
    // `pt` presente e a pergunta que decide. Ausente com Brasil presente e um
    // veredito diferente de Brasil ausente, e os dois precisam de nome proprio.
    pt_no_brasil: br.some((f) => (languagesOf(f.row) ?? []).includes("pt")),
    amostra_sem_brasil:
      br.length === 0 ? found.slice(0, 5).map((f) => f.row) : null,
  }
}

const mentionsLoc = await call(
  "/ai_optimization/llm_mentions/locations_and_languages",
  null,
  "GET",
)
dump("02-llm_mentions-locations", mentionsLoc.json)
summary.traces.llm_mentions_locations = trace(mentionsLoc)
summary.veredito.p2_llm_mentions = brasil(task(mentionsLoc)?.result ?? null)

const kwLoc = await call(
  "/ai_optimization/ai_keyword_data/locations_and_languages",
  null,
  "GET",
)
dump("03-ai_keyword_data-locations", kwLoc.json)
summary.traces.ai_keyword_data_locations = trace(kwLoc)
summary.veredito.p3_ai_keyword_data = brasil(task(kwLoc)?.result ?? null)

// ---------------------------------------------------------------------------
// Pergunta 4 - que modelos cada plataforma expoe?
//
// O nome do modelo entra em `GeoPromptRun.modelName` e fica gravado por
// execucao. Trocar de modelo entre coletas e a mesma armadilha que
// `lead_geo_reviews.prompt_set` existe para evitar: metodo divergente na mesma
// serie temporal. Esta chamada fixa a escolha com o que a conta de fato oferece.
// ---------------------------------------------------------------------------
const PLATAFORMAS = ["chat_gpt", "claude", "gemini", "perplexity"]
const modelos = {}
for (const p of PLATAFORMAS) {
  const r = await call(`/ai_optimization/${p}/llm_responses/models`, null, "GET")
  dump(`04-models-${p}`, r.json)
  summary.traces[`models_${p}`] = trace(r)
  const items = task(r)?.result?.[0]?.items ?? task(r)?.result ?? null
  modelos[p] = Array.isArray(items)
    ? items.map((i) =>
        typeof i === "string" ? i : (i?.model_name ?? i?.name ?? i),
      )
    : null
}
summary.veredito.p4_modelos = modelos

// ---------------------------------------------------------------------------
// O que isto REPROVA. A onda 0 da visibilidade so valeu porque reprovou tres
// campos; um resumo que so lista o que passou nao e evidencia, e sim propaganda.
// ---------------------------------------------------------------------------
const reprovado = []
if (summary.veredito.p1_ai_optimization_liberada !== true) {
  reprovado.push(
    "p1: a conta nao mostra preco para `ai_optimization`. As ondas 2 e 3 precisam de decisao comercial antes de existir. A onda 1 segue intacta.",
  )
}
if (summary.veredito.p1_secao_presente_sem_preco) {
  reprovado.push(
    "p1: a secao `ai_optimization` existe na arvore mas sem folha de preco - nao da para orcar, e a calculadora de Ferramentas vai mostrar '-'.",
  )
}
if (!summary.veredito.p2_llm_mentions.brasil_encontrado) {
  reprovado.push(
    "p2: Brasil ausente da cobertura de `llm_mentions`. Citacoes e concorrencia em IA por essa via estao reprovadas para lead brasileiro.",
  )
} else if (!summary.veredito.p2_llm_mentions.pt_no_brasil) {
  reprovado.push(
    "p2: Brasil presente em `llm_mentions`, mas sem `pt` entre os idiomas. Medir em `en` para lead brasileiro produziria numero sem significado.",
  )
}
if (!summary.veredito.p3_ai_keyword_data.brasil_encontrado) {
  reprovado.push(
    "p3: Brasil ausente da cobertura de `ai_keyword_data`. A demanda em IA nao existe para o Brasil.",
  )
} else if (!summary.veredito.p3_ai_keyword_data.pt_no_brasil) {
  reprovado.push("p3: Brasil presente em `ai_keyword_data`, mas sem `pt`.")
}
for (const [p, list] of Object.entries(modelos)) {
  const t = summary.traces[`models_${p}`]
  if (list === null || list.length === 0) {
    reprovado.push(
      `p4: ${p} nao devolveu lista de modelos (http ${t.http} / status ${t.status_code}). A sondagem nao pode fixar modelo nessa plataforma.`,
    )
  }
}
for (const [nome, t] of Object.entries(summary.traces)) {
  if (t.http === 404) {
    reprovado.push(
      `caminho: ${nome} devolveu 404 - o endpoint da documentacao nao existe nesse path. Isto NAO e "a conta nao tem a secao".`,
    )
  }
}
summary.reprovado = reprovado
summary.custo_total = Object.values(summary.traces).reduce(
  (acc, t) => acc + (typeof t.cost === "number" ? t.cost : 0),
  0,
)

dump("05-summary", summary)
console.log(JSON.stringify(summary, null, 2))
