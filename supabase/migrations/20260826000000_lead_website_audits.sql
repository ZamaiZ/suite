create table public.lead_website_audits (
  id           uuid        primary key default gen_random_uuid(),
  lead_id      uuid        not null references public.leads(id) on delete cascade,
  channel_id   uuid        not null references public.lead_digital_channels(id) on delete cascade,
  url          text        not null,
  fetched_at   timestamptz not null default now(),
  fetched_by   uuid        not null references public.users(id),
  crawl        jsonb       not null,
  notes        text,
  constraint lead_website_audits_url_len_chk
    check (char_length(trim(url)) between 1 and 2000),
  constraint lead_website_audits_notes_len_chk
    check (
      notes is null
      or char_length(trim(notes)) between 1 and 2000
    )
);

create unique index lead_website_audits_channel_id_uidx
  on public.lead_website_audits (channel_id);

create index lead_website_audits_lead_id_idx
  on public.lead_website_audits (lead_id);

alter table public.lead_website_audits enable row level security;

create policy "lead_website_audits_select_commercial"
  on public.lead_website_audits
  for select
  to authenticated
  using (public.is_commercial_member());

create policy "lead_website_audits_insert_commercial"
  on public.lead_website_audits
  for insert
  to authenticated
  with check (public.is_commercial_member());

create policy "lead_website_audits_update_commercial"
  on public.lead_website_audits
  for update
  to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

create policy "lead_website_audits_delete_commercial"
  on public.lead_website_audits
  for delete
  to authenticated
  using (public.is_commercial_member());

revoke all on table public.lead_website_audits from anon, authenticated;
grant select, insert, update, delete on table public.lead_website_audits to authenticated;
