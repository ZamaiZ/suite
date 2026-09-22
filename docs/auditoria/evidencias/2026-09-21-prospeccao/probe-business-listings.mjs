// DESCARTAVEL - sondagem da Fase 0 da prospeccao.
// Nao faz parte do app.
//
// A pergunta que decide o desenho inteiro: o `business_listings` do DataForSEO
// serve como motor de descoberta no Brasil, ou a cobertura obriga a voltar para
// a varredura por malha do `/serp/google/maps`?
//
// Medir contra o payload, nunca ler a doc. O que esta sondagem responde:
//
//   P1. O catalogo de categorias tem granularidade util para o Brasil?
//       (`/business_listings/categories` e GRATUITO)
//   P2. Num raio real de uma cidade que a agencia prospecta, quantas empresas
//       o `categories_aggregation` acusa, e em que categorias?
//   P3. Numa amostra de 100 do `search`: quantos tem TELEFONE? quantos tem
//       SITE? o `is_claimed` vem preenchido? o CEP vem em `address_info.zip`?
//       qual a IDADE de `last_updated_time`?
//   P4. Quanto custou DE VERDADE, contra o preco de tabela.
//
// P4 existe porque o preco de tabela ja mentiu neste repositorio: o
// `SERP_CAVEAT` em lib/dataforseo/usage.ts registra US$ 0,01 medido contra
// US$ 0,002 de tabela. Cinco vezes.
//
// Uso: node docs/auditoria/evidencias/2026-09-21-prospeccao/probe-business-listings.mjs

import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const AQUI = dirname(fileURLToPath(import.meta.url))
const ROOT = process.cwd()
const BASE = "https://api.dataforseo.com/v3"

// Guarulhos/SP. Mesma cidade das sondagens de 2026-09-15, para que os numeros
// sejam comparaveis com o que ja esta medido em `maps-search.ts`.
const CENTRO = { lat: -23.4628, lng: -46.5333, nome: "Guarulhos/SP" }
const RAIO_KM = 10

const env = readFileSync(join(ROOT, ".env.local"), "utf8")
const ler = (chave) =>
  env.match(new RegExp(`^${chave}=(.*)$`, "m"))?.[1]?.trim() ?? ""

const login = ler("DATAFORSEO_LOGIN")
const senha = ler("DATAFORSEO_PASSWORD")
if (!login || !senha) {
  console.error("Credenciais do DataForSEO ausentes em .env.local")
  process.exit(1)
}
const AUTH = `Basic ${Buffer.from(`${login}:${senha}`, "utf8").toString("base64")}`

mkdirSync(AQUI, { recursive: true })
let custoTotal = 0

function salvar(nome, dado) {
  writeFileSync(join(AQUI, nome), JSON.stringify(dado, null, 2), "utf8")
}

async function chamar(metodo, caminho, corpo) {
  const inicio = Date.now()
  const resposta = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    cache: "no-store",
    headers: {
      Authorization: AUTH,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: corpo ? JSON.stringify([corpo]) : undefined,
  })
  const body = await resposta.json()
  const custo = typeof body.cost === "number" ? body.cost : 0
  custoTotal += custo
  return { body, custo, ms: Date.now() - inicio, http: resposta.status }
}

const pct = (n, total) =>
  total === 0 ? "—" : `${((n / total) * 100).toFixed(0)}%`

/* ========================================================================== */
console.log("=== P1. Catalogo de categorias (gratuito) ===")

const p1 = await chamar("GET", "/business_data/business_listings/categories")
salvar("01-categories.json", p1.body)

const categorias = p1.body?.tasks?.[0]?.result ?? []
console.log("http:", p1.http, "| custo:", p1.custo, "| ms:", p1.ms)
console.log("categorias no catalogo:", categorias.length)

// Categorias que interessam a uma agencia de SEO/GBP local.
const ALVOS = [
  "dentist",
  "restaurant",
  "beauty_salon",
  "lawyer",
  "gym",
  "veterinarian",
  "optician",
  "real_estate_agency",
  "auto_repair_shop",
  "pet_store",
]
console.log("\namostra de categorias alvo:")
for (const alvo of ALVOS) {
  const achou = categorias.find((c) => c?.category === alvo)
  console.log(
    ` ${achou ? "ok " : "NAO"} ${alvo.padEnd(22)}`,
    achou ? `${achou.count?.toLocaleString("pt-BR") ?? "?"} no mundo` : "",
  )
}

/* ========================================================================== */
console.log(`\n=== P2. Densidade em ${CENTRO.nome}, raio ${RAIO_KM} km ===`)

const p2 = await chamar(
  "POST",
  "/business_data/business_listings/categories_aggregation/live",
  {
    location_coordinate: `${CENTRO.lat},${CENTRO.lng},${RAIO_KM}`,
    limit: 100,
  },
)
salvar("02-categories-aggregation.json", p2.body)

const agg = p2.body?.tasks?.[0]?.result?.[0] ?? {}
console.log("http:", p2.http, "| custo:", p2.custo, "| ms:", p2.ms)
console.log("total_count na area:", agg.total_count ?? "(ausente)")
console.log("\ntop 15 categorias na area:")
for (const item of (agg.items ?? []).slice(0, 15)) {
  console.log(
    `  ${String(item.count).padStart(6)}  ${item.category ?? item.title ?? "?"}`,
  )
}

/* ========================================================================== */
// A categoria mais densa da area que esteja entre os alvos, senao a mais densa.
const densas = agg.items ?? []
const escolhida =
  densas.find((i) => ALVOS.includes(i.category))?.category ??
  densas[0]?.category ??
  "restaurant"

console.log(`\n=== P3. Amostra de 100 em "${escolhida}" ===`)

const p3 = await chamar(
  "POST",
  "/business_data/business_listings/search/live",
  {
    categories: [escolhida],
    location_coordinate: `${CENTRO.lat},${CENTRO.lng},${RAIO_KM}`,
    limit: 100,
    order_by: ["rating.votes_count,desc"],
  },
)
salvar("03-search-amostra.json", p3.body)

const res3 = p3.body?.tasks?.[0]?.result?.[0] ?? {}
const itens = res3.items ?? []
console.log("http:", p3.http, "| custo:", p3.custo, "| ms:", p3.ms)
console.log("status:", p3.body?.tasks?.[0]?.status_message)
console.log("total_count no banco:", res3.total_count ?? "(ausente)")
console.log("itens devolvidos:", itens.length)
console.log("offset_token:", res3.offset_token ? "presente" : "AUSENTE")

const n = itens.length
const conta = (fn) => itens.filter(fn).length

const comTelefone = conta((i) => typeof i.phone === "string" && i.phone.trim())
const comSite = conta((i) => typeof i.url === "string" && i.url.trim())
const comDominio = conta((i) => typeof i.domain === "string" && i.domain.trim())
const comCep = conta((i) => i.address_info?.zip)
const comEndereco = conta((i) => typeof i.address === "string" && i.address)
const claimedPreenchido = conta((i) => typeof i.is_claimed === "boolean")
const naoReivindicado = conta((i) => i.is_claimed === false)
const comNota = conta((i) => typeof i.rating?.value === "number")
const comPlaceId = conta((i) => typeof i.place_id === "string" && i.place_id)
const comCid = conta((i) => typeof i.cid === "string" && i.cid)
const comContactInfo = conta((i) => i.contact_info)
const comAtributos = conta((i) => i.attributes)

console.log("\npreenchimento de campo (o que decide o funil):")
const linha = (rotulo, v) =>
  console.log(`  ${rotulo.padEnd(26)} ${String(v).padStart(4)}  ${pct(v, n)}`)
linha("place_id", comPlaceId)
linha("cid", comCid)
linha("phone", comTelefone)
linha("url (site)", comSite)
linha("domain", comDominio)
linha("address", comEndereco)
linha("address_info.zip (CEP)", comCep)
linha("rating.value", comNota)
linha("is_claimed preenchido", claimedPreenchido)
linha("  dos quais NAO reivindicados", naoReivindicado)
linha("contact_info", comContactInfo)
linha("attributes", comAtributos)

// Idade do dado. O business_listings e banco de dados, nao coleta ao vivo:
// telefone de 2024 mostrado sem data e afirmacao falsa sobre hoje.
const idades = itens
  .map((i) => i.last_updated_time)
  .filter(Boolean)
  .map((t) => (Date.now() - Date.parse(t)) / 86_400_000)
  .filter((d) => Number.isFinite(d))
  .sort((a, b) => a - b)
if (idades.length > 0) {
  const mediana = idades[Math.floor(idades.length / 2)]
  console.log("\nidade de last_updated_time (dias):")
  console.log(`  com data: ${idades.length}/${n}`)
  console.log(`  min ${idades[0].toFixed(0)} | mediana ${mediana.toFixed(0)} | max ${idades.at(-1).toFixed(0)}`)
} else {
  console.log("\nlast_updated_time: AUSENTE em toda a amostra")
}

// A combinacao que interessa a uma agencia de SEO/GBP: quem esta mal servido.
const semSite = conta((i) => !i.url)
const semSiteComTelefone = conta((i) => !i.url && i.phone)
const notaBaixa = conta((i) => typeof i.rating?.value === "number" && i.rating.value < 4)
console.log("\nsinal de dor (o lead quente desta agencia):")
linha("sem site", semSite)
linha("  e com telefone", semSiteComTelefone)
linha("nota < 4,0", notaBaixa)
linha("perfil nao reivindicado", naoReivindicado)

console.log("\nprimeiros 3 itens, cru:")
console.log(JSON.stringify(itens.slice(0, 3), null, 2).slice(0, 2600))

/* ========================================================================== */
console.log("\n=== P4. Custo medido x tabela ===")

const tabela = 0.012 + n * 0.00036
console.log(`search: medido US$ ${p3.custo} | tabela US$ ${tabela.toFixed(5)}`)
console.log(
  `razao: ${tabela > 0 ? (p3.custo / tabela).toFixed(2) : "?"}x`,
  p3.custo > tabela ? "(tabela SUBESTIMA)" : "(tabela cobre)",
)
console.log(`aggregation: medido US$ ${p2.custo}`)
console.log(`\nCUSTO TOTAL DESTA SONDAGEM: US$ ${custoTotal.toFixed(5)}`)

salvar("04-resumo.json", {
  medidoEm: new Date().toISOString(),
  centro: CENTRO,
  raioKm: RAIO_KM,
  categoriaAmostrada: escolhida,
  catalogoCategorias: categorias.length,
  areaTotalCount: agg.total_count ?? null,
  amostra: {
    devolvidos: n,
    totalCount: res3.total_count ?? null,
    offsetToken: Boolean(res3.offset_token),
    comPlaceId,
    comCid,
    comTelefone,
    comSite,
    comDominio,
    comCep,
    comNota,
    claimedPreenchido,
    naoReivindicado,
    comContactInfo,
    semSite,
    semSiteComTelefone,
    notaBaixa,
  },
  custo: {
    searchMedido: p3.custo,
    searchTabela: Number(tabela.toFixed(5)),
    aggregationMedido: p2.custo,
    sondagemTotal: Number(custoTotal.toFixed(5)),
  },
})
console.log("\nevidencias salvas em", AQUI)
