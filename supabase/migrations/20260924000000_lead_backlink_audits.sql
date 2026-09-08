-- Autoridade externa passa a ter coleta. O pilar F era o unico do mapa com zero
-- ocorrencias no codigo.
--
-- Nasce append-only: sem indice unico, so um indice de leitura ordenado pelo
-- timestamp. As outras tabelas de auditoria comecaram com indice unico e a
-- migration 20260917 teve que derruba-los depois; esta ja nasce certa.
--
-- Tabela propria, e nao colunas em lead_website_audits, porque backlinks tem
-- cadencia e custo proprios: recrawlear o site nao pode zerar o que foi pago.

create table if not exists public.lead_backlink_audits (
  id          uuid        primary key default gen_random_uuid(),
  lead_id     uuid        not null references public.leads(id) on delete cascade,
  domain      text        not null,
  snapshot    jsonb       not null,
  fetched_at  timestamptz not null default now(),
  fetched_by  uuid        not null references public.users(id),
  constraint lead_backlink_audits_domain_len_chk
    check (char_length(trim(domain)) between 1 and 500)
);

create index if not exists lead_backlink_audits_lead_recent_idx
  on public.lead_backlink_audits (lead_id, fetched_at desc);

alter table public.lead_backlink_audits enable row level security;

drop policy if exists "lead_backlink_audits_select_commercial" on public.lead_backlink_audits;
create policy "lead_backlink_audits_select_commercial"
  on public.lead_backlink_audits
  for select
  to authenticated
  using (public.is_commercial_member());

drop policy if exists "lead_backlink_audits_insert_commercial" on public.lead_backlink_audits;
create policy "lead_backlink_audits_insert_commercial"
  on public.lead_backlink_audits
  for insert
  to authenticated
  with check (public.is_commercial_member());

drop policy if exists "lead_backlink_audits_update_commercial" on public.lead_backlink_audits;
create policy "lead_backlink_audits_update_commercial"
  on public.lead_backlink_audits
  for update
  to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

drop policy if exists "lead_backlink_audits_delete_commercial" on public.lead_backlink_audits;
create policy "lead_backlink_audits_delete_commercial"
  on public.lead_backlink_audits
  for delete
  to authenticated
  using (public.is_commercial_member());

revoke all on table public.lead_backlink_audits from anon, authenticated;
grant select, insert, update, delete on table public.lead_backlink_audits to authenticated;
