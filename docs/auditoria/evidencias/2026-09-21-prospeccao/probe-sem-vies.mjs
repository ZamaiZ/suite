// DESCARTAVEL - correcao metodologica da sondagem 1.
//
// A sondagem 1 pediu `order_by: rating.votes_count,desc` e concluiu que 90%
// das empresas tem site. Isso e vies de selecao puro: ela leu os 100
// restaurantes MAIS AVALIADOS de Guarulhos, que sao justamente os que tem
// estrutura. O agregado da mesma area contava 7.033 saloes de beleza e apenas
// 432 `websites_count` -- 6%, nao 90%.
//
// A diferenca decide o desenho: se a maioria nao tem site, o CNPJ do rodape
// cobre pouco, e a etapa `site` deixa de ser o resolvedor principal.
//
// O que esta sondagem responde:
//
//   P5. Sem `order_by`, qual o preenchimento real de site e telefone?
//   P6. O que `websites_count` do agregado significa de fato?
//   P7. O comportamento se repete em outro segmento e outra cidade, ou e
//       peculiaridade de restaurante em regiao metropolitana?
//   P8. `is_claimed=false` como filtro devolve volume utilizavel?
//
// Uso: node docs/auditoria/evidencias/2026-09-21-prospeccao/probe-sem-vies.mjs

import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const AQUI = dirname(fileURLToPath(import.meta.url))
const ROOT = process.cwd()
const BASE = "https://api.dataforseo.com/v3"

const env = readFileSync(join(ROOT, ".env.local"), "utf8")
const ler = (c) => env.match(new RegExp(`^${c}=(.*)$`, "m"))?.[1]?.trim() ?? ""
const AUTH = `Basic ${Buffer.from(`${ler("DATAFORSEO_LOGIN")}:${ler("DATAFORSEO_PASSWORD")}`, "utf8").toString("base64")}`

mkdirSync(AQUI, { recursive: true })
let custoTotal = 0

const salvar = (n, d) =>
  writeFileSync(join(AQUI, n), JSON.stringify(d, null, 2), "utf8")

async function chamar(caminho, corpo) {
  const r = await fetch(`${BASE}${caminho}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: AUTH,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify([corpo]),
  })
  const body = await r.json()
  const custo = typeof body.cost === "number" ? body.cost : 0
  custoTotal += custo
  return { body, custo }
}

const pct = (n, t) => (t === 0 ? "—" : `${((n / t) * 100).toFixed(0)}%`)

function perfil(itens) {
  const n = itens.length
  const c = (fn) => itens.filter(fn).length
  return {
    n,
    site: c((i) => i.url),
    telefone: c((i) => i.phone),
    cep: c((i) => i.address_info?.zip),
    claimed: c((i) => i.is_claimed === true),
    naoClaimed: c((i) => i.is_claimed === false),
    claimedNulo: c((i) => typeof i.is_claimed !== "boolean"),
    nota: c((i) => typeof i.rating?.value === "number"),
    notaBaixa: c((i) => typeof i.rating?.value === "number" && i.rating.value < 4),
    semAvaliacao: c((i) => !i.rating?.votes_count),
    semSiteComTel: c((i) => !i.url && i.phone),
  }
}

function imprimir(rotulo, p, total) {
  console.log(`\n  ${rotulo}  (amostra ${p.n}, universo ${total ?? "?"})`)
  const l = (k, v) =>
    console.log(`    ${k.padEnd(24)} ${String(v).padStart(4)}  ${pct(v, p.n)}`)
  l("com site", p.site)
  l("com telefone", p.telefone)
  l("com CEP", p.cep)
  l("sem site MAS com telefone", p.semSiteComTel)
  l("is_claimed = true", p.claimed)
  l("is_claimed = false", p.naoClaimed)
  l("is_claimed nulo", p.claimedNulo)
  l("com nota", p.nota)
  l("nota < 4,0", p.notaBaixa)
  l("sem nenhuma avaliacao", p.semAvaliacao)
}

/* ========================================================================== */
const CENARIOS = [
  { nome: "restaurante · Guarulhos/SP", cat: "restaurant", lat: -23.4628, lng: -46.5333, raio: 10 },
  { nome: "salao de beleza · Guarulhos/SP", cat: "beauty_salon", lat: -23.4628, lng: -46.5333, raio: 10 },
  { nome: "dentista · Guarulhos/SP", cat: "dentist", lat: -23.4628, lng: -46.5333, raio: 10 },
  { nome: "dentista · Londrina/PR", cat: "dentist", lat: -23.3103, lng: -51.1628, raio: 15 },
]

console.log("=== P5/P7. Sem order_by, quatro cenarios ===")
const resumo = []

for (const c of CENARIOS) {
  const r = await chamar("/business_data/business_listings/search/live", {
    categories: [c.cat],
    location_coordinate: `${c.lat},${c.lng},${c.raio}`,
    limit: 100,
  })
  const res = r.body?.tasks?.[0]?.result?.[0] ?? {}
  const p = perfil(res.items ?? [])
  imprimir(c.nome, p, res.total_count)
  resumo.push({ cenario: c.nome, totalCount: res.total_count ?? null, ...p, custo: r.custo })
  salvar(`05-sem-vies-${c.cat}-${c.nome.includes("Londrina") ? "londrina" : "guarulhos"}.json`, r.body)
}

/* ========================================================================== */
console.log("\n=== P6. O que websites_count significa ===")
const agg = await chamar(
  "/business_data/business_listings/categories_aggregation/live",
  {
    categories: ["dentist"],
    location_coordinate: "-23.4628,-46.5333,10",
    limit: 5,
  },
)
salvar("06-aggregation-dentist.json", agg.body)
const item = agg.body?.tasks?.[0]?.result?.[0]?.items?.[0]
console.log("  categories:", JSON.stringify(item?.categories))
console.log("  aggregation.count:", item?.aggregation?.count)
console.log("  aggregation.websites_count:", item?.aggregation?.websites_count)
console.log(
  "  razao sites/total:",
  item?.aggregation?.count
    ? pct(item.aggregation.websites_count, item.aggregation.count)
    : "?",
)
console.log("  (comparar com 'com site' do cenario dentista acima)")

/* ========================================================================== */
console.log("\n=== P8. Filtro is_claimed=false devolve volume? ===")
const naoRei = await chamar("/business_data/business_listings/search/live", {
  categories: ["dentist"],
  location_coordinate: "-23.4628,-46.5333,10",
  is_claimed: false,
  limit: 20,
})
salvar("07-nao-reivindicados.json", naoRei.body)
const nr = naoRei.body?.tasks?.[0]?.result?.[0] ?? {}
console.log("  status:", naoRei.body?.tasks?.[0]?.status_message)
console.log("  total_count com is_claimed=false:", nr.total_count ?? "(ausente)")
console.log("  devolvidos:", (nr.items ?? []).length)

/* ========================================================================== */
console.log(`\n=== CUSTO DESTA SONDAGEM: US$ ${custoTotal.toFixed(5)} ===`)
salvar("08-resumo-sem-vies.json", {
  medidoEm: new Date().toISOString(),
  cenarios: resumo,
  aggregationDentist: item?.aggregation
    ? { count: item.aggregation.count, websitesCount: item.aggregation.websites_count }
    : null,
  naoReivindicados: { totalCount: nr.total_count ?? null },
  custoTotal: Number(custoTotal.toFixed(5)),
})
