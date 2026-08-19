alter table public.lead_gbp_profiles
  add column if not exists posts jsonb,
  add column if not exists posts_at timestamptz,
  add column if not exists reviews jsonb,
  add column if not exists reviews_at timestamptz,
  add column if not exists qna jsonb,
  add column if not exists qna_at timestamptz;

do $$
begin
  alter table public.lead_gbp_profiles
    add constraint lead_gbp_profiles_posts_at_chk
    check ((posts is null) = (posts_at is null)) not valid;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.lead_gbp_profiles
    add constraint lead_gbp_profiles_reviews_at_chk
    check ((reviews is null) = (reviews_at is null)) not valid;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.lead_gbp_profiles
    add constraint lead_gbp_profiles_qna_at_chk
    check ((qna is null) = (qna_at is null)) not valid;
exception
  when duplicate_object then null;
end $$;

alter table public.lead_gbp_profiles
  validate constraint lead_gbp_profiles_posts_at_chk,
  validate constraint lead_gbp_profiles_reviews_at_chk,
  validate constraint lead_gbp_profiles_qna_at_chk;

create table if not exists public.lead_gbp_jobs (
  id             uuid        primary key default gen_random_uuid(),
  profile_id     uuid        not null,
  kind           text        not null,
  dfs_task_id    text        not null,
  status         text        not null,
  error_message  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint lead_gbp_jobs_kind_chk
    check (kind in ('reviews', 'updates')),
  constraint lead_gbp_jobs_status_chk
    check (status in ('queued', 'ready', 'failed')),
  constraint lead_gbp_jobs_task_id_len_chk
    check (char_length(trim(dfs_task_id)) between 1 and 128),
  constraint lead_gbp_jobs_error_len_chk
    check (
      error_message is null
      or char_length(trim(error_message)) between 1 and 500
    )
);

do $$
begin
  alter table public.lead_gbp_jobs
    add constraint lead_gbp_jobs_profile_id_fkey
    foreign key (profile_id)
    references public.lead_gbp_profiles(id)
    on delete cascade
    not valid;
exception
  when duplicate_object then null;
end $$;

alter table public.lead_gbp_jobs
  validate constraint lead_gbp_jobs_profile_id_fkey;

create unique index if not exists lead_gbp_jobs_profile_kind_uidx
  on public.lead_gbp_jobs (profile_id, kind);

create index if not exists lead_gbp_jobs_profile_id_idx
  on public.lead_gbp_jobs (profile_id);

alter table public.lead_gbp_jobs enable row level security;

drop policy if exists "lead_gbp_jobs_select_commercial" on public.lead_gbp_jobs;
create policy "lead_gbp_jobs_select_commercial"
  on public.lead_gbp_jobs
  for select
  to authenticated
  using (public.is_commercial_member());

drop policy if exists "lead_gbp_jobs_insert_commercial" on public.lead_gbp_jobs;
create policy "lead_gbp_jobs_insert_commercial"
  on public.lead_gbp_jobs
  for insert
  to authenticated
  with check (public.is_commercial_member());

drop policy if exists "lead_gbp_jobs_update_commercial" on public.lead_gbp_jobs;
create policy "lead_gbp_jobs_update_commercial"
  on public.lead_gbp_jobs
  for update
  to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

drop policy if exists "lead_gbp_jobs_delete_commercial" on public.lead_gbp_jobs;
create policy "lead_gbp_jobs_delete_commercial"
  on public.lead_gbp_jobs
  for delete
  to authenticated
  using (public.is_commercial_member());

revoke all on table public.lead_gbp_jobs from anon, authenticated;
grant select, insert, update, delete on table public.lead_gbp_jobs to authenticated;
