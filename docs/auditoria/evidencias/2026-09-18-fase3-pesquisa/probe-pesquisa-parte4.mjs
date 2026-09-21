// DESCARTAVEL - Task 4 do plano da Fase 3, sondagem complementar.
// Nao faz parte do app.
//
//   P8. `keywords_for_keywords` aceita 50 seeds numa chamada so?
//       O modulo hoje fatia em lotes de 20, que e o valor da DOCUMENTACAO e
//       nao foi medido. Com 50 seeds a diferenca e entre uma chamada e tres,
//       a US$ 0,09 cada.
//
//   P9. `keyword_ideas` vale a chamada?
//       Ele e o unico dos tres endpoints restantes que traz termo da mesma
//       categoria semantica SEM conter o seed. A pergunta nao e "qual a forma
//       do payload" — e "quanto ele acha que o keywords_for_keywords nao
//       achou". Por isso o script compara o retorno contra as 4.831 ja pagas
//       e imprime a sobreposicao. Ganho marginal baixo = corta do plano.
//
// Uso:
//   node docs/auditoria/evidencias/2026-09-18-fase3-pesquisa/probe-pesquisa-parte4.mjs [TETO_USD]

import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = process.cwd()
const OUT = "docs/auditoria/evidencias/2026-09-18-fase3-pesquisa"
const TETO = Number(process.argv.find((a) => /^[0-9.]+$/.test(a)) ?? "0.25")

const LOC_ITU = 1031728
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

const dump = (nome, corpo) =>
  writeFileSync(join(OUT, `${nome}.json`), JSON.stringify(corpo, null, 2))

async function chamar(nome, caminho, tarefa, reserva) {
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

const linha = (titulo) => console.log(`\n=== ${titulo}`)
const chaves = (o) => (o ? Object.keys(o).join(", ") : "(nulo)")
const fold = (s) =>
  String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

// As 4.831 ja pagas, para comparar ganho marginal.
const jaPagas = JSON.parse(
  readFileSync(join(OUT, "02-keywords-for-keywords.json"), "utf8"),
)
const conhecidas = new Set(
  (jaPagas?.tasks?.[0]?.result ?? []).map((i) => fold(i.keyword)),
)
console.log("candidatas ja conhecidas do dump anterior:", conhecidas.size)

// --- P8: teto de seeds --------------------------------------------------------

linha("P8 keywords_for_keywords aceita 50 seeds?")

/** As 50 de maior volume do proprio dump: termos reais do nicho, nao inventados. */
const SEEDS_50 = (jaPagas?.tasks?.[0]?.result ?? [])
  .filter((i) => typeof i.search_volume === "number" && i.search_volume > 0)
  .sort((a, b) => b.search_volume - a.search_volume)
  .slice(0, 50)
  .map((i) => i.keyword)

console.log("seeds mandados:", SEEDS_50.length)
console.log("amostra:", SEEDS_50.slice(0, 5).join(" | "))

const kfk50 = await chamar(
  "08-kfk-50-seeds",
  "/keywords_data/google_ads/keywords_for_keywords/live",
  { keywords: SEEDS_50, location_code: LOC_ITU, language_code: PT },
  0.1,
)

if (kfk50) {
  const t = kfk50?.tasks?.[0]
  const devolvidas = t?.result?.length ?? 0
  const recusou = (t?.status_code ?? 0) >= 40000
  console.log("status_code:", t?.status_code, "| devolvidas:", devolvidas)
  console.log(
    "  P8 VEREDITO:",
    recusou
      ? `RECUSOU 50 seeds — o fatiamento em lotes e obrigatorio (${t?.status_message})`
      : `ACEITOU 50 seeds numa chamada so, US$ ${t?.cost} — o teto de 20 pode subir`,
  )
}

// --- P9: keyword_ideas vale a chamada? ---------------------------------------

linha("P9 keyword_ideas — quanto ele acha que o outro nao achou?")

const ideas = await chamar(
  "09-keyword-ideas",
  "/dataforseo_labs/google/keyword_ideas/live",
  {
    keywords: ["loja de tintas", "tinta emborrachada", "tinta acrilica"],
    location_code: BRASIL, // Labs so aceita pais — medido na parte 3
    language_code: PT,
    limit: 200,
  },
  0.05,
)

if (ideas) {
  const r = ideas?.tasks?.[0]?.result?.[0] ?? null
  console.log("chaves do result:", chaves(r))
  const itens = r?.items ?? []
  console.log("itens devolvidos:", itens.length, "| total_count:", r?.total_count)

  if (itens[0]) {
    console.log("chaves do item:", chaves(itens[0]))
    console.log("amostra:", JSON.stringify(itens[0], null, 2).slice(0, 900))
  }

  const nomes = itens
    .map((i) => i.keyword ?? i.keyword_data?.keyword)
    .filter(Boolean)
  const novas = nomes.filter((k) => !conhecidas.has(fold(k)))

  console.log("\n-- ganho marginal --")
  console.log("nomes lidos:", nomes.length)
  console.log("ja conhecidas:", nomes.length - novas.length)
  console.log("NOVAS:", novas.length)
  if (nomes.length) {
    const pct = ((novas.length / nomes.length) * 100).toFixed(1)
    console.log(`taxa de novidade: ${pct}%`)
    console.log("amostra das novas:", novas.slice(0, 15).join(" | "))
    console.log(
      "  P9 VEREDITO:",
      novas.length / nomes.length >= 0.3
        ? "VALE — traz o que o keywords_for_keywords nao trouxe"
        : "MARGINAL — a maior parte ja veio de graca na expansao",
    )
  }
}

linha("FECHO")
console.log(`gasto desta parte: US$ ${gasto.toFixed(5)} (teto US$ ${TETO})`)
