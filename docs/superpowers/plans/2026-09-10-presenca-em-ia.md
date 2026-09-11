# Presença em IA — Onda 0 e Onda 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a sexta etapa da auditoria de lead — **Presença em IA** — medindo o status do negócio diante dos motores generativos a partir de snapshots que já existem, e fazendo-a destravar o Diagnóstico como as cinco anteriores.

**Architecture:** A etapa **lê** as coletas que já existem (website, visibilidade, backlinks) e as reprojeta sob o vocabulário de GEO, em vez de coletar de novo. A onda 1 inteira roda com **zero chamada paga nova**. O julgamento subjetivo vive fora do snapshot append-only, em `lead_geo_reviews`, no modelo exato de `lead_visibility_reviews`. O pilar `geo` entra no diagnóstico junto com o destravamento, porque etapa que destrava sem pilar deixa o documento devendo a seção que virou pré-requisito.

**Tech Stack:** Next.js 16 (App Router, Server Actions), TypeScript, Supabase (`jsonb` + RLS), DataForSEO, `node --test` com type-stripping do Node 22.

**Spec:** `docs/superpowers/specs/2026-09-10-presenca-em-ia-design.md`
**Precedentes obrigatórios:** `docs/auditoria/2026-09-04-handoff-auditoria.md` (as armadilhas), `docs/auditoria/2026-09-10-onda0-visibilidade.md` (o formato da onda 0)

## Global Constraints

- **Leia `node_modules/next/dist/docs/` antes de escrever código de Next.** Esta versão tem breaking changes (`AGENTS.md` na raiz).
- **O `git` é do dono do repo.** Os passos "Commit" marcam a fronteira de uma entrega revisável; **não execute `git commit`** — pare, avise, e deixe o commit para ele.
- **Verificação só no fim, uma vez.** **Não rode `pnpm test`, `pnpm lint` nem `pnpm exec tsc --noEmit` entre tarefas** — a bateria completa é a Task 10. Os arquivos `.test.mjs` que este plano cria são **documentação do formato esperado**, escritos junto com o módulo e executados uma vez só, no fim. É a regra do repositório, e ela difere da skill de writing-plans de propósito.
- **Nunca use `pnpm build`.** `tsc --noEmit` é o mesmo type-check sem o custo do build.
- **Nada de subagentes de busca neste repo.** Ler e buscar direto.
- **A árvore é compartilhada com outra sessão.** Antes de chamar um erro de seu, confira se o arquivo que falhou está entre os que você tocou.
- **Módulos de `lib/leads/` são puros e importam com extensão `.ts`.** É o que permite `node --test` carregá-los por type-stripping. **Não adicione `server-only` a nenhum deles** — as regras de gap rodam em componente de cliente.
- **`lib/dataforseo/limits.ts` não tem imports de módulo `server-only`.** Os dois lados leem dele: o fetcher e a calculadora de custo da página de Ferramentas.
- **A verificação da fronteira `server-only` é transitiva.** Checar só os imports diretos passa e não prova nada. Já quebrou o build duas vezes.
- **O leitor tolera o passado, o escritor só produz o presente.** Nenhuma mudança pode fazer um leitor devolver `null` para linha já gravada.
- **`null` é "não coletado"; `[]` é "coletado e vazio".** A distinção aparece em cinco campos deste plano e não é estilo.
- **Migrations reexecutáveis:** `create table if not exists`, `drop policy if exists` antes de cada `create policy`, e `revoke all ... from anon, authenticated` antes do `grant`.
- **Constantes com valor exato, copiadas da spec:**
  - `GEO_SERVER_RENDERED_MIN_WORDS = 120`
  - `GEO_QUESTION_HEADINGS_MIN = 3`
  - `GEO_TITLE_MIN = 50`, `GEO_TITLE_MAX = 60`
  - `GEO_META_MIN = 120`, `GEO_META_MAX = 160`
  - `GEO_NOTES_MAX = 2000`, `GEO_REVIEW_NOTE_MAX = 400`
- **Copy de interface em pt-BR**, seguindo `.claude/skills/suite-frontend/references/writing.md`.
- **`cn` importado de `"cn"`**, nunca de `@/lib/utils`.
- **Ícone só de `react-icons/ri`.** Zero Lucide em código de produto.
- **Ausência é `—`, nunca zero.**
- **Ambiente Git Bash no Windows:** `grep -P` não funciona; use `grep -E`. `bc` não existe.

---

## File Structure

| arquivo | responsabilidade |
|---|---|
| `supabase/migrations/20260927000000_lead_geo_audits.sql` | **Criar** — coleta append-only |
| `supabase/migrations/20260928000000_lead_geo_reviews.sql` | **Criar** — julgamento + prompt set |
| `lib/leads/geo-audit.ts` | **Criar** — tipos do snapshot, leitor tolerante, ids e rótulos de gap |
| `lib/leads/geo-accessibility.ts` | **Criar** — as sete regras de acesso, puro sobre `WebsiteCrawl` |
| `lib/leads/geo-content.ts` | **Criar** — os cinco checks determinísticos de conteúdo |
| `lib/leads/geo-review.ts` | **Criar** — três critérios do analista, no modelo de `visibility-review.ts` |
| `lib/leads/geo-opportunities.ts` | **Criar** — gaps → oportunidades, sem duplicar pilar |
| `lib/leads/geo-step-tabs.ts` | **Criar** — abas da etapa |
| `lib/leads/geo-audit.test.mjs` | **Criar** — trava as regras contra um crawl real |
| `lib/leads/geo-audit.fixture.json` | **Criar** — crawl recortado de um lead já auditado |
| `lib/validations/lead-geo.ts` | **Criar** — schemas de entrada das actions |
| `app/actions/leads/geo-access.ts` | **Criar** — guard, espelhando `visibility-access.ts` |
| `app/actions/leads/analyze-geo.ts` | **Criar** — a coleta base |
| `app/actions/leads/upsert-geo-review.ts` | **Criar** — julgamento do analista |
| `lib/website-audit/parse.ts` | **Modificar** — `datePublished` / `dateModified` do JSON-LD |
| `lib/website-audit/sitemap.ts` | **Modificar** — `lastmod` |
| `lib/website-audit/crawl.ts` | **Modificar** — propaga `lastmod` |
| `lib/leads/website-audit.ts` | **Modificar** — `schemaDates` na página, `lastmod` no sitemap |
| `lib/leads/gbp-audit-rail.ts` | **Modificar** — sexta etapa, destravamento, progresso |
| `lib/leads/diagnosis-document.ts` | **Modificar** — pilar `geo`, `measured`, leitura tolerante |
| `lib/leads/diagnosis-compile.ts` | **Modificar** — scorecard e roadmap do pilar novo |
| `lib/leads/audit-baseline.ts` | **Modificar** — `geoAuditId` |
| `app/actions/leads/compile-lead-diagnosis.ts` | **Modificar** — gate, fingerprint, embed |
| `app/actions/leads/get-lead.ts` | **Modificar** — embed de `geoAudit` e `geoReview` |
| `app/actions/leads/index.ts` | **Modificar** — reexports |
| `components/custom/LeadGeoPanel/*` | **Criar** — a tela, no padrão das etapas existentes |
| `components/custom/LeadGbpPanel/LeadGbpPanel.tsx` | **Modificar** — roteamento da etapa |

---

### Task 1: Onda 0 — a sondagem de payload

**Não bloqueia as tarefas seguintes.** A onda 1 inteira roda sem chamada paga, então as Tasks 2–10 podem começar antes desta terminar. O que esta task decide é se as **ondas 2, 3 e 4 existem** — e a pergunta 1 pode reprovar metade delas.

Esta task gasta dinheiro real. O passo final para e pergunta antes de qualquer coisa.

**Files:**
- Create: `docs/auditoria/evidencias/{data}-presenca-em-ia/probe.mjs`
- Create: `docs/auditoria/evidencias/{data}-presenca-em-ia/01-user-data.json`
- Create: `docs/auditoria/evidencias/{data}-presenca-em-ia/02-summary.json`
- Create: `docs/auditoria/{data}-onda0-presenca-em-ia.md`

**Interfaces:**
- Consumes: nada.
- Produces: as respostas que as ondas 2–4 consomem. Nenhum símbolo de código.

- [ ] **Step 1: Confirmar as credenciais**

```bash
grep -E "DATAFORSEO_(LOGIN|PASSWORD)" .env.local | sed -E 's/=.*/=<set>/'
```

Esperado: as duas linhas presentes. `.env.local` é versionado de propósito neste repo — não "conserte" o `.gitignore`.

- [ ] **Step 2: Escrever o script de sondagem**

Criar `docs/auditoria/evidencias/{data}-presenca-em-ia/probe.mjs`, no formato do `probe.mjs` da onda 0 da visibilidade:

```js
/**
 * Onda 0 da Presença em IA.
 *
 * Cinco perguntas que só o payload responde. A primeira pode reprovar metade
 * do desenho: não se sabe se esta conta tem a seção `ai_optimization`
 * liberada — a evidência de 2026-09-10 listou `labs_prices_raw_keys` e só
 * trouxe `dataforseo_labs`.
 *
 * Grava os resumos ao lado, nunca os payloads crus: a onda 0 da visibilidade
 * produziu 840 KB por chamada e não os versionou, regerando tudo pelo script.
 */
import { readFileSync, writeFileSync } from "node:fs"

const env = Object.fromEntries(
  readFileSync(new URL("../../../../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const at = line.indexOf("=")
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()]
    }),
)

const AUTH =
  "Basic " +
  Buffer.from(
    `${env.DATAFORSEO_LOGIN}:${env.DATAFORSEO_PASSWORD}`,
    "utf8",
  ).toString("base64")

async function call(path, body) {
  const res = await fetch(`https://api.dataforseo.com/v3${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: AUTH, "Content-Type": "application/json" },
    body: body ? JSON.stringify([body]) : undefined,
  })
  const json = await res.json()
  return {
    httpStatus: res.status,
    statusCode: json.status_code,
    statusMessage: json.status_message,
    cost: json.cost,
    task: json.tasks?.[0] ?? null,
  }
}

const out = { at: new Date().toISOString(), answers: {} }

// P1 — a conta tem `ai_optimization`? Grátis.
const userData = await call("/appendix/user_data")
const prices = userData.task?.result?.[0]?.price ?? {}
out.answers.p1_ai_optimization_keys = Object.keys(
  prices.ai_optimization ?? {},
)
out.answers.p1_api_sections = Object.keys(prices)
out.answers.p1_balance = userData.task?.result?.[0]?.money?.balance ?? null
writeFileSync(
  new URL("./01-user-data.json", import.meta.url),
  JSON.stringify({ prices: prices.ai_optimization ?? null }, null, 2),
)

// P2 — Brasil e `pt` existem para `platform: google`?
const locs = await call("/ai_optimization/llm_mentions/locations_and_languages", {})
const rows = locs.task?.result ?? []
out.answers.p2_brazil = rows.find(
  (row) => row.location_code === 2076 || row.location_name === "Brazil",
) ?? null
out.answers.p2_total_locations = rows.length

// P3 — `ai_search_volume` responde em português?
const kws = [
  "busca organica",
  "consultoria de seo",
  "agencia de marketing digital",
  "primeira pagina do google",
]
const volume = await call(
  "/ai_optimization/ai_keyword_data/keywords_search_volume/live",
  { keywords: kws, location_code: 2076, language_code: "pt" },
)
out.answers.p3_cost = volume.cost
out.answers.p3_status = volume.statusMessage
out.answers.p3_items = (volume.task?.result?.[0]?.items ?? []).map((item) => ({
  keyword: item.keyword,
  ai_search_volume: item.ai_search_volume,
  monthly: Array.isArray(item.ai_monthly_searches)
    ? item.ai_monthly_searches.length
    : null,
}))

// P4 — um `llm_responses/live` por provedor, com busca no Brasil.
out.answers.p4 = {}
for (const provider of ["chat_gpt", "claude", "gemini", "perplexity"]) {
  const models = await call(`/ai_optimization/${provider}/llm_responses/models`)
  const first = models.task?.result?.[0]?.items?.[0]?.model_name ?? null
  if (!first) {
    out.answers.p4[provider] = { models: null, error: models.statusMessage }
    continue
  }
  const answer = await call(`/ai_optimization/${provider}/llm_responses/live`, {
    user_prompt: "melhores empresas de marketing digital em Curitiba",
    model_name: first,
    web_search: true,
    web_search_country_iso_code: "BR",
    web_search_city: "Curitiba",
    max_output_tokens: 1024,
  })
  const result = answer.task?.result?.[0] ?? null
  out.answers.p4[provider] = {
    model: first,
    cost: answer.cost,
    moneySpent: result?.money_spent ?? null,
    webSearchUsed: result?.web_search ?? null,
    annotations: Array.isArray(result?.annotations)
      ? result.annotations.length
      : null,
    annotationSample: result?.annotations?.[0] ?? null,
    fanOutQueries: Array.isArray(result?.fan_out_queries)
      ? result.fan_out_queries.length
      : null,
  }
}

// P5 — o filtro `in` casa `pt.wikipedia.org`?
const CATALOG = [
  "wikipedia.org", "pt.wikipedia.org", "reddit.com", "youtube.com",
  "linkedin.com", "quora.com", "medium.com", "reclameaqui.com.br",
]
const cites = await call("/backlinks/backlinks/live", {
  target: "buscaorganica.com.br",
  mode: "one_per_domain",
  limit: 100,
  backlinks_status_type: "live",
  filters: [["domain_from", "in", CATALOG]],
})
out.answers.p5_cost = cites.cost
out.answers.p5_status = cites.statusMessage
out.answers.p5_domains = (cites.task?.result?.[0]?.items ?? []).map(
  (item) => item.domain_from,
)

writeFileSync(
  new URL("./02-summary.json", import.meta.url),
  JSON.stringify(out, null, 2),
)
console.log(JSON.stringify(out.answers, null, 2))
```

- [ ] **Step 3: Rodar a sondagem**

```bash
node "docs/auditoria/evidencias/$(date +%Y-%m-%d)-presenca-em-ia/probe.mjs"
```

- [ ] **Step 4: Ler a pergunta 1 antes de qualquer outra**

Se `p1_ai_optimization_keys` vier **vazio**, a conta não tem a seção liberada: as perguntas 3 e 4 falharam por permissão, não por dado. **Pare, registre isso no documento, e avise** — as ondas 2 e 3 precisam de decisão comercial antes de existir. A onda 1 segue de pé, intacta.

- [ ] **Step 5: Escrever o documento de evidência**

Criar `docs/auditoria/{data}-onda0-presenca-em-ia.md`, no formato de `2026-09-10-onda0-visibilidade.md`: uma tabela `chamada | custo | veredito`, e uma seção por pergunta com o que a medição **reprovou**, não só o que passou. A onda 0 da visibilidade só valeu porque reprovou três campos.

Registrar obrigatoriamente:
- O custo total real, somado de `cost` e de `money_spent`.
- Se `annotations` veio **vazio** em algum provedor — a documentação avisa que *"annotations may return empty even when web_search is true"*, e isso decide se `domainCited` é medível.
- Se `ai_search_volume` veio **zero** em português. Se vier, é o mesmo padrão do KD: `0` com cara de resposta. A onda 2 passa a ler `0` como ausência.

- [ ] **Step 6: Commit (marcar a fronteira, não executar)**

```
docs(auditoria): onda 0 da presença em IA, com evidência e custos
```

Pare aqui e avise o dono do repo. Não rode `git commit`.

---

### Task 2: As duas tabelas e a fronteira de leitura

Cria o lugar onde a etapa grava e o tipo que todo o resto consome. Nada ainda coleta; esta task entrega o vocabulário.

**Files:**
- Create: `supabase/migrations/20260927000000_lead_geo_audits.sql`
- Create: `supabase/migrations/20260928000000_lead_geo_reviews.sql`
- Create: `lib/leads/geo-audit.ts`
- Create: `lib/leads/geo-review.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: `GeoSnapshot`, `GeoAccessibility`, `GeoContent`, `GeoCitations`, `GeoAiOverview`, `GeoAiDemand`, `GeoPromptVisibility`, `LeadGeoAudit`, `readLeadGeoAuditRow(row): LeadGeoAudit | null`, `readGeoSnapshot(value): GeoSnapshot | null`, `GEO_GAP_IDS`, `GeoGapId`, `GEO_GAP_LABELS`, `geoGapLabel(id)`. E de `geo-review.ts`: `GEO_REVIEW_CRITERION_IDS`, `GeoReviewCriterionId`, `GeoReviewVerdict`, `GeoReview`, `GeoReviewAnswer`, `GEO_REVIEW_CATALOG`, `emptyGeoReview()`, `readLeadGeoReviewRow(row)`, `GeoPromptSet`, `readGeoPromptSet(value)`.

- [ ] **Step 1: Migration da coleta**

Criar `supabase/migrations/20260927000000_lead_geo_audits.sql`:

```sql
-- Coleta da etapa de Presença em IA.
--
-- Append-only desde o dia 1, ao contrario de `lead_visibility_audits`, que
-- nasceu com indice unico por lead e precisou da 20260917000000 para virar
-- historico. Sem acumulo nao existe "antes", e a auditoria nao serve de
-- baseline.

create table if not exists public.lead_geo_audits (
  id          uuid        primary key default gen_random_uuid(),
  lead_id     uuid        not null references public.leads(id) on delete cascade,
  domain      text        not null,
  snapshot    jsonb       not null,
  fetched_at  timestamptz not null default now(),
  fetched_by  uuid        not null references public.users(id),
  constraint lead_geo_audits_snapshot_obj_chk
    check (jsonb_typeof(snapshot) = 'object')
);

create index if not exists lead_geo_audits_lead_recent_idx
  on public.lead_geo_audits (lead_id, fetched_at desc);

alter table public.lead_geo_audits enable row level security;

drop policy if exists "lead_geo_audits_select_commercial" on public.lead_geo_audits;
create policy "lead_geo_audits_select_commercial"
  on public.lead_geo_audits for select to authenticated
  using (public.is_commercial_member());

drop policy if exists "lead_geo_audits_insert_commercial" on public.lead_geo_audits;
create policy "lead_geo_audits_insert_commercial"
  on public.lead_geo_audits for insert to authenticated
  with check (public.is_commercial_member());

drop policy if exists "lead_geo_audits_update_commercial" on public.lead_geo_audits;
create policy "lead_geo_audits_update_commercial"
  on public.lead_geo_audits for update to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

drop policy if exists "lead_geo_audits_delete_commercial" on public.lead_geo_audits;
create policy "lead_geo_audits_delete_commercial"
  on public.lead_geo_audits for delete to authenticated
  using (public.is_commercial_member());

revoke all on table public.lead_geo_audits from anon, authenticated;
grant select, insert, update, delete on table public.lead_geo_audits to authenticated;
```

- [ ] **Step 2: Migration do julgamento**

Criar `supabase/migrations/20260928000000_lead_geo_reviews.sql`, copiando a forma de `20260926000000_lead_visibility_reviews.sql` e acrescentando `prompt_set`:

```sql
-- Julgamento do analista da etapa de Presenca em IA, e o conjunto de prompts
-- fixado.
--
-- `prompt_set` mora aqui, e nao no snapshot, pelo mesmo motivo que
-- `lead_digital_channels.audit_paths` fixou a amostra de paginas: prompt que
-- muda entre coletas transforma taxa de mencao em numero sem significado. E a
-- armadilha dos metodos divergentes na mesma serie temporal, que ja custou o
-- `maps-task.ts`.
--
-- `null` em `prompt_set` significa **nao fixado**, nunca "fixado e vazio".

create table if not exists public.lead_geo_reviews (
  id          uuid        primary key default gen_random_uuid(),
  lead_id     uuid        not null references public.leads(id) on delete cascade,
  review      jsonb       not null default '{}'::jsonb,
  prompt_set  jsonb,
  notes       text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid        references public.users(id),
  constraint lead_geo_reviews_notes_len_chk
    check (
      notes is null
      or char_length(trim(notes)) between 1 and 2000
    ),
  constraint lead_geo_reviews_review_obj_chk
    check (jsonb_typeof(review) = 'object')
);

create unique index if not exists lead_geo_reviews_lead_id_uidx
  on public.lead_geo_reviews (lead_id);

alter table public.lead_geo_reviews enable row level security;

drop policy if exists "lead_geo_reviews_select_commercial" on public.lead_geo_reviews;
create policy "lead_geo_reviews_select_commercial"
  on public.lead_geo_reviews for select to authenticated
  using (public.is_commercial_member());

drop policy if exists "lead_geo_reviews_insert_commercial" on public.lead_geo_reviews;
create policy "lead_geo_reviews_insert_commercial"
  on public.lead_geo_reviews for insert to authenticated
  with check (public.is_commercial_member());

drop policy if exists "lead_geo_reviews_update_commercial" on public.lead_geo_reviews;
create policy "lead_geo_reviews_update_commercial"
  on public.lead_geo_reviews for update to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

drop policy if exists "lead_geo_reviews_delete_commercial" on public.lead_geo_reviews;
create policy "lead_geo_reviews_delete_commercial"
  on public.lead_geo_reviews for delete to authenticated
  using (public.is_commercial_member());

revoke all on table public.lead_geo_reviews from anon, authenticated;
grant select, insert, update, delete on table public.lead_geo_reviews to authenticated;
```

- [ ] **Step 3: Os tipos e o leitor**

Criar `lib/leads/geo-audit.ts`. Puro, sem `server-only`, imports com extensão `.ts`:

```ts
/**
 * Etapa de Presença em IA — tipos, leitor e catálogo de gaps.
 *
 * A etapa **lê** as coletas que já existem em vez de coletar de novo: o
 * snapshot de website responde acessibilidade e conteúdo, o de visibilidade
 * responde citação em AI Overview, e o de backlinks responde citação em fonte
 * de autoridade. Por isso `sources` guarda a data de cada origem: carimbar
 * `collectedAt` como se fosse a hora da medida foi exatamente o defeito que a
 * onda 0 da visibilidade encontrou, onde o índice tinha mediana de 59 dias.
 */

export const GEO_NOTES_MAX = 2000

/** Abaixo disto a home é casca de SPA, não site enxuto. Ver a spec. */
export const GEO_SERVER_RENDERED_MIN_WORDS = 120
export const GEO_QUESTION_HEADINGS_MIN = 3
export const GEO_TITLE_MIN = 50
export const GEO_TITLE_MAX = 60
export const GEO_META_MIN = 120
export const GEO_META_MAX = 160

export type GeoAccessibility = {
  llmsTxt: { found: boolean; status: number | null }
  aiCrawlers: Array<{ agent: string; blocked: boolean }>
  blockedAiCrawlers: number
  searchCrawlersBlocked: boolean
  sitemap: { found: boolean; urlCount: number | null }
  noindexTag: boolean
  noindexHeader: boolean
  serverRenderedWords: number
  contentRequiresJs: boolean
}

export type GeoFreshness = {
  /** `null` nos três = coleta anterior à extensão do parser. Ver `collected`. */
  datePublished: string | null
  dateModified: string | null
  sitemapLastmod: string | null
  /** `false` quando o snapshot de website é anterior ao campo. */
  collected: boolean
}

export type GeoContent = {
  identitySchema: string[]
  hasFaqSchema: boolean
  questionHeadings: number
  headingDepth: { levels: number; skips: boolean }
  contactPoints: {
    phone: boolean
    email: boolean
    address: boolean
    whatsapp: boolean
  }
  freshness: GeoFreshness
  titleLength: number | null
  metaDescriptionLength: number | null
}

export type GeoCitationSource = {
  domain: string
  links: number
  firstUrl: string | null
}

export type GeoCitations = {
  catalogVersion: number
  sources: GeoCitationSource[]
  truncated: boolean
}

export type GeoAiOverviewKeyword = {
  keyword: string
  url: string | null
  position: number | null
  volume: number | null
  etv: number | null
}

export type GeoAiOverview = {
  keywords: GeoAiOverviewKeyword[]
  count: number
  etv: number | null
  /** O lead ranqueia organicamente? Sem isso o gap acusaria duas vezes. */
  hasOrganicFootprint: boolean
}

export type GeoAiDemand = {
  keywords: Array<{ keyword: string; aiSearchVolume: number | null }>
  totalAiSearchVolume: number | null
  locationLabel: string
  languageCode: string
}

export type GeoPromptFamily = "discovery" | "problem" | "comparison" | "brand"

export type GeoPromptRun = {
  promptId: string
  provider: string
  modelName: string | null
  at: string
  mentioned: boolean
  /** Ordem da primeira ocorrência entre as marcas detectadas. Não é rank. */
  position: number | null
  domainCited: boolean
  brands: Array<{ name: string; position: number }>
  costUsd: number | null
}

export type GeoPromptVisibility = {
  promptSetVersion: number
  runs: GeoPromptRun[]
  metrics: {
    mentionRate: number
    averagePosition: number | null
    dominance: number | null
    byProvider: Array<{
      provider: string
      mentionRate: number
      averagePosition: number | null
    }>
    competitors: Array<{
      name: string
      mentionRate: number
      averagePosition: number | null
    }>
  }
}

export type GeoSnapshot = {
  version: 1
  domain: string
  collectedAt: string
  costUsd: number | null
  sources: {
    websiteAuditAt: string | null
    visibilityAuditAt: string | null
    backlinkAuditAt: string | null
  }
  accessibility: GeoAccessibility
  content: GeoContent
  /** `null` = onda 2 não rodou neste lead. */
  citations: GeoCitations | null
  aiOverview: GeoAiOverview | null
  aiDemand: GeoAiDemand | null
  /** `null` = **não sondado**. Os três gaps de sondagem não existem. */
  promptVisibility: GeoPromptVisibility | null
}

export type LeadGeoAudit = {
  id: string
  lead_id: string
  domain: string
  snapshot: GeoSnapshot
  fetched_at: string
  fetched_by: string
}

export const GEO_GAP_IDS = [
  "ai_crawlers_blocked",
  "content_requires_js",
  "no_ai_overview_presence",
  "no_llms_txt",
  "no_faq_content",
  "no_identity_schema",
  "no_freshness_signals",
  "no_machine_readable_contact",
  "no_authority_citations",
  "brand_unknown_to_llms",
  "absent_from_discovery_prompts",
  "outranked_by_competitors",
] as const

export type GeoGapId = (typeof GEO_GAP_IDS)[number]

export const GEO_GAP_LABELS: Record<GeoGapId, string> = {
  ai_crawlers_blocked: "Robôs de IA bloqueados no robots.txt",
  content_requires_js: "Conteúdo só aparece depois do JavaScript",
  no_ai_overview_presence: "Sem citação na visão geral de IA do Google",
  no_llms_txt: "Sem arquivo llms.txt",
  no_faq_content: "Sem conteúdo em formato de pergunta e resposta",
  no_identity_schema: "Sem schema que identifique a empresa",
  no_freshness_signals: "Sem sinal de conteúdo atualizado",
  no_machine_readable_contact: "Contato não legível por máquina",
  no_authority_citations: "Sem citação em fontes que a IA consulta",
  brand_unknown_to_llms: "As IAs não reconhecem a marca",
  absent_from_discovery_prompts: "Ausente quando pedem recomendação",
  outranked_by_competitors: "Citada depois dos concorrentes",
}

export function geoGapLabel(id: GeoGapId): string {
  return GEO_GAP_LABELS[id] ?? id
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function asFinite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asBool(value: unknown): boolean {
  return value === true
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

/**
 * Tolerante por dentro, estrito na chave que identifica o formato. Snapshot
 * sem `version` nem `domain` não é snapshot desta etapa e vira `null`; o resto
 * degrada para o vazio correspondente, porque uma coleta parcial gravada tem
 * que continuar legível.
 */
export function readGeoSnapshot(value: unknown): GeoSnapshot | null {
  const row = asRecord(value)
  if (!row) return null
  const domain = asString(row.domain)
  const collectedAt = asString(row.collectedAt)
  if (!domain || !collectedAt) return null

  const sources = asRecord(row.sources)
  const accessibility = asRecord(row.accessibility)
  const content = asRecord(row.content)
  const llmsTxt = asRecord(accessibility?.llmsTxt)
  const sitemap = asRecord(accessibility?.sitemap)
  const freshness = asRecord(content?.freshness)
  const contactPoints = asRecord(content?.contactPoints)
  const headingDepth = asRecord(content?.headingDepth)

  return {
    version: 1,
    domain,
    collectedAt,
    costUsd: asFinite(row.costUsd),
    sources: {
      websiteAuditAt: asString(sources?.websiteAuditAt),
      visibilityAuditAt: asString(sources?.visibilityAuditAt),
      backlinkAuditAt: asString(sources?.backlinkAuditAt),
    },
    accessibility: {
      llmsTxt: {
        found: asBool(llmsTxt?.found),
        status: asFinite(llmsTxt?.status),
      },
      aiCrawlers: Array.isArray(accessibility?.aiCrawlers)
        ? accessibility.aiCrawlers.flatMap((entry) => {
            const item = asRecord(entry)
            const agent = asString(item?.agent)
            if (!agent) return []
            return [{ agent, blocked: asBool(item?.blocked) }]
          })
        : [],
      blockedAiCrawlers: asFinite(accessibility?.blockedAiCrawlers) ?? 0,
      searchCrawlersBlocked: asBool(accessibility?.searchCrawlersBlocked),
      sitemap: {
        found: asBool(sitemap?.found),
        urlCount: asFinite(sitemap?.urlCount),
      },
      noindexTag: asBool(accessibility?.noindexTag),
      noindexHeader: asBool(accessibility?.noindexHeader),
      serverRenderedWords: asFinite(accessibility?.serverRenderedWords) ?? 0,
      contentRequiresJs: asBool(accessibility?.contentRequiresJs),
    },
    content: {
      identitySchema: asStringList(content?.identitySchema),
      hasFaqSchema: asBool(content?.hasFaqSchema),
      questionHeadings: asFinite(content?.questionHeadings) ?? 0,
      headingDepth: {
        levels: asFinite(headingDepth?.levels) ?? 0,
        skips: asBool(headingDepth?.skips),
      },
      contactPoints: {
        phone: asBool(contactPoints?.phone),
        email: asBool(contactPoints?.email),
        address: asBool(contactPoints?.address),
        whatsapp: asBool(contactPoints?.whatsapp),
      },
      freshness: {
        datePublished: asString(freshness?.datePublished),
        dateModified: asString(freshness?.dateModified),
        sitemapLastmod: asString(freshness?.sitemapLastmod),
        collected: asBool(freshness?.collected),
      },
      titleLength: asFinite(content?.titleLength),
      metaDescriptionLength: asFinite(content?.metaDescriptionLength),
    },
    // Os quatro abaixo continuam `null` na onda 1. `null` é "não coletado";
    // objeto vazio seria "coletado e vazio", e a tela diria coisas opostas.
    citations: readGeoCitations(row.citations),
    aiOverview: readGeoAiOverview(row.aiOverview),
    aiDemand: readGeoAiDemand(row.aiDemand),
    promptVisibility: readGeoPromptVisibility(row.promptVisibility),
  }
}

function readGeoCitations(value: unknown): GeoCitations | null {
  const row = asRecord(value)
  if (!row) return null
  return {
    catalogVersion: asFinite(row.catalogVersion) ?? 1,
    sources: Array.isArray(row.sources)
      ? row.sources.flatMap((entry) => {
          const item = asRecord(entry)
          const domain = asString(item?.domain)
          if (!domain) return []
          return [
            {
              domain,
              links: asFinite(item?.links) ?? 0,
              firstUrl: asString(item?.firstUrl),
            },
          ]
        })
      : [],
    truncated: asBool(row.truncated),
  }
}

function readGeoAiOverview(value: unknown): GeoAiOverview | null {
  const row = asRecord(value)
  if (!row) return null
  return {
    keywords: Array.isArray(row.keywords)
      ? row.keywords.flatMap((entry) => {
          const item = asRecord(entry)
          const keyword = asString(item?.keyword)
          if (!keyword) return []
          return [
            {
              keyword,
              url: asString(item?.url),
              position: asFinite(item?.position),
              volume: asFinite(item?.volume),
              etv: asFinite(item?.etv),
            },
          ]
        })
      : [],
    count: asFinite(row.count) ?? 0,
    etv: asFinite(row.etv),
    hasOrganicFootprint: asBool(row.hasOrganicFootprint),
  }
}

function readGeoAiDemand(value: unknown): GeoAiDemand | null {
  const row = asRecord(value)
  if (!row) return null
  return {
    keywords: Array.isArray(row.keywords)
      ? row.keywords.flatMap((entry) => {
          const item = asRecord(entry)
          const keyword = asString(item?.keyword)
          if (!keyword) return []
          return [{ keyword, aiSearchVolume: asFinite(item?.aiSearchVolume) }]
        })
      : [],
    totalAiSearchVolume: asFinite(row.totalAiSearchVolume),
    locationLabel: asString(row.locationLabel) ?? "",
    languageCode: asString(row.languageCode) ?? "",
  }
}

function readGeoPromptVisibility(value: unknown): GeoPromptVisibility | null {
  const row = asRecord(value)
  if (!row) return null
  const metrics = asRecord(row.metrics)
  return {
    promptSetVersion: asFinite(row.promptSetVersion) ?? 1,
    runs: Array.isArray(row.runs)
      ? row.runs.flatMap((entry) => {
          const item = asRecord(entry)
          const promptId = asString(item?.promptId)
          const provider = asString(item?.provider)
          const at = asString(item?.at)
          if (!promptId || !provider || !at) return []
          return [
            {
              promptId,
              provider,
              modelName: asString(item?.modelName),
              at,
              mentioned: asBool(item?.mentioned),
              position: asFinite(item?.position),
              domainCited: asBool(item?.domainCited),
              brands: Array.isArray(item?.brands)
                ? item.brands.flatMap((brandEntry) => {
                    const brand = asRecord(brandEntry)
                    const name = asString(brand?.name)
                    if (!name) return []
                    return [{ name, position: asFinite(brand?.position) ?? 0 }]
                  })
                : [],
              costUsd: asFinite(item?.costUsd),
            },
          ]
        })
      : [],
    metrics: {
      mentionRate: asFinite(metrics?.mentionRate) ?? 0,
      averagePosition: asFinite(metrics?.averagePosition),
      dominance: asFinite(metrics?.dominance),
      byProvider: Array.isArray(metrics?.byProvider)
        ? metrics.byProvider.flatMap((entry) => {
            const item = asRecord(entry)
            const provider = asString(item?.provider)
            if (!provider) return []
            return [
              {
                provider,
                mentionRate: asFinite(item?.mentionRate) ?? 0,
                averagePosition: asFinite(item?.averagePosition),
              },
            ]
          })
        : [],
      competitors: Array.isArray(metrics?.competitors)
        ? metrics.competitors.flatMap((entry) => {
            const item = asRecord(entry)
            const name = asString(item?.name)
            if (!name) return []
            return [
              {
                name,
                mentionRate: asFinite(item?.mentionRate) ?? 0,
                averagePosition: asFinite(item?.averagePosition),
              },
            ]
          })
        : [],
    },
  }
}

export function readLeadGeoAuditRow(
  row: Record<string, unknown> | null,
): LeadGeoAudit | null {
  if (!row) return null
  const id = asString(row.id)
  const leadId = asString(row.lead_id)
  const domain = asString(row.domain)
  const fetchedAt = asString(row.fetched_at)
  const fetchedBy = asString(row.fetched_by)
  const snapshot = readGeoSnapshot(row.snapshot)
  if (!id || !leadId || !domain || !fetchedAt || !fetchedBy || !snapshot) {
    return null
  }
  return {
    id,
    lead_id: leadId,
    domain,
    snapshot,
    fetched_at: fetchedAt,
    fetched_by: fetchedBy,
  }
}
```

- [ ] **Step 4: O julgamento do analista**

Criar `lib/leads/geo-review.ts`, copiando o desenho de `lib/leads/visibility-review.ts` — mesmos nomes de tipo, mesmo `verdict: "ok" | "issue" | "na"`, mesmo `other` fora do denominador:

```ts
/**
 * Julgamento do analista na etapa de Presença em IA.
 *
 * Três critérios, e cada um existe porque **não há dado que responda**: nenhum
 * campo de API diz se a página deixa claro que entidade ela representa. Não é
 * espaço sobrando na tela — é a fronteira do que a máquina alcança.
 *
 * Nenhuma LLM julga isto. A decisão é explícita: nesta etapa a LLM é objeto de
 * medição, nunca instrumento de análise.
 */

export const GEO_REVIEW_NOTE_MAX = 400

export const GEO_REVIEW_CRITERION_IDS = [
  "entity_definition",
  "citation_readiness",
  "authority_trust",
  "other",
] as const

export type GeoReviewCriterionId = (typeof GEO_REVIEW_CRITERION_IDS)[number]

export type GeoReviewVerdict = "ok" | "issue" | "na"

export type GeoReviewAnswer = {
  verdict: GeoReviewVerdict | null
  note: string
  updatedAt: string | null
  updatedBy: string | null
}

export type GeoReview = Record<GeoReviewCriterionId, GeoReviewAnswer>

export type GeoReviewImpact = "high" | "medium"

export type GeoReviewCriterion = {
  id: GeoReviewCriterionId
  label: string
  /** Vira o título da oportunidade quando o veredito é `issue`. */
  title: string
  impact: GeoReviewImpact
  allowsNa: boolean
  hasVerdict: boolean
  placeholder: string
}

export const GEO_REVIEW_VERDICT_LABEL: Record<GeoReviewVerdict, string> = {
  ok: "Ok",
  issue: "Problema",
  na: "N/A",
}

/** `other` fica fora: é nota livre, e contá-lo faria a etapa nunca fechar. */
export const GEO_REVIEW_CHIP_IDS = [
  "entity_definition",
  "citation_readiness",
  "authority_trust",
] as const satisfies readonly GeoReviewCriterionId[]

export const GEO_REVIEW_CATALOG: readonly GeoReviewCriterion[] = [
  {
    id: "entity_definition",
    label: "Definição de entidade",
    title: "Deixar claro que empresa a página representa",
    impact: "high",
    allowsNa: false,
    hasVerdict: true,
    placeholder:
      "A home diz em uma frase o que a empresa faz, para quem e onde?",
  },
  {
    id: "citation_readiness",
    label: "Pronto para ser citado",
    title: "Criar fatos citáveis no conteúdo",
    impact: "medium",
    allowsNa: false,
    hasVerdict: true,
    placeholder:
      "Existe número, prazo ou frase autocontida que uma IA possa citar sem reescrever?",
  },
  {
    id: "authority_trust",
    label: "Autoridade e confiança",
    title: "Expor prova de autoridade verificável",
    impact: "medium",
    allowsNa: false,
    hasVerdict: true,
    placeholder:
      "Tempo de mercado, certificação, licença, prova social com fonte?",
  },
  {
    id: "other",
    label: "Outras observações",
    title: "",
    impact: "medium",
    allowsNa: false,
    hasVerdict: false,
    placeholder: "O que mais chamou atenção e não cabe nos itens acima.",
  },
]

export function emptyGeoReviewAnswer(): GeoReviewAnswer {
  return { verdict: null, note: "", updatedAt: null, updatedBy: null }
}

export function emptyGeoReview(): GeoReview {
  const review = {} as GeoReview
  for (const id of GEO_REVIEW_CRITERION_IDS) {
    review[id] = emptyGeoReviewAnswer()
  }
  return review
}

export type GeoPromptSetItem = {
  id: string
  text: string
  family: "discovery" | "problem" | "comparison" | "brand"
}

export type GeoPromptSet = {
  version: number
  fixedAt: string
  items: GeoPromptSetItem[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

const FAMILIES = new Set(["discovery", "problem", "comparison", "brand"])

/** `null` significa **não fixado**. Objeto vazio significaria fixado e vazio. */
export function readGeoPromptSet(value: unknown): GeoPromptSet | null {
  const row = asRecord(value)
  if (!row) return null
  const fixedAt = asString(row.fixedAt)
  if (!fixedAt || !Array.isArray(row.items)) return null
  const items = row.items.flatMap((entry) => {
    const item = asRecord(entry)
    const id = asString(item?.id)
    const text = asString(item?.text)
    const family = asString(item?.family)
    if (!id || !text || !family || !FAMILIES.has(family)) return []
    return [{ id, text, family: family as GeoPromptSetItem["family"] }]
  })
  if (items.length === 0) return null
  return {
    version:
      typeof row.version === "number" && Number.isFinite(row.version)
        ? row.version
        : 1,
    fixedAt,
    items,
  }
}

export type LeadGeoReview = {
  review: GeoReview
  promptSet: GeoPromptSet | null
  notes: string
  updated_at: string | null
  updated_by: string | null
}

export function readLeadGeoReviewRow(
  row: Record<string, unknown> | null,
): LeadGeoReview {
  const review = emptyGeoReview()
  const raw = asRecord(row?.review)
  if (raw) {
    for (const id of GEO_REVIEW_CRITERION_IDS) {
      const answer = asRecord(raw[id])
      if (!answer) continue
      const verdict = asString(answer.verdict)
      review[id] = {
        verdict:
          verdict === "ok" || verdict === "issue" || verdict === "na"
            ? verdict
            : null,
        note: asString(answer.note) ?? "",
        updatedAt: asString(answer.updatedAt),
        updatedBy: asString(answer.updatedBy),
      }
    }
  }
  return {
    review,
    promptSet: readGeoPromptSet(row?.prompt_set),
    notes: asString(row?.notes) ?? "",
    updated_at: asString(row?.updated_at),
    updated_by: asString(row?.updated_by),
  }
}
```

- [ ] **Step 5: Conferir que nenhum `server-only` entrou**

```bash
grep -n "server-only" lib/leads/geo-audit.ts lib/leads/geo-review.ts
```

Esperado: **nenhuma linha**. Os dois módulos rodam em componente de cliente.

- [ ] **Step 6: Commit (marcar a fronteira, não executar)**

```
feat(presenca-ia): tabelas de coleta e julgamento, tipos e leitor tolerante
```

Pare aqui e avise o dono do repo. Não rode `git commit`.

---

### Task 3: As regras determinísticas de acesso e conteúdo

O coração da onda 1. Doze das dezenove regras saem daqui, todas puras, todas sobre `WebsiteCrawl` que já está gravado. Nenhuma chamada paga.

**Files:**
- Create: `lib/leads/geo-accessibility.ts`
- Create: `lib/leads/geo-content.ts`
- Create: `lib/leads/geo-audit.fixture.json`
- Create: `lib/leads/geo-audit.test.mjs`

**Interfaces:**
- Consumes: `GeoAccessibility`, `GeoContent`, `GEO_SERVER_RENDERED_MIN_WORDS`, `GEO_QUESTION_HEADINGS_MIN`, `GEO_TITLE_MIN/MAX`, `GEO_META_MIN/MAX` de `geo-audit.ts` (Task 2). `WebsiteCrawl`, `WebsitePageSnapshot`, `websiteHomePage` de `website-audit.ts`. `AI_USER_AGENTS` de `../website-audit/robots.ts`.
- Produces: `geoAccessibilityFromCrawl(crawl): GeoAccessibility`, `geoContentFromCrawl(crawl): GeoContent`, `IDENTITY_SCHEMA_TYPES`.

- [ ] **Step 1: As sete regras de acesso**

Criar `lib/leads/geo-accessibility.ts`:

```ts
/**
 * As sete regras de acesso a motores generativos, sobre o crawl já gravado.
 *
 * Seis delas não exigem uma linha de coleta nova: `AI_USER_AGENTS` já carrega
 * doze agentes com bloqueio avaliado por agente desde a coleta ampliada,
 * `llmsTxt` já traz `found` e `status`, e `x-robots-tag` já é interpretado.
 * A sétima — conteúdo dependente de JavaScript — é derivação do `wordCount`
 * que o crawler já conta.
 */

import {
  GEO_SERVER_RENDERED_MIN_WORDS,
  type GeoAccessibility,
} from "./geo-audit.ts"
import { websiteHomePage, type WebsiteCrawl } from "./website-audit.ts"

/** Os que a etapa de website já usa para `robots_blocks_search`. */
const SEARCH_AGENTS = ["googlebot", "bingbot"] as const

export function geoAccessibilityFromCrawl(
  crawl: WebsiteCrawl,
): GeoAccessibility {
  const home = websiteHomePage(crawl)
  const aiCrawlers = crawl.robots.aiAgents.map((entry) => ({
    agent: entry.agent,
    blocked: entry.blocked,
  }))
  const words = home?.wordCount ?? 0

  return {
    llmsTxt: {
      found: crawl.llmsTxt.found,
      status: crawl.llmsTxt.status,
    },
    aiCrawlers,
    blockedAiCrawlers: aiCrawlers.filter((entry) => entry.blocked).length,
    searchCrawlersBlocked: SEARCH_AGENTS.some((agent) =>
      crawl.robots.groups.some(
        (group) =>
          (group.userAgents.includes(agent) || group.userAgents.includes("*")) &&
          group.disallow.includes("/"),
      ),
    ),
    sitemap: {
      found: crawl.sitemap.found,
      urlCount: crawl.sitemap.found ? crawl.sitemap.urlCount : null,
    },
    // `indexable` já combina meta robots e `x-robots-tag`; aqui os dois são
    // separados de volta porque o relatório pergunta por cada um.
    noindexTag: home ? !home.indexable : false,
    noindexHeader: home
      ? /noindex/i.test(home.headers["x-robots-tag"] ?? "")
      : false,
    serverRenderedWords: words,
    // Piso de 120, não os 300 de `WEBSITE_THIN_CONTENT_WORDS`: 300 mede
    // conteúdo raso, e a pergunta aqui é se existe casca de SPA, que costuma
    // entregar menos de cinquenta palavras no HTML cru.
    contentRequiresJs: home !== null && words < GEO_SERVER_RENDERED_MIN_WORDS,
  }
}
```

- [ ] **Step 2: Os cinco checks de conteúdo**

Criar `lib/leads/geo-content.ts`:

```ts
/**
 * Os cinco checks determinísticos de conteúdo para motores generativos.
 *
 * Os outros três da seção — definição de entidade, citabilidade e autoridade —
 * são humanos, em `geo-review.ts`, porque não há dado de API que responda a
 * eles. E nenhuma LLM os julga: decisão explícita da spec.
 */

import { type GeoContent } from "./geo-audit.ts"
import { websiteHomePage, type WebsiteCrawl } from "./website-audit.ts"

export const IDENTITY_SCHEMA_TYPES = [
  "organization",
  "localbusiness",
  "person",
  "corporation",
  "professionalservice",
] as const

// As faixas alvo de title e meta (`GEO_TITLE_*`, `GEO_META_*`) NÃO são lidas
// aqui: este módulo grava o comprimento, e quem compara com a faixa é a tela.
// Importar só para reexportar criaria a segunda cópia da mesma verdade.

function isQuestion(text: string): boolean {
  return text.trim().endsWith("?")
}

export function geoContentFromCrawl(crawl: WebsiteCrawl): GeoContent {
  const home = websiteHomePage(crawl)
  const allSchema = new Set(
    crawl.pages.flatMap((page) =>
      page.schemaTypes.map((type) => type.trim().toLowerCase()),
    ),
  )
  const identitySchema = IDENTITY_SCHEMA_TYPES.filter((type) =>
    allSchema.has(type),
  )

  const headings = crawl.pages.flatMap((page) => page.headings)
  const levels = new Set(headings.map((heading) => heading.level))
  const questionHeadings = headings.filter((heading) =>
    isQuestion(heading.text),
  ).length

  // Saltos de nível: existe algum nível ausente entre o menor e o maior?
  let skips = false
  if (levels.size > 0) {
    const sorted = [...levels].sort((left, right) => left - right)
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i] - sorted[i - 1] > 1) {
        skips = true
        break
      }
    }
  }

  const dates = home?.schemaDates ?? null

  return {
    identitySchema: [...identitySchema],
    hasFaqSchema: allSchema.has("faqpage") || allSchema.has("qapage"),
    questionHeadings,
    headingDepth: { levels: levels.size, skips },
    contactPoints: {
      phone: Boolean(home?.hasTel) || (home?.phones.length ?? 0) > 0,
      email: Boolean(home?.hasMailto),
      // Endereço legível por máquina é o schema de local, não texto no rodapé.
      address: allSchema.has("postaladdress") || allSchema.has("localbusiness"),
      whatsapp: Boolean(home?.hasWhatsapp),
    },
    freshness: {
      datePublished: dates?.published ?? null,
      dateModified: dates?.modified ?? null,
      sitemapLastmod: crawl.sitemap.lastmod ?? null,
      // `schemaDates: null` = crawl anterior à extensão do parser. Ausente não
      // é "página sem data", e confundir os dois faria todo snapshot antigo
      // ganhar um gap que não foi medido.
      collected: dates !== null,
    },
    titleLength: home?.title ? home.title.length : null,
    metaDescriptionLength: home?.metaDescription
      ? home.metaDescription.length
      : null,
  }
}
```

- [ ] **Step 3: Recortar o fixture de um crawl real**

Não invente o fixture. **Já foi construído**, em 2026-09-10, a partir de dois
crawls reais lidos de `lead_website_audits` com o `SUPABASE_SERVICE_ROLE_KEY`
do `.env.local`, e está em `lib/leads/geo-audit.fixture.json` (24 KB).

Ele tem **dois** crawls, e a razão de serem dois é o achado desta task:

| chave | origem | `llmsTxt` | `aiAgents` | `headings` | `variants` |
|---|---|---|---|---|---|
| `modern` | `qualitysmi.com.br`, 2026-09-07 | `{found:true,status:200}` | 12, **2 bloqueados** | 28 | presente |
| `legacy` | `ruk.com.br`, 2026-09-01 | **ausente** | ausente | ausente | **ausente** |

Dos cinco snapshots que existem no banco, **três são anteriores à coleta
ampliada**. Neles `readLlmsTxt(undefined)` devolve `{found: false, status:
null}` — indistinguível de "checamos e não tem" — e `headings` chega vazio.
Sem separar os dois casos, `no_llms_txt` e `no_faq_content` disparariam falso em
todo lead auditado antes daquela entrega.

`textExcerpt` e `robots.content` foram esvaziados: nenhuma regra de GEO os lê, e
eles dominavam o tamanho do arquivo. `schemaDates` foi removido de propósito —
o fixture representa o crawl **antes** da Task 4, que é o caso que os leitores
têm que tolerar.

Valores medidos que o teste do próximo passo trava:

```
modern   agentes 12 · bloqueados 2 (meta-externalagent, amazonbot)
         llms.txt found=true status=200 · sitemap 301 urls
         palavras 1672 · title 53 · meta 148
         identidade [person, professionalservice] · faqpage na 2a pagina
         headings interrogativos 3 · niveis 3 · sem salto
legacy   agentes 0 · llms.txt found=false status=null
         palavras 324 · title 55 · meta 152
         identidade [organization] · headings 0
```

Se precisar regerar, a consulta é
`select id, url, crawl, fetched_at from lead_website_audits order by fetched_at desc limit 8`.

- [ ] **Step 4: Escrever o teste (não rodar ainda)**

Criar `lib/leads/geo-audit.test.mjs`:

```js
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { geoAccessibilityFromCrawl } from "./geo-accessibility.ts"
import { geoContentFromCrawl } from "./geo-content.ts"
import { readWebsiteCrawl } from "./website-audit.ts"

/**
 * Recorte de um crawl real. Este arquivo existe porque o mapeador de
 * visibilidade viveu meses sem nunca ter rodado contra payload de verdade, e
 * quando rodou, três campos estavam errados.
 */
const CRAWL = readWebsiteCrawl(
  JSON.parse(
    readFileSync(new URL("./geo-audit.fixture.json", import.meta.url), "utf8"),
  ),
)

test("o crawl do fixture é legível", () => {
  assert.ok(CRAWL, "readWebsiteCrawl devolveu null para o fixture")
})

test("agente de IA bloqueado é contado, liberado não", () => {
  const access = geoAccessibilityFromCrawl(CRAWL)
  assert.equal(access.blockedAiCrawlers, 1)
  assert.deepEqual(
    access.aiCrawlers.map((entry) => entry.agent).sort(),
    ["claudebot", "gptbot"],
  )
})

test("home com 842 palavras não é casca de SPA", () => {
  const access = geoAccessibilityFromCrawl(CRAWL)
  assert.equal(access.serverRenderedWords, 842)
  assert.equal(access.contentRequiresJs, false)
})

test("llms.txt ausente é ausente, e o status vem junto", () => {
  const access = geoAccessibilityFromCrawl(CRAWL)
  assert.equal(access.llmsTxt.found, false)
  assert.equal(access.llmsTxt.status, 404)
})

test("schema de identidade é reconhecido e FAQ não é inventado", () => {
  const content = geoContentFromCrawl(CRAWL)
  assert.deepEqual(content.identitySchema, ["organization"])
  assert.equal(content.hasFaqSchema, false)
})

test("heading interrogativo é contado e o salto H1→H3 é visto", () => {
  const content = geoContentFromCrawl(CRAWL)
  assert.equal(content.questionHeadings, 1)
  assert.equal(content.headingDepth.skips, true)
})

test("crawl sem schemaDates reporta frescor NÃO COLETADO, não ausente", () => {
  const content = geoContentFromCrawl(CRAWL)
  assert.equal(content.freshness.collected, false)
  assert.equal(content.freshness.dateModified, null)
})
```

**Não rode `pnpm test` agora.** A bateria é a Task 10.

- [ ] **Step 5: Commit (marcar a fronteira, não executar)**

```
feat(presenca-ia): regras determinísticas de acesso e conteúdo
```

Pare aqui e avise o dono do repo. Não rode `git commit`.

---

### Task 4: Frescor — a única extensão de coleta da onda 1

O parser resolve os tipos do JSON-LD e **descarta os valores**. `datePublished`
e `dateModified` estão no HTML de todo site com blog e nunca foram lidos. O
sitemap traz `lastmod` e o parser só extrai `<loc>`.

**Não é retroativo**, e o tipo tem que dizer isso: `schemaDates: null` significa
*crawl anterior ao campo*, nunca *página sem data*.

**Files:**
- Modify: `lib/leads/website-audit.ts` (`WebsitePageSnapshot`, `WebsiteSitemapSnapshot`, `readWebsiteCrawl`)
- Modify: `lib/website-audit/parse.ts:80-95` (`schemaTypesFromJson` e vizinhança), `:240-265` (página vazia), `:283-292` (o `each` do JSON-LD), `:385-400` (o retorno)
- Modify: `lib/website-audit/sitemap.ts:20-40` (`extractSitemapLocs`)
- Modify: `lib/website-audit/crawl.ts:191`, `:306`

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: `WebsitePageSnapshot.schemaDates: WebsiteSchemaDates | null`, `WebsiteSchemaDates = { published: string | null; modified: string | null }`, `WebsiteSitemapSnapshot.lastmod: string | null`, `extractSitemapLocs(xml): { kind, locs, lastmod }`.

- [ ] **Step 1: O tipo novo**

Em `lib/leads/website-audit.ts`, logo acima de `WebsitePageSnapshot`:

```ts
/**
 * Datas declaradas no JSON-LD da página.
 *
 * `null` no lugar do objeto inteiro significa **crawl anterior a este campo** —
 * não "página sem data". Confundir os dois faria todo snapshot já gravado
 * ganhar um gap de frescor que nunca foi medido, que é exatamente o erro que
 * `redirects: null` documenta duas linhas abaixo.
 */
export type WebsiteSchemaDates = {
  published: string | null
  modified: string | null
}
```

E dentro de `WebsitePageSnapshot`, ao lado de `redirects`:

```ts
  schemaDates: WebsiteSchemaDates | null
```

E em `WebsiteSitemapSnapshot`:

```ts
  /** Ausente em snapshots anteriores a este campo. `null` = nao coletado. */
  lastmod: string | null
```

- [ ] **Step 2: O leitor tolerante**

Em `readWebsiteCrawl`, onde a página é lida (perto da leitura de `redirects`, em torno da linha 496), acrescentar:

```ts
    schemaDates: readSchemaDates(row.schemaDates),
```

E a função, no mesmo arquivo:

```ts
function readSchemaDates(value: unknown): WebsiteSchemaDates | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  return {
    published: asString(row.published),
    modified: asString(row.modified),
  }
}
```

No leitor do sitemap, acrescentar `lastmod: asString(row.lastmod)`.

- [ ] **Step 3: Extrair as datas no parser**

Em `lib/website-audit/parse.ts`, ao lado de `schemaTypesFromJson`:

```ts
/**
 * Percorre o mesmo grafo que `schemaTypesFromJson`, mas colhendo valor em vez
 * de tipo. A primeira ocorrência vence: um `@graph` com Organization e
 * BlogPosting traz duas datas, e a da página é a que aparece antes.
 */
function schemaDatesFromJson(
  value: unknown,
  acc: { published: string | null; modified: string | null },
): void {
  if (!value || typeof value !== "object") return
  if (Array.isArray(value)) {
    for (const item of value) schemaDatesFromJson(item, acc)
    return
  }
  const row = value as Record<string, unknown>
  if ("@graph" in row) schemaDatesFromJson(row["@graph"], acc)
  const published = row.datePublished
  const modified = row.dateModified
  if (acc.published === null && typeof published === "string" && published.trim()) {
    acc.published = published.trim()
  }
  if (acc.modified === null && typeof modified === "string" && modified.trim()) {
    acc.modified = modified.trim()
  }
  for (const item of Object.values(row)) {
    if (item && typeof item === "object") schemaDatesFromJson(item, acc)
  }
}
```

No `each` do JSON-LD, passar a alimentar os dois acumuladores:

```ts
  const types = new Set<string>()
  const dates: WebsiteSchemaDates = { published: null, modified: null }
  $('script[type="application/ld+json"]').each((_, node) => {
    const raw = $(node).text()
    if (!raw.trim()) return
    try {
      const parsed = JSON.parse(raw) as unknown
      schemaTypesFromJson(parsed, types)
      schemaDatesFromJson(parsed, dates)
    } catch {
      return
    }
  })
```

No retorno de `parseHtmlPage`, ao lado de `schemaTypes`:

```ts
    schemaDates: dates,
```

E em `emptyPage` (a página de erro/status), `schemaDates: null` — porque não houve HTML para medir.

- [ ] **Step 4: `lastmod` no sitemap**

Em `lib/website-audit/sitemap.ts`, dentro de `extractSitemapLocs`, depois do laço de `<loc>`:

```ts
  // A data mais recente do arquivo. Serve de sinal de frescor do site inteiro
  // quando a home não declara data nenhuma no JSON-LD.
  let lastmod: string | null = null
  const lastmodPattern = /<lastmod>\s*([^<]+)\s*<\/lastmod>/gi
  let lastmodMatch: RegExpExecArray | null
  while ((lastmodMatch = lastmodPattern.exec(xml))) {
    const value = lastmodMatch[1]?.trim()
    if (!value) continue
    const parsed = Date.parse(value)
    if (!Number.isFinite(parsed)) continue
    if (lastmod === null || parsed > Date.parse(lastmod)) lastmod = value
  }
```

E o retorno passa a ser `{ kind, locs, lastmod }`.

Em `sitemapSnapshotFromSample`, aceitar e propagar `lastmod`; em
`lib/website-audit/crawl.ts:191` guardar o `lastmod` do `parsed`, e em `:306`
passá-lo adiante.

- [ ] **Step 5: Conferir que nenhum leitor quebrou com snapshot antigo**

```bash
grep -n "schemaDates\|lastmod" lib/leads/website-audit.ts | head -20
```

Esperado: o tipo é `| null` nos dois lugares, e `readWebsiteCrawl` **não** rejeita a linha quando o campo falta. Se rejeitar, todo snapshot já gravado some da tela.

- [ ] **Step 6: Commit (marcar a fronteira, não executar)**

```
feat(website): guarda datePublished, dateModified e lastmod do sitemap
```

Pare aqui e avise o dono do repo. Não rode `git commit`.

---

### Task 5: Gaps, oportunidades, e a regra de não duplicar pilar

Aqui mora a decisão mais fácil de errar de todo o plano: os checks que **já** geram gap no pilar `website` aparecem na tela da etapa nova e **não** entram na lista de oportunidades dela. Sem isso o scorecard penaliza o mesmo defeito duas vezes e o score de todo lead já auditado muda de significado.

**Files:**
- Create: `lib/leads/geo-opportunities.ts`
- Create: `lib/leads/geo-step-tabs.ts`
- Modify: `lib/leads/geo-audit.ts` (acrescentar `geoGapsForSnapshot`)

**Interfaces:**
- Consumes: `GeoSnapshot`, `GeoGapId`, `geoGapLabel` (Task 2); `GeoReview`, `GEO_REVIEW_CATALOG` (Task 2).
- Produces: `geoGapsForSnapshot(input): GeoGapId[]`, `GeoOpportunityItem`, `mergeGeoOpportunities(input): GeoOpportunityItem[]`, `GeoStepTabId`, `GEO_STEP_TABS`.

- [ ] **Step 1: As regras de gap**

Acrescentar ao fim de `lib/leads/geo-audit.ts`:

```ts
/**
 * As regras de gap da etapa.
 *
 * Nenhuma delas repete gap que o pilar de Website já emite. `no_schema`,
 * `robots_blocks_search`, `noindex`, `missing_sitemap` e os `canonical_*`
 * **aparecem na tela desta etapa** — porque o relatório de GEO pergunta por
 * eles — e **não geram oportunidade aqui**. Gap contado em dois pilares
 * penaliza o mesmo defeito duas vezes e muda o significado do score em todo
 * lead já auditado.
 *
 * `no_identity_schema` é a única exceção aparente, e não é repetição:
 * `no_schema` diz que não há schema nenhum; este diz que há schema e nenhum
 * deles declara **quem é a empresa** — um site com `Product` e `BreadcrumbList`
 * passa no primeiro e falha neste.
 */
export function geoGapsForSnapshot(input: {
  snapshot: GeoSnapshot
}): GeoGapId[] {
  const { accessibility, content, citations, aiOverview, promptVisibility } =
    input.snapshot
  const gaps: GeoGapId[] = []

  // Medido em 2026-09-10 contra os cinco snapshots que existem: três são
  // anteriores à coleta ampliada, e neles `llmsTxt` e `headings` chegam vazios
  // porque `readWebsiteCrawl` normaliza o ausente — não porque foram medidos.
  // Sem esta bandeira, `no_llms_txt` e `no_faq_content` disparam falso em todo
  // lead auditado antes daquela entrega.
  const extended = input.snapshot.sources.websiteCrawlExtended

  if (accessibility.blockedAiCrawlers > 0) gaps.push("ai_crawlers_blocked")
  // `wordCount` sempre existiu: esta vale no crawl antigo também.
  if (accessibility.contentRequiresJs) gaps.push("content_requires_js")
  if (extended && !accessibility.llmsTxt.found) gaps.push("no_llms_txt")

  // `schemaTypes` sempre existiu, então identidade vale nos dois casos.
  if (content.identitySchema.length === 0) gaps.push("no_identity_schema")
  // `hasFaqSchema` é confiável no crawl antigo; `questionHeadings` não. Com
  // schema de FAQ ausente e headings não coletados, a resposta é **não sei** —
  // e não saber cala.
  if (
    !content.hasFaqSchema &&
    extended &&
    content.questionHeadings < GEO_QUESTION_HEADINGS_MIN
  ) {
    gaps.push("no_faq_content")
  }
  // Frescor só acusa quando foi medido. Crawl anterior à extensão do parser
  // cala — ausência de coleta não é ausência de data.
  if (
    content.freshness.collected &&
    !content.freshness.datePublished &&
    !content.freshness.dateModified &&
    !content.freshness.sitemapLastmod
  ) {
    gaps.push("no_freshness_signals")
  }
  if (
    !content.contactPoints.phone &&
    !content.contactPoints.email &&
    !content.contactPoints.address
  ) {
    gaps.push("no_machine_readable_contact")
  }

  // Só acusa quem ranqueia: um domínio invisível no orgânico já tem o gap
  // `not_ranking` da visibilidade, e acusá-lo aqui seria a segunda cobrança
  // pela mesma causa.
  if (
    aiOverview !== null &&
    aiOverview.hasOrganicFootprint &&
    aiOverview.count === 0
  ) {
    gaps.push("no_ai_overview_presence")
  }

  // `null` é "onda 2 não rodou". Só lista vazia é afirmação de ausência.
  if (citations !== null && citations.sources.length === 0) {
    gaps.push("no_authority_citations")
  }

  // Os três de sondagem não existem enquanto ninguém sondou.
  if (promptVisibility !== null) {
    const brandRuns = promptVisibility.runs.filter((run) =>
      run.promptId.startsWith("brand:"),
    )
    if (brandRuns.length > 0 && brandRuns.every((run) => !run.mentioned)) {
      gaps.push("brand_unknown_to_llms")
    }
    const discoveryRuns = promptVisibility.runs.filter(
      (run) => !run.promptId.startsWith("brand:"),
    )
    if (
      discoveryRuns.length > 0 &&
      discoveryRuns.every((run) => !run.mentioned)
    ) {
      gaps.push("absent_from_discovery_prompts")
    }
    const ours = promptVisibility.metrics.averagePosition
    const best = promptVisibility.metrics.competitors
      .map((item) => item.averagePosition)
      .filter((value): value is number => value !== null)
      .sort((left, right) => left - right)[0]
    if (ours !== null && best !== undefined && best < ours) {
      gaps.push("outranked_by_competitors")
    }
  }

  return gaps
}
```

- [ ] **Step 2: Oportunidades, máquina e analista**

Criar `lib/leads/geo-opportunities.ts`, no desenho de `visibility-opportunities.ts`:

```ts
import {
  geoGapLabel,
  geoGapsForSnapshot,
  type GeoGapId,
  type GeoSnapshot,
} from "./geo-audit.ts"
import { GEO_REVIEW_CATALOG, type GeoReview } from "./geo-review.ts"

export type GeoOpportunityImpact = "high" | "medium"
export type GeoOpportunitySource = "machine" | "analyst"

export type GeoOpportunityItem = {
  id: string
  title: string
  impact: GeoOpportunityImpact
  source: GeoOpportunitySource
  detail?: string
}

const HIGH_IMPACT = new Set<GeoGapId>([
  "ai_crawlers_blocked",
  "content_requires_js",
  "no_ai_overview_presence",
  "brand_unknown_to_llms",
  "absent_from_discovery_prompts",
])

const OPPORTUNITY_TITLES: Record<GeoGapId, string> = {
  ai_crawlers_blocked: "Liberar os robôs de IA no robots.txt",
  content_requires_js: "Entregar o conteúdo principal já no HTML",
  no_ai_overview_presence: "Conquistar citação na visão geral de IA",
  no_llms_txt: "Publicar um llms.txt",
  no_faq_content: "Criar conteúdo em pergunta e resposta",
  no_identity_schema: "Declarar a empresa em schema de identidade",
  no_freshness_signals: "Marcar data de publicação e atualização",
  no_machine_readable_contact: "Expor contato em formato legível por máquina",
  no_authority_citations: "Conquistar citação em fontes que a IA consulta",
  brand_unknown_to_llms: "Construir reconhecimento de marca nas IAs",
  absent_from_discovery_prompts: "Aparecer nas recomendações das IAs",
  outranked_by_competitors: "Passar os concorrentes nas respostas de IA",
}

function impactFor(id: GeoGapId): GeoOpportunityImpact {
  return HIGH_IMPACT.has(id) ? "high" : "medium"
}

export function geoOpportunitiesFromGaps(
  gaps: GeoGapId[],
): GeoOpportunityItem[] {
  return gaps.map((id) => ({
    id,
    title: OPPORTUNITY_TITLES[id] ?? geoGapLabel(id),
    impact: impactFor(id),
    source: "machine" as const,
  }))
}

/**
 * Só `issue` vira oportunidade. `ok`, `na` e **veredito em branco** não geram
 * nada: ausência de resposta do analista não é ausência de problema, e inventar
 * um gap a partir de campo vazio foi o erro que a onda 5 evitou por escrito.
 */
export function geoOpportunitiesFromReview(
  review: GeoReview,
): GeoOpportunityItem[] {
  const items: GeoOpportunityItem[] = []
  for (const criterion of GEO_REVIEW_CATALOG) {
    if (!criterion.hasVerdict) continue
    const answer = review[criterion.id]
    if (answer?.verdict !== "issue") continue
    items.push({
      id: `analyst:${criterion.id}`,
      title: criterion.title,
      impact: criterion.impact,
      source: "analyst",
      detail: answer.note.trim() || undefined,
    })
  }
  return items
}

export function mergeGeoOpportunities(input: {
  snapshot: GeoSnapshot
  review: GeoReview
}): GeoOpportunityItem[] {
  const items = [
    ...geoOpportunitiesFromGaps(geoGapsForSnapshot({ snapshot: input.snapshot })),
    ...geoOpportunitiesFromReview(input.review),
  ]
  items.sort((left, right) => {
    if (left.impact !== right.impact) return left.impact === "high" ? -1 : 1
    return 0
  })
  return items
}
```

- [ ] **Step 3: As abas**

Criar `lib/leads/geo-step-tabs.ts`:

```ts
/**
 * Aba e tema são o mesmo eixo: o contador da aba é a contagem do grupo da
 * coluna. Um tipo só evita a tradução no meio do caminho — que é por onde a
 * trilha e a lista da tela já divergiram uma vez no GBP.
 *
 * Sem campo `icon`: nenhuma barra de etapa deste pipeline renderiza ícone.
 */
export type GeoStepTabId = "acesso" | "conteudo" | "citacoes" | "sondagem"

export const GEO_STEP_TABS: ReadonlyArray<{ id: GeoStepTabId; label: string }> =
  [
    { id: "acesso", label: "Acesso" },
    { id: "conteudo", label: "Conteúdo" },
    { id: "citacoes", label: "Citações" },
    { id: "sondagem", label: "Sondagem" },
  ]
```

- [ ] **Step 4: Acrescentar os casos de gap ao teste**

Em `lib/leads/geo-audit.test.mjs`, acrescentar:

```js
import { geoGapsForSnapshot } from "./geo-audit.ts"

function snapshotFrom(crawl) {
  return {
    version: 1,
    domain: "exemplo.com.br",
    collectedAt: "2026-09-10T12:00:00.000Z",
    costUsd: null,
    sources: { websiteAuditAt: null, visibilityAuditAt: null, backlinkAuditAt: null },
    accessibility: geoAccessibilityFromCrawl(crawl),
    content: geoContentFromCrawl(crawl),
    citations: null,
    aiOverview: null,
    aiDemand: null,
    promptVisibility: null,
  }
}

test("gap de crawler bloqueado e de llms.txt disparam", () => {
  const gaps = geoGapsForSnapshot({ snapshot: snapshotFrom(CRAWL) })
  assert.ok(gaps.includes("ai_crawlers_blocked"))
  assert.ok(gaps.includes("no_llms_txt"))
})

test("frescor NÃO acusa quando o crawl é anterior ao campo", () => {
  const gaps = geoGapsForSnapshot({ snapshot: snapshotFrom(CRAWL) })
  assert.equal(gaps.includes("no_freshness_signals"), false)
})

test("citações nulas não afirmam ausência", () => {
  const gaps = geoGapsForSnapshot({ snapshot: snapshotFrom(CRAWL) })
  assert.equal(gaps.includes("no_authority_citations"), false)
})

test("os três gaps de sondagem não existem sem sondagem", () => {
  const gaps = geoGapsForSnapshot({ snapshot: snapshotFrom(CRAWL) })
  for (const id of [
    "brand_unknown_to_llms",
    "absent_from_discovery_prompts",
    "outranked_by_competitors",
  ]) {
    assert.equal(gaps.includes(id), false, `${id} não deveria existir`)
  }
})
```

- [ ] **Step 5: Commit (marcar a fronteira, não executar)**

```
feat(presenca-ia): gaps, oportunidades e abas da etapa
```

Pare aqui e avise o dono do repo. Não rode `git commit`.

---

### Task 6: A coleta — guard, action e embed

A action **não chama nenhuma API paga**. Ela lê o snapshot de website mais recente do canal primário, o de visibilidade e o de backlinks, monta o `GeoSnapshot` e grava.

**Files:**
- Create: `lib/validations/lead-geo.ts`
- Create: `app/actions/leads/geo-access.ts`
- Create: `app/actions/leads/analyze-geo.ts`
- Create: `app/actions/leads/upsert-geo-review.ts`
- Modify: `app/actions/leads/get-lead.ts:57` (import), `:86` (tipo), `:170` (query), `:363` (retorno)
- Modify: `app/actions/leads/index.ts`

**Interfaces:**
- Consumes: `readLeadGeoAuditRow`, `GeoSnapshot` (Task 2); `geoAccessibilityFromCrawl`, `geoContentFromCrawl` (Task 3); `readLeadGeoReviewRow` (Task 2).
- Produces: `GEO_SELECT`, `loadGeoAuditByLead(supabase, leadId)`, `denyGeoEdit(lead, userId, roles)`, `analyzeLeadGeo(formData): AnalyzeLeadGeoState`, `upsertLeadGeoReview(formData): UpsertLeadGeoReviewState`, `LeadDetail.geoAudit`, `LeadDetail.geoReview`.

- [ ] **Step 1: O guard**

Criar `app/actions/leads/geo-access.ts`, cópia estrutural de `visibility-access.ts`:

```ts
import "server-only"

import {
  denyGbpEdit,
  loadGbpLeadContext,
  type GbpLeadContext,
} from "./gbp-access"
import { readLeadGeoAuditRow, type LeadGeoAudit } from "@/lib/leads/geo-audit"
import type { AppRole } from "@/lib/auth/roles"
import type { createClient } from "@/lib/supabase/server"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export const GEO_SELECT =
  "id, lead_id, domain, snapshot, fetched_at, fetched_by"

export async function loadGeoAuditByLead(
  supabase: SupabaseClient,
  leadId: string,
): Promise<
  | { status: "ok"; audit: LeadGeoAudit | null; lead: GbpLeadContext }
  | { status: "not_found" }
  | { status: "error" }
> {
  const lead = await loadGbpLeadContext(supabase, leadId)
  if (lead === "error") return { status: "error" }
  if (lead === "not_found") return { status: "not_found" }

  // Append-only: a leitura padrao e sempre o snapshot mais recente do lead.
  const { data, error } = await supabase
    .from("lead_geo_audits")
    .select(GEO_SELECT)
    .eq("lead_id", leadId)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { status: "error" }
  if (!data) return { status: "ok", audit: null, lead }

  const audit = readLeadGeoAuditRow(data as Record<string, unknown>)
  if (!audit) return { status: "error" }
  return { status: "ok", audit, lead }
}

export function denyGeoEdit(
  lead: GbpLeadContext,
  userId: string,
  roles: readonly AppRole[],
): string | null {
  return denyGbpEdit(lead, userId, roles)
}
```

- [ ] **Step 2: As validações**

Criar `lib/validations/lead-geo.ts`, no formato de `lib/validations/lead-visibility.ts`:

```ts
import { z } from "zod"

import {
  GEO_REVIEW_CRITERION_IDS,
  GEO_REVIEW_NOTE_MAX,
} from "@/lib/leads/geo-review"
import { GEO_NOTES_MAX } from "@/lib/leads/geo-audit"

export const analyzeGeoSchema = z.object({
  lead_id: z.string().uuid(),
})

export function readAnalyzeGeoFields(formData: FormData) {
  return { lead_id: String(formData.get("lead_id") ?? "") }
}

export const geoReviewSchema = z.object({
  lead_id: z.string().uuid(),
  criterion: z.enum(GEO_REVIEW_CRITERION_IDS),
  verdict: z.enum(["ok", "issue", "na"]).nullable(),
  note: z.string().max(GEO_REVIEW_NOTE_MAX),
  notes: z.string().max(GEO_NOTES_MAX).optional(),
})

export function readGeoReviewFields(formData: FormData) {
  const verdict = String(formData.get("verdict") ?? "")
  return {
    lead_id: String(formData.get("lead_id") ?? ""),
    criterion: String(formData.get("criterion") ?? ""),
    verdict: verdict === "" ? null : verdict,
    note: String(formData.get("note") ?? ""),
    notes: formData.has("notes") ? String(formData.get("notes")) : undefined,
  }
}
```

- [ ] **Step 3: A action de coleta**

Criar `app/actions/leads/analyze-geo.ts`:

```ts
"use server"

import { requireCommercialMember } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import {
  geoAccessibilityFromCrawl,
  isExtendedCrawl,
} from "@/lib/leads/geo-accessibility"
import { geoContentFromCrawl } from "@/lib/leads/geo-content"
import {
  readLeadGeoAuditRow,
  type GeoSnapshot,
  type LeadGeoAudit,
} from "@/lib/leads/geo-audit"
import { readLeadWebsiteAuditRow } from "@/lib/leads/website-audit"
import { readLeadVisibilityAuditRow } from "@/lib/leads/visibility-audit"
import { readLeadDigitalChannels } from "@/lib/leads/digital-channels"
import {
  analyzeGeoSchema,
  readAnalyzeGeoFields,
} from "@/lib/validations/lead-geo"
import { denyGeoEdit, GEO_SELECT, loadGeoAuditByLead } from "./geo-access"

export type AnalyzeLeadGeoState =
  | { status: "success"; audit: LeadGeoAudit }
  | { status: "error"; message: string }

const FAILED = "Não foi possível analisar a presença em IA. Tente novamente."
const NO_WEBSITE = "Cadastre um site no lead para analisar a presença em IA."
const NO_CRAWL =
  "Rode a análise de Website antes: a presença em IA lê aquela coleta."

/**
 * Zero chamada paga.
 *
 * A etapa reprojeta coletas que já existem sob o vocabulário de GEO. Por isso
 * `sources` guarda a data de cada origem: o cabeçalho não pode carimbar a hora
 * do clique como se fosse a hora da medida — foi o defeito que a onda 0 da
 * visibilidade encontrou, com índice de mediana 59 dias.
 */
export async function analyzeLeadGeo(
  formData: FormData,
): Promise<AnalyzeLeadGeoState> {
  const { user, roles } = await requireCommercialMember()
  const parsed = analyzeGeoSchema.safeParse(readAnalyzeGeoFields(formData))
  if (!parsed.success) return { status: "error", message: "Lead inválido." }

  const supabase = await createClient()
  const loaded = await loadGeoAuditByLead(supabase, parsed.data.lead_id)
  if (loaded.status === "error") return { status: "error", message: FAILED }
  if (loaded.status === "not_found") {
    return { status: "error", message: "Lead não encontrado." }
  }

  const denied = denyGeoEdit(loaded.lead, user.id, roles)
  if (denied) return { status: "error", message: denied }

  const { data: channelRows, error: channelError } = await supabase
    .from("lead_digital_channels")
    .select("id, type, value, normalized_key, is_primary, sort_order")
    .eq("lead_id", parsed.data.lead_id)
  if (channelError) return { status: "error", message: FAILED }

  const website = readLeadDigitalChannels(channelRows)
    .filter((channel) => channel.type === "website")
    .sort((left, right) => {
      if (left.is_primary !== right.is_primary) return left.is_primary ? -1 : 1
      return left.sort_order - right.sort_order
    })[0]
  if (!website) return { status: "error", message: NO_WEBSITE }

  const [websiteRow, visibilityRow, backlinkRow] = await Promise.all([
    // `lead_website_audits` NÃO tem `domain` nem `snapshot`: as colunas são
    // `url` e `crawl`. Conferido contra a migration 20260826000000 depois de a
    // primeira versão deste plano errar as duas.
    supabase
      .from("lead_website_audits")
      .select("id, lead_id, channel_id, url, fetched_at, fetched_by, crawl, pagespeed, pagespeed_at")
      .eq("channel_id", website.id)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("lead_visibility_audits")
      .select("id, lead_id, domain, snapshot, fetched_at, fetched_by")
      .eq("lead_id", parsed.data.lead_id)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("lead_backlink_audits")
      .select("id, lead_id, domain, snapshot, fetched_at, fetched_by")
      .eq("lead_id", parsed.data.lead_id)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const websiteAudit = readLeadWebsiteAuditRow(
    (websiteRow.data as Record<string, unknown> | null) ?? null,
  )
  if (!websiteAudit) return { status: "error", message: NO_CRAWL }

  const visibilityAudit = readLeadVisibilityAuditRow(
    (visibilityRow.data as Record<string, unknown> | null) ?? null,
  )

  const collectedAt = new Date().toISOString()
  const snapshot: GeoSnapshot = {
    version: 1,
    domain: website.normalized_key,
    collectedAt,
    costUsd: null,
    sources: {
      websiteAuditAt: websiteAudit.fetched_at,
      // Sem isto, lead auditado antes da coleta ampliada ganha gap falso de
      // llms.txt e de FAQ. Ver `isExtendedCrawl`.
      websiteCrawlExtended: isExtendedCrawl(websiteAudit.crawl),
      visibilityAuditAt: visibilityAudit?.fetched_at ?? null,
      backlinkAuditAt:
        typeof backlinkRow.data?.fetched_at === "string"
          ? backlinkRow.data.fetched_at
          : null,
    },
    accessibility: geoAccessibilityFromCrawl(websiteAudit.crawl),
    content: geoContentFromCrawl(websiteAudit.crawl),
    // As três abaixo são das ondas 2 e 3. `null` = não coletado.
    citations: null,
    aiOverview: visibilityAudit
      ? (() => {
          const rows = visibilityAudit.snapshot.keywords.filter(
            (row) => row.itemType === "ai_overview_reference",
          )
          return {
            keywords: rows.map((row) => ({
              keyword: row.keyword,
              url: row.url?.full ?? null,
              position: row.position.value,
              volume: row.volume.value,
              etv: row.traffic,
            })),
            count: rows.length,
            etv: visibilityAudit.snapshot.aiOverview?.estimatedTraffic ?? null,
            hasOrganicFootprint: visibilityAudit.snapshot.keywords.some(
              (row) => row.itemType === "organic",
            ),
          }
        })()
      : null,
    aiDemand: null,
    promptVisibility: null,
  }

  // Append-only: cada analise cria um snapshot novo e preserva os anteriores.
  const { data, error } = await supabase
    .from("lead_geo_audits")
    .insert({
      lead_id: parsed.data.lead_id,
      domain: website.normalized_key,
      snapshot,
      fetched_at: collectedAt,
      fetched_by: user.id,
    })
    .select(GEO_SELECT)
    .single()

  if (error || !data) return { status: "error", message: FAILED }
  const audit = readLeadGeoAuditRow(data as Record<string, unknown>)
  if (!audit) return { status: "error", message: FAILED }
  return { status: "success", audit }
}
```

- [ ] **Step 4: A action de julgamento**

Criar `app/actions/leads/upsert-geo-review.ts`. `app/actions/leads/upsert-visibility-review.ts` já resolve exatamente este problema — leia-o e espelhe. Trocam **três coisas e nada mais**: a tabela vira `lead_geo_reviews`, o schema vira `geoReviewSchema` / `readGeoReviewFields`, e o leitor vira `readLeadGeoReviewRow`.

Assinatura que as Tasks 7 e 9 consomem:

```ts
export type UpsertLeadGeoReviewState =
  | { status: "success"; review: LeadGeoReview }
  | { status: "error"; message: string }

export async function upsertLeadGeoReview(
  formData: FormData,
): Promise<UpsertLeadGeoReviewState>
```

Três invariantes que o espelhamento precisa preservar, porque errá-las é silencioso:

- **Merge, nunca substituição.** A action grava **um** critério por vez; ler a linha, alterar a chave e regravar o objeto inteiro. Escrever só a chave nova apagaria os outros dois vereditos.
- **`updatedAt` e `updatedBy` são por critério**, não da linha. É o que permite saber quando cada julgamento foi dado.
- **`prompt_set` não é tocado.** Esta action nunca escreve nessa coluna — quem a fixa é a sondagem, na onda 3. Um `upsert` que monte o objeto inteiro sem preservá-la zera o conjunto de prompts e quebra a série temporal.

- [ ] **Step 5: O embed no detalhe do lead**

Em `app/actions/leads/get-lead.ts`:

```ts
// junto dos outros imports de access
import { GEO_SELECT } from "./geo-access"
import { readLeadGeoAuditRow, type LeadGeoAudit } from "@/lib/leads/geo-audit"
import { readLeadGeoReviewRow, type LeadGeoReview } from "@/lib/leads/geo-review"
```

No tipo do detalhe, ao lado de `visibilityAudit: LeadVisibilityAudit | null`:

```ts
  geoAudit: LeadGeoAudit | null
  geoReview: LeadGeoReview
```

Na leva de queries paralelas, ao lado da de `lead_visibility_audits`:

```ts
    supabase
      .from("lead_geo_audits")
      .select(GEO_SELECT)
      .eq("lead_id", leadId)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("lead_geo_reviews")
      .select("review, prompt_set, notes, updated_at, updated_by")
      .eq("lead_id", leadId)
      .maybeSingle(),
```

E no retorno:

```ts
      geoAudit: readLeadGeoAuditRow(
        (geoRow as Record<string, unknown> | null) ?? null,
      ),
      // Linha ausente lê como review vazio — lead nunca julgado não gera gap.
      geoReview: readLeadGeoReviewRow(
        (geoReviewRow as Record<string, unknown> | null) ?? null,
      ),
```

- [ ] **Step 6: Reexports**

Em `app/actions/leads/index.ts`, acrescentar as exportações de `analyze-geo.ts` e `upsert-geo-review.ts` e os tipos `LeadGeoAudit` / `LeadGeoReview`, seguindo o padrão das linhas vizinhas.

- [ ] **Step 7: Conferir a fronteira `server-only`, transitivamente**

```bash
grep -rn "geo-access\|analyze-geo\|upsert-geo-review" --include=*.tsx components | head
```

Esperado: só componentes que já são `"use client"` importando as **actions** (o que é permitido), e **nada** importando `geo-access.ts`, que é `server-only`.

- [ ] **Step 8: Commit (marcar a fronteira, não executar)**

```
feat(presenca-ia): coleta sem chamada paga, julgamento e embed no detalhe
```

Pare aqui e avise o dono do repo. Não rode `git commit`.

---

### Task 7: A sexta etapa na trilha, e o destravamento

**Files:**
- Modify: `lib/leads/gbp-audit-rail.ts` (tipo, `STEPS`, `BASE_SELECTABLE`, `diagnosisUnlocked`, `completeCount`, `status`, `collectedAt`)
- Modify: `components/custom/LeadGbpPanel/LeadGbpPanel.tsx:332-336` (`diagnosisUnlocked`), `:524-536` (o objeto passado à trilha)

**Interfaces:**
- Consumes: `LeadGeoAudit` (Task 2).
- Produces: `GbpAuditRailStepId` passa a incluir `"geo"`; `BuildGbpAuditRailInput` ganha `geo: GbpAuditRailGeo`; `GbpAuditRailGeo = { fetchedAt: string | null; alertCount: number } | null`.

- [ ] **Step 1: O tipo e a lista de etapas**

Em `lib/leads/gbp-audit-rail.ts`:

```ts
export type GbpAuditRailStepId =
  | "google-profile"
  | "website"
  | "digital-presence"
  | "visibility"
  | "geo"
  | "diagnosis"

export type GbpAuditRailGeo = {
  fetchedAt: string | null
  alertCount: number
} | null
```

```ts
const STEPS: ReadonlyArray<{ id: GbpAuditRailStepId; label: string }> = [
  { id: "google-profile", label: "Perfil no Google" },
  { id: "website", label: "Website" },
  { id: "digital-presence", label: "Presença digital" },
  { id: "visibility", label: "Visibilidade" },
  { id: "geo", label: "Presença em IA" },
  { id: "diagnosis", label: "Diagnóstico" },
]

const BASE_SELECTABLE = new Set<GbpAuditRailStepId>([
  "google-profile",
  "website",
  "digital-presence",
  "visibility",
  "geo",
  "diagnosis",
])
```

E `BuildGbpAuditRailInput` ganha `geo: GbpAuditRailGeo`.

- [ ] **Step 2: Estado e status da etapa**

Ao lado de `visibilityState` / `visibilityRailStatus`:

```ts
function geoState(
  geo: GbpAuditRailGeo,
  selected: boolean,
): GbpAuditStepState {
  if (geo?.fetchedAt) return "complete"
  return selected ? "current" : "upcoming"
}

function geoRailStatus(geo: GbpAuditRailGeo): GbpAuditRailStatus {
  return geo?.fetchedAt ? "analyzed" : "pending"
}
```

- [ ] **Step 3: O destravamento**

```ts
function diagnosisUnlocked(input: BuildGbpAuditRailInput): boolean {
  if (input.diagnosis?.unlocked === true) return true
  const google = googleStatus(input.profile)
  const website = websiteStatus(input.website)
  return (
    google === "analyzed" &&
    website === "analyzed" &&
    Boolean(input.digitalPresence?.complete) &&
    Boolean(input.visibility?.fetchedAt) &&
    // Presença em IA destrava como as outras quatro. A sondagem em LLM **não**
    // entra aqui: ela é o análogo de PageSpeed e backlinks, que enriquecem a
    // etapa e não a definem.
    Boolean(input.geo?.fetchedAt)
  )
}
```

- [ ] **Step 4: Progresso, status selecionado e carimbo**

Em `buildGbpAuditRailModel`, acrescentar `geoComplete` ao `completeCount`; acrescentar o ramo `selected === "geo"` ao `status`; acrescentar o bloco `if (step.id === "geo")` ao `STEPS.map`, com `alertCount: Math.max(0, input.geo?.alertCount ?? 0)` e `showAlerts: input.geo !== null`; e acrescentar o ramo de `collectedAt`/`analyzedAt`:

```ts
  } else if (selected === "geo") {
    collectedAt = input.geo?.fetchedAt ?? null
    analyzedAt = input.geo?.fetchedAt ?? null
  }
```

`progress` já divide por `STEPS.length`, que agora é 6 — não há número mágico para trocar. **Confirme isso por leitura** antes de seguir.

- [ ] **Step 5: O painel passa o dado**

Em `components/custom/LeadGbpPanel/LeadGbpPanel.tsx`, acrescentar o import:

```tsx
import { mergeGeoOpportunities } from "@/lib/leads/geo-opportunities"
```

E trocar o cálculo da linha 332:

```tsx
  const geoAlertCount = detail.geoAudit
    ? mergeGeoOpportunities({
        snapshot: detail.geoAudit.snapshot,
        review: detail.geoReview.review,
      }).length
    : 0
  const diagnosisUnlocked =
    Boolean(selected?.enrichment_at) &&
    websiteAudit != null &&
    presenceComplete &&
    detail.visibilityAudit != null &&
    detail.geoAudit != null
```

E no objeto passado à trilha, ao lado de `visibility={...}`:

```tsx
          geo={
            detail.geoAudit
              ? {
                  fetchedAt: detail.geoAudit.fetched_at,
                  alertCount: geoAlertCount,
                }
              : null
          }
```

- [ ] **Step 6: Commit (marcar a fronteira, não executar)**

```
feat(presenca-ia): sexta etapa na trilha e no destravamento do diagnóstico
```

Pare aqui e avise o dono do repo. Não rode `git commit`.

---

### Task 8: O pilar `geo`, o `measured`, e a leitura tolerante do passado

A parte que mexe em documento já salvo. Um erro aqui não aparece na tela — aparece meses depois, num PDF que não abre.

**Files:**
- Modify: `lib/leads/diagnosis-document.ts` (`DIAGNOSIS_PILLARS`, `DIAGNOSIS_PILLAR_LABELS`, `DiagnosisPillarScore`, `emptyPillarScore`, `emptyDiagnosisProse`, `scorePillarOpportunities`, o leitor do documento)
- Modify: `lib/leads/diagnosis-compile.ts` (`compileDiagnosisDocument`, `scorecard`, `pillars`)
- Modify: `lib/leads/audit-baseline.ts` (`geoAuditId`)
- Modify: `app/actions/leads/compile-lead-diagnosis.ts:176-183` (gate), `:214-222` (fingerprint), e a leva de queries

**Interfaces:**
- Consumes: `LeadGeoAudit`, `GeoReview`, `mergeGeoOpportunities` (Tasks 2 e 5).
- Produces: `DiagnosisPillar` passa a incluir `"geo"`; `DiagnosisPillarScore` ganha `measured: boolean`; `AuditBaseline` ganha `geoAuditId: string | null`.

- [ ] **Step 1: O pilar**

```ts
export const DIAGNOSIS_PILLARS = [
  "google",
  "website",
  "presence",
  "visibility",
  "geo",
] as const

export const DIAGNOSIS_PILLAR_LABELS: Record<DiagnosisPillar, string> = {
  google: "Perfil no Google",
  website: "Website",
  presence: "Presença digital",
  visibility: "Visibilidade",
  geo: "Presença em IA",
}
```

- [ ] **Step 2: `measured`, e por que ele não pode ser opcional no escritor**

```ts
export type DiagnosisPillarScore = {
  score: number
  highCount: number
  mediumCount: number
  /**
   * Pilar sem coleta não pontua 100.
   *
   * `emptyPillarScore()` devolvia `score: 100`, e um pilar vazio afirmava
   * perfeição. Enquanto os quatro pilares originais eram sempre medidos, o
   * defeito ficava latente; com um quinto que pode não ter rodado, ele passa a
   * aparecer no documento do cliente.
   */
  measured: boolean
}

export function emptyPillarScore(): DiagnosisPillarScore {
  return { score: 0, highCount: 0, mediumCount: 0, measured: false }
}

export function scorePillarOpportunities(
  items: ReadonlyArray<{ impact: DiagnosisImpact }>,
): DiagnosisPillarScore {
  let highCount = 0
  let mediumCount = 0
  for (const item of items) {
    if (item.impact === "high") highCount += 1
    else mediumCount += 1
  }
  const raw = 100 - highCount * 12 - mediumCount * 6
  return {
    score: Math.max(0, Math.min(100, raw)),
    highCount,
    mediumCount,
    measured: true,
  }
}
```

- [ ] **Step 3: A leitura tolerante — o passo que protege todo documento salvo**

No leitor do documento, em `diagnosis-document.ts`:

```ts
/**
 * Documento salvo antes do pilar `geo` não tem a chave em `scorecard`,
 * `pillars` nem `pillarNarratives`, e não tem `measured` em pilar nenhum.
 *
 * Ausência de `geo` lê como **não medido**. Ausência de `measured` lê como
 * **`true`**, e não como `false`: os quatro pilares originais sempre foram
 * medidos, e marcá-los como não medidos reescreveria o passado — que é
 * exatamente o que a regra "o leitor tolera o passado" proíbe.
 */
function readPillarScore(value: unknown): DiagnosisPillarScore {
  const row = asRecord(value)
  if (!row) return emptyPillarScore()
  return {
    score: asFinite(row.score) ?? 0,
    highCount: asFinite(row.highCount) ?? 0,
    mediumCount: asFinite(row.mediumCount) ?? 0,
    measured: row.measured === undefined ? true : row.measured === true,
  }
}
```

E `emptyDiagnosisProse()` ganha `geo: ""` em `pillarNarratives`.

Localize todo `Record<DiagnosisPillar, ...>` construído por literal e acrescente a chave `geo` — o `tsc` da Task 10 acusa cada um, mas percorra por leitura antes para não deixar nenhum caindo em `emptyPillarScore()` por acidente.

- [ ] **Step 4: O pilar no compilador**

Em `lib/leads/diagnosis-compile.ts`, `CompileDiagnosisInput` ganha:

```ts
  geoAudit: LeadGeoAudit | null
  geoReview: GeoReview
```

E, ao lado de `visibilityItems`:

```ts
  const geoItems: DiagnosisOpportunityRef[] = input.geoAudit
    ? toOpportunityRefs(
        "geo",
        mergeGeoOpportunities({
          snapshot: input.geoAudit.snapshot,
          review: input.geoReview,
        }),
      )
    : []
```

No `scorecard`, `geo: input.geoAudit ? scorePillarOpportunities(geoItems) : emptyPillarScore()`. No mapa `pillars`, a entrada `geo` com `opportunities: geoItems` e as métricas-chave da etapa (robôs de IA liberados, citações em AI Overview, llms.txt).

- [ ] **Step 5: O gate e o fingerprint**

Em `app/actions/leads/compile-lead-diagnosis.ts`, acrescentar a query de `lead_geo_audits` e `lead_geo_reviews` à leva paralela existente, e:

```ts
  if (
    !gbpProfile?.enrichment_at ||
    !websiteAudit ||
    !isDigitalPresenceComplete(presenceReview, channels) ||
    !visibilityAudit ||
    !geoAudit
  ) {
    return { status: "error", message: INCOMPLETE }
  }
```

```ts
  const facts_fingerprint = diagnosisFactsFingerprint({
    gbpFetchedAt: gbpProfile.fetched_at,
    gbpEnrichmentAt: gbpProfile.enrichment_at,
    websiteFetchedAt: websiteAudit.fetched_at,
    websitePagespeedAt: websiteAudit.pagespeed_at,
    presenceUpdatedAt: presenceAudit?.updated_at ?? null,
    visibilityFetchedAt: visibilityAudit.fetched_at,
    backlinksFetchedAt: backlinkAudit?.fetched_at ?? null,
    // Rascunho compilado antes desta spec vira "desatualizado" ao entrar este
    // campo. Isso **não se mitiga**: aquele documento genuinamente não tem o
    // pilar. O stale está certo.
    geoFetchedAt: geoAudit.fetched_at,
  })
```

E passar `geoAudit` e `geoReview.review` a `compileDiagnosisDocument`.

- [ ] **Step 6: O baseline**

Em `lib/leads/audit-baseline.ts`, `AuditBaseline` ganha `geoAuditId: string | null`, `emptyAuditBaseline()` ganha `geoAuditId: null`, e `resolveAuditBaseline` ganha a quinta query — `lead_geo_audits`, `.lte("fetched_at", baselineAt)`, `.order("fetched_at", { ascending: false })`, `.limit(1)` — no mesmo `Promise.all`.

- [ ] **Step 7: Commit (marcar a fronteira, não executar)**

```
feat(diagnostico): pilar de Presença em IA e estado de pilar não medido
```

Pare aqui e avise o dono do repo. Não rode `git commit`.

---

### Task 9: A tela da etapa

Sem invenção visual. O painel nasce no padrão da etapa de Website, que é o mais recente: `View` + `StepHeader` + `MetricCells` + `TabPanels` + controller.

**Files:**
- Create: `components/custom/LeadGeoPanel/LeadGeoPanel.tsx`
- Create: `components/custom/LeadGeoPanel/LeadGeoPanel.types.ts`
- Create: `components/custom/LeadGeoPanel/LeadGeoView.tsx`
- Create: `components/custom/LeadGeoPanel/LeadGeoStepHeader.tsx`
- Create: `components/custom/LeadGeoPanel/LeadGeoIdentityCell.tsx`
- Create: `components/custom/LeadGeoPanel/LeadGeoMetricCells.tsx`
- Create: `components/custom/LeadGeoPanel/LeadGeoTabPanels.tsx`
- Create: `components/custom/LeadGeoPanel/LeadGeoAnalystBlock.tsx`
- Create: `components/custom/LeadGeoPanel/use-geo-controller.ts`
- Create: `components/custom/LeadGeoPanel/index.ts`
- Modify: `components/custom/LeadGbpPanel/LeadGbpPanel.tsx` (o ramo `selectedStep === "geo"`)

**Interfaces:**
- Consumes: `GEO_STEP_TABS`, `GeoStepTabId` (Task 5); `mergeGeoOpportunities` (Task 5); `GEO_REVIEW_CATALOG`, `GEO_REVIEW_VERDICT_LABEL` (Task 2); `analyzeLeadGeo`, `upsertLeadGeoReview` (Task 6).
- Produces: `LeadGeoPanel`, `LeadGeoPanelProps`.

- [ ] **Step 1: Ler o padrão antes de escrever**

```bash
sed -n '1,80p' components/custom/LeadWebsitePanel/LeadWebsiteView.tsx
sed -n '1,60p' components/custom/LeadWebsitePanel/LeadWebsiteStepHeader.tsx
sed -n '1,60p' components/custom/LeadWebsitePanel/use-website-controller.ts
cat components/custom/LeadStepShell/index.ts
```

O `LeadStepShell` já entrega `StepMetrics`, `StepTabs`, `StepOpportunitiesRail`, `StepOpportunityItem`, `StepNotesField` e `use-collapsible-rail`. **Reuse todos.** Nenhum componente novo de casca.

- [ ] **Step 2: Invocar a skill de front-end**

Antes de escrever JSX, invoque a skill `suite-frontend`. Ela traz o contrato de tokens do shadcn base-mira, o catálogo dos primitives de `components/ui` e os arquétipos de tela. Não improvise cor, espaçamento nem tipografia.

- [ ] **Step 3: Escrever o painel**

Quatro abas, vindas de `GEO_STEP_TABS`:

- **Acesso** — os sete checks, cada um com estado e o valor que prova. Os doze agentes de IA em lista, com o bloqueado em destaque. `llms.txt` mostra o status HTTP ao lado, não só "ausente".
- **Conteúdo** — os cinco determinísticos, mais o bloco do analista com os três critérios em `ok | issue | na`. Título e meta com o comprimento e a faixa alvo (50–60 e 120–160). **Frescor não coletado mostra `—`, nunca "ausente".**
- **Citações** — quando `citations` for `null`, o estado vazio diz **"não coletado"** e explica que é da onda 2, com o botão desabilitado. Nunca "nenhuma citação encontrada".
- **Sondagem** — `promptVisibility` nulo mostra o estado "não sondado" com o botão ao lado e o aviso de custo. **Não invente a tela dos resultados**: ela é da onda 3, e a aba nasce só com o estado vazio.

O cabeçalho carimba **duas datas**: a da coleta desta etapa e a do snapshot de website de onde ela leu (`sources.websiteAuditAt`). As duas, porque são diferentes e a diferença é o dado.

- [ ] **Step 4: Ligar no roteamento**

Em `components/custom/LeadGbpPanel/LeadGbpPanel.tsx`, ao lado do ramo de `visibility`:

```tsx
        ) : selectedStep === "geo" ? (
          <LeadGeoPanel
            detail={detail}
            canEdit={canEdit}
            readingMode={readingMode}
            onGeoChange={(audit) => onGeoChange(detail.lead.id, audit)}
            onGeoReviewChange={(review) =>
              onGeoReviewChange(detail.lead.id, review)
            }
            onPendingChange={onPendingChange}
          />
```

E propagar `onGeoChange` / `onGeoReviewChange` por `LeadGbpPanel.types.ts` até `LeadDetailDialog.tsx`, no mesmo formato de `applyVisibility` (linha 232).

- [ ] **Step 5: Commit (marcar a fronteira, não executar)**

```
feat(presenca-ia): tela da etapa no padrão do pipeline
```

Pare aqui e avise o dono do repo. Não rode `git commit`.

---

### Task 10: Verificação — a bateria única, e a coleta real na tela

A única task que roda comando de verificação. É de propósito: a regra do repositório é bateria completa uma vez, no fim.

**Files:** nenhum.

- [ ] **Step 1: A bateria**

```bash
pnpm test && pnpm lint && pnpm exec tsc --noEmit
```

Esperado: os três limpos. **Não use `pnpm build`.**

Se algo falhar num arquivo que você não tocou, confira antes de chamar de seu: a árvore é compartilhada com outra sessão.

- [ ] **Step 2: A verificação transitiva de `server-only`**

**Um `grep` em `lib/leads/` não serve, e a primeira versão deste passo errava
por isso.** O repo já tem seis módulos `server-only` ali de propósito —
`audit-baseline`, `backlinks-audit`, `backlinks-map`, `diagnosis-pdf`,
`spreadsheet` e `term-coverage`. A pergunta não é "existe algum", é "o cliente
alcança algum", e isso só o grafo responde.

Percorra o grafo a partir das entradas de cliente da etapa — `LeadGeoPanel`,
`LeadGeoView`, `use-geo-controller`, `LeadGbpPanel` e os cinco módulos puros de
`lib/leads/geo-*` —, seguindo todo `from "…"` e parando em arquivo com
`"use server"`, que é fronteira de RPC e não de bundle.

Esperado: **nenhum `server-only` alcançado**. Medido em 2026-09-10: 473 módulos
percorridos, zero alcançados.

- [ ] **Step 3: Aplicar as migrations**

Aplique `20260927000000` e `20260928000000` no banco. Depois rode as duas de novo: elas têm que passar sem erro na segunda execução. Migration não reexecutável já quebrou aqui.

- [ ] **Step 4: A coleta real, na tela**

O app exige sessão — **peça o login ao dono do repo antes**. Depois, no preview do browser:

1. Abra um lead **já auditado antes desta entrega**. A trilha mostra seis etapas, e o Diagnóstico está **trancado**.
2. Abra Presença em IA e rode a coleta. Confira que **nenhuma chamada paga** saiu — o saldo em Ferramentas não se move.
3. Confira campo a campo contra o `snapshot` de `lead_website_audits` daquele canal: os doze agentes de IA, o `llms.txt` com status, o sitemap, o title e o meta com comprimento.
4. Confirme que **frescor aparece como `—`**, e não como "ausente": o crawl é anterior à extensão do parser.
5. Confirme que **Citações diz "não coletado"**, não "nenhuma encontrada".
6. Confirme que a aba Sondagem diz **"não sondado"**.
7. Volte à trilha: o Diagnóstico **destravou**.
8. Gere o diagnóstico. O pilar **Presença em IA** aparece no scorecard com nota real.
9. Abra um lead cujo rascunho de diagnóstico foi salvo antes: ele tem que **abrir sem erro** e aparecer como **desatualizado**.

- [ ] **Step 5: Rodar o crawl de website de novo num lead**

Rode a análise de Website num lead qualquer e confirme que o snapshot novo traz `schemaDates` e `sitemap.lastmod`. Depois rode a coleta de Presença em IA nele: **agora o frescor tem valor**, e o gap `no_freshness_signals` passa a ser possível.

- [ ] **Step 6: Commit (marcar a fronteira, não executar)**

```
chore(presenca-ia): verificação da onda 1 contra lead real
```

Pare aqui e avise o dono do repo. Não rode `git commit`.

---

## O que este plano deliberadamente não faz

- **Não implementa as ondas 2, 3 e 4.** Citações, demanda em IA, sondagem em LLM e a seção no PDF ganham planos próprios, e dependem da resposta da Task 1.
- **Não cria `lib/dataforseo/ai-optimization.ts`.** Cliente de API que ninguém chama é código morto; ele nasce na onda 2, com a forma que o payload da Task 1 mostrar.
- **Não deriva o prompt set.** `geo-prompts.ts` é da onda 3. `prompt_set` nasce como coluna nula.
- **Não mede percentual de renderização.** Só o sinal binário. Percentual exige DOM renderizado, que é outra seção de API.
- **Não mexe na etapa de Website além do frescor.** Os gaps dela ficam onde estão, e a etapa nova os exibe sem recontá-los.
