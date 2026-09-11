# Visibilidade — Confiabilidade dos Dados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a etapa de visibilidade afirmar apenas o que o dado sustenta — URL completa em vez de caminho inventado, `—` em vez de `0%`, intenção com probabilidade, e a idade do índice visível.

**Architecture:** O snapshot de visibilidade vira **v2**: cada campo carrega a própria procedência (valor + data + fonte) em vez de ser um número solto. O leitor tolera o v1 e normaliza; o escritor só produz v2. A coleta passa de uma para duas chamadas, e a segunda pode falhar sem derrubar a etapa.

**Tech Stack:** Next.js (App Router, Server Actions), TypeScript, Supabase (`jsonb`), DataForSEO Labs, `node --test` com type-stripping do Node 22.

**Spec:** `docs/superpowers/specs/2026-09-10-visibilidade-confiabilidade-design.md`
**Medição que originou:** `docs/auditoria/2026-09-10-onda0-visibilidade.md`

## Global Constraints

- **Leia `node_modules/next/dist/docs/` antes de escrever código de Next.** Esta versão tem breaking changes (`AGENTS.md` na raiz).
- **O `git` é do dono do repo.** Os passos "Commit" marcam a fronteira de uma entrega revisável; **não execute `git commit`** — pare, avise, e deixe o commit para ele.
- **Nada de subagentes de busca neste repo.** Ler e buscar direto.
- **Módulos de `lib/leads/` são puros e importam com extensão `.ts`.** É o que permite `node --test` carregá-los por type-stripping. Não adicione `server-only` a nenhum deles — regras de gap rodam em componente de cliente.
- **`lib/dataforseo/limits.ts` não tem imports.** Os dois lados (fetcher `server-only` e calculadora de cliente) leem dele.
- **O leitor tolera o passado, o escritor só produz o presente.** Nenhuma mudança pode fazer `readVisibilitySnapshot` devolver `null` para linha já gravada — a tabela é append-only e isso apagaria histórico na leitura.
- **Constantes com valor exato, copiadas da spec:**
  - `RANKED_KEYWORDS_LIMIT = 1000`
  - `VISIBILITY_INTENT_MIN_PROBABILITY = 0.6`
  - `VISIBILITY_STALE_SERP_DAYS = 90`
  - `VISIBILITY_NON_CANONICAL_SHARE = 0.2`
  - `VISIBILITY_QUERY = { locationName: "Brazil", languageCode: "pt" }`
  - `VISIBILITY_ITEM_TYPES = ["organic", "local_pack", "ai_overview_reference"]`
- **Copy de interface em pt-BR**, seguindo `.claude/skills/suite-frontend/references/writing.md`.
- **`cn` importado de `"cn"`**, nunca de `@/lib/utils`. Mesma regra de
  `2026-09-10-website-etapa-redesign.md`.
- **Ícone só de `react-icons/ri`.** Zero Lucide em código de produto.
- **Ausência é `—`, nunca zero.** É literalmente o defeito que este trabalho
  corrige; não o reintroduza em campo nenhum.
- **Verificação:** `pnpm test`, `pnpm lint` e `pnpm exec tsc --noEmit` limpos.
  **Não use `pnpm build`** — a convenção destes planos é `tsc --noEmit`, que é o
  mesmo type-check sem o custo do build completo. Comportamento de tela se
  confere no preview do browser (Task 7), nunca por `pnpm dev` no terminal.
- **Ambiente Git Bash no Windows:** `grep -P` não funciona ("supports only
  unibyte and UTF-8 locales") e `bc` não existe. Use `grep -E`.
- **Sem migração de banco.** `snapshot` é `jsonb`.

---

## File Structure

| arquivo | responsabilidade |
|---|---|
| `lib/dataforseo/limits.ts` | constantes de coleta que os dois lados leem. **Modificar** |
| `lib/dataforseo/time.ts` | **Criar** — `dataForSeoTimeToIso`, hoje preso em `gbp-audit.ts` |
| `lib/dataforseo/search-intent.ts` | **Criar** — cliente de `search_intent/live`, `server-only` |
| `lib/dataforseo/ranked-keywords.ts` | orquestra as duas chamadas e a degradação graciosa. **Modificar** |
| `lib/leads/visibility-audit.ts` | tipos v2, leitor tolerante, regras de gap. **Modificar** |
| `lib/leads/visibility-labs-map.ts` | payload da DataForSEO → snapshot v2. **Modificar** |
| `lib/leads/visibility-labs-map.test.mjs` | **Criar** — trava o mapeamento contra payload real |
| `lib/leads/visibility-labs-map.fixture.json` | **Criar** — 3 itens medidos em 2026-09-10 |
| `lib/leads/visibility-presenters.ts` | limiar de intenção, formatadores com unidade. **Modificar** |
| `lib/leads/visibility-opportunities.ts` | título e impacto do gap novo. **Modificar** |
| `components/custom/LeadVisibilityPanel/*` | colunas, cabeçalho, cards. **Modificar** |

---

### Task 1: URL completa e o snapshot v2

O defeito central. `relative_url` apaga o host, e `isHomepageUrl` inventa um no lugar. Esta task troca o campo, cria a fronteira v1/v2 e arrasta a mudança de tipo por toda a cadeia numa unidade que compila.

**Files:**
- Create: `lib/leads/visibility-labs-map.fixture.json`
- Create: `lib/leads/visibility-labs-map.test.mjs`
- Modify: `lib/leads/visibility-audit.ts` (tipos, `readKeywordRow`, `readVisibilitySnapshot`, `isHomepageUrl`)
- Modify: `lib/leads/visibility-labs-map.ts:100-116` (`mapKeywordItem`)
- Modify: `components/custom/LeadVisibilityPanel/LeadVisibilityKeywordsTable.tsx:84-86`

**Interfaces:**
- Produces: `VisibilityUrl`, `readVisibilityUrl(serpItem, canonicalDomain)`, `VisibilityKeywordRow.url: VisibilityUrl | null`, `VisibilitySnapshot.version: 2 | 1`, `isHomepageUrl(url: VisibilityUrl | null): boolean`
- Consumes: nada de tasks anteriores.

- [ ] **Step 1: Copiar o fixture medido**

O arquivo já existe na pasta de evidências, gerado a partir do payload real de 2026-09-10. Três itens escolhidos por serem os casos-limite: host canônico com KD real, host **não-canônico** com KD zero, e o único que divergiu do endpoint dedicado.

```bash
cp docs/auditoria/evidencias/2026-09-10-visibilidade/08-fixture-3-itens.json \
   lib/leads/visibility-labs-map.fixture.json
```

- [ ] **Step 2: Escrever o teste que falha**

Criar `lib/leads/visibility-labs-map.test.mjs`:

```js
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { mapRankedKeywordsLiveResult } from "./visibility-labs-map.ts"

/**
 * Fixture recortado do payload real de `buscaorganica.com.br` em 2026-09-10.
 * O mapeador viveu seis meses sem nunca ter rodado contra resposta de verdade;
 * quando rodou, três campos estavam errados. Este arquivo existe para que a
 * próxima suposição de forma morra no `pnpm test` e não numa reunião.
 */
const FIXTURE = JSON.parse(
  readFileSync(new URL("./visibility-labs-map.fixture.json", import.meta.url), "utf8"),
)

function snapshot() {
  return mapRankedKeywordsLiveResult({
    domain: "buscaorganica.com.br",
    result: FIXTURE,
    collectedAt: "2026-09-10T22:24:09.546Z",
    locationLabel: "Brazil",
    languageCode: "pt",
  })
}

test("grava a URL completa, e não o caminho relativo", () => {
  const row = snapshot().keywords.find((r) => r.keyword === "banheiro quimico preço")
  assert.equal(
    row.url.full,
    "https://aprov.buscaorganica.com.br/polyban.com.br/produtos",
  )
  assert.equal(row.url.path, "/polyban.com.br/produtos")
})

test("separa host de domínio registrável e marca host não-canônico", () => {
  const row = snapshot().keywords.find((r) => r.keyword === "banheiro quimico preço")
  assert.equal(row.url.host, "aprov.buscaorganica.com.br")
  assert.equal(row.url.mainDomain, "buscaorganica.com.br")
  assert.equal(row.url.isCanonicalHost, false)
})

test("www conta como host canônico", () => {
  const row = snapshot().keywords.find((r) => r.keyword === "busca organica")
  assert.equal(row.url.host, "www.buscaorganica.com.br")
  assert.equal(row.url.isCanonicalHost, true)
})

test("o snapshot novo se declara v2", () => {
  assert.equal(snapshot().version, 2)
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

```bash
pnpm test
```

Esperado: FAIL. `mapRankedKeywordsLiveResult` ainda não aceita `locationLabel`/`languageCode`, `row.url` é string e `version` não existe — o primeiro erro será `row.url.full` em `undefined`.

- [ ] **Step 4: Criar o tipo e o leitor de URL em `lib/leads/visibility-audit.ts`**

Trocar `url: string | null` em `VisibilityKeywordRow` por `url: VisibilityUrl | null`, e acrescentar:

```ts
/**
 * Tudo anulável menos `path`, e por um motivo só: o snapshot v1 gravou apenas o
 * caminho. O tipo precisa comportar a linha antiga sem inventar host — inventar
 * host é exatamente o defeito que este formato corrige.
 */
export type VisibilityUrl = {
  full: string | null
  host: string | null
  mainDomain: string | null
  path: string
  isCanonicalHost: boolean | null
}

/** `www.` não é outro site. Qualquer outro rótulo à esquerda é. */
export function isCanonicalHost(host: string, canonicalDomain: string): boolean {
  const folded = host.trim().toLowerCase().replace(/^www\./, "")
  return folded === canonicalDomain.trim().toLowerCase().replace(/^www\./, "")
}

export function visibilityUrlFromAbsolute(
  full: string,
  canonicalDomain: string,
): VisibilityUrl | null {
  try {
    const parsed = new URL(full)
    const host = parsed.hostname.toLowerCase()
    return {
      full,
      host,
      mainDomain: null,
      path: `${parsed.pathname}${parsed.search}` || "/",
      isCanonicalHost: isCanonicalHost(host, canonicalDomain),
    }
  } catch {
    return null
  }
}
```

- [ ] **Step 5: Fazer `readKeywordRow` tolerar as duas formas**

Em `lib/leads/visibility-audit.ts`, substituir `url: asString(row.url)` por uma leitura que aceita string (v1) e objeto (v2):

```ts
function readUrl(value: unknown): VisibilityUrl | null {
  // v1: gravávamos só o caminho. Não dá para recuperar o host, e inventar um
  // seria repetir o defeito — a linha antiga fica honesta com `null`.
  if (typeof value === "string") {
    const path = value.trim()
    return path
      ? { full: null, host: null, mainDomain: null, path, isCanonicalHost: null }
      : null
  }
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const path = asString(row.path)
  if (!path) return null
  return {
    full: asString(row.full),
    host: asString(row.host),
    mainDomain: asString(row.mainDomain),
    path,
    isCanonicalHost: typeof row.isCanonicalHost === "boolean" ? row.isCanonicalHost : null,
  }
}
```

E em `readVisibilitySnapshot`, acrescentar ao objeto devolvido:

```ts
version: asInt(row.version) === 2 ? 2 : 1,
```

- [ ] **Step 6: Fazer `isHomepageUrl` parar de inventar host**

Substituir a função inteira em `lib/leads/visibility-audit.ts:283-297`:

```ts
/**
 * Antes esta função montava `https://${domain}${path}` quando só tinha o
 * caminho — e produzia URL que não existe: 70% do footprint do primeiro lead
 * medido ranqueava num subdomínio de homologação. Agora ela exige o host, e
 * cala quando não o tem.
 */
export function isHomepageUrl(url: VisibilityUrl | null): boolean {
  if (!url) return true
  if (url.isCanonicalHost === false) return false
  const path = url.path.replace(/\/+$/, "") || "/"
  return path === "/" || path === "/index.html" || path === "/index.php"
}
```

Atualizar a única chamada, em `visibilityGapsForSnapshot`: `isHomepageUrl(row.url, snapshot.domain)` vira `isHomepageUrl(row.url)`.

- [ ] **Step 7: Trocar o campo no mapeador**

Em `lib/leads/visibility-labs-map.ts`, `mapKeywordItem` passa a receber o domínio canônico e a ler `serp_item.url` e `serp_item.main_domain`. `serp_item.subdomain` **não é usado** — veio `null` nas 110 linhas medidas.

```ts
function mapUrl(
  serpItem: Record<string, unknown> | null,
  canonicalDomain: string,
): VisibilityUrl | null {
  const full = asString(serpItem?.url)
  if (!full) return null
  const parsed = visibilityUrlFromAbsolute(full, canonicalDomain)
  if (!parsed) return null
  return { ...parsed, mainDomain: asString(serpItem?.main_domain) }
}
```

E `mapRankedKeywordsLiveResult` passa a aceitar `locationLabel`/`languageCode` no input, ecoá-los no snapshot em vez dos literais de `visibility-labs-map.ts:129-131`, e devolver `version: 2`.

- [ ] **Step 8: Atualizar a tabela**

Em `LeadVisibilityKeywordsTable.tsx`, a célula de URL. O host aparece **só quando não é canônico** — é a informação nova, e repetir `www.` em toda linha seria ruído:

```tsx
<TableCell className="max-w-[14rem] truncate px-1 py-2 text-xs/relaxed text-muted-foreground">
  {row.url ? (
    <span title={row.url.full ?? row.url.path}>
      {row.url.isCanonicalHost === false && row.url.host ? (
        <span className="text-warning">{row.url.host}</span>
      ) : null}
      {row.url.path}
    </span>
  ) : (
    "—"
  )}
</TableCell>
```

- [ ] **Step 9: Rodar os testes e o type-check**

```bash
pnpm test
```

Esperado: PASS nos 4 testes.

```bash
pnpm lint && pnpm exec tsc --noEmit
```

Esperado: sem erro de tipo. Se `tsc` acusar `row.url` em outro arquivo, é consumidor não atualizado — corrija antes de seguir.

- [ ] **Step 10: Commit (marcar a fronteira, não executar)**

```
fix(visibilidade): grava a URL completa e separa host de caminho
```

Pare aqui e avise o dono do repo. Não rode `git commit`.

---

### Task 2: A regra do zero e os sinais de dificuldade que já são pagos

`bulk_keyword_difficulty` foi medido e reprovado — devolve os mesmos 98 zeros. A dificuldade passa a vir de sinais que já chegam na resposta atual e que ninguém lia.

**Files:**
- Modify: `lib/leads/visibility-audit.ts` (`VisibilityDifficulty`, `readKeywordRow`)
- Modify: `lib/leads/visibility-labs-map.ts` (`mapKeywordItem`)
- Modify: `lib/leads/visibility-labs-map.test.mjs`
- Modify: `components/custom/LeadVisibilityPanel/LeadVisibilityKeywordsTable.tsx:53-56, 76-82`

**Interfaces:**
- Consumes: `snapshot()` do teste da Task 1, `mapUrl`.
- Produces: `VisibilityDifficulty`, `VisibilityKeywordRow.difficulty: VisibilityDifficulty`.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar a `lib/leads/visibility-labs-map.test.mjs`:

```js
test("KD 0 da API é ausência de dado, não dificuldade zero", () => {
  // Medido: 98 das 110 keywords vieram com 0 e nenhuma com null. O endpoint
  // dedicado devolveu os mesmos 98 zeros. Naquela base, 0 quer dizer "não sei".
  const row = snapshot().keywords.find((r) => r.keyword === "banheiro quimico preço")
  assert.equal(row.difficulty.index, null)
})

test("KD real atravessa intacto", () => {
  const row = snapshot().keywords.find((r) => r.keyword === "busca organica")
  assert.equal(row.difficulty.index, 40)
})

test("a disputa do Google Ads preenche o buraco do KD", () => {
  // A mesma keyword com KD 0 tem competition_level HIGH e competition 1,0.
  // São dois sinais diferentes, e o segundo não tem buraco.
  const row = snapshot().keywords.find((r) => r.keyword === "banheiro quimico preço")
  assert.equal(row.difficulty.adsCompetition, "HIGH")
  assert.equal(row.difficulty.adsCompetitionScore, 1)
})

test("traz os domínios de referência do top-10", () => {
  const row = snapshot().keywords.find((r) => r.keyword === "busca organica")
  assert.equal(Math.round(row.difficulty.topTenReferringDomains), 43)
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
pnpm test
```

Esperado: FAIL — `row.difficulty` ainda é `number | null`, então `.index` é `undefined`.

- [ ] **Step 3: Criar o tipo e o leitor**

Em `lib/leads/visibility-audit.ts`, trocar `difficulty: number | null` por `difficulty: VisibilityDifficulty` e acrescentar:

```ts
export type VisibilityAdsCompetition = "LOW" | "MEDIUM" | "HIGH"

export type VisibilityDifficulty = {
  /** `0` da API vira `null`: naquela base, zero é ausência. Ver a Onda 0. */
  index: number | null
  adsCompetition: VisibilityAdsCompetition | null
  adsCompetitionScore: number | null
  topTenReferringDomains: number | null
}

export function emptyVisibilityDifficulty(): VisibilityDifficulty {
  return {
    index: null,
    adsCompetition: null,
    adsCompetitionScore: null,
    topTenReferringDomains: null,
  }
}

/** Exportada: o mapeador lê o mesmo enum a partir do payload cru. */
export function readAdsCompetition(
  value: unknown,
): VisibilityAdsCompetition | null {
  return value === "LOW" || value === "MEDIUM" || value === "HIGH" ? value : null
}

function readDifficulty(value: unknown): VisibilityDifficulty {
  // v1 gravava um número solto. A regra do zero NÃO é aplicada retroativamente:
  // ali não dá para saber se aquele 0 veio da API ou de linha sem o campo, e
  // converter às cegas trocaria um dado duvidoso por outro.
  if (typeof value === "number") {
    return { ...emptyVisibilityDifficulty(), index: Math.round(value) }
  }
  if (!value || typeof value !== "object") return emptyVisibilityDifficulty()
  const row = value as Record<string, unknown>
  return {
    index: asInt(row.index),
    adsCompetition: readAdsCompetition(row.adsCompetition),
    adsCompetitionScore: asFinite(row.adsCompetitionScore),
    topTenReferringDomains: asFinite(row.topTenReferringDomains),
  }
}
```

- [ ] **Step 4: Aplicar a regra do zero no mapeador**

Em `lib/leads/visibility-labs-map.ts`, substituir `difficulty: asInt(keywordProperties?.keyword_difficulty)` por:

```ts
function mapDifficulty(
  keywordProperties: Record<string, unknown> | null,
  keywordInfo: Record<string, unknown> | null,
  avgBacklinks: Record<string, unknown> | null,
): VisibilityDifficulty {
  const raw = asFinite(keywordProperties?.keyword_difficulty)
  return {
    // `Math.round`, não `Math.trunc`: 39,6 é 40, não 39.
    index: raw === null || raw === 0 ? null : Math.round(raw),
    adsCompetition: readAdsCompetition(keywordInfo?.competition_level),
    adsCompetitionScore: asFinite(keywordInfo?.competition),
    topTenReferringDomains: asFinite(avgBacklinks?.referring_domains),
  }
}
```

`readAdsCompetition` vem importada de `./visibility-audit.ts`. `avgBacklinks` sai de `keyword_data.avg_backlinks_info`, lido como os outros blocos aninhados já são.

- [ ] **Step 5: Guardar a suspeita de idioma**

`keyword_properties.is_another_language` veio `true` em **36 das 110**, e o detector classificou *"busca organica"* como inglês. Das 36, **28 têm KD 0** — é a pista mais forte de por que o índice tem buraco, e some se não for gravada.

Teste, antes do código:

```js
test("marca a keyword que o detector de idioma classificou errado", () => {
  // "busca organica" é português e veio como `en`. A marca não corrige o KD;
  // ela explica por que ele falta, e permite filtrar a tabela depois.
  const row = snapshot().keywords.find((r) => r.keyword === "busca organica")
  assert.equal(row.languageMismatch, true)
})
```

Em `VisibilityKeywordRow`, `languageMismatch: boolean`. No leitor,
`languageMismatch: row.languageMismatch === true` (o v1 não tinha o campo, então
vira `false`). No mapeador:

```ts
languageMismatch: keywordProperties?.is_another_language === true,
```

- [ ] **Step 6: Rodar os testes**

```bash
pnpm test
```

Esperado: PASS nos 9 testes.

- [ ] **Step 7: Tirar o `%` da tela e mostrar a disputa do Ads**

Em `LeadVisibilityKeywordsTable.tsx`, o cabeçalho `KD` vira `Dificuldade`, e a célula:

```tsx
<TableCell className="px-1 py-2 text-xs/relaxed text-foreground">
  {/* Índice 0–100, não percentual. O `%` de antes era erro de unidade. */}
  {row.difficulty.index === null ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    row.difficulty.index.toLocaleString("pt-BR")
  )}
  {row.difficulty.adsCompetition ? (
    <span className="ml-1.5 text-muted-foreground">
      {visibilityAdsCompetitionLabel(row.difficulty.adsCompetition)}
    </span>
  ) : null}
</TableCell>
```

E em `lib/leads/visibility-presenters.ts`:

```ts
/** Rótulo curto da disputa do Google Ads. Cabe na célula, e é sinal separado do KD. */
export function visibilityAdsCompetitionLabel(
  value: VisibilityAdsCompetition,
): string {
  if (value === "LOW") return "baixa"
  if (value === "MEDIUM") return "média"
  return "alta"
}
```

- [ ] **Step 8: Verificar**

```bash
pnpm test && pnpm lint && pnpm exec tsc --noEmit
```

Esperado: tudo passa. Nenhuma ocorrência de `%` sobrando: `grep -n '%' components/custom/LeadVisibilityPanel/LeadVisibilityKeywordsTable.tsx` não deve achar a célula de dificuldade.

- [ ] **Step 9: Commit (marcar a fronteira, não executar)**

```
fix(visibilidade): KD zero vira ausência e a disputa do Ads entra na tela
```

---

### Task 3: A idade do índice

A posição exibida tem mediana de 59 dias e máximo de 108. O cabeçalho carimba a hora do clique como se fosse a hora da medida.

**Files:**
- Create: `lib/dataforseo/time.ts`
- Modify: `lib/leads/gbp-audit.ts:136-146` (passa a reexportar)
- Modify: `lib/leads/visibility-audit.ts` (`position`, `volume`, `indexAge`)
- Modify: `lib/leads/visibility-labs-map.ts`
- Modify: `lib/leads/visibility-labs-map.test.mjs`
- Modify: `components/custom/LeadVisibilityPanel/LeadVisibilityStepHeader.tsx:44-51`
- Modify: `components/custom/LeadVisibilityPanel/LeadVisibilityKeywordsTable.tsx`

**Interfaces:**
- Consumes: `readDifficulty` e `mapUrl` das tasks 1 e 2.
- Produces: `dataForSeoTimeToIso` em `lib/dataforseo/time.ts`; `VisibilityKeywordRow.position: { value, previous, updatedAt }`, `.volume: { value, updatedAt }`; `VisibilitySnapshot.indexAge`.

- [ ] **Step 1: Mover o parser de data para um módulo puro**

`dataForSeoTimeToIso` está preso em `lib/leads/gbp-audit.ts`, que é grande e de outro domínio. Criar `lib/dataforseo/time.ts` com o corpo **idêntico** ao de `gbp-audit.ts:136-146`:

```ts
/**
 * Puro e sem imports, como `limits.ts`: os mapeadores de GBP e de visibilidade
 * precisam do mesmo parser, e nenhum dos dois pode arrastar o outro junto.
 *
 * A DataForSEO devolve `YYYY-MM-DD HH:MM:SS +00:00`. Formato confirmado contra
 * payload real em 2026-09-04 (avaliações) e 2026-09-10 (visibilidade).
 */
export function dataForSeoTimeToIso(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalized = trimmed.includes("T")
    ? trimmed
    : trimmed.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) /, "$1T$2")
  const ms = Date.parse(normalized)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}
```

Em `lib/leads/gbp-audit.ts`, apagar a definição e reexportar, para não tocar nos 5 chamadores:

```ts
export { dataForSeoTimeToIso } from "../dataforseo/time.ts"
```

- [ ] **Step 2: Escrever os testes que falham**

```js
test("guarda a data do índice da SERP, que é o que envelhece", () => {
  // Medido: mediana 59 dias, máximo 108. Esta linha é a mais velha do fixture.
  const row = snapshot().keywords.find((r) => r.keyword === "banheiro quimico preço")
  assert.equal(row.position.updatedAt, "2026-05-25T08:15:36.000Z")
  assert.equal(row.position.value, 25)
  assert.equal(row.position.previous, null)
})

test("guarda a data do volume, que envelhece em outro ritmo", () => {
  const row = snapshot().keywords.find((r) => r.keyword === "banheiro quimico preço")
  assert.equal(row.volume.value, 1900)
  assert.equal(row.volume.updatedAt, "2026-08-26T17:35:56.000Z")
})

test("resume a idade do índice no snapshot", () => {
  const age = snapshot().indexAge
  assert.equal(typeof age.serpMedianDays, "number")
  assert.ok(age.serpMaxDays >= age.serpMedianDays)
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

```bash
pnpm test
```

Esperado: FAIL — `row.position` ainda é `number | null`.

- [ ] **Step 4: Trocar os tipos**

Em `lib/leads/visibility-audit.ts`, `position: number | null` vira `position: VisibilityPosition` e `volume: number | null` vira `volume: VisibilityVolume`:

```ts
export type VisibilityPosition = {
  value: number | null
  previous: number | null
  /** `serp_info.last_updated_time` — quando a DataForSEO viu esta SERP. */
  updatedAt: string | null
}

export type VisibilityVolume = {
  value: number | null
  updatedAt: string | null
}

export type VisibilityIndexAge = {
  serpMedianDays: number
  serpMaxDays: number
  volumeMedianDays: number | null
  intentMedianDays: number | null
}

/** Acima disto a linha é histórico, não retrato. Medido: mediana 59, máximo 108. */
export const VISIBILITY_STALE_SERP_DAYS = 90
```

Os leitores aceitam número solto (v1) e objeto (v2):

```ts
function readPosition(value: unknown): VisibilityPosition {
  if (typeof value === "number") {
    const v = Math.trunc(value)
    return { value: v >= 1 ? v : null, previous: null, updatedAt: null }
  }
  if (!value || typeof value !== "object") {
    return { value: null, previous: null, updatedAt: null }
  }
  const row = value as Record<string, unknown>
  const current = asInt(row.value)
  const previous = asInt(row.previous)
  return {
    value: current !== null && current >= 1 ? current : null,
    previous: previous !== null && previous >= 1 ? previous : null,
    updatedAt: asString(row.updatedAt),
  }
}

function readVolume(value: unknown): VisibilityVolume {
  if (typeof value === "number") {
    return { value: Math.trunc(value), updatedAt: null }
  }
  if (!value || typeof value !== "object") return { value: null, updatedAt: null }
  const row = value as Record<string, unknown>
  return { value: asInt(row.value), updatedAt: asString(row.updatedAt) }
}

function readIndexAge(value: unknown): VisibilityIndexAge | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  const serpMedianDays = asInt(row.serpMedianDays)
  const serpMaxDays = asInt(row.serpMaxDays)
  if (serpMedianDays === null || serpMaxDays === null) return null
  return {
    serpMedianDays,
    serpMaxDays,
    volumeMedianDays: asInt(row.volumeMedianDays),
    intentMedianDays: asInt(row.intentMedianDays),
  }
}
```

- [ ] **Step 5: Calcular a idade no mapeador**

```ts
function daysBetween(iso: string | null, reference: string): number | null {
  if (!iso) return null
  const ms = Date.parse(reference) - Date.parse(iso)
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 86_400_000)) : null
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}
```

`indexAge` sai de `daysBetween` aplicado a cada `position.updatedAt`, com `median` e `Math.max`. Sem nenhuma data, `indexAge` é `null`.

- [ ] **Step 6: Rodar os testes**

```bash
pnpm test
```

Esperado: PASS.

- [ ] **Step 7: Separar "coletado" de "índice" no cabeçalho**

Em `LeadVisibilityStepHeader.tsx`, o bloco de `updatedAt` ganha um irmão. A props do componente recebe `indexAge: VisibilityIndexAge | null`:

```tsx
{updatedAt ? (
  <span className="inline-flex items-center gap-1 text-xs/relaxed text-muted-foreground">
    <RiCheckLine size={14} aria-hidden className="text-success" />
    Coletado {formatRelativeShort(updatedAt)}
  </span>
) : null}
{indexAge ? (
  // A coleta é de agora; o índice, não. Confundir os dois é a maior causa de
  // divergência com outras ferramentas.
  <span className="inline-flex items-center gap-1 text-xs/relaxed text-muted-foreground">
    <RiHistoryLine size={14} aria-hidden />
    Índice de ~{indexAge.serpMedianDays} dias
  </span>
) : null}
```

`RiHistoryLine` vem de `react-icons/ri`, como os outros ícones do arquivo.

- [ ] **Step 8: Esmaecer a linha velha**

A tabela passa a receber o snapshot inteiro em vez de só `keywords` — ela precisa
de `collectedAt` como referência e, na Task 4, de `coverage`. Em
`LeadVisibilityPanel.tsx:111`, `keywords={audit.snapshot.keywords}` vira
`snapshot={audit.snapshot}`.

Em `lib/leads/visibility-presenters.ts`, o cálculo (puro, testável, e fora do
componente):

```ts
/** Dias entre a data do índice e a da coleta. `null` quando falta qualquer uma. */
export function visibilityRowAgeDays(
  updatedAt: string | null,
  collectedAt: string,
): number | null {
  if (!updatedAt) return null
  const ms = Date.parse(collectedAt) - Date.parse(updatedAt)
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 86_400_000)) : null
}

export function isVisibilityRowStale(
  updatedAt: string | null,
  collectedAt: string,
): boolean {
  const days = visibilityRowAgeDays(updatedAt, collectedAt)
  return days !== null && days > VISIBILITY_STALE_SERP_DAYS
}
```

Em `LeadVisibilityKeywordsTable.tsx`, dentro do `rows.map`. **`cn` neste repo é
especificador nu — `import { cn } from "cn"`**, não `@/lib/utils`:

```tsx
const stale = isVisibilityRowStale(row.position.updatedAt, snapshot.collectedAt)
```

```tsx
<TableRow
  key={row.keyword}
  className={cn("border-b border-border/50 last:border-b-0", stale && "opacity-60")}
>
```

E a célula de posição ganha a data por extenso no `title`:

```tsx
<TableCell
  className="px-1 py-2 text-xs/relaxed text-foreground"
  title={
    row.position.updatedAt
      ? `Índice de ${formatDate(row.position.updatedAt)}`
      : "Data do índice não informada"
  }
>
  {formatVisibilityMetric(row.position.value)}
</TableCell>
```

- [ ] **Step 9: Verificar**

```bash
pnpm test && pnpm lint && pnpm exec tsc --noEmit
```

- [ ] **Step 10: Commit (marcar a fronteira, não executar)**

```
feat(visibilidade): a idade do índice para de ficar invisível
```

---

### Task 4: Cobertura, hosts, custo e `item_types`

Três defeitos de honestidade num só lugar: a amostra truncada não se declara, a quebra por host não existe, e o custo é jogado fora.

**Files:**
- Modify: `lib/dataforseo/limits.ts`
- Modify: `lib/dataforseo/ranked-keywords.ts`
- Modify: `lib/leads/visibility-audit.ts` (`coverage`, `hosts`, `costUsd`, `droppedRows`, `localPack`, `aiOverview`)
- Modify: `lib/leads/visibility-labs-map.ts`
- Modify: `lib/leads/visibility-labs-map.test.mjs`
- Modify: `app/actions/leads/analyze-visibility.ts:88-95`, `lib/leads/diagnosis-compile.ts:251`
- Modify: `components/custom/LeadVisibilityPanel/LeadVisibilitySummaryCards.tsx`
- Modify: `components/custom/LeadVisibilityPanel/LeadVisibilityKeywordsTable.tsx`

**Interfaces:**
- Consumes: tudo das tasks 1–3.
- Produces: `VISIBILITY_QUERY`, `VISIBILITY_ITEM_TYPES`, `VisibilitySnapshot.coverage/hosts/costUsd/droppedRows/localPack/aiOverview`.

- [ ] **Step 1: Mover a procedência para as constantes**

Em `lib/dataforseo/limits.ts`, `RANKED_KEYWORDS_LIMIT` passa de `100` para `1000` e ganha companhia:

```ts
/**
 * Keywords que a visibilidade orgânica pede por domínio.
 *
 * Mil, não cem, e isso **não** encarece o caso comum: o Labs cobra
 * US$ 0,012 por requisição mais US$ 0,00012 por linha **devolvida**, não pedida
 * (tabela da conta, conferida em 2026-09-10 — 0,012 + 110 × 0,00012 = 0,0252
 * exato). O teto de 100 economizava nada e truncava sempre.
 */
export const RANKED_KEYWORDS_LIMIT = 1000

/**
 * Procedência da coleta, num lugar só. Antes eram literais em dois arquivos —
 * o request e o eco no mapeador —, e mudar um faria o snapshot mentir sobre a
 * própria origem.
 */
export const VISIBILITY_QUERY = {
  locationName: "Brazil",
  languageCode: "pt",
} as const

/**
 * Medido em 2026-09-10: `item_types` filtra os `items` e **nunca** as
 * `metrics` — as cinco seções vêm sempre, e `local_pack` e
 * `ai_overview_reference` já vinham sendo descartadas. Ampliar não muda
 * semântica de métrica e não custa nada onde não há resultado.
 */
export const VISIBILITY_ITEM_TYPES = [
  "organic",
  "local_pack",
  "ai_overview_reference",
] as const
```

- [ ] **Step 2: Escrever os testes que falham**

```js
test("declara a cobertura da amostra em vez de fingir que é tudo", () => {
  const snap = snapshot()
  assert.equal(snap.coverage.returned, 3)
  assert.equal(snap.coverage.total, 110)
  assert.equal(snap.coverage.truncated, true)
})

test("quebra o footprint por host", () => {
  // Foi assim que apareceu que 70% do domínio ranqueava num subdomínio de
  // homologação. Sem esta quebra o dado existe e ninguém vê.
  const hosts = snapshot().hosts
  const aprov = hosts.find((h) => h.host === "aprov.buscaorganica.com.br")
  assert.equal(aprov.keywords, 1)
  assert.equal(aprov.isCanonical, false)
  assert.equal(hosts.find((h) => h.host === "www.buscaorganica.com.br").isCanonical, true)
})

test("metrics é sempre o footprint, nunca a amostra", () => {
  // 3 itens no fixture, 110 no footprint. Antes os dois significados moravam
  // no mesmo campo e nada os distinguia.
  const snap = snapshot()
  assert.equal(snap.metrics.keywordCount, 110)
  assert.equal(snap.keywords.length, 3)
})

test("as seções não-orgânicas de metrics param de ser descartadas", () => {
  const snap = snapshot()
  assert.equal(snap.localPack.count, 0)
  assert.equal(snap.aiOverview.count, 0)
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

```bash
pnpm test
```

Esperado: FAIL — `snap.coverage` é `undefined`.

- [ ] **Step 4: Acrescentar os campos ao tipo e ao leitor**

Em `lib/leads/visibility-audit.ts`:

```ts
export type VisibilityCoverage = {
  returned: number
  total: number | null
  truncated: boolean
}

export type VisibilityHost = {
  host: string
  keywords: number
  traffic: number
  isCanonical: boolean
}

/**
 * As seções não-orgânicas de `metrics`. Só contagem e tráfego: os buckets de
 * posição não fazem sentido em `local_pack` nem em `ai_overview_reference`, e
 * as duas vieram zeradas na única medição — o mínimo é o honesto.
 */
export type VisibilityTypeMetrics = {
  count: number | null
  estimatedTraffic: number | null
}
```

No snapshot entram `coverage`, `hosts`, `costUsd: number | null`,
`droppedRows: number`, `localPack` e `aiOverview`. Em `readVisibilitySnapshot`,
o v1 cai nos neutros — e `coverage` é o único que não pode ser `null`, porque a
tabela sempre precisa dizer quantas linhas está mostrando:

```ts
function readCoverage(value: unknown, returned: number): VisibilityCoverage {
  // v1 não gravava cobertura. `total: null` é honesto: não dá para saber se
  // aquela coleta foi truncada, e `truncated: false` seria afirmar demais.
  if (!value || typeof value !== "object") {
    return { returned, total: null, truncated: false }
  }
  const row = value as Record<string, unknown>
  const total = asInt(row.total)
  return {
    returned: asInt(row.returned) ?? returned,
    total,
    truncated: row.truncated === true,
  }
}

function readHosts(value: unknown): VisibilityHost[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    const host = asString(row.host)
    if (!host) return []
    return [
      {
        host,
        keywords: asInt(row.keywords) ?? 0,
        traffic: asFinite(row.traffic) ?? 0,
        isCanonical: row.isCanonical === true,
      },
    ]
  })
}

function readTypeMetrics(value: unknown): VisibilityTypeMetrics | null {
  if (!value || typeof value !== "object") return null
  const row = value as Record<string, unknown>
  return {
    count: asInt(row.count),
    estimatedTraffic: asFinite(row.estimatedTraffic),
  }
}
```

**Remover o fallback por amostra em `mapOrganicMetrics`.** Sem `metrics.organic`, `keywordCount` e `positionBuckets` ficam `null` — nunca mais a amostra se passando por footprint.

**E remover o gêmeo dele em `lib/leads/diagnosis-compile.ts:251`**, que é pior porque sai no PDF que o cliente recebe:

```ts
// antes — o `??` faz a amostra virar footprint no documento do cliente
formatVisibilityMetric(snap.metrics.keywordCount ?? snap.keywords.length),

// depois — sem footprint medido, o documento cala
formatVisibilityMetric(snap.metrics.keywordCount),
```

`formatVisibilityMetric(null)` já devolve `"—"`. `visibilityStrengths` em
`lib/leads/diagnosis-strengths.ts:294` **já está correto** (exige `!== null`) e
não é tocado.

- [ ] **Step 5: Guardar o tipo do item e o que a SERP contém**

Dois campos da spec que só existem porque `item_types` foi ampliado, e que a resposta já trazia.

Teste, antes do código:

```js
test("guarda o que a SERP daquela keyword realmente contém", () => {
  // 49 das 110 SERPs medidas têm ai_overview. É evidência observada, não
  // palpite de modelo — e responde parte da pergunta de intenção de graça.
  const row = snapshot().keywords.find((r) => r.keyword === "banheiro quimico preço")
  assert.ok(row.serpFeatures.includes("ai_overview"))
  assert.ok(row.serpFeatures.includes("popular_products"))
})

test("guarda de qual item_type a linha veio", () => {
  const row = snapshot().keywords.find((r) => r.keyword === "busca organica")
  assert.equal(row.itemType, "organic")
})
```

Em `lib/leads/visibility-audit.ts`, o tipo e o campo:

```ts
export type VisibilityItemType =
  | "organic"
  | "local_pack"
  | "ai_overview_reference"
```

Em `VisibilityKeywordRow`: `serpFeatures: string[]` e
`itemType: VisibilityItemType`. No mapeador:

```ts
const ITEM_TYPES = new Set(["organic", "local_pack", "ai_overview_reference"])

function readItemType(value: unknown): VisibilityItemType {
  // Defensivo de propósito: `local_pack` e `ai_overview_reference` vieram
  // zerados na única medição, então a forma do `serp_item` desses dois tipos
  // NUNCA foi observada. O primeiro lead que os tiver é a validação.
  return typeof value === "string" && ITEM_TYPES.has(value)
    ? (value as VisibilityItemType)
    : "organic"
}

function readSerpFeatures(serpInfo: Record<string, unknown> | null): string[] {
  const types = serpInfo?.serp_item_types
  return Array.isArray(types)
    ? types.filter((item): item is string => typeof item === "string")
    : []
}
```

No leitor v1, `serpFeatures: []` e `itemType: "organic"`.

- [ ] **Step 6: Agregar hosts e contar as descartadas**

```ts
function hostsFromRows(
  rows: ReadonlyArray<VisibilityKeywordRow>,
): VisibilityHost[] {
  const byHost = new Map<string, VisibilityHost>()
  for (const row of rows) {
    const host = row.url?.host
    if (!host) continue
    const found = byHost.get(host) ?? {
      host,
      keywords: 0,
      traffic: 0,
      isCanonical: row.url?.isCanonicalHost === true,
    }
    found.keywords += 1
    found.traffic += row.traffic ?? 0
    byHost.set(host, found)
  }
  return [...byHost.values()].sort((a, b) => b.traffic - a.traffic)
}
```

`droppedRows` é `items.length - keywords.length` no mapeador — hoje o `flatMap` descarta em silêncio.

- [ ] **Step 7: Passar `cost` adiante**

Em `lib/dataforseo/ranked-keywords.ts`, `postDataForSeo` já devolve `cost` e o fetcher o descarta. Passar para `mapRankedKeywordsLiveResult` e usar `VISIBILITY_QUERY`/`VISIBILITY_ITEM_TYPES`/`RANKED_KEYWORDS_LIMIT` no corpo da tarefa:

```ts
const posted = await postDataForSeo<RankedKeywordsLiveResult>(
  "/dataforseo_labs/google/ranked_keywords/live",
  {
    target: input.domain,
    location_name: VISIBILITY_QUERY.locationName,
    language_code: VISIBILITY_QUERY.languageCode,
    limit: RANKED_KEYWORDS_LIMIT,
    item_types: [...VISIBILITY_ITEM_TYPES],
    order_by: ["ranked_serp_element.serp_item.etv,desc"],
  },
)
```

`analyze-visibility.ts` não muda de forma — `costUsd` viaja dentro do `snapshot`, que já é `jsonb`.

- [ ] **Step 8: Rodar os testes**

```bash
pnpm test
```

Esperado: PASS.

- [ ] **Step 9: Declarar a cobertura e os hosts na tela**

Em `LeadVisibilityKeywordsTable.tsx`, acima da `Table`:

```tsx
<p className="mb-2 text-xs/relaxed text-muted-foreground">
  {snapshot.coverage.truncated
    ? `${formatVisibilityMetric(snapshot.coverage.returned)} de ${formatVisibilityMetric(snapshot.coverage.total)} keywords · ordenadas por tráfego`
    : `${formatVisibilityMetric(snapshot.coverage.returned)} keywords`}
  {snapshot.droppedRows > 0
    ? ` · ${snapshot.droppedRows} linha(s) ilegível(is) descartada(s)`
    : ""}
</p>
```

Em `LeadVisibilitySummaryCards.tsx`, o card "Custo tráfego" vira `US$ …/mês` e "Tráfego est." vira `… cliques/mês`. Quando `hosts.length > 1`, um card novo:

```tsx
{snapshot.hosts.length > 1 ? (
  <MetricCard
    icon={RiGlobeLine}
    label="Hosts"
    value={snapshot.hosts
      .map((h) => `${h.host.replace(/^www\./, "") } ${Math.round(h.traffic)}`)
      .join(" · ")}
  />
) : null}
```

- [ ] **Step 10: Verificar**

```bash
pnpm test && pnpm lint && pnpm exec tsc --noEmit
```

- [ ] **Step 11: Commit (marcar a fronteira, não executar)**

```
feat(visibilidade): cobertura, quebra por host e custo entram no snapshot
```

---

### Task 5: Intent pela fonte dedicada, com probabilidade

Medido: os dois índices discordam em 23%, e um terço das classificações tem probabilidade abaixo de 0,60. A chamada dedicada não compra correção — compra a confiança que permite calar.

**Files:**
- Create: `lib/dataforseo/search-intent.ts`
- Modify: `lib/dataforseo/ranked-keywords.ts`
- Modify: `lib/leads/visibility-audit.ts` (`VisibilityIntent`)
- Modify: `lib/leads/visibility-labs-map.ts`
- Modify: `lib/leads/visibility-labs-map.test.mjs`
- Modify: `lib/leads/visibility-presenters.ts:41-48`
- Modify: `components/custom/LeadVisibilityPanel/LeadVisibilityKeywordsTable.tsx:65-68`

**Interfaces:**
- Consumes: tudo das tasks 1–4.
- Produces: `fetchSearchIntentLive({ keywords, languageCode })`, `VisibilityIntent`, `visibilityIntentLabel(intent)`.

- [ ] **Step 1: Escrever o teste da fusão que falha**

O mapeador passa a aceitar um mapa de intenção vindo da segunda chamada. Sem ele, a intenção do `ranked_keywords` **não** é usada como substituta — os dois índices discordam em 23%, e misturar as fontes numa coluna só produziria uma tabela sem procedência.

```js
test("usa a intenção dedicada quando ela existe", () => {
  const snap = mapRankedKeywordsLiveResult({
    domain: "buscaorganica.com.br",
    result: FIXTURE,
    collectedAt: "2026-09-10T22:24:09.546Z",
    locationLabel: "Brazil",
    languageCode: "pt",
    intents: new Map([
      ["banheiro quimico preço", { label: "commercial", probability: 0.7866, secondary: [], updatedAt: null }],
    ]),
  })
  const row = snap.keywords.find((r) => r.keyword === "banheiro quimico preço")
  assert.equal(row.intent.label, "commercial")
  assert.equal(row.intent.probability, 0.7866)
})

test("sem a chamada dedicada, a intenção fica nula em vez de chutar", () => {
  // O main_intent do ranked_keywords diz "transactional" para esta keyword e o
  // índice dedicado diz "commercial". Preencher com o mais fraco esconderia
  // que a fonte falhou.
  const row = snapshot().keywords.find((r) => r.keyword === "banheiro quimico preço")
  assert.equal(row.intent, null)
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
pnpm test
```

Esperado: FAIL — `mapRankedKeywordsLiveResult` não aceita `intents`.

- [ ] **Step 3: Criar o cliente do endpoint**

`lib/dataforseo/search-intent.ts`:

```ts
import "server-only"

import { postDataForSeo } from "@/lib/dataforseo/client"

/** O endpoint aceita até 1.000 keywords por chamada. */
const SEARCH_INTENT_MAX = 1000

export type SearchIntentEntry = {
  label: string
  probability: number
  secondary: Array<{ label: string; probability: number }>
  updatedAt: string | null
}

export type FetchSearchIntentResult =
  | { status: "ok"; intents: Map<string, SearchIntentEntry>; cost: number }
  | { status: "error" }

export async function fetchSearchIntentLive(input: {
  keywords: ReadonlyArray<string>
  languageCode: string
}): Promise<FetchSearchIntentResult> {
  const keywords = [...new Set(input.keywords)].slice(0, SEARCH_INTENT_MAX)
  if (keywords.length === 0) {
    return { status: "ok", intents: new Map(), cost: 0 }
  }
  const posted = await postDataForSeo<{ items?: Array<Record<string, unknown>> }>(
    "/dataforseo_labs/google/search_intent/live",
    { keywords, language_code: input.languageCode },
  )
  if (posted.status === "error") return { status: "error" }
  return {
    status: "ok",
    intents: readSearchIntentItems(posted.data?.items),
    cost: posted.cost ?? 0,
  }
}
```

E o leitor, no mesmo arquivo. A forma foi conferida contra payload real em
2026-09-10 (`docs/auditoria/evidencias/2026-09-10-visibilidade/03-search_intent.json`
regenerável por `probe.mjs`):

```ts
function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function asFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readSecondary(
  value: unknown,
): Array<{ label: string; probability: number }> {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const row = asRecord(item)
    const label = asString(row?.label)
    const probability = asFinite(row?.probability)
    return label && probability !== null ? [{ label, probability }] : []
  })
}

function readSearchIntentItems(
  items: Array<Record<string, unknown>> | undefined,
): Map<string, SearchIntentEntry> {
  const out = new Map<string, SearchIntentEntry>()
  if (!Array.isArray(items)) return out
  for (const item of items) {
    const keyword = asString(item?.keyword)
    const intent = asRecord(item?.keyword_intent)
    const label = asString(intent?.label)
    const probability = asFinite(intent?.probability)
    // Sem probabilidade a linha não serve para nada aqui: o que esta chamada
    // compra é justamente a confiança, não o rótulo.
    if (!keyword || !label || probability === null) continue
    out.set(keyword, {
      label,
      probability,
      secondary: readSecondary(item?.secondary_keyword_intents),
      updatedAt: dataForSeoTimeToIso(item?.last_updated_time),
    })
  }
  return out
}
```

`dataForSeoTimeToIso` vem de `@/lib/dataforseo/time`, criado na Task 3.

- [ ] **Step 4: Encadear as duas chamadas com degradação graciosa**

Em `lib/dataforseo/ranked-keywords.ts`, depois do `postDataForSeo`:

```ts
/** As keywords que a primeira chamada devolveu, sem repetir. */
function keywordsFromResult(result: RankedKeywordsLiveResult | null): string[] {
  const items = Array.isArray(result?.items) ? result.items : []
  const out = new Set<string>()
  for (const item of items) {
    const data = item?.keyword_data as Record<string, unknown> | undefined
    const keyword = typeof data?.keyword === "string" ? data.keyword.trim() : ""
    if (keyword) out.add(keyword)
  }
  return [...out]
}
```

```ts
const keywords = keywordsFromResult(posted.data)
const intent = await fetchSearchIntentLive({
  keywords,
  languageCode: VISIBILITY_QUERY.languageCode,
})

// A visibilidade orgânica é útil sem intenção. Derrubar a coleta inteira por
// causa do campo mais fraco trocaria dado por nada — a tela diz que faltou.
const intents = intent.status === "ok" ? intent.intents : null
const cost = (posted.cost ?? 0) + (intent.status === "ok" ? intent.cost : 0)
```

- [ ] **Step 5: Criar o tipo e aplicar o limiar**

Em `lib/leads/visibility-audit.ts`:

```ts
export type VisibilityIntentLabel =
  | "informational"
  | "navigational"
  | "commercial"
  | "transactional"

export type VisibilityIntent = {
  label: VisibilityIntentLabel
  /** `null` só na linha v1, que não tinha o dado. */
  probability: number | null
  secondary: Array<{ label: string; probability: number }>
  updatedAt: string | null
}

/** Medido: 36 das 110 classificações ficaram abaixo disto. */
export const VISIBILITY_INTENT_MIN_PROBABILITY = 0.6
```

Em `lib/leads/visibility-presenters.ts`, `visibilityKeywordIntentLabel` sai e entra:

```ts
const INTENT_LABELS: Record<VisibilityIntentLabel, string> = {
  informational: "Informacional",
  navigational: "Navegacional",
  commercial: "Comercial",
  transactional: "Transacional",
}

/**
 * Cala abaixo do limiar. Antes a tela mostrava uma letra, e uma classificação
 * de 0,37 ficava visualmente idêntica a uma de 0,98.
 *
 * `probability: null` é linha v1, que não tinha o dado — ela escapa do limiar e
 * mostra o rótulo que tinha, marcada como antiga, em vez de sumir de repente.
 */
export function visibilityIntentLabel(intent: VisibilityIntent | null): string {
  if (!intent) return "—"
  if (
    intent.probability !== null &&
    intent.probability < VISIBILITY_INTENT_MIN_PROBABILITY
  ) {
    return "—"
  }
  return INTENT_LABELS[intent.label] ?? "—"
}

/** Texto do `title`: a probabilidade e as intenções secundárias medidas. */
export function visibilityIntentDetail(intent: VisibilityIntent | null): string {
  if (!intent) return "Intenção não coletada"
  const parts = [
    intent.probability === null
      ? INTENT_LABELS[intent.label]
      : `${INTENT_LABELS[intent.label]} · ${Math.round(intent.probability * 100)}%`,
  ]
  for (const item of intent.secondary) {
    parts.push(`${item.label} · ${Math.round(item.probability * 100)}%`)
  }
  return parts.join(" | ")
}
```

- [ ] **Step 6: Rodar os testes**

```bash
pnpm test
```

Esperado: PASS.

- [ ] **Step 7: Trocar a célula da tabela**

```tsx
<TableCell className="px-1 py-2 text-xs/relaxed text-muted-foreground">
  <span title={visibilityIntentDetail(row.intent)}>
    {visibilityIntentLabel(row.intent)}
  </span>
</TableCell>
```

- [ ] **Step 8: Verificar**

```bash
pnpm test && pnpm lint && pnpm exec tsc --noEmit
```

- [ ] **Step 9: Commit (marcar a fronteira, não executar)**

```
feat(visibilidade): intenção pela fonte dedicada, com probabilidade e limiar
```

---

### Task 6: O gap de host não-canônico e a guarda de cobertura

Hoje só `no_local_top20` verifica se a amostra cobre o footprint. `homepage_only` roda sobre uma amostra **ordenada por tráfego** — e a home lidera o ETV, o que enviesa a regra a disparar.

**Files:**
- Modify: `lib/leads/visibility-audit.ts:317-378` (`visibilityGapsForSnapshot`, `VisibilityGapId`, `VISIBILITY_GAP_LABELS`)
- Modify: `lib/leads/visibility-opportunities.ts:23-33`
- Modify: `lib/leads/visibility-presenters.ts:53-64, 96-103` (`gapDetail`, `overviewIds`)
- Create: `lib/leads/visibility-gaps.test.mjs`

**Interfaces:**
- Consumes: `VisibilitySnapshot.hosts`, `.coverage`, `isHomepageUrl` das tasks 1 e 4.
- Produces: `VisibilityGapId` ganha `"non_canonical_host_traffic"`.

- [ ] **Step 1: Escrever os testes que falham**

`lib/leads/visibility-gaps.test.mjs`:

```js
import assert from "node:assert/strict"
import { test } from "node:test"

import { visibilityGapsForSnapshot } from "./visibility-audit.ts"

function snapshotWith(overrides) {
  return {
    version: 2,
    source: "dataforseo_labs",
    domain: "buscaorganica.com.br",
    locationLabel: "Brazil",
    languageCode: "pt",
    collectedAt: "2026-09-10T00:00:00.000Z",
    searchCount: 1,
    coverage: { returned: 2, total: 2, truncated: false },
    hosts: [],
    indexAge: null,
    costUsd: null,
    droppedRows: 0,
    localPack: null,
    aiOverview: null,
    metrics: {
      keywordCount: 2,
      estimatedTraffic: 500,
      estimatedTrafficCost: null,
      positionBuckets: null,
    },
    keywords: [],
    ...overrides,
  }
}

const args = { companyName: "Busca Orgânica", city: "São Paulo" }

test("acusa tráfego concentrado fora do host principal", () => {
  // O caso medido: 77 das 110 keywords ranqueando num subdomínio de homologação.
  const gaps = visibilityGapsForSnapshot({
    snapshot: snapshotWith({
      hosts: [
        { host: "www.buscaorganica.com.br", keywords: 33, traffic: 348, isCanonical: true },
        { host: "aprov.buscaorganica.com.br", keywords: 77, traffic: 119, isCanonical: false },
      ],
      keywords: [
        {
          keyword: "x",
          position: { value: 5, previous: null, updatedAt: null },
          url: { full: null, host: "www.buscaorganica.com.br", mainDomain: null, path: "/x", isCanonicalHost: true },
          volume: { value: 10, updatedAt: null },
          traffic: 1,
          difficulty: { index: null, adsCompetition: null, adsCompetitionScore: null, topTenReferringDomains: null },
          intent: null,
          serpFeatures: [],
          languageMismatch: false,
          itemType: "organic",
        },
      ],
    }),
    ...args,
  })
  assert.ok(gaps.includes("non_canonical_host_traffic"))
})

test("não acusa quando tudo está no host principal", () => {
  const gaps = visibilityGapsForSnapshot({
    snapshot: snapshotWith({
      hosts: [
        { host: "www.buscaorganica.com.br", keywords: 110, traffic: 467, isCanonical: true },
      ],
    }),
    ...args,
  })
  assert.equal(gaps.includes("non_canonical_host_traffic"), false)
})

test("cala sobre homepage_only quando a amostra está truncada", () => {
  // A amostra vem ordenada por tráfego, e a home lidera o ETV. Sem esta guarda
  // a regra dispara em domínio grande por construção, não por diagnóstico.
  const gaps = visibilityGapsForSnapshot({
    snapshot: snapshotWith({
      coverage: { returned: 1000, total: 4312, truncated: true },
      keywords: [
        {
          keyword: "marca",
          position: { value: 1, previous: null, updatedAt: null },
          url: { full: null, host: "www.buscaorganica.com.br", mainDomain: null, path: "/", isCanonicalHost: true },
          volume: { value: 390, updatedAt: null },
          traffic: 118,
          difficulty: { index: null, adsCompetition: null, adsCompetitionScore: null, topTenReferringDomains: null },
          intent: null,
          serpFeatures: [],
          languageMismatch: false,
          itemType: "organic",
        },
      ],
    }),
    ...args,
  })
  assert.equal(gaps.includes("homepage_only"), false)
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
pnpm test
```

Esperado: FAIL — `non_canonical_host_traffic` não existe e `homepage_only` dispara.

- [ ] **Step 3: Acrescentar o gap**

Em `lib/leads/visibility-audit.ts`, no union `VisibilityGapId` e no mapa de rótulos:

```ts
non_canonical_host_traffic: "Tráfego orgânico fora do host principal",
```

```ts
/** Acima disto, o host secundário deixou de ser detalhe. */
export const VISIBILITY_NON_CANONICAL_SHARE = 0.2
```

- [ ] **Step 4: Implementar a regra e a guarda**

Dentro de `visibilityGapsForSnapshot`, substituir o bloco de `sampleCoversFootprint` (linhas 340-353) por uma guarda única, e aplicá-la aos três:

```ts
/**
 * A amostra vem truncada e ordenada por tráfego. Num domínio grande, "não
 * encontrei" não é "não existe" — e não saber não é um gap. A guarda nasceu em
 * `no_local_top20`, mas vale igual em `homepage_only` (a home lidera o ETV, o
 * que enviesa a regra a disparar) e em `brand_only_visibility`.
 */
const sampleCoversFootprint = !snapshot.coverage.truncated
```

```ts
if (sampleCoversFootprint && ranked.every((row) => isHomepageUrl(row.url))) {
  gaps.push("homepage_only")
}

const nonCanonical = snapshot.hosts.filter((host) => !host.isCanonical)
const totalKeywords = snapshot.hosts.reduce((sum, h) => sum + h.keywords, 0)
const totalTraffic = snapshot.hosts.reduce((sum, h) => sum + h.traffic, 0)
const shareOf = (part: number, whole: number) => (whole > 0 ? part / whole : 0)
if (
  nonCanonical.length > 0 &&
  (shareOf(nonCanonical.reduce((s, h) => s + h.keywords, 0), totalKeywords) >=
    VISIBILITY_NON_CANONICAL_SHARE ||
    shareOf(nonCanonical.reduce((s, h) => s + h.traffic, 0), totalTraffic) >=
      VISIBILITY_NON_CANONICAL_SHARE)
) {
  gaps.push("non_canonical_host_traffic")
}
```

O `brand_only_visibility` ganha `sampleCoversFootprint &&` na mesma condição.

- [ ] **Step 5: Ligar o gap à oportunidade**

Em `lib/leads/visibility-opportunities.ts`:

```ts
const HIGH_IMPACT = new Set<VisibilityGapId>([
  "not_ranking",
  "brand_only_visibility",
  "no_local_top20",
  "non_canonical_host_traffic",
])
```

```ts
non_canonical_host_traffic: "Consolidar o tráfego no domínio principal",
```

Em `lib/leads/visibility-presenters.ts`, `gapDetail` e `overviewIds`:

```ts
if (id === "non_canonical_host_traffic") {
  return "Parte das páginas ranqueadas está em outro host"
}
```

Por `mergeVisibilityOpportunities`, o gap chega sozinho ao score do pilar, ao roadmap e ao PDF — `diagnosis-compile.ts` **não é tocado nesta task** (a Task 4 já mexeu nele, por outro motivo).

- [ ] **Step 6: Rodar os testes**

```bash
pnpm test
```

Esperado: PASS nos 3 testes novos e nos 15 anteriores.

- [ ] **Step 7: Verificar**

```bash
pnpm test && pnpm lint && pnpm exec tsc --noEmit
```

- [ ] **Step 8: Commit (marcar a fronteira, não executar)**

```
feat(visibilidade): gap de host não-canônico e guarda de cobertura nos três gaps
```

---

### Task 7: Verificação na tela, com coleta real

Os testes travam o mapeamento; eles não provam que a etapa está legível. Esta task é a única que exige o app rodando.

**Files:** nenhum, exceto correções que a verificação revelar.

**Interfaces:**
- Consumes: tudo.

- [ ] **Step 1: Pedir o login**

O app exige sessão para abrir a etapa. **Peça as credenciais ao dono do repo antes de começar** — sem elas a verificação visual não roda, e tentar contornar só gasta tempo.

- [ ] **Step 2: Subir o preview**

Usar o Browser pane (`preview_start` com o `name` de `.claude/launch.json`), **nunca** `pnpm dev` pelo terminal.

- [ ] **Step 3: Rodar uma coleta real**

Abrir um lead com site cadastrado, ir à etapa Visibilidade e clicar em "Analisar visibilidade". Custo esperado: ~US$ 0,05 (duas chamadas).

- [ ] **Step 4: Conferir os sete critérios da spec**

- [ ] URL completa no `title`, host destacado quando não-canônico
- [ ] Nenhuma célula de dificuldade com `%`; KD zero como `—`
- [ ] Nenhuma intenção com probabilidade < 0,60 exibida
- [ ] "Coletado em" e "Índice de" separados no cabeçalho
- [ ] Cobertura declarada acima da tabela
- [ ] `non_canonical_host_traffic` na lista de oportunidades, se o lead tiver
- [ ] `read_console_messages` sem erro

- [ ] **Step 5: Abrir um snapshot v1**

Abrir um lead cuja última análise é anterior à mudança. A etapa precisa renderizar, com as colunas novas em `—` e a fronteira marcada. **Se sumir alguma linha, é regressão de leitura — pare e conserte antes de qualquer outra coisa.**

- [ ] **Step 6: Checar responsivo e tema**

`resize_window` em `mobile` e `colorScheme: "dark"`. A tabela rola dentro do próprio contêiner; o `body` não rola na horizontal.

- [ ] **Step 7: Screenshot para o dono do repo**

`computer {action: "screenshot"}` da etapa com dado real, e enviar com `SendUserFile`.

- [ ] **Step 8: Atualizar a documentação**

Em `docs/auditoria/2026-09-04-impedimentos-dataforseo.md`, a frase *"Os demais mapeadores do DataForSEO nunca executaram contra resposta real"* deixou de ser verdade para `mapRankedKeywordsLiveResult`. Trocar por um ponteiro para `2026-09-10-onda0-visibilidade.md`.

- [ ] **Step 9: Commit (marcar a fronteira, não executar)**

```
docs(visibilidade): registra a execução real do mapeador de ranked_keywords
```

---

## O que este plano deliberadamente não faz

- **Não adiciona `bulk_keyword_difficulty`.** Medido em 2026-09-10: devolve os mesmos 98 zeros, 1 divergência em 110.
- **Não tenta bater com Ubersuggest, Semrush ou Ahrefs.** Índices e modelos proprietários divergem por construção.
- **Não redesenha a etapa.** As mudanças de tela são só as exigidas pelos campos novos.
- **Não mede `local_pack` nem `ai_overview_reference`.** As duas seções vieram zeradas, então a forma de `serp_item` para esses tipos **continua não observada**. O mapeador nasce defensivo, e o primeiro lead que os tiver é a validação — que é exatamente o erro que este trabalho veio corrigir, se for esquecido.
