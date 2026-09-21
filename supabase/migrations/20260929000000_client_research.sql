-- Fase 3 — Pesquisa de mercado e SERP.
--
-- Primeira tabela de COLETA do cliente. Toda a auditoria existente e do lead;
-- a ponte de leitura ja existe (`clients.lead_id` + `resolveAuditBaseline`),
-- entao aqui so nasce a escrita. Nada existente e alterado.
--
-- Append-only desde o dia 1, como `lead_geo_audits`. Sem acumulo nao existe
-- "antes", e pesquisa refeita apos edicao de briefing precisa poder ser
-- comparada com a anterior.
--
-- `briefing_fingerprint` e o que amarra a pesquisa a versao do briefing que a
-- originou. O briefing e editavel por definicao -- o profissional corrige
-- depois da reuniao -- e sem esta coluna nao ha como saber que a pesquisa
-- ficou defasada. O valor vem de `client_briefing_exports.content_fingerprint`.
--
-- `cost_usd` e coluna, e nao um campo dentro do snapshot como em
-- `lead_geo_audits.snapshot.costUsd`. A divergencia e deliberada: a pesquisa e
-- a etapa mais cara do produto (ordem de US$ 1,40 por execucao, medido na
-- sondagem da Task 1), e somar gasto por cliente ou por periodo nao deveria
-- exigir abrir jsonb.

create table if not exists public.client_research_audits (
  id                   uuid        primary key default gen_random_uuid(),
  client_id            uuid        not null references public.clients(id) on delete cascade,
  briefing_fingerprint text        not null,
  snapshot             jsonb       not null,
  cost_usd             numeric(10, 5),
  fetched_at           timestamptz not null default now(),
  fetched_by           uuid        not null references public.users(id),
  constraint client_research_audits_snapshot_obj_chk
    check (jsonb_typeof(snapshot) = 'object'),
  constraint client_research_audits_cost_chk
    check (cost_usd is null or cost_usd >= 0)
);

create index if not exists client_research_audits_client_recent_idx
  on public.client_research_audits (client_id, fetched_at desc);

-- Responde "esta pesquisa ainda vale?" sem varrer a tabela: o fingerprint
-- corrente do briefing ou bate com o da pesquisa mais recente, ou nao bate.
create index if not exists client_research_audits_fingerprint_idx
  on public.client_research_audits (client_id, briefing_fingerprint);

alter table public.client_research_audits enable row level security;

drop policy if exists "client_research_audits_select_commercial" on public.client_research_audits;
create policy "client_research_audits_select_commercial"
  on public.client_research_audits
  for select
  to authenticated
  using (public.is_commercial_member());

drop policy if exists "client_research_audits_insert_commercial" on public.client_research_audits;
create policy "client_research_audits_insert_commercial"
  on public.client_research_audits
  for insert
  to authenticated
  with check (public.is_commercial_member());

drop policy if exists "client_research_audits_update_commercial" on public.client_research_audits;
create policy "client_research_audits_update_commercial"
  on public.client_research_audits
  for update
  to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

drop policy if exists "client_research_audits_delete_commercial" on public.client_research_audits;
create policy "client_research_audits_delete_commercial"
  on public.client_research_audits
  for delete
  to authenticated
  using (public.is_commercial_member());

revoke all on table public.client_research_audits from anon, authenticated;
grant select, insert, update, delete on table public.client_research_audits to authenticated;

-- Julgamento do analista sobre a pesquisa.
--
-- Separado do snapshot pelo mesmo argumento de 20260919000000,
-- 20260926000000 e 20260928000000: gravado junto com a coleta, o julgamento
-- seria versionado com ela e duplicado a cada execucao, e a pergunta "qual das
-- copias vale?" nao teria resposta.
--
-- `cluster_names` mora aqui e nao no snapshot porque nomear cluster e a parte
-- que a maquina nao faz. O agrupamento e determinístico -- sobreposicao de URL
-- na SERP -- mas o nome e leitura humana, e recoletar nao pode apaga-lo.
--
-- `null` em `cluster_names` significa **nao nomeado**, nunca "nomeado e
-- vazio". A tabela nasce vazia e cliente nunca julgado le como review vazio.

create table if not exists public.client_research_reviews (
  id            uuid        primary key default gen_random_uuid(),
  client_id     uuid        not null references public.clients(id) on delete cascade,
  review        jsonb       not null default '{}'::jsonb,
  cluster_names jsonb,
  notes         text,
  updated_at    timestamptz not null default now(),
  updated_by    uuid        references public.users(id),
  constraint client_research_reviews_notes_len_chk
    check (
      notes is null
      or char_length(trim(notes)) between 1 and 2000
    ),
  constraint client_research_reviews_review_obj_chk
    check (jsonb_typeof(review) = 'object'),
  constraint client_research_reviews_cluster_names_obj_chk
    check (cluster_names is null or jsonb_typeof(cluster_names) = 'object')
);

create unique index if not exists client_research_reviews_client_id_uidx
  on public.client_research_reviews (client_id);

alter table public.client_research_reviews enable row level security;

drop policy if exists "client_research_reviews_select_commercial" on public.client_research_reviews;
create policy "client_research_reviews_select_commercial"
  on public.client_research_reviews
  for select
  to authenticated
  using (public.is_commercial_member());

drop policy if exists "client_research_reviews_insert_commercial" on public.client_research_reviews;
create policy "client_research_reviews_insert_commercial"
  on public.client_research_reviews
  for insert
  to authenticated
  with check (public.is_commercial_member());

drop policy if exists "client_research_reviews_update_commercial" on public.client_research_reviews;
create policy "client_research_reviews_update_commercial"
  on public.client_research_reviews
  for update
  to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

drop policy if exists "client_research_reviews_delete_commercial" on public.client_research_reviews;
create policy "client_research_reviews_delete_commercial"
  on public.client_research_reviews
  for delete
  to authenticated
  using (public.is_commercial_member());

revoke all on table public.client_research_reviews from anon, authenticated;
grant select, insert, update, delete on table public.client_research_reviews to authenticated;
