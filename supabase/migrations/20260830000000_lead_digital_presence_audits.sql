create table public.lead_digital_presence_audits (
  id          uuid        primary key default gen_random_uuid(),
  lead_id     uuid        not null references public.leads(id) on delete cascade,
  review      jsonb       not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid        not null references public.users(id)
);

create unique index lead_digital_presence_audits_lead_id_uidx
  on public.lead_digital_presence_audits (lead_id);

alter table public.lead_digital_presence_audits enable row level security;

create policy "lead_digital_presence_audits_select_commercial"
  on public.lead_digital_presence_audits
  for select
  to authenticated
  using (public.is_commercial_member());

create policy "lead_digital_presence_audits_insert_commercial"
  on public.lead_digital_presence_audits
  for insert
  to authenticated
  with check (public.is_commercial_member());

create policy "lead_digital_presence_audits_update_commercial"
  on public.lead_digital_presence_audits
  for update
  to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

create policy "lead_digital_presence_audits_delete_commercial"
  on public.lead_digital_presence_audits
  for delete
  to authenticated
  using (public.is_commercial_member());

revoke all on table public.lead_digital_presence_audits from anon, authenticated;
grant select, insert, update, delete on table public.lead_digital_presence_audits to authenticated;
