-- Prospeccao: fila de enriquecimento, coleta, julgamento e descadastro.
--
-- Quatro tabelas, cada uma repetindo um padrao que ja existe no repositorio:
--
--   prospect_enrichment_tasks  a fila paga (o padrao de client_research_serp_tasks)
--   prospect_enrichments       a coleta append-only (o padrao dos *_audits)
--   prospect_reviews           o julgamento do analista (o padrao dos *_reviews)
--   prospect_optouts           descadastro, que nao tem precedente aqui
--
-- UMA fila com coluna `stage`, e nao uma tabela por etapa. O repositorio ja tem
-- quatro copias do mesmo lease/attempts/readocao -- malha do GBP, PageSpeed,
-- perfil do GBP e SERP da pesquisa -- e os comentarios das quatro dizem que a
-- duplicacao e o risco. Quatro tabelas de etapa seriam a quinta a oitava.
--
-- As etapas diferem no TRANSPORTE, nao no CONTROLE: `site` e HTTP nosso e nao
-- compra tarefa, `identity` e HTTP nosso mais SERP, `social` e `person` sao
-- SERP paga. `task_id` e simplesmente nulo nas que nao compram. Os lotes e
-- tetos por etapa moram em lib/prospect/pipeline.ts, puro, pelo mesmo motivo
-- que lib/dataforseo/limits.ts nao tem imports.

create table if not exists public.prospect_enrichment_tasks (
  id            uuid        primary key default gen_random_uuid(),
  campaign_id   uuid        not null references public.prospect_campaigns(id) on delete cascade,
  prospect_id   uuid        not null references public.prospects(id) on delete cascade,
  -- Agrupa uma execucao. Sem ele, dois enriquecimentos da mesma campanha
  -- disputariam as mesmas linhas, e a tag do `tasks_ready` -- que lista a conta
  -- inteira -- nao teria como separar o que e desta rodada.
  run_id        uuid        not null,
  stage         text        not null,
  status        text        not null default 'pending',
  -- Gravado ANTES de qualquer outra escrita nas etapas pagas. Sem ele a tarefa
  -- paga vira orfa e o proximo poll compra de novo -- foi assim que 121 tarefas
  -- da malha viraram treze vezes o mesmo trabalho.
  task_id       text,
  attempts      integer     not null default 0,
  -- Lease. A trava e um `UPDATE ... WHERE` atomico sobre esta coluna, nunca uma
  -- comparacao do status contra ele mesmo: dois polls em `queued` passavam os
  -- dois.
  polling_at    timestamptz,
  -- `done` + `found = false` e "rodou e nao achou"; `failed` e "nao rodou".
  -- Coluna, e nao teste de jsonb nulo, porque o portao da etapa seguinte
  -- consulta isto: `where stage = 'site' and status = 'done' and found`.
  found         boolean,
  result        jsonb,
  error_message text,
  cost_usd      numeric(10, 5),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint prospect_enrichment_tasks_stage_chk
    check (stage in ('site', 'identity', 'social', 'person')),
  constraint prospect_enrichment_tasks_status_chk
    check (status in ('pending', 'queued', 'done', 'failed')),
  constraint prospect_enrichment_tasks_attempts_chk
    check (attempts >= 0),
  constraint prospect_enrichment_tasks_result_obj_chk
    check (result is null or jsonb_typeof(result) = 'object'),
  constraint prospect_enrichment_tasks_cost_chk
    check (cost_usd is null or cost_usd >= 0),
  -- `found` so faz sentido quando a etapa assentou. Preenchido em `pending`
  -- seria resposta antes da pergunta.
  constraint prospect_enrichment_tasks_found_chk
    check ((status = 'done' and found is not null)
        or (status <> 'done' and found is null))
);

-- Alvo de conflito por COLUNA, nunca por expressao: a migration
-- 20261001000000 ja pagou esse erro -- o upsert do PostgREST nao casa com
-- indice sobre expressao e devolve 42P10.
create unique index if not exists prospect_enrichment_tasks_run_uidx
  on public.prospect_enrichment_tasks (run_id, prospect_id, stage);

create index if not exists prospect_enrichment_tasks_campaign_idx
  on public.prospect_enrichment_tasks (campaign_id, stage, status);

-- Readocao de tarefa orfa: e por `task_id` que se descobre se a tarefa que o
-- `tasks_ready` listou e nossa.
create index if not exists prospect_enrichment_tasks_task_id_idx
  on public.prospect_enrichment_tasks (task_id)
  where task_id is not null;

-- Coleta. Nunca sofre UPDATE. Rodar de novo APENSA, como em todos os
-- `*_audits`: sobrescrever apagaria a evidencia de que o dado mudou, e e
-- justamente a mudanca que denuncia cadastro velho.
create table if not exists public.prospect_enrichments (
  id           uuid        primary key default gen_random_uuid(),
  prospect_id  uuid        not null references public.prospects(id) on delete cascade,
  stage        text        not null,
  source       text        not null,
  payload      jsonb       not null,
  -- 0 a 100 nas etapas que sao um match; nulo nas que sao leitura direta.
  -- Existe porque afirmar um CNPJ provavel como certo e o unico jeito de este
  -- recurso destruir confianca.
  confidence   integer,
  cost_usd     numeric(10, 5),
  -- Quem pediu. Existe para a etapa `person`: dado pessoal coletado sem autor
  -- registrado nao tem como ser auditado depois, e a etapa `person` e a unica
  -- do funil que trata pessoa fisica.
  requested_by uuid        references public.users(id),
  collected_at timestamptz not null default now(),
  constraint prospect_enrichments_stage_chk
    check (stage in ('site', 'identity', 'social', 'person')),
  constraint prospect_enrichments_source_chk
    check (source in ('site_crawl', 'public_cnpj_api', 'serp_organic', 'receita_mirror', 'listing')),
  constraint prospect_enrichments_payload_obj_chk
    check (jsonb_typeof(payload) = 'object'),
  constraint prospect_enrichments_confidence_chk
    check (confidence is null or confidence between 0 and 100),
  constraint prospect_enrichments_cost_chk
    check (cost_usd is null or cost_usd >= 0)
);

create index if not exists prospect_enrichments_latest_idx
  on public.prospect_enrichments (prospect_id, stage, collected_at desc);

-- Julgamento do analista. Uma linha por prospect. A MAQUINA NAO ESCREVE AQUI.
--
-- A unica excecao esta na promocao: CNPJ com score >= 90 pelo motivo
-- `cnpj_site` e o numero que a propria empresa publicou no rodape dela, nao uma
-- inferencia nossa -- esse pode nascer `confirmed`.
create table if not exists public.prospect_reviews (
  prospect_id        uuid        primary key references public.prospects(id) on delete cascade,
  cnpj               char(14),
  cnpj_verdict       text        not null default 'unknown',
  best_contact_kind  text,
  best_contact_value text,
  notes              text,
  reviewed_by        uuid        references public.users(id),
  reviewed_at        timestamptz,
  updated_at         timestamptz not null default now(),
  constraint prospect_reviews_verdict_chk
    check (cnpj_verdict in ('confirmed', 'rejected', 'unknown')),
  constraint prospect_reviews_cnpj_chk
    check (cnpj is null or cnpj ~ '^\d{14}$'),
  constraint prospect_reviews_contact_kind_chk
    check (best_contact_kind is null
        or best_contact_kind in ('phone', 'whatsapp', 'email', 'instagram', 'linkedin')),
  constraint prospect_reviews_notes_len_chk
    check (notes is null or char_length(notes) <= 2000)
);

-- Descadastro.
--
-- Nao e opcional. Prospeccao fria por legitimo interesse depende de opt-out
-- honrado, e honrar significa BLOQUEAR NA ORIGEM: a campanha seguinte filtra
-- contra esta tabela antes de gravar o prospect, e a promocao consulta de novo.
-- Guardar o pedido numa planilha a parte seria o mesmo que nao ter.
--
-- `value_key` e sempre normalizado pelo mesmo codigo que normaliza o lado do
-- prospect -- telefone em `55DDDNNNNNNNN`, dominio sem `www.`, e-mail em
-- minuscula, CNPJ so digitos. Chave normalizada de um lado so nunca casa.
create table if not exists public.prospect_optouts (
  id         uuid        primary key default gen_random_uuid(),
  kind       text        not null,
  value_key  text        not null,
  reason     text,
  created_by uuid        references public.users(id),
  created_at timestamptz not null default now(),
  constraint prospect_optouts_kind_chk
    check (kind in ('tax_id', 'domain', 'email', 'phone', 'place_id')),
  constraint prospect_optouts_value_chk
    check (char_length(value_key) between 3 and 320),
  constraint prospect_optouts_reason_len_chk
    check (reason is null or char_length(reason) <= 500)
);

create unique index if not exists prospect_optouts_kind_value_uidx
  on public.prospect_optouts (kind, value_key);

alter table public.prospect_enrichment_tasks enable row level security;
alter table public.prospect_enrichments enable row level security;
alter table public.prospect_reviews enable row level security;
alter table public.prospect_optouts enable row level security;

drop policy if exists "prospect_enrichment_tasks_select_commercial" on public.prospect_enrichment_tasks;
create policy "prospect_enrichment_tasks_select_commercial"
  on public.prospect_enrichment_tasks for select to authenticated
  using (public.is_commercial_member());

drop policy if exists "prospect_enrichment_tasks_insert_commercial" on public.prospect_enrichment_tasks;
create policy "prospect_enrichment_tasks_insert_commercial"
  on public.prospect_enrichment_tasks for insert to authenticated
  with check (public.is_commercial_member());

drop policy if exists "prospect_enrichment_tasks_update_commercial" on public.prospect_enrichment_tasks;
create policy "prospect_enrichment_tasks_update_commercial"
  on public.prospect_enrichment_tasks for update to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

drop policy if exists "prospect_enrichment_tasks_delete_commercial" on public.prospect_enrichment_tasks;
create policy "prospect_enrichment_tasks_delete_commercial"
  on public.prospect_enrichment_tasks for delete to authenticated
  using (public.is_commercial_member());

drop policy if exists "prospect_enrichments_select_commercial" on public.prospect_enrichments;
create policy "prospect_enrichments_select_commercial"
  on public.prospect_enrichments for select to authenticated
  using (public.is_commercial_member());

drop policy if exists "prospect_enrichments_insert_commercial" on public.prospect_enrichments;
create policy "prospect_enrichments_insert_commercial"
  on public.prospect_enrichments for insert to authenticated
  with check (public.is_commercial_member());

-- Sem update nem delete: a coleta e append-only. O grant abaixo tambem nao os
-- concede -- e o mesmo desenho de `leads`, que nao recebe delete.

drop policy if exists "prospect_reviews_select_commercial" on public.prospect_reviews;
create policy "prospect_reviews_select_commercial"
  on public.prospect_reviews for select to authenticated
  using (public.is_commercial_member());

drop policy if exists "prospect_reviews_insert_commercial" on public.prospect_reviews;
create policy "prospect_reviews_insert_commercial"
  on public.prospect_reviews for insert to authenticated
  with check (public.is_commercial_member());

drop policy if exists "prospect_reviews_update_commercial" on public.prospect_reviews;
create policy "prospect_reviews_update_commercial"
  on public.prospect_reviews for update to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

drop policy if exists "prospect_reviews_delete_commercial" on public.prospect_reviews;
create policy "prospect_reviews_delete_commercial"
  on public.prospect_reviews for delete to authenticated
  using (public.is_commercial_member());

drop policy if exists "prospect_optouts_select_commercial" on public.prospect_optouts;
create policy "prospect_optouts_select_commercial"
  on public.prospect_optouts for select to authenticated
  using (public.is_commercial_member());

drop policy if exists "prospect_optouts_insert_commercial" on public.prospect_optouts;
create policy "prospect_optouts_insert_commercial"
  on public.prospect_optouts for insert to authenticated
  with check (public.is_commercial_member());

drop policy if exists "prospect_optouts_delete_commercial" on public.prospect_optouts;
create policy "prospect_optouts_delete_commercial"
  on public.prospect_optouts for delete to authenticated
  using (public.is_commercial_member());

revoke all on table public.prospect_enrichment_tasks from anon, authenticated;
grant select, insert, update, delete on table public.prospect_enrichment_tasks to authenticated;

revoke all on table public.prospect_enrichments from anon, authenticated;
grant select, insert on table public.prospect_enrichments to authenticated;

revoke all on table public.prospect_reviews from anon, authenticated;
grant select, insert, update, delete on table public.prospect_reviews to authenticated;

revoke all on table public.prospect_optouts from anon, authenticated;
grant select, insert, delete on table public.prospect_optouts to authenticated;
