create table public.lead_visibility_audits (
  id          uuid        primary key default gen_random_uuid(),
  lead_id     uuid        not null references public.leads(id) on delete cascade,
  domain      text        not null,
  snapshot    jsonb       not null,
  fetched_at  timestamptz not null default now(),
  fetched_by  uuid        not null references public.users(id)
);

create unique index lead_visibility_audits_lead_id_uidx
  on public.lead_visibility_audits (lead_id);

alter table public.lead_visibility_audits enable row level security;

create policy "lead_visibility_audits_select_commercial"
  on public.lead_visibility_audits
  for select
  to authenticated
  using (public.is_commercial_member());

create policy "lead_visibility_audits_insert_commercial"
  on public.lead_visibility_audits
  for insert
  to authenticated
  with check (public.is_commercial_member());

create policy "lead_visibility_audits_update_commercial"
  on public.lead_visibility_audits
  for update
  to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

create policy "lead_visibility_audits_delete_commercial"
  on public.lead_visibility_audits
  for delete
  to authenticated
  using (public.is_commercial_member());

revoke all on table public.lead_visibility_audits from anon, authenticated;
grant select, insert, update, delete on table public.lead_visibility_audits to authenticated;
