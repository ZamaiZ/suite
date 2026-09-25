create or replace function public.is_valid_prospecting_cnpj(p_cnpj text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized text := upper(regexp_replace(coalesce(p_cnpj, ''), '[^A-Z0-9]', '', 'g'));
  checksum integer;
  digit_value integer;
  weight integer;
  total integer;
  index_value integer;
  first_digit integer;
  second_digit integer;
begin
  if normalized !~ '^[A-Z0-9]{12}[0-9]{2}$'
    or normalized ~ '^([A-Z0-9])\1{13}$'
  then
    return false;
  end if;

  total := 0;
  weight := 2;
  for index_value in reverse 12..1 loop
    digit_value := ascii(substr(normalized, index_value, 1)) - 48;
    total := total + digit_value * weight;
    weight := case when weight = 9 then 2 else weight + 1 end;
  end loop;
  checksum := total % 11;
  first_digit := case when checksum < 2 then 0 else 11 - checksum end;

  total := 0;
  weight := 2;
  for index_value in reverse 13..1 loop
    digit_value := ascii(substr(normalized, index_value, 1)) - 48;
    total := total + digit_value * weight;
    weight := case when weight = 9 then 2 else weight + 1 end;
  end loop;
  checksum := total % 11;
  second_digit := case when checksum < 2 then 0 else 11 - checksum end;

  return substr(normalized, 13, 2) = first_digit::text || second_digit::text;
end;
$$;

revoke all on function public.is_valid_prospecting_cnpj(text) from public;
grant execute on function public.is_valid_prospecting_cnpj(text) to authenticated;

alter table public.prospecting_candidates
  add column cnpj text,
  add column cnpj_status text not null default 'not_searched',
  add column cnpj_confirmed_match_id uuid,
  add column cnpj_confirmed_at timestamptz,
  add column cnpj_confirmed_by uuid references public.users(id) on delete set null,
  add column cnpj_last_attempt_at timestamptz,
  add column cnpj_source_updated_at timestamptz,
  add constraint prospecting_candidates_cnpj_format_chk
    check (cnpj is null or public.is_valid_prospecting_cnpj(cnpj)),
  add constraint prospecting_candidates_cnpj_status_chk
    check (cnpj_status in (
      'not_searched', 'searching', 'suggestion', 'needs_review', 'confirmed',
      'not_found', 'source_limited', 'source_unavailable'
    )),
  add constraint prospecting_candidates_cnpj_confirmation_chk
    check (
      (cnpj is null and cnpj_confirmed_at is null and cnpj_confirmed_by is null)
      or (
        cnpj is not null
        and cnpj_confirmed_at is not null
        and cnpj_confirmed_by is not null
        and cnpj_status = 'confirmed'
      )
    );

alter table public.leads
  add column cnpj text,
  add constraint leads_cnpj_format_chk
    check (cnpj is null or public.is_valid_prospecting_cnpj(cnpj));

create table public.prospecting_cnpj_batches (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.prospecting_runs(id) on delete cascade,
  actor_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'queued',
  provider_job_id text not null,
  provider_started_at timestamptz,
  processed_count integer not null default 0,
  total_count integer not null,
  bytes_processed bigint,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prospecting_cnpj_batches_status_chk
    check (status in (
      'queued', 'processing', 'completed', 'source_limited', 'source_unavailable'
    )),
  constraint prospecting_cnpj_batches_count_chk
    check (total_count between 1 and 50 and processed_count between 0 and total_count),
  constraint prospecting_cnpj_batches_bytes_chk
    check (bytes_processed is null or bytes_processed >= 0),
  unique (id, run_id, actor_id)
);

create index prospecting_cnpj_batches_actor_run_idx
  on public.prospecting_cnpj_batches(actor_id, run_id, created_at desc);

create table public.prospecting_cnpj_batch_candidates (
  batch_id uuid not null,
  run_id uuid not null,
  actor_id uuid not null,
  candidate_id uuid not null references public.prospecting_candidates(id) on delete cascade,
  position integer not null,
  status text not null default 'pending',
  attempt_id uuid,
  updated_at timestamptz not null default now(),
  primary key (batch_id, candidate_id),
  unique (batch_id, position),
  foreign key (batch_id, run_id, actor_id)
    references public.prospecting_cnpj_batches(id, run_id, actor_id) on delete cascade,
  foreign key (run_id, candidate_id)
    references public.prospecting_run_candidates(run_id, candidate_id) on delete cascade,
  constraint prospecting_cnpj_batch_candidates_status_chk
    check (status in (
      'pending', 'suggestion', 'needs_review', 'not_found',
      'source_limited', 'source_unavailable'
    )),
  constraint prospecting_cnpj_batch_candidates_position_chk check (position > 0)
);

create index prospecting_cnpj_batch_candidates_progress_idx
  on public.prospecting_cnpj_batch_candidates(batch_id, position, status);

create table public.prospecting_cnpj_attempts (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.prospecting_cnpj_batches(id) on delete cascade,
  run_id uuid not null,
  candidate_id uuid not null,
  provider text not null default 'opencnpj_bigquery',
  status text not null,
  bytes_processed bigint,
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (batch_id, candidate_id)
    references public.prospecting_cnpj_batch_candidates(batch_id, candidate_id) on delete cascade,
  constraint prospecting_cnpj_attempts_status_chk
    check (status in (
      'suggestion', 'needs_review', 'not_found', 'source_limited', 'source_unavailable'
    )),
  constraint prospecting_cnpj_attempts_bytes_chk
    check (bytes_processed is null or bytes_processed >= 0)
);

create index prospecting_cnpj_attempts_candidate_created_idx
  on public.prospecting_cnpj_attempts(candidate_id, created_at desc);

create table public.prospecting_cnpj_matches (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.prospecting_cnpj_attempts(id) on delete cascade,
  batch_id uuid not null,
  run_id uuid not null,
  candidate_id uuid not null,
  cnpj text not null,
  legal_name text,
  trade_name text,
  registration_status text,
  city text,
  state_code text,
  primary_cnae text,
  source text not null default 'opencnpj_bigquery',
  source_updated_at timestamptz,
  source_url text not null,
  structurally_valid boolean not null,
  confirmed_at timestamptz,
  confirmed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (batch_id, candidate_id)
    references public.prospecting_cnpj_batch_candidates(batch_id, candidate_id) on delete cascade,
  foreign key (run_id, candidate_id)
    references public.prospecting_run_candidates(run_id, candidate_id) on delete cascade,
  constraint prospecting_cnpj_matches_format_chk
    check (cnpj ~ '^[A-Z0-9]{12}[0-9]{2}$'),
  constraint prospecting_cnpj_matches_validity_chk
    check (structurally_valid = public.is_valid_prospecting_cnpj(cnpj)),
  constraint prospecting_cnpj_matches_text_chk
    check (
      (legal_name is null or length(legal_name) <= 300)
      and (trade_name is null or length(trade_name) <= 300)
      and (registration_status is null or length(registration_status) <= 80)
      and (city is null or length(city) <= 160)
      and (state_code is null or state_code ~ '^[A-Z]{2}$')
      and (primary_cnae is null or length(primary_cnae) <= 100)
      and length(source_url) <= 500
    ),
  unique (attempt_id, cnpj)
);

alter table public.prospecting_candidates
  add constraint prospecting_candidates_cnpj_confirmed_match_fk
    foreign key (cnpj_confirmed_match_id)
    references public.prospecting_cnpj_matches(id) on delete set null;

create index prospecting_cnpj_matches_candidate_created_idx
  on public.prospecting_cnpj_matches(candidate_id, created_at desc);

alter table public.prospecting_cnpj_batches enable row level security;
alter table public.prospecting_cnpj_batch_candidates enable row level security;
alter table public.prospecting_cnpj_attempts enable row level security;
alter table public.prospecting_cnpj_matches enable row level security;

create policy prospecting_cnpj_batches_select_owner
  on public.prospecting_cnpj_batches for select to authenticated
  using (actor_id = auth.uid() and public.prospecting_is_commercial_member(auth.uid()));
create policy prospecting_cnpj_batch_candidates_select_owner
  on public.prospecting_cnpj_batch_candidates for select to authenticated
  using (actor_id = auth.uid() and public.prospecting_is_commercial_member(auth.uid()));
create policy prospecting_cnpj_attempts_select_owner
  on public.prospecting_cnpj_attempts for select to authenticated
  using (exists (
    select 1 from public.prospecting_cnpj_batches b
    where b.id = batch_id and b.actor_id = auth.uid()
      and public.prospecting_is_commercial_member(auth.uid())
  ));
create policy prospecting_cnpj_matches_select_owner
  on public.prospecting_cnpj_matches for select to authenticated
  using (exists (
    select 1 from public.prospecting_cnpj_batches b
    where b.id = batch_id and b.actor_id = auth.uid()
      and public.prospecting_is_commercial_member(auth.uid())
  ));

revoke all on public.prospecting_cnpj_batches from anon, authenticated;
revoke all on public.prospecting_cnpj_batch_candidates from anon, authenticated;
revoke all on public.prospecting_cnpj_attempts from anon, authenticated;
revoke all on public.prospecting_cnpj_matches from anon, authenticated;
grant select on public.prospecting_cnpj_batches to authenticated;
grant select on public.prospecting_cnpj_batch_candidates to authenticated;
grant select on public.prospecting_cnpj_attempts to authenticated;
grant select on public.prospecting_cnpj_matches to authenticated;

create or replace function public.create_prospecting_cnpj_batch(
  p_run_id uuid,
  p_candidate_ids uuid[],
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  eligible_count integer;
  batch_id_value uuid;
begin
  if p_actor_id is distinct from auth.uid()
    or not public.prospecting_is_commercial_member(p_actor_id)
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_candidate_ids is null
    or cardinality(p_candidate_ids) not between 1 and 50
    or cardinality(p_candidate_ids) <> (
      select count(distinct candidate_id) from unnest(p_candidate_ids) candidate_id
    )
  then
    raise exception 'invalid candidate selection' using errcode = '22023';
  end if;

  -- Serialize competing tabs/members on the candidate rows before checking for
  -- an active batch; the browser guard alone cannot prevent duplicate jobs.
  perform candidate.id
  from public.prospecting_candidates candidate
  where candidate.id = any(p_candidate_ids)
  order by candidate.id
  for update;

  if exists (
    select 1
    from public.prospecting_cnpj_batch_candidates batch_candidate
    join public.prospecting_cnpj_batches batch
      on batch.id = batch_candidate.batch_id
    where batch_candidate.candidate_id = any(p_candidate_ids)
      and batch.status in ('queued', 'processing')
  ) then
    raise exception 'candidate already has an active CNPJ batch'
      using errcode = '22023';
  end if;

  select count(*) into eligible_count
  from public.prospecting_run_candidates relation
  join public.prospecting_candidates candidate on candidate.id = relation.candidate_id
  where relation.run_id = p_run_id
    and relation.candidate_id = any(p_candidate_ids)
    and relation.review_state not in ('imported', 'ignored')
    and candidate.imported_lead_id is null
    and nullif(btrim(candidate.company_name), '') is not null;
  if eligible_count <> cardinality(p_candidate_ids) then
    raise exception 'candidate selection is outside the run or ineligible'
      using errcode = '22023';
  end if;

  insert into public.prospecting_cnpj_batches (
    run_id, actor_id, provider_job_id, total_count
  ) values (
    p_run_id,
    p_actor_id,
    'suite_cnpj_' || replace(gen_random_uuid()::text, '-', ''),
    cardinality(p_candidate_ids)
  ) returning id into batch_id_value;

  update public.prospecting_cnpj_batches
  set provider_job_id = 'suite_cnpj_' || replace(batch_id_value::text, '-', '')
  where id = batch_id_value;

  insert into public.prospecting_cnpj_batch_candidates (
    batch_id, run_id, actor_id, candidate_id, position
  )
  select batch_id_value, p_run_id, p_actor_id, selected.candidate_id,
    selected.position::integer
  from unnest(p_candidate_ids) with ordinality as selected(candidate_id, position);

  update public.prospecting_candidates
  set
    cnpj_status = case when cnpj is null then 'searching' else 'confirmed' end,
    cnpj_last_attempt_at = now(),
    updated_at = now()
  where id = any(p_candidate_ids);

  return batch_id_value;
end;
$$;

create or replace function public.claim_prospecting_cnpj_batch(
  p_batch_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch_row public.prospecting_cnpj_batches%rowtype;
begin
  if p_actor_id is distinct from auth.uid()
    or not public.prospecting_is_commercial_member(p_actor_id)
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into batch_row
  from public.prospecting_cnpj_batches
  where id = p_batch_id
  for update;
  if not found then raise exception 'batch not found' using errcode = '23503'; end if;
  if batch_row.actor_id <> p_actor_id then
    raise exception 'batch belongs to another member' using errcode = '42501';
  end if;
  if batch_row.status = 'queued' then
    update public.prospecting_cnpj_batches
    set status = 'processing', updated_at = now()
    where id = p_batch_id
    returning * into batch_row;
  end if;
  return jsonb_build_object(
    'status', batch_row.status,
    'jobId', batch_row.provider_job_id,
    'providerStartedAt', batch_row.provider_started_at,
    'processedCount', batch_row.processed_count,
    'totalCount', batch_row.total_count
  );
end;
$$;

create or replace function public.mark_prospecting_cnpj_job_started(
  p_batch_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.prospecting_is_commercial_member(p_actor_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.prospecting_cnpj_batches
  set provider_started_at = coalesce(provider_started_at, now()), updated_at = now()
  where id = p_batch_id and actor_id = p_actor_id and status = 'processing';
  if not found then raise exception 'batch not active' using errcode = '22023'; end if;
end;
$$;

create or replace function public.record_prospecting_cnpj_batch(
  p_batch_id uuid,
  p_actor_id uuid,
  p_status text,
  p_bytes_processed bigint,
  p_source_updated_at timestamptz,
  p_matches jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch_row public.prospecting_cnpj_batches%rowtype;
  selected record;
  attempt_id_value uuid;
  match_count integer;
  valid_count integer;
  attempt_status text;
  processed integer := 0;
begin
  if not public.prospecting_is_commercial_member(p_actor_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status not in ('completed', 'source_limited', 'source_unavailable')
    or p_bytes_processed < 0
    or jsonb_typeof(p_matches) <> 'array'
    or jsonb_array_length(p_matches) > 500
  then
    raise exception 'invalid provider result' using errcode = '22023';
  end if;
  select * into batch_row
  from public.prospecting_cnpj_batches
  where id = p_batch_id and actor_id = p_actor_id
  for update;
  if not found then raise exception 'batch not found' using errcode = '23503'; end if;
  if batch_row.status in ('completed', 'source_limited', 'source_unavailable') then
    return jsonb_build_object(
      'status', batch_row.status,
      'processedCount', batch_row.processed_count,
      'totalCount', batch_row.total_count
    );
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_matches) as item(
      candidate_id uuid, cnpj text, legal_name text, trade_name text,
      registration_status text, city text, state_code text, primary_cnae text,
      source_updated_at timestamptz, source_url text, structurally_valid boolean
    )
    left join public.prospecting_cnpj_batch_candidates batch_candidate
      on batch_candidate.batch_id = p_batch_id
      and batch_candidate.candidate_id = item.candidate_id
    where batch_candidate.candidate_id is null
  ) then
    raise exception 'provider result contains a candidate outside the batch'
      using errcode = '22023';
  end if;

  for selected in
    select candidate_id
    from public.prospecting_cnpj_batch_candidates
    where batch_id = p_batch_id
    order by position
  loop
    select
      count(*)::integer,
      count(*) filter (where item.structurally_valid)::integer
    into match_count, valid_count
    from jsonb_to_recordset(p_matches) as item(
      candidate_id uuid, cnpj text, legal_name text, trade_name text,
      registration_status text, city text, state_code text, primary_cnae text,
      source_updated_at timestamptz, source_url text, structurally_valid boolean
    )
    where item.candidate_id = selected.candidate_id;

    attempt_status := case
      when p_status <> 'completed' then p_status
      when match_count = 0 then 'not_found'
      when match_count = 1 and valid_count = 1 then 'suggestion'
      else 'needs_review'
    end;
    attempt_id_value := gen_random_uuid();
    insert into public.prospecting_cnpj_attempts (
      id, batch_id, run_id, candidate_id, status, bytes_processed,
      source_updated_at
    ) values (
      attempt_id_value, p_batch_id, batch_row.run_id, selected.candidate_id,
      attempt_status, p_bytes_processed, p_source_updated_at
    );

    if p_status = 'completed' and match_count > 0 then
      insert into public.prospecting_cnpj_matches (
        attempt_id, batch_id, run_id, candidate_id, cnpj, legal_name,
        trade_name, registration_status, city, state_code, primary_cnae,
        source_updated_at, source_url, structurally_valid
      )
      select
        attempt_id_value, p_batch_id, batch_row.run_id, item.candidate_id,
        upper(item.cnpj), nullif(btrim(item.legal_name), ''),
        nullif(btrim(item.trade_name), ''), nullif(btrim(item.registration_status), ''),
        nullif(btrim(item.city), ''), upper(nullif(btrim(item.state_code), '')),
        nullif(btrim(item.primary_cnae), ''), item.source_updated_at,
        item.source_url, public.is_valid_prospecting_cnpj(item.cnpj)
      from jsonb_to_recordset(p_matches) as item(
        candidate_id uuid, cnpj text, legal_name text, trade_name text,
        registration_status text, city text, state_code text, primary_cnae text,
        source_updated_at timestamptz, source_url text, structurally_valid boolean
      )
      where item.candidate_id = selected.candidate_id;
    end if;

    update public.prospecting_cnpj_batch_candidates
    set status = attempt_status, attempt_id = attempt_id_value, updated_at = now()
    where batch_id = p_batch_id and candidate_id = selected.candidate_id;
    update public.prospecting_candidates
    set
      cnpj_status = case when cnpj is not null then 'confirmed' else attempt_status end,
      cnpj_last_attempt_at = now(),
      cnpj_source_updated_at = p_source_updated_at,
      updated_at = now()
    where id = selected.candidate_id;
    processed := processed + 1;
  end loop;

  update public.prospecting_cnpj_batches
  set
    status = p_status,
    processed_count = processed,
    bytes_processed = p_bytes_processed,
    source_updated_at = p_source_updated_at,
    updated_at = now()
  where id = p_batch_id;

  return jsonb_build_object(
    'status', p_status,
    'processedCount', processed,
    'totalCount', batch_row.total_count
  );
end;
$$;

create or replace function public.confirm_prospecting_candidate_cnpj(
  p_run_id uuid,
  p_candidate_id uuid,
  p_match_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  match_row public.prospecting_cnpj_matches%rowtype;
  candidate_row public.prospecting_candidates%rowtype;
begin
  if p_actor_id is distinct from auth.uid()
    or not public.prospecting_is_commercial_member(p_actor_id)
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into match_row
  from public.prospecting_cnpj_matches
  where id = p_match_id and run_id = p_run_id and candidate_id = p_candidate_id
  for update;
  if not found or not public.is_valid_prospecting_cnpj(match_row.cnpj) then
    raise exception 'invalid CNPJ match' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.prospecting_cnpj_batches batch
    where batch.id = match_row.batch_id
      and batch.actor_id = p_actor_id
  ) then
    raise exception 'CNPJ match belongs to another member'
      using errcode = '42501';
  end if;
  select * into candidate_row
  from public.prospecting_candidates
  where id = p_candidate_id
  for update;
  if not found then raise exception 'candidate not found' using errcode = '23503'; end if;

  update public.prospecting_cnpj_matches
  set confirmed_at = null, confirmed_by = null
  where candidate_id = p_candidate_id and id <> p_match_id
    and confirmed_at is not null;
  update public.prospecting_cnpj_matches
  set confirmed_at = now(), confirmed_by = p_actor_id
  where id = p_match_id;
  update public.prospecting_candidates
  set
    cnpj = match_row.cnpj,
    cnpj_status = 'confirmed',
    cnpj_confirmed_match_id = p_match_id,
    cnpj_confirmed_at = now(),
    cnpj_confirmed_by = p_actor_id,
    updated_at = now()
  where id = p_candidate_id;
  if candidate_row.imported_lead_id is not null then
    update public.leads
    set cnpj = match_row.cnpj, updated_at = now()
    where id = candidate_row.imported_lead_id;
  end if;
  return jsonb_build_object('status', 'confirmed', 'cnpj', match_row.cnpj);
end;
$$;

create or replace function public.import_prospecting_candidate_with_cnpj(
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
  result jsonb;
  imported_lead_id uuid;
  confirmed_cnpj text;
begin
  result := public.import_prospecting_candidate(
    p_run_id, p_candidate_id, p_actor_id, p_revalidation_status,
    p_live_candidate, p_territory_class, p_category_class
  );
  if result ->> 'outcome' <> 'imported'
    or not public.prospecting_is_commercial_member(p_actor_id)
  then
    return result;
  end if;
  imported_lead_id := nullif(result ->> 'leadId', '')::uuid;
  if imported_lead_id is null then return result; end if;

  select cnpj into confirmed_cnpj
  from public.prospecting_candidates
  where id = p_candidate_id and cnpj_status = 'confirmed'
    and cnpj_confirmed_match_id is not null;
  if confirmed_cnpj is not null
    and public.is_valid_prospecting_cnpj(confirmed_cnpj)
  then
    update public.leads
    set cnpj = confirmed_cnpj, updated_at = now()
    where id = imported_lead_id;
  end if;
  return result;
end;
$$;

revoke all on function public.create_prospecting_cnpj_batch(uuid, uuid[], uuid) from public;
revoke all on function public.claim_prospecting_cnpj_batch(uuid, uuid) from public;
revoke all on function public.mark_prospecting_cnpj_job_started(uuid, uuid) from public;
revoke all on function public.record_prospecting_cnpj_batch(uuid, uuid, text, bigint, timestamptz, jsonb) from public;
revoke all on function public.confirm_prospecting_candidate_cnpj(uuid, uuid, uuid, uuid) from public;
revoke all on function public.import_prospecting_candidate_with_cnpj(uuid, uuid, uuid, text, jsonb, text, text) from public;

grant execute on function public.create_prospecting_cnpj_batch(uuid, uuid[], uuid) to authenticated;
grant execute on function public.claim_prospecting_cnpj_batch(uuid, uuid) to authenticated;
grant execute on function public.mark_prospecting_cnpj_job_started(uuid, uuid) to service_role;
grant execute on function public.record_prospecting_cnpj_batch(uuid, uuid, text, bigint, timestamptz, jsonb) to service_role;
grant execute on function public.confirm_prospecting_candidate_cnpj(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.import_prospecting_candidate_with_cnpj(uuid, uuid, uuid, text, jsonb, text, text) to authenticated;
