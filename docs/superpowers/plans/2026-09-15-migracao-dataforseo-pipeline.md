# Migração para DataForSEO — Pipeline de Oportunidades — Plano de Implementação

> **Para executores agênticos:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar task a task. Os passos usam checkbox (`- [ ]`).

**Goal:** Trocar o Google Places pelo DataForSEO na busca e no vínculo de perfil do Google, unificando vínculo e coleta numa etapa só.

**Architecture:** A busca vira uma chamada explícita a `serp/google/maps/live/advanced`, cujo item já carrega os 33 campos do perfil. A seleção dispara `business_data/google/my_business_info/live`, que devolve snapshot **e** enrichment no mesmo item, mais Q&A live e os dois `task_post` de avaliações e postagens — tudo numa action só, `collectGbpProfile`, compartilhada entre vínculo e recoleta. O tipo `GbpSnapshot` não muda de forma: os mapeadores traduzem na entrada.

**Tech Stack:** Next.js (App Router, Server Actions), TypeScript, Supabase, DataForSEO API v3, `node --test` sobre `.mjs`.

**Spec:** `../specs/2026-09-15-migracao-dataforseo-design.md`

**Cobre as ondas 0, 1 e 2 da spec.** Briefing e mapa estão em
`2026-09-15-migracao-dataforseo-briefing-mapa.md`; Lighthouse e a limpeza final
em `2026-09-15-migracao-dataforseo-lighthouse.md`.

## Global Constraints

- **Módulo testável não usa alias nem `server-only`.** Os testes são `.mjs`
  rodados por `node --test` e importam o `.ts` direto. Import relativo **com
  extensão** (`"./website.ts"`), nunca `"@/lib/..."`. De `lib/leads/gbp.ts` só
  se importa com `import type`, que o Node apaga na remoção de tipos. É o que
  `lib/dataforseo/maps-task.ts` já faz e documenta.
- **Nenhuma task commita.** Escreva os arquivos e pare. O `git` é do dono do
  repositório.
- **Verificação uma vez, no fim.** Não rode `tsc` nem `lint` entre tasks. Os
  testes `.mjs` da própria task, sim — eles são o ciclo da task. A bateria
  completa é a Task 13.
- **Idioma:** todo texto de interface, comentário e mensagem de erro em
  português do Brasil, como o resto do repositório.
- **Custo:** a Task 1 gasta dinheiro real. Teto de US$ 0,10, imposto pelo
  próprio script. Nenhuma outra task chama a API paga.
- **Roda um teste só assim:**
  `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/caminho/arquivo.test.mjs`

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `docs/auditoria/evidencias/2026-09-15-migracao-dataforseo/probe-migracao.mjs` | sondagem descartável, seis perguntas | 1 |
| `docs/auditoria/evidencias/2026-09-15-migracao-dataforseo/README.md` | as respostas medidas | 1 |
| `lib/leads/gbp-maps-candidate.fixture.json` | item real de `maps_search` | 1 |
| `lib/leads/gbp-business-info.fixture.json` | item real de `google_business_info` | 1 |
| `lib/locationiq/city-key.ts` | consulta e chave de cache do centroide, **puro** | 2 |
| `lib/locationiq/client.ts` | geocoding no LocationIQ | 2 |
| `lib/locationiq/city-center.ts` | cidade + UF → centroide, com cache | 2 |
| `lib/leads/gbp-maps-candidate.ts` | item do Maps → candidato da lista, **puro** | 3 |
| `lib/dataforseo/maps-search.ts` | a chamada de busca | 4 |
| `lib/leads/gbp-business-info-map.ts` | `google_business_info` → `GbpSnapshot`, **puro** | 5 |
| `app/actions/leads/gbp-collect.ts` | `collectGbpProfile`, a coleta completa | 6 |
| `app/actions/leads/search-places.ts` | action de busca | 7 |
| `app/actions/leads/link-gbp-profile.ts` | vínculo unificado | 8 |
| `components/custom/LeadGbpPanel/LeadGbpPlacePicker.tsx` | busca explícita, lista rica | 9 |
| `app/actions/leads/recollect-gbp-profile.ts` | recoleta | 10 |
| `app/actions/leads/check-gbp-ranking.ts` | sem fallback ao Places | 11 |
| `lib/leads/gbp.ts` | regra `no_photos`, rótulo, `GBP_SEARCH_MIN_CHARS` | 12 |

**Deletados:** `app/actions/leads/suggest-places.ts` (Task 7),
`app/actions/leads/refresh-gbp-profile.ts` e
`app/actions/leads/enrich-gbp-profile.ts` (Task 10).

---

## Task 1: Onda 0 — sondagem antes de mapeador

Esta task gasta dinheiro e produz as duas fixtures que travam as Tasks 3 e 5.
Ela existe porque o repositório já pagou o preço de supor forma de payload: o
`mapRankedKeywordsLiveResult` viveu seis meses contra documentação e três campos
estavam errados quando enfim rodou. Ver
`../../auditoria/2026-09-04-impedimentos-dataforseo.md`.

**Files:**
- Create: `docs/auditoria/evidencias/2026-09-15-migracao-dataforseo/probe-migracao.mjs`
- Create: `docs/auditoria/evidencias/2026-09-15-migracao-dataforseo/README.md`
- Create: `lib/leads/gbp-maps-candidate.fixture.json`
- Create: `lib/leads/gbp-business-info.fixture.json`

**Interfaces:**
- Consumes: nada.
- Produces: as duas fixtures, e as respostas das seis perguntas no README.

- [ ] **Step 1: Escrever o script de sondagem**

Crie `docs/auditoria/evidencias/2026-09-15-migracao-dataforseo/probe-migracao.mjs`:

```js
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
 * continuar comparavel. O `place_id` vem do Places, de proposito - e ele que
 * a pergunta 1 testa.
 */
const ALVO = {
  nome: "Funerária Benttus",
  cidade: "São Paulo",
  uf: "SP",
  placeId: "ChIJVVVVVVVVVVVVVVVVVVVVVVV",
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

async function chamar(nome, caminho, tarefa) {
  if (OFFLINE) return JSON.parse(readFileSync(join(OUT, `${nome}.json`), "utf8"))
  if (gasto >= TETO) throw new Error(`teto de US$ ${TETO} atingido em ${nome}`)

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
  writeFileSync(join(OUT, `${nome}.json`), JSON.stringify(corpo, null, 2))
  console.log(`${nome}: cost US$ ${corpo.cost ?? 0} | acumulado US$ ${gasto.toFixed(5)}`)
  return corpo
}

const resultado = (corpo) => corpo?.tasks?.[0]?.result?.[0] ?? null

// --- P1 e P5: busca por nome, com codigo de cidade e com codigo de pais ------

const buscaBase = {
  language_code: "pt",
  se_domain: "google.com.br",
  keyword: `${ALVO.nome} ${ALVO.cidade} ${ALVO.uf}`,
  depth: 20,
}

const localidades = OFFLINE
  ? null
  : await fetch("https://api.dataforseo.com/v3/serp/google/locations/BR", {
      headers: { Authorization: AUTH },
    }).then((r) => r.json())
if (localidades) {
  writeFileSync(join(OUT, "00-locations-br.json"), JSON.stringify(localidades, null, 2))
}

const cidadeCode =
  localidades?.tasks?.[0]?.result?.find(
    (linha) => linha.location_name === `${ALVO.cidade},State of ${ALVO.cidade},Brazil`,
  )?.location_code ?? null
console.log("P5 codigo de cidade encontrado:", cidadeCode)

const buscaPais = await chamar("01-maps-pais", "/serp/google/maps/live/advanced", {
  ...buscaBase,
  location_code: BRASIL,
})
const buscaCidade = cidadeCode
  ? await chamar("02-maps-cidade", "/serp/google/maps/live/advanced", {
      ...buscaBase,
      location_code: cidadeCode,
    })
  : null

const itens = resultado(buscaPais)?.items ?? []
const primeiro = itens[0] ?? null
console.log("P1 place_id do item do Maps:", primeiro?.place_id)
console.log("P1 comeca com ChIJ:", String(primeiro?.place_id ?? "").startsWith("ChIJ"))
console.log("P3 current_status:", primeiro?.work_time?.current_status)
console.log("P4 timetable:", JSON.stringify(primeiro?.work_hours?.timetable ?? null).slice(0, 400))
console.log(
  "P5 top 3 por pais:",
  itens.slice(0, 3).map((i) => i.title),
)
console.log(
  "P5 top 3 por cidade:",
  (resultado(buscaCidade)?.items ?? []).slice(0, 3).map((i) => i.title),
)

// --- P2: my_business_info com codigo de pais, sem coordenada ----------------

const alvoPlaceId = primeiro?.place_id ?? ALVO.placeId

const infoPais = await chamar("03-info-pais", "/business_data/google/my_business_info/live", {
  language_code: "pt",
  keyword: `place_id:${alvoPlaceId}`,
  location_code: BRASIL,
})
const itemInfo = resultado(infoPais)?.items?.[0] ?? null
console.log("P2 sem coordenada funcionou:", itemInfo?.type === "google_business_info")
console.log("P2 status_message:", infoPais?.tasks?.[0]?.status_message)
console.log("P2 tem coordenada na resposta:", itemInfo?.latitude, itemInfo?.longitude)

// --- P6: lighthouse ---------------------------------------------------------

const lh = await chamar("04-lighthouse", "/on_page/lighthouse/live/json", {
  url: SITE,
  for_mobile: true,
  categories: ["performance", "accessibility", "best_practices", "seo"],
})
const audits = resultado(lh)?.audits ?? {}
for (const chave of ["viewport", "is-on-https", "is-crawlable", "color-contrast", "final-screenshot"]) {
  console.log(`P6 ${chave}:`, chave in audits ? "presente" : "AUSENTE")
}
console.log(
  "P6 loadingExperience (esperado ausente):",
  "loadingExperience" in (resultado(lh) ?? {}),
)

// --- fixtures ---------------------------------------------------------------

if (primeiro) {
  writeFileSync(
    join(ROOT, "lib/leads/gbp-maps-candidate.fixture.json"),
    JSON.stringify({ items: itens.slice(0, 3) }, null, 2),
  )
}
if (itemInfo) {
  writeFileSync(
    join(ROOT, "lib/leads/gbp-business-info.fixture.json"),
    JSON.stringify(itemInfo, null, 2),
  )
}

console.log(`\nTOTAL: US$ ${gasto.toFixed(5)}`)
```

- [ ] **Step 2: Rodar a sondagem**

```bash
node docs/auditoria/evidencias/2026-09-15-migracao-dataforseo/probe-migracao.mjs docs/auditoria/evidencias/2026-09-15-migracao-dataforseo 0.10
```

Esperado: cinco JSONs salvos, as duas fixtures criadas, custo total abaixo de
US$ 0,10 impresso no fim.

- [ ] **Step 3: PARE se a pergunta 1 reprovar**

Se `P1 comeca com ChIJ` imprimir `false`, **não siga para a Task 2.** O desenho
supõe que o `place_id` do DataForSEO e o do Places são o mesmo identificador; se
não forem, `lead_gbp_profiles.place_id` precisa de coluna irmã e de migração de
reconciliação, e isso é decisão do dono do repositório, não da execução do
plano. Relate e pare.

- [ ] **Step 4: Escrever o README com as respostas**

Crie `docs/auditoria/evidencias/2026-09-15-migracao-dataforseo/README.md` com uma
seção por pergunta, cada uma dizendo **o que foi medido** e **o que a medição
decide**, no formato de `evidencias/2026-09-11-lista-ordenada/README.md`.
Registre o custo total real.

Registre explicitamente, porque as Tasks 3 e 5 dependem:

- o valor literal de `work_time.current_status` que voltou;
- a forma literal de `work_hours.timetable` (nomes das chaves de dia, formato de
  `open`/`close`);
- se `my_business_info` aceitou `location_code` de país sem coordenada;
- se o código de cidade mudou o top 3 da busca.

---

## Task 2: Cliente do LocationIQ e centroide de cidade

**Substituiu a Task 2 original**, que gerava uma tabela de `location_code` por
cidade. A onda 0 reprovou aquele desenho em 2026-09-15: código de país devolve
Bahia para uma busca de São Paulo, código de tipo `City` devolve o interior, e a
cidade na keyword não desempata — `"Otica Diniz Guarulhos SP"` voltou uma ótica
no Rio de Janeiro. O que centra a busca é `location_coordinate`, e o DataForSEO
não geocodifica. Ver
`../../auditoria/evidencias/2026-09-15-migracao-dataforseo/README.md`, P5.

**Files:**
- Create: `lib/locationiq/city-key.ts`
- Create: `lib/locationiq/city-key.test.mjs`
- Create: `lib/locationiq/city-center.ts`
- Create: `lib/locationiq/client.ts`
- Create: `lib/locationiq/index.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `cityCenterQuery(city: string, stateCode: string): string` — **puro**, em `city-key.ts`
  - `cityCenterCacheKey(city: string, stateCode: string): string` — **puro**, em `city-key.ts`
  - `type LocationIqResult<T> = { status: "ok"; data: T } | { status: "error"; message: string }`
  - `type Coordinates = { latitude: number; longitude: number }`
  - `geocodeAddressText(address: string): Promise<LocationIqResult<Coordinates>>`
  - `cityCenter(city: string | null, stateCode: string | null): Promise<LocationIqResult<Coordinates>>`

> O `client.ts` nasce aqui, e não na onda 3 como o desenho original previa — é a
> busca que passou a precisar dele. O plano
> `2026-09-15-migracao-dataforseo-briefing-mapa.md` passa a só acrescentar o
> `autocompleteAddresses` a um arquivo que já existe.

- [ ] **Step 1: Declarar as variáveis de ambiente**

Em `.env.example`, acrescente:

```
# ── LocationIQ ─────────────────────────────────────────────────────────────────
# Provider de geocoding, autocomplete de endereço e tiles de mapa. O DataForSEO
# não tem produto para nenhum dos três. Plano gratuito: 5.000 requisições/dia,
# uso comercial permitido.
#
# São DOIS tokens, e os dois são "Data API token" no painel — o que muda entre
# eles são as PERMISSÕES marcadas e a restrição por referrer. A separação existe
# porque um vai ao navegador e o outro não:
#   - LOCATIONIQ_API_KEY: só GEOCODING marcado, sem referrer. Nunca sai daqui.
#   - NEXT_PUBLIC_LOCATIONIQ_MAPS_KEY: só Vector e Raster Map Tiles marcados, e
#     HTTP Referrers preenchido. Fica visível no HTML — restrito por referrer e
#     sem geocoding, não serve para mais nada se for copiado.
LOCATIONIQ_API_KEY=<your-locationiq-api-token>
NEXT_PUBLIC_LOCATIONIQ_MAPS_KEY=<your-locationiq-maps-access-token>
```

**Pare aqui e peça a chave ao dono do repositório** se `LOCATIONIQ_API_KEY`
ainda não estiver no `.env.local`. Sem ela a busca de estabelecimento não roda —
o código fica escrito e testado, mas a verificação visual da Task 13 não fecha.

- [ ] **Step 2: Escrever o teste que falha**

Crie `lib/locationiq/city-key.test.mjs`:

```js
import assert from "node:assert/strict"
import { test } from "node:test"

import { cityCenterCacheKey, cityCenterQuery } from "./city-key.ts"

test("a consulta identifica o município sem ambiguidade", () => {
  assert.equal(
    cityCenterQuery("Guarulhos", "SP"),
    "Guarulhos, SP, Brasil",
  )
})

test("acento e espaço extra não mudam a consulta enviada", () => {
  // O acento FICA: é o nome real do município, e o geocoder lida melhor com ele
  // do que com a forma dobrada.
  assert.equal(
    cityCenterQuery("  São   Paulo ", "sp"),
    "São Paulo, SP, Brasil",
  )
})

test("a chave de cache dobra acento e caixa, para não buscar duas vezes o mesmo", () => {
  assert.equal(cityCenterCacheKey("São Paulo", "SP"), "sao paulo|SP")
  assert.equal(
    cityCenterCacheKey("sao  paulo", "sp"),
    cityCenterCacheKey("São Paulo", "SP"),
  )
})

test("cidade homônima em UF diferente não colide no cache", () => {
  assert.notEqual(
    cityCenterCacheKey("Bom Jesus", "PI"),
    cityCenterCacheKey("Bom Jesus", "RS"),
  )
})
```

- [ ] **Step 3: Rodar e ver falhar**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/locationiq/city-key.test.mjs
```

Esperado: FAIL com `Cannot find module './city-key.ts'`.

- [ ] **Step 4: Implementar o cliente**

Crie `lib/locationiq/client.ts`:

```ts
import "server-only"

const SEARCH = "https://us1.locationiq.com/v1/search"
const TIMEOUT_MS = 8_000

export const LOCATIONIQ_UNCONFIGURED =
  "A busca de endereços não está configurada."
const FAILED = "Não foi possível consultar o endereço. Tente novamente."
const NOT_FOUND = "Não foi possível localizar este endereço no mapa."

export type LocationIqResult<T> =
  { status: "ok"; data: T } | { status: "error"; message: string }

export type Coordinates = { latitude: number; longitude: number }

export function locationIqKey(): string | null {
  const key = process.env.LOCATIONIQ_API_KEY
  return typeof key === "string" && key.trim().length > 0 ? key.trim() : null
}

/**
 * O LocationIQ devolve `lat` e `lon` como **string**. `Number("")` é `0`, e
 * `0,0` é um ponto no Golfo da Guiné — por isso o vazio morre antes da
 * conversão, e não depois.
 */
export function asCoordinate(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value !== "string" || value.trim().length === 0) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function getLocationIq<T>(
  url: URL,
): Promise<LocationIqResult<T>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    })
    // 404 é o "não achei" do LocationIQ, não falha de rede.
    if (response.status === 404) {
      return { status: "error", message: NOT_FOUND }
    }
    if (!response.ok) return { status: "error", message: FAILED }
    return { status: "ok", data: (await response.json()) as T }
  } catch {
    return { status: "error", message: FAILED }
  } finally {
    clearTimeout(timer)
  }
}

export async function geocodeAddressText(
  address: string,
): Promise<LocationIqResult<Coordinates>> {
  const key = locationIqKey()
  if (!key) return { status: "error", message: LOCATIONIQ_UNCONFIGURED }

  const query = address.trim()
  if (query.length < 3) {
    return {
      status: "error",
      message: "Informe um endereço completo para localizar no mapa.",
    }
  }

  const url = new URL(SEARCH)
  url.searchParams.set("key", key)
  url.searchParams.set("q", query)
  url.searchParams.set("format", "json")
  url.searchParams.set("countrycodes", "br")
  url.searchParams.set("limit", "1")

  const result = await getLocationIq<unknown[]>(url)
  if (result.status === "error") return result

  const first = Array.isArray(result.data) ? result.data[0] : null
  if (!first || typeof first !== "object") {
    return { status: "error", message: NOT_FOUND }
  }
  const row = first as Record<string, unknown>
  const latitude = asCoordinate(row.lat)
  const longitude = asCoordinate(row.lon)
  if (latitude === null || longitude === null) {
    return { status: "error", message: NOT_FOUND }
  }

  return { status: "ok", data: { latitude, longitude } }
}
```

- [ ] **Step 5: Implementar as duas funções puras**

Crie `lib/locationiq/city-key.ts` — **sem import nenhum**, que é o que o torna
carregável pelo `node --test`:

```ts
/**
 * As duas decisões puras do centroide: o texto que vai ao geocoder e a chave do
 * cache. Separadas do `city-center.ts` porque ele importa o cliente por alias,
 * e um `import` estático é resolvido no carregamento — com ele junto, o teste
 * `.mjs` nem abriria o arquivo.
 */

/** O acento fica: é o nome real do município, e o geocoder prefere assim. */
export function cityCenterQuery(city: string, stateCode: string): string {
  const cidade = city.trim().replace(/\s+/g, " ")
  return `${cidade}, ${stateCode.trim().toUpperCase()}, Brasil`
}

/** A chave dobra acento e caixa, para não pagar duas vezes pelo mesmo lugar. */
export function cityCenterCacheKey(city: string, stateCode: string): string {
  const folded = city
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
  return `${folded}|${stateCode.trim().toUpperCase()}`
}
```

- [ ] **Step 6: Implementar o centroide**

Crie `lib/locationiq/city-center.ts`:

```ts
import "server-only"

/**
 * Centroide da cidade do lead, para centrar a busca de estabelecimento.
 *
 * **Por que isto existe:** o `serp/google/maps` exige uma localização, e a onda
 * 0 mediu que `location_code` não serve — nem o do país, que devolveu Bahia
 * para uma busca de São Paulo, nem o de tipo `City`, que devolveu o interior.
 * Só `location_coordinate` centra. E o DataForSEO não geocodifica.
 *
 * **O cache é do processo, e basta.** Centroide de município não muda, a chave
 * é cidade + UF, e a alternativa — tabela das 5.570 sedes no repositório —
 * pagaria em manutenção o que economiza numa chamada gratuita.
 */

import {
  geocodeAddressText,
  type Coordinates,
  type LocationIqResult,
} from "@/lib/locationiq/client"
import {
  cityCenterCacheKey,
  cityCenterQuery,
} from "@/lib/locationiq/city-key"

const cache = new Map<string, Coordinates>()

const CITY_REQUIRED =
  "Preencha cidade e estado do lead para buscar o estabelecimento."

export async function cityCenter(
  city: string | null,
  stateCode: string | null,
): Promise<LocationIqResult<Coordinates>> {
  if (!city?.trim() || !stateCode?.trim()) {
    return { status: "error", message: CITY_REQUIRED }
  }

  const key = cityCenterCacheKey(city, stateCode)
  const cached = cache.get(key)
  if (cached) return { status: "ok", data: cached }

  const geocoded = await geocodeAddressText(cityCenterQuery(city, stateCode))
  if (geocoded.status === "error") return geocoded

  cache.set(key, geocoded.data)
  return geocoded
}
```

- [ ] **Step 7: Criar a superfície pública**

Crie `lib/locationiq/index.ts`:

```ts
export {
  LOCATIONIQ_UNCONFIGURED,
  geocodeAddressText,
  locationIqKey,
  type Coordinates,
  type LocationIqResult,
} from "./client"
export { cityCenter } from "./city-center"
export { cityCenterCacheKey, cityCenterQuery } from "./city-key"
```

- [ ] **Step 8: Rodar e ver passar**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/locationiq/city-key.test.mjs
```

Esperado: `# pass 4`.

---

## Task 3: Mapeador do item do Maps

**Files:**
- Create: `lib/leads/gbp-maps-candidate.ts`
- Create: `lib/leads/gbp-maps-candidate.test.mjs`
- Usa: `lib/leads/gbp-maps-candidate.fixture.json` (Task 1)

**Interfaces:**
- Consumes: a fixture da Task 1.
- Produces:
  - `type GbpPlaceCandidate = { placeId, title, address, category, rating, votes, phone, domain, isClaimed, latitude, longitude }`
  - `mapGbpPlaceCandidates(result: Record<string, unknown> | null): GbpPlaceCandidate[]`

- [ ] **Step 1: Abrir a fixture e conferir os nomes dos campos**

```bash
node -e "const f=require('./lib/leads/gbp-maps-candidate.fixture.json'); console.log(Object.keys(f.items[0]))"
```

Confira que existem `place_id`, `title`, `address`, `category`, `rating`,
`phone`, `domain`, `is_claimed`, `latitude`, `longitude`. Se algum nome divergir,
use o nome real — a fixture manda, não este plano.

- [ ] **Step 2: Escrever o teste que falha**

Crie `lib/leads/gbp-maps-candidate.test.mjs`:

```js
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { mapGbpPlaceCandidates } from "./gbp-maps-candidate.ts"

/**
 * Item real de `serp/google/maps/live/advanced`, colhido em 2026-09-15.
 *
 * Existe porque o item do Maps traz 33 campos e o mapeador antigo lia três.
 * A lista do picker passa a mostrar perfil, não nome — e é este arquivo que
 * impede a próxima suposição de forma de sobreviver sem execução.
 */
const FIXTURE = JSON.parse(
  readFileSync(new URL("./gbp-maps-candidate.fixture.json", import.meta.url), "utf8"),
)

test("lê o candidato com os campos que a lista mostra", () => {
  const [primeiro] = mapGbpPlaceCandidates(FIXTURE)
  assert.ok(primeiro.placeId.startsWith("ChIJ"))
  assert.ok(primeiro.title.length > 0)
  assert.equal(typeof primeiro.latitude, "number")
  assert.equal(typeof primeiro.longitude, "number")
})

test("item sem place_id ou sem título é descartado", () => {
  const sujo = {
    items: [
      { type: "maps_search", title: "Sem id" },
      { type: "maps_search", place_id: "ChIJabc", title: null },
      ...FIXTURE.items,
    ],
  }
  assert.equal(mapGbpPlaceCandidates(sujo).length, FIXTURE.items.length)
})

test("ignora item que não é maps_search", () => {
  const misturado = { items: [{ type: "maps_paid", place_id: "ChIJx", title: "Anúncio" }] }
  assert.deepEqual(mapGbpPlaceCandidates(misturado), [])
})

test("resultado nulo ou sem items vira lista vazia, nunca erro", () => {
  assert.deepEqual(mapGbpPlaceCandidates(null), [])
  assert.deepEqual(mapGbpPlaceCandidates({}), [])
  assert.deepEqual(mapGbpPlaceCandidates({ items: "nada" }), [])
})

test("a nota vem de rating.value e o volume de rating.votes_count", () => {
  const um = {
    items: [
      {
        type: "maps_search",
        place_id: "ChIJabc",
        title: "Alvo",
        rating: { value: 4.7, votes_count: 312 },
      },
    ],
  }
  const [candidato] = mapGbpPlaceCandidates(um)
  assert.equal(candidato.rating, 4.7)
  assert.equal(candidato.votes, 312)
})
```

- [ ] **Step 3: Rodar e ver falhar**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/leads/gbp-maps-candidate.test.mjs
```

Esperado: FAIL com `Cannot find module './gbp-maps-candidate.ts'`.

- [ ] **Step 4: Implementar**

Crie `lib/leads/gbp-maps-candidate.ts`:

```ts
/**
 * Item de `serp/google/maps/live/advanced` → candidato da lista de busca.
 *
 * Puro e sem alias, para rodar no `node --test`.
 *
 * A lista mostra perfil, não nome. Medido em 2026-09-09 e registrado em
 * `../../docs/auditoria/2026-09-04-impedimentos-dataforseo.md`: o item traz 33
 * campos na mesma resposta paga. Escolher o estabelecimento certo entre
 * homônimos é o que evita o vínculo errado, e nome e endereço não bastam para
 * isso em rede de franquia.
 */

export type GbpPlaceCandidate = {
  placeId: string
  title: string
  address: string | null
  category: string | null
  rating: number | null
  votes: number | null
  phone: string | null
  domain: string | null
  isClaimed: boolean | null
  latitude: number | null
  longitude: number | null
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function mapGbpPlaceCandidates(
  result: Record<string, unknown> | null,
): GbpPlaceCandidate[] {
  const items = result?.items
  if (!Array.isArray(items)) return []

  return items.flatMap((entry) => {
    const item = record(entry)
    if (!item || item.type !== "maps_search") return []
    const placeId = asString(item.place_id)
    const title = asString(item.title)
    if (!placeId || !title) return []

    const rating = record(item.rating)
    return [
      {
        placeId,
        title,
        address: asString(item.address),
        category: asString(item.category),
        rating: asNumber(rating?.value),
        votes: asNumber(rating?.votes_count),
        phone: asString(item.phone),
        domain: asString(item.domain),
        isClaimed: asBoolean(item.is_claimed),
        latitude: asNumber(item.latitude),
        longitude: asNumber(item.longitude),
      },
    ]
  })
}
```

- [ ] **Step 5: Rodar e ver passar**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/leads/gbp-maps-candidate.test.mjs
```

Esperado: `# pass 5`.

---

## Task 4: A chamada de busca

Sem teste próprio: é I/O puro sobre um mapeador já testado, exatamente como
`lib/dataforseo/google-maps.ts` já é.

**Files:**
- Create: `lib/dataforseo/maps-search.ts`

**Interfaces:**
- Consumes: `postDataForSeo`, `GBP_MAPS_SE_DOMAIN`, `GBP_MAPS_LANGUAGE_CODE`,
  `googleMapsCoordinate` de `maps-task.ts`; `mapGbpPlaceCandidates` da Task 3.
- Produces:
  - `GBP_SEARCH_DEPTH: number`, `GBP_SEARCH_ZOOM: number`
  - `searchGooglePlaces(input: { query: string; latitude: number; longitude: number }): Promise<{ status: "ok"; candidates: GbpPlaceCandidate[] } | { status: "error"; message: string }>`

- [ ] **Step 1: Implementar**

Crie `lib/dataforseo/maps-search.ts`:

```ts
import "server-only"

import { postDataForSeo } from "@/lib/dataforseo/client"
import {
  GBP_MAPS_LANGUAGE_CODE,
  GBP_MAPS_SE_DOMAIN,
  googleMapsCoordinate,
} from "@/lib/dataforseo/maps-task"
import {
  mapGbpPlaceCandidates,
  type GbpPlaceCandidate,
} from "@/lib/leads/gbp-maps-candidate"

/**
 * Profundidade da busca de estabelecimento.
 *
 * Deliberadamente igual ao `GBP_MAPS_DEPTH` do ranking em valor, e separada em
 * nome: são duas perguntas diferentes — "quem aparece para esta keyword" e
 * "qual destes é o meu lead" — e amarrá-las faria uma mudar quando a outra
 * precisasse. `depth: 20` custou US$ 0,002, o preço de tabela, medido.
 */
export const GBP_SEARCH_DEPTH = 20

/**
 * Zoom 12, e não o 15 da malha. Medido em 2026-09-15 com "Otica Diniz" no
 * centroide de Guarulhos: o 15 devolveu 4 resultados, todos na cidade, e o 12
 * devolveu 20 começando por ela. A busca quer candidatos suficientes para o
 * analista reconhecer o certo — recortar cedo esconde a filial que ele procura.
 */
export const GBP_SEARCH_ZOOM = 12

export type SearchGooglePlacesResult =
  | { status: "ok"; candidates: GbpPlaceCandidate[] }
  | { status: "error"; message: string }

export async function searchGooglePlaces(input: {
  query: string
  latitude: number
  longitude: number
}): Promise<SearchGooglePlacesResult> {
  const posted = await postDataForSeo<Record<string, unknown>>(
    "/serp/google/maps/live/advanced",
    {
      language_code: GBP_MAPS_LANGUAGE_CODE,
      se_domain: GBP_MAPS_SE_DOMAIN,
      keyword: input.query,
      depth: GBP_SEARCH_DEPTH,
      // Coordenada, e não `location_code`. A onda 0 mediu que o código do país
      // devolve outro estado e o de cidade devolve o interior — ver P5 em
      // `../../auditoria/evidencias/2026-09-15-migracao-dataforseo/README.md`.
      location_coordinate: googleMapsCoordinate(
        input.latitude,
        input.longitude,
        GBP_SEARCH_ZOOM,
      ),
    },
  )
  if (posted.status === "error") {
    return { status: "error", message: posted.message }
  }
  return { status: "ok", candidates: mapGbpPlaceCandidates(posted.data) }
}
```

Note que **não** se usa o `googleMapsTask`: ele acrescenta `search_this_area` e
a profundidade da malha, e a sondagem que aprovou este desenho rodou sem os
dois. Reaproveitar o construtor aqui mudaria a requisição medida.

---

## Task 5: Mapeador do `google_business_info` para `GbpSnapshot`

O coração da migração. Três funções puras, três grupos de teste.

**Files:**
- Create: `lib/leads/gbp-business-info-map.ts`
- Create: `lib/leads/gbp-business-info-map.test.mjs`
- Usa: `lib/leads/gbp-business-info.fixture.json` (Task 1)

**Interfaces:**
- Consumes: `import type { GbpSnapshot } from "./gbp.ts"`, `normalizeWebsiteDomain` de `./website.ts`, a fixture da Task 1.
- Produces:
  - `gbpBusinessStatusFromDataForSeo(currentStatus: unknown): string | null`
  - `gbpWeekdayDescriptions(workHours: unknown): string[]`
  - `snapshotFromBusinessInfo(item: Record<string, unknown>): GbpSnapshot | null`

- [ ] **Step 1: Conferir os dois formatos, que a onda 0 já mediu**

A Task 1 rodou e **reprovou a forma que a documentação sugeria**. Os caminhos
reais, registrados em
`../../auditoria/evidencias/2026-09-15-migracao-dataforseo/README.md` (P3 e P4):

| Endpoint | Caminho do status | Valor |
|---|---|---|
| `my_business_info` | `work_time.work_hours.current_status` | `"open"` |
| `serp/google/maps` | `work_hours.current_status` | `"open"` |

O `work_time` do `my_business_info` tem **uma única chave**: `work_hours`. Lido
em `work_time.current_status`, como o plano original mandava, viria `undefined`
sempre — `businessStatus` seria `null`, o gap `closed` nunca dispararia e nada
denunciaria. O mapeador abaixo já lê o caminho certo, com queda para o do Maps.

O `timetable` **confirmou** a forma suposta: dia em inglês minúsculo → lista de
`{ open: { hour, minute }, close: { hour, minute } }`.

Confirme antes de escrever:

```bash
node -e "const f=require('./lib/leads/gbp-business-info.fixture.json'); console.log(JSON.stringify(f.work_time?.work_hours?.current_status), Object.keys(f.work_time||{}))"
```

- [ ] **Step 2: Escrever o teste que falha**

Crie `lib/leads/gbp-business-info-map.test.mjs`:

```js
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import {
  gbpBusinessStatusFromDataForSeo,
  gbpWeekdayDescriptions,
  snapshotFromBusinessInfo,
} from "./gbp-business-info-map.ts"

/**
 * Item real de `business_data/google/my_business_info/live`, colhido em
 * 2026-09-15. É a única chamada da coleta que produz snapshot e enrichment
 * juntos, então é ela que sustenta a etapa única.
 */
const FIXTURE = JSON.parse(
  readFileSync(new URL("./gbp-business-info.fixture.json", import.meta.url), "utf8"),
)

test("o snapshot sai completo do item real", () => {
  const snapshot = snapshotFromBusinessInfo(FIXTURE)
  assert.ok(snapshot)
  assert.ok(snapshot.placeId.startsWith("ChIJ"))
  assert.equal(typeof snapshot.displayName, "string")
  assert.equal(typeof snapshot.latitude, "number")
  assert.equal(typeof snapshot.longitude, "number")
})

test("acha o status no caminho aninhado do my_business_info", () => {
  // A trava do achado da onda 0. Lido em `work_time.current_status` isto seria
  // null, e o gap `closed` morreria em silêncio.
  assert.equal(snapshotFromBusinessInfo(FIXTURE).businessStatus, "OPERATIONAL")
})

test("acha o status na raiz, como vem no item do Maps", () => {
  const snapshot = snapshotFromBusinessInfo({
    place_id: "ChIJabc",
    title: "Alvo",
    work_hours: { current_status: "open" },
  })
  assert.equal(snapshot.businessStatus, "OPERATIONAL")
})

test("o horário real vira sete linhas", () => {
  // A Benttus abre 24h todos os dias, então a fixture não exercita dia fechado
  // nem dois turnos — esses dois casos são sintéticos, abaixo.
  const linhas = snapshotFromBusinessInfo(FIXTURE).weekdayDescriptions
  assert.equal(linhas.length, 7)
  assert.ok(linhas[0].startsWith("segunda-feira: "))
})

test("item sem place_id não vira snapshot", () => {
  assert.equal(snapshotFromBusinessInfo({ title: "Sem id" }), null)
})

test("photoNames sai vazio e photoCount vem de total_photos", () => {
  const snapshot = snapshotFromBusinessInfo({
    place_id: "ChIJabc",
    title: "Alvo",
    total_photos: 101,
  })
  assert.deepEqual(snapshot.photoNames, [])
  assert.equal(snapshot.photoCount, 101)
})

test("sem total_photos a contagem é zero, não nula", () => {
  const snapshot = snapshotFromBusinessInfo({ place_id: "ChIJabc", title: "Alvo" })
  assert.equal(snapshot.photoCount, 0)
})

test("o status é traduzido para o vocabulário do Google", () => {
  // Medido minúsculo em 2026-09-15: o fornecedor manda "open", não "OPEN".
  assert.equal(gbpBusinessStatusFromDataForSeo("open"), "OPERATIONAL")
  assert.equal(gbpBusinessStatusFromDataForSeo("OPEN"), "OPERATIONAL")
  assert.equal(gbpBusinessStatusFromDataForSeo("CLOSE"), "OPERATIONAL")
  assert.equal(
    gbpBusinessStatusFromDataForSeo("TEMPORARILY_CLOSED"),
    "CLOSED_TEMPORARILY",
  )
  assert.equal(
    gbpBusinessStatusFromDataForSeo("PERMANENTLY_CLOSED"),
    "CLOSED_PERMANENTLY",
  )
})

test("status desconhecido vira null, e não um CLOSED inventado", () => {
  assert.equal(gbpBusinessStatusFromDataForSeo("QUALQUER_COISA"), null)
  assert.equal(gbpBusinessStatusFromDataForSeo(undefined), null)
})

test("fechado hoje não é empresa fechada", () => {
  // `CLOSE` significa "fechado agora", e virar CLOSED_* faria toda auditoria
  // noturna acusar a empresa de ter encerrado as atividades.
  assert.equal(gbpBusinessStatusFromDataForSeo("CLOSE"), "OPERATIONAL")
})

test("o horário vira uma linha por dia, na ordem da semana", () => {
  const linhas = gbpWeekdayDescriptions({
    timetable: {
      monday: [{ open: { hour: 8, minute: 0 }, close: { hour: 18, minute: 30 } }],
      sunday: null,
    },
  })
  assert.equal(linhas[0], "segunda-feira: 08:00 – 18:30")
  assert.equal(linhas.at(-1), "domingo: Fechado")
})

test("dois turnos no mesmo dia viram uma linha só", () => {
  const linhas = gbpWeekdayDescriptions({
    timetable: {
      tuesday: [
        { open: { hour: 8, minute: 0 }, close: { hour: 12, minute: 0 } },
        { open: { hour: 14, minute: 0 }, close: { hour: 18, minute: 0 } },
      ],
    },
  })
  assert.equal(
    linhas.find((linha) => linha.startsWith("terça")),
    "terça-feira: 08:00 – 12:00, 14:00 – 18:00",
  )
})

test("sem timetable não inventa horário", () => {
  assert.deepEqual(gbpWeekdayDescriptions(null), [])
  assert.deepEqual(gbpWeekdayDescriptions({}), [])
})
```

- [ ] **Step 3: Rodar e ver falhar**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/leads/gbp-business-info-map.test.mjs
```

Esperado: FAIL com `Cannot find module './gbp-business-info-map.ts'`.

- [ ] **Step 4: Implementar**

Crie `lib/leads/gbp-business-info-map.ts`:

```ts
/**
 * `google_business_info` do DataForSEO → `GbpSnapshot`.
 *
 * Puro e sem alias, para rodar no `node --test`. De `gbp.ts` só entra o tipo,
 * com `import type`, que a remoção de tipos do Node apaga — `gbp.ts` importa por
 * alias e não é carregável fora do bundler.
 *
 * **A tradução do status é deliberada.** Se o vocabulário do DataForSEO vazasse
 * para o snapshot, perfis antigos e novos passariam a significar coisas
 * diferentes na mesma coluna, e `startsWith("CLOSED")` em `gbp.ts` mudaria de
 * sentido sem que ninguém tocasse na regra.
 */

import type { GbpSnapshot } from "./gbp.ts"
import { normalizeWebsiteDomain } from "./website.ts"

/**
 * Ordem e rótulos da semana. Segunda primeiro, como o Google publica em pt-BR,
 * e não domingo — a linha do briefing é copiada para o cliente.
 */
const WEEKDAYS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "monday", label: "segunda-feira" },
  { key: "tuesday", label: "terça-feira" },
  { key: "wednesday", label: "quarta-feira" },
  { key: "thursday", label: "quinta-feira" },
  { key: "friday", label: "sexta-feira" },
  { key: "saturday", label: "sábado" },
  { key: "sunday", label: "domingo" },
]

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const text = asString(item)
    return text ? [text] : []
  })
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/**
 * `current_status` do DataForSEO → vocabulário do Places que o produto grava.
 *
 * `OPEN` e `CLOSE` são estado **do momento**, não do negócio: um perfil
 * consultado às 22h volta `CLOSE` e continua operando. Mapear isso para
 * `CLOSED_*` faria toda coleta noturna acusar encerramento de atividade.
 *
 * Valor desconhecido vira `null`, nunca um `CLOSED` de chute: ausência é
 * diferente de fechado, e só o segundo é achado.
 */
export function gbpBusinessStatusFromDataForSeo(
  currentStatus: unknown,
): string | null {
  const value = asString(currentStatus)?.toUpperCase()
  if (!value) return null
  if (value === "OPEN" || value === "CLOSE" || value === "OPEN_24") {
    return "OPERATIONAL"
  }
  if (value === "TEMPORARILY_CLOSED") return "CLOSED_TEMPORARILY"
  if (value === "PERMANENTLY_CLOSED" || value === "CLOSED") {
    return "CLOSED_PERMANENTLY"
  }
  return null
}

function clock(value: unknown): string | null {
  const slot = record(value)
  const hour = asNumber(slot?.hour)
  const minute = asNumber(slot?.minute)
  if (hour === null) return null
  const mm = String(minute ?? 0).padStart(2, "0")
  return `${String(hour).padStart(2, "0")}:${mm}`
}

/**
 * O bloco de horário, nos dois formatos que o fornecedor usa.
 *
 * `my_business_info` aninha em `work_time.work_hours`; o item do Maps põe
 * `work_hours` na raiz. Um leitor só, para o mapeador não precisar saber de
 * qual endpoint o item veio.
 */
function workHours(item: Record<string, unknown>): Record<string, unknown> | null {
  return record(record(item.work_time)?.work_hours) ?? record(item.work_hours)
}

/**
 * `work_hours.timetable` → as mesmas linhas que o Places entregava prontas.
 *
 * Sem `timetable` devolve `[]`, e não sete linhas de "Fechado": o gap
 * `missing_hours` existe para perfil que não publicou horário, e sete linhas
 * inventadas o esconderiam.
 */
export function gbpWeekdayDescriptions(hours: unknown): string[] {
  const timetable = record(record(hours)?.timetable)
  if (!timetable) return []

  return WEEKDAYS.map(({ key, label }) => {
    const slots = timetable[key]
    if (!Array.isArray(slots) || slots.length === 0) {
      return `${label}: Fechado`
    }
    const ranges = slots.flatMap((slot) => {
      const entry = record(slot)
      const open = clock(entry?.open)
      const close = clock(entry?.close)
      return open && close ? [`${open} – ${close}`] : []
    })
    return ranges.length > 0
      ? `${label}: ${ranges.join(", ")}`
      : `${label}: Fechado`
  })
}

export function snapshotFromBusinessInfo(
  item: Record<string, unknown>,
): GbpSnapshot | null {
  const placeId = asString(item.place_id)
  if (!placeId) return null

  const websiteUri = asString(item.url)
  const cid = asString(item.cid)
  const rating = record(item.rating)
  const categoryIds = asStringList(item.category_ids)

  return {
    placeId,
    displayName: asString(item.title),
    formattedAddress: asString(item.address),
    primaryType: categoryIds[0] ?? null,
    primaryTypeDisplayName: asString(item.category),
    types: categoryIds,
    // `work_time.work_hours` no `my_business_info`, `work_hours` no item do
    // Maps. Medido em 2026-09-15 — a documentação sugeria `work_time` direto,
    // e ali não há nada.
    businessStatus: gbpBusinessStatusFromDataForSeo(
      workHours(item)?.current_status,
    ),
    googleMapsUri:
      asString(item.check_url) ??
      (cid ? `https://www.google.com/maps?cid=${cid}` : null),
    nationalPhoneNumber: asString(item.phone),
    websiteUri,
    websiteDomain: websiteUri ? normalizeWebsiteDomain(websiteUri) : null,
    weekdayDescriptions: gbpWeekdayDescriptions(workHours(item)),
    rating: asNumber(rating?.value),
    userRatingCount: asNumber(rating?.votes_count),
    // `total_photos` é o total do perfil, não a amostra de dez que o Places
    // devolvia. O contador melhorou; a galeria perdeu a fonte, e isso está
    // registrado na spec como perda aceita.
    photoCount: asNumber(item.total_photos) ?? 0,
    photoNames: [],
    latitude: asNumber(item.latitude),
    longitude: asNumber(item.longitude),
  }
}
```

- [ ] **Step 5: Rodar e ver passar**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/leads/gbp-business-info-map.test.mjs
```

Esperado: `# pass 10`.

---

## Task 6: `collectGbpProfile` — a coleta completa numa função

Extrai o corpo do `enrich-gbp-profile.ts` atual para uma função reutilizável.
Nenhum comportamento muda nesta task; ela só move.

**Files:**
- Create: `app/actions/leads/gbp-collect.ts`
- Read: `app/actions/leads/enrich-gbp-profile.ts:95-173` (a origem do corpo)

**Interfaces:**
- Consumes: `snapshotFromBusinessInfo` (Task 5); `fetchGoogleBusinessInfo` reescrita para devolver o item cru; `fetchGoogleQna`, `postGoogleReviewsTask`, `postGoogleUpdatesTask`, `upsertGbpJob`, `insertGbpSnapshot` — todos já existem.
- Produces:
  - `collectGbpProfile(supabase: SupabaseClient, input: { profileId: string; placeId: string; latitude: number | null; longitude: number | null }): Promise<{ status: "ok"; snapshot: GbpSnapshot; cid: string | null } | { status: "error"; message: string }>`

> **Não precisa de cidade nem UF.** A onda 0 mediu que o `my_business_info`
> aceita `location_code: 2076` — o Brasil — com `keyword: place_id:…` e sem
> coordenada nenhuma, e ainda devolve `latitude` e `longitude` no item. Como o
> `place_id` já identifica o lugar sozinho, a localidade aqui é só o locale da
> resposta, e uma constante basta.

- [ ] **Step 1: Fazer `fetchGoogleBusinessInfo` devolver o item cru também**

Em `lib/dataforseo/google-info.ts`, o retorno `ok` passa a carregar o item, para
que o mesmo payload alimente snapshot e enrichment sem uma segunda chamada.
Troque o tipo e o retorno:

```ts
export type FetchGoogleBusinessInfoResult =
  | { status: "ok"; enrichment: GbpEnrichment; item: Record<string, unknown> }
  | { status: "not_found"; message: string }
  | { status: "error"; message: string }
```

e, no corpo, depois da guarda de `not_found`:

```ts
  return {
    status: "ok",
    enrichment: mapDataForSeoInfoItem(item, new Date().toISOString()),
    item,
  }
```

Troque também a assinatura de entrada, para aceitar perfil sem coordenada:

```ts
/** O Brasil. Medido: basta, porque o `place_id` já identifica o lugar. */
const DATAFORSEO_BRAZIL_LOCATION_CODE = 2076

export async function fetchGoogleBusinessInfo(input: {
  placeId: string
  latitude: number | null
  longitude: number | null
}): Promise<FetchGoogleBusinessInfoResult> {
  const posted = await postDataForSeo<GoogleInfoLiveResult>(
    "/business_data/google/my_business_info/live",
    {
      language_code: "pt",
      keyword: `place_id:${input.placeId}`,
      // Coordenada quando existe, código de localidade quando não. Perfil
      // recém-buscado tem lat/long vinda do item do Maps; perfil antigo, não —
      // e era o Places que resolvia isso.
      ...(input.latitude !== null && input.longitude !== null
        ? {
            location_coordinate: dataForSeoLocationCoordinate(
              input.latitude,
              input.longitude,
            ),
          }
        : { location_code: DATAFORSEO_BRAZIL_LOCATION_CODE }),
    },
  )
```

- [ ] **Step 2: Criar `gbp-collect.ts`**

```ts
import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { DATAFORSEO_COLLECT_ERROR } from "@/lib/dataforseo/client"
import { fetchGoogleBusinessInfo } from "@/lib/dataforseo/google-info"
import { fetchGoogleQna } from "@/lib/dataforseo/google-qna"
import { postGoogleReviewsTask } from "@/lib/dataforseo/google-reviews"
import { postGoogleUpdatesTask } from "@/lib/dataforseo/google-updates"
import { snapshotFromBusinessInfo } from "@/lib/leads/gbp-business-info-map"
import type { GbpSnapshot } from "@/lib/leads/gbp"
import { insertGbpSnapshot, upsertGbpJob } from "./gbp-access"

/**
 * A coleta completa de um perfil, num lugar só.
 *
 * Existia em duplicata implícita: `link` gravava o snapshot do Places e
 * `enrich` gravava o enrichment do DataForSEO, e entre os dois havia um estado
 * — perfil vinculado e nunca analisado — que as regras de gap carregavam ramos
 * para tratar. Com uma chamada produzindo os dois, o estado deixa de existir.
 */

export const GBP_COLLECT_FAILED =
  "Não foi possível coletar o perfil. Tente novamente."

const FAILED_TASK_ID = "unavailable"

export type CollectGbpProfileResult =
  | { status: "ok"; snapshot: GbpSnapshot; cid: string | null }
  | { status: "error"; message: string }

export async function collectGbpProfile(
  supabase: SupabaseClient,
  input: {
    profileId: string
    placeId: string
    latitude: number | null
    longitude: number | null
  },
): Promise<CollectGbpProfileResult> {
  const info = await fetchGoogleBusinessInfo({
    placeId: input.placeId,
    latitude: input.latitude,
    longitude: input.longitude,
  })
  if (info.status !== "ok") {
    return { status: "error", message: info.message }
  }

  const snapshot = snapshotFromBusinessInfo(info.item)
  if (!snapshot) {
    return { status: "error", message: GBP_COLLECT_FAILED }
  }

  // A coordenada do próprio item alimenta Q&A, avaliações e postagens. Quando
  // o perfil antigo não tinha nenhuma, era o Places que a devolvia; agora ela
  // vem da mesma chamada que já foi paga.
  const latitude = snapshot.latitude ?? input.latitude
  const longitude = snapshot.longitude ?? input.longitude
  if (latitude === null || longitude === null) {
    return { status: "error", message: GBP_COLLECT_FAILED }
  }

  const [qnaResult, reviewsPost, updatesPost] = await Promise.all([
    fetchGoogleQna({
      placeId: snapshot.placeId,
      latitude,
      longitude,
      establishmentTitle: snapshot.displayName,
    }),
    postGoogleReviewsTask({ placeId: snapshot.placeId, latitude, longitude }),
    postGoogleUpdatesTask({ placeId: snapshot.placeId, latitude, longitude }),
  ])

  const reviewsOk = await upsertGbpJob(
    supabase,
    input.profileId,
    "reviews",
    reviewsPost.status === "ok"
      ? { dfs_task_id: reviewsPost.data, status: "queued", error_message: null }
      : {
          dfs_task_id: FAILED_TASK_ID,
          status: "failed",
          error_message: DATAFORSEO_COLLECT_ERROR,
        },
  )
  const updatesOk = await upsertGbpJob(
    supabase,
    input.profileId,
    "updates",
    updatesPost.status === "ok"
      ? { dfs_task_id: updatesPost.data, status: "queued", error_message: null }
      : {
          dfs_task_id: FAILED_TASK_ID,
          status: "failed",
          error_message: DATAFORSEO_COLLECT_ERROR,
        },
  )
  if (!reviewsOk || !updatesOk) {
    return { status: "error", message: GBP_COLLECT_FAILED }
  }

  // Snapshot e enrichment na mesma linha, porque vieram da mesma resposta.
  // Avaliações e postagens continuam chegando pelos jobs e herdam do anterior.
  const stored = await insertGbpSnapshot(
    supabase,
    input.profileId,
    {
      payload: snapshot,
      enrichment: info.enrichment,
      qna: qnaResult.status === "ok" ? qnaResult.qna : null,
    },
    info.enrichment.fetchedAt,
  )
  if (!stored) {
    return { status: "error", message: GBP_COLLECT_FAILED }
  }

  return { status: "ok", snapshot, cid: info.enrichment.cid }
}
```

- [ ] **Step 3: Conferir que o import do tipo do Supabase existe**

```bash
node -e "console.log(require('./package.json').dependencies['@supabase/supabase-js'])"
```

Esperado: uma versão. Se `SupabaseClient` não for exportado de
`@supabase/supabase-js` nesta versão, use o mesmo import que
`app/actions/leads/gbp-access.ts` já usa — copie a linha de lá.

---

## Task 7: Action de busca

**Files:**
- Create: `app/actions/leads/search-places.ts`
- Delete: `app/actions/leads/suggest-places.ts`
- Modify: `lib/validations/lead-gbp.ts` (`suggestPlacesSchema` → `searchPlacesSchema`)
- Modify: `app/actions/leads/index.ts` (o export)

**Interfaces:**
- Consumes: `searchGooglePlaces` (Task 4), `GbpPlaceCandidate` (Task 3), `cityCenter` (Task 2), `loadGbpLeadContext`.
- Produces:
  - `searchPlaces(formData: FormData): Promise<{ status: "success"; candidates: GbpPlaceCandidate[] } | { status: "error"; message: string }>`

- [ ] **Step 1: Mudar de casa a constante do mínimo de caracteres**

Em `lib/leads/gbp.ts`, junto de `GBP_PHOTO_API_MAX`, acrescente:

```ts
/**
 * Mínimo para disparar uma busca. Veio de `lib/places`, onde era regra de
 * cobrança do autocomplete; aqui é o que evita gastar US$ 0,002 numa sílaba.
 */
export const GBP_SEARCH_MIN_CHARS = 3
```

**Não** remova `GBP_PHOTO_API_MAX`: o `readGbpSnapshot` ainda o usa para ler
linhas antigas, que têm `photoNames`.

- [ ] **Step 2: Trocar o schema**

Em `lib/validations/lead-gbp.ts`, substitua `suggestPlacesSchema` por:

```ts
export const searchPlacesSchema = z.object({
  lead_id: z.uuid("Lead inválido."),
  query: z
    .string()
    .trim()
    .min(GBP_SEARCH_MIN_CHARS, `Digite pelo menos ${GBP_SEARCH_MIN_CHARS} caracteres.`)
    .max(200, "Busca deve ter no máximo 200 caracteres."),
})

export function readSearchPlacesFields(formData: FormData) {
  return {
    lead_id: formText(formData, "lead_id"),
    query: formText(formData, "query"),
  }
}
```

O `session_token` sai: era conceito de cobrança do Places — uma sessão de
autocomplete cobrada como unidade — e não significa nada no DataForSEO, onde
cada busca é uma requisição avulsa. O `lead_id` entra porque é dele que saem
cidade e UF.

Troque o import do topo do arquivo: `PLACES_SUGGEST_MIN_CHARS` de
`"@/lib/places"` vira `GBP_SEARCH_MIN_CHARS` de `"@/lib/leads/gbp"`, criado no
Step 1 desta task.

Remova também `readSuggestPlacesFields`.

- [ ] **Step 3: Criar a action**

Crie `app/actions/leads/search-places.ts`:

```ts
"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { searchGooglePlaces } from "@/lib/dataforseo/maps-search"
import {
  DATAFORSEO_NOT_CONFIGURED,
  isDataForSeoConfigured,
} from "@/lib/dataforseo/configured"
import type { GbpPlaceCandidate } from "@/lib/leads/gbp-maps-candidate"
import { cityCenter } from "@/lib/locationiq"
import {
  readSearchPlacesFields,
  searchPlacesSchema,
} from "@/lib/validations/lead-gbp"
import { createClient } from "@/lib/supabase/server"
import { loadGbpLeadContext } from "./gbp-access"

export type SearchPlacesState =
  | { status: "success"; candidates: GbpPlaceCandidate[] }
  | { status: "error"; message: string }

export async function searchPlaces(
  formData: FormData,
): Promise<SearchPlacesState> {
  await requireCommercialMember()
  const parsed = searchPlacesSchema.safeParse(readSearchPlacesFields(formData))
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Revise a busca.",
    }
  }

  if (!isDataForSeoConfigured()) {
    return { status: "error", message: DATAFORSEO_NOT_CONFIGURED }
  }

  const supabase = await createClient()
  const lead = await loadGbpLeadContext(supabase, parsed.data.lead_id)
  if (lead === "error" || lead === "not_found") {
    return { status: "error", message: "Lead não encontrado." }
  }

  // O centroide da cidade é o que centra a busca. Sem ele o Maps devolve outro
  // estado — medido em 2026-09-15, P5 das evidências da onda 0.
  const center = await cityCenter(lead.city, lead.state_code)
  if (center.status === "error") {
    return { status: "error", message: center.message }
  }

  // A keyword vai **crua**, só o que o analista digitou. Acrescentar cidade e
  // UF nela foi medido e não ajuda: com a localidade errada não salva, e com a
  // coordenada certa é ruído que recorta resultado bom.
  const result = await searchGooglePlaces({
    query: parsed.data.query,
    latitude: center.data.latitude,
    longitude: center.data.longitude,
  })
  if (result.status === "error") {
    return { status: "error", message: result.message }
  }
  return { status: "success", candidates: result.candidates }
}
```

O `applyLocationHintToQuery` de `lib/leads/resolve-location.ts:58` **deixa de
ser chamado por este caminho**. Não o apague: confira se `leadLocationSearchHint`
e ele continuam em uso em outro lugar antes de mexer.

```bash
grep -rn "applyLocationHintToQuery\|leadLocationSearchHint" app components lib
```

- [ ] **Step 4: Trocar o export e apagar o antigo**

Em `app/actions/leads/index.ts`, troque a linha de `suggest-places` por:

```ts
export { searchPlaces, type SearchPlacesState } from "./search-places"
```

Depois apague `app/actions/leads/suggest-places.ts`.

---

## Task 8: Vínculo unificado

**Files:**
- Modify: `app/actions/leads/link-gbp-profile.ts`
- Modify: `lib/validations/lead-gbp.ts` (`linkLeadGbpSchema`)

**Interfaces:**
- Consumes: `collectGbpProfile` (Task 6).
- Produces: `linkLeadGbpProfile(formData)` com o mesmo `LinkLeadGbpState`.

- [ ] **Step 1: Trocar o schema do vínculo**

Em `lib/validations/lead-gbp.ts`, substitua `linkLeadGbpSchema` por:

```ts
export const linkLeadGbpSchema = z.object({
  lead_id: z.uuid("Lead inválido."),
  place_id: z
    .string()
    .trim()
    .min(10, "Estabelecimento inválido.")
    .max(500, "Estabelecimento inválido."),
  /**
   * Coordenada do candidato escolhido. Só acelera a coleta — o
   * `my_business_info` devolve a dele. Ausente, vazia ou fora de faixa cai para
   * o código de localidade da cidade do lead, então não há o que validar além
   * da faixa.
   */
  latitude: z.coerce.number().min(-90).max(90).nullable().catch(null),
  longitude: z.coerce.number().min(-180).max(180).nullable().catch(null),
})

export function readLinkLeadGbpFields(formData: FormData) {
  const latitude = formText(formData, "latitude")
  const longitude = formText(formData, "longitude")
  return {
    lead_id: formText(formData, "lead_id"),
    place_id: formText(formData, "place_id"),
    latitude: latitude === "" ? null : latitude,
    longitude: longitude === "" ? null : longitude,
  }
}
```

- [ ] **Step 2: Reescrever a action**

Em `app/actions/leads/link-gbp-profile.ts`, troque os imports de
`snapshotFromPlace` e `fetchPlaceDetails` por:

```ts
import { collectGbpProfile, GBP_COLLECT_FAILED } from "./gbp-collect"
```

O ramo de conflito no mesmo lead — hoje `refreshGbpProfileById` na linha 70 —
passa a `recollectGbpProfileById`, criada na Task 10. Até lá, use
`collectGbpProfile` direto sobre o `conflict.profileId`.

Substitua o bloco que vai de `const details = await fetchPlaceDetails(...)` até
o `insertGbpSnapshot`, por esta ordem — **que não pode mudar**, porque o perfil
precisa existir antes do snapshot pela chave estrangeira, e o snapshot antes da
releitura porque `GBP_SELECT` o embeda:

```ts
  // 1. O perfil nasce com o mínimo: a coleta ainda não aconteceu, e ela precisa
  //    de um `profile_id` para pendurar snapshot e jobs.
  const existingCount = await countGbpProfiles(supabase, payload.lead_id)
  const sortOrder = await nextGbpSortOrder(supabase, payload.lead_id)
  const fetchedAt = new Date().toISOString()
  const { data: created, error } = await supabase
    .from("lead_gbp_profiles")
    .insert({
      lead_id: payload.lead_id,
      place_id: payload.place_id,
      is_primary: existingCount === 0,
      sort_order: sortOrder,
      google_maps_uri: null,
      fetched_at: fetchedAt,
      fetched_by: user.id,
      payload: { placeId: payload.place_id },
      matched_website_key: null,
      notes: null,
    })
    .select("id")
    .single()

  if (error || !created) {
    if (error?.code === "23505") {
      const raced = await findGbpPlaceConflict(supabase, payload.place_id)
      if (raced.status === "taken" && raced.leadId !== payload.lead_id) {
        return {
          status: "conflict",
          message: "Este perfil do Google já está em outro lead.",
          existingLeadId: raced.leadId,
        }
      }
    }
    return { status: "error", message: GBP_COLLECT_FAILED }
  }

  const profileId = created.id as string

  // 2. A coleta completa: ficha, Q&A e os dois jobs, numa função só.
  const collected = await collectGbpProfile(supabase, {
    profileId,
    placeId: payload.place_id,
    latitude: payload.latitude,
    longitude: payload.longitude,
  })
  if (collected.status === "error") {
    // Perfil sem coleta não serve para nada e confundiria a tela. Some.
    await supabase.from("lead_gbp_profiles").delete().eq("id", profileId)
    return { status: "error", message: collected.message }
  }

  // 3. O perfil recebe o que a coleta descobriu.
  const { data, error: updateError } = await supabase
    .from("lead_gbp_profiles")
    .update({
      place_id: collected.snapshot.placeId,
      google_maps_uri: collected.snapshot.googleMapsUri,
      payload: collected.snapshot,
      cid: collected.cid,
      matched_website_key: matchedKeyForSnapshot(
        collected.snapshot.websiteDomain,
        lead.websiteKeys,
      ),
    })
    .eq("id", profileId)
    .select(GBP_SELECT)
    .single()

  if (updateError || !data) {
    return { status: "error", message: GBP_COLLECT_FAILED }
  }

  const profile = rowToGbpProfile(data as Record<string, unknown>)
  if (!profile) {
    return { status: "error", message: GBP_COLLECT_FAILED }
  }

  return { status: "success", profile, refreshed: false }
```

---

## Task 9: Picker com busca explícita

**Files:**
- Modify: `components/custom/LeadGbpPanel/LeadGbpPlacePicker.tsx`
- Modify: `components/custom/LeadGbpPanel/LeadGbpPanel.tsx:406-434` (o `handlePick`)

**Interfaces:**
- Consumes: `searchPlaces` (Task 7), `GbpPlaceCandidate` (Task 3).
- Produces: `onPick(candidate: GbpPlaceCandidate)` — **a assinatura muda**: era `(placeId: string, sessionToken: string)`.

- [ ] **Step 1: Reescrever o picker**

Substitua `components/custom/LeadGbpPanel/LeadGbpPlacePicker.tsx` inteiro:

```tsx
"use client"

import { useState } from "react"
import { RiSearchLine, RiStarFill, RiCheckboxCircleFill } from "react-icons/ri"
import { searchPlaces } from "@/app/actions/leads"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group"
import { GBP_SEARCH_MIN_CHARS } from "@/lib/leads/gbp"
import type { GbpPlaceCandidate } from "@/lib/leads/gbp-maps-candidate"

/**
 * Busca explícita, e não mais typeahead.
 *
 * Cada busca é uma requisição paga ao DataForSEO e leva segundos — disparar a
 * cada tecla queimaria dinheiro e devolveria resultado de palavra pela metade.
 * Em troca, a lista deixou de ser nome e endereço: o item do Maps traz
 * categoria, nota, volume de avaliações e status de reivindicação na mesma
 * resposta, que é o que permite escolher entre homônimos sem abrir o Google.
 */
export function LeadGbpPlacePicker({
  id,
  leadId,
  disabled,
  onPick,
}: {
  id: string
  leadId: string
  disabled?: boolean
  onPick: (candidate: GbpPlaceCandidate) => void
}) {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [items, setItems] = useState<GbpPlaceCandidate[]>([])

  const canSearch = query.trim().length >= GBP_SEARCH_MIN_CHARS

  function handleSearch() {
    if (!canSearch || loading || disabled) return
    setLoading(true)
    setError(null)
    const formData = new FormData()
    formData.set("lead_id", leadId)
    formData.set("query", query.trim())
    void searchPlaces(formData).then((result) => {
      setLoading(false)
      setSearched(true)
      if (result.status === "error") {
        setItems([])
        setError(result.message)
        return
      }
      setItems(result.candidates)
    })
  }

  const errorId = `${id}-error`

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id} className={cn(error && "text-destructive")}>
        Perfil no Google
      </FieldLabel>
      <div className="flex gap-2">
        <InputGroup className="flex-1">
          <InputGroupAddon align="inline-start">
            <RiSearchLine size={16} aria-hidden />
          </InputGroupAddon>
          <Input
            id={id}
            value={query}
            placeholder="Nome do estabelecimento"
            disabled={disabled || loading}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setQuery(event.target.value)
              setError(null)
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return
              event.preventDefault()
              handleSearch()
            }}
          />
        </InputGroup>
        <Button
          type="button"
          onClick={handleSearch}
          disabled={!canSearch || loading || disabled}
        >
          {loading ? <Spinner aria-hidden className="size-4" /> : "Buscar"}
        </Button>
      </div>

      {loading ? (
        <div className="mt-2 flex flex-col gap-1" aria-hidden>
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-16 rounded-md" />
          ))}
        </div>
      ) : null}

      {!loading && searched && items.length === 0 && !error ? (
        <p className="mt-2 text-xs/relaxed text-muted-foreground">
          Nenhum estabelecimento encontrado. Tente o nome como aparece no Google.
        </p>
      ) : null}

      {!loading && items.length > 0 ? (
        <ul className="mt-2 flex max-h-[22.5rem] flex-col gap-1 overflow-y-auto overscroll-contain">
          {items.map((item) => (
            <li key={item.placeId}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPick(item)}
                className="flex w-full flex-col items-start gap-0.5 rounded-md border border-border/70 px-3 py-2 text-left hover:bg-accent disabled:opacity-60"
              >
                <span className="flex w-full items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {item.title}
                  </span>
                  {item.isClaimed ? (
                    <RiCheckboxCircleFill
                      size={14}
                      aria-label="Perfil reivindicado"
                      className="shrink-0 text-success"
                    />
                  ) : null}
                </span>
                {item.address ? (
                  <span className="w-full truncate text-xs text-muted-foreground">
                    {item.address}
                  </span>
                ) : null}
                <span className="flex w-full flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  {item.category ? <span>{item.category}</span> : null}
                  {item.rating !== null ? (
                    <span className="inline-flex items-center gap-1">
                      <RiStarFill size={12} aria-hidden className="text-warning" />
                      {item.rating.toLocaleString("pt-BR", {
                        minimumFractionDigits: 1,
                      })}
                      {item.votes !== null
                        ? ` (${item.votes.toLocaleString("pt-BR")})`
                        : null}
                    </span>
                  ) : null}
                  {item.domain ? <span>{item.domain}</span> : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <FieldError id={errorId}>{error}</FieldError>
    </Field>
  )
}
```

- [ ] **Step 2: Ajustar o chamador**

Em `components/custom/LeadGbpPanel/LeadGbpPanel.tsx`, troque a assinatura do
`handlePick` e o corpo do `FormData`:

```tsx
  function handlePick(candidate: GbpPlaceCandidate) {
    if (!detail || linking) return
    const leadId = detail.lead.id
    setLinking(true)
    onPendingChange(true)
    setLinkError(null)
    setExistingLeadId(null)
    const formData = new FormData()
    formData.set("lead_id", leadId)
    formData.set("place_id", candidate.placeId)
    formData.set("latitude", candidate.latitude?.toString() ?? "")
    formData.set("longitude", candidate.longitude?.toString() ?? "")
    void linkLeadGbpProfile(formData).then((result) => {
      // ... o restante do corpo atual não muda
    })
  }
```

E no JSX, troque as props do picker:

```tsx
          <LeadGbpPlacePicker
            id="lead-gbp-place"
            leadId={detail.lead.id}
            disabled={linking}
            onPick={handlePick}
          />
```

O `locationHint` sai das props: a cidade agora é resolvida no servidor, pelo
`lead_id`, o que elimina a chance de a dica da tela divergir do cadastro. Se
`gbpLocationHint` (linha 321) ficar sem uso, apague a variável e o import de
`leadLocationSearchHint`.

Adicione o import do tipo no topo:

```tsx
import type { GbpPlaceCandidate } from "@/lib/leads/gbp-maps-candidate"
```

---

## Task 10: Recoleta — um botão só

**Files:**
- Create: `app/actions/leads/recollect-gbp-profile.ts`
- Delete: `app/actions/leads/refresh-gbp-profile.ts`
- Delete: `app/actions/leads/enrich-gbp-profile.ts`
- Modify: `app/actions/leads/index.ts`
- Modify: `components/custom/LeadGbpPanel/use-gbp-profile-controller.ts:333-356`
- Modify: `app/actions/leads/link-gbp-profile.ts` (o ramo de conflito)

**Interfaces:**
- Consumes: `collectGbpProfile` (Task 6).
- Produces:
  - `recollectGbpProfileById(profileId: string): Promise<RecollectLeadGbpState>`
  - `recollectLeadGbpProfile(formData: FormData): Promise<RecollectLeadGbpState>`
  - `type RecollectLeadGbpState = { status: "success"; profile: LeadGbpProfile } | { status: "error"; message: string }`

- [ ] **Step 1: Criar a action**

```ts
"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import {
  DATAFORSEO_NOT_CONFIGURED,
  isDataForSeoConfigured,
} from "@/lib/dataforseo/configured"
import type { LeadGbpProfile } from "@/lib/leads/gbp"
import {
  gbpProfileIdSchema,
  readGbpProfileIdFields,
} from "@/lib/validations/lead-gbp"
import { createClient } from "@/lib/supabase/server"
import { collectGbpProfile, GBP_COLLECT_FAILED } from "./gbp-collect"
import {
  denyGbpEdit,
  GBP_SELECT,
  loadGbpProfileRow,
  matchedKeyForSnapshot,
  rowToGbpProfile,
} from "./gbp-access"

/**
 * Um caminho só. `refresh` relia o Places e `enrich` chamava o DataForSEO, e a
 * diferença entre os dois era invisível na tela e cara de explicar. Com a ficha
 * e o enrichment vindo da mesma resposta, não sobra o que separar.
 */
export type RecollectLeadGbpState =
  | { status: "success"; profile: LeadGbpProfile }
  | { status: "error"; message: string }

export async function recollectGbpProfileById(
  profileId: string,
): Promise<RecollectLeadGbpState> {
  const { user, roles } = await requireCommercialMember()
  const supabase = await createClient()
  const loaded = await loadGbpProfileRow(supabase, profileId)
  if (loaded.status === "error") {
    return { status: "error", message: GBP_COLLECT_FAILED }
  }
  if (loaded.status === "not_found") {
    return { status: "error", message: "Perfil não encontrado." }
  }

  const denied = denyGbpEdit(loaded.lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  if (!isDataForSeoConfigured()) {
    return { status: "error", message: DATAFORSEO_NOT_CONFIGURED }
  }

  const collected = await collectGbpProfile(supabase, {
    profileId,
    placeId: loaded.profile.place_id,
    latitude: loaded.profile.payload.latitude,
    longitude: loaded.profile.payload.longitude,
  })
  if (collected.status === "error") {
    return { status: "error", message: collected.message }
  }

  const { data, error } = await supabase
    .from("lead_gbp_profiles")
    .update({
      place_id: collected.snapshot.placeId,
      google_maps_uri: collected.snapshot.googleMapsUri,
      fetched_at: new Date().toISOString(),
      fetched_by: user.id,
      payload: collected.snapshot,
      cid: collected.cid,
      matched_website_key: matchedKeyForSnapshot(
        collected.snapshot.websiteDomain,
        loaded.lead.websiteKeys,
      ),
    })
    .eq("id", profileId)
    .select(GBP_SELECT)
    .single()

  if (error || !data) {
    return { status: "error", message: GBP_COLLECT_FAILED }
  }

  const profile = rowToGbpProfile(data as Record<string, unknown>)
  if (!profile) {
    return { status: "error", message: GBP_COLLECT_FAILED }
  }

  return { status: "success", profile }
}

export async function recollectLeadGbpProfile(
  formData: FormData,
): Promise<RecollectLeadGbpState> {
  const parsed = gbpProfileIdSchema.safeParse(readGbpProfileIdFields(formData))
  if (!parsed.success) {
    return { status: "error", message: "Perfil inválido." }
  }
  return recollectGbpProfileById(parsed.data.profile_id)
}
```

- [ ] **Step 2: Apontar o ramo de conflito**

Em `app/actions/leads/link-gbp-profile.ts`, troque o import de
`refreshGbpProfileById` por `recollectGbpProfileById` e a chamada do ramo
`conflict.status === "taken"` no mesmo lead.

- [ ] **Step 3: Trocar os exports**

Em `app/actions/leads/index.ts`, remova as linhas de `refresh-gbp-profile` e
`enrich-gbp-profile` e adicione:

```ts
export {
  recollectLeadGbpProfile,
  recollectGbpProfileById,
  type RecollectLeadGbpState,
} from "./recollect-gbp-profile"
```

Apague `app/actions/leads/refresh-gbp-profile.ts` e
`app/actions/leads/enrich-gbp-profile.ts`.

- [ ] **Step 4: Um botão no controlador**

Em `components/custom/LeadGbpPanel/use-gbp-profile-controller.ts`, substitua
`handleRefresh` e `handleEnrich` por:

```ts
  function handleRecollect() {
    void run(async () => {
      const formData = new FormData()
      formData.set("profile_id", profile.id)
      const result = await recollectLeadGbpProfile(formData)
      if (result.status === "error") {
        setError(result.message)
        return
      }
      onUpdated(result.profile)
    })
  }
```

Troque o import no topo e o que o hook devolve. Depois, procure os dois nomes
antigos na pasta do painel e troque cada chamada e cada rótulo de botão por
**"Recoletar"**:

```bash
grep -rn "handleRefresh\|handleEnrich\|Analisar\|Atualizar" components/custom/LeadGbpPanel
```

---

## Task 11: Ranking sem fallback ao Places

**Files:**
- Modify: `app/actions/leads/check-gbp-ranking.ts:15,66-87`

- [ ] **Step 1: Trocar o fallback por uma mensagem**

Remova o import de `fetchPlaceDetails` e o de `snapshotFromPlace`, e substitua o
bloco `if (!hasGbpCoordinates(snapshot)) { ... }` e o `payloadPatch` inteiro por:

```ts
  const snapshot = loaded.profile.payload
  if (!hasGbpCoordinates(snapshot)) {
    return {
      status: "error",
      message: "Recolete o perfil antes de checar o ranking.",
    }
  }
```

Remova a variável `payloadPatch` e a sua propagação no `update` do fim da
action — ela existia só para gravar o snapshot que o Places devolvia de
carona.

O motivo de virar mensagem e não chamada: a coleta é que traz coordenada, ela
custa dinheiro, e disparar coleta dentro de uma checagem de ranking cobraria o
usuário por algo que ele não pediu. **A recoleta é um clique, e agora ela existe
como botão.**

---

## Task 12: A regra `no_photos`, o rótulo e a constante da busca

**Files:**
- Modify: `lib/leads/gbp.ts:61,120,379`
- Modify: `lib/leads/gbp-presenters.ts:1,109-110`

A constante `GBP_SEARCH_MIN_CHARS` já foi criada na Task 7, Step 1. Esta task
cuida só da regra de foto.

- [ ] **Step 1: Trocar a regra**

Em `lib/leads/gbp.ts`, linha 379, substitua:

```ts
  if (!enrichment && snapshot.photoCount === 0) gaps.push("no_photos")
```

por:

```ts
  // `totalPhotos` é o total do perfil. A regra antiga dependia de não haver
  // enrichment — condição que deixou de existir quando vínculo e coleta
  // viraram a mesma etapa, e que teria silenciado o achado para sempre.
  if (enrichment?.totalPhotos === 0) gaps.push("no_photos")
```

- [ ] **Step 2: Trocar o rótulo**

Em `GBP_GAP_LABELS`:

```ts
  no_photos: "Sem fotos no perfil",
```

- [ ] **Step 3: Trocar o presenter**

Em `lib/leads/gbp-presenters.ts`, linhas 109-110, troque o complemento:

```ts
    value: profile.payload.photoCount.toLocaleString("pt-BR"),
    complement: "no perfil",
```

E remova `GBP_PHOTO_API_MAX` do import da linha 1 se ele ficar sem uso no
arquivo.

- [ ] **Step 4: Rodar os testes de gap**

```bash
npm test
```

Esperado: todos passam. Se algum teste de gap afirmava `no_photos` pela regra
antiga, ajuste o caso para `enrichment: { totalPhotos: 0 }`.

---

## Task 13: Bateria de verificação

Só agora. A regra do repositório é bateria completa uma vez, no fim.

- [ ] **Step 1: Tipos**

```bash
npx tsc --noEmit
```

Esperado: zero erros. Se aparecer erro em arquivo que **não** está na tabela de
estrutura deste plano, não conserte às cegas — a árvore é compartilhada com
outras sessões. Confira `git status` e atribua o erro ao arquivo antes de tocar.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

- [ ] **Step 3: Testes**

```bash
npm test
```

Esperado: os três arquivos novos aparecem no total, e nada regride.

- [ ] **Step 4: Formatação**

```bash
npm run format:check
```

- [ ] **Step 5: Conferir que o Places sumiu do pipeline de leads**

```bash
grep -rn "@/lib/places" app/actions/leads components/custom/LeadGbpPanel lib/leads
```

Esperado: **nenhum resultado.** Os que restarem em `app/actions/briefing`,
`lib/briefing` e `components/custom/Briefing*` são da onda 3, no plano
`2026-09-15-migracao-dataforseo-briefing-mapa.md`.

- [ ] **Step 6: Verificação visual**

O app exige sessão. Peça o login ao dono do repositório antes de abrir a tela.
Depois, num lead com cidade e UF preenchidas:

1. abrir a etapa **Perfil do Google**, buscar o nome do estabelecimento;
2. conferir que a lista mostra categoria, nota e volume de avaliações;
3. selecionar e conferir que o perfil volta **já analisado** — com descrição,
   categorias secundárias e contagem de fotos, sem segundo clique;
4. clicar **Recoletar** e conferir que nada quebra.
