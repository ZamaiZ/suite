# Presença em IA — Design

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

## Restrições medidas na documentação do provider

Três fatos decidem o desenho, e o primeiro elimina metade da referência:

1. **O dataset de menções em ChatGPT é EUA e inglês, e só.** A documentação de
   `llm_mentions` diz, literalmente, *"chat_gpt data is available for the
   'United States' and 'English' only"*. Pior: `brand_entities` e o endpoint
   `top_mentioned_brands` inteiro **só existem para `platform: chat_gpt`**. A
   tabela de "Competitor Dominance" do relatório de referência **não é
   comprável para lead brasileiro**, por nenhum preço.
2. **`ai_keyword_data/keywords_search_volume/live` suporta Brasil e português**,
   até 1.000 keywords por chamada, devolvendo `ai_search_volume` e doze meses de
   `ai_monthly_searches`. É demanda de busca em IA por keyword — número que o
   relatório de referência não tem.
3. **`llm_responses/live` é a via BR.** Aceita `web_search_country_iso_code` e
   `web_search_city`, devolve `annotations` com título, URL e trecho de cada
   fonte citada, e `money_spent` real por chamada. Perguntar e ler a resposta é
   observação, não julgamento.

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

- **Dominância de marca no dataset de ChatGPT.** Medido na documentação e
  reprovado para o Brasil: EUA e inglês apenas.
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
lib/leads/geo-citations.ts          puro — catálogo de fontes que LLM cita
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

  citations: {
    catalogVersion: number
    sources: Array<{ domain: string; links: number; firstUrl: string | null }>
    truncated: boolean
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

### Métricas

Por execução (`prompt × provedor`): `mentioned`, `position`, `domainCited`,
`brands[]`, `costUsd`, `modelName`, `at`.

`domainCited` sai de `annotations` e é **determinístico**. `position` é a ordem
da primeira ocorrência da marca entre as marcas detectadas na resposta — **não é
posição em lista numerada**, e a tela diz isso.

Agregadas: taxa de menção, posição média, dominância (menções da marca ÷
menções de todas as marcas detectadas), recorte por provedor, e a lista de
concorrentes com taxa e posição média.

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

### Custo

| Coleta | Chamadas |
|---|---|
| Base, onda 1 | **zero** — só leitura de snapshots que já existem |
| Base, onda 2 | **duas** — `ai_keyword_data` + backlinks com filtro `in` |
| Sondagem | prompts × provedores, `$0,0006 + preço do LLM` em live |

O filtro `in` sobre `domain_from` conta como **um** filtro, não um por valor — o
teto da API é de oito filtros. Vinte domínios custam o mesmo que oito. É o
achado da onda 8, reaproveitado.

**Ressalva da onda 8, que continua valendo:** link encontrado prova a citação;
link ausente **não** prova ausência de citação. Diretórios brasileiros foram
medidos por essa via e deram 399 domínios com zero casamentos, porque publicam
ficha sem link rastreável. Wikipedia, Reddit e YouTube são diferentes — emitem
link real — mas isso é hipótese até a onda 0 medir.

## Onda 0 — as perguntas que só o payload responde

Antes de qualquer código. A primeira pode reprovar metade do desenho.

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

| Onda | Entrega | Chamada paga nova |
|---|---|---|
| **0** | As cinco perguntas acima, com evidência versionada | probe |
| **1** | A etapa inteira determinística: tabelas, trilha, painel, as dezenove regras, os três do analista, **o pilar, o `measured` e o destravamento** | **nenhuma** |
| **2** | Demanda em IA e catálogo de citações | duas |
| **3** | A sondagem em LLM: prompt set fixado, quatro famílias, botão separado com custo visível | prompts × provedores |
| **4** | Narrativa do pilar e seção no PDF | nenhuma |

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
lib/leads/geo-prompts.ts
lib/leads/geo-prompt-visibility.ts
lib/leads/geo-review.ts
lib/leads/geo-opportunities.ts
lib/leads/geo-step-tabs.ts
lib/validations/lead-geo.ts
app/actions/leads/geo-access.ts
app/actions/leads/analyze-geo.ts
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
- **A forma do `serp_item` de `ai_overview_reference`.** A onda 0 da
  visibilidade registrou que os dois tipos novos vieram **zerados**, então a
  forma segue não observada. O primeiro lead que tiver citação em AI Overview é
  a validação — o mesmo erro que aquela onda veio corrigir, se for esquecido.
- **Citação sem link.** O limite da onda 8, intacto: a via de backlinks só vê
  citação que emite link.
- **Se `ai_search_volume` responde em português.** Onda 0, pergunta 3.
