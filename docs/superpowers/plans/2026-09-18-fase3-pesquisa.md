# Fase 3 — Pesquisa — Plano de Implementação

> **Estado em 2026-09-18. Task 1 concluída** — nove chamadas, US$ 0,2248, contra
> Léo Tintas / Itu. As sete perguntas estão respondidas em
> `../../auditoria/evidencias/2026-09-18-fase3-pesquisa/README.md`.
>
> **Três coisas que a sondagem mudou e que valem como aviso:**
>
> 1. **O Labs só aceita país.** São 94 localidades no mundo e **uma** para o
>    Brasil. Cidade só existe na SERP. Pedir cidade ao Labs devolve `40501`. O
>    keyword gap é nacional e precisa de validação por SERP local depois.
> 2. **`competitors_domain` devolveu `instagram.com`, `cnpj.biz` e o próprio
>    domínio do cliente** entre os dez "concorrentes" — nenhuma loja do ramo.
>    A Task 6 mudou de fonte por causa disso.
> 3. **`search_volume` separado é desperdício** — o dado já vem na expansão.
>    Saiu da Task 5.

> **Para executores agênticos:** SUB-SKILL OBRIGATÓRIA: use
> `superpowers:subagent-driven-development` ou `superpowers:executing-plans`
> para executar task a task. Os passos usam checkbox (`- [ ]`).

**Goal:** Construir a pesquisa de mercado e SERP que roda depois do onboarding,
lê briefing + auditoria, e devolve clusters temáticos, matriz tema × local e
veredito por keyword para a Fase 4 decidir.

**Architecture:** Treze tasks em ordem de dependência e custo crescente. A Task 1
é sondagem: gasta pouco, não produz funcionalidade e **trava a forma dos
mapeadores**. As Tasks 2–7 e 9–11 são regra pura sobre dado já pago ou já
gravado. Só a Task 8 gasta em volume, e é a única que precisa de fila, lease e
teto. Os pilares E, F e H1 (deep-research) **não estão neste plano** — dependem
da decisão pendente nº 1 da spec.

**Tech Stack:** Next.js (App Router, Server Actions), React, TypeScript,
Supabase, DataForSEO API v3, `node --test` sobre `.mjs`.

**Spec:** `../specs/2026-09-18-fase3-pesquisa-design.md`

## Global Constraints

- **Módulo testável não usa alias nem `server-only`.** Os testes são `.mjs`
  rodados por `node --test` e importam o `.ts` direto. Import relativo **com
  extensão** (`"./research-cluster.ts"`), nunca `"@/lib/..."`. O padrão está em
  `lib/dataforseo/maps-task.ts`.
- **Fronteira `server-only` é transitiva.** Cada módulo puro novo é verificado
  até a raiz, não só nos imports diretos. Já quebrou o build duas vezes.
- **Nenhuma task commita.** Escreva os arquivos e pare. O `git` é do dono do
  repositório.
- **Verificação uma vez, no fim.** Não rode `tsc` nem `lint` entre tasks. Os
  testes `.mjs` da própria task, sim — eles são o ciclo da task. A bateria
  completa é a Task 13.
- **Migrations reexecutáveis:** `if not exists`, `drop policy if exists` antes
  de cada `create policy`.
- **Leitor tolera o passado.** Campo novo entra opcional. `null` é não
  coletado, `[]` é coletado e vazio, e nenhum dos dois vira zero.
- **Nenhuma tarefa paga é refeita.** Identificador gravado **antes** de
  qualquer outra escrita; `tag` lido de `tasks[i].data.tag`, nunca do nível da
  tarefa. Isto é a lição do incidente da malha, que cobrou treze vezes o mesmo
  trabalho.
- **`failed` e resultado vazio são coisas diferentes.** SERP que falhou não é
  keyword sem resultado. Confundir os dois faz o clustering tratar a keyword
  como órfã e inventar cluster de um item só.
- **A máquina não escreve em review de analista.** Campo em branco do analista
  não vira veredito.
- **Preço nunca no código.** Sai de `GET /v3/appendix/user_data`, gratuito.
- **Idioma:** interface, comentário e mensagem de erro em português do Brasil.
- **Pacotes com `pnpm`**, nunca `npm`.
- Comentário explica **por quê**, não o quê.
- **Roda um teste só assim:**
  `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/caminho/arquivo.test.mjs`

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `docs/auditoria/evidencias/2026-09-18-fase3-pesquisa/probe-pesquisa.mjs` | sondagem descartável, sete perguntas | 1 |
| `docs/auditoria/evidencias/2026-09-18-fase3-pesquisa/README.md` | as respostas medidas | 1 |
| `lib/dataforseo/keyword-expansion.fixture.json` | sete itens reais do dump de 4.831 | 4 |
| `supabase/migrations/20260929000000_client_research.sql` | tabelas de pesquisa | 2 |
| `lib/research/types.ts` | tipos compartilhados, **puro** | 2 |
| `lib/research/briefing-input.ts` | briefing → entrada validada, **puro** | 3 |
| `lib/dataforseo/keyword-expansion.ts` | as quatro chamadas de expansão | 4 |
| `lib/dataforseo/competitors-domain.ts` | concorrentes orgânicos | 6 |
| `lib/dataforseo/domain-intersection.ts` | keyword gap | 6 |
| `lib/research/candidate-pool.ts` | dedup e normalização, **puro** | 5 |
| `lib/research/competitor-sources.ts` | as quatro fontes → lista canônica, **puro** | 6 |
| `lib/research/candidate-filter.ts` | filtro e teto antes da SERP, **puro** | 7 |
| `lib/dataforseo/serp-organic.ts` | leitor da SERP, **puro** — 3 usos numa resposta | 6 |
| `lib/dataforseo/serp-organic.fixture.json` | SERP real de Itu | 6 |
| `lib/dataforseo/competitors-domain.fixture.json` | os dez "concorrentes" medidos | 6 |
| `lib/dataforseo/domain-intersection.fixture.json` | o gap medido, par a par | 6 |
| `app/actions/clients/research-serp.ts` | enfileira, faz lease, coleta | 8 |
| `lib/research/cluster.ts` | overlap → clusters, **puro** | 9 |
| `lib/research/locality.ts` | prova de eixo e sonda de bairro, **puro** | 10 |
| `lib/research/verdict.ts` | veredito por keyword, **puro** | 11 |
| `lib/research/research-review.ts` | julgamento do analista | 12 |
| `components/custom/ClientResearch*/` | apresentação | 12 |

---

## Task 1: Onda 0 — sondagem antes de mapeador

Esta task gasta dinheiro e produz as fixtures que travam as Tasks 4, 6 e 8.

Ela existe porque o repositório já pagou por supor forma de payload: o
`mapRankedKeywordsLiveResult` viveu seis meses contra documentação e três campos
estavam errados quando enfim rodou. Ver
`../../auditoria/2026-09-04-impedimentos-dataforseo.md`.

**Files:**
- Create: `docs/auditoria/evidencias/2026-09-18-fase3-pesquisa/probe-pesquisa.mjs`
- Create: `docs/auditoria/evidencias/2026-09-18-fase3-pesquisa/README.md`
- Create: as fixtures em `lib/research/`

**Interfaces:**
- Consumes: nada.
- Produces: fixtures reais e as respostas das sete perguntas.

**Custo:** teto de US$ 0,15, imposto pelo próprio script. Nenhuma outra task até
a 8 chama API paga.

- [x] **Step 1: Escrever o script com as sete perguntas**

Na ordem em que podem matar o desenho:

1. **`keywords_for_keywords` devolve `monthly_searches` com 12 meses no mesmo
   payload?** A spec promete sazonalidade de graça. Se o histórico exigir
   chamada separada, o pilar A deixa de ser grátis e a conta muda.
2. **O item de SERP orgânica traz a URL completa, ou só domínio?** O clustering
   inteiro depende de URL exata. Se vier só domínio, o método de agrupamento
   precisa ser repensado antes de escrever qualquer código.
3. **`people_also_ask` vem no mesmo payload da SERP orgânica, ou é item
   separado?** Decide se o pilar D custa uma chamada ou duas por keyword — com
   teto de 200, isso dobra ou não dobra o custo da fase.
4. **Qual o teto real de keywords por chamada em lote** de `search_volume` e de
   `search_intent`? Define quantas chamadas a Task 5 faz.
5. **`domain_intersection` aceita vários domínios de uma vez, ou é par a par?**
   Multiplica ou não por N concorrentes.
6. **`competitors_domain` devolve o domínio do concorrente com métrica de
   intersecção**, ou só o domínio?
7. **`location_code` de cidade + `language_code` resolve o `languageMismatch`**
   que aparece hoje no `visibility_audit`? É o problema 2 da spec.

O script aceita `--offline` para re-derivar o veredito dos dumps sem pagar, como
o `probe-migracao.mjs` já faz.

- [x] **Step 2: Rodar contra um cliente real e gravar os dumps**
- [x] **Step 3: Escrever o README com as respostas medidas, não supostas**

Cada resposta cita o caminho do campo no payload. "Sim" sem caminho não conta.

---

## Task 2: Migration e tipos

**Files:**
- Create: `supabase/migrations/20260929000000_client_research.sql`
- Create: `lib/research/types.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `ClientResearchSnapshot`, `ResearchCandidate`, `ResearchCluster`.

- [x] **Step 1: Migration**

Duas tabelas, no padrão já estabelecido por `lead_visibility_audits` /
`lead_visibility_reviews`:

- `client_research_audits` — snapshot append-only. Colunas: `id`, `client_id`,
  `briefing_fingerprint`, `snapshot` jsonb, `cost_usd`, `fetched_at`,
  `fetched_by`.
- `client_research_reviews` — julgamento do analista, separado. Recoletar não
  pode apagá-lo nem duplicá-lo.

`briefing_fingerprint` é o que liga a pesquisa à versão do briefing que a
originou. Sem ele não há como saber que a pesquisa está defasada — e o briefing
é editável por definição.

RLS no padrão das tabelas de cliente. `drop policy if exists` antes de cada
`create policy`.

- [x] **Step 2: Tipos**

Campo novo entra opcional. `null` é não coletado, `[]` é coletado e vazio.

---

## Task 3: Contrato de entrada

**Files:**
- Create: `lib/research/briefing-input.ts`
- Create: `lib/research/briefing-input.test.mjs`

**Interfaces:**
- Consumes: `client_briefing_steps`, `client_briefing_exports`.
- Produces: `ResearchInput` ou lista de motivos de recusa.

- [x] **Step 1: Validação**

A pesquisa **recusa rodar** e diz por quê quando:

- não há `primaryKeyword`
- `keywords` está vazio ou passa de 50
- cidades não estão enumeradas — `["Todas"]` é o valor que o cadastro aceita
  hoje e que **não gera combo nenhum**
- bairros presentes mas não enumerados (`["Todos"]`)

Bairro ausente **não** é erro: o eixo existe sempre no modelo, e o custo só
aparece quando há dado.

- [x] **Step 2: Testes**

Um caso por motivo de recusa, mais o caminho feliz com e sem bairro.

---

## Task 4: Módulos de expansão

**Files:**
- Create: `lib/dataforseo/keyword-expansion.ts` — **puro**, sem `server-only`,
  como `maps-task.ts`. A chamada de rede é de `client.ts`.
- Create: `lib/dataforseo/keyword-expansion.fixture.json`
- Create: `lib/dataforseo/keyword-expansion.test.mjs`

**Interfaces:**
- Consumes: dumps da Task 1.
- Produces: `ExpandedKeyword[]`, mais `yearlyVolume()` e `peakMonth()`.

- [x] **Step 1: `keywords_for_keywords`** — o único medido

Construtor que fatia os 50 seeds em lotes, e leitor do envelope. A fixture saiu
do dump da Task 1 (`keyword-expansion.fixture.json`, sete itens escolhidos por
cobrirem formas distintas do dump de 4.831).

Duas coisas que o payload real ensinou e estão travadas por teste:

- **`null` e `0` não se misturam.** 1.514 candidatas vieram com `search_volume`
  nulo e 1.274 com zero. Um `?? 0` jogaria 31% do conjunto na cesta de "sem
  busca" e faria o veredito da Task 11 mentir.
- **`keywords_data` devolve em `tasks[].result[]` direto**, não em
  `result[0].items[]` como o Labs. Ler a forma errada devolve lista vazia sem
  erro nenhum.

- [x] **Step 2: Testes contra a fixture** — 21 casos

- [x] **Step 3: `keyword_ideas`** — sondado e escrito

Sondagem complementar (`probe-pesquisa-parte4.mjs`, US$ 0,036) mediu o ganho
marginal em vez de só a forma: **144 dos 200 itens eram inéditos (72%)** contra
as 4.669 já pagas, e o que apareceu foi categoria inteira que faltava — marcas
de tinta (`suvinil`, `coral`, `acrilex`), que seeds genéricos não alcançam.

A forma difere em três pontos, todos silenciosos se ignorados: aninhamento em
`result[0].items[]`, métricas dentro de `keyword_info`, e `competition` como
número com o rótulo em `competition_level`. Há teste para cada um, mais um que
prova que os dois leitores **não se cruzam** e que produzem o mesmo formato.

- [x] **Step 4: Teto de seeds — medido, não suposto**

50 seeds numa chamada devolve `40501 ... Max number exceeded (20/21)`, de graça.
`KEYWORDS_FOR_KEYWORDS_MAX_SEEDS = 20` deixou de ser valor de documentação.
**50 seeds = três chamadas = US$ 0,27**, não US$ 0,09.

- [~] **Step 5: `keyword_suggestions` e `related_keywords` — cortados**

Não entram. `keyword_suggestions` traz long-tail **contendo** o seed e
`related_keywords` o grafo de relacionadas — ambos em boa parte cobertos pelas
4.831 que a expansão já devolve de graça. O gargalo da fase não é quantidade de
candidata (o funil já é 1:100 até o teto de 200 SERPs), é qualidade do topo, e
`keyword_ideas` era o único dos três capaz de trazer o que os outros
estruturalmente não trazem.

Reabrir só se o pool da Task 5 sair pobre para algum nicho — e aí com sondagem
antes, nunca supondo forma.

---

## Task 5: Pool de candidatas

**Files:**
- Create: `lib/research/candidate-pool.ts`
- Create: `lib/research/candidate-pool.test.mjs`

- [x] **Step 1: Dedup e normalização**

As quatro fontes se sobrepõem muito. Normalizar caixa, acento e espaço; manter a
grafia de maior volume; registrar **de qual fonte cada candidata veio** — isso
alimenta o relatório ("quantas o cliente não conhecia").

Seed do briefing nunca é descartada no dedup, mesmo com volume zero: ela precisa
chegar à Task 11 para receber veredito.

- [x] **Step 2: Search intent em lote**

**Não peça `search_volume`.** A sondagem mediu: `keywords_for_keywords` devolve
`search_volume` e `monthly_searches` (12 meses) no mesmo payload, e a chamada
separada custa outros US$ 0,09 pelo dado que já está na mão.

`search_intent` aceita lote de 20 por US$ 0,0144 e devolve `keyword_intent`
mais `secondary_keyword_intents`. **Só país** — o Labs não tem cidade.

---

## Task 6: Concorrentes e keyword gap

**Files:**
- Create: `lib/dataforseo/competitors-domain.ts`
- Create: `lib/dataforseo/domain-intersection.ts`
- Create: `lib/research/competitor-sources.ts`
- Create: `lib/research/competitor-sources.test.mjs`

- [x] **Step 1: Lista canônica — a SERP manda**

> Esta task mudou depois da sondagem. A versão anterior tirava o gap do
> `competitors_domain`, e medido no cliente real ele devolveu `instagram.com`,
> `facebook.com`, `youtube.com`, `cnpj.biz`, `serasaexperian.com.br` e **o
> próprio `leotintas.com.br`** entre os dez — zero lojas de tinta.

A causa é estrutural, não deste cliente: `competitors_domain` parte do perfil
orgânico do alvo, e alvo que rankeia quase só para termo de marca tem por
vizinhos rede social, diretório e base de CNPJ.

**Fonte primária: o top 10 orgânico das keywords-alvo**, que a Task 8 já coleta.
Concorrente é quem disputa a SERP que o cliente quer, não quem se parece com o
cliente. Custo zero: o dado já foi pago.

**Segunda fonte: `competitors_domain`**, com dois filtros obrigatórios —

1. fora o próprio domínio e suas variações (`leotintas.com` apareceu junto de
   `leotintas.com.br`);
2. fora plataforma genérica: rede social, diretório, agregador de CNPJ.

Terceira e quarta: local pack e `answerList` do GEO, classificadas, não
descartadas. Concorrente citado pelo cliente que não aparece em nenhuma fonte é
**achado para o relatório**, não entrada de pipeline.

- [x] **Step 2: Gap**

`domain_intersection` é **par a par** (`target1`/`target2`), US$ 0,0132 por par
— multiplica por N concorrentes. O item traz `keyword_data` mais
`first_domain_serp_element` e `second_domain_serp_element`, então dá para ver
os dois lados na mesma keyword.

**Só país.** A keyword que sai do gap é disputa nacional e **não pode virar
cluster antes de passar pela SERP local** da Task 8.

Merge no pool da Task 5, marcando origem.

---

## Task 7: Filtro e teto

**Files:**
- Create: `lib/research/candidate-filter.ts`
- Create: `lib/research/candidate-filter.test.mjs`

- [x] **Step 1: Filtrar antes da SERP, nunca depois**

Este é o único ponto que governa o custo da fase. Volume mínimo, relevância ao
seed, e corte no teto (padrão 200, configurável).

As seeds do briefing **passam sempre**, fora do teto. Elas não estão competindo
por orçamento: sem SERP delas não há veredito, e o veredito é o que volta para o
profissional.

- [x] **Step 2: Testes**

Inclusive o caso em que o pool é menor que o teto — não inventar candidata.

---

## Task 8: SERP em volume

**A única task que gasta em escala. É também a que repete o formato de risco do
incidente da malha.**

**Files:**
- Create: `lib/dataforseo/serp-organic.ts`
- Create: `app/actions/clients/research-serp.ts`

- [x] **Step 1: Chamada com location correta**

`location_code` de cidade — ou coordenada, conforme a resposta 7 da Task 1 — e
`language_code`. Nunca país. Ignorar isso é reproduzir o `languageMismatch` que
já contamina o `visibility_audit`.

Clustering temático roda na location da **cidade principal**. Combos de cidade
rodam cada um na sua.

- [x] **Step 2: Fila, com as quatro proteções que já custaram caro**

1. `tag` lido de `tasks[i].data.tag`, **nunca** do nível da tarefa.
2. Identificadores gravados **antes** de qualquer outra escrita.
3. Lease por `polling_at` em `UPDATE ... WHERE` atômico — trava otimista que
   compara o status contra ele mesmo não trava nada.
4. Teto de tentativas, no padrão de `GBP_GRID_MAX_ATTEMPTS`.

Estados distintos: `pending`, `queued`, `done`, `failed`. `failed` **não** é
`done` com resultado vazio.

- [x] **Step 3: Extrair URLs do top 10 e o PAA**

URL completa, conforme a resposta 2 da Task 1. PAA conforme a resposta 3.

---

## Task 9: Clustering por sobreposição

O coração da fase, e puro — então testável de verdade.

**Files:**
- Create: `lib/research/cluster.ts`
- Create: `lib/research/cluster.test.mjs`
- Create: `lib/research/cluster.fixture.json`

- [x] **Step 1: O algoritmo**

Índice invertido URL → keywords, contagem de co-ocorrência por par, e union-find
sobre os pares que atingem o limiar:

```
MIN_OVERLAP = 3   // URLs compartilhadas no top 10
TOP_N = 10

indice: url -> Set<keyword>
para cada url do indice:
  para cada par (a, b) de keywords que a compartilham:
    overlap[a][b] += 1

para cada par com overlap >= MIN_OVERLAP: union(a, b)
clusters = componentes conexos
```

**Overlap é sobre URL exata, não domínio.** Duas keywords que trazem páginas
diferentes do mesmo site pertencem a clusters diferentes — é exatamente o sinal
de que precisam de páginas separadas. Agrupar por domínio apagaria o sinal que a
fase existe para capturar.

Keyword cuja SERP falhou fica **fora** do grafo, marcada, e não vira cluster de
um item só.

- [x] **Step 2: Testes**

Casos que importam: duas keywords idênticas na SERP (mesmo cluster), duas sem
nenhuma URL comum (clusters separados), transitividade (A–B e B–C ⇒ A, B, C
juntos), e SERP falha (fora do grafo, não órfã).

---

## Task 10: Localidade

**Files:**
- Create: `lib/research/locality.ts`
- Create: `lib/research/locality.test.mjs`

- [x] **Step 1: Prova do eixo cidade**

SERP de `{tema}` e `{tema} + cidade` para 1–2 clusters. Se a primeira vier
dominada por resultado nacional e a segunda por local pack, o eixo é próprio e a
matriz tema × local é o mapa de páginas. O clustering decide isso sozinho, sem
ninguém opinar.

- [x] **Step 2: Sonda de bairro, só quando houver bairro**

3 a 5 bairros por cidade. SERP do bairro convergindo com a da cidade ⇒ bairros
herdam o cluster e não se paga por eles. Divergindo ⇒ bairro é eixo próprio, e
aí vale expandir — mas a descoberta custou 5 chamadas, não 80.

---

## Task 11: Veredito por keyword

**Files:**
- Create: `lib/research/verdict.ts`
- Create: `lib/research/verdict.test.mjs`

- [x] **Step 1: Os quatro vereditos**

`viável` / `sem volume` / `SERP incompatível` / `canibalizada`.

"SERP incompatível" é a que precisa de cuidado: SERP dominada por marketplace,
fabricante nacional ou grande varejo significa que uma loja local não ganha
aquela keyword, por mais relevante que o termo pareça.

A pesquisa **não corrige o briefing**. Devolve veredito e substitutas do mesmo
cluster. O profissional edita se concordar, gera fingerprint novo, e a pesquisa
revalida.

---

## Task 12: Review do analista e apresentação

**Files:**
- Create: `lib/research/research-review.ts`
- Create: `components/custom/ClientResearch*/`

- [x] **Step 1: Review separado do snapshot**

O julgamento é sobre a pesquisa, não sobre a coleta. Recoletar não apaga nem
duplica. Campo em branco do analista não vira veredito.

- [x] **Step 3: Integração** — terceira área no diálogo do cliente

Não nasceu casca nova. O `ClientBriefingReviewDialog` **já era** um workspace
com rail de áreas (`briefing` | `contact`); a pesquisa entrou como a terceira,
`research`, com a action de leitura `load-client-research.ts`.

É área e não etapa do briefing de propósito: as oito etapas são respostas do
cliente, e a pesquisa é trabalho feito sobre elas.

`canUseResearch` exige briefing enviado. Antes disso as palavras-chave e as
cidades ainda mudam, e uma pesquisa sobre rascunho nasceria defasada no
primeiro salvamento.

- [x] **Step 2: Apresentação** — escrita, **sem verificação visual**

`components/custom/ClientResearchPanel/`, no arquétipo de painel de trabalho.
Os greps de reprovação da skill batem com o baseline (cor cravada 5, base-ui 2,
anima sem reduced 1 — os três são débito conhecido de outros arquivos), `tsc`
limpo e `lint` com zero erros.

**O que não foi feito:** o passo visual de `checks.md` — foco em claro e
escuro, contraste, layout em largura real. Decisão do dono do repositório, que
pediu para não abrir o servidor. O risco fica registrado: um token no papel
errado só aparece na tela, e foi assim que o realinhamento de setembro nasceu.

<details>
<summary>Instruções originais</summary>

Segue a skill `suite-frontend`: shadcn base-mira, sem vocabulário paralelo.

**Parada deliberada.** O fluxo da skill termina em `references/checks.md`, que é
comparação visual contra baseline — e a verificação visual deste app exige
sessão logada. Escrever cinco ou seis componentes sem poder confirmar que
renderizam, num sistema que já custou um realinhamento inteiro por causa de um
token de cor usado no papel errado, seria entregar trabalho que ninguém
verificou.

O que a tela precisa consumir já existe e está testado: `reviewProgress`,
`clusterLabel`, `unnamedClusters`, `verdictSummary`, `serpQueueProgress` e
`serpCallCount` — este último é o custo a mostrar **antes** de gastar.

Ler `references/state.md` antes do primeiro `useState`: a tela tem polling da
fila de SERP, que é exatamente o caso que aquela referência cobre.

</details>

---

## Task 13: Verificação final

- [x] `pnpm tsc --noEmit`
- [x] `pnpm lint`
- [x] Todos os `.test.mjs` novos
- [x] Fronteira `server-only` transitiva em cada módulo puro
- [ ] Migration reexecutada duas vezes sem erro — **não rodada**: exige banco, e
      as duas migrations novas (`20260929`, `20260930`) ainda não foram aplicadas
- [ ] Um cliente real do começo ao fim, conferindo campo a campo contra o
      payload cru — é o que a pendência 1 do handoff da auditoria cobra, e vale
      igual aqui

---

## Fora deste plano

- **Pilares E, F e H1** (entidades, gaps, outlines, inteligência local factual).
  Dependem da decisão pendente nº 1 da spec: se `ai-optimization.ts` cobre
  deep-research ou se exige integração nova.
- **Matriz completa cluster × cidade.** Onda separada, pós-Fase 4 — é
  proporcional a clusters × cidades e só faz sentido depois que alguém escolheu
  quais clusters viram página.
- **Reexecução por delta.** Append-only é regra da casa; otimizar por delta é
  prematuro para MVP.
