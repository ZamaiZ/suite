// DESCARTAVEL - Task 4 do plano das ondas 2/3. Nao faz parte do app.
//
// `multi_target_metrics/live` e a unica via de Competitor Dominance viavel para
// lead brasileiro, e NUNCA foi chamada. A forma do `target` saiu da documentacao
// - a mesma fonte que ja errou duas vezes nesta etapa (o caminho de
// `annotations` e o filtro de backlinks). Por isso ela e validada antes de
// qualquer mapeador existir.
//
// Forma documentada, para conferir contra o que voltar:
//   targets: [{ key, target: [ {keyword, search_scope, search_filter, match_type}
//                            | {domain, search_scope, search_filter, include_subdomains} ] }]
//
// CONTROLE POSITIVO PRIMEIRO. `puroclean.com` vs `servpro.com` em US/en: o
// relatorio de referencia PROVA que SERVPRO domina esse espaco (88% de taxa de
// citacao contra 73%). Se a chamada responder e SERVPRO vier na frente, a forma
// esta certa E a metrica significa o que se espera. Controle vazio reprova a
// forma; controle cheio com BR vazio reprova a cobertura.
//
// Tres perguntas:
//   1. A forma do `targets` esta certa?
//   2. `brand_entities` vem preenchido em `platform: google`?
//   3. Lead brasileiro + concorrentes devolve numero comparavel?
//
// Uso:
//   node docs/auditoria/evidencias/2026-09-10-presenca-em-ia/probe-pago-3.mjs [OUT_DIR] [TETO_USD]

import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = "C:/Users/Eduardo Zamai/Documents/suite"
const OUT = process.argv[2] ?? "."
const TETO = Number(process.argv[3] ?? "0.60")
/**
 * `--offline` re-deriva o veredito dos dumps em disco, sem pagar de novo.
 *
 * Existe porque a primeira rodada custou US$ 0,21 e o defeito estava no LEITOR,
 * nao na chamada: `brand_entities_presente` testava `Boolean(array)`, e array
 * vazio e truthy. Re-pagar para corrigir a conta de um `.length` seria queimar
 * dinheiro por um erro que o payload em disco ja responde.
 */
const OFFLINE = process.argv.includes("--offline")

function env() {
  const raw = readFileSync(join(ROOT, ".env.local"), "utf8")
  const out = {}
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    const q = v[0]
    if (v.length > 1 && (q === '"' || q === "'") && v[v.length - 1] === q) v = v.slice(1, -1)
    out[m[1]] = v
  }
  return out
}

const e = env()
const auth =
  "Basic " +
  Buffer.from(`${e.DATAFORSEO_LOGIN}:${e.DATAFORSEO_PASSWORD}`, "utf8").toString("base64")

const summary = { at: new Date().toISOString(), teto_usd: TETO, traces: {}, gasto: 0, veredito: {} }

function dump(n, p) {
  writeFileSync(join(OUT, `${n}.json`), JSON.stringify(p, null, 2), "utf8")
}
function task(r) {
  return r?.json?.tasks?.[0] ?? null
}

async function call(nome, path, body) {
  if (OFFLINE) {
    const arquivo = nome === "t4_controle_us" ? "24-multi_target-controle" : "25-multi_target-brasil"
    summary.traces[nome] = { offline: true, de: `${arquivo}.json` }
    try {
      return { http: 200, json: JSON.parse(readFileSync(join(OUT, `${arquivo}.json`), "utf8")) }
    } catch {
      return null
    }
  }
  if (summary.gasto >= TETO) {
    summary.traces[nome] = { pulado: `teto de US$ ${TETO}` }
    console.error(`[teto] pulando ${nome}`)
    return null
  }
  let r
  try {
    const res = await fetch(`https://api.dataforseo.com/v3${path}`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify([body]),
    })
    r = { http: res.status, json: await res.json() }
  } catch (err) {
    r = { http: null, json: null, error: String(err) }
  }
  const t = task(r)
  const cost = typeof t?.cost === "number" ? t.cost : 0
  summary.gasto = Number((summary.gasto + cost).toFixed(6))
  summary.traces[nome] = {
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

/**
 * Um alvo = a marca por NOME na resposta + o dominio nas FONTES.
 *
 * As duas coisas medem presencas diferentes e a spec precisa das duas: ser
 * citado pelo nome no texto e ser citado como fonte com link sao respostas
 * diferentes a "a IA conhece este negocio". `include_subdomains: true` porque o
 * indice guarda `www.` - foi exatamente a forma nua que fez o filtro de
 * backlinks dar falso zero na onda 0.
 */
function alvo(key, nome, dominio) {
  return {
    key,
    target: [
      {
        keyword: nome,
        search_scope: ["answer"],
        search_filter: "include",
        match_type: "word_match",
      },
      {
        domain: dominio,
        search_scope: ["sources"],
        search_filter: "include",
        include_subdomains: true,
      },
    ],
  }
}

function anatomia(r) {
  const res = task(r)?.result?.[0] ?? null
  if (!res) return { vazio: true }
  const agg = res.aggregated_metrics ?? null
  const items = res.items ?? []
  return {
    chaves_result: Object.keys(res),
    chaves_aggregated: agg ? Object.keys(agg) : [],
    total_geral: agg?.total ?? null,
    // A pergunta 2: `brand_entities` fora do chat_gpt.
    //
    // `.length`, nao `Boolean`. A CHAVE existe em `platform: google` e vem com
    // array VAZIO - testar a chave responde "sim" para um campo que nao tem
    // dado nenhum, que e a forma mais cara de errar aqui: a tela prometeria
    // dominancia por marca pre-extraida e mostraria nada.
    brand_entities_presente: (agg?.brand_entities_title ?? []).length > 0,
    brand_entities_amostra: (agg?.brand_entities_title ?? []).slice?.(0, 8) ?? null,
    // Documentado como exclusivo do chat_gpt. Mesmo cuidado.
    search_results_domain_presente: (agg?.search_results_domain ?? []).length > 0,
    sources_domain_amostra: (agg?.sources_domain ?? []).slice?.(0, 8) ?? null,
    por_alvo: items.map((it) => ({
      key: it?.key ?? null,
      chaves: Object.keys(it ?? {}),
      mentions: it?.total?.mentions ?? null,
      ai_search_volume: it?.total?.ai_search_volume ?? null,
    })),
  }
}

// --- 1. CONTROLE: US/en, dominancia conhecida --------------------------------
const controle = await call(
  "t4_controle_us",
  "/ai_optimization/llm_mentions/multi_target_metrics/live",
  {
    platform: "google",
    location_name: "United States",
    language_code: "en",
    targets: [
      alvo("puroclean", "PuroClean", "puroclean.com"),
      alvo("servpro", "SERVPRO", "servpro.com"),
      alvo("paul_davis", "Paul Davis Restoration", "pauldavis.com"),
    ],
  },
)
if (!OFFLINE) dump("24-multi_target-controle", controle?.json ?? null)
summary.veredito.controle = anatomia(controle)

// --- 2. BRASIL: lead + duas agencias reais -----------------------------------
const brasil = await call(
  "t4_brasil",
  "/ai_optimization/llm_mentions/multi_target_metrics/live",
  {
    platform: "google",
    location_name: "Brazil",
    language_code: "pt",
    targets: [
      alvo("lead", "Busca Orgânica", "buscaorganica.com.br"),
      alvo("conversion", "Conversion", "conversion.com.br"),
      alvo("mestre", "Agência Mestre", "agenciamestre.com"),
    ],
  },
)
if (!OFFLINE) dump("25-multi_target-brasil", brasil?.json ?? null)
summary.veredito.brasil = anatomia(brasil)

// --- veredito ---------------------------------------------------------------
const reprovado = []
const c = summary.veredito.controle
const b = summary.veredito.brasil

if (c?.vazio) {
  reprovado.push(
    "t4: o CONTROLE nao devolveu resultado. A forma do `targets` esta errada, ou o endpoint nao e este. NAO e conclusao sobre o Brasil, e o mapeador nao pode ser escrito.",
  )
} else {
  const porChave = Object.fromEntries((c.por_alvo ?? []).map((a) => [a.key, a.mentions]))
  // O relatorio de referencia da SERVPRO 88% e PuroClean 73%. Se a ordem vier
  // invertida, a metrica nao significa o que a tela vai dizer que significa.
  summary.veredito.controle_ordem_esperada =
    typeof porChave.servpro === "number" &&
    typeof porChave.puroclean === "number" &&
    porChave.servpro > porChave.puroclean
  if (summary.veredito.controle_ordem_esperada === false) {
    reprovado.push(
      `t4: o controle respondeu mas a ORDEM contradiz o relatorio de referencia (servpro ${porChave.servpro} vs puroclean ${porChave.puroclean}, esperado servpro na frente). A forma funciona; o significado da metrica nao esta entendido.`,
    )
  }
}
if (!c?.vazio && c?.brand_entities_presente === false) {
  reprovado.push(
    "t4: `brand_entities` vem VAZIO em `platform: google`, como a documentacao do `top_mentioned_brands` diz. Confirma que dominancia por marca pre-extraida continua fora, e que o casamento por nome e a unica via.",
  )
}
if (!c?.vazio && b?.vazio) {
  reprovado.push(
    "t4: controle cheio, Brasil vazio. A cobertura de location nao e cobertura de dado, e a concorrencia em IA sai da onda 2b.",
  )
} else if (!b?.vazio) {
  const leadMentions = (b.por_alvo ?? []).find((a) => a.key === "lead")?.mentions ?? null
  if (leadMentions === 0 || leadMentions === null) {
    reprovado.push(
      `t4: o Brasil respondeu mas o LEAD tem ${leadMentions} mencoes. A tela precisa saber dizer "olhamos e nao ha" sem parecer falha de coleta.`,
    )
  }
}
for (const [n, t] of Object.entries(summary.traces)) {
  if (t.status_code && t.status_code !== 20000) {
    reprovado.push(`${n}: status ${t.status_code} — ${t.status_message}`)
  }
}

summary.reprovado = reprovado
dump("26-summary-multi_target", summary)
console.log(JSON.stringify(summary, null, 2))
