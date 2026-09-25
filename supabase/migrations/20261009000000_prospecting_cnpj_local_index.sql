alter table public.prospecting_cnpj_file_imports
  add column source text not null default 'ai_research'
    check (source in ('ai_research', 'receita_local_index')),
  add column dataset_version text
    check (dataset_version is null or dataset_version ~ '^D[0-9]{5}$');

alter table public.prospecting_cnpj_matches
  add column dataset_version text
    check (dataset_version is null or dataset_version ~ '^D[0-9]{5}$');

drop index if exists public.prospecting_cnpj_matches_ai_research_unique_idx;
create unique index prospecting_cnpj_matches_research_unique_idx
  on public.prospecting_cnpj_matches(run_id, candidate_id, cnpj)
  where source in ('ai_research', 'receita_local_index');

create or replace function public.create_prospecting_cnpj_local_index_import(
  p_run_id uuid,
  p_actor_id uuid,
  p_dataset_version text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  import_id_value uuid;
begin
  if p_dataset_version is null or p_dataset_version !~ '^D[0-9]{5}$' then
    raise exception 'invalid Receita dataset version' using errcode = '22023';
  end if;
  import_id_value := public.create_prospecting_cnpj_file_import(p_run_id, p_actor_id);
  update public.prospecting_cnpj_file_imports
  set source = 'receita_local_index', dataset_version = p_dataset_version
  where id = import_id_value and actor_id = p_actor_id and status = 'staging';
  if not found then
    raise exception 'CNPJ import is not active' using errcode = '22023';
  end if;
  return import_id_value;
end;
$$;

revoke all on function public.create_prospecting_cnpj_local_index_import(uuid, uuid, text) from public;
grant execute on function public.create_prospecting_cnpj_local_index_import(uuid, uuid, text) to authenticated;


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
    import_row.source,
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
    source, dataset_version, source_updated_at, source_url, structurally_valid
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
    import_row.source,
    import_row.dataset_version,
    work.source_checked_at,
    work.source_url,
    true
  from pg_temp.prospecting_cnpj_file_work work
  where work.research_status = 'found'
  on conflict (run_id, candidate_id, cnpj) where source in ('ai_research', 'receita_local_index')
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
