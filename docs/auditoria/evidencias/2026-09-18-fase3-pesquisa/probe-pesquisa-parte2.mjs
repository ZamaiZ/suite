// DESCARTAVEL - Task 1 do plano da Fase 3, parte 2.
// Nao faz parte do app.
//
// As tres perguntas que sobraram quando o teto cortou a parte 1:
//
//   P4. Qual o teto de keywords por chamada de `search_intent`?
//   P6. `competitors_domain` devolve o dominio do concorrente com metrica de
//       interseccao, ou so o dominio?
//   P5. `domain_intersection` aceita varios dominios de uma vez, ou e par a
//       par? Multiplica ou nao por N concorrentes.
//
// CORRECAO sobre a parte 1: la o teto era conferido com o acumulado *antes* da
// chamada, entao bloqueava a proxima mas nao impedia a atual de ultrapassar —
// gastou US$ 0,184 contra teto de US$ 0,15. Aqui cada chamada declara seu custo
// maximo esperado e a reserva e conferida antes de gastar.
//
// Uso:
//   node docs/auditoria/evidencias/2026-09-18-fase3-pesquisa/probe-pesquisa-parte2.mjs [TETO_USD]

import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = process.cwd()
const OUT = "docs/auditoria/evidencias/2026-09-18-fase3-pesquisa"
const TETO = Number(process.argv.find((a) => /^[0-9.]+$/.test(a)) ?? "0.20")

const DOMINIO = "leotintas.com.br"
/** Itu, State of Sao Paulo, Brazil — medido na parte 1 (P0). */
const LOC_ITU = 1031728
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

/**
 * `reserva` e o custo maximo que esta chamada pode ter. Sem ela o teto so
 * descobre o estouro depois de pagar.
 */
async function chamar(nome, caminho, tarefa, reserva = 0.05) {
  if (gasto + reserva > TETO) {
    console.log(
      `PAROU antes de ${nome}: acumulado US$ ${gasto.toFixed(5)} + reserva US$ ${reserva} passaria do teto US$ ${TETO}`,
    )
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

// --- P4: search_intent em lote -----------------------------------------------

linha("P4 search_intent em lote")

const lote = JSON.parse(readFileSync(join(OUT, "03-search-volume-lote.json"), "utf8"))
const KWS = (lote?.tasks?.[0]?.result ?? [])
  .map((i) => i.keyword)
  .filter(Boolean)
  .slice(0, 20)
console.log("keywords do lote ja pago:", KWS.length)

const intent = await chamar(
  "04-search-intent-lote",
  "/dataforseo_labs/google/search_intent/live",
  { keywords: KWS, language_code: PT },
)
if (intent) {
  const r = resultado(intent)
  console.log("chaves do result:", chaves(r))
  const itens = r?.items ?? []
  console.log("itens devolvidos:", itens.length, "| mandados:", KWS.length)
  if (itens[0]) {
    console.log("chaves do item:", chaves(itens[0]))
    console.log("amostra:", JSON.stringify(itens[0], null, 2))
  }
  console.log(
    "  P4 VEREDITO:",
    itens.length === KWS.length ? `lote de ${KWS.length} aceito inteiro` : "devolveu menos que o mandado",
  )
}

// --- P6: concorrentes organicos ----------------------------------------------

linha("P6 competitors_domain")

const comp = await chamar(
  "05-competitors-domain",
  "/dataforseo_labs/google/competitors_domain/live",
  { target: DOMINIO, location_code: LOC_ITU, language_code: PT, limit: 10 },
)

let DOMS = []
if (comp) {
  const r = resultado(comp)
  console.log("chaves do result:", chaves(r))
  const itens = r?.items ?? []
  console.log("concorrentes devolvidos:", itens.length)
  if (itens[0]) {
    console.log("chaves do item:", chaves(itens[0]))
    console.log("amostra:", JSON.stringify(itens[0], null, 2).slice(0, 1500))
  }
  for (const c of itens) {
    const m = c.metrics?.organic ?? {}
    console.log(
      `  ${c.domain} | intersections=${c.intersections ?? "?"} | pos=${m.pos_1 ?? "?"}/${m.pos_2_3 ?? "?"} | etv=${m.etv ?? "?"}`,
    )
  }
  DOMS = itens.map((c) => c.domain).filter((d) => d && d !== DOMINIO)
  console.log("  P6 VEREDITO:", itens[0]?.intersections != null ? "traz metrica de interseccao" : "so dominio + metrics")
}

// --- P5: keyword gap ----------------------------------------------------------

linha("P5 domain_intersection")

if (DOMS.length) {
  const inter = await chamar(
    "06-domain-intersection",
    "/dataforseo_labs/google/domain_intersection/live",
    {
      target1: DOMINIO,
      target2: DOMS[0],
      location_code: LOC_ITU,
      language_code: PT,
      intersections: true,
      limit: 20,
    },
  )
  if (inter) {
    const r = resultado(inter)
    console.log("alvo2:", DOMS[0])
    console.log("chaves do result:", chaves(r))
    const itens = r?.items ?? []
    console.log("itens:", itens.length, "| total_count:", r?.total_count)
    if (itens[0]) {
      console.log("chaves do item:", chaves(itens[0]))
      console.log("amostra:", JSON.stringify(itens[0], null, 2).slice(0, 1500))
    }
    console.log("  P5 VEREDITO: assinatura e target1/target2 — PAR A PAR, multiplica por N concorrentes")
  }
} else {
  console.log("sem concorrente devolvido pela P6; P5 nao rodou")
}

// --- fecho --------------------------------------------------------------------

linha("FECHO")
console.log(`gasto desta parte: US$ ${gasto.toFixed(5)} (teto US$ ${TETO})`)
console.log(`gasto da Task 1 inteira: US$ ${(gasto + 0.184).toFixed(5)}`)
