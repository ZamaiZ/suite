-- Julgamento do analista da etapa de Presenca em IA, e o conjunto de prompts
-- fixado.
--
-- `lead_geo_audits` e append-only: julgamento humano gravado la seria
-- versionado junto com a coleta e duplicado a cada analise, e a pergunta "qual
-- das copias vale?" nao teria resposta. Mesmo argumento de
-- 20260919000000_lead_website_reviews e de 20260926000000_lead_visibility_reviews.
--
-- `prompt_set` mora aqui, e nao no snapshot, pelo mesmo motivo que
-- `lead_digital_channels.audit_paths` fixou a amostra de paginas: prompt que
-- muda entre coletas transforma taxa de mencao em numero sem significado. E a
-- armadilha dos metodos divergentes na mesma serie temporal, que ja custou o
-- `maps-task.ts`.
--
-- `null` em `prompt_set` significa **nao fixado**, nunca "fixado e vazio". A
-- coluna nasce nula e so a sondagem da onda 3 escreve nela.
--
-- Sem carga inicial: nao existe review anterior desta etapa em lugar nenhum. A
-- tabela nasce vazia e lead nunca julgado le como review vazio.

create table if not exists public.lead_geo_reviews (
  id          uuid        primary key default gen_random_uuid(),
  lead_id     uuid        not null references public.leads(id) on delete cascade,
  review      jsonb       not null default '{}'::jsonb,
  prompt_set  jsonb,
  notes       text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid        references public.users(id),
  constraint lead_geo_reviews_notes_len_chk
    check (
      notes is null
      or char_length(trim(notes)) between 1 and 2000
    ),
  constraint lead_geo_reviews_review_obj_chk
    check (jsonb_typeof(review) = 'object')
);

create unique index if not exists lead_geo_reviews_lead_id_uidx
  on public.lead_geo_reviews (lead_id);

alter table public.lead_geo_reviews enable row level security;

drop policy if exists "lead_geo_reviews_select_commercial" on public.lead_geo_reviews;
create policy "lead_geo_reviews_select_commercial"
  on public.lead_geo_reviews
  for select
  to authenticated
  using (public.is_commercial_member());

drop policy if exists "lead_geo_reviews_insert_commercial" on public.lead_geo_reviews;
create policy "lead_geo_reviews_insert_commercial"
  on public.lead_geo_reviews
  for insert
  to authenticated
  with check (public.is_commercial_member());

drop policy if exists "lead_geo_reviews_update_commercial" on public.lead_geo_reviews;
create policy "lead_geo_reviews_update_commercial"
  on public.lead_geo_reviews
  for update
  to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

drop policy if exists "lead_geo_reviews_delete_commercial" on public.lead_geo_reviews;
create policy "lead_geo_reviews_delete_commercial"
  on public.lead_geo_reviews
  for delete
  to authenticated
  using (public.is_commercial_member());

revoke all on table public.lead_geo_reviews from anon, authenticated;
grant select, insert, update, delete on table public.lead_geo_reviews to authenticated;
