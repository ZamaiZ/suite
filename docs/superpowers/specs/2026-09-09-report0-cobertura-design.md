# Report 0 — Cobertura e Trilhas — Design

## Objetivo

Equiparar a auditoria de lead ao documento de referência ("Report 0 — Auditoria
de Presença Digital") e colocar cada dado na trilha a que pertence.

Duas entregas numa: o PDF do diagnóstico passa a dizer o que o Report 0 diz, e as
cinco etapas param de guardar o mesmo assunto em lugares diferentes.

Isto é a **auditoria inicial**, pré-venda. Não é keyword research nem teardown de
concorrente — essas pertencem à fase de cliente e não estão aqui.

## O que motivou

O levantamento em `docs/auditoria/` mapeou item a item o Report 0 contra o que o
sistema coleta. A cobertura ficou em torno de 70%, e o que falta **não é uma
lista de features soltas**. São cinco classes de lacuna e quatro espalhamentos.

### As cinco lacunas

1. **O sistema não sabe elogiar.** `GBP_GAP_IDS`, `WEBSITE_GAP_IDS`,
   `scorePillarOpportunities` e `roadmapFrom` partem todos do gap. O Report 0
   **abre** a consolidação com pontos fortes agrupados por dimensão, e é isso que
   faz o documento soar como diagnóstico em vez de lista de defeitos.
2. **Concorrente é título e posição, nunca perfil.** `GbpRankCompetitor` guarda
   `{title, placeId, position}`. Metade das frases do Report 0 é comparativa
   — "concorrentes têm 4,5+", "atrás apenas do Crematório Vila Alpina" — e
   nenhuma delas é produzível.
3. **Um perfil só chega ao diagnóstico.** `compile-lead-diagnosis.ts` escolhe
   `find(is_primary) ?? [0]`. O Report 0 da funerária audita vários perfis juntos.
4. **O cabeçalho está incompleto.** `DiagnosisMeta` não tem link do perfil,
   segmento nem concorrentes nomeados — os três estão coletados em outro lugar.
5. **A evidência não sobrevive ao PDF.** `pagespeed.mobile.screenshot` está
   gravado no snapshot e o gerador simplesmente não o lê.

### Os quatro espalhamentos

| Assunto | Onde está hoje |
|---|---|
| Citações em diretórios | checklist no passo de Google, resultado por backlink no passo de Website |
| Concorrência | Maps por keyword · agregação da malha · benchmark de backlinks · orgânicos (quando existirem) |
| NAP | site × perfil no Website · diretório no Google |
| Reputação | inteira no Google, mesmo quando deixar de ser só do Google |

## Decisões aprovadas

- **Determinístico, sem LLM.** Regras de cobertura de termos respondem
  "menciona / não menciona"; o julgamento de qualidade fica em campo humano,
  como `reputation_note` e a revisão de site já fazem. O diagnóstico continua
  reproduzível pelo `facts_fingerprint`.
- **Âncoras ficam em 3.** `GBP_RANK_KEYWORDS_MAX`, a constraint
  `cardinality(rank_keywords) <= 3` e a cópia em `LeadGbpRankBlock` não são
  tocadas. Era o único item do plano que escala custo de forma não-linear.
- **Fotos: as 10 referências já coletadas, na primeira coleta e quando
  `totalPhotos` mudar.**
- **Reclame Aqui: só o que a busca entregar.** Sem navegador headless.
- **Órfãs: indício, nunca afirmação.** A amostra de 9 páginas fica.
- **Passo ≠ pilar.** A reorganização das trilhas move onde os cards aparecem;
  nenhum achado troca de pilar.

## Fora de escopo

Registrado como **decisão**, não como pendência — pendência que virou decisão não
pode seguir parecendo dívida:

- **Acessibilidade detalhada** — WCAG por critério, teclado, ARIA. O score do
  Lighthouse e a contagem de contraste continuam.
- **Auditoria de formulários** — campos, validação, teste de envio.
- **Validação de schema / Rich Results.** Saber que existe e qual `@type` serve
  para este modelo inicial.
- **Crawl completo do site.** A amostra de 9 páginas é deliberada: baixo custo,
  baixo tempo de execução.
- **Separação de lifecycle lead/cliente** — ciclo de auditoria, congelamento do
  Report 0 na conversão, julgamento humano por ciclo. Vira spec própria.
- **Keyword research, regiões de atuação, estrutura de páginas.** É o que a
  referência promete "em 3–5 dias", e é fase de cliente.

## Arquitetura

### Passo ≠ pilar — e é isso que torna a reorganização barata

Os quatro pilares do scorecard (`google`, `website`, `presence`, `visibility`)
não mudam, e nenhum achado troca de pilar: backlinks e citações seguem contando
para `website`, Reclame Aqui e redes para `presence`, market share para
`visibility`.

Não nasce quinto pilar. A razão é a mesma que a onda 4 registrou:
`emptyPillarScore()` vale **100**, então um pilar vazio afirmaria perfeição, e
criar um exigiria inventar antes o estado de "não medido".

A separação já existe de fato — o card de backlinks é renderizado no passo de
Website e conta para o pilar `website`; os IDs de medição são coletados pelo
crawler no passo de Website e lidos no de Presença. A reorganização apenas
torna isso deliberado.

### Ponto forte tem limiar próprio, e não entra na nota

Ponto forte **não é o inverso do gap**. `low_rating` dispara abaixo de 4; o
inverso disso seria "nota ≥ 4", que não é elogio — é ausência de problema. O
limiar de excelência é outro número e mora em catálogo separado.

E **`scorePillarOpportunities()` não muda.** Ponto forte é exibição; se entrasse
na nota, o scorecard passaria a somar duas escalas e o número deixaria de
significar o que significa hoje em todo lead já auditado.

Dois sinais dependem de dado de concorrente (`strong_rating` comparado, volume
acima da mediana) e por isso nascem escuros até a onda de concorrentes. Melhor
nascer escuro do que afirmar excelência contra limiar absoluto.

### Cobertura de termos é uma função só, usada em dois lugares

`lib/leads/term-coverage.ts`, puro. O conjunto de termos vem de `services[].title`
+ `category` + `additionalCategories` + `segment.name` + cidade/UF de
`resolveLeadLocation()` + `rank_keywords`. Sem lista digitada à mão — um cadastro
paralelo de palavras-chave envelheceria e ninguém manteria.

A mesma função avalia a descrição do perfil e o conteúdo das páginas. Duas
implementações divergiriam, que foi exatamente o que aconteceu com a lista de
concorrentes montada em dois lugares até a onda 3 unificá-la.

**Sem segmento cadastrado não há gap.** Ausência de referência não é divergência.

### Concorrente vira perfil sem custar chamada

`readMapsItems()` lê três campos — `rank_absolute`, `title`, `place_id` — e
descarta o resto de uma resposta **já paga**. `GbpRankCompetitor` ganha `rating`,
`reviewCount` e `domain`.

`lib/leads/gbp-grid.ts` importa o mesmo tipo, então a malha herda os campos em
até 121 pontos sem uma requisição a mais.

As comparações são contra a **mediana** dos concorrentes, não contra limiar
absoluto — mesmo desenho de `behind_on_referring_domains`, e pelo mesmo motivo:
"nota 4,0" é bom num mercado e ruim em outro.

### Onde a lista do sitemap mora

Um sitemap de 22 mil URLs ocupa ~1,3 MB. Em jsonb, isso é lido a cada abertura de
lead, a cada compilação de diagnóstico e a cada leitura de baseline.

O jsonb guarda contagem exata, contagem por arquivo e a amostra de validação; a
lista completa vai como arquivo para o bucket `leads`, no padrão de
`export-lead-diagnosis-pdf.ts`. O snapshot guarda o caminho.

### O gatilho das fotos

`PLACES_FIELD_MASK` já pede `photos` e `place.photoNames` já guarda até 10
referências. Falta só baixar os bytes — e o gatilho é a única parte perigosa.

As coletas são append-only. Sem condição de disparo, cada recoleta compraria as
dez de novo: dez leads recoletados dez vezes seriam mil requisições pagas pelo
mesmo trabalho. É a mesma classe do incidente da malha, que cobrou treze vezes.

**Baixa na primeira coleta e quando `totalPhotos` mudar.** Nada mais.

### Ausência nunca é achado

Vale para os três itens da onda de off-site e é o erro que este projeto já
cometeu duas vezes — `no_services` acusando todo perfil coletado depois da
migração, e `no_local_top20` mudando de significado sozinho.

- Reclame Aqui sem resultado é **não coletado**, nunca "sem reclamações".
- `found: null` é não verificado; `false` é verificado e não achou.
- `sitemap_unreached_urls` sai rotulado como indício, e a palavra "órfã" não
  aparece sozinha em lugar nenhum.

### Validar o payload antes de construir

Cinco chamadas manuais, menos de US$ 0,10, com critério de parada declarado por
item. Não produzem funcionalidade — e é justamente o ponto.

Esta linha de trabalho foi mordida duas vezes construindo contra documentação: o
`owner_timestamp` que existia e foi dado como inexistente lendo a interface do
Google, e o operador `in` que não existe e foi usado. Cada erro custou uma onda.

## Arquivos previstos

**Criar**

- `lib/leads/term-coverage.ts` — puro
- `lib/leads/segment-categories.ts` — puro
- `lib/leads/diagnosis-strengths.ts` — puro
- `lib/leads/website-graph.ts` — puro
- `lib/places/photos.ts` — `server-only`
- `lib/dataforseo/competitors-domain.ts` — `server-only`
- `lib/dataforseo/brand-mentions.ts` — `server-only`
- `app/actions/leads/analyze-organic-competitors.ts`
- `app/actions/leads/analyze-brand-mentions.ts`
- `supabase/migrations/20260926000000_lead_directory_citations.sql`
- `supabase/migrations/20260927000000_lead_organic_competitors.sql`
- `supabase/migrations/20260928000000_lead_brand_mentions.sql`

**Alterar**

`lib/leads/gbp.ts`, `gbp-audit.ts`, `gbp-enrichment.ts`, `gbp-grid.ts`,
`gbp-grid-competitors.ts`, `gbp-analyst-review.ts`, `gbp-opportunities.ts`,
`website-audit.ts`, `website-opportunities.ts`, `diagnosis-document.ts`,
`diagnosis-compile.ts`, `diagnosis-templates.ts`, `diagnosis-pdf.tsx`,
`digital-presence-review.ts`, `gbp-audit-rail.ts`;
`lib/website-audit/parse.ts`, `crawl.ts`, `sitemap.ts`;
`lib/dataforseo/usage.ts`; `app/actions/leads/enrich-gbp-profile.ts`,
`compile-lead-diagnosis.ts`; e os componentes dos cinco painéis.

## Critérios de aceitação

1. Um lead auditado **antes** da onda 9 mostra os achados retroativos sem
   recoletar, e nenhum achado antigo muda de texto ou de nota.
2. Um lead com snapshot SerpAPI antigo continua legível, com `few_photos` e
   `no_services` ainda suprimidos.
3. Um lead **vazio** não dispara nenhum gap novo, em nenhuma onda.
4. Duas coletas seguidas no mesmo perfil, sem mudança, geram **zero** requisição
   de foto na segunda.
5. O PDF traz, nesta ordem: capa com dados gerais completos, resumo executivo,
   pontos fortes agrupados por dimensão, pilares com oportunidades, roadmap e
   evidências.
6. Um lead com dois perfis do Google mostra os dois no PDF, com os achados
   nomeados por perfil; um lead com um perfil produz documento idêntico ao atual.
7. O `cost` devolvido pela API bate com o previsto na calculadora de Ferramentas.
8. Cada módulo puro novo continua puro: nenhum deles alcança `server-only` por
   caminho transitivo.
