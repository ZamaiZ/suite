create table public.prospecting_cnpj_file_imports (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.prospecting_runs(id) on delete cascade,
  actor_id uuid not null references public.users(id) on delete cascade,
  expected_count integer not null,
  staged_count integer not null default 0,
  next_chunk_index integer not null default 0,
  status text not null default 'staging',
  summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  committed_at timestamptz,
  constraint prospecting_cnpj_file_imports_count_check
    check (expected_count >= 0 and staged_count between 0 and expected_count),
  constraint prospecting_cnpj_file_imports_chunk_check
    check (next_chunk_index >= 0),
  constraint prospecting_cnpj_file_imports_status_check
    check (status in ('staging', 'committed', 'aborted')),
  constraint prospecting_cnpj_file_imports_summary_check
    check (summary is null or jsonb_typeof(summary) = 'object'),
  constraint prospecting_cnpj_file_imports_state_check
    check (
      (status = 'committed' and committed_at is not null and summary is not null)
      or (status <> 'committed' and committed_at is null and summary is null)
    ),
  unique (id, run_id, actor_id)
);

create index prospecting_cnpj_file_imports_expiry_idx
  on public.prospecting_cnpj_file_imports(expires_at)
  where status = 'staging';

create table public.prospecting_cnpj_file_import_chunks (
  import_id uuid not null,
  run_id uuid not null,
  actor_id uuid not null,
  chunk_index integer not null,
  row_count integer not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (import_id, chunk_index),
  foreign key (import_id, run_id, actor_id)
    references public.prospecting_cnpj_file_imports(id, run_id, actor_id)
    on delete cascade,
  constraint prospecting_cnpj_file_import_chunks_index_check
    check (chunk_index >= 0),
  constraint prospecting_cnpj_file_import_chunks_count_check
    check (row_count between 1 and 50 and jsonb_typeof(payload) = 'array')
);

create table public.prospecting_cnpj_file_import_rows (
  import_id uuid not null,
  run_id uuid not null,
  actor_id uuid not null,
  candidate_id uuid not null,
  chunk_index integer not null,
  source_row_number integer not null,
  research_status text not null,
  cnpj text,
  legal_name text,
  trade_name text,
  registration_status text,
  matched_city text,
  matched_state_code text,
  primary_cnae text,
  source_url text,
  source_checked_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (import_id, candidate_id),
  foreign key (import_id, run_id, actor_id)
    references public.prospecting_cnpj_file_imports(id, run_id, actor_id)
    on delete cascade,
  foreign key (import_id, chunk_index)
    references public.prospecting_cnpj_file_import_chunks(import_id, chunk_index)
    on delete cascade,
  foreign key (run_id, candidate_id)
    references public.prospecting_run_candidates(run_id, candidate_id)
    on delete cascade,
  constraint prospecting_cnpj_file_import_rows_number_check
    check (source_row_number > 1),
  constraint prospecting_cnpj_file_import_rows_status_check
    check (research_status in ('found', 'not_found', 'ambiguous')),
  constraint prospecting_cnpj_file_import_rows_values_check
    check (
      (
        research_status = 'found'
        and cnpj is not null
        and public.is_valid_prospecting_cnpj(cnpj)
        and source_url is not null
        and source_url ~ '^https://[^/@[:space:]]+([/?#][^[:space:]]*)?$'
        and source_checked_at is not null
      )
      or (
        research_status in ('not_found', 'ambiguous')
        and cnpj is null
        and source_url is null
        and source_checked_at is null
      )
    ),
  constraint prospecting_cnpj_file_import_rows_text_check
    check (
      (legal_name is null or length(legal_name) <= 300)
      and (trade_name is null or length(trade_name) <= 300)
      and (registration_status is null or length(registration_status) <= 80)
      and (matched_city is null or length(matched_city) <= 160)
      and (matched_state_code is null or matched_state_code ~ '^[A-Z]{2}$')
      and (primary_cnae is null or length(primary_cnae) <= 100)
      and (source_url is null or length(source_url) <= 500)
    )
);

create index prospecting_cnpj_file_import_rows_run_idx
  on public.prospecting_cnpj_file_import_rows(import_id, run_id, candidate_id);

alter table public.prospecting_cnpj_file_imports enable row level security;
alter table public.prospecting_cnpj_file_import_chunks enable row level security;
alter table public.prospecting_cnpj_file_import_rows enable row level security;

revoke all on public.prospecting_cnpj_file_imports from anon, authenticated;
revoke all on public.prospecting_cnpj_file_import_chunks from anon, authenticated;
revoke all on public.prospecting_cnpj_file_import_rows from anon, authenticated;

create unique index prospecting_cnpj_matches_ai_research_unique_idx
  on public.prospecting_cnpj_matches(run_id, candidate_id, cnpj)
  where source = 'ai_research';

update public.prospecting_candidates
set cnpj_status = 'not_searched', updated_at = now()
where cnpj is null
  and cnpj_status in ('searching', 'source_limited', 'source_unavailable');

alter table public.prospecting_candidates
  drop constraint prospecting_candidates_cnpj_status_chk;

alter table public.prospecting_candidates
  add constraint prospecting_candidates_cnpj_status_chk
    check (cnpj_status in (
      'not_searched', 'suggestion', 'needs_review', 'confirmed', 'not_found'
    ));

create or replace function public.create_prospecting_cnpj_file_import(
  p_run_id uuid,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_count_value integer;
  import_id_value uuid;
  run_exists boolean;
begin
  if p_actor_id is distinct from auth.uid()
    or not public.prospecting_is_commercial_member(p_actor_id)
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from public.prospecting_cnpj_file_imports
  where (status in ('staging', 'aborted') and expires_at <= now())
    or (status = 'committed' and committed_at < now() - interval '30 days');

  select exists (
    select 1 from public.prospecting_runs where id = p_run_id
  ) into run_exists;
  if not run_exists then
    raise exception 'prospecting run is not available' using errcode = '23503';
  end if;

  select count(*)::integer into expected_count_value
  from public.prospecting_run_candidates
  where run_id = p_run_id;

  insert into public.prospecting_cnpj_file_imports (
    run_id, actor_id, expected_count
  ) values (
    p_run_id, p_actor_id, expected_count_value
  ) returning id into import_id_value;

  return import_id_value;
end;
$$;

create or replace function public.stage_prospecting_cnpj_file_chunk(
  p_import_id uuid,
  p_run_id uuid,
  p_actor_id uuid,
  p_chunk_index integer,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  import_row public.prospecting_cnpj_file_imports%rowtype;
  row_count_value integer;
  chunk_row public.prospecting_cnpj_file_import_chunks%rowtype;
begin
  if p_actor_id is distinct from auth.uid()
    or not public.prospecting_is_commercial_member(p_actor_id)
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_chunk_index is null or p_chunk_index < 0
    or p_rows is null or jsonb_typeof(p_rows) <> 'array'
  then
    raise exception 'invalid CNPJ import chunk' using errcode = '22023';
  end if;
  row_count_value := jsonb_array_length(p_rows);
  if row_count_value not between 1 and 50 then
    raise exception 'CNPJ import chunks must contain 1 to 50 rows'
      using errcode = '22023';
  end if;

  delete from public.prospecting_cnpj_file_imports
  where status in ('staging', 'aborted') and expires_at <= now();

  select * into import_row
  from public.prospecting_cnpj_file_imports
  where id = p_import_id and run_id = p_run_id and actor_id = p_actor_id
  for update;
  if not found or import_row.status <> 'staging' then
    raise exception 'CNPJ import is not active' using errcode = '22023';
  end if;
  if import_row.expires_at <= now() then
    raise exception 'CNPJ import expired; start again' using errcode = '22023';
  end if;

  if p_chunk_index < import_row.next_chunk_index then
    select * into chunk_row
    from public.prospecting_cnpj_file_import_chunks
    where import_id = p_import_id and chunk_index = p_chunk_index;
    if found and chunk_row.payload = p_rows then
      return jsonb_build_object(
        'status', 'staged',
        'stagedCount', import_row.staged_count,
        'expectedCount', import_row.expected_count
      );
    end if;
    raise exception 'CNPJ import chunk retry does not match the stored payload'
      using errcode = '22023';
  end if;
  if p_chunk_index <> import_row.next_chunk_index
    or import_row.staged_count + row_count_value > import_row.expected_count
  then
    raise exception 'CNPJ import chunks are out of sequence or exceed the run size'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as item(
      run_id uuid, candidate_id uuid, research_status text, cnpj text,
      legal_name text, trade_name text, registration_status text,
      matched_city text, matched_state_code text, primary_cnae text,
      source_url text, source_checked_at timestamptz, source_row_number integer
    )
    where item.run_id is distinct from p_run_id
      or item.candidate_id is null
      or item.source_row_number <= 1
      or item.research_status not in ('found', 'not_found', 'ambiguous')
      or (
        item.research_status = 'found'
        and (
          not public.is_valid_prospecting_cnpj(item.cnpj)
          or item.source_url is null
          or item.source_url !~ '^https://[^/@[:space:]]+([/?#][^[:space:]]*)?$'
          or item.source_checked_at is null
        )
      )
      or (
        item.research_status in ('not_found', 'ambiguous')
        and (item.cnpj is not null or item.source_url is not null or item.source_checked_at is not null)
      )
      or length(coalesce(item.legal_name, '')) > 300
      or length(coalesce(item.trade_name, '')) > 300
      or length(coalesce(item.registration_status, '')) > 80
      or length(coalesce(item.matched_city, '')) > 160
      or (item.matched_state_code is not null and item.matched_state_code !~ '^[A-Z]{2}$')
      or length(coalesce(item.primary_cnae, '')) > 100
      or length(coalesce(item.source_url, '')) > 500
  ) then
    raise exception 'CNPJ import chunk contains invalid rows' using errcode = '22023';
  end if;
  if exists (
    select item.candidate_id
    from jsonb_to_recordset(p_rows) as item(
      candidate_id uuid
    )
    group by item.candidate_id
    having count(*) > 1
  ) then
    raise exception 'CNPJ import chunk contains duplicate candidates'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as item(
      run_id uuid, candidate_id uuid, company_name text, primary_category text,
      address text, phone text, website text, website_domain text, city text,
      state_code text, existing_cnpj text
    )
    left join public.prospecting_run_candidates relation
      on relation.run_id = p_run_id and relation.candidate_id = item.candidate_id
    left join public.prospecting_candidates candidate
      on candidate.id = relation.candidate_id
    left join public.prospecting_runs run
      on run.id = relation.run_id
    where relation.candidate_id is null
      or item.run_id is distinct from p_run_id
      or item.company_name is distinct from coalesce(candidate.company_name, '')
      or item.primary_category is distinct from coalesce(candidate.primary_category, '')
      or item.address is distinct from coalesce(candidate.address, '')
      or item.phone is distinct from coalesce(candidate.phone, '')
      or item.website is distinct from coalesce(candidate.website, '')
      or item.website_domain is distinct from coalesce(candidate.website_domain, '')
      or item.city is distinct from run.city
      or item.state_code is distinct from run.state_code
      or (
        candidate.cnpj is null
        and item.existing_cnpj is distinct from ''
      )
  ) then
    raise exception 'CNPJ import chunk contains changed context or a candidate outside the run'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_rows) as item(candidate_id uuid)
    join public.prospecting_cnpj_file_import_rows stored
      on stored.import_id = p_import_id and stored.candidate_id = item.candidate_id
  ) then
    raise exception 'CNPJ import contains a candidate more than once'
      using errcode = '22023';
  end if;

  insert into public.prospecting_cnpj_file_import_chunks (
    import_id, run_id, actor_id, chunk_index, row_count, payload
  ) values (
    p_import_id, p_run_id, p_actor_id, p_chunk_index, row_count_value, p_rows
  );

  insert into public.prospecting_cnpj_file_import_rows (
    import_id, run_id, actor_id, candidate_id, chunk_index,
    source_row_number, research_status, cnpj, legal_name, trade_name,
    registration_status, matched_city, matched_state_code, primary_cnae,
    source_url, source_checked_at
  )
  select
    p_import_id, p_run_id, p_actor_id, item.candidate_id, p_chunk_index,
    item.source_row_number, item.research_status, item.cnpj, item.legal_name,
    item.trade_name, item.registration_status, item.matched_city,
    item.matched_state_code, item.primary_cnae, item.source_url,
    item.source_checked_at
  from jsonb_to_recordset(p_rows) as item(
    candidate_id uuid, source_row_number integer, research_status text,
    cnpj text, legal_name text, trade_name text, registration_status text,
    matched_city text, matched_state_code text, primary_cnae text,
    source_url text, source_checked_at timestamptz
  );

  update public.prospecting_cnpj_file_imports
  set staged_count = staged_count + row_count_value,
      next_chunk_index = next_chunk_index + 1,
      expires_at = now() + interval '24 hours',
      updated_at = now()
  where id = p_import_id;

  return jsonb_build_object(
    'status', 'staged',
    'stagedCount', import_row.staged_count + row_count_value,
    'expectedCount', import_row.expected_count
  );
end;
$$;

create or replace function public.commit_prospecting_cnpj_file_import(
  p_import_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  import_row public.prospecting_cnpj_file_imports%rowtype;
  summary_value jsonb;
  run_candidate_count integer;
begin
  if p_actor_id is distinct from auth.uid()
    or not public.prospecting_is_commercial_member(p_actor_id)
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into import_row
  from public.prospecting_cnpj_file_imports
  where id = p_import_id and actor_id = p_actor_id
  for update;
  if not found then
    raise exception 'CNPJ import not found' using errcode = '23503';
  end if;
  if import_row.status = 'committed' then
    return import_row.summary;
  end if;
  if import_row.status <> 'staging' or import_row.expires_at <= now() then
    raise exception 'CNPJ import is not active' using errcode = '22023';
  end if;

  perform run.id
  from public.prospecting_runs run
  where run.id = import_row.run_id
  for update;
  if not found then
    raise exception 'prospecting run is not available' using errcode = '23503';
  end if;

  select count(*)::integer into run_candidate_count
  from public.prospecting_run_candidates
  where run_id = import_row.run_id;
  if import_row.expected_count <> run_candidate_count
    or import_row.staged_count <> import_row.expected_count
    or (select count(*)::integer
        from public.prospecting_cnpj_file_import_rows
        where import_id = p_import_id) <> import_row.expected_count
    or exists (
      select 1
      from public.prospecting_run_candidates relation
      left join public.prospecting_cnpj_file_import_rows staged
        on staged.import_id = p_import_id
        and staged.run_id = relation.run_id
        and staged.candidate_id = relation.candidate_id
      where relation.run_id = import_row.run_id
        and staged.candidate_id is null
    )
    or exists (
      select 1
      from public.prospecting_cnpj_file_import_rows staged
      left join public.prospecting_run_candidates relation
        on relation.run_id = staged.run_id
        and relation.candidate_id = staged.candidate_id
      where staged.import_id = p_import_id
        and relation.candidate_id is null
    )
  then
    raise exception 'CSV is incomplete or the prospecting run changed; download a new file'
      using errcode = '22023';
  end if;

  perform candidate.id
  from public.prospecting_candidates candidate
  join public.prospecting_cnpj_file_import_rows staged
    on staged.candidate_id = candidate.id
  where staged.import_id = p_import_id
  order by candidate.id
  for update;

  if exists (
    select 1
    from public.prospecting_cnpj_file_import_chunks chunk
    cross join lateral jsonb_to_recordset(chunk.payload) as item(
      candidate_id uuid, company_name text, primary_category text,
      address text, phone text, website text, website_domain text,
      city text, state_code text
    )
    join public.prospecting_candidates candidate
      on candidate.id = item.candidate_id
    join public.prospecting_runs run
      on run.id = chunk.run_id
    where chunk.import_id = p_import_id
      and (
        item.company_name is distinct from coalesce(candidate.company_name, '')
        or item.primary_category is distinct from coalesce(candidate.primary_category, '')
        or item.address is distinct from coalesce(candidate.address, '')
        or item.phone is distinct from coalesce(candidate.phone, '')
        or item.website is distinct from coalesce(candidate.website, '')
        or item.website_domain is distinct from coalesce(candidate.website_domain, '')
        or item.city is distinct from run.city
        or item.state_code is distinct from run.state_code
      )
  ) then
    raise exception 'candidate context changed after staging; download a new file'
      using errcode = '22023';
  end if;

  create temporary table prospecting_cnpj_file_work
  on commit drop
  as
  select
    staged.*,
    candidate.cnpj as existing_cnpj_value,
    ((row_number() over (order by staged.source_row_number) - 1) / 50)::integer as batch_group,
    gen_random_uuid() as attempt_id
  from public.prospecting_cnpj_file_import_rows staged
  join public.prospecting_candidates candidate on candidate.id = staged.candidate_id
  where staged.import_id = p_import_id
    and candidate.cnpj is null;

  alter table pg_temp.prospecting_cnpj_file_work add column batch_id uuid;

  create temporary table prospecting_cnpj_file_batch_work
  on commit drop
  as
  select groups.batch_group, gen_random_uuid() as batch_id
  from (
    select distinct batch_group
    from pg_temp.prospecting_cnpj_file_work
  ) groups;

  update pg_temp.prospecting_cnpj_file_work work
  set batch_id = groups.batch_id
  from pg_temp.prospecting_cnpj_file_batch_work groups
  where groups.batch_group = work.batch_group;

  insert into public.prospecting_cnpj_batches (
    id, run_id, actor_id, status, provider_job_id,
    processed_count, total_count, created_at, updated_at
  )
  select
    groups.batch_id,
    import_row.run_id,
    p_actor_id,
    'completed',
    'manual_cnpj_' || replace(groups.batch_id::text, '-', ''),
    count(*)::integer,
    count(*)::integer,
    now(),
    now()
  from pg_temp.prospecting_cnpj_file_batch_work groups
  join pg_temp.prospecting_cnpj_file_work work
    on work.batch_group = groups.batch_group
  group by groups.batch_id, groups.batch_group;

  insert into public.prospecting_cnpj_batch_candidates (
    batch_id, run_id, actor_id, candidate_id, position, status,
    attempt_id, updated_at
  )
  select
    work.batch_id,
    work.run_id,
    p_actor_id,
    work.candidate_id,
    (row_number() over (partition by work.batch_group order by work.source_row_number))::integer,
    case work.research_status
      when 'found' then 'suggestion'
      when 'ambiguous' then 'needs_review'
      else 'not_found'
    end,
    work.attempt_id,
    now()
  from pg_temp.prospecting_cnpj_file_work work;

  insert into public.prospecting_cnpj_attempts (
    id, batch_id, run_id, candidate_id, provider, status, source_updated_at
  )
  select
    work.attempt_id,
    work.batch_id,
    work.run_id,
    work.candidate_id,
    'ai_research',
    case work.research_status
      when 'found' then 'suggestion'
      when 'ambiguous' then 'needs_review'
      else 'not_found'
    end,
    work.source_checked_at
  from pg_temp.prospecting_cnpj_file_work work;

  insert into public.prospecting_cnpj_matches (
    attempt_id, batch_id, run_id, candidate_id, cnpj, legal_name,
    trade_name, registration_status, city, state_code, primary_cnae,
    source, source_updated_at, source_url, structurally_valid
  )
  select
    work.attempt_id,
    work.batch_id,
    work.run_id,
    work.candidate_id,
    work.cnpj,
    work.legal_name,
    work.trade_name,
    work.registration_status,
    work.matched_city,
    work.matched_state_code,
    work.primary_cnae,
    'ai_research',
    work.source_checked_at,
    work.source_url,
    true
  from pg_temp.prospecting_cnpj_file_work work
  where work.research_status = 'found'
  on conflict (run_id, candidate_id, cnpj) where source = 'ai_research'
  do nothing;

  update public.prospecting_candidates candidate
  set cnpj_status = case
        when work.research_status = 'found' then 'suggestion'
        when exists (
          select 1
          from public.prospecting_cnpj_matches match
          where match.candidate_id = candidate.id
            and match.structurally_valid
            and match.confirmed_at is null
        ) then 'needs_review'
        when work.research_status = 'ambiguous' then 'needs_review'
        else 'not_found'
      end,
      cnpj_last_attempt_at = now(),
      cnpj_source_updated_at = work.source_checked_at,
      updated_at = now()
  from pg_temp.prospecting_cnpj_file_work work
  where candidate.id = work.candidate_id
    and candidate.cnpj is null;

  select jsonb_build_object(
    'runId', import_row.run_id,
    'suggestions', count(*) filter (where research_status = 'found'),
    'notFound', count(*) filter (where research_status = 'not_found'),
    'ambiguous', count(*) filter (where research_status = 'ambiguous'),
    'skipped', import_row.expected_count - count(*)
  ) into summary_value
  from public.prospecting_cnpj_file_import_rows staged
  join public.prospecting_candidates candidate on candidate.id = staged.candidate_id
  where staged.import_id = p_import_id
    and candidate.cnpj is null;

  if summary_value is null then
    summary_value := jsonb_build_object(
      'runId', import_row.run_id,
      'suggestions', 0,
      'notFound', 0,
      'ambiguous', 0,
      'skipped', import_row.expected_count
    );
  else
    summary_value := jsonb_set(
      summary_value,
      '{skipped}',
      to_jsonb(import_row.expected_count - (
        select count(*)::integer
        from public.prospecting_cnpj_file_import_rows staged
        join public.prospecting_candidates candidate on candidate.id = staged.candidate_id
        where staged.import_id = p_import_id and candidate.cnpj is null
      ))
    );
  end if;

  update public.prospecting_cnpj_file_imports
  set status = 'committed',
      summary = summary_value,
      committed_at = now(),
      updated_at = now()
  where id = p_import_id;
  delete from public.prospecting_cnpj_file_import_rows where import_id = p_import_id;
  delete from public.prospecting_cnpj_file_import_chunks where import_id = p_import_id;

  return summary_value;
end;
$$;

create or replace function public.abort_prospecting_cnpj_file_import(
  p_import_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  import_row public.prospecting_cnpj_file_imports%rowtype;
begin
  if p_actor_id is distinct from auth.uid()
    or not public.prospecting_is_commercial_member(p_actor_id)
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into import_row
  from public.prospecting_cnpj_file_imports
  where id = p_import_id and actor_id = p_actor_id
  for update;
  if not found then return; end if;
  if import_row.status = 'committed' then
    raise exception 'committed CNPJ import cannot be aborted' using errcode = '22023';
  end if;

  delete from public.prospecting_cnpj_file_imports where id = p_import_id;
end;
$$;

drop policy prospecting_cnpj_matches_select_owner
  on public.prospecting_cnpj_matches;
create policy prospecting_cnpj_matches_select_commercial
  on public.prospecting_cnpj_matches for select to authenticated
  using (
    public.prospecting_is_commercial_member(auth.uid())
    and exists (
      select 1 from public.prospecting_run_candidates relation
      where relation.run_id = prospecting_cnpj_matches.run_id
        and relation.candidate_id = prospecting_cnpj_matches.candidate_id
    )
  );

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
    select 1 from public.prospecting_run_candidates relation
    where relation.run_id = p_run_id and relation.candidate_id = p_candidate_id
  ) then
    raise exception 'CNPJ match is outside the prospecting run'
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
  set cnpj = match_row.cnpj,
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

drop function if exists public.create_prospecting_cnpj_batch(uuid, uuid[], uuid);
drop function if exists public.claim_prospecting_cnpj_batch(uuid, uuid);
drop function if exists public.mark_prospecting_cnpj_job_started(uuid, uuid);
drop function if exists public.record_prospecting_cnpj_batch(uuid, uuid, text, bigint, timestamptz, jsonb);

revoke all on function public.create_prospecting_cnpj_file_import(uuid, uuid) from public;
revoke all on function public.stage_prospecting_cnpj_file_chunk(uuid, uuid, uuid, integer, jsonb) from public;
revoke all on function public.commit_prospecting_cnpj_file_import(uuid, uuid) from public;
revoke all on function public.abort_prospecting_cnpj_file_import(uuid, uuid) from public;

grant execute on function public.create_prospecting_cnpj_file_import(uuid, uuid) to authenticated;
grant execute on function public.stage_prospecting_cnpj_file_chunk(uuid, uuid, uuid, integer, jsonb) to authenticated;
grant execute on function public.commit_prospecting_cnpj_file_import(uuid, uuid) to authenticated;
grant execute on function public.abort_prospecting_cnpj_file_import(uuid, uuid) to authenticated;
