-- Fila de SERP da Fase 3.
--
-- Esta tabela existe porque a SERP e o **unico passo em escala** da pesquisa:
-- ate 200 chamadas pagas por execucao, contra uma duzia em todo o resto. E ela
-- repete, tracinho por tracinho, o formato de risco do incidente da malha, em
-- que 121 tarefas foram criadas e pagas, os identificadores foram descartados e
-- cada passada do poll comprava a grade inteira de novo -- cerca de treze vezes
-- o mesmo trabalho.
--
-- Por isso as colunas de controle nao sao opcionais:
--
--   `task_id`     gravado ANTES de qualquer outra escrita. Sem ele a tarefa
--                 paga vira orfa e o proximo poll compra de novo.
--   `polling_at`  lease. Dois polls simultaneos num mesmo `status` passavam os
--                 dois, enfileiravam em dobro e perdiam escrita. A trava e um
--                 `UPDATE ... WHERE` atomico sobre esta coluna, nunca uma
--                 comparacao do status contra ele mesmo.
--   `attempts`    teto de repescagem. Sem teto, ponto que falha de verdade e
--                 reenfileirado a cada passada, e cada reenfileiramento e pago.
--
-- `status` tem quatro valores e nao tres: `failed` e coleta que NAO aconteceu,
-- e `done` com `snapshot` nulo e SERP legitimamente sem organico. Confundir os
-- dois fez, na malha, uma coleta inteiramente falha parecer diagnostico de que
-- o cliente nao rankeia em lugar nenhum. Aqui faria o clustering tratar a
-- keyword como orfa e inventar cluster de um item so.
--
-- `run_id` agrupa uma execucao. Sem ele, duas pesquisas do mesmo cliente
-- disputariam as mesmas linhas e o teto de 200 perderia o sentido.

create table if not exists public.client_research_serp_tasks (
  id            uuid        primary key default gen_random_uuid(),
  client_id     uuid        not null references public.clients(id) on delete cascade,
  run_id        uuid        not null,
  keyword       text        not null,
  location_code integer     not null,
  language_code text        not null default 'pt',
  status        text        not null default 'pending',
  task_id       text,
  attempts      integer     not null default 0,
  polling_at    timestamptz,
  snapshot      jsonb,
  error_message text,
  cost_usd      numeric(10, 5),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint client_research_serp_tasks_status_chk
    check (status in ('pending', 'queued', 'done', 'failed')),
  constraint client_research_serp_tasks_snapshot_obj_chk
    check (snapshot is null or jsonb_typeof(snapshot) = 'object'),
  constraint client_research_serp_tasks_attempts_chk
    check (attempts >= 0),
  constraint client_research_serp_tasks_cost_chk
    check (cost_usd is null or cost_usd >= 0)
);

-- A mesma keyword nao entra duas vezes na mesma execucao: seria SERP paga em
-- duplicata, e o clustering veria a keyword como dois nos do grafo.
create unique index if not exists client_research_serp_tasks_run_keyword_uidx
  on public.client_research_serp_tasks (run_id, lower(keyword));

create index if not exists client_research_serp_tasks_run_status_idx
  on public.client_research_serp_tasks (run_id, status);

create index if not exists client_research_serp_tasks_client_recent_idx
  on public.client_research_serp_tasks (client_id, created_at desc);

-- Readocao de tarefa orfa: o `tasks_ready` lista a conta inteira, e e por
-- `task_id` que se descobre se aquela tarefa pronta e nossa.
create index if not exists client_research_serp_tasks_task_id_idx
  on public.client_research_serp_tasks (task_id)
  where task_id is not null;

alter table public.client_research_serp_tasks enable row level security;

drop policy if exists "client_research_serp_tasks_select_commercial" on public.client_research_serp_tasks;
create policy "client_research_serp_tasks_select_commercial"
  on public.client_research_serp_tasks
  for select
  to authenticated
  using (public.is_commercial_member());

drop policy if exists "client_research_serp_tasks_insert_commercial" on public.client_research_serp_tasks;
create policy "client_research_serp_tasks_insert_commercial"
  on public.client_research_serp_tasks
  for insert
  to authenticated
  with check (public.is_commercial_member());

drop policy if exists "client_research_serp_tasks_update_commercial" on public.client_research_serp_tasks;
create policy "client_research_serp_tasks_update_commercial"
  on public.client_research_serp_tasks
  for update
  to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

drop policy if exists "client_research_serp_tasks_delete_commercial" on public.client_research_serp_tasks;
create policy "client_research_serp_tasks_delete_commercial"
  on public.client_research_serp_tasks
  for delete
  to authenticated
  using (public.is_commercial_member());

revoke all on table public.client_research_serp_tasks from anon, authenticated;
grant select, insert, update, delete on table public.client_research_serp_tasks to authenticated;
