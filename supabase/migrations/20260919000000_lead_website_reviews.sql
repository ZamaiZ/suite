-- A revisao do analista sai do snapshot e passa a viver por canal. O julgamento
-- e sobre o lead, nao sobre a coleta, entao ele nao deve ser versionado junto
-- com a auditoria nem duplicado a cada nova analise.

create table if not exists public.lead_website_reviews (
  id          uuid        primary key default gen_random_uuid(),
  lead_id     uuid        not null references public.leads(id) on delete cascade,
  channel_id  uuid        not null references public.lead_digital_channels(id) on delete cascade,
  review      jsonb       not null default '{}'::jsonb,
  notes       text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid        references public.users(id),
  constraint lead_website_reviews_notes_len_chk
    check (
      notes is null
      or char_length(trim(notes)) between 1 and 2000
    )
);

create unique index if not exists lead_website_reviews_channel_id_uidx
  on public.lead_website_reviews (channel_id);

create index if not exists lead_website_reviews_lead_id_idx
  on public.lead_website_reviews (lead_id);

alter table public.lead_website_reviews enable row level security;

drop policy if exists "lead_website_reviews_select_commercial" on public.lead_website_reviews;
create policy "lead_website_reviews_select_commercial"
  on public.lead_website_reviews
  for select
  to authenticated
  using (public.is_commercial_member());

drop policy if exists "lead_website_reviews_insert_commercial" on public.lead_website_reviews;
create policy "lead_website_reviews_insert_commercial"
  on public.lead_website_reviews
  for insert
  to authenticated
  with check (public.is_commercial_member());

drop policy if exists "lead_website_reviews_update_commercial" on public.lead_website_reviews;
create policy "lead_website_reviews_update_commercial"
  on public.lead_website_reviews
  for update
  to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

drop policy if exists "lead_website_reviews_delete_commercial" on public.lead_website_reviews;
create policy "lead_website_reviews_delete_commercial"
  on public.lead_website_reviews
  for delete
  to authenticated
  using (public.is_commercial_member());

revoke all on table public.lead_website_reviews from anon, authenticated;
grant select, insert, update, delete on table public.lead_website_reviews to authenticated;

-- Carga inicial a partir da auditoria mais recente de cada canal. A conversao
-- legada de notes para review.other e reaplicada aqui, porque depois desta
-- migration nao havera mais notes no snapshot para servir de fallback.

-- Em SQL estático o parser resolve as colunas antes de executar, então uma
-- segunda execução falharia ao mencionar `review` e `notes`, que esta mesma
-- migration derruba logo abaixo. O bloco dinâmico só roda enquanto elas
-- existirem.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lead_website_audits'
      and column_name = 'review'
  ) then
    execute $backfill$
      insert into public.lead_website_reviews (
        lead_id,
        channel_id,
        review,
        notes,
        updated_at
      )
      select distinct on (audit.channel_id)
        audit.lead_id,
        audit.channel_id,
        case
          when audit.review is null or audit.review = '{}'::jsonb then
            case
              when audit.notes is not null
                and char_length(trim(audit.notes)) > 0 then
                jsonb_build_object(
                  'other',
                  jsonb_build_object('verdict', null, 'note', trim(audit.notes))
                )
              else '{}'::jsonb
            end
          else audit.review
        end,
        audit.notes,
        audit.fetched_at
      from public.lead_website_audits as audit
      order by audit.channel_id, audit.fetched_at desc
      on conflict (channel_id) do nothing
    $backfill$;
  end if;
end $$;

alter table public.lead_website_audits
  drop constraint if exists lead_website_audits_notes_len_chk;

alter table public.lead_website_audits
  drop column if exists review,
  drop column if exists notes;
