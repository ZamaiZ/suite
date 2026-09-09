# Report 0 — Cobertura e Trilhas — Implementation Plan

> **Estado em 2026-09-09.** Onda 0 **concluída** — sete chamadas, US$ 0,0432,
> contra Funerária Benttus. Da onda 9 saíram as Tasks 1, 2, 3, 6 e 7b.
>
> Faltam da onda 9: Task 4 (cobertura de termos no conteúdo do site), Task 5
> (NAP nas 9 páginas), Task 7 (dados gerais e evidência no PDF) e Task 8
> (registro do escopo removido).
>
> **Duas correções que a implementação encontrou e que valem como aviso:**
> `diagnosisFactsFingerprint` era feito só de timestamps de coleta, então
> nenhuma mudança de regra marcava rascunho como desatualizado — virou a Task
> 7b. E `readFacts` em `diagnosis-read.ts` **descartava campo desconhecido em
> silêncio**: os pontos fortes seriam gravados no jsonb e sumiriam na leitura,
> sem erro nenhum. Todo campo novo em `DiagnosisFacts` precisa de leitor.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Equiparar a auditoria de lead ao documento de referência (Report 0) e colocar cada dado na trilha a que pertence.

**Architecture:** Oito ondas em ordem de dependência e de custo crescente. A onda 0 valida payload real e não produz funcionalidade. As ondas 9 a 11 não gastam nada — a 9 é regra pura sobre dado já gravado e é retroativa; a 10 amplia mappers e crawler sobre respostas já pagas. Só a 12 começa a gastar. A reorganização das trilhas fica por último, para tocar cada painel uma vez só.

**Tech Stack:** Next.js 16.3.1 App Router, React 19.2.8, TypeScript, Supabase, DataForSEO, Google Places, PageSpeed Insights, `@react-pdf/renderer`.

**Spec:** `docs/superpowers/specs/2026-09-09-report0-cobertura-design.md`

## Global Constraints

- Não executar comandos de Git, teste, build, lint ou typecheck; regras do repositório proíbem todos eles. A verificação é por leitura.
- **Leitor tolera o passado.** Campo novo entra opcional. `null` é não coletado, `[]` é coletado e vazio, e nenhum dos dois vira zero. O padrão está em `GbpEnrichment.services` e `WebsitePageSnapshot.redirects`.
- **Valores antigos continuam legíveis.** `serpapi_maps`, `serpapi_organic`, `serpapi` e os guards `enrichment.source !== "serpapi"` em `lib/leads/gbp.ts` (~287 e ~297) não saem.
- **Fronteira `server-only` é transitiva.** Cada módulo puro novo é verificado até a raiz, não só nos imports diretos.
- **Migrations reexecutáveis:** `if not exists`, `drop policy if exists` antes de cada `create policy`, e `do $$ ... execute $backfill$ ... $backfill$` guardado por `information_schema` quando ler coluna que ela mesma derruba.
- **Nenhuma tarefa paga é refeita.** Identificador gravado antes de qualquer outra escrita; `tag` lido de `tasks[i].data.tag`, nunca do nível da tarefa.
- **A máquina não escreve em `analyst_review`.** Campo em branco do analista não gera gap.
- **Todo gap novo carrega o número no `detail`**, no padrão de `reputationDetail()` (`lib/leads/gbp-opportunities.ts`).
- `scorePillarOpportunities()` não muda em nenhuma onda.
- Comentário explica **por quê**, não o quê.

---

## File Structure

**Criar** — puros: `lib/leads/term-coverage.ts`, `segment-categories.ts`, `diagnosis-strengths.ts`, `website-graph.ts`. `server-only`: `lib/places/photos.ts`, `lib/dataforseo/competitors-domain.ts`, `lib/dataforseo/brand-mentions.ts`. Actions: `analyze-organic-competitors.ts`, `analyze-brand-mentions.ts`. Migrations `20260926`–`20260928`.

**Alterar** — `lib/leads/`: `gbp.ts`, `gbp-audit.ts`, `gbp-enrichment.ts`, `gbp-grid.ts`, `gbp-grid-competitors.ts`, `gbp-analyst-review.ts`, `gbp-opportunities.ts`, `website-audit.ts`, `website-opportunities.ts`, `diagnosis-document.ts`, `diagnosis-compile.ts`, `diagnosis-templates.ts`, `diagnosis-pdf.tsx`, `digital-presence-review.ts`, `gbp-audit-rail.ts`. `lib/website-audit/`: `parse.ts`, `crawl.ts`, `sitemap.ts`. Mais `lib/dataforseo/usage.ts`, `app/actions/leads/enrich-gbp-profile.ts`, `compile-lead-diagnosis.ts` e os componentes dos cinco painéis.

---

# Onda 0 · Validar o payload

### Task 0: Sete chamadas, sete respostas — **CONCLUÍDA em 2026-09-09**

**Files:** nenhum de código. Registro completo em `docs/auditoria/2026-09-04-impedimentos-dataforseo.md`, seção "Onda 0 do plano do Report 0".

Executada contra **Funerária Benttus** — a empresa do próprio documento de referência. Custo total **US$ 0,0432**.

- [x] **T0.2 · o achado da onda.** O item do Maps traz **33 campos** e o mapeador lê 3. Disponíveis sem custo: `rating{value,votes_count}`, `rating_distribution`, `url`, `domain`, `category`, `additional_categories`, `address`, `phone`, `cid`, `total_photos`, `main_image`, `is_claimed`, `work_hours`, `snippet`, `book_online_url`. **A pergunta aberta desde a migração está respondida: sim, traz `url` e `domain`.**
- [x] **T0.1.** `services` volta como array real — fecha o resíduo da onda 3. **Links sociais NÃO são coletáveis** (`local_business_links: null`, sem `social_links`/`links`/`profiles`). **Fotos não têm data e não há vídeo** — só `total_photos`, `main_image` e `logo`. Campos ignorados que existem: `attributes`, `place_topics`, `work_time`, `popular_times`, `logo`, `price_level`.
- [x] **T0.3 · aprovada.** 9 resultados, **todos do negócio**, todos páginas de citação com o NAP. Achou `hotfrog.com.br`, que está no catálogo dos 22 e que o método por backlink não encontrou. **Limitação registrada:** casar o telefone exato acha onde o NAP está certo, não onde está errado.
- [x] **T0.4 · aprovada.** Ficha do RA nas posições 1, 3, 4, 7 e 9, com URL canônica e **a reputação no próprio snippet**. Trouxe também JusBrasil e Instagram.
- [x] **T0.5.** A conta expõe `on_page`, `content_analysis` e `domain_analytics`. `page_screenshot` US$ 0,0048 — confirma a Task 23.
- [x] **T0.6 · reprovada.** O Reclame Aqui devolve **HTTP 403** ao `instant_pages`, mesmo com `enable_browser_rendering`. A decisão original — sem resumo dos conteúdos — fica de pé. E cobrou US$ 0,0051 contra US$ 0,00015 da tabela: **34×**.
- [x] **T0.7 · reprovada.** `content_analysis/search/live` custou US$ 0,02472 e devolveu 33 documentos, oito dos primeiros nove do mesmo domínio obscuro, sem título. A SERP da T0.4, por US$ 0,004, trouxe menções de verdade. **A SERP é o método.**
- [x] Custos reais anotados. **Correção:** `serp/google/maps/live/advanced` cobrou exatamente os US$ 0,002 da tabela, contradizendo o número citado no `SERP_CAVEAT` de `lib/dataforseo/usage.ts`, que deve ser revisto.

---

# Onda 9 · Regras puras · retroativa · custo zero

### Task 1: Cobertura de termos, o módulo compartilhado

**Files:** Create `lib/leads/term-coverage.ts`

- [ ] Módulo **puro**, sem alcançar `server-only`: ele é consumido por regra de gap que roda em componente de cliente.
- [ ] `foldTerm(value)` normalizando por NFD e minúsculas, na mesma técnica de `foldTitle()` (`lib/leads/gbp-grid-competitors.ts`) — reusar o critério em vez de escrever o segundo.
- [ ] `TermSet` com os grupos `services`, `region`, `category`, cada um com origem declarada. A origem vai para o `detail` do gap; sem ela o achado vira rótulo.
- [ ] `buildTermSet(input)` montando de `services[].title` + `category` + `additionalCategories` + `segment.name` + cidade/UF + `rankKeywords`. **Grupo sem fonte nasce vazio, e grupo vazio nunca gera gap** — ausência de referência não é ausência de cobertura.
- [ ] `termCoverage(text, termSet)` devolvendo, por grupo, os termos presentes e os ausentes. Casamento por palavra inteira sobre o texto normalizado — substring casaria "SP" dentro de "esporte".

### Task 2: Categoria × segmento

**Files:** Create `lib/leads/segment-categories.ts` · Modify `lib/leads/gbp.ts`, `lib/leads/gbp-opportunities.ts`

- [ ] `segment-categories.ts` puro, com o dicionário de sinônimos por segmento. Começar enxuto e crescer por uso — dicionário grande escrito de uma vez envelhece sem ninguém perceber.
- [ ] Gap `category_off_segment` em `GBP_GAP_IDS` e `GBP_GAP_LABELS`, comparando `enrichment.category` e `additionalCategories` com o segmento do lead.
- [ ] **Sem segmento cadastrado, sem gap.** Guarda explícita, com o comentário dizendo por quê.
- [ ] Título e `detail` em `OPPORTUNITY_TITLES` e no montador de detalhe: o detalhe nomeia a categoria encontrada e o segmento esperado.

### Task 3: Cobertura da descrição do perfil

**Files:** Modify `lib/leads/gbp.ts`, `lib/leads/gbp-opportunities.ts`

- [ ] Três gaps novos: `description_missing_services`, `description_missing_region`, `description_missing_category`, alimentados por `termCoverage()` sobre `enrichment.description`.
- [ ] Conviverem com `missing_description` e `thin_description` sem duplicar: **descrição ausente suprime os três** — não existe cobertura a medir num campo vazio, e três achados sobre o mesmo nada é ruído.
- [ ] `detail` lista os termos ausentes, com teto de exibição.

### Task 4: Cobertura de termos no conteúdo

**Files:** Modify `lib/leads/website-audit.ts`, `lib/leads/website-opportunities.ts`

- [ ] Gap `content_missing_terms` em `WEBSITE_GAP_IDS`, aplicando `termCoverage()` a `textExcerpt` + `title` + `h1` de cada página da amostra.
- [ ] O achado é do **conjunto**, não por página: "nenhuma das 9 páginas menciona X" é diagnóstico; nove achados iguais é ruído.
- [ ] Registrar em comentário que `WEBSITE_TEXT_EXCERPT_MAX` é 4.000 chars e a cauda de página longa não entra — e refletir isso em `buildLimitations()` (`lib/leads/diagnosis-compile.ts`).

### Task 5: NAP em toda a amostra

**Files:** Modify `lib/leads/website-audit.ts`, `lib/leads/website-opportunities.ts`

- [ ] `napCheckForCrawl()` passa a varrer `crawl.pages` em vez de só a home, preservando os três estados por componente (`absent`, `match`, `mismatch`) que a correção do `else if` estabeleceu.
- [ ] Divergência em **qualquer** página mantém `nap_mismatch`; o `detail` diz em quais, via `napMismatchLabels()`.
- [ ] Página sem telefone nem endereço não conta como `absent` — ausência numa página interna é normal, e tratá-la como falta faria todo site ganhar o gap.

### Task 6: Pontos fortes

**Files:** Create `lib/leads/diagnosis-strengths.ts` · Modify `lib/leads/diagnosis-document.ts`, `diagnosis-compile.ts`, `diagnosis-templates.ts`, `diagnosis-pdf.tsx`

- [ ] `DiagnosisStrength` (`id`, `title`, `pillar`, `detail`) e `DiagnosisFacts.strengths` — campo **opcional na leitura**, para que draft já gravado continue abrindo.
- [ ] Catálogo com limiar **próprio de excelência**, não o inverso do gap: `strong_rating` (≥ 4,5), `high_reply_rate` (≥ 80%), `fast_replies` (mediana ≤ 2 dias), `top3_local`, `complete_profile`; `fast_site` (≥ 90 nas duas estratégias), `healthy_cwv`, `secure_site`, `rich_content`, `clean_link_profile`; `active_networks`, `measurement_ready`; `non_brand_top3`, `broad_footprint`.
- [ ] **`scorePillarOpportunities()` não muda.** Ponto forte é exibição — se entrasse na nota, o scorecard passaria a somar duas escalas e mudaria o número de todo lead já auditado.
- [ ] `detail` traz o número que originou o elogio, mesma regra dos gaps.
- [ ] Seção no PDF **antes** das oportunidades, agrupada por dimensão — a ordem do Report 0 de referência.
- [ ] `seedDiagnosisProse()` passa a citar o ponto forte de maior impacto no resumo executivo. Sem pontos fortes, a frase some em vez de virar texto vazio.
- [ ] Os sinais que dependem de dado de concorrente nascem escuros até a onda 10; não inventar limiar absoluto para eles.

### Task 7: Dados gerais e evidência no PDF

**Files:** Modify `lib/leads/diagnosis-document.ts`, `diagnosis-compile.ts`, `diagnosis-pdf.tsx`

- [ ] `DiagnosisMeta` ganha `profileUrl` (de `enrichment.checkUrl`, já coletado), `segment` (já é input de `DiagnosisCompileInput` e só não chega ao meta) e `competitors` (nomes de `gbpGridPositionSnapshot()`). Todos opcionais na leitura.
- [ ] Capa do PDF passa a exibi-los, no formato "Dados Gerais da Empresa" do Report 0.
- [ ] `pagespeed.mobile.screenshot` entra como `<Image>` no react-pdf. Respeitar `PSI_SCREENSHOT_MAX_CHARS`; screenshot ausente **omite a seção**, não desenha moldura vazia.

### Task 7b: Marcar o rascunho como desatualizado quando as regras mudam

**Files:** Modify `lib/leads/diagnosis-document.ts`, `app/actions/leads/compile-lead-diagnosis.ts`

Sem isto a onda 9 é retroativa **nas regras e não na tela**, e ninguém percebe.

- [ ] `diagnosisFactsFingerprint()` é montado só com **timestamps de coleta** (`gbpFetchedAt`, `websiteFetchedAt`, …). Mudar o catálogo de gaps não muda o fingerprint, então nenhum rascunho salvo é marcado como desatualizado — e o achado novo só aparece se alguém recompilar por conta própria. Hoje há 4 rascunhos e 4 exports salvos.
- [ ] Adicionar `DIAGNOSIS_RULES_VERSION` ao fingerprint, incrementado a cada onda que altera catálogo de achados ou de pontos fortes. O rascunho passa a nascer `stale` e o rail marca o alerta que já sabe exibir (`gbp-audit-rail.ts`, ~275).
- [ ] **Não recompilar sozinho.** Recompilar apagaria a prosa que o analista escreveu — `mergeDiagnosisProse` preserva, mas só quando alguém decide. Marcar como desatualizado é aviso; recompilar é decisão de quem vende.
- [ ] O export **não** é remarcado: ele é o documento entregue e reescrevê-lo por mudança de regra reescreveria o que foi vendido.

### Task 8: Registrar o escopo removido

**Files:** Modify `docs/auditoria/2026-09-04-alteracoes-auditoria.md`, `2026-09-04-handoff-auditoria.md`

- [ ] Mover acessibilidade detalhada, formulários, validação de schema e crawl completo de "continua faltando" para uma seção de **fora de escopo por decisão**.
- [ ] Corrigir o item de verificação do handoff que diz "~60 arquivos pendentes e nada foi commitado": a árvore está limpa e as ondas 1–8 estão em `0d4736e`.
- [ ] Atualizar o placar de gaps.

**Verificação da onda:** abrir um lead auditado antes dela. Achados novos aparecem sem recoletar; nenhum achado antigo muda de texto ou de nota.

---

# Onda 10 · Coleta ampliada · custo zero de API · não retroativa

### Task 9: Concorrente com nota e volume — depende de T0.2

**Files:** Modify `lib/leads/gbp-audit.ts`, `gbp-grid.ts`, `gbp-grid-competitors.ts`, `gbp.ts`, `gbp-opportunities.ts`

- [ ] **T0.2 confirmou 33 campos.** `readMapsItems()` (~560) passa a ler, e `MapsRankItem`/`GbpRankCompetitor` ganham — **todos opcionais** — `rating` (de `rating.value`), `reviewCount` (de `rating.votes_count`), `domain`, `url`, `category`, `totalPhotos` e `isClaimed`.
- [ ] **Guardar o que a tela usa, não tudo.** São até 3 concorrentes × 121 pontos de jsonb; a malha guarda 3 de propósito por causa disso. Campos que nenhuma regra consome ficam de fora — foi a lição do `referring_links_*`, que guardava dois de seis e teve de voltar atrás, mas ao contrário.
- [ ] `readRankCompetitor()` (~498) e `readCompetitors()` (`gbp-grid.ts`, ~422) tratam os campos novos como ausentes-tolerados. Hoje eles rejeitam a linha inteira quando um campo obrigatório falta — campo novo **não** pode entrar nessa regra, senão todo histórico some na leitura.
- [ ] `gbpGridPositionSnapshot()` agrega mediana de nota e de volume dos concorrentes, ao lado do que já agrega. É retroativo apenas para os scans coletados depois desta onda.
- [ ] Gaps `rating_below_competitors` e `reviews_below_competitors`, contra a **mediana** e não contra limiar absoluto. Sem dado de concorrente, os dois ficam em silêncio.
- [ ] Destravar os sinais de ponto forte da Task 6 que dependiam destes números.

### Task 10: Sitemap completo

**Files:** Modify `lib/leads/website-audit.ts`, `lib/website-audit/crawl.ts`, `sitemap.ts` · usa `LEADS_STORAGE_BUCKET`

- [ ] Remover `WEBSITE_MAX_SITEMAP_FILES`; `collectSitemapUrls()` (`crawl.ts`, ~177) percorre todos os arquivos declarados no robots, com teto de segurança alto e não de 3.
- [ ] `WebsiteSitemapSnapshot` ganha `files: {url, urlCount}[]` e `urlsStoragePath: string | null`, opcionais na leitura.
- [ ] Lista completa gravada como arquivo no bucket `leads`, no padrão de `export-lead-diagnosis-pdf.ts`. O jsonb guarda contagem exata, contagem por arquivo e a amostra.
- [ ] `WEBSITE_SITEMAP_SAMPLE = 20` fica: é validação de URL viva, e ampliá-la multiplica requisições do crawler.
- [ ] `sitemap_bloat` continua com a mesma regra, agora sobre a contagem real.

### Task 11: `title` de imagem

**Files:** Modify `lib/website-audit/parse.ts`, `lib/leads/website-audit.ts`, `website-opportunities.ts`

- [ ] `imagesWithoutTitle` ao lado de `imagesWithoutAlt` (`parse.ts`, ~319), **opcional** no `WebsitePageSnapshot` — ausente é "não coletado", não zero.
- [ ] Gap `images_missing_title`, separado de `images_missing_alt`: são atributos com funções diferentes e agrupá-los esconderia qual falta.

### Task 12: Anchor, profundidade e indício de órfã

**Files:** Modify `lib/website-audit/parse.ts` · Create `lib/leads/website-graph.ts`

- [ ] `parse.ts` (~326) passa a guardar `internalLinks: {path, anchor}[]`, respeitando `WEBSITE_INTERNAL_PATHS_MAX = 40`. **`internalPaths` continua sendo escrito**, derivado — leitores antigos e `napCheckForCrawl`/`website-compliance` dependem dele.
- [ ] `website-graph.ts` puro: profundidade de clique a partir da home dentro da amostra, e a contagem de URLs do sitemap que nenhuma página alcança.
- [ ] Gap `generic_anchor_text` para âncoras como "clique aqui", "saiba mais", "leia mais", "veja mais" — lista pequena, no módulo, com o número no `detail`.
- [ ] Gap `sitemap_unreached_urls` **rotulado como indício**: o texto diz "a amostra é de 9 páginas". A palavra "órfã" não aparece sozinha em nenhum rótulo, título ou detalhe.
- [ ] Snapshot sem `internalLinks` produz **zero achado de grafo**, não achado vazio.

### Task 13: Links sociais do perfil — depende de T0.1

**Files:** Modify `lib/leads/gbp-enrichment.ts`, `gbp.ts`, `gbp-opportunities.ts`

- [x] **T0.1 negou.** `local_business_links` volta `null` e não existem `social_links`, `links` nem `profiles`. Links sociais do perfil **não são coletáveis**.
- [ ] O item vira **campo do analista** em `analyst_review`, ao lado do checklist de diretórios: um estado por rede (`presente`, `ausente`, `divergente`), no mesmo desenho de três estados dos diretórios.
- [ ] O cruzamento automático com `lead_digital_channels` e `crawl.signals.socialUrls` **continua valendo** — ele não dependia do perfil e já existe no passo de Presença digital. O que sai é só o lado do Google.
- [ ] Gap `profile_social_links_missing` com `source: "analyst"`. **Campo em branco não gera gap.**

### Task 13b: Temas das avaliações — **OPCIONAL, nasceu da T0.1**

**Files:** Modify `lib/leads/gbp-enrichment.ts`, `components/custom/LeadGbpPanel/LeadGbpReviewsBlock.tsx`

Não estava no plano aprovado. Entra como proposta porque é dado **gratuito numa chamada que já é feita** e endereça a seção de reputação do Report 0.

- [ ] `my_business_info` devolve `place_topics`: os temas que as avaliações mencionam, contados. Em Benttus — gratidão 39, processo 16, empresa 14, agilidade 12, translado 10.
- [ ] `GbpEnrichment.placeTopics: Record<string, number> | null`, opcional na leitura, exibido ao lado da amostra de avaliações.
- [ ] **Não é sentimento, e a tela precisa dizer isso.** A decisão de que sentimento é campo humano continua valendo; isto é "sobre o que o cliente fala", que é outra afirmação.
- [ ] **Não vira gap.** Tema frequente não é problema nem virtude sem alguém ler — e inventar regra sobre vocabulário produziria diagnóstico falso, que é o erro que `no_services` e `no_local_top20` já cometeram.

**Verificação da onda:** uma coleta completa num lead de teste, campo a campo contra o payload da onda 0. Abrir um lead antigo e confirmar que os campos novos leem como "não coletado".

---

# Onda 11 · N perfis do Google · custo zero

### Task 14: Diretórios saem do perfil para o lead

**Files:** Create `supabase/migrations/20260926000000_lead_directory_citations.sql` · Modify `lib/leads/gbp-analyst-review.ts`, `app/actions/leads/update-gbp-analyst-review.ts`

- [ ] Tabela `lead_directory_citations` por lead, **singleton** (índice único em `lead_id`) — é julgamento, não coleta, no mesmo desenho de `lead_digital_presence_audits`. Diretório é do negócio, não do perfil.
- [ ] RLS com as quatro políticas `_commercial`, `drop policy if exists` antes de cada uma, mais `revoke`/`grant`.
- [ ] Backfill a partir do `analyst_review` do perfil primário, guardado por `information_schema` — a migration lê coluna que continua existindo, mas o guard protege reexecução.
- [ ] `readGbpAnalystReview()` continua lendo `directories` do jsonb antigo quando a tabela nova não tiver linha. Resposta já preenchida não pode sumir na leitura.

### Task 15: O diagnóstico recebe todos os perfis

**Files:** Modify `lib/leads/diagnosis-compile.ts`, `app/actions/leads/compile-lead-diagnosis.ts`, `lib/leads/diagnosis-pdf.tsx`

- [ ] `DiagnosisCompileInput.gbpProfile` vira `gbpProfiles: LeadGbpProfile[]`; `compile-lead-diagnosis.ts` (~125) para de escolher um.
- [ ] `googleOpportunities()` roda por perfil, e cada achado ganha o nome do perfil no `detail`. **Sem isso o dedup por título em `mergeRoadmap()` colapsa dois perfis numa linha só** — e o achado do segundo perfil desaparece em silêncio.
- [ ] `googleMetrics()` agrega e declara quantos perfis cobriu, na mesma disciplina de "toda métrica de janela declara a janela".
- [ ] `buildSources()` e `buildLimitations()` refletem o número de perfis.
- [ ] Lead com um perfil produz documento **idêntico** ao anterior — é o teste de que a mudança não vazou.

---

# Onda 12 · Fotos do perfil · depende de T0.1

### Task 16: Baixar e guardar as fotos

**Files:** Create `lib/places/photos.ts` · Modify `app/actions/leads/enrich-gbp-profile.ts`, `lib/leads/gbp.ts`, `components/custom/LeadGbpPanel/LeadGbpProfileCard.tsx`, `lib/leads/diagnosis-pdf.tsx`

- [ ] `lib/places/photos.ts` **`server-only`**: baixa por referência de `place.photoNames` e grava no bucket `leads`, sob `<lead_id>/gbp/<profile_id>/`.
- [ ] **O gatilho é a parte perigosa.** Baixar só na primeira coleta e quando `totalPhotos` mudar. Sem condição, cada recoleta compraria as dez de novo — mesma classe do incidente que cobrou treze vezes a mesma malha. Comentar o porquê no ponto de decisão.
- [ ] Falha ao baixar uma foto **não derruba o enriquecimento**: grava o que veio e registra o que faltou. Enriquecimento é o caminho caro; foto é acessório.
- [ ] Galeria em `LeadGbpProfileCard.tsx`; até 3 imagens no PDF como evidência.
- [ ] Bloco próprio de contagem de requisições Places na tela de Ferramentas — é Google, não DataForSEO, e não entra em `DATAFORSEO_OPERATIONS`.
- [x] **T0.1 negou a data.** Não há array de fotos nem timestamp em `my_business_info` — só `total_photos`, `main_image` e `logo`. **`stale_photos` não é implementável** e sai do plano: não se inventa recência. A galeria continua vindo do `photoNames` do Places, que é o caminho que esta task já usa.

**Verificação:** duas coletas seguidas no mesmo lead sem mudar o perfil, e **zero** requisição de foto na segunda.

---

# Onda 13 · Visibilidade e concorrência

### Task 17: Concorrentes orgânicos e market share

**Files:** Create `lib/dataforseo/competitors-domain.ts`, `supabase/migrations/20260927000000_lead_organic_competitors.sql`, `app/actions/leads/analyze-organic-competitors.ts` · Modify `lib/dataforseo/usage.ts`, `lib/leads/visibility-audit.ts`, `visibility-opportunities.ts`

- [ ] Cliente `server-only` espelhando `lib/dataforseo/ranked-keywords.ts`, em `/dataforseo_labs/google/competitors_domain/live`. **Uma chamada responde concorrente e market share** — não são duas coletas.
- [ ] Migration append-only no molde exato de `20260924000000_lead_backlink_audits.sql`, com `captured_at` e índice `(lead_id, captured_at desc)`. Sem índice único: nasce certa em vez de precisar da conversão que a `20260917` teve de fazer.
- [ ] Action no molde de `analyze-backlinks.ts`, incluindo a resolução do domínio primário por `readLeadDigitalChannels`.
- [ ] Entrada em `DATAFORSEO_OPERATIONS` com `api: "dataforseo_labs"` e o `RESULT_CAVEAT`, para a calculadora não mentir.
- [ ] Gaps `behind_on_organic_share` e — quando a chamada não devolve linha — silêncio, nunca "sem concorrentes".
- [ ] Card no passo de Visibilidade. **Retrato, não teardown**, com o limite declarado na tela, como `gbp-grid-competitors.ts` já faz.

### Task 18: Blog e páginas regionais do concorrente

**Files:** Modify `lib/leads/website-audit.ts`, `app/actions/leads/analyze-organic-competitors.ts`

- [ ] Com os domínios em mãos, passada rasa do crawler próprio em cada concorrente — home e sitemap —, reusando `safeFetch` e as regras `no_blog` e `no_service_pages` que já existem. **Custo zero de API.**
- [ ] Teto rígido de domínios e de páginas por domínio: é tempo de execução, e a auditoria foi definida como baixo custo e baixo tempo.
- [ ] Gap `competitor_content_advantage`, com o `detail` nomeando quantos concorrentes têm blog e o lead não.
- [ ] Concorrente que não responde entra como **não verificado**, não como "sem blog".

---

# Onda 14 · Presença off-site

### Task 19: Menções de marca

**Files:** Create `lib/dataforseo/brand-mentions.ts`, `supabase/migrations/20260928000000_lead_brand_mentions.sql`, `app/actions/leads/analyze-brand-mentions.ts` · Modify `lib/dataforseo/usage.ts`, `lib/leads/digital-presence.ts`, `digital-presence-opportunities.ts`

- [x] **Método decidido pela T0.7: SERP orgânica.** `content_analysis/search/live` custou 6× mais e devolveu 33 documentos, oito dos primeiros nove do mesmo domínio obscuro e sem título. A SERP trouxe Reclame Aqui, Instagram, JusBrasil e o site próprio.
- [ ] Uma chamada orgânica com o nome da empresa, guardando o resultado **inteiro** menos o domínio próprio e as redes já cadastradas. É reativar o que o caminho SerpAPI descartava: ele já rodava essa busca e jogava tudo fora exceto a posição do próprio domínio.
- [ ] Tabela append-only com `captured_at` — menção tem data, e sobrescrever perderia a série.
- [ ] Gap `no_brand_mentions` só quando a chamada **voltou com resultado** e nenhum é menção. Chamada sem resultado é `null` e cala.
- [ ] Entrada em `DATAFORSEO_OPERATIONS` com o `SERP_CAVEAT`.

### Task 20: NAP na web — depende de T0.3

**Files:** Modify `lib/dataforseo/brand-mentions.ts`, `app/actions/leads/analyze-brand-mentions.ts`, `lib/leads/website-opportunities.ts`

- [x] **T0.3 aprovou** — 9 resultados, todos do negócio, todos páginas de citação com o NAP. E achou `hotfrog.com.br`, que está no catálogo dos 22 e que o método por backlink não encontrou.
- [ ] Busca `"<nome>" "<telefone>"`, compartilhando a tabela da Task 19. **Não usar `site:`** — reprovado na Task 0 da onda 8 por ser honrado de forma inconsistente.
- [ ] **O gap é `nap_confirmed_citations`, não `nap_mismatch_on_web`.** Casar o telefone exato acha onde o NAP está **certo**; página com telefone divergente não casa a consulta e fica invisível. Construir um detector de divergência sobre esta consulta seria construir algo que estruturalmente não pode detectar o que promete.
- [ ] **Alimentar o checklist de diretórios com o que a busca achou**, sem escrever nele: onde a consulta encontrou a página, a linha aponta para a ficha em vez de para uma busca. A máquina não fecha o estado — é a mesma regra que já vale para a corroboração por backlink.
- [ ] Detecção de divergência exige buscar só o nome e comparar telefones: outra consulta, outra decisão. **Fica fora desta task**, registrado.

### Task 21: Reclame Aqui — depende de T0.4

**Files:** Modify `lib/dataforseo/brand-mentions.ts`, `lib/leads/digital-presence.ts`, `digital-presence-opportunities.ts` · Create card em `components/custom/LeadDigitalPresencePanel/`

- [x] **T0.4 aprovou e T0.6 reprovou.** A ficha aparece nas primeiras posições com URL canônica e a reputação no snippet; o `instant_pages` leva **403** do Reclame Aqui. **A decisão original vale: sem resumo dos conteúdos.**
- [ ] Busca `reclame aqui "<nome>"`, casando o domínio `reclameaqui.com.br`. Guardar: existência, URL canônica `/empresa/<slug>/`, o texto de reputação do snippet e os títulos das reclamações que aparecerem como resultado.
- [ ] **O snippet é texto de terceiro, não número.** Guardar como texto e exibir como texto — extrair nota por regex de um snippet que o Google reescreve seria inventar precisão.
- [ ] **A máquina traz a referência; o analista avalia.** Campo de julgamento em `analyst_review`, no mesmo desenho de `reputation_note`: um veredito e uma nota de texto, fora do snapshot, para que recoletar não apague. O card mostra o link da ficha ao lado do campo, para o analista abrir e responder.
- [ ] O gap sai do **campo do analista**, não do snippet. `reclame_aqui_issue` com `source: "analyst"`, e **campo em branco não gera gap** — é a mesma regra dos diretórios e da leitura de reputação.
- [ ] O que a busca não trouxer é `null`, e a tela diz "não coletado"; **nunca** "sem reclamações".
- [ ] A mesma resposta traz JusBrasil e redes sociais: **compartilhar a coleta com a Task 19** em vez de pagar duas buscas quase iguais.
- [ ] Gaps `reclame_aqui_low_score` e `reclame_aqui_present`, ambos em silêncio quando o dado é `null`.

### Task 22: Reputação de redes

**Files:** Modify `lib/leads/digital-presence-review.ts`, `digital-presence-opportunities.ts`, `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceNetworks.tsx`

- [ ] `DigitalPresenceNetworkAnswer` ganha `rating` e `reviewCount` como **campos humanos**, ao lado de `followers` e `lastPostedOn`, que já são humanos e já funcionam.
- [ ] Leitura tolerante: resposta gravada antes desta task continua abrindo.
- [ ] Sem API da Meta não há leitura confiável de página pública. Registrar isso em comentário para que ninguém tente de novo daqui a três meses.

### Task 23: Captura da ficha do GMB — depende de T0.5

**Files:** Create `lib/dataforseo/page-screenshot.ts` (`server-only`) · Modify `lib/dataforseo/usage.ts`, `app/actions/leads/enrich-gbp-profile.ts`, `lib/leads/diagnosis-pdf.tsx`

- [x] **T0.5 aprovou.** A conta expõe `on_page`, e `page_screenshot` custa US$ 0,0048 `per_result`.
- [ ] Capturar `enrichment.checkUrl` — a URL da ficha que já é coletada — e gravar no bucket `leads`, ao lado das fotos da onda 12.
- [ ] **Mesmo gatilho das fotos:** só na primeira coleta e quando a ficha mudar. Screenshot recomprado a cada poll é a mesma armadilha, com outro nome.
- [ ] Entrada em `DATAFORSEO_OPERATIONS` com `api: "on_page"` e `fnSuffix: "page_screenshot"`, para a calculadora contar.
- [ ] Falha na captura não derruba o enriquecimento — evidência é acessório, e o caminho caro é a ficha.

**Verificação da onda:** um lead sem reclamação e sem menção não dispara nenhum dos gaps novos. É o erro que `no_services` e `no_local_top20` cometeram e que a onda 3 teve de desfazer.

---

# Onda 15 · Reorganização das trilhas · custo zero · sem migration

### Task 24: Ordem dos passos

**Files:** Modify `lib/leads/gbp-audit-rail.ts`, `components/custom/LeadGbpPanel/LeadGbpAuditRail.tsx`, `LeadGbpAuditStep.tsx`

- [ ] `STEPS` (~71) passa a `google-profile → website → visibility → digital-presence → diagnosis`, alinhando com o Report 0 e deixando o passo mais humano imediatamente antes do diagnóstico.
- [ ] `GbpAuditRailStepId` **não muda de valores** — só de ordem. Trocar os valores quebraria seleção de passo persistida.
- [ ] Conferir `currentStep`, `totalSteps` e `progress`: são derivados da ordem e precisam continuar coerentes.

### Task 25: Citações vão para o passo de Website

**Files:** Modify `components/custom/LeadGbpPanel/LeadGbpPanel.tsx`, `LeadWebsitePanel/LeadWebsitePanel.tsx` · mover `LeadGbpDirectoriesCard.tsx`

- [ ] Card de diretórios sai do painel de Google e entra no de Website, ao lado de `LeadWebsiteBacklinksCard.tsx`, que já mostra o resultado de citação por backlink. Um assunto, uma tela.
- [ ] O armazenamento já se moveu na Task 14 — aqui é só renderização e leitura.
- [ ] O gap continua contando para o pilar em que já contava. Nenhum achado muda de pilar nesta onda.

### Task 26: Painel único de concorrência

**Files:** Create card em `components/custom/LeadVisibilityPanel/` · Modify `LeadVisibilityPanel.tsx`

- [ ] Card **de leitura, sem recoleta**, consolidando os concorrentes do Maps (`gbpGridPositionSnapshot`), os de backlink (`lead_backlink_audits.snapshot`) e os orgânicos (Task 17).
- [ ] Casamento por domínio quando existir e por título normalizado quando não — o mesmo critério de `foldTitle()`, porque agrupar só por título juntaria franquias homônimas em bairros diferentes.
- [ ] Cada linha declara **de qual fonte veio**. Concorrente visto só no Maps e concorrente visto só no orgânico são afirmações diferentes.

### Task 27: Reputação off-Google no passo de Presença

**Files:** Modify `components/custom/LeadDigitalPresencePanel/LeadDigitalPresencePanel.tsx`

- [ ] Os cards das Tasks 21 e 22 nascem aqui, não no passo de Google.
- [ ] Reputação do Google continua onde está: é dado da ficha, e movê-la separaria a nota da fonte que a produz.

**Verificação da onda:** percorrer os cinco passos num lead completo e num lead vazio. Nenhum dado sumiu, nenhum card ficou órfão, e o rail marca progresso na ordem nova.

---

## Verificação de fim a fim

1. **Onda 0 primeiro, sempre.** Sem os payloads capturados, as ondas 10, 12 e 14 constroem contra documentação.
2. Um lead de teste com coleta completa, conferido campo a campo contra o payload cru.
3. Um lead com snapshot SerpAPI antigo, a cada onda: histórico legível, gaps inalterados, `few_photos` e `no_services` ainda suprimidos.
4. Um lead auditado antes da onda 9: achados retroativos aparecem sem recoletar, nenhum achado antigo muda.
5. Segunda coleta seguida no mesmo lead: zero requisição de foto.
6. Um lead vazio, a cada onda: nenhum gap novo dispara.
7. `cost` devolvido pela API contra a calculadora de Ferramentas, nas ondas 12, 13 e 14.
8. Fronteira `server-only` **transitiva** em cada módulo novo: `term-coverage`, `segment-categories`, `diagnosis-strengths` e `website-graph` são puros; `places/photos`, `dataforseo/competitors-domain` e `dataforseo/brand-mentions` são `server-only`.

## Documentação a atualizar ao fim

- `docs/auditoria/2026-09-04-alteracoes-auditoria.md` — placar de gaps e escopo removido
- `docs/auditoria/2026-09-04-impedimentos-dataforseo.md` — as cinco respostas da onda 0
- `docs/auditoria/2026-09-04-handoff-auditoria.md` — estado da árvore e nova seção de ondas
