// DESCARTAVEL - Task 1 do plano da Fase 3, parte 3.
// Nao faz parte do app.
//
// A parte 2 levou `40501 Invalid Field: 'location_code'` no
// `competitors_domain` com o location_code de Itu (1031728) — o mesmo que o
// endpoint de SERP aceitou sem reclamar na parte 1.
//
// A hipotese: os endpoints do DataForSEO Labs tem uma lista de localidades
// PROPRIA, menor que a do SERP, e cidade pequena pode nao estar nela. Se for
// isso, o desenho muda: a spec diz "clustering roda na location da cidade
// principal", e parte do pipeline (competitors_domain, domain_intersection,
// ranked_keywords) talvez so aceite pais ou regiao.
//
//   P6a. Quais localidades o Labs aceita? Itu esta la? E Sao Paulo (estado)?
//   P6.  `competitors_domain` com um location valido devolve o que?
//   P5.  `domain_intersection` — par a par ou varios de uma vez?
//
// Uso:
//   node docs/auditoria/evidencias/2026-09-18-fase3-pesquisa/probe-pesquisa-parte3.mjs [TETO_USD]

import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = process.cwd()
const OUT = "docs/auditoria/evidencias/2026-09-18-fase3-pesquisa"
const TETO = Number(process.argv.find((a) => /^[0-9.]+$/.test(a)) ?? "0.18")

const DOMINIO = "leotintas.com.br"
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
const AUTH = credenciais()

function dump(nome, corpo) {
  writeFileSync(join(OUT, `${nome}.json`), JSON.stringify(corpo, null, 2))
}

async function chamar(nome, caminho, tarefa, reserva = 0.05) {
  if (gasto + reserva > TETO) {
    console.log(`PAROU antes de ${nome}: US$ ${gasto.toFixed(5)} + ${reserva} > ${TETO}`)
    return null
  }
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

// --- P6a: localidades que o Labs aceita (gratuito) ---------------------------

linha("P6a localidades do DataForSEO Labs (gratuito)")

const r = await fetch(
  "https://api.dataforseo.com/v3/dataforseo_labs/locations_and_languages",
  { headers: { Authorization: AUTH } },
)
const locs = await r.json()
dump("07-labs-locations", locs)
console.log(`http ${r.status} | cost US$ ${locs.cost ?? 0}`)

const todas = locs?.tasks?.[0]?.result ?? []
console.log("total de localidades no Labs:", todas.length)

const br = todas.filter((l) => l.country_iso_code === "BR")
console.log("localidades BR no Labs:", br.length)

const tipos = new Map()
for (const l of br) tipos.set(l.location_type, (tipos.get(l.location_type) ?? 0) + 1)
console.log("por location_type:", JSON.stringify(Object.fromEntries(tipos)))

const temItu = br.filter((l) => /^Itu,/.test(l.location_name ?? ""))
console.log("Itu no Labs:", temItu.length ? JSON.stringify(temItu) : "AUSENTE")

const sp = br.filter((l) => /Sao Paulo/i.test(l.location_name ?? ""))
console.log("entradas com 'Sao Paulo':", JSON.stringify(sp.slice(0, 8), null, 2))

/**
 * Escolha do location para o Labs: cidade se existir, senao o estado, senao o
 * pais. E essa degradacao que o desenho precisa saber.
 */
const LOC_LABS =
  temItu[0]?.location_code ??
  sp.find((l) => l.location_type === "Region")?.location_code ??
  BRASIL
console.log("LOC_LABS escolhido:", LOC_LABS)

// --- P6: competitors_domain ---------------------------------------------------

linha("P6 competitors_domain com location valido")

const comp = await chamar(
  "05-competitors-domain",
  "/dataforseo_labs/google/competitors_domain/live",
  { target: DOMINIO, location_code: LOC_LABS, language_code: PT, limit: 10 },
)

let DOMS = []
if (comp) {
  const res = resultado(comp)
  console.log("chaves do result:", chaves(res))
  const itens = res?.items ?? []
  console.log("concorrentes devolvidos:", itens.length)
  if (itens[0]) {
    console.log("chaves do item:", chaves(itens[0]))
    console.log("amostra completa:", JSON.stringify(itens[0], null, 2).slice(0, 1800))
  }
  for (const c of itens) {
    const m = c.metrics?.organic ?? {}
    console.log(
      `  ${c.domain} | intersections=${c.intersections ?? "?"} | pos1=${m.pos_1 ?? "?"} | etv=${(m.etv ?? 0).toFixed?.(1) ?? "?"}`,
    )
  }
  DOMS = itens.map((c) => c.domain).filter((d) => d && d !== DOMINIO)
  console.log(
    "  P6 VEREDITO:",
    itens[0]?.intersections != null
      ? "traz intersections + metrics.organic por concorrente"
      : "sem metrica de interseccao",
  )
}

// --- P5: domain_intersection --------------------------------------------------

linha("P5 domain_intersection")

if (DOMS.length) {
  const inter = await chamar(
    "06-domain-intersection",
    "/dataforseo_labs/google/domain_intersection/live",
    {
      target1: DOMINIO,
      target2: DOMS[0],
      location_code: LOC_LABS,
      language_code: PT,
      intersections: true,
      limit: 20,
    },
  )
  if (inter) {
    const res = resultado(inter)
    console.log("target2:", DOMS[0])
    console.log("chaves do result:", chaves(res))
    const itens = res?.items ?? []
    console.log("itens:", itens.length, "| total_count:", res?.total_count)
    if (itens[0]) {
      console.log("chaves do item:", chaves(itens[0]))
      console.log("amostra:", JSON.stringify(itens[0], null, 2).slice(0, 1500))
    }
    console.log(
      "  P5 VEREDITO: assinatura target1/target2 — PAR A PAR, multiplica por N concorrentes",
    )
  }
} else {
  console.log("sem concorrente devolvido; P5 nao rodou")
}

linha("FECHO")
console.log(`gasto desta parte: US$ ${gasto.toFixed(5)} (teto US$ ${TETO})`)
console.log(`gasto da Task 1 inteira: US$ ${(gasto + 0.184 + 0.0144).toFixed(5)}`)
