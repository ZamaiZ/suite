# GBP Geo Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar, ponto a ponto numa malha centrada no perfil, em que posição o cliente aparece no Maps para uma keyword.

**Architecture:** Uma tabela append-only guarda o scan inteiro — configuração, progresso e a malha em jsonb. Uma action inicia e uma action de poll processa lotes de pontos com trava otimista, gravando conforme chegam, de modo que o mapa preenche na tela e um retry retoma em vez de reiniciar. A coleta por ponto reaproveita a chamada de Maps que já existe, com zoom parametrizado.

**Tech Stack:** Next.js 16.3.1 App Router, React 19.2.8, TypeScript, Supabase, Google Maps JS API, SerpAPI.

**Spec:** `docs/superpowers/specs/2026-09-04-gbp-geo-grid-design.md`

## Global Constraints

- Não executar comandos de Git, testes, build, lint ou typecheck; regras do repositório proíbem todos eles.
- Cada ponto da malha é uma busca paga do plano SerpAPI. Nenhuma alteração pode fazer o sistema refazer um ponto já coletado.
- A cota é verificada uma única vez, antes do primeiro ponto, com `requireSerpApiQuota(size²)`.
- Apenas SerpAPI nesta entrega. Não tocar em `lib/dataforseo/`, não adicionar ramo de provider.
- Zoom fixo em 15 na requisição, gravado na linha do scan.
- Não alterar `GBP_RANK_KEYWORDS_MAX`, `lead_gbp_rank_checks` além da gravação do ponto central, nem o fluxo de `check-gbp-ranking`.
- Snapshots antigos e novos convivem: nada do que existe hoje muda de forma.

---

## File Structure

- Criar `supabase/migrations/20260921000000_lead_gbp_grid_scans.sql` — tabela, índices, trava de disparo duplo e RLS.
- Criar `lib/leads/gbp-grid.ts` — constantes, tipos, geometria, leitura tolerante e métricas ARP/ATRP/SoLV.
- Criar `lib/validations/lead-gbp-grid.ts` — schemas das duas actions.
- Criar `app/actions/leads/start-gbp-grid-scan.ts` — valida, confere cota, calcula coordenadas, cria o scan.
- Criar `app/actions/leads/poll-gbp-grid-scan.ts` — reivindica, processa um lote, grava, devolve progresso.
- Criar `components/custom/LeadGbpPanel/LeadGbpGridMap.tsx` — mapa com marcador central e marcadores numerados.
- Modificar `lib/serpapi/google-maps-rank.ts` — zoom parametrizado e coleta de ponto sem filtro de posição.
- Modificar `app/actions/leads/gbp-access.ts` — carregar o scan mais recente por perfil.
- Modificar `components/custom/LeadGbpPanel/LeadGbpRankBlock.tsx` — controles, prévia de custo, progresso e mapa.
- Modificar `app/actions/leads/index.ts` — exportar as actions novas.

### Task 1: Tabela do scan

**Files:**
- Create: `supabase/migrations/20260921000000_lead_gbp_grid_scans.sql`

- [ ] Criar `lead_gbp_grid_scans` com `id`, `lead_id` e `profile_id` referenciando `leads` e `lead_gbp_profiles` com `on delete cascade`, `keyword text`, `center_lat`/`center_lng` como `double precision`, `size integer`, `radius_km numeric(5,2)`, `zoom integer`, `source text`, `status text`, `processed integer default 0`, `total integer`, `points jsonb default '[]'::jsonb`, `error_message text`, `started_at timestamptz`, `captured_at timestamptz default now()` e `updated_at timestamptz default now()`.
- [ ] Adicionar as constraints: `size in (5, 7, 11)`, `radius_km between 1 and 25`, `zoom between 3 and 21`, `source = 'serpapi_maps'`, `status in ('queued','running','ready','partial','failed')`, `total = size * size`, `processed between 0 and total` e comprimento de `keyword` entre 1 e 80.
- [ ] Criar índice de leitura `(profile_id, keyword, captured_at desc)` e índice auxiliar `(lead_id)`.
- [ ] Criar índice único parcial `on (profile_id, keyword) where status in ('queued','running')` — é a trava contra disparo duplo, feita no banco para que dois cliques simultâneos não gerem dois scans.
- [ ] Habilitar RLS e criar as quatro políticas `lead_gbp_grid_scans_<acao>_commercial`, copiando as expressões de `lead_website_audits`, mais o `revoke`/`grant` no mesmo formato.

### Task 2: Geometria, tipos e métricas

**Files:**
- Create: `lib/leads/gbp-grid.ts`

**Interfaces:**

```ts
export const GBP_GRID_SIZES = [5, 7, 11] as const
export const GBP_GRID_SIZE_DEFAULT = 5
export const GBP_GRID_RADIUS_KM_MIN = 1
export const GBP_GRID_RADIUS_KM_MAX = 25
export const GBP_GRID_RADIUS_KM_DEFAULT = 5
export const GBP_GRID_ZOOM = 15
export const GBP_GRID_CHUNK = 10
export const GBP_GRID_CONCURRENCY = 4

export type GbpGridSize = (typeof GBP_GRID_SIZES)[number]
export type GbpGridPointStatus = "pending" | "done" | "failed"

export type GbpGridPoint = {
  row: number
  col: number
  lat: number
  lng: number
  status: GbpGridPointStatus
  position: number | null
  competitors: GbpRankCompetitor[]
}

export type GbpGridScanStatus =
  | "queued" | "running" | "ready" | "partial" | "failed"

// snake_case nos campos que são coluna, como em LeadGbpProfile e
// LeadWebsiteAudit; camelCase fica reservado ao que é derivado.
export type LeadGbpGridScan = {
  id: string
  profile_id: string
  keyword: string
  center_lat: number
  center_lng: number
  size: number
  radius_km: number
  zoom: number
  source: string
  status: GbpGridScanStatus
  processed: number
  total: number
  points: GbpGridPoint[]
  error_message: string | null
  captured_at: string
}

export type GbpGridMetrics = {
  arp: number | null
  atrp: number | null
  solv: number | null
  found: number
  total: number
}

export function gbpGridPoints(input: {
  centerLat: number
  centerLng: number
  size: number
  radiusKm: number
}): GbpGridPoint[]
export function gbpGridCenterIndex(size: number): number
export function readLeadGbpGridScanRow(row: Record<string, unknown>): LeadGbpGridScan | null
export function latestGbpGridScan(embed: unknown): LeadGbpGridScan | null
export function gbpGridMetrics(points: readonly GbpGridPoint[]): GbpGridMetrics
export function gbpGridPendingPoints(points: readonly GbpGridPoint[], limit: number): GbpGridPoint[]
```

- [ ] Implementar `gbpGridPoints` com espaçamento `(2 * radiusKm) / (size - 1)`, `KM_PER_DEG_LAT = 111.32` e longitude corrigida por `cos(latitude em radianos)`. Linha 0 é o norte e coluna 0 é o oeste, para que a matriz se leia como o mapa. Todos os pontos nascem `pending`, com `position` nula e `competitors` vazio.
- [ ] Implementar `gbpGridCenterIndex` devolvendo `(size - 1) / 2` — usado para identificar o ponto que coincide com a coordenada do perfil.
- [ ] Implementar `gbpGridMetrics`: `found` conta pontos `done` com posição; `arp` é a média dessas posições, ou nulo se nenhuma; `atrp` é a média sobre todos os pontos contando ausência como `GBP_MAPS_DEPTH + 1`; `solv` é o percentual de pontos com posição menor ou igual a 3.
- [ ] Implementar `readLeadGbpGridScanRow` e `latestGbpGridScan` no padrão dos demais leitores: tolerantes, devolvendo nulo quando o registro não é legível, e escolhendo o mais recente por `captured_at` sem depender da ordem da consulta.
- [ ] Implementar `gbpGridPendingPoints` devolvendo até `limit` pontos com status `pending`, em ordem de linha e coluna.

### Task 3: Coleta de um ponto no SerpAPI

**Files:**
- Modify: `lib/serpapi/google-maps-rank.ts`

**Interfaces:**

```ts
export function serpApiMapsLl(latitude: number, longitude: number, zoom?: number): string

export type SerpApiGridPointResult =
  | { status: "ok"; position: number | null; competitors: GbpRankCompetitor[] }
  | { status: "error"; message: string }

export async function fetchSerpApiGridPoint(input: {
  keyword: string
  placeId: string
  latitude: number
  longitude: number
  zoom: number
}): Promise<SerpApiGridPointResult>
```

- [ ] Acrescentar o parâmetro `zoom` a `serpApiMapsLl`, com padrão 17, para que a chamada existente em `fetchSerpApiMapsRank` continue idêntica.
- [ ] Implementar `fetchSerpApiGridPoint` reaproveitando `readLocalResults` e `GBP_MAPS_DEPTH`, com duas diferenças em relação a `mapSerpApiMapsRank`: o zoom vem do chamador, e os concorrentes são **o top 3 daquele ponto por posição, sem filtrar pela posição do cliente** — na malha, o ponto onde o cliente não aparece é justamente aquele em que interessa saber quem está lá.
- [ ] Devolver `position` nula quando o `placeId` não estiver entre os resultados, sem tratar isso como erro.

### Task 4: Validações

**Files:**
- Create: `lib/validations/lead-gbp-grid.ts`

**Interfaces:**

```ts
export const startGbpGridScanSchema: ZodType<{
  profile_id: string
  keyword: string
  size: number
  radius_km: number
}>
export function readStartGbpGridScanFields(formData: FormData): unknown
export const pollGbpGridScanSchema: ZodType<{ scan_id: string }>
export function readPollGbpGridScanFields(formData: FormData): unknown
```

- [ ] Espelhar o formato de `lib/validations/lead-gbp.ts`: `z.uuid` com mensagem em português para os ids, `formText` para os campos de texto, e conversão numérica explícita para `size` e `radius_km`.
- [ ] Restringir `size` aos valores de `GBP_GRID_SIZES` e `radius_km` à faixa de `GBP_GRID_RADIUS_KM_MIN` a `GBP_GRID_RADIUS_KM_MAX`.

### Task 5: Iniciar o scan

**Files:**
- Create: `app/actions/leads/start-gbp-grid-scan.ts`
- Modify: `app/actions/leads/index.ts`

- [ ] Autenticar com `requireCommercialMember`, validar o formulário e carregar o perfil com `loadGbpProfileRow`, recusando com `denyGbpEdit` no mesmo formato de `check-gbp-ranking`.
- [ ] Recusar quando a keyword não estiver em `profile.rank_keywords`, e quando o perfil não tiver `latitude` e `longitude` no payload.
- [ ] Conferir a cota **uma única vez** com `requireSerpApiQuota(size * size)` antes de qualquer coleta, devolvendo a mensagem do próprio helper quando faltar saldo.
- [ ] Calcular os pontos com `gbpGridPoints` e inserir a linha do scan com `status: "queued"`, `processed: 0`, `total: size * size`, `zoom: GBP_GRID_ZOOM`, `source: "serpapi_maps"` e os pontos todos `pending`.
- [ ] Tratar a violação do índice único parcial (código `23505`) como "já existe uma malha em andamento para esta keyword", sem consumir busca.
- [ ] Devolver o scan lido por `readLeadGbpGridScanRow`.
- [ ] Exportar a action em `app/actions/leads/index.ts`, no formato das demais.

### Task 6: Processar a malha em lotes

**Files:**
- Create: `app/actions/leads/poll-gbp-grid-scan.ts`
- Modify: `app/actions/leads/index.ts`

- [ ] Autenticar, validar e carregar o scan por id, junto do perfil e do contexto de lead, aplicando `denyGbpEdit`.
- [ ] Reivindicar com trava otimista: atualizar para `status: "running"` e `started_at` condicionando ao status atual com `.eq("status", statusAtual)`, no mesmo formato de `claimWebsitePagespeedJob`. Se a atualização não devolver linha, outro poll já assumiu — devolver o scan como está, sem coletar.
- [ ] Selecionar até `GBP_GRID_CHUNK` pontos pendentes com `gbpGridPendingPoints` e buscá-los com concorrência `GBP_GRID_CONCURRENCY`. O `mapPool` de `lib/website-audit/crawl.ts` é privado do módulo — replicar o padrão localmente, não importar.
- [ ] Marcar cada ponto coletado como `done` com sua posição e concorrentes; marcar como `failed` os que erraram. **Nunca reprocessar um ponto que já esteja `done`** — é busca já paga.
- [ ] Gravar os pontos atualizados e `processed` igual à contagem de pontos não pendentes. Enquanto houver pendente, manter `running`; sem pendentes e sem falha, `ready`; sem pendentes e com falha, `partial`, preservando os pontos coletados.
- [ ] Quando o ponto central for concluído com sucesso, gravar também um `lead_gbp_rank_checks` com `insertGbpRankCheck`, usando a keyword do scan, a posição e os concorrentes daquele ponto — é o mesmo dado que `check-gbp-ranking` obteria, sem chamada adicional.
- [ ] Devolver o scan atualizado, para que a interface preencha a malha progressivamente.
- [ ] Exportar a action em `app/actions/leads/index.ts`.

### Task 7: Carregar o scan mais recente

**Files:**
- Modify: `app/actions/leads/gbp-access.ts`

- [ ] Acrescentar ao `GBP_SELECT` o embed `lead_gbp_grid_scans(...)` com as colunas do scan, ordenado por `captured_at desc` e limitado a um por perfil.
- [ ] Expor o scan lido em `LeadGbpProfile` como `gridScan: LeadGbpGridScan | null`, preenchido por `latestGbpGridScan`, seguindo o mesmo formato adotado para `snapshot`.

### Task 8: Mapa da malha

**Files:**
- Create: `components/custom/LeadGbpPanel/LeadGbpGridMap.tsx`

- [ ] Montar o mapa com o carregador de `lib/google-maps/` e os estilos de `map-styles.ts`, no mesmo formato de `BriefingServiceRadiusMapCanvas`: referência ao contêiner, instância guardada em ref e limpeza no desmonte.
- [ ] Centralizar na coordenada do perfil, com marcador próprio, e ajustar o enquadramento aos limites da malha.
- [ ] Desenhar um marcador circular por ponto com o número da posição, e três estados visuais: posição de 1 a 3, de 4 a 10 e de 11 em diante; ponto sem posição aparece esmaecido e ponto `pending` aparece vazio.
- [ ] Redesenhar quando os pontos mudarem, para que a malha preencha durante o scan.

### Task 9: Controles no bloco de ranking

**Files:**
- Modify: `components/custom/LeadGbpPanel/LeadGbpRankBlock.tsx`

- [ ] Acrescentar uma seção expansível com seletor de keyword — limitado a `profile.rank_keywords` —, seletor de tamanho entre `GBP_GRID_SIZES` e campo de raio entre 1 e 25 km.
- [ ] Exibir a prévia de custo como `size²` buscas ao lado dos controles, antes do disparo.
- [ ] Disparar `startLeadGbpGridScan` e, enquanto o status for `queued` ou `running`, chamar `pollLeadGbpGridScan` em intervalo, atualizando o scan a cada resposta — no mesmo formato do polling já usado em `LeadGbpProfileCard`, com teto de tempo para evitar laço infinito.
- [ ] Renderizar progresso como `processed` de `total`, o mapa e as três métricas de `gbpGridMetrics`.
- [ ] Em `partial` ou `failed`, exibir a mensagem do scan e um botão de retomar que chama o poll de novo — nunca um botão que reinicie a malha do zero.

### Task 10: Revisão estrutural sem execução automatizada

**Files:**
- Review: todos os arquivos alterados nesta entrega

- [ ] Conferir que nenhum caminho reprocessa ponto já `done`, inclusive no retry e no `partial`.
- [ ] Conferir que a cota é verificada apenas em `start-gbp-grid-scan` e nunca dentro do laço do poll.
- [ ] Conferir que `LeadGbpGridScan`, `GbpGridPoint` e as actions usam os mesmos nomes de campo em todos os pontos.
- [ ] Conferir que a chamada existente `fetchSerpApiMapsRank` continua produzindo `@lat,lng,17z`, sem alteração de comportamento.
- [ ] Conferir que as quatro políticas RLS existem na tabela nova e espelham as de `lead_website_audits`.
- [ ] Conferir que o índice único parcial impede um segundo scan `queued`/`running` para o mesmo perfil e keyword.
- [ ] Registrar que não foram executados testes, build, lint, typecheck ou Git por instrução do repositório.
