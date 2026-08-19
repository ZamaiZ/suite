alter table public.lead_gbp_profiles
  add column if not exists rank_keywords text[] not null default '{}';

do $$
begin
  alter table public.lead_gbp_profiles
    add constraint lead_gbp_profiles_rank_keywords_len_chk
    check (cardinality(rank_keywords) <= 3) not valid;
exception
  when duplicate_object then null;
end $$;

alter table public.lead_gbp_profiles
  validate constraint lead_gbp_profiles_rank_keywords_len_chk;

create table if not exists public.lead_gbp_rank_checks (
  id             uuid        primary key default gen_random_uuid(),
  profile_id     uuid        not null,
  keyword        text        not null,
  maps_position  integer,
  in_top3        boolean     not null,
  competitors    jsonb       not null default '[]'::jsonb,
  check_url      text,
  checked_at     timestamptz not null,
  source         text        not null default 'dataforseo_maps',
  constraint lead_gbp_rank_checks_keyword_len_chk
    check (char_length(trim(keyword)) between 1 and 80),
  constraint lead_gbp_rank_checks_position_chk
    check (maps_position is null or maps_position >= 1),
  constraint lead_gbp_rank_checks_url_len_chk
    check (
      check_url is null
      or char_length(trim(check_url)) between 1 and 2000
    ),
  constraint lead_gbp_rank_checks_source_chk
    check (source = 'dataforseo_maps'),
  constraint lead_gbp_rank_checks_profile_keyword_key unique (profile_id, keyword)
);

do $$
begin
  alter table public.lead_gbp_rank_checks
    add constraint lead_gbp_rank_checks_profile_id_fkey
    foreign key (profile_id)
    references public.lead_gbp_profiles(id)
    on delete cascade
    not valid;
exception
  when duplicate_object then null;
end $$;

alter table public.lead_gbp_rank_checks
  validate constraint lead_gbp_rank_checks_profile_id_fkey;

create unique index if not exists lead_gbp_rank_checks_profile_keyword_uidx
  on public.lead_gbp_rank_checks (profile_id, keyword);

create index if not exists lead_gbp_rank_checks_profile_id_idx
  on public.lead_gbp_rank_checks (profile_id);

alter table public.lead_gbp_rank_checks enable row level security;

drop policy if exists "lead_gbp_rank_checks_select_commercial" on public.lead_gbp_rank_checks;
create policy "lead_gbp_rank_checks_select_commercial"
  on public.lead_gbp_rank_checks
  for select
  to authenticated
  using (public.is_commercial_member());

drop policy if exists "lead_gbp_rank_checks_insert_commercial" on public.lead_gbp_rank_checks;
create policy "lead_gbp_rank_checks_insert_commercial"
  on public.lead_gbp_rank_checks
  for insert
  to authenticated
  with check (public.is_commercial_member());

drop policy if exists "lead_gbp_rank_checks_update_commercial" on public.lead_gbp_rank_checks;
create policy "lead_gbp_rank_checks_update_commercial"
  on public.lead_gbp_rank_checks
  for update
  to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

drop policy if exists "lead_gbp_rank_checks_delete_commercial" on public.lead_gbp_rank_checks;
create policy "lead_gbp_rank_checks_delete_commercial"
  on public.lead_gbp_rank_checks
  for delete
  to authenticated
  using (public.is_commercial_member());

revoke all on table public.lead_gbp_rank_checks from anon, authenticated;
grant select, insert, update, delete on table public.lead_gbp_rank_checks to authenticated;
