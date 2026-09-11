-- O julgamento do analista da etapa de Visibilidade vive por lead, fora do
-- snapshot da coleta.
--
-- `lead_visibility_audits` e append-only desde 20260917000000: cada analise
-- cria uma linha nova e preserva as anteriores. Julgamento humano gravado la
-- seria versionado junto com a coleta e duplicado a cada analise, e a pergunta
-- "qual das copias vale?" nao teria resposta. Mesmo argumento de
-- 20260919000000_lead_website_reviews.
--
-- Sem carga inicial: nao existe review anterior de Visibilidade em lugar
-- nenhum. A tabela nasce vazia e lead nunca julgado le como review vazio.

create table if not exists public.lead_visibility_reviews (
  id          uuid        primary key default gen_random_uuid(),
  lead_id     uuid        not null references public.leads(id) on delete cascade,
  review      jsonb       not null default '{}'::jsonb,
  notes       text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid        references public.users(id),
  constraint lead_visibility_reviews_notes_len_chk
    check (
      notes is null
      or char_length(trim(notes)) between 1 and 2000
    ),
  constraint lead_visibility_reviews_review_obj_chk
    check (jsonb_typeof(review) = 'object')
);

create unique index if not exists lead_visibility_reviews_lead_id_uidx
  on public.lead_visibility_reviews (lead_id);

alter table public.lead_visibility_reviews enable row level security;

drop policy if exists "lead_visibility_reviews_select_commercial" on public.lead_visibility_reviews;
create policy "lead_visibility_reviews_select_commercial"
  on public.lead_visibility_reviews
  for select
  to authenticated
  using (public.is_commercial_member());

drop policy if exists "lead_visibility_reviews_insert_commercial" on public.lead_visibility_reviews;
create policy "lead_visibility_reviews_insert_commercial"
  on public.lead_visibility_reviews
  for insert
  to authenticated
  with check (public.is_commercial_member());

drop policy if exists "lead_visibility_reviews_update_commercial" on public.lead_visibility_reviews;
create policy "lead_visibility_reviews_update_commercial"
  on public.lead_visibility_reviews
  for update
  to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

drop policy if exists "lead_visibility_reviews_delete_commercial" on public.lead_visibility_reviews;
create policy "lead_visibility_reviews_delete_commercial"
  on public.lead_visibility_reviews
  for delete
  to authenticated
  using (public.is_commercial_member());

revoke all on table public.lead_visibility_reviews from anon, authenticated;
grant select, insert, update, delete on table public.lead_visibility_reviews to authenticated;
