// DESCARTAVEL - Task 1 do plano de migracao para DataForSEO.
// Nao faz parte do app.
//
// Seis perguntas. A primeira pode matar o desenho; por isso e a primeira.
//
//   1. O `place_id` do item do Maps e o mesmo `ChIJ...` do Places?
//      Se nao for, os perfis ja vinculados deixam de casar e o desenho precisa
//      de coluna nova e migracao de reconciliacao.
//   2. O `my_business_info` aceita `location_code` de pais com
//      `keyword: place_id:...`, ou exige coordenada?
//   3. Quais os valores exatos de `work_time.current_status`?
//   4. Qual a forma exata de `work_hours.timetable`?
//   5. `location_code` de cidade melhora a busca por nome vs. codigo do pais?
//   6. O `lighthouse/live/json` devolve `viewport`, `is-on-https`,
//      `is-crawlable`, `color-contrast` e o screenshot?
//
// Uso:
//   node docs/auditoria/evidencias/2026-09-15-migracao-dataforseo/probe-migracao.mjs [OUT_DIR] [TETO_USD]
//   node ... --offline      # re-deriva o veredito dos dumps, sem pagar

import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = process.cwd()
const OUT = process.argv[2] ?? "."
const TETO = Number(process.argv[3] ?? "0.10")
const OFFLINE = process.argv.includes("--offline")

/**
 * Funeraria Benttus: a mesma empresa das ondas anteriores, para a serie
 * continuar comparavel. O `place_id` alvo e DERIVADO da propria busca - e
 * justamente isso que a pergunta 1 testa.
 */
const ALVO = {
  nome: "Funerária Benttus",
  cidade: "São Paulo",
  uf: "SP",
  estado: "São Paulo",
}
const SITE = "https://buscaorganica.com.br"

const BRASIL = 2076

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
  const tarefaResposta = corpo?.tasks?.[0]
  if (tarefaResposta?.status_code >= 40000) {
    console.log(`  ! status ${tarefaResposta.status_code}: ${tarefaResposta.status_message}`)
  }
  return corpo
}

const resultado = (corpo) => corpo?.tasks?.[0]?.result?.[0] ?? null

const linha = (titulo) => console.log(`\n=== ${titulo}`)

// --- localidades (gratuito) --------------------------------------------------

linha("P5 localidades do Brasil (gratuito)")

let localidades = null
if (OFFLINE) {
  localidades = JSON.parse(readFileSync(join(OUT, "00-locations-br.json"), "utf8"))
} else {
  const resposta = await fetch(
    "https://api.dataforseo.com/v3/serp/google/locations/BR",
    { headers: { Authorization: AUTH } },
  )
  localidades = await resposta.json()
  dump("00-locations-br", localidades)
  console.log(`http ${resposta.status} | cost US$ ${localidades.cost ?? 0}`)
}

const linhas = localidades?.tasks?.[0]?.result ?? []
console.log("total de localidades:", linhas.length)
const tipos = new Map()
for (const item of linhas) {
  tipos.set(item.location_type, (tipos.get(item.location_type) ?? 0) + 1)
}
console.log("location_type:", JSON.stringify(Object.fromEntries(tipos)))

const dobra = (valor) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()

/** Busca tolerante: primeiro segmento do nome casa a cidade, ultimo o pais. */
const cidadeLinha = linhas.find((item) => {
  const partes = String(item.location_name ?? "").split(",")
  return (
    dobra(partes[0]) === dobra(ALVO.cidade) &&
    dobra(partes.at(-1)) === "brazil" &&
    partes.length >= 2
  )
})
const cidadeCode = cidadeLinha?.location_code ?? null
console.log("linha da cidade:", JSON.stringify(cidadeLinha ?? null))
console.log("exemplos de City:", JSON.stringify(
  linhas.filter((i) => i.location_type === "City").slice(0, 3).map((i) => i.location_name),
))

// --- P1 e P5: busca por nome -------------------------------------------------

linha("P1 e P5 busca no Maps")

const buscaBase = {
  language_code: "pt",
  se_domain: "google.com.br",
  keyword: `${ALVO.nome} ${ALVO.cidade} ${ALVO.uf}`,
  depth: 20,
}

const buscaPais = await chamar("01-maps-pais", "/serp/google/maps/live/advanced", {
  ...buscaBase,
  location_code: BRASIL,
})
const itens = resultado(buscaPais)?.items ?? []
const primeiro = itens[0] ?? null

console.log("itens devolvidos:", itens.length)
console.log("P1 place_id do primeiro item:", primeiro?.place_id)
console.log(
  "P1 COMECA COM ChIJ:",
  String(primeiro?.place_id ?? "").startsWith("ChIJ"),
)
console.log("P1 campos do item:", Object.keys(primeiro ?? {}).length)
console.log("P3 current_status:", JSON.stringify(primeiro?.work_time?.current_status))
console.log(
  "P4 timetable:",
  JSON.stringify(primeiro?.work_hours?.timetable ?? primeiro?.work_time?.work_hours?.timetable ?? null).slice(0, 500),
)
console.log("P5 top 3 por PAIS:", JSON.stringify(itens.slice(0, 3).map((i) => i.title)))

let buscaCidade = null
if (cidadeCode) {
  buscaCidade = await chamar("02-maps-cidade", "/serp/google/maps/live/advanced", {
    ...buscaBase,
    location_code: cidadeCode,
  })
  console.log(
    "P5 top 3 por CIDADE:",
    JSON.stringify((resultado(buscaCidade)?.items ?? []).slice(0, 3).map((i) => i.title)),
  )
} else {
  console.log("P5 sem codigo de cidade - pulado")
}

// --- P2: my_business_info sem coordenada -------------------------------------

linha("P2 my_business_info com location_code de pais")

const alvoPlaceId = primeiro?.place_id
if (!alvoPlaceId) {
  console.log("sem place_id do Maps - P2 nao pode rodar")
} else {
  const infoPais = await chamar(
    "03-info-pais",
    "/business_data/google/my_business_info/live",
    {
      language_code: "pt",
      keyword: `place_id:${alvoPlaceId}`,
      location_code: BRASIL,
    },
  )
  const itemInfo = resultado(infoPais)?.items?.[0] ?? null
  console.log("P2 SEM COORDENADA FUNCIONOU:", itemInfo?.type === "google_business_info")
  console.log("P2 status_message:", infoPais?.tasks?.[0]?.status_message)
  console.log("P2 lat/long na resposta:", itemInfo?.latitude, itemInfo?.longitude)
  console.log("P3 current_status (info):", JSON.stringify(itemInfo?.work_time?.current_status))
  console.log(
    "P4 timetable (info):",
    JSON.stringify(itemInfo?.work_time?.work_hours?.timetable ?? itemInfo?.work_hours?.timetable ?? null).slice(0, 700),
  )
  console.log("P2 campos do item:", JSON.stringify(Object.keys(itemInfo ?? {})))

  if (itemInfo) {
    writeFileSync(
      join(ROOT, "lib/leads/gbp-business-info.fixture.json"),
      JSON.stringify(itemInfo, null, 2),
    )
    console.log("fixture gravada: lib/leads/gbp-business-info.fixture.json")
  }
}

// --- P6: lighthouse ----------------------------------------------------------

linha("P6 lighthouse")

const lh = await chamar("04-lighthouse", "/on_page/lighthouse/live/json", {
  url: SITE,
  for_mobile: true,
  categories: ["performance", "accessibility", "best_practices", "seo"],
})
const lhResult = resultado(lh)
const audits = lhResult?.audits ?? lhResult?.lighthouseResult?.audits ?? {}
console.log("P6 chaves do resultado:", JSON.stringify(Object.keys(lhResult ?? {})).slice(0, 300))
for (const chave of [
  "viewport",
  "is-on-https",
  "is-crawlable",
  "color-contrast",
  "final-screenshot",
  "largest-contentful-paint",
  "cumulative-layout-shift",
  "interaction-to-next-paint",
]) {
  console.log(`P6 ${chave}:`, chave in audits ? "presente" : "AUSENTE")
}
console.log(
  "P6 loadingExperience (esperado AUSENTE):",
  "loadingExperience" in (lhResult ?? {}),
)

// --- fixtures ----------------------------------------------------------------

if (itens.length > 0) {
  writeFileSync(
    join(ROOT, "lib/leads/gbp-maps-candidate.fixture.json"),
    JSON.stringify({ items: itens.slice(0, 3) }, null, 2),
  )
  console.log("\nfixture gravada: lib/leads/gbp-maps-candidate.fixture.json")
}

console.log(`\nTOTAL: US$ ${gasto.toFixed(5)}`)
