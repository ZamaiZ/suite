create table public.segments (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  slug        text        not null unique,
  created_at  timestamptz not null default now(),
  constraint segments_name_len_chk check (char_length(trim(name)) between 1 and 64),
  constraint segments_slug_format_chk check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

alter table public.leads
  add column segment_id uuid references public.segments(id) on delete restrict,
  add column state_code char(2),
  add column city text;

alter table public.leads
  add constraint leads_state_code_format_chk check (
    state_code is null or state_code ~ '^[A-Z]{2}$'
  );

alter table public.leads
  add constraint leads_location_pair_chk check (
    (state_code is null and city is null)
    or (state_code is not null and city is not null and char_length(trim(city)) > 0)
  );

create index leads_segment_id_idx on public.leads (segment_id);
create index leads_state_code_city_idx on public.leads (state_code, city);

alter table public.segments enable row level security;

create policy "segments_select_commercial"
  on public.segments
  for select
  to authenticated
  using (public.is_commercial_member());

create policy "segments_insert_commercial"
  on public.segments
  for insert
  to authenticated
  with check (public.is_commercial_member());

revoke all on table public.segments from anon, authenticated;
grant select, insert on table public.segments to authenticated;
