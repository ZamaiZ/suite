# Presença em IA — Design

> **Revisada em 2026-09-11, depois da onda 0.** A versão original foi escrita
> contra a **documentação** do provider. A onda 0 rodou contra **payload real**
> — 19 chamadas, US$ 0,51 — e mudou cinco decisões desta spec: a via de
> citações, o corpo da requisição da sondagem, o custo, a leitura de
> `annotations` e o que conta como execução. As seções afetadas trazem o marcador
> **↻ onda 0**. Evidência e vereditos em
> `docs/auditoria/2026-09-10-onda0-presenca-em-ia.md`.
>
> A lição atravessa a spec inteira: **onde a documentação e o payload
> discordaram, o payload ganhou em todos os casos.** Nenhuma das cinco correções
> era descobrível sem gastar.

## Objetivo

Adicionar uma **sexta etapa** à auditoria de lead que meça o status do negócio
diante dos motores generativos: se as LLMs conseguem **ler** o site, se o
conteúdo dá a elas o que precisam para **citar**, se as fontes que elas citam
**apontam** para o lead, e se o lead **aparece** quando alguém pergunta a elas
por um fornecedor.

A etapa é determinística e **destrava o Diagnóstico**, como as quatro
anteriores.

A LLM é **objeto de medição, nunca instrumento de análise**. Nada nesta spec
pede opinião a um modelo sobre o conteúdo do lead.

## O que motivou

Um relatório de referência — GEO Audit de `puroclean.com` — foi lido check a
check contra o que a auditoria de lead já coleta. O resultado surpreendeu na
direção boa:

| Seção da referência | Já coletado |
|---|---|
| On-Page SEO | **7 de 7** |
| LLM Accessibility | **6 de 7** |
| LLM Content Analysis | 3 de 8 |
| Citations | 0 de 3 |
| AI Search Rankings | **pago e gravado, nunca exibido** |
| Prompt Visibility | 0 |

Dois terços do relatório já está no banco. `AI_USER_AGENTS` já carrega doze
agentes de IA com bloqueio avaliado por agente; `llmsTxt` já tem `found` e
`status`; `x-robots-tag` já é interpretado em `headerBlocksIndexing`;
`schemaTypes` já reconhece `faqpage`; os headings H1–H6 já são gravados
ordenados. E `VISIBILITY_ITEM_TYPES` já pede `ai_overview_reference` desde a
onda 0 da visibilidade — as linhas de citação em AI Overview **já são pagas e
gravadas**, e nenhum leitor as procura.

O que falta é uma etapa que **leia** o que já existe sob o vocabulário certo,
mais duas chamadas baratas e uma sondagem opcional.

## Restrições medidas no payload do provider — ↻ onda 0

A versão original desta seção tinha três fatos lidos na documentação. **Dois
sobreviveram à medição e um estava errado pela metade.**

1. ~~O dataset de menções em ChatGPT é EUA e inglês, e só~~ → **a trava é da
   plataforma `chat_gpt`, não do produto `llm_mentions`.** Continua verdadeiro
   que `brand_entities` e `top_mentioned_brands` só trazem dado de marca para
   `platform: chat_gpt`, que é EUA/inglês. **Mas `platform: google` (AI Overview)
   não carrega a trava**, e a medição confirmou Brasil (`location_code: 2076`)
   com `pt` entre 94 locations — e, mais importante, **dado real para um lead
   brasileiro**: `total_count: 7` para `buscaorganica.com.br`, contra 3.150 do
   controle americano. Descartar `llm_mentions` inteiro teria custado à etapa a
   única via que mede citação de verdade.
2. **`ai_keyword_data/keywords_search_volume/live` suporta Brasil e português** —
   confirmado no payload. 110 de 110 keywords devolvidas, **61 com
   `ai_search_volume` positivo**, zero nulos, doze meses de
   `ai_monthly_searches` em todas. E o volume de IA **não é fração do orgânico**:
   `sanitarios` deu 12.559 em IA contra 5.400 no Google, e `banheiro químicos`
   deu 234 contra 18.100. Não se deriva um do outro, e é isso que torna o número
   útil.
3. **`llm_responses/live` é a via BR** — com três ressalvas que só o payload
   contou, todas na seção de Prompt set.

**A quarta restrição, que não estava aqui e decide a onda 2:** a via de citação
por backlink **não funciona**. Cinco chamadas com três formas de filtro contra um
domínio que tem dez links provados em Reddit e YouTube deram `total_count: 0` nas
três; sem filtro, o mesmo domínio devolve 4.927 domínios de referência, nenhum
deles Reddit, YouTube ou Wikipedia. O índice funciona e simplesmente não tem
essas fontes.

## Decisões aprovadas

- **Etapa própria, entre Visibilidade e Diagnóstico.** Rótulo **"Presença em
  IA"**, não "GEO" — as outras cinco etapas são em português direto, e o lead lê
  o documento. A sigla aparece no corpo do PDF, onde há espaço para explicá-la.
- **A etapa destrava o Diagnóstico**, e o critério é a **coleta
  determinística**, não a sondagem. Precedente da casa: o Website destrava com o
  crawl; PageSpeed e backlinks, que são pagos e opcionais, não destravam.
- **Duas velocidades.** A base roda com zero a duas chamadas baratas. A sondagem
  em LLM é um segundo botão, com teto configurável e custo real acumulado na
  linha — o padrão live/fila da malha geográfica.
- **Nenhuma extração por LLM.** `annotations` já devolve domínio e título de cada
  fonte sem interpretação. A marca em texto casa contra três listas já pagas: o
  nome do lead e variantes, os concorrentes da malha (`gbp-grid-competitors`) e
  os de `/backlinks/competitors/live`. **Marca fora dessas listas fica não
  detectada, e a tela diz isso** — em vez de afirmar dominância sobre um
  universo que não foi medido.
- **Três checks de conteúdo ficam com o analista** — definição de entidade,
  citabilidade e autoridade — no padrão da onda 5: jsonb fora do snapshot
  append-only, e **campo em branco não gera gap**.
- **Prompt set fixado na primeira sondagem**, em `lead_geo_reviews.prompt_set`,
  pelo mesmo motivo que `audit_paths` fixou a amostra de páginas: prompt que
  muda entre coletas transforma taxa de menção em número sem significado. É a
  armadilha dos "métodos divergentes na mesma série temporal" que gerou
  `maps-task.ts`.
- **Gap não conta em dois pilares.** Os checks que já geram gap no pilar
  `website` — `no_schema`, `robots_blocks_search`, `noindex`,
  `missing_sitemap`, `canonical_*` — são **exibidos** na etapa de Presença em IA
  e **não geram gap novo**. O pilar `geo` só pontua sobre gaps próprios. Sem
  isso o scorecard penaliza o mesmo defeito duas vezes e o score deixa de
  significar o que significava.
- **Percentual de renderização fica fora.** Medir percentual exige DOM
  renderizado contra HTML cru: outra seção de API e um número que o crawler
  atual não pode produzir. O que dá para afirmar é o sinal binário —
  `serverRenderedWords` na home e `content_requires_js` abaixo do piso.
  Percentual inventado seria o mesmo defeito do `` `${difficulty}%` `` que a
  onda 0 da visibilidade acabou de corrigir.
- **Preço nunca gravado no código.** `GET /appendix/user_data` é gratuito e
  devolve a tabela da própria conta.

## Fora de escopo

- **Dominância de marca pelo dataset `brand_entities`.** EUA e inglês apenas —
  confirmado, e as duas chaves vêm como array vazio em `platform: google`.
- **`multi_target_metrics` como via de dominância.** **↻ coleta real:** tentado
  em duas rodadas pagas e reprovado nas duas. Ele mede o total do domínio no
  dataset inteiro, que é outro universo — deu 67% com concorrentes de backlink e
  0,007% com concorrentes das fontes, sobre o mesmo lead. A métrica fica, por
  outra via: derivada das fontes das perguntas medidas, de graça.
- **Citação por backlink.** **↻ onda 0:** reprovada com controle positivo. Era a
  via planejada da onda 2 e não mede o que prometia.
- **LLM julgando o conteúdo do lead.** Decisão explícita, não omissão.
- **Sentimento das menções.** Mesmo motivo do sentimento de review: é campo
  humano neste projeto.
- **Percentual de renderização.** Ver acima.
- **Auditoria de GEO do cliente** (pós-conversão). A distinção lead/cliente
  registrada no handoff continua valendo; isto é auditoria de lead, pré-venda.
- **Redesenho visual.** A tela nasce no padrão das etapas existentes
  (`StepHeader` + `StepTabs` + `StepOpportunitiesRail`); repaginação é trabalho
  separado.

## Arquitetura

### Banco

Duas tabelas, na separação que a onda 5 fixou: a coleta acumula, o julgamento
não. O precedente exato é `lead_visibility_reviews`
(`20260926000000`) — julgamento por **lead**, não por canal, com `review jsonb`,
`notes`, `updated_at`, `updated_by`, índice único em `lead_id` e a checagem
`jsonb_typeof(review) = 'object'`. `lead_geo_reviews` copia essa forma e
acrescenta `prompt_set`.

```sql
-- migration 20260927000000_lead_geo_audits.sql
create table public.lead_geo_audits (
  id          uuid        primary key default gen_random_uuid(),
  lead_id     uuid        not null references public.leads(id) on delete cascade,
  domain      text        not null,
  snapshot    jsonb       not null,
  fetched_at  timestamptz not null default now(),
  fetched_by  uuid        not null references public.users(id)
);
create index lead_geo_audits_lead_recent_idx
  on public.lead_geo_audits (lead_id, fetched_at desc);

-- migration 20260928000000_lead_geo_reviews.sql
create table public.lead_geo_reviews (
  id          uuid        primary key default gen_random_uuid(),
  lead_id     uuid        not null references public.leads(id) on delete cascade,
  review      jsonb       not null default '{}'::jsonb,
  prompt_set  jsonb,
  notes       text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid        references public.users(id),
  constraint lead_geo_reviews_notes_len_chk
    check (notes is null or char_length(trim(notes)) between 1 and 2000),
  constraint lead_geo_reviews_review_obj_chk
    check (jsonb_typeof(review) = 'object')
);
create unique index lead_geo_reviews_lead_id_uidx
  on public.lead_geo_reviews (lead_id);
```

**Append-only desde o dia 1** — sem índice único por `lead_id` na tabela de
auditorias, ao contrário do que `lead_visibility_audits` precisou corrigir
depois na `20260917`.

RLS espelhando as tabelas irmãs: quatro policies `is_commercial_member()`, cada
uma precedida de `drop policy if exists`, e `revoke all ... from anon,
authenticated` antes do `grant`. Migrations reexecutáveis — a armadilha
registrada no handoff.

`prompt_set` é `null` até a primeira sondagem. **Nulo significa não fixado**,
nunca "fixado e vazio".

### Módulos

```
lib/dataforseo/ai-optimization.ts   server-only — via postDataForSeo + envelope.ts
lib/leads/geo-audit.ts              tipos, versão, leitura tolerante ao passado
lib/leads/geo-accessibility.ts      puro — as sete regras de acesso
lib/leads/geo-content.ts            puro — os cinco checks determinísticos
lib/leads/geo-citations.ts          puro — leitura de llm_mentions (↻ onda 0)
lib/leads/geo-mentions.ts           puro — comparação com concorrentes (↻ onda 0)
lib/leads/geo-prompts.ts            puro — derivação e fixação do prompt set
lib/leads/geo-prompt-visibility.ts  puro — leitura das respostas
lib/leads/geo-review.ts             puro — os três campos do analista
lib/leads/geo-opportunities.ts      gaps → oportunidades
lib/leads/geo-step-tabs.ts          abas da etapa
```

**Fronteira `server-only`, respeitada por construção.** Só
`ai-optimization.ts` a cruza. Os tetos e a contagem de prompts vão para
`lib/dataforseo/limits.ts`, que já é puro e já serve calculadora e fetcher pelos
dois lados — é exatamente o split que `usage.ts` / `user-data.ts` e
`envelope.ts` / `client.ts` já fizeram depois de quebrar o build duas vezes. A
verificação correta é **transitiva**: checar só os imports diretos não prova
nada.

### Ações

```
app/actions/leads/geo-access.ts           guard, espelhando visibility-access.ts
app/actions/leads/analyze-geo.ts          a coleta base
app/actions/leads/probe-geo-prompts.ts    a sondagem em LLM
app/actions/leads/update-geo-review.ts    julgamento do analista + prompt set
```

### Trilha e destravamento

`gbp-audit-rail.ts` ganha `"geo"` entre `"visibility"` e `"diagnosis"`;
`GbpAuditRailStepId` e `STEPS` passam a seis; `progress` divide por seis.

```ts
diagnosisUnlocked =
  google === "analyzed" && website === "analyzed" &&
  presenceComplete && visibilityFetched && geoFetched
```

**Duas retroatividades que isso cria**, porque `unlocked` é calculado ao vivo em
`LeadGbpPanel.tsx:332` e não persistido:

- **Todo lead já auditado re-tranca o Diagnóstico** até rodar Presença em IA.
  Aceito sem flag de exceção: um lead cuja auditoria não tem a etapa tem uma
  auditoria incompleta, e disfarçar isso com flag é a mesma classe de mentira
  que `emptyPillarScore()` valendo 100. Como a coleta base da onda 1 não faz
  chamada paga nova, é um clique por lead.
- **Todo rascunho de diagnóstico vira "desatualizado"** quando `geoFetchedAt`
  entra em `diagnosisFactsFingerprint`. Isso **não se mitiga**: um diagnóstico
  compilado antes da etapa existir genuinamente não tem o pilar. O stale está
  certo.

### Snapshot

```ts
type GeoSnapshot = {
  version: 1
  domain: string
  collectedAt: string
  costUsd: number | null

  // A etapa lê de outras coletas. A idade delas é dado, não detalhe:
  // carimbar collectedAt como se fosse a hora da medida foi o defeito que a
  // onda 0 da visibilidade encontrou.
  sources: {
    websiteAuditAt: string | null
    visibilityAuditAt: string | null
    backlinkAuditAt: string | null
  }

  accessibility: {
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

  content: {
    identitySchema: string[]
    hasFaqSchema: boolean
    questionHeadings: number
    headingDepth: { levels: number; skips: boolean }
    contactPoints: { phone: boolean; email: boolean; address: boolean; whatsapp: boolean }
    freshness: {
      datePublished: string | null
      dateModified: string | null
      sitemapLastmod: string | null
    }
    titleLength: number | null
    metaDescriptionLength: number | null
  }

  // ↻ onda 0 — a forma mudou com a via. Antes eram domínios de um catálogo
  // casados por backlink; agora são as fontes que a IA de fato citou, lidas de
  // `llm_mentions/search_mentions/live` com `platform: google`.
  //
  // Trocar a forma é seguro porque `citations` nunca foi gravada diferente de
  // `null`: a onda 1 não coleta, e o leitor tolerante já trata nulo.
  citations: {
    /** Fixa a procedência no próprio dado. Um segundo valor mais tarde não
     *  pode ser comparado com este sem que a tela diga que o método mudou —
     *  é a lição do `maps-task.ts`. */
    source: "llm_mentions_google"
    /** `total_count` da chamada: quantas respostas de IA citam o domínio. */
    mentions: number
    prompts: Array<{
      question: string
      aiSearchVolume: number | null
      /** `last_response_at`. A idade da menção é dado, não detalhe. */
      at: string | null
      leadCited: boolean
      sources: Array<{
        domain: string
        url: string
        title: string
        rank: number
      }>
    }>
    /** Wikipedia, Reddit e YouTube agregados — a seção do relatório de
     *  referência. Vem das `sources` acima, sem chamada extra. */
    authorityDomains: Array<{ domain: string; count: number }>
    truncated: boolean
  } | null

  // ↻ onda 0 — campo novo. Concorrência em IA por `multi_target_metrics`,
  // que é a tabela de Competitor Dominance viável para o Brasil.
  aiMentions: {
    source: "llm_mentions_google"
    targets: Array<{
      label: string
      isLead: boolean
      mentions: number
      aiSearchVolume: number | null
    }>
    /** Menções do lead ÷ menções de todos os alvos medidos. **Sobre os alvos
     *  medidos, não sobre o mercado** — e a tela diz isso. */
    share: number | null
  } | null

  aiOverview: {
    keywords: Array<{ keyword: string; url: string | null; position: number | null;
                      volume: number | null; etv: number | null }>
    count: number
    etv: number | null
  } | null

  aiDemand: {
    keywords: Array<{ keyword: string; aiSearchVolume: number | null }>
    totalAiSearchVolume: number | null
    locationLabel: string
    languageCode: string
  } | null

  promptVisibility: GeoPromptVisibility | null
}
```

**`null` significa não coletado; lista vazia significa coletado e vazio.** A
distinção aparece quatro vezes aqui e não é estilo: `promptVisibility: null` é
"não sondado", e o gap de sondagem **não existe** enquanto for nulo. Confundir
os dois foi o defeito que `fetchBacklinkSchemeLive` documenta ao recusar
devolver leitura zerada — "olhamos e está limpo" quando o que houve foi a
chamada não trazer nada.

### As dezenove regras determinísticas

**Acessibilidade — sete, seis sem uma linha de coleta nova:**

| Regra | Fonte |
|---|---|
| `llms.txt` publicado | `crawl.llmsTxt.found` / `.status` |
| Crawlers de IA liberados | `robots.aiAgents[]`, doze agentes com `blocked` por agente |
| Buscadores liberados | regra `robots_blocks_search` já existente |
| Sitemap XML | `crawl.sitemap` |
| Sem noindex na tag | `pageIsIndexable` |
| Sem noindex no header | `headerBlocksIndexing` (`x-robots-tag`) |
| Conteúdo servido no HTML | **novo**, puro sobre `wordCount` da home já gravado |

**O piso de `contentRequiresJs` é 120 palavras**, em
`GEO_SERVER_RENDERED_MIN_WORDS`. Não reusa `WEBSITE_THIN_CONTENT_WORDS = 300`
porque as duas perguntas são diferentes: 300 mede **conteúdo raso**, e aqui a
pergunta é se existe casca de SPA — que costuma entregar menos de cinquenta
palavras no HTML cru. 120 separa os dois casos sem confundir site enxuto com
site vazio.

**Conteúdo — cinco:**

| Regra | Fonte |
|---|---|
| Schema de identidade | `schemaTypes` contém `organization`, `localbusiness` ou `person` |
| FAQ / Q&A | `schemaTypes` contém `faqpage` **ou** ao menos três headings terminados em `?` |
| Estrutura | `headingsSkipLevel` + profundidade de níveis |
| Contato legível por máquina | `hasTel` / `hasMailto` / `phones` / `contactInFooterOnly` + NAP |
| Frescor | **extensão do parser** — ver abaixo |

**On-Page — sete, todos já coletados:** title (com comprimento 50–60 derivado),
meta description (120–160 derivado), H1, alt de imagem, canonical, robots e
JSON-LD.

**A armadilha que a primeira medição encontrou.** Dos cinco snapshots de
website que existiam em 2026-09-10, **três eram anteriores à coleta ampliada** —
`llmsTxt`, `robots.groups`, `robots.aiAgents`, `headings` e `variants` ausentes.
E `readWebsiteCrawl` normaliza cada ausente para vazio: `readLlmsTxt(undefined)`
devolve `{found: false, status: null}`, **indistinguível de "checamos e não
tem"**. Sem separar os dois casos, `no_llms_txt` e `no_faq_content` disparariam
em todo lead auditado antes daquela entrega, por campos que nunca foram medidos.

Por isso `sources.websiteCrawlExtended` existe, e o discriminador é `variants`:
o crawler moderno **sonda** as variantes em toda coleta, independente do que o
site publica, enquanto `groups` e `aiAgents` podem ficar legitimamente vazios
num robots.txt real. É a mesma classe de erro que `redirects: null` já documenta
em `website-audit.ts` — e é a razão de `wordCount` e `schemaTypes` continuarem
valendo nos dois casos: os dois sempre existiram.

**A única extensão de coleta é o frescor.** Hoje `schemaTypesFromJson` acumula
`@type` e **descarta os valores**; passa a extrair também `datePublished` e
`dateModified`, e `sitemap.ts` passa a guardar `lastmod`. É mudança no parser
próprio, sem chamada paga, mas **não é retroativa**: snapshot anterior não tem
os campos, e `freshness` com os três nulos significa *não coletado*, não
*ausente na página*.

### Julgamento do analista — três campos

Em `lead_geo_reviews.review`, no modelo exato de `visibility-review.ts`:
veredito `ok | issue | na`, nota livre de 400 caracteres, `updatedAt` e
`updatedBy` por critério, mais um `other` sem veredito que fica fora do
denominador do progresso. **`issue` vira o título da oportunidade**; `ok` e `na`
não geram nada.

- **Definição de entidade** — a página deixa claro que negócio ela representa?
- **Citabilidade** — há fato, número ou frase autocontida que uma LLM possa
  citar sem reescrever?
- **Autoridade e confiança** — tempo de mercado, certificação, prova social
  verificável?

**Campo em branco não gera gap.** Ausência de resposta não é ausência de
problema — regra da onda 5, literal.

### Prompt set

Quatro famílias, derivadas do que o lead já tem cadastrado — segmento
(`lib/leads/segments.ts`), cidade (`resolve-location.ts`) e nome da empresa:

1. **Descoberta** — "melhores {categoria} em {cidade}"
2. **Problema** — "{dor do segmento}, quem resolve em {cidade}?"
3. **Comparação** — "compare as principais empresas de {categoria} em {cidade}"
4. **Marca** — "a {empresa} é confiável?" · "o que é a {empresa}?"

**A família 4 sempre roda**, com seus dois prompts fixos. É a mais barata e a de
maior sinal: responde se a LLM **sabe que o lead existe**.

**O volume padrão são oito prompts**: dois por família, configurável entre um e
três nas famílias 1–3. Com quatro provedores, isso dá **trinta e duas
execuções** — o mesmo tamanho de amostra do relatório de referência, que usou
dez prompts em quatro LLMs. O teto vive em `lib/dataforseo/limits.ts`, que é
puro, para que a calculadora de custo na página de Ferramentas conte as mesmas
execuções que o fetcher vai disparar. Teto que só o fetcher conhecesse faria a
calculadora subestimar em silêncio — é a razão documentada daquele arquivo
existir.

Derivado uma vez, gravado em `lead_geo_reviews.prompt_set`, lido depois. O
analista pode editar antes da primeira sondagem; depois dela, editar cria um
`promptSetVersion` novo e a comparação entre versões **não é feita** — a tela
diz que a série reiniciou.

### O corpo da requisição é por plataforma — ↻ onda 0

**Não existe um corpo só.** Três das quatro plataformas devolveram
`40501 Invalid Field` na primeira tentativa com o mesmo corpo, cada uma apontando
para um campo diferente:

| plataforma | modelo medido | recusa |
|---|---|---|
| `chat_gpt` | `gpt-5-mini` | `max_output_tokens` |
| `claude` | `claude-haiku-4-5` | — aceitou tudo |
| `gemini` | `gemini-2.5-flash` | `web_search_country_iso_code` **e** `web_search_city` |
| `perplexity` | `sonar` | `web_search_city` |

O construtor único de requisição — que é o desenho óbvio para quatro plataformas
com o mesmo shape — **falha em três delas**. E `40501` não cobra nada, então a
falha some no custo e aparece meses depois como *"essa plataforma nunca traz
dado"*. O fetcher monta o corpo base e **remove por plataforma**, com a lista em
`lib/dataforseo/limits.ts` ao lado dos tetos, pelo mesmo motivo que os tetos moram
lá: a calculadora precisa contar as mesmas execuções.

**O `gemini` não aceita recorte geográfico nenhum.** A sondagem nele mede sem
`BR` e sem cidade. Taxa de menção comparada entre plataformas onde uma não tem o
mesmo recorte é comparação de coisas diferentes, e **a tela precisa marcar a
coluna do Gemini**.

**O modelo fica gravado por execução, e a escolha do modelo é a escolha do
custo.** `llm_responses/live` cobra a mesma taxa nas quatro — não há linha por
plataforma na tabela da conta. Toda a diferença é repasse:

| plataforma | modelo | `money_spent` | `input_tokens` |
|---|---|---|---|
| `perplexity` | `sonar` | **0,0057** | 29 |
| `chat_gpt` | `gpt-5-mini` | 0,0146 | 8.818 |
| `claude` | `claude-haiku-4-5` | 0,0238 | 10.797 |
| `gemini` | `gemini-2.5-flash` | 0,0368 | 104 |

Seis vezes de diferença entre a mais barata e a mais cara, pelo mesmo prompt.

### Métricas — ↻ onda 0

Por execução (`prompt × provedor`): `status`, `mentioned`, `position`,
`domainCited`, `brands[]`, `costUsd`, `modelName`, `at`.

**`status` é campo novo, e não é detalhe de implementação.** A medição pegou
`50301 3rd Party API Service Unavailable (rate_limit_exceeded)` em três
tentativas seguidas nos modelos `gemini-3.x`, **com custo zero**. Uma execução
que não aconteceu gravada como `mentioned: false` **inventa ausência** — é
exatamente o que `fetchBacklinkSchemeLive` recusa ao não devolver leitura
zerada. Três valores, e o denominador da taxa de menção só conta o primeiro:

```ts
status: "ok" | "provider_unavailable" | "rejected"
```

**`domainCited` sai de `annotations`, que mora em
`items[].sections[].annotations[]`** — não em `items[].annotations[]`, que é
onde a documentação a descreve. A primeira leitura desta medição usou o caminho
documentado e devolveu `annotations_count: 0` numa resposta que tinha três, todas
apontando para o domínio do lead. **Escrita a partir da documentação, a métrica
determinística da sondagem nasce zerada e silenciosa.**

**`position` é a ordem da primeira ocorrência da marca entre as marcas
detectadas** — e agora sabe-se que não havia alternativa. `start_index` /
`end_index` vêm preenchidos em `chat_gpt` e `gemini` e **`null` em `claude` e
`perplexity`**. Posição por índice de caractere não é portável entre
plataformas. A tela continua dizendo que não é posição em lista numerada.

Agregadas: taxa de menção **sobre execuções `ok`**, posição média, dominância
(menções da marca ÷ menções de todas as marcas detectadas), recorte por
provedor, e a lista de concorrentes com taxa e posição média.

**Uma execução não é uma medida.** O mesmo prompt no mesmo modelo, chamado duas
vezes, devolveu 17 `annotations` citando o lead na primeira e 31 **sem citar** na
segunda. O relatório de referência avisa disso em letra miúda; a medição
confirmou. A tela apresenta a taxa como **indicação direcional, com a data**, e
nunca como percentual estável. Fingir precisão aqui é o defeito do
`` `${difficulty}%` `` outra vez.

### Gaps — doze

Próprios do pilar, sem sobreposição com `website`:

| Id | Impacto |
|---|---|
| `ai_crawlers_blocked` | high |
| `content_requires_js` | high |
| `no_ai_overview_presence` | high |
| `no_llms_txt` | medium |
| `no_faq_content` | medium |
| `no_identity_schema` | medium |
| `no_freshness_signals` | medium |
| `no_machine_readable_contact` | medium |
| `no_authority_citations` | medium |
| `brand_unknown_to_llms` | **high, só com sondagem** |
| `absent_from_discovery_prompts` | **high, só com sondagem** |
| `outranked_by_competitors` | **medium, só com sondagem** |

`no_identity_schema` não duplica `no_schema`: um site pode ter `Product` e
`BreadcrumbList` sem nunca declarar quem é.

`no_ai_overview_presence` só dispara quando o lead **ranqueia organicamente** e
tem zero linha `ai_overview_reference` — sem isso, um domínio que não ranqueia
em lugar nenhum ganharia dois gaps pela mesma causa.

Os três últimos **não existem** enquanto `promptVisibility` for `null`.

### Pilar no diagnóstico

- `DIAGNOSIS_PILLARS` ganha `geo`; `DIAGNOSIS_PILLAR_LABELS.geo = "Presença em IA"`.
- `DiagnosisPillarScore` ganha `measured: boolean`.
- `emptyPillarScore()` deixa de afirmar 100 e passa a devolver `measured: false`.
- **Leitura tolerante:** documento salvo antes desta spec não tem `geo` em
  `scorecard`, `pillars` nem `pillarNarratives`, e não tem `measured` em pilar
  nenhum. Ausência de `geo` é lida como pilar não medido; ausência de `measured`
  vira `true`, porque os quatro pilares antigos sempre foram medidos. Reescrever
  o passado seria o erro.
- `diagnosisFactsFingerprint` ganha `geoFetchedAt`.
- **No PDF do cliente, a seção de sondagem é omitida quando não houve
  sondagem** — seção vazia num documento comercial lê como fraqueza do lead, não
  como ausência de medição nossa. Na interface, a etapa mostra "não sondado" com
  o botão ao lado.

### Custo — ↻ onda 0, medido

Os números abaixo saíram da tabela da própria conta e das 19 chamadas da onda 0,
não de estimativa.

| Coleta | Chamadas | Custo por lead |
|---|---|---|
| Base, onda 1 | zero | **US$ 0,00** |
| Demanda em IA, onda 2 | `ai_keyword_data` × 1 | **US$ 0,021** |
| Citações + concorrência, onda 2 | `llm_mentions` × **1** | **US$ 0,107** |
| Sondagem, onda 3 | 8 prompts × 4 provedores | **≈ US$ 0,65** |

**A ordem que a spec original supunha estava invertida.** A onda 2 era "duas
chamadas baratas" e a sondagem era a cara. Medido:

- `ai_keyword_data` custa **US$ 0,021** pelas mesmas 110 keywords — **mais barato
  que o `ranked_keywords` que a etapa de visibilidade já paga** (US$ 0,0252).
  Não é chamada paga a mais; é a chamada mais barata da auditoria inteira.
- `llm_mentions` custa **US$ 0,10 por requisição** + US$ 0,001 por linha. Oito
  vezes o Labs, antes de contar linha. **É o item caro, e é o único.**

**A onda 2b virou UMA chamada — ↻ coleta real de 2026-09-11.**
`search_mentions` traz as perguntas com as fontes de cada resposta, e disso sai
tudo: quantas respostas citam o lead, o que a IA lê no mercado dele, e a
comparação com quem aparece ao lado.

**`multi_target_metrics` foi tentado e reprovado**, depois de duas rodadas pagas.
Ele mede o total de cada domínio **no dataset inteiro**, não nas respostas do
lead: trouxe `mobills.com.br` com 17.919 menções contra as 2 do lead, e o
percentual virou 0,007%. Antes disso, com concorrentes de backlink, tinha dado
67%. Os dois números errados pela mesma causa — universo errado.

A conta derivada das fontes das perguntas medidas dá **10,6%** para aquele lead,
que é a ordem de grandeza dos **9%** do relatório de referência para a PuroClean,
medida do mesmo jeito. Seção 14 de
`docs/auditoria/2026-09-10-onda0-presenca-em-ia.md`.
- A sondagem tem taxa de US$ 0,0006 e **repasse do modelo 34× maior que a
  taxa**. US$ 0,0808 por prompt nas quatro plataformas.

**As variantes `_lite` de `llm_mentions` não são mais baratas** — cobram
exatamente o mesmo, 0,10 + 0,001. "Lite" ali é funcionalidade reduzida, não
preço. Escolher a lite para economizar perderia campo sem ganhar nada.

**Consequência de desenho, não de orçamento:** a US$ 0,22 e US$ 0,65 por lead,
**nem a onda 2 nem a onda 3 entram na coleta base.** Cada uma é um botão pago
próprio, com custo real somado na linha — o padrão da malha geográfica. A coleta
base continua a US$ 0,00 e continua sendo o que destrava o Diagnóstico.

**A tabela da conta é piso, não orçamento.** `usage.ts` registra isso desde que o
SERP cobrou US$ 0,01 onde a tabela dizia 0,002, e vale aqui em cheio: o repasse
do LLM não aparece na tabela e só existe em `money_spent`.

**A assinatura é coisa diferente do preço.** `user_data` devolve
`llm_mentions_subscription_expiry_date` — campo próprio, separado do saldo, hoje
em `2050-01-01`. A tabela diz quanto custa; a assinatura diz se pode chamar.
`usage.ts` **não lê nenhum dos dois campos de expiração**, e assinatura vencida
viraria "não foi possível coletar" sem motivo na tela.

## Onda 0 — as perguntas que só o payload responde ✅

**Rodou em 2026-09-10/11. 19 chamadas, US$ 0,51. As nove respondidas.** Relatório
completo, com os dois erros de leitura que a medição pegou, em
`docs/auditoria/2026-09-10-onda0-presenca-em-ia.md`; scripts e payloads
recortados em `docs/auditoria/evidencias/2026-09-10-presenca-em-ia/`.

| # | pergunta | veredito |
|---|---|---|
| 1 | `ai_optimization` na conta? | **sim**, 61 linhas de preço + assinatura ativa |
| 2 | Brasil/`pt` em `llm_mentions`? | **sim**, 94 locations |
| 3 | `ai_search_volume` em português? | **sim**, 61 de 110 positivas |
| 4 | `annotations` em BR, e a que custo? | **sim**, nas quatro plataformas |
| 5 | forma do `ai_overview_reference`? | **observada**, 17 campos |
| 6 | modelos por plataforma? | **listados**, e o preço é o repasse |
| 7 | `llm_mentions` tem negócio BR? | **sim**, `total_count: 7` no lead |
| 8 | backlink casa o catálogo? | **não** — reprovado com controle |
| 9 | o zero de AI Overview do lead é real? | **sim** — controle cheio, lead vazio |

**O que a onda 0 salvou.** Sem ela, a onda 2 teria sido construída sobre a via de
backlink — que não encontra nada mesmo quando a citação existe — e a onda 3
teria lido `annotations` no caminho documentado, gravando zero em toda execução.
Nenhum dos dois defeitos falharia ruidosamente: os dois apareceriam como "o lead
não tem presença em IA".

O texto original das cinco perguntas fica abaixo, como registro do que se
perguntava antes de medir.

1. **`GET /appendix/user_data` — a conta tem a seção `ai_optimization`
   liberada, e a que preço?** A evidência de 2026-09-10 registrou
   `labs_prices_raw_keys` e só listou `dataforseo_labs`. Grátis.
2. **`llm_mentions/locations_and_languages`** — Brasil e `pt` estão entre as 92
   locations para `platform: google`?
3. **`ai_keyword_data/keywords_search_volume/live`** com as 110 keywords de
   `buscaorganica.com.br` — `ai_search_volume` vem preenchido em português, ou
   vem zero como o KD veio? Esta é a pergunta que decide se a onda 2 existe.
4. **Um `llm_responses/live` por provedor**, com `web_search_country_iso_code:
   "BR"` e a cidade — `annotations` chegam preenchidas? Qual o `money_spent`
   real? Que modelos `models` lista?
5. **`/backlinks/backlinks/live` com `filters` `in`** sobre `domain_from` no
   catálogo — `pt.wikipedia.org` casa por sufixo, como o casamento dos
   diretórios fazia?

Evidência em `docs/auditoria/evidencias/{data-da-sondagem}-presenca-em-ia/`, com
os scripts que reproduzem a medição, no formato da onda 0 da visibilidade — que
não versionou os payloads crus de 840 KB e regerou tudo pelos scripts.

## Ondas

↻ onda 0 — a 2 virou duas ondas, porque as duas metades têm preço de ordem
diferente e botão diferente.

| Onda | Entrega | Custo por lead | Estado |
|---|---|---|---|
| **0** | As nove perguntas, com evidência versionada | US$ 0,51 uma vez | ✅ **feita** |
| **1** | A etapa inteira determinística: tabelas, trilha, painel, as dezenove regras, os três do analista, **o pilar, o `measured` e o destravamento** | **zero** | ✅ **feita** |
| **2a** | Demanda em IA — `ai_keyword_data` | US$ 0,021 | a fazer |
| **2b** | Citações e concorrência — `llm_mentions`, botão pago próprio | ≈ US$ 0,22 | a fazer |
| **3** | A sondagem em LLM: prompt set fixado, corpo por plataforma, botão separado com custo visível | ≈ US$ 0,65 | a fazer |
| **4** | Narrativa do pilar e seção no PDF | zero | a fazer |

**A 2a entra junto da coleta base, a 2b não.** US$ 0,021 é ruído ao lado do que
a auditoria já gasta por lead; US$ 0,22 não é. Separá-las é o que mantém o
"rodar a etapa custa zero" verdadeiro — e ele precisa continuar verdadeiro,
porque é a coleta base que destrava o Diagnóstico.

**O pilar e o destravamento saem na onda 1, não no fim.** Se a etapa destrava o
Diagnóstico mas não tem pilar, o documento fica devendo exatamente a seção que
acabou de virar pré-requisito.

**A onda 1 é retroativa a todo lead já auditado** — ela lê snapshots que já
existem, então rodar a etapa num lead antigo devolve resultado real, não vazio.
As exceções são `freshness`, que depende da extensão do parser, e
`contentRequiresJs`, que depende de `wordCount` da home ter sido gravado.

## Arquivos previstos

**Migrations**

```
supabase/migrations/20260927000000_lead_geo_audits.sql
supabase/migrations/20260928000000_lead_geo_reviews.sql
```

`20260926000000` já está ocupado por `lead_visibility_reviews`.

**Novos**

```
lib/dataforseo/ai-optimization.ts
lib/leads/geo-audit.ts
lib/leads/geo-accessibility.ts
lib/leads/geo-content.ts
lib/leads/geo-citations.ts
lib/leads/geo-mentions.ts            ↻ onda 0 — concorrência em IA
lib/leads/geo-prompts.ts
lib/leads/geo-prompt-visibility.ts
lib/leads/geo-review.ts
lib/leads/geo-opportunities.ts
lib/leads/geo-step-tabs.ts
lib/validations/lead-geo.ts
app/actions/leads/geo-access.ts
app/actions/leads/analyze-geo.ts
app/actions/leads/collect-geo-mentions.ts   ↻ onda 0 — o botão pago da 2b
app/actions/leads/probe-geo-prompts.ts
app/actions/leads/update-geo-review.ts
components/custom/LeadGeoPanel/LeadGeoPanel.tsx
components/custom/LeadGeoPanel/LeadGeoPanel.types.ts
components/custom/LeadGeoPanel/LeadGeoView.tsx
components/custom/LeadGeoPanel/LeadGeoStepHeader.tsx
components/custom/LeadGeoPanel/LeadGeoIdentityCell.tsx
components/custom/LeadGeoPanel/LeadGeoMetricCells.tsx
components/custom/LeadGeoPanel/LeadGeoTabPanels.tsx
components/custom/LeadGeoPanel/use-geo-controller.ts
components/custom/LeadGeoPanel/index.ts
```

**Alterados**

```
lib/leads/gbp-audit-rail.ts          sexta etapa, destravamento, progresso
lib/leads/diagnosis-document.ts      pilar geo, measured, leitura tolerante
lib/leads/diagnosis-compile.ts       pilar geo no scorecard e no roadmap
lib/leads/diagnosis-themes.ts        temas que cruzam geo com website
lib/leads/diagnosis-pdf.tsx          seção do pilar, sondagem omitida se ausente
lib/dataforseo/limits.ts             tetos de prompt e catálogo de citações
lib/website-audit/parse.ts           datePublished / dateModified do JSON-LD
lib/website-audit/sitemap.ts         lastmod
app/actions/leads/get-lead.ts        embed de geoAudit e geoReview
app/actions/leads/index.ts           reexports
components/custom/LeadGbpPanel/LeadGbpPanel.tsx       roteamento da etapa
components/custom/LeadGbpPanel/LeadGbpAuditRail.tsx   rótulo e estado
components/custom/LeadDetailDialog/LeadDetailDialog.types.ts   tipos do detalhe
```

## Critérios de aceitação

1. A trilha mostra seis etapas, e **Presença em IA** aparece entre Visibilidade
   e Diagnóstico.
2. Um lead com auditoria completa mas sem Presença em IA mostra o Diagnóstico
   **trancado**, com o motivo na trilha.
3. Rodar a coleta base num lead auditado antes desta spec devolve as dezenove
   regras preenchidas a partir dos snapshots existentes, **sem nenhuma chamada
   paga**.
4. Os checks que já geram gap no pilar `website` aparecem na tela da nova etapa
   e **não** aparecem na lista de oportunidades dela.
5. Abrir um lead com snapshot de website anterior à extensão do parser mostra
   frescor como **não coletado**, nunca como ausente.
6. Sem sondagem, `promptVisibility` é `null`, os três gaps de sondagem **não
   existem**, e a seção some do PDF.
7. Após a primeira sondagem, `lead_geo_reviews.prompt_set` está gravado, e a
   segunda sondagem **reusa** o mesmo conjunto.
8. O custo real de cada sondagem aparece na linha, somado de `money_spent`.
9. Um documento de diagnóstico salvo antes desta spec **abre sem erro**, com o
   pilar `geo` lido como não medido.
10. Nenhum módulo `server-only` é alcançável a partir de componente de cliente
    — verificado **transitivamente**, não pelos imports diretos.

## O que continua não medido

- **Percentual de renderização.** Só o sinal binário. Percentual exige DOM
  renderizado.
- **Dominância de marca em ChatGPT.** EUA e inglês apenas, por decisão do
  provider.
- **Sentimento e contexto das menções.** Aparece ou não aparece; se falam bem, o
  analista lê.
- **Marca fora das três listas de casamento.** Não detectada, e declarado como
  tal.
- ~~A forma do `serp_item` de `ai_overview_reference`~~ → **observada**,
  dezessete campos, contra `puroclean.com`. Sobra uma decisão que o payload
  criou: `rank_group` e `rank_absolute` são números **diferentes** (5 e 1 na
  primeira linha), e a coluna "posição" é um dos dois. Escolher o errado troca
  "quinta citação da lista" por "primeira" **sem nada quebrar**.
- ~~Citação sem link~~ → deixou de ser limite porque a via mudou. `llm_mentions`
  lê a fonte que a IA citou, tenha ela link ou não.
- ~~Se `ai_search_volume` responde em português~~ → **responde**. 61 de 110.

**Aberto depois da onda 0:**

- **Qual dos pares de endpoint de `llm_mentions` é o certo.**
  `search_mentions/live` respondeu e é o que a onda 2b usa. A tabela da conta
  lista `search/live`, `aggregated_metrics` e `cross_aggregated_metrics` pelo
  **mesmo preço**, sem execução. Preço igual não prova comportamento igual, e
  errar custa US$ 0,10 a tentativa.
- **A forma do `target` em `multi_target_metrics`.** `keyword_entity` com
  `search_scope: ["answer"]` e `match_type: "word_match"` é o que a documentação
  descreve; não foi chamado. A onda 2b começa por aí, com controle positivo.
- **Se `brand_entities` vem preenchido em `platform: google`.** A chave existe no
  item; o conteúdo fora do `chat_gpt` não foi verificado.
- **`llm_scraper`**, US$ 0,004 fixo **sem repasse de modelo**, só `chat_gpt` e
  `gemini`. Raspa a interface real em vez de chamar a API — que é o que o usuário
  final vê. Não medido, e a onda 3 sai sem ele.
- **Se sete menções bastam.** O dataset cobre o Brasil, mas um lead menor que
  `buscaorganica.com.br` pode vir com zero. A US$ 0,10 a chamada, a tela precisa
  saber dizer "olhamos e não há" sem cobrar duas vezes pela mesma pergunta.
