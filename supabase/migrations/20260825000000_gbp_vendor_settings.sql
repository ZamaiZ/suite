create table if not exists public.app_settings (
  key          text        primary key,
  value        jsonb       not null,
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  constraint app_settings_key_len_chk
    check (char_length(trim(key)) between 1 and 64)
);

do $$
begin
  alter table public.app_settings
    add constraint app_settings_updated_by_fkey
    foreign key (updated_by)
    references public.users(id)
    on delete set null
    not valid;
exception
  when duplicate_object then null;
end $$;

alter table public.app_settings
  validate constraint app_settings_updated_by_fkey;

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_select_commercial" on public.app_settings;
create policy "app_settings_select_commercial"
  on public.app_settings
  for select
  to authenticated
  using (public.is_commercial_member());

drop policy if exists "app_settings_insert_admin" on public.app_settings;
create policy "app_settings_insert_admin"
  on public.app_settings
  for insert
  to authenticated
  with check (public.has_role('admin'::public.app_role));

drop policy if exists "app_settings_update_admin" on public.app_settings;
create policy "app_settings_update_admin"
  on public.app_settings
  for update
  to authenticated
  using (public.has_role('admin'::public.app_role))
  with check (public.has_role('admin'::public.app_role));

revoke all on table public.app_settings from anon, authenticated;
grant select, insert, update on table public.app_settings to authenticated;

alter table public.lead_gbp_rank_checks
  drop constraint if exists lead_gbp_rank_checks_source_chk;

alter table public.lead_gbp_rank_checks
  add constraint lead_gbp_rank_checks_source_chk
    check (source in ('dataforseo_maps', 'serpapi_maps'));
