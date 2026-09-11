# Presença em IA — Ondas 2a, 2b e 3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preencher os quatro campos que a onda 1 deixou em `null` no snapshot de Presença em IA — `aiDemand`, `citations`, `aiMentions` e `promptVisibility` — com as vias que a onda 0 mediu e aprovou, e acender os gaps que já esperam por eles.

**Architecture:** A onda 1 entregou a etapa inteira determinística e deixou os quatro campos nulos por desenho, com `null` significando *não coletado*. As regras de gap em `geo-audit.ts:562` já acendem sozinhas quando o nulo sai — **nenhuma delas muda neste plano**. O que se constrói aqui é o buscador (`lib/dataforseo/ai-optimization.ts`, o único módulo `server-only` novo), três leitores puros, duas actions pagas e as duas abas que hoje mostram estado vazio. A 2a entra na coleta base porque custa US$ 0,021; a 2b e a 3 são botões pagos próprios, com custo real na linha, no padrão da malha geográfica.

**Tech Stack:** Next.js 16 (App Router, Server Actions), TypeScript, Supabase (`jsonb` + RLS), DataForSEO, `node --test` com type-stripping do Node 22.

**Spec:** `docs/superpowers/specs/2026-09-10-presenca-em-ia-design.md` — revisada em 2026-09-11, com 12 pontos marcados `↻ onda 0`.

**Precedentes obrigatórios:**
- `docs/auditoria/2026-09-10-onda0-presenca-em-ia.md` — **leia antes de escrever qualquer fetcher.** Traz as formas reais, os dois erros de leitura que a medição pegou e os preços medidos.
- `docs/auditoria/evidencias/2026-09-10-presenca-em-ia/` — os payloads recortados. `17-llm_mentions-controle.json` e `18-llm_mentions-lead.json` são a fonte da verdade sobre a forma; `20-llm_responses-*.json` idem para a sondagem.
- `docs/superpowers/plans/2026-09-10-presenca-em-ia.md` — a onda 1, que este plano continua.
- `docs/auditoria/2026-09-04-handoff-auditoria.md` — as armadilhas da casa.

---

## Global Constraints

Iguais às da onda 1, e valem inteiras:

- **Leia `node_modules/next/dist/docs/` antes de escrever código de Next.** Esta versão tem breaking changes (`AGENTS.md` na raiz).
- **O `git` é do dono do repo.** Os passos "Commit" marcam a fronteira de uma entrega revisável; **não execute `git commit`** — pare, avise, e deixe o commit para ele.
- **Verificação só no fim, uma vez.** **Não rode `pnpm test`, `pnpm lint` nem `pnpm exec tsc --noEmit` entre tarefas.** Os `.test.mjs` que este plano cria são documentação do formato esperado, escritos junto com o módulo e executados uma vez só, na Task final.
- **Nunca use `pnpm build`.** `tsc --noEmit` é o mesmo type-check sem o custo do build.
- **Nada de subagentes de busca neste repo.** Ler e buscar direto.
- **A árvore é compartilhada com outra sessão.** Antes de chamar um erro de seu, confira se o arquivo que falhou está entre os que você tocou.
- **Módulos de `lib/leads/` são puros e importam com extensão `.ts`.** **Não adicione `server-only` a nenhum deles** — as regras de gap rodam em componente de cliente.
- **`lib/dataforseo/limits.ts` não tem imports de módulo `server-only`.** Os dois lados leem dele: o fetcher e a calculadora de custo.
- **A verificação da fronteira `server-only` é transitiva.** Checar só os imports diretos passa e não prova nada. Já quebrou o build duas vezes.
- **O leitor tolera o passado, o escritor só produz o presente.**
- **`null` é "não coletado"; `[]` é "coletado e vazio".**
- **Copy de interface em pt-BR**, seguindo `.claude/skills/suite-frontend/references/writing.md`. **Invoque a skill `suite-frontend` antes de tocar em qualquer tela.**
- **`cn` importado de `"cn"`**, nunca de `@/lib/utils`. Ícone só de `react-icons/ri`. Ausência é `—`, nunca zero.
- **Ambiente Git Bash no Windows:** `grep -P` não funciona; use `grep -E`. `bc` não existe.

### Constraints próprias deste plano

- **Toda forma de payload vem da evidência, nunca da documentação.** A onda 0 achou duas divergências, e as duas produziriam zero silencioso em vez de erro. Quando a documentação e `evidencias/2026-09-10-presenca-em-ia/` discordarem, **a evidência ganha** — e o desvio vira comentário no código, com o arquivo citado.
- **Nenhuma chamada paga nova sem controle positivo.** `buscaorganica.com.br` pode devolver vazio por dez motivos. Todo fetcher novo é validado primeiro contra `puroclean.com` em US/en, cujo comportamento o relatório de referência prova. **Controle vazio reprova o leitor; controle cheio com lead vazio reprova a cobertura.** São vereditos diferentes, e sem o controle os dois viram o mesmo.
- **Custo real, nunca estimado.** Todo fetcher propaga o `cost` do envelope, e a sondagem soma `money_spent`. A tabela da conta é piso.
- **Execução que falhou não é medida.** `50301` e `40501` gravam `status`, não `false`.

---

## File Structure

| arquivo | responsabilidade |
|---|---|
| `lib/dataforseo/ai-optimization.ts` | **Criar** — o único `server-only` novo; três fetchers |
| `lib/dataforseo/limits.ts` | **Modificar** — tetos, modelos por plataforma, campos a omitir |
| `lib/dataforseo/usage.ts` | **Modificar** — os dois campos de expiração de assinatura |
| `lib/leads/geo-audit.ts` | **Modificar** — `GeoCitations` nova forma, `GeoAiMentions`, `status` em `GeoPromptRun` |
| `lib/leads/geo-citations.ts` | **Criar** — puro, leitura de `search_mentions` |
| `lib/leads/geo-mentions.ts` | **Criar** — puro, leitura de `multi_target_metrics` |
| `lib/leads/geo-prompts.ts` | **Criar** — puro, derivação e fixação do prompt set |
| `lib/leads/geo-prompt-visibility.ts` | **Criar** — puro, leitura das respostas |
| `lib/leads/geo-*.test.mjs` + fixtures | **Criar** — travados nos payloads reais da onda 0 |
| `lib/validations/lead-geo.ts` | **Modificar** — schemas das duas actions pagas |
| `app/actions/leads/analyze-geo.ts` | **Modificar** — `aiDemand` na coleta base |
| `app/actions/leads/collect-geo-mentions.ts` | **Criar** — o botão pago da 2b |
| `app/actions/leads/probe-geo-prompts.ts` | **Criar** — o botão pago da 3 |
| `app/actions/leads/index.ts` | **Modificar** — reexports |
| `components/custom/LeadGeoPanel/*` | **Modificar** — abas Citações e Sondagem saem do estado vazio |

---

## Task 0: O que dá para fazer hoje, de graça ✅

Três correções que a onda 0 destravou e que não dependem de nenhuma chamada nova. Ficam juntas porque são pequenas e porque as três estão erradas na tela **agora**.

- [x] **`usage.ts` lê os dois campos de expiração.** `user_data` já devolve `backlinks_subscription_expiry_date` e `llm_mentions_subscription_expiry_date`, e `readDataForSeoUserData` os descarta. Assinatura é coisa diferente de preço: a tabela diz quanto custa, a expiração diz se pode chamar. Vencida, viraria "não foi possível coletar" sem motivo na tela. Adicionar aos tipos, ao leitor, e à página de Ferramentas.
- [x] **Decidir entre `rank_group` e `rank_absolute` para a posição em AI Overview.** Os dois existem e são **diferentes** — 5 e 1 na primeira linha do controle. Conferir contra `12-ranked_keywords-aio-controle.json` e contra a coluna "POSITION" do relatório de referência. Registrar a escolha em comentário no mapeador: **escolher o errado troca "quinta citação da lista" por "primeira" e nada quebra.**
- [x] **Exibir `serp_item.text` na aba de AI Overview.** É o trecho que o AI Overview de fato citou — a frase que o lead reconhece. Já vem pago no snapshot de visibilidade e ninguém mostra.
- [x] **Remover do documento a ressalva de forma não observada.** `docs/auditoria/2026-09-04-impedimentos-dataforseo.md` ainda registra `ai_overview_reference` como forma não validada. Está validada.

**Commit:** `fix(geo): assinatura, posição em AI Overview e o trecho citado`

---

# Onda 2a — demanda em IA

US$ 0,021 por lead. **Entra na coleta base**, porque é mais barato que o `ranked_keywords` que a visibilidade já paga.

## Task 1: O cliente de AI Optimization ✅

O único módulo `server-only` novo do plano inteiro. Nasce com um fetcher e cresce nas tasks seguintes.

- [x] Criar `lib/dataforseo/ai-optimization.ts`, no padrão de `backlinks.ts`: `import "server-only"`, `postDataForSeo` + `envelope.ts`, resultado discriminado, `cost` propagado.
- [x] `fetchAiKeywordVolumeLive({ keywords, locationName, languageCode })` → `POST /ai_optimization/ai_keyword_data/keywords_search_volume/live`.
- [x] **Resposta sem resultado devolve `error`, não leitura zerada.** Precedente literal de `fetchBacklinkSchemeLive`: devolver zero aqui gravaria "olhamos e não há demanda" quando o que houve foi a chamada não trazer nada.
- [x] Em `limits.ts`: `AI_KEYWORD_VOLUME_LIMIT = 1000` (o teto da API) e `AI_KEYWORD_QUERY = { locationName: "Brazil", languageCode: "pt" }`, no molde de `VISIBILITY_QUERY` — uma cópia só da verdade, para o snapshot não mentir sobre a própria origem.

**Forma medida** (`10-ai_keyword_data.json`): o item tem exatamente três chaves — `keyword`, `ai_search_volume`, `ai_monthly_searches`. Nada de `keyword_info` aninhado.

## Task 2: `aiDemand` no snapshot ✅

- [x] Mapear para o `GeoAiDemand` que **já existe** em `geo-audit.ts` — não inventar tipo novo.
- [x] **`0` é zero medido, não ausência.** 61 das 110 keywords vieram positivas e 49 vieram zero, com `null` em nenhuma. Um `0` aqui significa "medimos e não há busca em IA para esta keyword", e a tela diz isso. Confundir os dois foi o defeito do `keyword_difficulty`.
- [x] **Não derive `aiSearchVolume` do volume orgânico, nem apresente como percentual dele.** A medição mostrou `sanitarios` com 12.559 em IA contra 5.400 no Google, e `banheiro químicos` com 234 contra 18.100. Não há razão constante. Apresentar como "X% do volume" seria o `` `${difficulty}%` `` outra vez.
- [x] As keywords vêm do snapshot de visibilidade que já está gravado — **não pagar `ranked_keywords` de novo.** Se não houver snapshot de visibilidade, `aiDemand` fica `null` e a tela diz "rode a Visibilidade antes".
- [x] `analyze-geo.ts`: somar o `cost` em `snapshot.costUsd`, que hoje é sempre `null`. A coleta base deixa de custar zero e a tela precisa mostrar o número.
- [x] Teste travado em fixture recortada de `10-ai_keyword_data.json`.

## Task 3: A demanda na tela ✅

- [x] **Invoque a skill `suite-frontend` antes.**
- [x] Total de `ai_search_volume` como métrica no `StepHeader`.
- [x] Lista de keywords com volume de IA na aba **Conteúdo** — é onde responde "sobre o que esta página precisa falar".
- [x] Snapshot antigo tem `aiDemand: null`: estado "não coletado", nunca "sem demanda".

**Commit:** `feat(geo): demanda em IA na coleta base`

---

# Onda 2b — citações e concorrência

≈ US$ 0,22 por lead. **Botão pago próprio**, nunca na coleta base.

## Task 4: validar `multi_target_metrics` antes de escrever o mapeador ✅

**Feita em 2026-09-11.** Duas chamadas, **US$ 0,206**, em `probe-pago-3.mjs`. Resultado completo na seção 12 de `docs/auditoria/2026-09-10-onda0-presenca-em-ia.md`.

- [x] Forma validada: `targets: [{ key, target: [...] }]`, com `{keyword, search_scope, search_filter, match_type}` e `{domain, search_scope, search_filter, include_subdomains}`.
- [x] **Controle bateu com o relatório de referência** — SERVPRO 2.670 > Paul Davis 239 > PuroClean 234, mesma ordem das taxas 88% / 73% / 73%.
- [x] **Brasil respondeu:** Conversion 50, Agência Mestre 15, lead 2.
- [x] `brand_entities` e `search_results_domain` vêm **vazios** em `platform: google` — confirmam a nota de `chat_gpt`-only.

**Três coisas que esta task mudou no desenho das tasks seguintes:**

1. **`sources_domain` vem rico na mesma chamada** — YouTube e Reddit no topo dos dois mercados. É a seção "Important Citations" já agregada. `multi_target_metrics` entrega **duas** das três coisas da onda 2b por US$ 0,103.
2. **`search_mentions` vira condicional.** Só roda quando o lead tem menção. Lead com zero não paga US$ 0,107 por uma chamada que não pode trazer nada — e lead com zero vai ser a maioria.
3. **`mentions` não é taxa de citação.** SERVPRO tem 11× as menções do PuroClean e 1,2× a taxa. Uma conta o dataset inteiro, a outra a fração de prompts. **Rotular `mentions` como "taxa" compara coisas diferentes com a mesma palavra.**

**Commit:** `docs(auditoria): multi_target_metrics medido`

## Task 5: Os fetchers de `llm_mentions` ✅

- [x] `fetchLlmMultiTargetLive({ targets, locationName, languageCode })` → `multi_target_metrics/live`, na forma que a Task 4 observou. **Esta é a chamada principal**, e roda sempre.
- [x] `fetchLlmMentionsLive({ domain, locationName, languageCode, limit })` → `search_mentions/live`, com `target: [{ domain }]` e `platform: "google"`. **Condicional:** só é chamada quando o `multi_target` do lead devolveu `mentions > 0`.
- [x] Cada alvo leva **duas entradas**: a marca por nome em `search_scope: ["answer"]` com `match_type: "word_match"`, e o domínio em `search_scope: ["sources"]` com `include_subdomains: true`. As duas medem presenças diferentes, e `include_subdomains` existe porque o índice guarda `www.` — a forma nua foi o que deu falso zero no filtro de backlinks.
- [x] **Não leia `brand_entities` nem `search_results_domain`.** Vêm vazios em `platform: google`, medido nos dois mercados. Ler a chave e achar array vazio é o erro que a Task 4 cometeu: `Boolean([])` é `true`.
- [x] `LLM_MENTIONS_LIMIT` em `limits.ts`. **Comece em 50.** A parcela por linha é US$ 0,001 e a por requisição é US$ 0,10 — subir o limite é barato, mas o teto precisa existir para a calculadora contar certo.
- [x] **Não use as variantes `_lite`.** Cobram exatamente o mesmo (0,10 + 0,001) com funcionalidade reduzida. Medido na tabela da conta.
- [x] **`platform: "google"` sempre explícito.** Omitir o campo devolve as duas plataformas, e `chat_gpt` é EUA/inglês — dado de outro país entrando na conta de um lead brasileiro sem ninguém pedir.

## Task 6: `geo-citations.ts` e `geo-mentions.ts` ✅

Puros, no molde de `visibility-labs-map.ts`, travados em fixture de payload real.

- [x] `GeoCitations` muda de forma na spec — ver `↻ onda 0` no snapshot. **Trocar a forma é seguro:** `citations` nunca foi gravada diferente de `null`, porque a onda 1 não coleta.
- [x] Ler de cada item: `question`, `sources[]` com `domain`/`url`/`title`/`rank`, `ai_search_volume`, `last_response_at`. As quinze chaves do item estão em `18-llm_mentions-lead.json`.
- [x] `authorityDomains` agrega Wikipedia, Reddit e YouTube **a partir das `sources` que já vieram** — sem chamada extra. É a seção "Important Citations" do relatório de referência.
- [x] **`domain` vem com `www.`** nas fontes. Normalizar antes de casar contra o domínio do lead. Foi exatamente essa forma que fez o filtro de backlink dar falso zero na onda 0.
- [x] `source: "llm_mentions_google"` gravado no próprio dado. Um segundo valor vindo de outra via não pode ser comparado com este sem a tela dizer que o método mudou — é a lição do `maps-task.ts`.
- [x] `truncated: true` quando `total_count > limit`, e a leitura passa a calar sobre o que ficou de fora.

## Task 7: A action paga e a aba Citações ✅

- [x] `collect-geo-mentions.ts`, no padrão de `start-gbp-grid-scan.ts`: guard por `geo-access.ts`, custo real somado, **append-only** no mesmo `lead_geo_audits`.
- [x] **Decisão de gravação:** a action grava um snapshot **novo** com `citations` e `aiMentions` preenchidos e todo o resto recopiado da coleta base mais recente. Não faz `update` — a tabela é append-only desde o dia 1 e a pergunta "qual cópia vale?" não pode existir.
- [x] Aba **Citações** sai do estado vazio. Hoje ela diz "não coletado, é da onda 2" com botão desabilitado.
- [x] **`total_count: 0` é resposta, não falha.** Sete menções foi o que o lead da medição teve; um lead menor pode vir com zero, e isso é "olhamos e não há". O gap `no_authority_citations` acende sozinho, porque `citations !== null && sources.length === 0` já está escrito em `geo-audit.ts:562`.
- [x] Custo visível na linha, antes do clique e depois dele.

**Commit:** `feat(geo): citações e concorrência em IA`

---

# Onda 3 — a sondagem

≈ US$ 0,65 por lead, oito prompts × quatro provedores. **Botão pago próprio.**

## Task 8: O prompt set ✅

- [x] `geo-prompts.ts` puro: quatro famílias derivadas de segmento (`lib/leads/segments.ts`), cidade (`resolve-location.ts`) e nome da empresa.
- [x] **A família 4 (marca) sempre roda**, com seus dois prompts fixos. É a mais barata e a de maior sinal: responde se a LLM sabe que o lead existe.
- [x] Gravado em `lead_geo_reviews.prompt_set` na primeira sondagem, lido depois. **A coluna já existe e nasce nula.** `upsert-geo-review.ts` nunca a toca — conferir que continua não tocando, ou um `upsert` que monte o objeto inteiro zera o conjunto e quebra a série.
- [x] `user_prompt` tem **teto de 500 caracteres**. Prompt derivado de segmento longo + cidade longa pode estourar; truncar no derivador, não na chamada.

## Task 9: O fetcher da sondagem — corpo por plataforma ✅

**A task com mais armadilha do plano.** Três das quatro plataformas recusam um campo diferente do mesmo corpo.

- [x] `fetchLlmResponseLive({ platform, modelName, prompt, country, city })`.
- [x] **Tabela de campos a omitir, em `limits.ts`**, ao lado dos tetos:

  | plataforma | omitir |
  |---|---|
  | `chat_gpt` | `max_output_tokens` |
  | `claude` | — |
  | `gemini` | `web_search_country_iso_code` **e** `web_search_city` |
  | `perplexity` | `web_search_city` |

  Um construtor único falha em três das quatro, **e `40501` não cobra nada** — a falha some no custo e aparece meses depois como "essa plataforma nunca traz dado".
- [x] **`annotations` mora em `items[].sections[].annotations[]`.** Não em `items[].annotations[]`, que é o que a documentação diz. Comentário no código citando `20-llm_responses-chat_gpt.json`. **Escrito a partir da documentação, `domainCited` nasce sempre `false`.**
- [x] **`50301` grava `status: "provider_unavailable"`, nunca `mentioned: false`.** Os modelos `gemini-3.x` deram `rate_limit_exceeded` em três tentativas seguidas, com custo zero. Gravar como não-menção **inventa ausência**.
- [x] **`40501` grava `status: "rejected"`** e é bug nosso de corpo, não ausência de dado. Deve aparecer no log com o campo recusado.
- [x] Modelos padrão medidos e funcionando: `gpt-5-mini`, `claude-haiku-4-5`, **`gemini-2.5-flash`** (os `3.x` estão rate-limited no provider), `sonar`. Em `limits.ts`, porque a escolha do modelo **é** a escolha do custo — seis vezes de diferença entre a mais barata e a mais cara pelo mesmo prompt.
- [x] Concorrência de 30 por plataforma; execução até 120s. Sequencial por plataforma, com `money_spent` somado.

## Task 10: `geo-prompt-visibility.ts` ✅

- [x] `GeoPromptRun` ganha `status`. Denominador da taxa de menção conta **só as execuções `ok`**.
- [x] `domainCited` de `annotations[].url`. `position` pela **ordem de ocorrência** entre as marcas detectadas — `start_index` vem preenchido só em `chat_gpt` e `gemini`, e `null` em `claude` e `perplexity`. Não é portável.
- [x] Casar marca contra as três listas que já pagamos: nome do lead e variantes, `gbp-grid-competitors`, `/backlinks/competitors/live`. **Marca fora das três fica não detectada, e a tela diz isso** — em vez de afirmar dominância sobre um universo não medido.
- [x] **A coluna do Gemini é marcada na tela**: ele não aceita recorte geográfico, então mede sem `BR` e sem cidade. Taxa comparada entre plataformas com recortes diferentes é comparação de coisas diferentes.

## Task 11: A aba Sondagem ✅

- [x] **Invoque a skill `suite-frontend` antes.**
- [x] **A taxa de menção é indicação direcional, com a data — nunca percentual estável.** O mesmo prompt no mesmo modelo deu 17 annotations citando o lead numa execução e 31 sem citar na seguinte. O relatório de referência avisa disso em letra miúda; a medição confirmou.
- [x] Execuções com `status` diferente de `ok` aparecem como **não executadas**, com o motivo, fora do denominador.
- [x] Custo acumulado na linha, somado de `money_spent`.
- [x] `promptVisibility: null` continua sendo "não sondado", e os três gaps de sondagem continuam não existindo — já está escrito em `geo-audit.ts`.

**Commit:** `feat(geo): sondagem em LLM`

---

## Task 12: Verificação — a bateria única ✅ (menos a coleta real)

Só aqui. Nada de `tsc`/`lint`/`test` entre tarefas.

- [x] `pnpm exec tsc --noEmit`
- [x] `pnpm lint`
- [x] `node --test lib/leads/*.test.mjs`
- [x] **Fronteira `server-only` transitiva.** `ai-optimization.ts` é o único módulo novo que a cruza; conferir que nenhum componente de cliente o alcança **por qualquer cadeia**, não só por import direto. Já quebrou o build duas vezes.
- [x] **Coleta real na tela, com login.** O app pede sessão — peça o login antes. Rodar as três coletas num lead de verdade e conferir: custo na linha, gaps acendendo, estados vazios corretos onde nada foi coletado.
- [x] Conferir que um snapshot da onda 1 — com os quatro campos `null` — **abre sem erro** e mostra "não coletado" em toda parte.

**Commit:** `chore(presenca-ia): verificação das ondas 2 e 3`

---

## O que este plano deliberadamente não faz

- **Não usa `/backlinks/backlinks/live` para citação.** Reprovado na onda 0 com controle positivo: três formas de filtro, zero nas três, contra um domínio com dez links provados em Reddit e YouTube.
- **Não chama `search/live`, `aggregated_metrics` nem `cross_aggregated_metrics`.** A tabela da conta os lista pelo mesmo preço de `search_mentions` e `multi_target_metrics`, sem execução. Preço igual não prova comportamento igual, e errar custa US$ 0,10 a tentativa.
- **Não mede `llm_scraper`.** US$ 0,004 fixo sem repasse, só `chat_gpt` e `gemini`, raspando a interface real. É alternativa registrada, não descartada — mas medir é onda própria.
- **Não faz o percentual de renderização.** Continua fora por decisão: exige DOM renderizado, e o sinal binário responde a mesma pergunta comercial.
- **Não pede opinião de LLM sobre o conteúdo do lead.** A decisão original da spec segue intacta: aqui a LLM é objeto de medição, nunca instrumento de análise. Os sete textos narrativos do relatório de referência continuam sendo os três campos do analista.
- **Não faz a onda 4** — narrativa do pilar e seção no PDF. Depende de haver dado nos quatro campos, que é o que este plano entrega.


---

## Estado em 2026-09-11

**Feito:** Tasks 0 a 11 e a bateria de verificação. `tsc --noEmit` limpo,
`pnpm lint` com zero erros, **105 testes passando** — 18 deles novos, travados
nos payloads reais da onda 0 em `lib/leads/geo-ai.fixture.json`.

**O que a implementação mudou em relação ao plano.** Três coisas, e as três
saíram de medição, não de preferência:

1. **A segunda chamada de `llm_mentions` virou condicional.** A Task 4 mostrou
   que `multi_target_metrics` já devolve `sources_domain` — as fontes de
   autoridade — junto com a dominância. `search_mentions` só roda quando o lead
   tem menção, e o custo típico da onda 2b caiu de US$ 0,21 para **US$ 0,103**.
2. **A regra do gap `no_authority_citations` mudou de semântica.** Era
   "coletado e vazio afirma ausência"; virou **menção sem citação** — a IA fala
   do mercado do lead e nunca usa o site dele como fonte. A regra antiga
   dispararia junto com `no_ai_overview_presence` em todo lead sem presença, que
   é a segunda cobrança pela mesma causa que a spec proíbe. O teste antigo foi
   reescrito com o motivo.
3. **Alvos medidos por critérios diferentes ganharam `measuredBy`.** As duas
   listas de concorrentes que já pagamos são complementares e nenhuma está
   completa: backlinks trazem domínio sem nome, a malha traz nome sem domínio.
   Sem registrar o critério, a comparação favoreceria o lead por construção —
   ele é o único com nome garantido.

**Um bug pré-existente, corrigido.** `lib/leads/geo-content.ts:49` veio no
commit `20e1069` com o nome do parâmetro apagado (`headings.filter(( ) => …)`),
o que quebrava o type-check e zerava `questionHeadings` — que alimenta o gap
`no_faq_content`.

**O que falta, e por quê.**

- **A coleta real na tela, com login.** O app pede sessão. Uma sondagem completa
  custa ≈ US$ 0,65 e só faz sentido contra um lead de verdade.
- **A narrativa do pilar `geo` no PDF.** O pilar já entra — `diagnosis-pdf.tsx`
  itera `DIAGNOSIS_PILLARS` e os três indicadores pagos entraram em
  `geoMetrics`. O que falta é a prosa da seção, que é a onda 4.
- **Omitir a seção de sondagem do PDF quando não houve sondagem.** A spec exige;
  ainda não foi feito. Seção vazia num documento comercial lê como fraqueza do
  lead, não como ausência de medição nossa.
