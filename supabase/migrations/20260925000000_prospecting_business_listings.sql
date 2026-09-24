create or replace function public.prospecting_is_commercial_member(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles as ur
    where ur.user_id = p_user_id
      and ur.role::text in ('admin', 'sdr', 'closer')
  );
$$;

revoke all on function public.prospecting_is_commercial_member(uuid) from public;
grant execute on function public.prospecting_is_commercial_member(uuid) to authenticated;

create table public.prospecting_category_catalog (
  category_name text primary key,
  business_count bigint null
    check (business_count is null or business_count >= 0),
  catalog_date date null,
  fetched_at timestamptz not null,
  constraint prospecting_category_catalog_name_check
    check (
      length(category_name) between 1 and 160
      and category_name = lower(category_name)
      and category_name !~ '[[:space:]]'
    )
);

create table public.prospecting_segment_categories (
  segment_id uuid not null
    references public.segments(id) on delete cascade,
  category_name text not null,
  is_primary boolean not null default false,
  created_by uuid not null
    references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (segment_id, category_name)
);

create unique index prospecting_segment_categories_one_primary_idx
  on public.prospecting_segment_categories(segment_id)
  where is_primary;

create table public.prospecting_city_boundaries (
  id uuid primary key default gen_random_uuid(),
  state_code text not null,
  city text not null,
  ibge_code text not null unique,
  geometry jsonb not null,
  center_latitude double precision not null,
  center_longitude double precision not null,
  radius_km numeric(12, 6) not null,
  source_updated_at timestamptz null,
  fetched_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (state_code, city),
  constraint prospecting_city_boundaries_state_check
    check (state_code ~ '^[A-Z]{2}$'),
  constraint prospecting_city_boundaries_city_check
    check (length(btrim(city)) between 1 and 160),
  constraint prospecting_city_boundaries_geometry_check
    check (jsonb_typeof(geometry) = 'object'),
  constraint prospecting_city_boundaries_latitude_check
    check (center_latitude between -90 and 90),
  constraint prospecting_city_boundaries_longitude_check
    check (center_longitude between -180 and 180),
  constraint prospecting_city_boundaries_radius_check
    check (radius_km > 0)
);

create table public.prospecting_runs (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid not null
    references public.segments(id) on delete restrict,
  created_by uuid not null
    references public.users(id) on delete restrict,
  city text not null,
  state_code text not null,
  category_names text[] not null,
  primary_category text not null,
  ibge_code text not null,
  boundary_geometry jsonb not null,
  center_latitude double precision not null,
  center_longitude double precision not null,
  radius_km numeric(12, 6) not null,
  status text not null default 'draft',
  pause_reason text null,
  total_count integer null,
  fetched_count integer not null default 0,
  accepted_count integer not null default 0,
  ambiguous_count integer not null default 0,
  duplicate_count integer not null default 0,
  rejected_count integer not null default 0,
  next_offset integer not null default 0,
  offset_token text null,
  page_limit integer not null default 1000,
  result_limit integer not null,
  budget_usd numeric(14, 6) not null,
  estimated_cost_usd numeric(14, 6) not null default 0,
  actual_cost_usd numeric(14, 6) not null default 0,
  price_per_request_usd numeric(14, 8) not null,
  price_per_result_usd numeric(14, 8) not null,
  lease_owner uuid null,
  lease_expires_at timestamptz null,
  error_message text null,
  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prospecting_runs_status_check
    check (status in (
      'draft', 'collecting', 'paused', 'completed', 'failed', 'cancelled'
    )),
  constraint prospecting_runs_pause_reason_check
    check (
      (status = 'paused' and pause_reason in (
        'user', 'budget', 'vendor_price_change'
      ))
      or (status <> 'paused' and pause_reason is null)
    ),
  constraint prospecting_runs_state_check
    check (state_code ~ '^[A-Z]{2}$'),
  constraint prospecting_runs_categories_check
    check (
      cardinality(category_names) between 1 and 10
      and primary_category = any(category_names)
    ),
  constraint prospecting_runs_geometry_check
    check (jsonb_typeof(boundary_geometry) = 'object'),
  constraint prospecting_runs_coordinates_check
    check (
      center_latitude between -90 and 90
      and center_longitude between -180 and 180
      and radius_km > 0
    ),
  constraint prospecting_runs_counts_check
    check (
      (total_count is null or total_count >= 0)
      and fetched_count >= 0
      and accepted_count >= 0
      and ambiguous_count >= 0
      and duplicate_count >= 0
      and rejected_count >= 0
      and next_offset >= 0
    ),
  constraint prospecting_runs_limits_check
    check (
      page_limit = 1000
      and result_limit between 1 and 100000
      and budget_usd > 0
      and estimated_cost_usd >= 0
      and actual_cost_usd >= 0
      and price_per_request_usd >= 0
      and price_per_result_usd >= 0
    ),
  constraint prospecting_runs_lease_check
    check (
      (lease_owner is null and lease_expires_at is null)
      or (lease_owner is not null and lease_expires_at is not null)
    ),
  constraint prospecting_runs_error_length_check
    check (error_message is null or length(error_message) <= 500)
);

create index prospecting_runs_created_by_created_at_idx
  on public.prospecting_runs(created_by, created_at desc);
create index prospecting_runs_status_updated_at_idx
  on public.prospecting_runs(status, updated_at desc);

create table public.prospecting_run_pages (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null
    references public.prospecting_runs(id) on delete cascade,
  cursor_key text not null,
  status text not null default 'claimed',
  input_offset integer not null,
  input_offset_token text null,
  output_offset integer null,
  output_offset_token text null,
  received_count integer not null default 0,
  normalized_count integer not null default 0,
  rejected_count integer not null default 0,
  cost_usd numeric(14, 6) null,
  lease_owner uuid null,
  lease_expires_at timestamptz null,
  error_message text null,
  claimed_at timestamptz not null default now(),
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, cursor_key),
  constraint prospecting_run_pages_status_check
    check (status in ('claimed', 'completed', 'failed', 'unknown')),
  constraint prospecting_run_pages_counts_check
    check (
      input_offset >= 0
      and (output_offset is null or output_offset >= 0)
      and received_count >= 0
      and normalized_count >= 0
      and rejected_count >= 0
      and (cost_usd is null or cost_usd >= 0)
    ),
  constraint prospecting_run_pages_lease_check
    check (
      (status = 'claimed' and lease_owner is not null and lease_expires_at is not null)
      or (status <> 'claimed' and lease_owner is null and lease_expires_at is null)
    ),
  constraint prospecting_run_pages_error_length_check
    check (error_message is null or length(error_message) <= 500)
);

create index prospecting_run_pages_run_created_at_idx
  on public.prospecting_run_pages(run_id, created_at desc);

create table public.prospecting_candidates (
  id uuid primary key default gen_random_uuid(),
  place_id text not null unique,
  cid text null,
  feature_id text null,
  company_name text null,
  description text null,
  primary_category text null,
  category_ids text[] not null default '{}',
  additional_categories jsonb not null default '[]'::jsonb,
  address text null,
  address_info jsonb null,
  phone text null,
  website text null,
  website_domain text null,
  latitude double precision null,
  longitude double precision null,
  rating numeric(3, 2) null,
  reviews_count integer null,
  is_claimed boolean null,
  business_status text null,
  logo_url text null,
  main_image_url text null,
  total_photos integer null,
  check_url text null,
  vendor_first_seen timestamptz null,
  vendor_updated_at timestamptz null,
  last_verified_at timestamptz null,
  imported_lead_id uuid null
    references public.leads(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prospecting_candidates_name_check
    check (
      company_name is null
      or length(btrim(company_name)) between 1 and 300
    ),
  constraint prospecting_candidates_coordinates_check
    check (
      (latitude is null and longitude is null)
      or (
        latitude between -90 and 90
        and longitude between -180 and 180
      )
    ),
  constraint prospecting_candidates_rating_check
    check (rating is null or rating between 0 and 5),
  constraint prospecting_candidates_counts_check
    check (
      (reviews_count is null or reviews_count >= 0)
      and (total_photos is null or total_photos >= 0)
    )
);

create index prospecting_candidates_imported_lead_idx
  on public.prospecting_candidates(imported_lead_id)
  where imported_lead_id is not null;
create index prospecting_candidates_website_domain_idx
  on public.prospecting_candidates(website_domain)
  where website_domain is not null;

create table public.prospecting_run_candidates (
  run_id uuid not null
    references public.prospecting_runs(id) on delete cascade,
  candidate_id uuid not null
    references public.prospecting_candidates(id) on delete cascade,
  discovery_position integer not null,
  territory_class text not null,
  category_class text not null,
  review_state text not null default 'available',
  conflict_kind text null,
  conflict_severity text null,
  related_lead_id uuid null
    references public.leads(id) on delete set null,
  selected_at timestamptz null,
  ignored_at timestamptz null,
  imported_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (run_id, candidate_id),
  constraint prospecting_run_candidates_position_check
    check (discovery_position >= 0),
  constraint prospecting_run_candidates_territory_check
    check (territory_class in ('inside', 'outside', 'ambiguous')),
  constraint prospecting_run_candidates_category_check
    check (category_class in ('exact', 'related', 'mismatch')),
  constraint prospecting_run_candidates_review_check
    check (review_state in (
      'available', 'selected', 'ignored', 'duplicate', 'imported', 'stale',
      'outside_city', 'ambiguous_location', 'category_mismatch', 'closed',
      'missing_contact', 'missing_name'
    )),
  constraint prospecting_run_candidates_conflict_check
    check (
      (conflict_kind is null and conflict_severity is null)
      or (
        conflict_kind is not null
        and conflict_severity in ('block', 'warning')
      )
    )
);

create index prospecting_run_candidates_run_state_position_idx
  on public.prospecting_run_candidates(
    run_id,
    review_state,
    discovery_position
  );

alter table public.prospecting_category_catalog enable row level security;
alter table public.prospecting_segment_categories enable row level security;
alter table public.prospecting_city_boundaries enable row level security;
alter table public.prospecting_runs enable row level security;
alter table public.prospecting_run_pages enable row level security;
alter table public.prospecting_candidates enable row level security;
alter table public.prospecting_run_candidates enable row level security;

create policy prospecting_category_catalog_select_commercial
  on public.prospecting_category_catalog
  for select
  to authenticated
  using (public.prospecting_is_commercial_member(auth.uid()));

create policy prospecting_segment_categories_select_commercial
  on public.prospecting_segment_categories
  for select
  to authenticated
  using (public.prospecting_is_commercial_member(auth.uid()));

create policy prospecting_city_boundaries_select_commercial
  on public.prospecting_city_boundaries
  for select
  to authenticated
  using (public.prospecting_is_commercial_member(auth.uid()));

create policy prospecting_runs_select_commercial
  on public.prospecting_runs
  for select
  to authenticated
  using (public.prospecting_is_commercial_member(auth.uid()));

create policy prospecting_run_pages_select_commercial
  on public.prospecting_run_pages
  for select
  to authenticated
  using (public.prospecting_is_commercial_member(auth.uid()));

create policy prospecting_candidates_select_commercial
  on public.prospecting_candidates
  for select
  to authenticated
  using (public.prospecting_is_commercial_member(auth.uid()));

create policy prospecting_run_candidates_select_commercial
  on public.prospecting_run_candidates
  for select
  to authenticated
  using (public.prospecting_is_commercial_member(auth.uid()));

create or replace function public.replace_prospecting_category_catalog(
  p_actor_id uuid,
  p_fetched_at timestamptz,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if p_actor_id is distinct from auth.uid()
    or not public.prospecting_is_commercial_member(p_actor_id)
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'invalid category catalog' using errcode = '22023';
  end if;

  delete from public.prospecting_category_catalog
  where category_name is not null;
  insert into public.prospecting_category_catalog (
    category_name,
    business_count,
    catalog_date,
    fetched_at
  )
  select
    btrim(row.category_name),
    row.business_count,
    row.catalog_date,
    p_fetched_at
  from jsonb_to_recordset(p_rows) as row(
    category_name text,
    business_count bigint,
    catalog_date date
  )
  where nullif(btrim(row.category_name), '') is not null;

  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    raise exception 'empty category catalog' using errcode = '22023';
  end if;
  return inserted_count;
end;
$$;

create or replace function public.replace_prospecting_segment_categories(
  p_actor_id uuid,
  p_segment_id uuid,
  p_category_names text[],
  p_primary_category text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  distinct_count integer;
  known_count integer;
begin
  if p_actor_id is distinct from auth.uid()
    or not public.prospecting_is_commercial_member(p_actor_id)
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.segments where id = p_segment_id
  ) then
    raise exception 'segment not found' using errcode = '23503';
  end if;

  select count(distinct category_name)
  into distinct_count
  from unnest(p_category_names) as category_name;
  if distinct_count not between 1 and 10
    or cardinality(p_category_names) <> distinct_count
    or not p_primary_category = any(p_category_names)
  then
    raise exception 'invalid category mapping' using errcode = '22023';
  end if;

  select count(*)
  into known_count
  from public.prospecting_category_catalog
  where category_name = any(p_category_names);
  if known_count <> distinct_count then
    raise exception 'unknown category' using errcode = '23503';
  end if;

  delete from public.prospecting_segment_categories
  where segment_id = p_segment_id;

  insert into public.prospecting_segment_categories (
    segment_id,
    category_name,
    is_primary,
    created_by
  )
  select
    p_segment_id,
    category_name,
    category_name = p_primary_category,
    p_actor_id
  from unnest(p_category_names) as category_name;
end;
$$;

create or replace function public.upsert_prospecting_city_boundary(
  p_actor_id uuid,
  p_state_code text,
  p_city text,
  p_ibge_code text,
  p_geometry jsonb,
  p_center_latitude double precision,
  p_center_longitude double precision,
  p_radius_km numeric,
  p_source_updated_at timestamptz,
  p_fetched_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  boundary_id uuid;
begin
  if p_actor_id is distinct from auth.uid()
    or not public.prospecting_is_commercial_member(p_actor_id)
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.prospecting_city_boundaries (
    state_code,
    city,
    ibge_code,
    geometry,
    center_latitude,
    center_longitude,
    radius_km,
    source_updated_at,
    fetched_at
  )
  values (
    upper(p_state_code),
    btrim(p_city),
    btrim(p_ibge_code),
    p_geometry,
    p_center_latitude,
    p_center_longitude,
    p_radius_km,
    p_source_updated_at,
    p_fetched_at
  )
  on conflict (ibge_code) do update
  set
    state_code = excluded.state_code,
    city = excluded.city,
    geometry = excluded.geometry,
    center_latitude = excluded.center_latitude,
    center_longitude = excluded.center_longitude,
    radius_km = excluded.radius_km,
    source_updated_at = excluded.source_updated_at,
    fetched_at = excluded.fetched_at,
    updated_at = now()
  returning id into boundary_id;
  return boundary_id;
end;
$$;

create or replace function public.claim_prospecting_page(
  p_run_id uuid,
  p_actor_id uuid,
  p_lease_seconds integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_row public.prospecting_runs%rowtype;
  page_row public.prospecting_run_pages%rowtype;
  cursor_key_value text;
  lease_until timestamptz;
begin
  if p_actor_id is distinct from auth.uid()
    or not public.prospecting_is_commercial_member(p_actor_id)
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_lease_seconds not between 30 and 300 then
    raise exception 'invalid lease' using errcode = '22023';
  end if;

  select *
  into run_row
  from public.prospecting_runs
  where id = p_run_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;
  if run_row.status <> 'collecting' then
    return jsonb_build_object('outcome', 'not_collecting', 'status', run_row.status);
  end if;
  if run_row.fetched_count >= run_row.result_limit then
    update public.prospecting_runs
    set
      status = 'completed',
      pause_reason = null,
      finished_at = coalesce(finished_at, now()),
      lease_owner = null,
      lease_expires_at = null,
      updated_at = now()
    where id = p_run_id;
    return jsonb_build_object('outcome', 'completed');
  end if;
  if run_row.actual_cost_usd
      + run_row.price_per_request_usd
      + run_row.price_per_result_usd
        * least(run_row.page_limit, run_row.result_limit - run_row.fetched_count)
      > run_row.budget_usd
  then
    update public.prospecting_runs
    set
      status = 'paused',
      pause_reason = 'budget',
      lease_owner = null,
      lease_expires_at = null,
      updated_at = now()
    where id = p_run_id;
    return jsonb_build_object('outcome', 'paused', 'reason', 'budget');
  end if;
  if run_row.lease_expires_at is not null and run_row.lease_expires_at > now() then
    return jsonb_build_object('outcome', 'busy');
  end if;

  cursor_key_value := case
    when run_row.offset_token is not null
      then 'token:' || encode(sha256(convert_to(run_row.offset_token, 'UTF8')), 'hex')
    else 'offset:' || run_row.next_offset::text
  end;
  lease_until := now() + make_interval(secs => p_lease_seconds);

  select *
  into page_row
  from public.prospecting_run_pages
  where run_id = p_run_id
    and cursor_key = cursor_key_value
  for update;

  if found and page_row.status = 'completed' then
    return jsonb_build_object(
      'outcome', 'already_completed',
      'pageId', page_row.id
    );
  end if;
  if found and page_row.status = 'unknown' then
    return jsonb_build_object(
      'outcome', 'unknown',
      'pageId', page_row.id
    );
  end if;
  if found and page_row.status = 'failed' then
    return jsonb_build_object(
      'outcome', 'failed',
      'pageId', page_row.id
    );
  end if;
  if found and page_row.lease_expires_at > now() then
    return jsonb_build_object('outcome', 'busy');
  end if;

  if found then
    update public.prospecting_run_pages
    set
      status = 'claimed',
      lease_owner = p_actor_id,
      lease_expires_at = lease_until,
      error_message = null,
      claimed_at = now(),
      updated_at = now()
    where id = page_row.id
    returning * into page_row;
  else
    insert into public.prospecting_run_pages (
      run_id,
      cursor_key,
      status,
      input_offset,
      input_offset_token,
      lease_owner,
      lease_expires_at
    )
    values (
      p_run_id,
      cursor_key_value,
      'claimed',
      run_row.next_offset,
      run_row.offset_token,
      p_actor_id,
      lease_until
    )
    returning * into page_row;
  end if;

  update public.prospecting_runs
  set
    lease_owner = p_actor_id,
    lease_expires_at = lease_until,
    updated_at = now()
  where id = p_run_id;

  return jsonb_build_object(
    'outcome', 'claimed',
    'pageId', page_row.id,
    'inputOffset', page_row.input_offset,
    'inputOffsetToken', page_row.input_offset_token,
    'itemLimit', least(
      run_row.page_limit,
      run_row.result_limit - run_row.fetched_count
    ),
    'categories', to_jsonb(run_row.category_names),
    'latitude', run_row.center_latitude,
    'longitude', run_row.center_longitude,
    'radiusKm', run_row.radius_km
  );
end;
$$;

create or replace function public.create_prospecting_run(
  p_actor_id uuid,
  p_segment_id uuid,
  p_city text,
  p_state_code text,
  p_category_names text[],
  p_primary_category text,
  p_ibge_code text,
  p_boundary_geometry jsonb,
  p_center_latitude double precision,
  p_center_longitude double precision,
  p_radius_km numeric,
  p_result_limit integer,
  p_budget_usd numeric,
  p_estimated_cost_usd numeric,
  p_price_per_request_usd numeric,
  p_price_per_result_usd numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_id uuid;
  distinct_count integer;
  known_count integer;
begin
  if p_actor_id is distinct from auth.uid()
    or not public.prospecting_is_commercial_member(p_actor_id)
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.segments where id = p_segment_id) then
    raise exception 'segment not found' using errcode = '23503';
  end if;

  select count(distinct category_name)
  into distinct_count
  from unnest(p_category_names) as category_name;
  select count(*)
  into known_count
  from public.prospecting_category_catalog
  where category_name = any(p_category_names);
  if distinct_count not between 1 and 10
    or distinct_count <> cardinality(p_category_names)
    or known_count <> distinct_count
    or not p_primary_category = any(p_category_names)
  then
    raise exception 'invalid categories' using errcode = '22023';
  end if;
  if p_result_limit not between 1 and 100000
    or p_budget_usd <= 0
    or p_estimated_cost_usd < 0
    or p_estimated_cost_usd > p_budget_usd
    or p_price_per_request_usd < 0
    or p_price_per_result_usd < 0
  then
    raise exception 'invalid budget' using errcode = '22023';
  end if;

  insert into public.prospecting_runs (
    segment_id,
    created_by,
    city,
    state_code,
    category_names,
    primary_category,
    ibge_code,
    boundary_geometry,
    center_latitude,
    center_longitude,
    radius_km,
    result_limit,
    budget_usd,
    estimated_cost_usd,
    price_per_request_usd,
    price_per_result_usd
  )
  values (
    p_segment_id,
    p_actor_id,
    btrim(p_city),
    upper(p_state_code),
    p_category_names,
    p_primary_category,
    p_ibge_code,
    p_boundary_geometry,
    p_center_latitude,
    p_center_longitude,
    p_radius_km,
    p_result_limit,
    p_budget_usd,
    p_estimated_cost_usd,
    p_price_per_request_usd,
    p_price_per_result_usd
  )
  returning id into run_id;
  return run_id;
end;
$$;

create or replace function public.command_prospecting_run(
  p_run_id uuid,
  p_actor_id uuid,
  p_command text,
  p_pause_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_row public.prospecting_runs%rowtype;
begin
  if p_actor_id is distinct from auth.uid()
    or not public.prospecting_is_commercial_member(p_actor_id)
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select *
  into run_row
  from public.prospecting_runs
  where id = p_run_id
  for update;
  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  if p_command = 'start' and run_row.status = 'draft' then
    update public.prospecting_runs
    set
      status = 'collecting',
      pause_reason = null,
      started_at = coalesce(started_at, now()),
      updated_at = now()
    where id = p_run_id;
  elsif p_command = 'pause'
    and run_row.status = 'collecting'
    and p_pause_reason in ('user', 'budget', 'vendor_price_change')
  then
    update public.prospecting_runs
    set
      status = 'paused',
      pause_reason = p_pause_reason,
      lease_owner = null,
      lease_expires_at = null,
      updated_at = now()
    where id = p_run_id;
  elsif p_command = 'resume' and run_row.status = 'paused' then
    update public.prospecting_runs
    set
      status = 'collecting',
      pause_reason = null,
      error_message = null,
      updated_at = now()
    where id = p_run_id;
  elsif p_command = 'cancel'
    and run_row.status in ('draft', 'collecting', 'paused')
  then
    update public.prospecting_runs
    set
      status = 'cancelled',
      pause_reason = null,
      lease_owner = null,
      lease_expires_at = null,
      finished_at = now(),
      updated_at = now()
    where id = p_run_id;
  else
    return jsonb_build_object(
      'outcome', 'invalid_transition',
      'status', run_row.status
    );
  end if;
  return jsonb_build_object('outcome', 'ok');
end;
$$;

create or replace function public.fail_prospecting_page(
  p_page_id uuid,
  p_actor_id uuid,
  p_known_envelope boolean,
  p_cost_usd numeric,
  p_error_message text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  page_row public.prospecting_run_pages%rowtype;
  next_status text;
begin
  if p_actor_id is distinct from auth.uid()
    or not public.prospecting_is_commercial_member(p_actor_id)
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select *
  into page_row
  from public.prospecting_run_pages
  where id = p_page_id
  for update;
  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;
  if page_row.status <> 'claimed' then
    return jsonb_build_object(
      'outcome', 'already_final',
      'status', page_row.status
    );
  end if;
  if page_row.lease_owner is distinct from p_actor_id then
    raise exception 'lease owner mismatch' using errcode = '42501';
  end if;

  next_status := case when p_known_envelope then 'failed' else 'unknown' end;
  update public.prospecting_run_pages
  set
    status = next_status,
    cost_usd = case when p_known_envelope then greatest(coalesce(p_cost_usd, 0), 0) else null end,
    lease_owner = null,
    lease_expires_at = null,
    error_message = left(nullif(btrim(p_error_message), ''), 500),
    completed_at = now(),
    updated_at = now()
  where id = p_page_id;

  update public.prospecting_runs
  set
    status = 'failed',
    pause_reason = null,
    actual_cost_usd = actual_cost_usd
      + case when p_known_envelope then greatest(coalesce(p_cost_usd, 0), 0) else 0 end,
    lease_owner = null,
    lease_expires_at = null,
    error_message = left(nullif(btrim(p_error_message), ''), 500),
    finished_at = now(),
    updated_at = now()
  where id = page_row.run_id;

  return jsonb_build_object('outcome', next_status);
end;
$$;

create or replace function public.complete_prospecting_page(
  p_page_id uuid,
  p_actor_id uuid,
  p_total_count integer,
  p_next_offset integer,
  p_next_offset_token text,
  p_items jsonb,
  p_rejected_count integer,
  p_cost_usd numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  page_row public.prospecting_run_pages%rowtype;
  run_row public.prospecting_runs%rowtype;
  item record;
  candidate_id_value uuid;
  normalized_count integer := 0;
  accepted_delta integer := 0;
  ambiguous_delta integer := 0;
  duplicate_delta integer := 0;
  received_count integer;
  next_status text := 'collecting';
begin
  if p_actor_id is distinct from auth.uid()
    or not public.prospecting_is_commercial_member(p_actor_id)
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array'
    or p_rejected_count < 0
    or p_cost_usd < 0
    or (p_total_count is not null and p_total_count < 0)
    or (p_next_offset is not null and p_next_offset < 0)
  then
    raise exception 'invalid page receipt' using errcode = '22023';
  end if;

  select *
  into page_row
  from public.prospecting_run_pages
  where id = p_page_id
  for update;
  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;
  if page_row.status = 'completed' then
    return jsonb_build_object('outcome', 'already_completed');
  end if;
  if page_row.status <> 'claimed'
    or page_row.lease_owner is distinct from p_actor_id
  then
    raise exception 'invalid page lease' using errcode = '42501';
  end if;

  select *
  into run_row
  from public.prospecting_runs
  where id = page_row.run_id
  for update;
  if not found or run_row.status <> 'collecting' then
    raise exception 'run is not collecting' using errcode = '55000';
  end if;

  for item in
    select *
    from jsonb_to_recordset(p_items) as candidate(
      place_id text,
      cid text,
      feature_id text,
      company_name text,
      description text,
      primary_category text,
      category_ids text[],
      additional_categories jsonb,
      address text,
      address_info jsonb,
      phone text,
      website text,
      website_domain text,
      latitude double precision,
      longitude double precision,
      rating numeric,
      reviews_count integer,
      is_claimed boolean,
      business_status text,
      logo_url text,
      main_image_url text,
      total_photos integer,
      check_url text,
      vendor_first_seen timestamptz,
      vendor_updated_at timestamptz,
      observed_at timestamptz,
      discovery_position integer,
      territory_class text,
      category_class text,
      blocked_reason text,
      conflict_kind text,
      conflict_severity text,
      related_lead_id uuid
    )
  loop
    if nullif(btrim(item.place_id), '') is null
      or item.discovery_position < 0
      or item.territory_class not in ('inside', 'outside', 'ambiguous')
      or item.category_class not in ('exact', 'related', 'mismatch')
      or (
        item.blocked_reason is not null
        and item.blocked_reason not in (
          'outside_city', 'ambiguous_location', 'category_mismatch',
          'closed_forever', 'missing_name', 'missing_contact'
        )
      )
    then
      raise exception 'invalid normalized candidate' using errcode = '22023';
    end if;

    insert into public.prospecting_candidates (
      place_id,
      cid,
      feature_id,
      company_name,
      description,
      primary_category,
      category_ids,
      additional_categories,
      address,
      address_info,
      phone,
      website,
      website_domain,
      latitude,
      longitude,
      rating,
      reviews_count,
      is_claimed,
      business_status,
      logo_url,
      main_image_url,
      total_photos,
      check_url,
      vendor_first_seen,
      vendor_updated_at,
      first_seen_at,
      last_seen_at
    )
    values (
      btrim(item.place_id),
      item.cid,
      item.feature_id,
      nullif(btrim(item.company_name), ''),
      item.description,
      item.primary_category,
      coalesce(item.category_ids, '{}'),
      coalesce(item.additional_categories, '[]'::jsonb),
      item.address,
      item.address_info,
      item.phone,
      item.website,
      item.website_domain,
      item.latitude,
      item.longitude,
      item.rating,
      item.reviews_count,
      item.is_claimed,
      item.business_status,
      item.logo_url,
      item.main_image_url,
      item.total_photos,
      item.check_url,
      item.vendor_first_seen,
      item.vendor_updated_at,
      coalesce(item.observed_at, now()),
      coalesce(item.observed_at, now())
    )
    on conflict (place_id) do update
    set
      cid = excluded.cid,
      feature_id = excluded.feature_id,
      company_name = excluded.company_name,
      description = excluded.description,
      primary_category = excluded.primary_category,
      category_ids = excluded.category_ids,
      additional_categories = excluded.additional_categories,
      address = excluded.address,
      address_info = excluded.address_info,
      phone = excluded.phone,
      website = excluded.website,
      website_domain = excluded.website_domain,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      rating = excluded.rating,
      reviews_count = excluded.reviews_count,
      is_claimed = excluded.is_claimed,
      business_status = excluded.business_status,
      logo_url = excluded.logo_url,
      main_image_url = excluded.main_image_url,
      total_photos = excluded.total_photos,
      check_url = excluded.check_url,
      vendor_first_seen = coalesce(
        public.prospecting_candidates.vendor_first_seen,
        excluded.vendor_first_seen
      ),
      vendor_updated_at = excluded.vendor_updated_at,
      last_seen_at = excluded.last_seen_at,
      updated_at = now()
    returning id into candidate_id_value;

    insert into public.prospecting_run_candidates (
      run_id,
      candidate_id,
      discovery_position,
      territory_class,
      category_class,
      review_state,
      conflict_kind,
      conflict_severity,
      related_lead_id
    )
    values (
      run_row.id,
      candidate_id_value,
      item.discovery_position,
      item.territory_class,
      item.category_class,
      case
        when item.territory_class = 'outside' then 'outside_city'
        when item.territory_class = 'ambiguous' then 'ambiguous_location'
        when item.category_class = 'mismatch' then 'category_mismatch'
        when item.blocked_reason = 'closed_forever' then 'closed'
        when item.blocked_reason = 'missing_name' then 'missing_name'
        when item.blocked_reason = 'missing_contact' then 'missing_contact'
        when item.conflict_severity = 'block' then 'duplicate'
        else 'available'
      end,
      item.conflict_kind,
      item.conflict_severity,
      item.related_lead_id
    )
    on conflict (run_id, candidate_id) do update
    set
      discovery_position = least(
        public.prospecting_run_candidates.discovery_position,
        excluded.discovery_position
      ),
      territory_class = excluded.territory_class,
      category_class = excluded.category_class,
      review_state = case
        when public.prospecting_run_candidates.review_state in (
          'selected', 'ignored', 'imported'
        ) then public.prospecting_run_candidates.review_state
        else excluded.review_state
      end,
      conflict_kind = excluded.conflict_kind,
      conflict_severity = excluded.conflict_severity,
      related_lead_id = excluded.related_lead_id,
      updated_at = now();

    normalized_count := normalized_count + 1;
    if item.territory_class = 'ambiguous' then
      ambiguous_delta := ambiguous_delta + 1;
    end if;
    if item.conflict_severity = 'block' then
      duplicate_delta := duplicate_delta + 1;
    end if;
    if item.territory_class = 'inside'
      and item.category_class in ('exact', 'related')
      and item.blocked_reason is null
      and item.conflict_severity is distinct from 'block'
    then
      accepted_delta := accepted_delta + 1;
    end if;
  end loop;

  received_count := normalized_count + p_rejected_count;
  if p_next_offset is null
    or received_count = 0
    or run_row.fetched_count + received_count >= run_row.result_limit
    or (
      p_total_count is not null
      and run_row.fetched_count + received_count >= p_total_count
    )
  then
    next_status := 'completed';
  end if;

  update public.prospecting_run_pages
  set
    status = 'completed',
    output_offset = p_next_offset,
    output_offset_token = p_next_offset_token,
    received_count = received_count,
    normalized_count = normalized_count,
    rejected_count = p_rejected_count,
    cost_usd = p_cost_usd,
    lease_owner = null,
    lease_expires_at = null,
    completed_at = now(),
    updated_at = now()
  where id = page_row.id;

  update public.prospecting_runs
  set
    status = next_status,
    total_count = coalesce(p_total_count, total_count),
    fetched_count = fetched_count + received_count,
    accepted_count = accepted_count + accepted_delta,
    ambiguous_count = ambiguous_count + ambiguous_delta,
    duplicate_count = duplicate_count + duplicate_delta,
    rejected_count = rejected_count + p_rejected_count,
    next_offset = coalesce(p_next_offset, next_offset),
    offset_token = p_next_offset_token,
    actual_cost_usd = actual_cost_usd + p_cost_usd,
    lease_owner = null,
    lease_expires_at = null,
    finished_at = case
      when next_status = 'completed' then now()
      else finished_at
    end,
    updated_at = now()
  where id = run_row.id;

  return jsonb_build_object(
    'outcome', next_status,
    'receivedCount', received_count,
    'normalizedCount', normalized_count,
    'rejectedCount', p_rejected_count
  );
end;
$$;

create or replace function public.set_prospecting_candidate_review(
  p_run_id uuid,
  p_actor_id uuid,
  p_candidate_ids uuid[],
  p_review_state text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer;
begin
  if p_actor_id is distinct from auth.uid()
    or not public.prospecting_is_commercial_member(p_actor_id)
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_review_state not in ('selected', 'ignored')
    or cardinality(p_candidate_ids) not between 1 and 100
    or (
      select count(distinct candidate_id)
      from unnest(p_candidate_ids) as candidate_id
    ) <> cardinality(p_candidate_ids)
  then
    raise exception 'invalid review selection' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.prospecting_runs where id = p_run_id
  ) then
    raise exception 'run not found' using errcode = '23503';
  end if;

  if p_review_state = 'selected' then
    update public.prospecting_run_candidates
    set
      review_state = 'selected',
      selected_at = now(),
      ignored_at = null,
      updated_at = now()
    where run_id = p_run_id
      and candidate_id = any(p_candidate_ids)
      and review_state <> 'imported'
      and territory_class in ('inside', 'ambiguous')
      and category_class in ('exact', 'related')
      and conflict_severity is distinct from 'block';
  else
    update public.prospecting_run_candidates
    set
      review_state = 'ignored',
      ignored_at = now(),
      selected_at = null,
      updated_at = now()
    where run_id = p_run_id
      and candidate_id = any(p_candidate_ids)
      and review_state <> 'imported';
  end if;
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

create or replace function public.import_prospecting_candidate(
  p_run_id uuid,
  p_candidate_id uuid,
  p_actor_id uuid,
  p_revalidation_status text,
  p_live_candidate jsonb,
  p_territory_class text,
  p_category_class text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_row public.prospecting_runs%rowtype;
  relation_row public.prospecting_run_candidates%rowtype;
  candidate_row public.prospecting_candidates%rowtype;
  live record;
  new_lead_id uuid;
  related_id_value uuid;
  conflict_kind_value text;
  blocked_outcome text;
  blocked_state text;
begin
  if p_actor_id is distinct from auth.uid()
    or not public.prospecting_is_commercial_member(p_actor_id)
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_revalidation_status not in ('found', 'stale') then
    raise exception 'invalid revalidation status' using errcode = '22023';
  end if;

  select * into run_row
  from public.prospecting_runs
  where id = p_run_id;
  if not found then
    raise exception 'run not found' using errcode = '23503';
  end if;

  select * into relation_row
  from public.prospecting_run_candidates
  where run_id = p_run_id and candidate_id = p_candidate_id
  for update;
  if not found then
    raise exception 'candidate relation not found' using errcode = '23503';
  end if;

  select * into candidate_row
  from public.prospecting_candidates
  where id = p_candidate_id
  for update;
  if not found then
    raise exception 'candidate not found' using errcode = '23503';
  end if;

  if candidate_row.imported_lead_id is not null then
    return jsonb_build_object(
      'outcome', 'imported',
      'leadId', candidate_row.imported_lead_id
    );
  end if;

  if p_revalidation_status = 'stale' then
    if p_live_candidate is not null then
      raise exception 'stale revalidation cannot include candidate data'
        using errcode = '22023';
    end if;
    update public.prospecting_candidates
    set last_verified_at = now(), updated_at = now()
    where id = candidate_row.id;
    update public.prospecting_run_candidates
    set
      review_state = 'stale',
      selected_at = null,
      conflict_kind = null,
      conflict_severity = null,
      related_lead_id = null,
      updated_at = now()
    where run_id = run_row.id and candidate_id = candidate_row.id;
    return jsonb_build_object('outcome', 'stale');
  end if;

  if p_live_candidate is null
    or p_territory_class not in ('inside', 'outside', 'ambiguous')
    or p_category_class not in ('exact', 'related', 'mismatch')
  then
    raise exception 'invalid live candidate classification'
      using errcode = '22023';
  end if;

  select * into live
  from jsonb_to_record(p_live_candidate) as candidate_data(
    place_id text,
    cid text,
    feature_id text,
    company_name text,
    description text,
    primary_category text,
    category_ids text[],
    additional_categories jsonb,
    address text,
    address_info jsonb,
    phone text,
    website text,
    website_domain text,
    latitude double precision,
    longitude double precision,
    rating numeric,
    reviews_count integer,
    is_claimed boolean,
    business_status text,
    logo_url text,
    main_image_url text,
    total_photos integer,
    check_url text,
    vendor_first_seen timestamptz,
    vendor_updated_at timestamptz
  );

  if nullif(btrim(live.place_id), '') is distinct from candidate_row.place_id
    or (live.latitude is null) <> (live.longitude is null)
    or (
      nullif(btrim(live.website_domain), '') is not null
      and nullif(btrim(live.website), '') is null
    )
  then
    raise exception 'candidate identity mismatch' using errcode = '22023';
  end if;

  update public.prospecting_candidates
  set
    cid = live.cid,
    feature_id = live.feature_id,
    company_name = nullif(btrim(live.company_name), ''),
    description = live.description,
    primary_category = live.primary_category,
    category_ids = coalesce(live.category_ids, '{}'),
    additional_categories = coalesce(live.additional_categories, '[]'::jsonb),
    address = live.address,
    address_info = live.address_info,
    phone = nullif(btrim(live.phone), ''),
    website = nullif(btrim(live.website), ''),
    website_domain = nullif(btrim(live.website_domain), ''),
    latitude = live.latitude,
    longitude = live.longitude,
    rating = live.rating,
    reviews_count = live.reviews_count,
    is_claimed = live.is_claimed,
    business_status = live.business_status,
    logo_url = live.logo_url,
    main_image_url = live.main_image_url,
    total_photos = live.total_photos,
    check_url = live.check_url,
    vendor_first_seen = coalesce(candidate_row.vendor_first_seen, live.vendor_first_seen),
    vendor_updated_at = live.vendor_updated_at,
    last_verified_at = now(),
    last_seen_at = now(),
    updated_at = now()
  where id = candidate_row.id;

  update public.prospecting_run_candidates
  set
    territory_class = p_territory_class,
    category_class = p_category_class,
    updated_at = now()
  where run_id = run_row.id and candidate_id = candidate_row.id;

  blocked_outcome := case
    when upper(coalesce(live.business_status, '')) in (
      'CLOSED_PERMANENTLY', 'PERMANENTLY_CLOSED', 'CLOSED_FOREVER'
    ) then 'closed'
    when nullif(btrim(live.company_name), '') is null then 'missing_name'
    when nullif(btrim(live.website_domain), '') is null
      and nullif(btrim(live.phone), '') is null then 'no_contact'
    when p_territory_class = 'outside' then 'outside'
    when p_territory_class = 'ambiguous' then 'ambiguous'
    when p_category_class = 'mismatch' then 'mismatch'
    else null
  end;

  if blocked_outcome is not null then
    blocked_state := case blocked_outcome
      when 'closed' then 'closed'
      when 'missing_name' then 'missing_name'
      when 'no_contact' then 'missing_contact'
      when 'outside' then 'outside_city'
      when 'ambiguous' then 'ambiguous_location'
      when 'mismatch' then 'category_mismatch'
    end;
    update public.prospecting_run_candidates
    set
      review_state = blocked_state,
      selected_at = null,
      conflict_kind = null,
      conflict_severity = null,
      related_lead_id = null,
      updated_at = now()
    where run_id = run_row.id and candidate_id = candidate_row.id;
    return jsonb_build_object('outcome', blocked_outcome);
  end if;

  select lead_id into related_id_value
  from public.lead_gbp_profiles
  where place_id = candidate_row.place_id
  limit 1;
  if related_id_value is not null then
    conflict_kind_value := 'gbp_place_id';
  end if;

  if related_id_value is null and nullif(btrim(live.website_domain), '') is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'prospecting-domain:' || btrim(live.website_domain),
        0
      )
    );
    select id into related_id_value
    from public.leads
    where website_domain = btrim(live.website_domain)
    limit 1;
    if related_id_value is not null then
      conflict_kind_value := 'domain';
    else
      select lead_id into related_id_value
      from public.lead_digital_channels
      where type = 'website'
        and normalized_key = btrim(live.website_domain)
      limit 1;
      if related_id_value is not null then
        conflict_kind_value := 'domain';
      end if;
    end if;
  end if;

  if related_id_value is not null then
    update public.prospecting_run_candidates
    set
      review_state = 'duplicate',
      conflict_kind = conflict_kind_value,
      conflict_severity = 'block',
      related_lead_id = related_id_value,
      selected_at = null,
      updated_at = now()
    where run_id = run_row.id and candidate_id = candidate_row.id;
    return jsonb_build_object(
      'outcome', 'conflict',
      'conflictKind', conflict_kind_value,
      'relatedLeadId', related_id_value
    );
  end if;

  begin
    insert into public.leads (
      company_name,
      website,
      website_domain,
      contact_name,
      phone,
      email,
      status,
      assigned_sdr_id,
      created_by,
      segment_id,
      state_code,
      city
    )
    values (
      btrim(live.company_name),
      nullif(btrim(live.website), ''),
      nullif(btrim(live.website_domain), ''),
      null,
      nullif(btrim(live.phone), ''),
      null,
      'new',
      null,
      p_actor_id,
      run_row.segment_id,
      run_row.state_code,
      run_row.city
    )
    returning id into new_lead_id;

    if nullif(btrim(live.website_domain), '') is not null then
      insert into public.lead_digital_channels (
        lead_id,
        type,
        value,
        normalized_key,
        is_primary,
        sort_order
      ) values (
        new_lead_id,
        'website',
        btrim(live.website),
        btrim(live.website_domain),
        true,
        0
      );
    end if;
  exception when unique_violation then
    select id into related_id_value
    from public.leads
    where website_domain = nullif(btrim(live.website_domain), '')
    limit 1;
    if related_id_value is null then
      select lead_id into related_id_value
      from public.lead_digital_channels
      where type = 'website'
        and normalized_key = nullif(btrim(live.website_domain), '')
      limit 1;
    end if;
    if related_id_value is null then
      raise;
    end if;
    update public.prospecting_run_candidates
    set
      review_state = 'duplicate',
      conflict_kind = 'domain',
      conflict_severity = 'block',
      related_lead_id = related_id_value,
      selected_at = null,
      updated_at = now()
    where run_id = run_row.id and candidate_id = candidate_row.id;
    return jsonb_build_object(
      'outcome', 'conflict',
      'conflictKind', 'domain',
      'relatedLeadId', related_id_value
    );
  end;

  update public.prospecting_candidates
  set imported_lead_id = new_lead_id, updated_at = now()
  where id = candidate_row.id and imported_lead_id is null;

  update public.prospecting_run_candidates
  set
    review_state = 'imported',
    conflict_kind = null,
    conflict_severity = null,
    related_lead_id = null,
    imported_at = now(),
    selected_at = null,
    updated_at = now()
  where run_id = run_row.id and candidate_id = candidate_row.id;

  return jsonb_build_object('outcome', 'imported', 'leadId', new_lead_id);
end;
$$;

revoke all on function public.replace_prospecting_category_catalog(
  uuid, timestamptz, jsonb
) from public;
revoke all on function public.replace_prospecting_segment_categories(
  uuid, uuid, text[], text
) from public;
revoke all on function public.upsert_prospecting_city_boundary(
  uuid, text, text, text, jsonb, double precision, double precision,
  numeric, timestamptz, timestamptz
) from public;
revoke all on function public.claim_prospecting_page(
  uuid, uuid, integer
) from public;
revoke all on function public.create_prospecting_run(
  uuid, uuid, text, text, text[], text, text, jsonb, double precision,
  double precision, numeric, integer, numeric, numeric, numeric, numeric
) from public;
revoke all on function public.command_prospecting_run(
  uuid, uuid, text, text
) from public;
revoke all on function public.fail_prospecting_page(
  uuid, uuid, boolean, numeric, text
) from public;
revoke all on function public.complete_prospecting_page(
  uuid, uuid, integer, integer, text, jsonb, integer, numeric
) from public;
revoke all on function public.set_prospecting_candidate_review(
  uuid, uuid, uuid[], text
) from public;
revoke all on function public.import_prospecting_candidate(
  uuid, uuid, uuid, text, jsonb, text, text
) from public;

grant execute on function public.replace_prospecting_category_catalog(
  uuid, timestamptz, jsonb
) to authenticated;
grant execute on function public.replace_prospecting_segment_categories(
  uuid, uuid, text[], text
) to authenticated;
grant execute on function public.upsert_prospecting_city_boundary(
  uuid, text, text, text, jsonb, double precision, double precision,
  numeric, timestamptz, timestamptz
) to authenticated;
grant execute on function public.claim_prospecting_page(
  uuid, uuid, integer
) to authenticated;
grant execute on function public.create_prospecting_run(
  uuid, uuid, text, text, text[], text, text, jsonb, double precision,
  double precision, numeric, integer, numeric, numeric, numeric, numeric
) to authenticated;
grant execute on function public.command_prospecting_run(
  uuid, uuid, text, text
) to authenticated;
grant execute on function public.fail_prospecting_page(
  uuid, uuid, boolean, numeric, text
) to authenticated;
grant execute on function public.complete_prospecting_page(
  uuid, uuid, integer, integer, text, jsonb, integer, numeric
) to authenticated;
grant execute on function public.set_prospecting_candidate_review(
  uuid, uuid, uuid[], text
) to authenticated;
grant execute on function public.import_prospecting_candidate(
  uuid, uuid, uuid, text, jsonb, text, text
) to authenticated;
