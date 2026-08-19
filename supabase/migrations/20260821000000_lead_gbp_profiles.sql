create table public.lead_gbp_profiles (
  id                   uuid        primary key default gen_random_uuid(),
  lead_id              uuid        not null references public.leads(id) on delete cascade,
  place_id             text        not null,
  is_primary           boolean     not null default false,
  sort_order           integer     not null,
  google_maps_uri      text,
  fetched_at           timestamptz not null default now(),
  fetched_by           uuid        not null references public.users(id),
  payload              jsonb       not null,
  matched_website_key  text,
  notes                text,
  constraint lead_gbp_profiles_place_id_len_chk
    check (char_length(trim(place_id)) between 10 and 500),
  constraint lead_gbp_profiles_maps_uri_len_chk
    check (
      google_maps_uri is null
      or char_length(trim(google_maps_uri)) between 1 and 2000
    ),
  constraint lead_gbp_profiles_website_key_len_chk
    check (
      matched_website_key is null
      or char_length(trim(matched_website_key)) between 1 and 500
    ),
  constraint lead_gbp_profiles_notes_len_chk
    check (
      notes is null
      or char_length(trim(notes)) between 1 and 2000
    )
);

create unique index lead_gbp_profiles_place_id_uidx
  on public.lead_gbp_profiles (place_id);

create unique index lead_gbp_profiles_primary_uidx
  on public.lead_gbp_profiles (lead_id)
  where is_primary;

create index lead_gbp_profiles_lead_id_idx
  on public.lead_gbp_profiles (lead_id, sort_order);

alter table public.lead_gbp_profiles enable row level security;

create policy "lead_gbp_profiles_select_commercial"
  on public.lead_gbp_profiles
  for select
  to authenticated
  using (public.is_commercial_member());

create policy "lead_gbp_profiles_insert_commercial"
  on public.lead_gbp_profiles
  for insert
  to authenticated
  with check (public.is_commercial_member());

create policy "lead_gbp_profiles_update_commercial"
  on public.lead_gbp_profiles
  for update
  to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

create policy "lead_gbp_profiles_delete_commercial"
  on public.lead_gbp_profiles
  for delete
  to authenticated
  using (public.is_commercial_member());

revoke all on table public.lead_gbp_profiles from anon, authenticated;
grant select, insert, update, delete on table public.lead_gbp_profiles to authenticated;
