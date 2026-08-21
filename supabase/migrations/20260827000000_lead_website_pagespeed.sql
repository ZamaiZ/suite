alter table public.lead_website_audits
  add column if not exists pagespeed jsonb,
  add column if not exists pagespeed_at timestamptz;

do $$
begin
  alter table public.lead_website_audits
    add constraint lead_website_audits_pagespeed_at_chk
    check (pagespeed_at is null or pagespeed is not null) not valid;
exception
  when duplicate_object then null;
end $$;

alter table public.lead_website_audits
  validate constraint lead_website_audits_pagespeed_at_chk;

create table if not exists public.lead_website_jobs (
  id             uuid        primary key default gen_random_uuid(),
  audit_id       uuid        not null,
  kind           text        not null,
  status         text        not null,
  error_message  text,
  started_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint lead_website_jobs_kind_chk
    check (kind in ('pagespeed_mobile', 'pagespeed_desktop')),
  constraint lead_website_jobs_status_chk
    check (status in ('queued', 'running', 'ready', 'failed')),
  constraint lead_website_jobs_error_len_chk
    check (
      error_message is null
      or char_length(trim(error_message)) between 1 and 500
    )
);

do $$
begin
  alter table public.lead_website_jobs
    add constraint lead_website_jobs_audit_id_fkey
    foreign key (audit_id)
    references public.lead_website_audits(id)
    on delete cascade
    not valid;
exception
  when duplicate_object then null;
end $$;

alter table public.lead_website_jobs
  validate constraint lead_website_jobs_audit_id_fkey;

create unique index if not exists lead_website_jobs_audit_id_kind_uidx
  on public.lead_website_jobs (audit_id, kind);

create index if not exists lead_website_jobs_audit_id_idx
  on public.lead_website_jobs (audit_id);

alter table public.lead_website_jobs enable row level security;

drop policy if exists "lead_website_jobs_select_commercial" on public.lead_website_jobs;
create policy "lead_website_jobs_select_commercial"
  on public.lead_website_jobs
  for select
  to authenticated
  using (public.is_commercial_member());

drop policy if exists "lead_website_jobs_insert_commercial" on public.lead_website_jobs;
create policy "lead_website_jobs_insert_commercial"
  on public.lead_website_jobs
  for insert
  to authenticated
  with check (public.is_commercial_member());

drop policy if exists "lead_website_jobs_update_commercial" on public.lead_website_jobs;
create policy "lead_website_jobs_update_commercial"
  on public.lead_website_jobs
  for update
  to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

drop policy if exists "lead_website_jobs_delete_commercial" on public.lead_website_jobs;
create policy "lead_website_jobs_delete_commercial"
  on public.lead_website_jobs
  for delete
  to authenticated
  using (public.is_commercial_member());

revoke all on table public.lead_website_jobs from anon, authenticated;
grant select, insert, update, delete on table public.lead_website_jobs to authenticated;
