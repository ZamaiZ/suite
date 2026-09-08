# Lead Audit Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar a auditoria de lead um registro versionado e comparável, e completar a coleta do site antes que o primeiro baseline seja gravado.

**Architecture:** As três coletas de lead deixam de sobrescrever e passam a acumular linhas, lidas sempre pela mais recente. Os dados variáveis do perfil do Google saem para uma tabela de snapshots própria, e a revisão do analista sai do snapshot para viver por canal. A amostra de páginas é fixada no primeiro crawl, e a coleta ganha canonical, headers, headings completos e interpretação de robots, para que o baseline nasça com a forma final.

**Tech Stack:** Next.js 16.3.1 App Router, React 19.2.8, TypeScript, Supabase, cheerio e Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-09-04-lead-audit-snapshot-design.md`

## Global Constraints

- Não executar comandos de Git, testes, build, lint ou typecheck; regras do repositório proíbem todos eles.
- Toda tabela nova replica o mesmo conjunto de políticas RLS das tabelas irmãs: `select`, `insert`, `update` e `delete` para membro comercial, no padrão `<tabela>_<acao>_commercial`.
- Nenhuma coleta pode sobrescrever coleta anterior depois desta entrega.
- Snapshots antigos precisam continuar legíveis: os leitores aceitam payload sem `headings`, sem `canonical`, sem `headers` e sem os campos novos de robots.
- Screenshots do PageSpeed permanecem em base64 dentro do payload; não mover para Storage nesta entrega.
- Não separar a resolução de provider e não tocar em SerpAPI, backlinks ou concorrentes; são a onda 3.
- Não criar cálculo derivado sobre reviews, sentimento, Q&A ou `unrepliedLowRating`; são a onda 2.

---

## File Structure

- Criar `supabase/migrations/*_lead_audit_versioning.sql` — trocar índices únicos por compostos e adicionar `audit_paths` e `baseline_at`.
- Criar `supabase/migrations/*_lead_gbp_snapshots.sql` — tabela append-only do perfil, backfill e remoção das colunas variáveis.
- Criar `supabase/migrations/*_lead_website_reviews.sql` — tabela da revisão por canal, backfill e remoção de `review` e `notes`.
- Criar `lib/leads/gbp-snapshot.ts` — tipo, leitor e seletor do snapshot mais recente do perfil.
- Criar `lib/leads/website-headings.ts` — coleta ordenada de H1 a H6, derivação de `h1`/`h2` e regra de hierarquia.
- Criar `lib/leads/website-canonical.ts` — normalização do canonical e as seis regras por página.
- Criar `lib/leads/website-headers.ts` — chaves selecionadas, leitura tolerante e regra de headers fracos.
- Criar `lib/website-audit/robots.ts` — parser de grupos, agentes de IA e verificação de `llms.txt`.
- Criar `lib/leads/audit-baseline.ts` — resolução do snapshot de baseline por dimensão.
- Modificar `lib/website-audit/fetch.ts`, `crawl.ts`, `parse.ts` — propagar headers, aceitar amostra fixa, registrar páginas com erro e coletar os campos novos.
- Modificar `lib/leads/website-audit.ts`, `website-opportunities.ts`, `website-review.ts`, `website-pagespeed.ts` — contrato do snapshot, gaps novos, revisão fora do snapshot e correção do CLS.
- Modificar `lib/leads/gbp.ts`, `gbp-audit.ts`, `digital-channels.ts` — perfil sem colunas variáveis, snapshot mais recente e `audit_paths`.
- Modificar as actions de lead que leem e escrevem auditoria, e `app/actions/clients/convert-lead.ts`.
- Modificar `components/custom/LeadWebsitePanel/*` e `components/custom/LeadGbpPanel/*` — revisão vinda do canal, headings e gaps novos.

### Task 1: Migrations de versionamento, snapshots e baseline

**Files:**

- Create: `supabase/migrations/20260917000000_lead_audit_versioning.sql`
- Create: `supabase/migrations/20260918000000_lead_gbp_snapshots.sql`
- Create: `supabase/migrations/20260919000000_lead_website_reviews.sql`

- [ ] Remover `lead_website_audits_channel_id_uidx` e criar índice comum `(channel_id, fetched_at desc)`.
- [ ] Remover `lead_visibility_audits_lead_id_uidx` e criar índice comum `(lead_id, fetched_at desc)`.
- [ ] Remover `lead_gbp_rank_checks_profile_keyword_uidx` e a constraint `lead_gbp_rank_checks_profile_keyword_key`, e criar índice comum `(profile_id, keyword, checked_at desc)`.
- [ ] Adicionar `audit_paths text[] not null default '{}'` em `lead_digital_channels`, com constraint de cardinalidade máxima de oito.
- [ ] Adicionar `baseline_at timestamptz` em `clients`.
- [ ] Criar `lead_gbp_snapshots` com `id`, `profile_id` referenciando `lead_gbp_profiles` com `on delete cascade`, `captured_at timestamptz not null default now()`, e as colunas `payload jsonb not null`, `enrichment jsonb`, `reviews jsonb`, `posts jsonb`, `qna jsonb`; índice `(profile_id, captured_at desc)`.
- [ ] Copiar cada `lead_gbp_profiles` para uma primeira linha de `lead_gbp_snapshots`, usando `coalesce(enrichment_at, reviews_at, posts_at, fetched_at)` como `captured_at`.
- [ ] Remover de `lead_gbp_profiles` as colunas `enrichment`, `enrichment_at`, `reviews`, `reviews_at`, `posts`, `posts_at`, `qna`, `qna_at` e as constraints que as pareavam.
- [ ] Criar `lead_website_reviews` com `id`, `channel_id` único referenciando `lead_digital_channels` com `on delete cascade`, `lead_id`, `review jsonb not null default '{}'::jsonb`, `notes text`, `updated_at timestamptz not null default now()` e `updated_by uuid` referenciando `users`.
- [ ] Copiar `review` e `notes` da linha atual de cada canal em `lead_website_audits` para `lead_website_reviews`, aplicando na cópia a mesma conversão legada de `notes` para `review.other` que `readWebsiteReview` faz hoje.
- [ ] Remover as colunas `review` e `notes` de `lead_website_audits` e a constraint `lead_website_audits_notes_len_chk`.
- [ ] Habilitar RLS e criar as quatro políticas `_commercial` em `lead_gbp_snapshots` e `lead_website_reviews`, copiando as expressões usadas em `lead_website_audits`.

### Task 2: Escrita e leitura append-only

**Files:**

- Modify: `app/actions/leads/analyze-website.ts`
- Modify: `app/actions/leads/website-access.ts`
- Modify: `app/actions/leads/analyze-visibility.ts`
- Modify: `app/actions/leads/visibility-access.ts`
- Modify: `app/actions/leads/check-gbp-ranking.ts`
- Modify: `app/actions/leads/gbp-access.ts`
- Modify: `app/actions/leads/get-lead.ts`
- Modify: `lib/leads/website-audit.ts`

- [ ] Em `analyzeLeadWebsite`, remover a consulta que busca `existing?.id` e o ramo de `update`; a action passa a sempre inserir e a devolver a linha inserida.
- [ ] Em `analyzeLeadVisibility`, aplicar a mesma troca de upsert por insert.
- [ ] Em `checkGbpRanking`, trocar o `upsert` em `lead_gbp_rank_checks` por `insert`.
- [ ] Em `loadWebsiteChannelRow` e `loadWebsiteAuditRow`, ordenar por `fetched_at desc` e limitar a uma linha.
- [ ] Em `visibility-access.ts`, ordenar por `fetched_at desc` e limitar a uma linha.
- [ ] Em `gbp-access.ts`, reduzir o embed `lead_gbp_rank_checks` à checagem mais recente por keyword, ordenando por `checked_at desc` e deduplicando por keyword no mapeamento.
- [ ] Em `readLeadWebsiteAudits`, trocar a deduplicação por `id` por seleção da linha mais recente por `channel_id`.
- [ ] Em `get-lead.ts`, ajustar os embeds de auditoria para acompanhar a nova ordenação e continuar entregando uma auditoria por canal.
- [ ] Conferir manualmente que `pollLeadWebsiteJobs` continua operando por `audit_id` e não precisa de alteração.

### Task 3: Snapshot do perfil do Google

**Files:**

- Create: `lib/leads/gbp-snapshot.ts`
- Modify: `lib/leads/gbp.ts`
- Modify: `app/actions/leads/gbp-access.ts`
- Modify: `app/actions/leads/enrich-gbp-profile.ts`
- Modify: `app/actions/leads/poll-gbp-jobs.ts`
- Modify: `app/actions/leads/refresh-gbp-profile.ts`
- Modify: `app/actions/leads/link-gbp-profile.ts`

**Interfaces:**

```ts
export type LeadGbpSnapshot = {
  id: string
  profile_id: string
  captured_at: string
  payload: GbpSnapshot
  enrichment: GbpEnrichment | null
  reviews: GbpReviewSummary | null
  posts: GbpPost[] | null
  qna: GbpQna | null
}

export function readLeadGbpSnapshotRow(
  row: Record<string, unknown>,
): LeadGbpSnapshot | null
export function latestGbpSnapshot(embed: unknown): LeadGbpSnapshot | null
```

- [ ] Criar `lib/leads/gbp-snapshot.ts` reaproveitando `readGbpSnapshot`, `readGbpEnrichment`, `readGbpReviews`, `readGbpPosts` e `readGbpQna` já existentes em `gbp.ts` e `gbp-audit.ts`.
- [ ] Manter `payload` em `lead_gbp_profiles` como estado corrente do perfil; ele continua sendo lido por `lib/briefing/prefill.ts` e pelos gaps, e é copiado para cada snapshot apenas como histórico.
- [ ] Em `LeadGbpProfile`, remover apenas `enrichment`, `enrichment_at`, `reviews`, `reviews_at`, `posts`, `posts_at`, `qna` e `qna_at`, preservar `payload`, e acrescentar `snapshot: LeadGbpSnapshot | null`.
- [ ] Ajustar `readLeadGbpProfileRow` para montar o perfil a partir das colunas de identidade e de `payload`, mais o snapshot mais recente do embed.
- [ ] No `GBP_SELECT` de `gbp-access.ts`, trocar as colunas removidas pelo embed `lead_gbp_snapshots(...)` ordenado por `captured_at desc` com limite um, mantendo `payload` na lista de colunas.
- [ ] Em `enrich-gbp-profile.ts`, trocar os dois `update` de `enrichment`, `posts`, `reviews` e `qna` por um `insert` em `lead_gbp_snapshots`, carregando no mesmo registro o `payload` corrente do perfil.
- [ ] Em `poll-gbp-jobs.ts`, trocar os `update` de `reviews` e de `posts` por inserção de um novo snapshot que preserve os demais campos do snapshot anterior.
- [ ] Em `refresh-gbp-profile.ts` e `link-gbp-profile.ts`, manter o `update` de `payload` no perfil e acrescentar a inserção de um snapshot, herdando `enrichment`, `reviews`, `posts` e `qna` do snapshot anterior quando existirem.
- [ ] Ajustar `gbpGapsForProfile` e `diagnosis-compile.ts` para lerem de `profile.snapshot` em vez das colunas removidas.
- [ ] Ajustar `components/custom/LeadGbpPanel/*` para lerem de `profile.snapshot`, incluindo `LeadGbpQnaBlock` e `LeadGbpProfileCard`.

### Task 4: Revisão do analista por canal

**Files:**

- Modify: `lib/leads/website-review.ts`
- Modify: `lib/leads/website-audit.ts`
- Modify: `app/actions/leads/update-website-audit.ts`
- Modify: `app/actions/leads/website-access.ts`
- Modify: `app/actions/leads/get-lead.ts`
- Modify: `components/custom/LeadWebsitePanel/*`

**Interfaces:**

```ts
export type LeadWebsiteReview = {
  channel_id: string
  review: WebsiteReview
  notes: string | null
  updated_at: string | null
  updated_by: string | null
}

export function readLeadWebsiteReviewRow(
  row: Record<string, unknown>,
): LeadWebsiteReview
```

- [ ] Remover `review` e `notes` de `LeadWebsiteAudit` e de `readLeadWebsiteAuditRow`.
- [ ] Acrescentar `readLeadWebsiteReviewRow` em `website-review.ts`, mantendo `readWebsiteReview` intacta para o payload da nova tabela.
- [ ] Em `update-website-audit.ts`, escrever a revisão em `lead_website_reviews` por `channel_id`, com `upsert`, em vez de atualizar a linha de auditoria.
- [ ] Em `website-access.ts` e `get-lead.ts`, carregar a revisão do canal junto do snapshot mais recente e entregá-la como campo irmão, não aninhado na auditoria.
- [ ] Ajustar o painel do site para receber auditoria e revisão como duas propriedades separadas.
- [ ] Conferir manualmente que `mergeWebsiteOpportunities` continua recebendo a revisão correta agora vinda do canal.

### Task 5: Amostra estável e páginas com erro

**Files:**

- Modify: `lib/website-audit/crawl.ts`
- Modify: `lib/website-audit/parse.ts`
- Modify: `lib/leads/digital-channels.ts`
- Modify: `app/actions/leads/analyze-website.ts`

**Interfaces:**

```ts
export function crawlWebsite(
  startUrl: string,
  fixedPaths?: readonly string[],
): Promise<CrawlWebsiteResult>
export function emptyPageSnapshot(
  url: string,
  status: number,
): WebsitePageSnapshot
export type CrawlWebsiteResult =
  | { status: "ok"; crawl: WebsiteCrawl; usedPaths: string[] }
  | { status: "error"; message: string }
```

- [ ] Acrescentar `audit_paths` ao tipo `LeadDigitalChannel` e à leitura das colunas do canal.
- [ ] Fazer `crawlWebsite` aceitar `fixedPaths`; quando vier preenchido, montar os alvos a partir dele e ignorar `crawlTargetsFromHome`.
- [ ] Quando `fixedPaths` vier vazio, derivar como hoje e devolver a lista em `usedPaths`.
- [ ] Criar `emptyPageSnapshot` em `parse.ts`, com todos os campos numéricos em zero, listas vazias e booleanos falsos.
- [ ] Fazer `fetchPage` devolver `emptyPageSnapshot` em falha de rede ou status maior ou igual a 400, em vez de `null`, preservando `url` e `status`; usar `status` zero quando não houver resposta.
- [ ] Em `analyzeLeadWebsite`, passar `channel.audit_paths` para `crawlWebsite` e gravar `usedPaths` no canal quando `audit_paths` estiver vazio.
- [ ] Conferir manualmente que `websiteHomePage` continua encontrando a home quando a amostra fixa não contém o path da home.

### Task 6: Headers, canonical e headings na coleta

**Files:**

- Create: `lib/leads/website-headers.ts`
- Create: `lib/leads/website-canonical.ts`
- Create: `lib/leads/website-headings.ts`
- Modify: `lib/website-audit/fetch.ts`
- Modify: `lib/website-audit/parse.ts`
- Modify: `lib/leads/website-audit.ts`

**Interfaces:**

```ts
export const SECURITY_HEADER_KEYS = [
  "strict-transport-security",
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "x-robots-tag",
] as const

export type WebsiteHeading = { level: number; text: string }

export function pickSecurityHeaders(headers: Headers): Record<string, string>
export function missingSecurityHeaders(
  headers: Record<string, string>,
): string[]
export function collectHeadings($: ReturnType<typeof load>): WebsiteHeading[]
export function headingsSkipLevel(headings: readonly WebsiteHeading[]): boolean
export function normalizeCanonical(
  raw: string | undefined,
  pageUrl: URL,
): string | null
```

- [ ] Em `SafeFetchOk`, acrescentar `headers: Record<string, string>` preenchido por `pickSecurityHeaders`, mantendo `contentType` como está.
- [ ] Em `parseHtmlPage`, acrescentar o parâmetro `headers` e gravá-lo no snapshot da página.
- [ ] Coletar `headings` percorrendo `h1, h2, h3, h4, h5, h6` em ordem de documento, e derivar `h1` e `h2` dessa lista para manter o contrato atual.
- [ ] Extrair `canonical` de `link[rel="canonical"]` e resolvê-lo para URL absoluta com `normalizeCanonical`, devolvendo `null` quando ausente ou inválido.
- [ ] Fazer `indexable` considerar também `x-robots-tag` dos headers, além das metas `robots` e `googlebot`.
- [ ] Em `readPage`, aceitar `headers`, `canonical` e `headings` como opcionais, com padrão vazio, para que snapshots antigos continuem válidos.
- [ ] Em `crawl.ts`, propagar os headers de `safeFetch` para `parseHtmlPage` na home e nas internas.

### Task 7: Robots interpretado, llms.txt e IDs de medição

**Files:**

- Create: `lib/website-audit/robots.ts`
- Modify: `lib/website-audit/crawl.ts`
- Modify: `lib/website-audit/parse.ts`
- Modify: `lib/leads/website-audit.ts`

**Interfaces:**

```ts
export const AI_USER_AGENTS = [
  "gptbot",
  "chatgpt-user",
  "claudebot",
  "perplexitybot",
  "google-extended",
  "ccbot",
  "bytespider",
  "applebot-extended",
  "meta-externalagent",
  "amazonbot",
] as const

export type RobotsGroup = {
  userAgents: string[]
  allow: string[]
  disallow: string[]
}
export type RobotsAiAgent = { agent: string; blocked: boolean }

export function parseRobotsGroups(text: string): RobotsGroup[]
export function aiAgentsFromGroups(
  groups: readonly RobotsGroup[],
): RobotsAiAgent[]
export function robotsBlocksPath(
  groups: readonly RobotsGroup[],
  agent: string,
  path: string,
): boolean
```

- [ ] Criar o parser de grupos, tratando linhas `User-agent`, `Allow` e `Disallow`, agrupando user-agents consecutivos e ignorando comentários.
- [ ] Implementar `robotsBlocksPath` com a regra do caminho mais específico e `Allow` vencendo empate, e o grupo `*` valendo quando não houver grupo específico do agente.
- [ ] Acrescentar a `WebsiteRobotsSnapshot` os campos `content` limitado a dez mil caracteres, `groups` e `aiAgents`, mantendo `found` e `sitemapUrls`.
- [ ] Buscar `/llms.txt` no crawl e gravar `llmsTxt: { found: boolean; status: number | null }` em `WebsiteCrawl`.
- [ ] Em `readWebsiteCrawl` e `readRobots`, aceitar os campos novos como opcionais com padrão vazio.
- [ ] Em `extractHtmlSignals`, acrescentar `measurementIds` com `ga4`, `gtm`, `googleAds` e `metaPixel`, extraídos por captura de `G-[A-Z0-9]+`, `GTM-[A-Z0-9]+`, `AW-[0-9]+` e do argumento de `fbq('init', ...)` no mesmo haystack já montado.
- [ ] Fazer `mergeWebsiteCrawlSignals` unir `measurementIds` preservando o primeiro valor não vazio de cada chave.
- [ ] Em `readSignals`, aceitar `measurementIds` ausente com padrão vazio.

### Task 8: Regras derivadas e correção do CLS de campo

**Files:**

- Modify: `lib/leads/website-audit.ts`
- Modify: `lib/leads/website-opportunities.ts`
- Modify: `lib/leads/website-pagespeed.ts`
- Modify: `lib/leads/website-canonical.ts`
- Modify: `lib/website-audit/crawl.ts`

- [ ] Acrescentar a `WEBSITE_GAP_IDS` e a `WEBSITE_GAP_LABELS` os identificadores `canonical_missing`, `canonical_points_elsewhere`, `canonical_external`, `canonical_insecure`, `canonical_vs_noindex`, `canonical_non_indexable`, `host_canonicalization`, `slash_canonicalization`, `weak_security_headers`, `heading_hierarchy`, `noindex_internal_pages` e `robots_blocks_search`.
- [ ] Implementar as seis regras de canonical por página em `website-canonical.ts` e chamá-las em `websiteGapsForAudit`.
- [ ] No crawl, buscar as quatro variantes da home — com e sem `www`, com e sem barra final — comparar URL final e canonical, e devolver os resultados para alimentar `host_canonicalization` e `slash_canonicalization`.
- [ ] Emitir `weak_security_headers` uma única vez quando qualquer página da amostra tiver headers faltando, com o detalhe listando as chaves ausentes.
- [ ] Emitir `heading_hierarchy` quando `headingsSkipLevel` for verdadeiro em qualquer página da amostra.
- [ ] Emitir `noindex_internal_pages` quando alguma página fora da home tiver `indexable` falso, mantendo o gap `noindex` restrito à home.
- [ ] Emitir `robots_blocks_search` quando `robotsBlocksPath` for verdadeiro para `googlebot` na home ou em qualquer path da amostra.
- [ ] Não criar gap para bloqueio de agentes de IA; o dado fica apenas no snapshot.
- [ ] Acrescentar títulos de oportunidade para cada gap novo em `OPPORTUNITY_TITLES` e classificar impacto em `HIGH_IMPACT`; `canonical_external`, `canonical_vs_noindex`, `noindex_internal_pages` e `robots_blocks_search` entram como alto impacto.
- [ ] Corrigir `fieldCls` em `website-pagespeed.ts` para sempre dividir o percentil do CrUX por cem, removendo a condição `raw > 1`.
- [ ] Conferir em `lib/leads/website-presenters.ts` que os doze gaps novos aparecem em alguma trilha do painel; as funções ali usam `Set.has` e não são exaustivas, então um gap sem menção fica invisível na interface mesmo tendo rótulo.

### Task 9: Baseline na conversão

**Files:**

- Create: `lib/leads/audit-baseline.ts`
- Modify: `app/actions/clients/convert-lead.ts`
- Modify: `app/actions/clients/get-client.ts`

**Interfaces:**

```ts
export type AuditBaseline = {
  websiteAuditId: string | null
  visibilityAuditId: string | null
  gbpSnapshotId: string | null
}

export function resolveAuditBaseline(
  supabase: SupabaseClient,
  leadId: string,
  baselineAt: string,
): Promise<AuditBaseline>
```

- [ ] Preencher `baseline_at` no `insert` de `clients` com o mesmo `generatedAt` já usado para `converted_at`.
- [ ] Implementar `resolveAuditBaseline` selecionando, por dimensão, a linha mais recente com timestamp menor ou igual a `baselineAt`, devolvendo `null` quando não houver.
- [ ] Expor o baseline resolvido em `getClient`, junto de um sinalizador por dimensão indicando ausência.
- [ ] Conferir manualmente que converter um lead sem auditoria anterior não quebra a action e devolve baseline vazio.

### Task 10: Revisão estrutural sem execução automatizada

**Files:**

- Review: todos os arquivos alterados nesta entrega

- [ ] Conferir que nenhuma action de auditoria restante usa `update` ou `upsert` sobre snapshot.
- [ ] Conferir que `LeadWebsiteAudit`, `LeadGbpProfile`, `LeadWebsiteReview` e `LeadGbpSnapshot` carregam os mesmos nomes de campos usados nas actions e nos componentes.
- [ ] Conferir que todos os leitores de payload aceitam snapshot antigo sem `headings`, `canonical`, `headers`, `groups`, `aiAgents`, `llmsTxt` e `measurementIds`.
- [ ] Conferir que as quatro políticas RLS existem nas duas tabelas novas e espelham as de `lead_website_audits`.
- [ ] Conferir que `diagnosis-compile.ts` continua compilando os quatro pilares depois da mudança de contrato do perfil.
- [ ] Registrar que não foram executados testes, build, lint, typecheck ou Git por instrução do repositório.
