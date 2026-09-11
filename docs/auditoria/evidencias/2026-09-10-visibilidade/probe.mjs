// DESCARTAVEL - Onda 0 de visibilidade. Nao faz parte do app.
// Salva payload cru de ranked_keywords + bulk_keyword_difficulty + search_intent.
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = "C:/Users/Eduardo Zamai/Documents/suite"
const TARGET = process.argv[2] ?? "buscaorganica.com.br"
const OUT = process.argv[3] ?? "."

function env() {
  const raw = readFileSync(join(ROOT, ".env.local"), "utf8")
  const out = {}
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if (v.length > 1 && (v[0] === '"' || v[0] === "'") && v[v.length - 1] === v[0]) {
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
}

function dump(name, payload) {
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(payload, null, 2), "utf8")
}

function task(r) {
  return r.json?.tasks?.[0] ?? null
}

const summary = { target: TARGET, at: new Date().toISOString(), costs: {} }

// --- 0. conta (gratuito) ---------------------------------------------------
const user = await call("/appendix/user_data", null, "GET")
dump("00-user_data", user.json)
const userResult = task(user)?.result?.[0] ?? null
summary.balance = userResult?.money?.balance ?? null
const labsPrices = userResult?.price?.dataforseo_labs ?? null
summary.labs_prices_raw_keys = labsPrices ? Object.keys(labsPrices).slice(0, 40) : null

// --- 1. ranked_keywords ----------------------------------------------------
const rk = await call("/dataforseo_labs/google/ranked_keywords/live", {
  target: TARGET,
  location_name: "Brazil",
  language_code: "pt",
  limit: 1000,
  item_types: ["organic"],
  order_by: ["ranked_serp_element.serp_item.etv,desc"],
})
dump("01-ranked_keywords", rk.json)
const rkTask = task(rk)
summary.costs.ranked_keywords = rkTask?.cost ?? null
summary.rk_status = `${rkTask?.status_code} ${rkTask?.status_message}`
const result = rkTask?.result?.[0] ?? null
const items = result?.items ?? []
summary.total_count = result?.total_count ?? null
summary.items_count = result?.items_count ?? items.length
summary.metrics_organic = result?.metrics?.organic ?? null

// --- 2. anatomia do que veio ----------------------------------------------
const kws = []
const anat = {
  kd_zero: 0,
  kd_null: 0,
  kd_absent: 0,
  kd_number: 0,
  kd_float: 0,
  intent_present: 0,
  intent_absent: 0,
  foreign_intent_present: 0,
  url_absent: 0,
  relative_absent: 0,
  subdomain_values: {},
  host_differs_from_target: 0,
  sample_urls: [],
}
for (const it of items) {
  const props = it?.keyword_data?.keyword_properties
  const si = it?.keyword_data?.search_intent_info
  const serp = it?.ranked_serp_element?.serp_item
  const kw = it?.keyword_data?.keyword
  if (kw) kws.push(kw)

  if (!props || !("keyword_difficulty" in props)) anat.kd_absent++
  else if (props.keyword_difficulty === null) anat.kd_null++
  else if (props.keyword_difficulty === 0) anat.kd_zero++
  else {
    anat.kd_number++
    if (!Number.isInteger(props.keyword_difficulty)) anat.kd_float++
  }

  if (si?.main_intent) anat.intent_present++
  else anat.intent_absent++
  if (Array.isArray(si?.foreign_intent) && si.foreign_intent.length) {
    anat.foreign_intent_present++
  }

  if (!serp?.url) anat.url_absent++
  if (!serp?.relative_url) anat.relative_absent++
  const sd = serp?.subdomain ?? "(null)"
  anat.subdomain_values[sd] = (anat.subdomain_values[sd] ?? 0) + 1
  try {
    const h = new URL(serp.url).hostname.replace(/^www\./, "")
    if (h !== TARGET) anat.host_differs_from_target++
  } catch {}
  if (anat.sample_urls.length < 12) {
    anat.sample_urls.push({
      keyword: kw,
      url: serp?.url ?? null,
      relative_url: serp?.relative_url ?? null,
      domain: serp?.domain ?? null,
      subdomain: serp?.subdomain ?? null,
    })
  }
}
summary.anatomia = anat
const first = items[0] ?? null
summary.keys_keyword_data = first ? Object.keys(first.keyword_data ?? {}) : []
summary.keys_keyword_info = first
  ? Object.keys(first.keyword_data?.keyword_info ?? {})
  : []
summary.keys_keyword_properties = first
  ? Object.keys(first.keyword_data?.keyword_properties ?? {})
  : []
summary.keys_search_intent = first
  ? Object.keys(first.keyword_data?.search_intent_info ?? {})
  : []
summary.keys_serp_item = first
  ? Object.keys(first.ranked_serp_element?.serp_item ?? {})
  : []
dump("06-item-amostra", first)

const unique = [...new Set(kws)].slice(0, 1000)
summary.keywords_enviadas = unique.length

// --- 3. bulk_keyword_difficulty -------------------------------------------
const bkd = await call("/dataforseo_labs/google/bulk_keyword_difficulty/live", {
  keywords: unique,
  location_name: "Brazil",
  language_code: "pt",
})
dump("02-bulk_keyword_difficulty", bkd.json)
const bkdTask = task(bkd)
summary.costs.bulk_keyword_difficulty = bkdTask?.cost ?? null
summary.bkd_status = `${bkdTask?.status_code} ${bkdTask?.status_message}`
const bkdMap = new Map()
for (const r of bkdTask?.result?.[0]?.items ?? []) {
  bkdMap.set(r.keyword, r.keyword_difficulty)
}

// --- 4. search_intent ------------------------------------------------------
const sint = await call("/dataforseo_labs/google/search_intent/live", {
  keywords: unique,
  language_code: "pt",
})
dump("03-search_intent", sint.json)
const siTask = task(sint)
summary.costs.search_intent = siTask?.cost ?? null
summary.si_status = `${siTask?.status_code} ${siTask?.status_message}`
const siMap = new Map()
for (const r of siTask?.result?.[0]?.items ?? []) siMap.set(r.keyword, r)

// --- 5. comparacao ---------------------------------------------------------
const compare = []
for (const it of items) {
  const kw = it?.keyword_data?.keyword
  if (!kw) continue
  const d = siMap.get(kw)
  compare.push({
    keyword: kw,
    volume: it?.keyword_data?.keyword_info?.search_volume ?? null,
    competition_level: it?.keyword_data?.keyword_info?.competition_level ?? null,
    cpc: it?.keyword_data?.keyword_info?.cpc ?? null,
    kd_ranked: it?.keyword_data?.keyword_properties?.keyword_difficulty ?? null,
    kd_bulk: bkdMap.has(kw) ? bkdMap.get(kw) : "(ausente)",
    intent_ranked: it?.keyword_data?.search_intent_info?.main_intent ?? null,
    intent_dedicated: d?.keyword_intent?.label ?? null,
    intent_prob: d?.keyword_intent?.probability ?? null,
    secondary: (d?.secondary_keyword_intents ?? []).map(
      (s) => `${s.label}:${s.probability}`,
    ),
  })
}
dump("04-comparacao", compare)

const kdDisagree = compare.filter(
  (r) => typeof r.kd_bulk === "number" && r.kd_bulk !== r.kd_ranked,
)
const intentDisagree = compare.filter(
  (r) => r.intent_dedicated && r.intent_ranked && r.intent_dedicated !== r.intent_ranked,
)
const probs = compare
  .map((r) => r.intent_prob)
  .filter((v) => typeof v === "number")
  .sort((a, b) => a - b)

summary.veredito = {
  kd_ranked_zero: anat.kd_zero,
  kd_ranked_null: anat.kd_null,
  kd_bulk_zero: compare.filter((r) => r.kd_bulk === 0).length,
  kd_bulk_null: compare.filter((r) => r.kd_bulk === null).length,
  kd_bulk_ausente: compare.filter((r) => r.kd_bulk === "(ausente)").length,
  kd_divergentes: kdDisagree.length,
  kd_exemplos: kdDisagree
    .slice(0, 12)
    .map(
      (r) =>
        `${r.keyword} | vol ${r.volume} | ranked ${r.kd_ranked} -> bulk ${r.kd_bulk} | ads ${r.competition_level}`,
    ),
  intent_divergentes: intentDisagree.length,
  intent_exemplos: intentDisagree
    .slice(0, 12)
    .map(
      (r) =>
        `${r.keyword} | ranked ${r.intent_ranked} -> dedicado ${r.intent_dedicated} (p=${r.intent_prob})`,
    ),
  intent_prob_min: probs[0] ?? null,
  intent_prob_mediana: probs[Math.floor(probs.length / 2)] ?? null,
  intent_prob_max: probs[probs.length - 1] ?? null,
  intent_prob_abaixo_060: probs.filter((p) => p < 0.6).length,
  intent_prob_total: probs.length,
}
summary.costs.total =
  (summary.costs.ranked_keywords ?? 0) +
  (summary.costs.bulk_keyword_difficulty ?? 0) +
  (summary.costs.search_intent ?? 0)

dump("05-summary", summary)
console.log(JSON.stringify(summary, null, 2))
