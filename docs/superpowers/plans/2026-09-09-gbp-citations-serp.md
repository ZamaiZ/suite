# GBP Citations by SERP Implementation Plan

> **Encerrado em 2026-09-09.** Só a **Task 1** foi executada, e o resultado dela
> matou as demais: com o filtro inválido removido e o catálogo casado do nosso
> lado, a chamada devolveu 399 domínios de referência e zero diretórios. A Task
> 0 já havia reprovado o SERP `site:` antes disso; sem nenhum dos dois canais,
> não há o que construir, e as **Tasks 2 a 12 não serão feitas**.
>
> Duas coisas sobreviveram, com outro destino: a chamada de backlinks passou a
> ler rede de links artificiais, e a operação `backlink_citations` da
> calculadora virou `backlink_scheme`. O catálogo perdeu o campo `linkDomains`
> e os três ajudantes que o liam — nada verificava mais nada por ali.


> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Descobrir, por diretório, se existe página publicada sobre o negócio, com o link para o analista confirmar.

**Architecture:** Uma tabela append-only guarda o scan — configuração, progresso e os itens em jsonb. Uma action inicia enviando as consultas num único `task_post` com `tag` por diretório; uma action de poll coleta com lease e trava otimista, gravando conforme chega. A corroboração por backlink continua na chamada de backlinks que já existe. O formato inteiro é o de `lead_gbp_grid_scans`, aplicado a outro domínio.

**Tech Stack:** Next.js 16.3.1 App Router, React 19.2.8, TypeScript, Supabase, DataForSEO SERP e Backlinks.

**Spec:** `docs/superpowers/specs/2026-09-09-gbp-citations-serp-design.md`

## Global Constraints

- Não executar comandos de Git, teste, build, lint ou typecheck; regras do repositório proíbem todos eles. A verificação é por leitura.
- **Cada consulta é paga.** Nenhuma alteração pode fazer o sistema refazer uma tarefa já criada. O identificador é gravado antes de qualquer outra escrita.
- O `tag` é lido de `tasks[i].data.tag`, nunca do nível da tarefa — foi essa leitura errada que custou 121 buscas pagas.
- Ausente nunca vira zero, e falha nunca vira "não encontrado".
- A máquina não escreve em `analyst_review`. Resposta de analista é intocável por qualquer coleta.
- Migrations reexecutáveis: `if not exists` e `drop policy if exists` antes de cada `create policy`.
- Não alterar o passo de Presença digital nem o catálogo de redes sociais.
- Nada do que existe hoje muda de forma: scan ausente lê como ausente, não como vazio.

---

## File Structure

- Criar `supabase/migrations/20260926000000_lead_gbp_citation_scans.sql` — tabela, índices, trava de disparo duplo e RLS.
- Criar `lib/leads/gbp-citations.ts` — tipos, estados, leitura tolerante e transições.
- Criar `lib/dataforseo/google-citations.ts` — envio em lote, coleta e readoção.
- Criar `lib/validations/lead-gbp-citations.ts` — schemas das duas actions.
- Criar `app/actions/leads/start-gbp-citation-scan.ts` e `poll-gbp-citation-scan.ts`.
- Alterar `lib/leads/gbp-analyst-review.ts`, `app/actions/leads/gbp-access.ts`, `lib/leads/gbp.ts`, `lib/dataforseo/usage.ts`, `lib/dataforseo/backlinks.ts`, `lib/leads/backlinks-map.ts` e os componentes do painel de GBP.

---

### Task 0: Validar o operador antes de construir

**Files:** nenhum — é uma chamada e um registro.

- [ ] Rodar **uma** consulta live em `/serp/google/organic/live/advanced` com `keyword` igual a `"Busca Orgânica" site:facebook.com`, `location_code` do Brasil e `language_code: "pt"`. Custo US$ 0,002.
- [ ] Registrar em `docs/auditoria/2026-09-04-impedimentos-dataforseo.md` se o operador é aceito, se os resultados vêm em `items`, e o formato de `url`, `title` e `domain`.
- [ ] **Se o operador não for aceito, parar aqui.** Todo o resto assume que ele funciona, e esta linha de trabalho já foi mordida duas vezes construindo contra documentação — o `owner_timestamp` que existia e o operador `in` que não existe.

### Task 1: Fechar os dois defeitos do backlinks

**Files:**

- Modify: `lib/dataforseo/backlinks.ts`
- Modify: `lib/leads/backlinks-map.ts`

- [ ] Remover o filtro `["domain_from", "in", ...]`, que é inválido: `domain_from` não aceita `in`. Manter `mode: "one_per_domain"` com limite generoso e casar com o catálogo do nosso lado, por sufixo — trocar por `match` seria substituir uma suposição por outra.
- [ ] Fazer `fetchBacklinkCitationsLive` devolver `{ status: "error" }` quando `posted.data` for `null`, para que a action grave `citations: null` em vez de `[]`. Hoje "a chamada não trouxe resultado" e "nenhum diretório linka" são indistinguíveis no banco.
- [ ] Registrar em comentário que truncamento por limite faz o corroborador **calar**, e não afirmar ausência.

### Task 2: Tabela do scan

**Files:**

- Create: `supabase/migrations/20260926000000_lead_gbp_citation_scans.sql`

- [ ] Criar `lead_gbp_citation_scans` com `id`, `lead_id` e `profile_id` referenciando `leads` e `lead_gbp_profiles` com `on delete cascade`, `query text`, `status text`, `processed integer not null default 0`, `total integer not null`, `items jsonb not null default '[]'::jsonb`, `cost_usd numeric(12,6) not null default 0`, `polling_at timestamptz`, `error_message text`, `started_at timestamptz`, `captured_at timestamptz not null default now()` e `updated_at timestamptz not null default now()`.
- [ ] Constraints: `status in ('queued','running','ready','partial','failed')`, `processed between 0 and total`, `cost_usd >= 0` e comprimento de `query` entre 1 e 200.
- [ ] Índice de leitura `(profile_id, captured_at desc)` e auxiliar `(lead_id)`.
- [ ] Índice único parcial `on (profile_id) where status in ('queued','running')` — a trava contra disparo duplo mora no banco, porque dois cliques simultâneos passam pela validação da aplicação mas não por ele.
- [ ] Habilitar RLS e criar as quatro políticas `lead_gbp_citation_scans_<acao>_commercial` no formato de `lead_gbp_grid_scans`, com `drop policy if exists` antes de cada uma, mais `revoke`/`grant`.

### Task 3: Catálogo com dois canais

**Files:**

- Modify: `lib/leads/gbp-analyst-review.ts`

- [ ] Trocar `domain: string` por `serpDomain: string | null`, mantendo `linkDomains: string[]`. `null` e vazio significam "este canal não alcança este diretório", não "não configurado".
- [ ] Adicionar `facebook` e `instagram` ao catálogo com `serpDomain` preenchido e `linkDomains` vazio. Marcá-los para **não aparecer no checklist do analista** — o passo de Presença digital é o dono deles; aqui são só fonte de citação.
- [ ] Deixar `bing_places` e `waze` com os dois canais ausentes: são manuais de verdade, e é o modelo que diz isso, não um rótulo.
- [ ] Ajustar `gbpDirectorySearchUrl` e `gbpCitationDomains` ao novo formato, e manter `readGbpAnalystReview` tolerante aos ids antigos, para que resposta já gravada não suma na leitura.

### Task 4: Modelo do scan

**Files:**

- Create: `lib/leads/gbp-citations.ts`

- [ ] Módulo puro, sem alcançar `server-only` — o card é componente de cliente, e a verificação dessa fronteira é transitiva.
- [ ] `GbpCitationItem` com `directoryId`, `status` (`pending` · `queued` · `done` · `failed`), `found: boolean | null`, `url`, `title`, `taskId`, `attempts` e `error`. `found: null` é não coletado; `false` é coletado e não achou.
- [ ] `gbpCitationItems(directories)` monta a lista inicial toda em `pending`.
- [ ] Leitura tolerante do jsonb, mais `gbpCitationScanResumable`, `gbpCitationsToPost`, `gbpCitationsToCollect`, `gbpCitationNextStatus`, `gbpCitationMergeItems` e `gbpCitationProcessed` — os mesmos papéis que `lib/leads/gbp-grid.ts` já tem, e é dele que sai o formato.
- [ ] `GBP_CITATION_MAX_ATTEMPTS = 2` e `GBP_CITATION_LEASE_MS`, com o comentário explicando por que cada um existe.

### Task 5: Cliente da SERP

**Files:**

- Create: `lib/dataforseo/google-citations.ts`

- [ ] `citationQuery(name, domain)` puro, montando `"<nome>" site:<domínio>` com o nome entre aspas — separado do cliente para ser legível fora do servidor.
- [ ] `postCitationTasks` usando `postDataForSeoTasks` em `/serp/google/organic/task_post`, com `tag` igual ao id do diretório, `location_code` do Brasil, `language_code: "pt"` e `depth: 10` — só interessa se existe **algum** resultado.
- [ ] `getCitationTask` lendo o `task_get`: primeiro item orgânico vira `found: true` com `url` e `title`; resultado vazio vira `found: false`; erro vira `failed`.
- [ ] `readyCitationTasks` sobre `tasks_ready`, para readotar tarefa órfã — gratuito, mas limitado a 20 chamadas por minuto na conta, então fora do laço de coleta.

### Task 6: Validações

**Files:**

- Create: `lib/validations/lead-gbp-citations.ts`

- [ ] Schemas das duas actions, no formato de `lib/validations/lead-gbp-grid.ts`.

### Task 7: Iniciar o scan

**Files:**

- Create: `app/actions/leads/start-gbp-citation-scan.ts`
- Modify: `app/actions/leads/index.ts`

- [ ] Validar, carregar o perfil, negar edição sem permissão e exigir credencial DataForSEO.
- [ ] Montar as consultas só para diretórios com `serpDomain`, usando o nome da empresa do lead.
- [ ] **Gravar a linha com os itens em `pending` antes de enviar**, e persistir os identificadores devolvidos **antes** de qualquer outra escrita — é a ordem que impede pagar de novo pelo que já foi comprado.
- [ ] Somar o `cost` da resposta em `cost_usd`.
- [ ] Toda task recusada vira item `failed` com o código e a mensagem da própria API, em vez de sumir: task descartada em silêncio é busca paga que ninguém vai ver.

### Task 8: Poll

**Files:**

- Create: `app/actions/leads/poll-gbp-citation-scan.ts`
- Modify: `app/actions/leads/index.ts`

- [ ] Lease por `polling_at` num único `UPDATE ... WHERE` atômico — trava que compara o status contra ele mesmo não trava nada, e dois polls simultâneos já enfileiraram em dobro e perderam escrita.
- [ ] Coletar os itens `queued`, respeitando `GBP_CITATION_MAX_ATTEMPTS`.
- [ ] Readotar órfã por `readyCitationTasks` quando houver item sem `taskId`.
- [ ] Fechar em `ready`, `partial` ou `failed`, **liberando o lease em todos os caminhos**, inclusive no de erro.

### Task 9: Leitura no perfil

**Files:**

- Modify: `app/actions/leads/gbp-access.ts`
- Modify: `lib/leads/gbp.ts`

- [ ] Embutir `lead_gbp_citation_scans(...)` no `GBP_SELECT` e resolver o mais recente por `captured_at`, no formato de `latestGbpGridScan`.
- [ ] Expor em `LeadGbpProfile` como `citationScan: LeadGbpCitationScan | null`.

### Task 10: Tela

**Files:**

- Modify: `components/custom/LeadGbpPanel/LeadGbpDirectoriesCard.tsx`
- Modify: `components/custom/LeadGbpPanel/LeadGbpProfileCard.tsx`
- Modify: `components/custom/LeadGbpPanel/LeadGbpPanel.tsx`

- [ ] Por linha: o achado do SERP com link para a página, o selo de corroboração quando o backlink também apontar, e o `Select` do analista, que continua sendo quem fecha o estado.
- [ ] Botão de disparo e estado de coleta, no formato do card da malha.
- [ ] Cabeçalho explicando os sinais: encontrado não é cadastrado, ausência de link não é ausência de cadastro, e NAP é do analista.
- [ ] Item `pending` ou `failed` aparece como **não verificado**, nunca como não encontrado.
- [ ] Componentes do vocabulário shadcn em `components/ui/`; não há camada de alias legada.

### Task 11: Custo

**Files:**

- Modify: `lib/dataforseo/usage.ts`

- [ ] Trocar a operação de citações por uma de SERP na fila: `api: "serp"`, `fnSuffix: "organic/task_post"`, e `requests` derivado do catálogo — contando os diretórios com `serpDomain`, e não digitado, para que cada diretório novo não faça a calculadora mentir em silêncio.

### Task 12: Revisão estrutural sem execução automatizada

**Files:** todos os tocados.

- [ ] Conferir que `gbp-citations.ts` e os demais módulos novos não alcançam `server-only` por caminho **transitivo** — checar só o import direto passa e não prova nada.
- [ ] Conferir que nenhum caminho de coleta grava em `analyst_review`.
- [ ] Conferir que toda leitura de `lead_gbp_citation_scans` leva `order` e `limit` — foi a falta disso que derrubou a compilação do diagnóstico depois de a tabela de visibilidade virar append-only.
- [ ] Conferir que scan ausente lê como ausente, e que item não coletado nunca renderiza como não encontrado.
- [ ] Atualizar os quatro documentos de `docs/auditoria/`.

---

## Verificação

Sem build, typecheck ou teste. Depois das migrations aplicadas, num lead com nome e site cadastrados:

1. Disparar o scan e conferir que a linha nasce com todos os itens em `pending` e que os identificadores aparecem **antes** de qualquer resultado.
2. Recarregar no meio da coleta: o poll retoma nos pendentes e **não** recompra o que já tem identificador.
3. Conferir que um diretório sem resultado fica `found: false`, que um item com falha fica `failed`, e que a tela distingue os dois de "não verificado".
4. Preencher um estado no checklist, recoletar, e conferir que a resposta do analista continua lá.
5. Conferir na tela de Ferramentas que o custo do scan bate com o número de diretórios consultados.
