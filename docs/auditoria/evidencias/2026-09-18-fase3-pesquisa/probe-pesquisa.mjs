// DESCARTAVEL - Task 1 do plano da Fase 3 (Pesquisa).
// Nao faz parte do app.
//
// Sete perguntas, na ordem em que podem matar o desenho.
//
//   P2. O item de SERP organica traz URL completa, ou so dominio?
//       O clustering inteiro agrupa por URL exata. Se vier so dominio, o
//       metodo de agrupamento muda antes de qualquer linha de codigo.
//   P3. O `people_also_ask` vem no mesmo payload da SERP organica, ou e item
//       separado? Com teto de 200 candidatas, isso dobra ou nao dobra a fase.
//   P7. `location_code` de cidade + `language_code` resolve o
//       `languageMismatch` que o visibility_audit carrega hoje?
//   P1. `keywords_for_keywords` devolve `monthly_searches` com 12 meses no
//       mesmo payload? E o que faz a sazonalidade ser de graca.
//   P4. Qual o teto de keywords por chamada em lote de `search_volume` e
//       `search_intent`?
//   P6. `competitors_domain` devolve o dominio do concorrente com metrica de
//       interseccao, ou so o dominio?
//   P5. `domain_intersection` aceita varios dominios de uma vez, ou e par a
//       par? Multiplica ou nao por N concorrentes.
//
// O script nao afirma nada: ele imprime o caminho do campo encontrado e grava
// o dump inteiro. Resposta sem caminho de campo nao conta.
//
// Uso:
//   node docs/auditoria/evidencias/2026-09-18-fase3-pesquisa/probe-pesquisa.mjs [OUT_DIR] [TETO_USD]
//   node ... --offline      # re-deriva o veredito dos dumps, sem pagar

import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = process.cwd()
const OUT = process.argv[2]?.startsWith("--")
  ? "docs/auditoria/evidencias/2026-09-18-fase3-pesquisa"
  : (process.argv[2] ?? "docs/auditoria/evidencias/2026-09-18-fase3-pesquisa")
const TETO = Number(
  process.argv.find((a) => /^[0-9.]+$/.test(a)) ?? "0.15",
)
const OFFLINE = process.argv.includes("--offline")

/**
 * Leo Tintas: o mesmo cliente das conversas de desenho da Fase 3. O site e de
 * Itu; e de Itu que vem o unico ativo organico real (`loja de tintas em itu`,
 * posicao 5). A cidade importa: a P7 existe justamente porque a auditoria
 * atual consulta com location de pais.
 */
const DOMINIO = "leotintas.com.br"
const SEEDS = ["loja de tintas", "tinta emborrachada", "tinta acrilica"]
const KW_LOCAL = "loja de tintas em itu"

const BRASIL = 2076
const PT = "pt"

function credenciais() {
  const env = readFileSync(join(ROOT, ".env.local"), "utf8")
  const ler = (chave) =>
    env.match(new RegExp(`^${chave}=(.*)$`, "m"))?.[1]?.trim() ?? ""
  const login = ler("DATAFORSEO_LOGIN")
  const senha = ler("DATAFORSEO_PASSWORD")
  if (!login || !senha) throw new Error("DATAFORSEO_LOGIN/PASSWORD ausentes")
  return "Basic " + Buffer.from(`${login}:${senha}`, "utf8").toString("base64")
}

let gasto = 0
const AUTH = OFFLINE ? null : credenciais()

function dump(nome, corpo) {
  writeFileSync(join(OUT, `${nome}.json`), JSON.stringify(corpo, null, 2))
}

async function chamar(nome, caminho, tarefa) {
  if (OFFLINE) return JSON.parse(readFileSync(join(OUT, `${nome}.json`), "utf8"))
  if (gasto >= TETO) throw new Error(`teto de US$ ${TETO} atingido antes de ${nome}`)

  const resposta = await fetch(`https://api.dataforseo.com/v3${caminho}`, {
    method: "POST",
    headers: {
      Authorization: AUTH,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify([tarefa]),
  })
  const corpo = await resposta.json()
  gasto += Number(corpo.cost ?? 0)
  dump(nome, corpo)
  console.log(
    `${nome}: http ${resposta.status} | cost US$ ${corpo.cost ?? 0} | acumulado US$ ${gasto.toFixed(5)}`,
  )
  const t = corpo?.tasks?.[0]
  if (t?.status_code >= 40000) {
    console.log(`  ! status ${t.status_code}: ${t.status_message}`)
  }
  return corpo
}

const resultado = (corpo) => corpo?.tasks?.[0]?.result?.[0] ?? null
const linha = (titulo) => console.log(`\n=== ${titulo}`)
const chaves = (obj) => (obj ? Object.keys(obj).join(", ") : "(nulo)")

// --- P0: localidade de Itu (gratuito) ----------------------------------------

linha("P0 location_code de Itu (gratuito)")

let localidades = null
if (OFFLINE) {
  localidades = JSON.parse(readFileSync(join(OUT, "00-locations-br.json"), "utf8"))
} else {
  const r = await fetch("https://api.dataforseo.com/v3/serp/google/locations/BR", {
    headers: { Authorization: AUTH },
  })
  localidades = await r.json()
  dump("00-locations-br", localidades)
  console.log(`http ${r.status} | cost US$ ${localidades.cost ?? 0}`)
}

const todas = localidades?.tasks?.[0]?.result ?? []
const itu = todas.filter((l) => /^Itu,/.test(l.location_name ?? ""))
console.log("total de localidades BR:", todas.length)
console.log("candidatas a Itu:", JSON.stringify(itu, null, 2))
const LOC_ITU = itu[0]?.location_code ?? null
console.log("LOC_ITU =", LOC_ITU, "| fallback pais =", BRASIL)

// --- P2, P3, P7: SERP organica com location de cidade ------------------------

linha("P2/P3/P7 SERP organica com location de cidade")

const serp = await chamar("01-serp-organic-cidade", "/serp/google/organic/live/advanced", {
  keyword: KW_LOCAL,
  location_code: LOC_ITU ?? BRASIL,
  language_code: PT,
  depth: 20,
})

const rSerp = resultado(serp)
console.log("chaves do result:", chaves(rSerp))
console.log("items_count:", rSerp?.items_count, "| se_results_count:", rSerp?.se_results_count)

const tiposItem = new Map()
for (const it of rSerp?.items ?? []) {
  tiposItem.set(it.type, (tiposItem.get(it.type) ?? 0) + 1)
}
console.log("tipos de item na SERP:", JSON.stringify(Object.fromEntries(tiposItem)))

const organicos = (rSerp?.items ?? []).filter((i) => i.type === "organic")
const primeiro = organicos[0] ?? null
console.log("\n-- P2: campos do item organico --")
console.log("chaves:", chaves(primeiro))
console.log("  url:", primeiro?.url ?? "(ausente)")
console.log("  domain:", primeiro?.domain ?? "(ausente)")
console.log("  P2 VEREDITO:", primeiro?.url ? "URL COMPLETA presente" : "SO DOMINIO — desenho muda")

const paa = (rSerp?.items ?? []).filter((i) => i.type === "people_also_ask")
console.log("\n-- P3: people_also_ask --")
console.log("blocos PAA no mesmo payload:", paa.length)
if (paa[0]) {
  console.log("chaves do bloco:", chaves(paa[0]))
  const perguntas = (paa[0].items ?? []).map((q) => q.title ?? q.question)
  console.log("perguntas:", JSON.stringify(perguntas, null, 2))
}
console.log("  P3 VEREDITO:", paa.length ? "PAA NO MESMO PAYLOAD — nao dobra o custo" : "ausente nesta SERP")

console.log("\n-- P7: location e idioma --")
console.log("  location_code pedido:", LOC_ITU ?? BRASIL)
console.log("  location_code no result:", rSerp?.location_code)
console.log("  language_code no result:", rSerp?.language_code)
const temLocalPack = tiposItem.has("local_pack")
console.log("  local_pack presente:", temLocalPack)
console.log("  P7 VEREDITO:", temLocalPack ? "cidade devolve local_pack" : "sem local_pack nesta SERP")

// --- P1: expansao com historico ----------------------------------------------

linha("P1 keywords_for_keywords traz monthly_searches?")

const kfk = await chamar(
  "02-keywords-for-keywords",
  "/keywords_data/google_ads/keywords_for_keywords/live",
  {
    keywords: SEEDS,
    location_code: LOC_ITU ?? BRASIL,
    language_code: PT,
  },
)

const itensKfk = kfk?.tasks?.[0]?.result ?? []
console.log("candidatas devolvidas:", itensKfk.length)
const amostra = itensKfk[0] ?? null
console.log("chaves do item:", chaves(amostra))
const meses = amostra?.monthly_searches ?? null
console.log("monthly_searches presente:", Boolean(meses), "| meses:", meses?.length ?? 0)
if (meses?.[0]) console.log("forma do mes:", JSON.stringify(meses[0]))
console.log(
  "  P1 VEREDITO:",
  meses?.length >= 12 ? "12 MESES NO MESMO PAYLOAD — sazonalidade de graca" : "historico insuficiente",
)

// --- P4: teto de lote ---------------------------------------------------------

linha("P4 teto de keywords por chamada em lote")

const loteKw = itensKfk
  .slice(0, 20)
  .map((i) => i.keyword)
  .filter(Boolean)
console.log("mandando", loteKw.length, "keywords em search_volume")

const vol = await chamar(
  "03-search-volume-lote",
  "/keywords_data/google_ads/search_volume/live",
  { keywords: loteKw, location_code: LOC_ITU ?? BRASIL, language_code: PT },
)
console.log("devolvidas:", (vol?.tasks?.[0]?.result ?? []).length)

const intent = await chamar(
  "04-search-intent-lote",
  "/dataforseo_labs/google/search_intent/live",
  { keywords: loteKw.slice(0, 20), language_code: PT },
)
const rIntent = resultado(intent)
console.log("search_intent chaves:", chaves(rIntent))
console.log("search_intent itens:", (rIntent?.items ?? []).length)
if (rIntent?.items?.[0]) console.log("forma:", JSON.stringify(rIntent.items[0]))

// --- P6: concorrentes organicos ----------------------------------------------

linha("P6 competitors_domain")

const comp = await chamar(
  "05-competitors-domain",
  "/dataforseo_labs/google/competitors_domain/live",
  {
    target: DOMINIO,
    location_code: LOC_ITU ?? BRASIL,
    language_code: PT,
    limit: 10,
  },
)
const rComp = resultado(comp)
console.log("chaves do result:", chaves(rComp))
const concorrentes = rComp?.items ?? []
console.log("concorrentes:", concorrentes.length)
if (concorrentes[0]) {
  console.log("chaves do item:", chaves(concorrentes[0]))
  console.log("amostra:", JSON.stringify(concorrentes[0], null, 2).slice(0, 1200))
}
const DOMS = concorrentes
  .map((c) => c.domain)
  .filter((d) => d && d !== DOMINIO)
  .slice(0, 2)
console.log("dominios para P5:", DOMS)

// --- P5: keyword gap ----------------------------------------------------------

linha("P5 domain_intersection aceita quantos dominios?")

if (DOMS.length) {
  const inter = await chamar(
    "06-domain-intersection",
    "/dataforseo_labs/google/domain_intersection/live",
    {
      target1: DOMINIO,
      target2: DOMS[0],
      location_code: LOC_ITU ?? BRASIL,
      language_code: PT,
      intersections: false, // queremos o que target2 tem e target1 nao
      limit: 20,
    },
  )
  const rInter = resultado(inter)
  console.log("chaves do result:", chaves(rInter))
  console.log("itens:", (rInter?.items ?? []).length)
  if (rInter?.items?.[0]) {
    console.log("chaves do item:", chaves(rInter.items[0]))
  }
  console.log("  P5 VEREDITO: a chamada e PAR A PAR (target1/target2) — multiplica por N concorrentes")
} else {
  console.log("sem concorrente devolvido pela P6; P5 nao rodou")
}

// --- fecho --------------------------------------------------------------------

linha("FECHO")
console.log(`gasto total: US$ ${gasto.toFixed(5)} (teto US$ ${TETO})`)
console.log("dumps em:", OUT)
