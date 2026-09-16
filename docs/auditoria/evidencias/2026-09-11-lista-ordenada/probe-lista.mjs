// DESCARTAVEL - Task 1 do plano de repaginacao da Presenca em IA.
// Nao faz parte do app.
//
// A matriz Prompt x LLM precisa da LISTA ORDENADA de empresas que cada modelo
// escreve. O snapshot de hoje nao guarda isso: `buildGeoPromptRun` le o texto e
// o descarta, e `brands` so contem nomes que ja estavam na lista de casamento.
//
// E a forma dessa lista NUNCA foi medida. As sete evidencias de `llm_responses`
// em `2026-09-10-presenca-em-ia/` sao todas do mesmo prompt da familia `brand`
// - "A agencia X e confiavel?" -, que devolve PROSA. Nenhuma e de `discovery`,
// que e a familia que produz a lista.
//
// Escrever o parser sem medir seria supor a forma do payload. Esta etapa ja
// errou duas vezes exatamente assim - o caminho de `annotations` e o filtro de
// backlinks -, e as duas produziram ZERO SILENCIOSO em vez de erro.
//
// Tres perguntas:
//   1. A lista vem numerada, em bullet, em negrito solto, ou em prosa?
//   2. O bloco de raciocinio do ChatGPT e separavel do corpo da resposta?
//      Medido em `20-llm_responses-chat_gpt.json`: ele esta DENTRO do mesmo
//      `sections[].text` que `readLlmText` concatena. Um parser ingenuo leria
//      `**Assessing trustworthiness**` como nome de empresa.
//   3. As quatro concordam o bastante para um leitor so, ou sao quatro?
//
// Uso:
//   node docs/auditoria/evidencias/2026-09-11-lista-ordenada/probe-lista.mjs [OUT_DIR] [TETO_USD]
//   node ... --offline      # re-deriva o veredito dos dumps, sem pagar

import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = "C:/Users/Eduardo Zamai/Documents/suite"
const OUT = process.argv[2] ?? "."
const TETO = Number(process.argv[3] ?? "0.15")
const OFFLINE = process.argv.includes("--offline")

/**
 * O lead das evidencias, para a serie continuar comparavel com a onda 0.
 * O texto segue o template de `deriveGeoPromptSet`, familia `discovery`.
 */
const SEGMENTO = "SEO"
const CIDADE = "Guarulhos"
// Acentuado de proposito: e o texto que `deriveGeoPromptSet` produz. Medir com
// um prompt diferente do que o app manda mediria outra coisa.
const PROMPT = `Quais são as melhores empresas de ${SEGMENTO} em ${CIDADE}?`

/** Espelha `GEO_PROMPT_MODELS` de `lib/dataforseo/limits.ts`. */
const MODELOS = {
  chat_gpt: "gpt-5-mini",
  claude: "claude-haiku-4-5",
  gemini: "gemini-2.5-flash",
  perplexity: "sonar",
}

/**
 * Espelha `GEO_PROMPT_OMITTED_FIELDS`. Tres das quatro plataformas devolvem
 * `40501 Invalid Field` com o mesmo corpo, cada uma apontando um campo
 * diferente - e `40501` NAO COBRA, entao a falha some no custo.
 */
const OMITIDOS = {
  chat_gpt: ["max_output_tokens"],
  claude: [],
  gemini: ["web_search_country_iso_code", "web_search_city"],
  perplexity: ["web_search_city"],
}

const PLATAFORMAS = ["chat_gpt", "claude", "gemini", "perplexity"]

function env() {
  const raw = readFileSync(join(ROOT, ".env.local"), "utf8")
  const out = {}
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    const q = v[0]
    if (v.length > 1 && (q === '"' || q === "'") && v[v.length - 1] === q) {
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

const summary = {
  at: new Date().toISOString(),
  prompt: PROMPT,
  teto_usd: TETO,
  traces: {},
  gasto: 0,
  veredito: {},
}

function dump(nome, payload) {
  writeFileSync(join(OUT, `${nome}.json`), JSON.stringify(payload, null, 2), "utf8")
}

function task(r) {
  return r?.json?.tasks?.[0] ?? null
}

async function call(plataforma) {
  const arquivo = `30-discovery-${plataforma}`

  if (OFFLINE) {
    summary.traces[plataforma] = { offline: true, de: `${arquivo}.json` }
    try {
      return { http: 200, json: JSON.parse(readFileSync(join(OUT, `${arquivo}.json`), "utf8")) }
    } catch {
      return null
    }
  }

  if (summary.gasto >= TETO) {
    summary.traces[plataforma] = { pulado: `teto de US$ ${TETO}` }
    console.error(`[teto] pulando ${plataforma}`)
    return null
  }

  const corpo = {
    user_prompt: PROMPT,
    model_name: MODELOS[plataforma],
    web_search: true,
    web_search_country_iso_code: "BR",
    web_search_city: CIDADE,
    max_output_tokens: 800,
  }
  for (const campo of OMITIDOS[plataforma]) delete corpo[campo]

  let r
  try {
    const res = await fetch(
      `https://api.dataforseo.com/v3/ai_optimization/${plataforma}/llm_responses/live`,
      {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify([corpo]),
      },
    )
    r = { http: res.status, json: await res.json() }
  } catch (err) {
    r = { http: null, json: null, error: String(err) }
  }

  const t = task(r)
  const cost = typeof t?.cost === "number" ? t.cost : 0
  summary.gasto = Number((summary.gasto + cost).toFixed(6))
  summary.traces[plataforma] = {
    http: r.http ?? null,
    status_code: t?.status_code ?? r.json?.status_code ?? null,
    status_message: t?.status_message ?? r.json?.status_message ?? null,
    cost,
    gasto_acumulado: summary.gasto,
  }
  console.error(
    `[${plataforma}] http ${r.http} status ${t?.status_code ?? "-"} custo ${cost} acumulado ${summary.gasto}`,
  )
  if (r.json) dump(arquivo, r.json)
  return r
}

/** O mesmo caminho de `readLlmText`: `items[].sections[].text`. */
function textoDe(json) {
  const items = json?.tasks?.[0]?.result?.[0]?.items ?? json?.items ?? []
  return items
    .flatMap((item) =>
      (item?.sections ?? []).map((s) => (typeof s?.text === "string" ? s.text : "")),
    )
    .join("\n")
}

/** Sinais de forma, contados - nao adivinhados. */
function forma(texto) {
  const linhas = texto.split(/\r?\n/)
  const numeradas = linhas.filter((l) => /^\s*\d+[.)]\s+\S/.test(l))
  const bullets = linhas.filter((l) => /^\s*[-*\u2022]\s+\S/.test(l))
  const titulos = linhas.filter((l) => /^\s*#{1,4}\s+\S/.test(l))
  const negritos = texto.match(/\*\*([^*\n]{2,80})\*\*/g) ?? []
  return {
    chars: texto.length,
    linhas: linhas.length,
    linhas_numeradas: numeradas.length,
    linhas_bullet: bullets.length,
    titulos_markdown: titulos.length,
    trechos_em_negrito: negritos.length,
    tem_marcador_colchete: /\[\d+\]/.test(texto),
    tem_fonte_parentese: /\(\[[^\]]+\]\(https?:/.test(texto),
    primeiras_numeradas: numeradas.slice(0, 12).map((l) => l.trim()),
    primeiros_bullets: bullets.slice(0, 12).map((l) => l.trim()),
    primeiros_negritos: negritos.slice(0, 12).map((s) => s.replace(/\*\*/g, "")),
    primeiros_titulos: titulos.slice(0, 8).map((l) => l.trim()),
  }
}

const amostras = {}

for (const plataforma of PLATAFORMAS) {
  const r = await call(plataforma)
  if (!r?.json) {
    summary.veredito[plataforma] = { respondeu: false }
    continue
  }
  const texto = textoDe(r.json)
  summary.veredito[plataforma] = { respondeu: texto.length > 0, ...forma(texto) }
  amostras[plataforma] = texto.slice(0, 1500)
}

dump("31-summary-forma", summary)
writeFileSync(
  join(OUT, "32-amostras.txt"),
  PLATAFORMAS.map((p) => `===== ${p} =====\n${amostras[p] ?? "(sem texto)"}\n`).join("\n"),
  "utf8",
)

console.error(`\ngasto total: US$ ${summary.gasto}`)
console.log(JSON.stringify(summary.veredito, null, 2))
