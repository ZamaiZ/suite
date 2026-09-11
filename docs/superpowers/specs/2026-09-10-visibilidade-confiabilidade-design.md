# Visibilidade — Confiabilidade dos Dados — Design

## Objetivo

Fazer a etapa de visibilidade **afirmar apenas o que o dado sustenta**.

Não é redesenho visual, não é keyword research e não é troca de provider. É
corrigir três campos que hoje mentem, expor a idade do índice, e passar a ler o
que já é pago e descartado.

## O que motivou

A primeira coleta real do `ranked_keywords` — registrada em
`../../auditoria/2026-09-10-onda0-visibilidade.md`, quatro chamadas, US$ 0,1008 —
mostrou que a **forma** suposta pelo mapeador estava certa e o **conteúdo**
exibido não estava:

1. **A URL grava `relative_url` e descarta `url`.** Em `buscaorganica.com.br`,
   **77 das 110** keywords ranqueiam em `aprov.buscaorganica.com.br`, um
   subdomínio de homologação. O caminho salvo apaga o host, e `isHomepageUrl`
   reconstrói uma URL que **não existe**.
2. **KD 0 em 98 das 110, e `null` em zero.** O endpoint dedicado
   `bulk_keyword_difficulty` devolve **os mesmos 98 zeros** (1 divergência em
   110). A DataForSEO usa `0` como "não sei" nesta base — e a tela imprimia
   `0%`, transformando um índice num percentual.
3. **Intent como letra seca.** Um terço das classificações tem probabilidade
   abaixo de 0,60, e a fonte dedicada discorda da embutida em 23% dos casos.
4. **A idade do índice nunca esteve na tela.** A posição exibida tem mediana de
   **59 dias** e máximo de **108**; o intent, **133 dias**. O cabeçalho carimba
   `fetched_at` — a hora do clique — como se fosse a hora da medida.

## Decisões aprovadas

- **URL completa, sempre.** Grava `url`, `domain` (host) e `main_domain`
  (registrável). O caminho vira derivação de exibição. `serp_item.subdomain` é
  **ignorado** — veio `null` nas 110 linhas.
- **Nada de `bulk_keyword_difficulty`.** Medido e reprovado. `0` passa a ser
  lido como ausência, e a dificuldade é contada por `competition_level` do
  Google Ads e por `avg_backlinks_info.referring_domains` do top-10 — ambos já
  pagos na chamada atual.
- **Intent pela fonte dedicada, com probabilidade.** `search_intent/live`
  cobrindo **todas** as keywords devolvidas (até 1.000). A tela cala abaixo do
  limiar em vez de chutar.
- **`limit: 1000`.** O Labs cobra por linha **devolvida**, não pedida: subir o
  teto não custa nada num domínio pequeno e paga só onde há dado.
- **Idade na tela, por linha e no cabeçalho.** "Coletado em" deixa de ser
  confundido com "índice de".
- **Host não-canônico vira achado.** Quebra por host nas métricas **e** gap
  novo, com a oportunidade correspondente entrando no diagnóstico.
- **`item_types` ampliado** para `organic`, `local_pack` e
  `ai_overview_reference`. Medido: `metrics.organic` é idêntico com ou sem a
  ampliação, então a semântica dos buckets não muda; a seção de um tipo não
  pedido volta `null`, e passa a vir preenchida. Custo igual, porque se paga
  por linha devolvida.
- **Custo propagado**, como `lead_gbp_grid_scans.cost_usd` já faz.

## Fora de escopo

- **Bater com Ubersuggest, Semrush ou Ahrefs.** Índices e modelos são
  proprietários; divergência entre vendors é o comportamento normal, não o
  defeito. O que se corrige é o nosso jeito de afirmar.
- **Segundo provider para cruzamento.** Dobra custo e cria a pergunta de quem
  ganha o desempate. Se voltar, é outra spec.
- **Concorrentes orgânicos** (`competitors_domain/live`) — chamada nova,
  escopo novo.
- **Redesenho visual da etapa.** As mudanças de tela aqui são as exigidas pelos
  campos novos; a repaginação é trabalho separado.
- **LLM.** Continua valendo a decisão do Report 0.

## Arquitetura

### Procedência num lugar só

Hoje `location_name`/`language_code` são literais em **dois** arquivos: o
request em `ranked-keywords.ts` e o eco em `visibility-labs-map.ts`. Mudar um
faz o snapshot mentir sobre a própria origem.

```ts
// lib/dataforseo/limits.ts — puro, sem imports, os dois lados leem daqui
export const VISIBILITY_QUERY = {
  locationName: "Brazil",
  languageCode: "pt",
} as const
export const RANKED_KEYWORDS_LIMIT = 1000
export const VISIBILITY_ITEM_TYPES = [
  "organic",
  "local_pack",
  "ai_overview_reference",
] as const
```

O mapeador passa a **receber** a procedência em vez de repeti-la.

### Coleta: duas chamadas, e a segunda pode falhar sozinha

`lib/dataforseo/ranked-keywords.ts` deixa de ser um `fetch` e vira um coletor de
duas etapas:

1. `ranked_keywords/live` com `limit`, `item_types` e `order_by` das constantes.
2. `search_intent/live` com as keywords **desduplicadas** devolvidas pela
   primeira, mesmo `language_code`.

**Degradação graciosa é regra, não exceção.** Se a segunda chamada falhar, o
snapshot sai com `intent: null` em todas as linhas e a tela diz "intenção não
coletada". A etapa **não** falha — a visibilidade orgânica é útil sem intent, e
derrubar a coleta inteira por causa do campo mais fraco seria trocar dado por
nada.

Ambas propagam `cost`; a soma vai para o snapshot.

### O formato do snapshot — v2

O `VisibilityKeywordRow` atual tem sete campos frouxos onde medida e estimativa
se confundem. A v2 separa, e cada grupo carrega a própria procedência:

```ts
/**
 * Tudo anulável menos `path`, e por um motivo só: o snapshot v1 gravou apenas o
 * caminho. O tipo precisa comportar a linha antiga sem inventar host — inventar
 * host é exatamente o defeito que esta spec corrige.
 */
export type VisibilityUrl = {
  full: string | null          // https://aprov.x.com.br/a/b ← serp_item.url
  host: string | null          // aprov.x.com.br             ← serp_item.domain
  mainDomain: string | null    // x.com.br                   ← serp_item.main_domain
  path: string                 // /a/b                       ← derivado de full
  isCanonicalHost: boolean | null
}

export type VisibilityDifficulty = {
  /** `0` da API vira `null`: naquela base, zero é ausência. */
  index: number | null
  adsCompetition: "LOW" | "MEDIUM" | "HIGH" | null
  adsCompetitionScore: number | null          // keyword_info.competition
  topTenReferringDomains: number | null       // avg_backlinks_info
}

export type VisibilityIntent = {
  label: "informational" | "navigational" | "commercial" | "transactional"
  /** `null` só na linha v1, que não tinha o dado. Ver Compatibilidade. */
  probability: number | null
  secondary: Array<{ label: string; probability: number }>
  updatedAt: string | null
}

export type VisibilityKeywordRow = {
  keyword: string
  url: VisibilityUrl | null
  position: {
    value: number | null
    previous: number | null                   // rank_changes
    updatedAt: string | null                  // serp_info.last_updated_time
  }
  volume: { value: number | null; updatedAt: string | null }
  traffic: number | null                      // cliques estimados/mês
  difficulty: VisibilityDifficulty
  intent: VisibilityIntent | null
  serpFeatures: string[]                      // serp_info.serp_item_types
  languageMismatch: boolean                   // is_another_language
  itemType: "organic" | "local_pack" | "ai_overview_reference"
}
```

No nível do snapshot:

```ts
export type VisibilitySnapshot = {
  version: 2
  source: VisibilitySource
  domain: string
  locationLabel: string
  languageCode: string
  collectedAt: string
  searchCount: number
  /** Quantas linhas vieram, de quantas existem, e se ficou faltando. */
  coverage: { returned: number; total: number | null; truncated: boolean }
  /** A quebra que revelou o subdomínio de homologação. */
  hosts: Array<{
    host: string
    keywords: number
    traffic: number
    isCanonical: boolean
  }>
  indexAge: {
    serpMedianDays: number
    serpMaxDays: number
    volumeMedianDays: number | null
    intentMedianDays: number | null
  } | null
  costUsd: number | null
  /** Linhas que o leitor descartou. Hoje somem em silêncio. */
  droppedRows: number
  metrics: VisibilityMetrics                  // organic, como hoje
  localPack: VisibilityTypeMetrics | null     // metrics.local_pack
  aiOverview: VisibilityTypeMetrics | null    // metrics.ai_overview_reference
  keywords: VisibilityKeywordRow[]
}

/**
 * As seções não-orgânicas de `metrics`. Só contagem e tráfego: os buckets de
 * posição não fazem sentido em `local_pack` nem em `ai_overview_reference`, e
 * as duas seções vieram zeradas na única medição — o mínimo é o honesto.
 */
export type VisibilityTypeMetrics = {
  count: number | null
  estimatedTraffic: number | null
}
```

**`keywordCount` e `positionBuckets` param de ter dois significados.** Hoje eles
são o footprint quando `metrics.organic` existe e a amostra quando não existe, e
nada distingue os dois — enquanto `sampleCoversFootprint` depende exatamente
dessa distinção. Na v2 `metrics` é **sempre** o footprint (a medição confirmou
que `metrics.organic` vem independente de `item_types` e de `limit`), e a cobertura da
amostra é `coverage`. O fallback por amostra desaparece: sem `metrics.organic`,
os campos ficam `null`.

### Compatibilidade — o histórico não pode sumir

Mesmo princípio de `serpapi_organic`: **o leitor tolera o passado, o escritor só
produz o presente.** `readVisibilitySnapshot` detecta a ausência de `version` e
normaliza o v1 para a forma v2, preenchendo com `null` o que não existia:

- `url: string` vira `{ full: null, host: null, mainDomain: null, path: <string>, isCanonicalHost: null }`
- `difficulty: number` vira `{ index, adsCompetition: null, … }`. **A regra do
  zero não é aplicada retroativamente**: no v1 aquele `0` pode ter vindo da API
  ou de uma linha sem o campo, e converter às cegas trocaria um dado duvidoso
  por outro. Ele continua exibido como veio, sob a marca de snapshot antigo.
- `intent: string` vira `{ label, probability: null, secondary: [], updatedAt: null }`,
  e por não ter probabilidade **escapa do limiar** — a linha v1 mostra o rótulo
  que tinha, marcada como antiga, em vez de virar `—` de repente
- `coverage`, `hosts`, `indexAge`, `costUsd` ficam `null`

A tela marca a fronteira, como o `impedimentos-dataforseo.md` já exige para os
snapshots do SerpAPI. Snapshot antigo continua legível e continua **não
comparável**.

### As regras de gap

- **`isHomepageUrl` para de inventar host.** Passa a receber `VisibilityUrl` e a
  decidir por `path === "/"` **e** `isCanonicalHost`. Sem `url.host` (linha v1),
  cai no comportamento de hoje.
- **A guarda de cobertura vale para os três gaps.** Hoje só `no_local_top20`
  verifica se a amostra cobre o footprint. `homepage_only` e
  `brand_only_visibility` rodam sobre uma amostra **ordenada por tráfego** — o
  que enviesa `homepage_only` a disparar, porque a home costuma liderar o ETV.
  Os três passam a consultar `coverage.truncated`.
- **Gap novo: `non_canonical_host_traffic`.** Dispara quando algum host
  não-canônico responde por ≥ `VISIBILITY_NON_CANONICAL_SHARE` das keywords **ou**
  do tráfego. Impacto `high` — é perda de autoridade e de atribuição, e no lead
  medido são 77 keywords e 119 cliques/mês.

```
VISIBILITY_GAP_LABELS.non_canonical_host_traffic
  = "Tráfego orgânico fora do host principal"
OPPORTUNITY_TITLES.non_canonical_host_traffic
  = "Consolidar o tráfego no domínio principal"
```

O gap entra em `overviewIds`, em `HIGH_IMPACT` e, por
`mergeVisibilityOpportunities`, chega sozinho ao score do pilar, ao roadmap e ao
PDF — sem tocar em `diagnosis-compile.ts`.

### A tela

`LeadVisibilityKeywordsTable` — as colunas que mentem passam a calar:

| coluna | hoje | v2 |
|---|---|---|
| KD | `0%` | `index ?? "—"`, **sem `%`**, com chip `LOW/MED/HIGH` do Ads ao lado |
| Intenção | letra `T`/`C`/`I`/`N` | rótulo por extenso; `—` abaixo do limiar; `title` com probabilidade e secundárias |
| URL | `/polyban.com.br/produtos` | caminho, **prefixado pelo host quando não-canônico**; link e `title` com a URL completa |
| Tráfego | `118,6` | `118,6 cliques/mês` |
| Pos. | `1` | `1`, com a data do índice; linha esmaecida acima de `VISIBILITY_STALE_SERP_DAYS` |

`LeadVisibilityStepHeader` separa **"Coletado em"** de **"Índice de"** (mediana
de `serpMedianDays`), e diz o custo da coleta.

`LeadVisibilitySummaryCards` ganha um card de **hosts** quando `hosts.length > 1`,
e "Custo tráfego" vira `US$/mês`.

A tabela declara a cobertura: `"110 de 110"`, ou `"1.000 de 4.312 · por tráfego"`
quando truncada. E `droppedRows > 0` aparece como aviso — hoje some.

### Constantes nomeadas

```ts
RANKED_KEYWORDS_LIMIT = 1000              // lib/dataforseo/limits.ts
VISIBILITY_INTENT_MIN_PROBABILITY = 0.6   // 36 das 110 medidas ficam abaixo
VISIBILITY_STALE_SERP_DAYS = 90           // mediana medida foi 59, máximo 108
VISIBILITY_NON_CANONICAL_SHARE = 0.2
```

### Testes

`package.json` já tem `node --test "lib/**/*.test.mjs"`, e os módulos de
`lib/leads/` importam com extensão `.ts` — o type-stripping do Node 22 carrega
os `.ts` direto. **Verificado nesta sessão.**

O mapeador ganha teste com **fixture de payload real**, tirado de
`docs/auditoria/evidencias/2026-09-10-visibilidade/`. É o que impede a próxima
suposição de forma de sobreviver seis meses sem execução:

- `aprov.buscaorganica.com.br` sai com `host` e `isCanonicalHost: false`
- `keyword_difficulty: 0` vira `index: null`; `40` continua `40`
- `subdomain: null` não é usado para nada
- `metrics` sai do footprint mesmo com `coverage.truncated`
- snapshot v1 atravessa `readVisibilitySnapshot` sem perder linha

## Arquivos previstos

| arquivo | mudança |
|---|---|
| `lib/dataforseo/limits.ts` | `VISIBILITY_QUERY`, `VISIBILITY_ITEM_TYPES`, limite 1.000 |
| `lib/dataforseo/ranked-keywords.ts` | duas chamadas, degradação graciosa, `cost` |
| `lib/dataforseo/search-intent.ts` | **novo** — cliente do `search_intent/live` |
| `lib/leads/visibility-audit.ts` | tipos v2, leitor tolerante a v1, gap novo, `isHomepageUrl` |
| `lib/leads/visibility-labs-map.ts` | URL completa, regra do zero, idade, hosts, cobertura |
| `lib/leads/visibility-labs-map.test.mjs` | **novo** — fixture real |
| `lib/leads/visibility-presenters.ts` | rótulo de intenção com limiar, formatadores com unidade |
| `lib/leads/visibility-opportunities.ts` | título e impacto do gap novo |
| `app/actions/leads/analyze-visibility.ts` | grava `costUsd`; sem mudança de schema no banco |
| `components/custom/LeadVisibilityPanel/*` | colunas, cabeçalho, cards, cobertura |

**Sem migração de banco.** `snapshot` é `jsonb` e a tabela já é append-only
desde `20260917000000_lead_audit_versioning.sql`.

## Critérios de aceitação

1. Uma coleta em `buscaorganica.com.br` grava as 110 linhas com `url.full`
   absoluta, e `hosts` mostra `www` e `aprov` separados.
2. Nenhuma célula de dificuldade exibe `%`, e as 98 de KD zero exibem `—`.
3. Numa coleta v2, nenhuma célula de intenção exibe rótulo com probabilidade
   < 0,60 — nas 110 medidas, 36 caem para `—`.
4. O cabeçalho mostra "Índice de ~59 dias" e "Coletado em" separados, com o
   custo da coleta.
5. `non_canonical_host_traffic` dispara nesse lead e aparece como oportunidade
   no PDF do diagnóstico.
6. Um snapshot v1 gravado antes da mudança continua abrindo, com as colunas
   novas em `—` e a fronteira marcada na tela.
7. `pnpm test` e `pnpm lint` passam.

## O que continua não medido

`local_pack` e `ai_overview_reference` vieram **zerados** neste domínio, então a
forma de `serp_item` para esses dois tipos **não foi observada**. O mapeador
nasce defensivo neles, e **o primeiro lead que os tiver é a validação** — que é
exatamente o erro que esta onda veio corrigir, se for esquecido.
