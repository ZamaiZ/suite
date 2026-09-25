alter table public.prospecting_cnpj_file_imports
  add column local_execution_id uuid;

create unique index prospecting_cnpj_file_imports_local_execution_idx
  on public.prospecting_cnpj_file_imports(local_execution_id)
  where local_execution_id is not null;

create or replace function public.create_prospecting_cnpj_local_scan_import(
  p_run_id uuid,
  p_actor_id uuid,
  p_dataset_version text,
  p_execution_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  import_id_value uuid;
begin
  if p_actor_id is distinct from auth.uid()
    or not public.prospecting_is_commercial_member(p_actor_id)
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_dataset_version is null or p_dataset_version !~ '^D[0-9]{5}$'
    or p_execution_id is null
  then
    raise exception 'invalid local CNPJ scan metadata' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_execution_id::text, 0));
  select item.id into import_id_value
  from public.prospecting_cnpj_file_imports item
  where item.local_execution_id = p_execution_id
    and item.run_id = p_run_id
    and item.actor_id = p_actor_id
    and item.source = 'receita_local_index'
  for update;
  if found then return import_id_value; end if;

  begin
    import_id_value := public.create_prospecting_cnpj_local_index_import(p_run_id, p_actor_id, p_dataset_version);
    update public.prospecting_cnpj_file_imports
    set local_execution_id = p_execution_id
    where id = import_id_value and run_id = p_run_id and actor_id = p_actor_id and source = 'receita_local_index';
    if not found then raise exception 'local CNPJ import is not active' using errcode = '22023'; end if;
    return import_id_value;
  exception when unique_violation then
    select item.id into import_id_value
    from public.prospecting_cnpj_file_imports item
    where item.local_execution_id = p_execution_id
      and item.run_id = p_run_id
      and item.actor_id = p_actor_id
      and item.source = 'receita_local_index'
    for update;
    if found then return import_id_value; end if;
    raise;
  end;
end;
$$;

revoke all on function public.create_prospecting_cnpj_local_scan_import(uuid, uuid, text, uuid) from public;
grant execute on function public.create_prospecting_cnpj_local_scan_import(uuid, uuid, text, uuid) to authenticated;

create or replace function public.get_prospecting_cnpj_local_scan_import_state(
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
begin
  if p_actor_id is distinct from auth.uid()
    or not public.prospecting_is_commercial_member(p_actor_id)
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into import_row
  from public.prospecting_cnpj_file_imports item
  where item.id = p_import_id
    and item.actor_id = p_actor_id
    and item.source = 'receita_local_index';
  if not found then raise exception 'local CNPJ import not found' using errcode = '23503'; end if;
  return jsonb_build_object(
    'status', import_row.status,
    'runId', import_row.run_id,
    'datasetVersion', import_row.dataset_version,
    'localExecutionId', import_row.local_execution_id,
    'summary', import_row.summary
  );
end;
$$;

revoke all on function public.get_prospecting_cnpj_local_scan_import_state(uuid, uuid) from public;
grant execute on function public.get_prospecting_cnpj_local_scan_import_state(uuid, uuid) to authenticated;

create or replace function public.preview_prospecting_cnpj_local_cleanup(
  p_run_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_value jsonb;
begin
  if p_actor_id is distinct from auth.uid()
    or not public.prospecting_is_commercial_member(p_actor_id)
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.prospecting_runs run where run.id = p_run_id) then
    raise exception 'prospecting run is not available' using errcode = '23503';
  end if;

  select jsonb_build_object(
    'imports', (select count(*)::integer from public.prospecting_cnpj_file_imports item where item.run_id = p_run_id and item.source = 'receita_local_index'),
    'batches', (
      select count(*)::integer
      from public.prospecting_cnpj_batches batch
      where batch.run_id = p_run_id
        and exists (
          select 1 from public.prospecting_cnpj_attempts attempt
          where attempt.batch_id = batch.id and attempt.provider = 'receita_local_index'
        )
        and not exists (
          select 1 from public.prospecting_cnpj_attempts attempt
          where attempt.batch_id = batch.id and attempt.provider <> 'receita_local_index'
        )
    ),
    'attempts', (select count(*)::integer from public.prospecting_cnpj_attempts attempt where attempt.run_id = p_run_id and attempt.provider = 'receita_local_index'),
    'matches', (select count(*)::integer from public.prospecting_cnpj_matches item where item.run_id = p_run_id and item.source = 'receita_local_index'),
    'confirmedMatches', (select count(*)::integer from public.prospecting_cnpj_matches item join public.prospecting_candidates candidate on candidate.id = item.candidate_id where item.run_id = p_run_id and item.source = 'receita_local_index' and candidate.cnpj_confirmed_match_id = item.id)
  ) into result_value;
  return result_value;
end;
$$;

revoke all on function public.preview_prospecting_cnpj_local_cleanup(uuid, uuid) from public;
grant execute on function public.preview_prospecting_cnpj_local_cleanup(uuid, uuid) to authenticated;

create or replace function public.delete_prospecting_cnpj_local_results(
  p_run_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_imports integer := 0;
  deleted_batches integer := 0;
  deleted_attempts integer := 0;
  deleted_matches integer := 0;
  reset_candidates integer := 0;
  updated_candidates integer := 0;
  result_value jsonb;
begin
  if p_actor_id is distinct from auth.uid()
    or not public.prospecting_is_commercial_member(p_actor_id)
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform run.id
  from public.prospecting_runs run
  where run.id = p_run_id
  for update;
  if not found then raise exception 'prospecting run is not available' using errcode = '23503'; end if;

  if exists (
    select 1 from public.prospecting_cnpj_file_imports item
    where item.run_id = p_run_id and item.source = 'receita_local_index' and item.status = 'staging'
  ) then
    raise exception 'local CNPJ import is still staging' using errcode = '55000';
  end if;

  create temporary table local_cnpj_cleanup_matches on commit drop as
    select item.id, item.candidate_id
    from public.prospecting_cnpj_matches item
    where item.run_id = p_run_id and item.source = 'receita_local_index';
  create unique index on local_cnpj_cleanup_matches(id);
  create temporary table local_cnpj_cleanup_candidates on commit drop as
    select distinct attempt.candidate_id
    from public.prospecting_cnpj_attempts attempt
    where attempt.run_id = p_run_id and attempt.provider = 'receita_local_index'
    union
    select distinct item.candidate_id from local_cnpj_cleanup_matches item;
  create unique index on local_cnpj_cleanup_candidates(candidate_id);
  create temporary table local_cnpj_cleanup_batches on commit drop as
    select batch.id
    from public.prospecting_cnpj_batches batch
    where batch.run_id = p_run_id
      and exists (
        select 1 from public.prospecting_cnpj_attempts attempt
        where attempt.batch_id = batch.id and attempt.provider = 'receita_local_index'
      )
      and not exists (
        select 1 from public.prospecting_cnpj_attempts attempt
        where attempt.batch_id = batch.id and attempt.provider <> 'receita_local_index'
      );
  create unique index on local_cnpj_cleanup_batches(id);

  select count(distinct candidate.id)::integer into reset_candidates
  from public.prospecting_candidates candidate
  where candidate.cnpj_confirmed_match_id in (select item.id from local_cnpj_cleanup_matches item);

  update public.prospecting_candidates candidate
  set cnpj = case when candidate.cnpj_confirmed_match_id in (select item.id from local_cnpj_cleanup_matches item) then null else candidate.cnpj end,
      cnpj_confirmed_match_id = case when candidate.cnpj_confirmed_match_id in (select item.id from local_cnpj_cleanup_matches item) then null else candidate.cnpj_confirmed_match_id end,
      cnpj_confirmed_at = case when candidate.cnpj_confirmed_match_id in (select item.id from local_cnpj_cleanup_matches item) then null else candidate.cnpj_confirmed_at end,
      cnpj_confirmed_by = case when candidate.cnpj_confirmed_match_id in (select item.id from local_cnpj_cleanup_matches item) then null else candidate.cnpj_confirmed_by end,
      cnpj_status = case
        when exists (
          select 1 from public.prospecting_cnpj_attempts attempt
          where attempt.run_id = p_run_id and attempt.candidate_id = candidate.id
            and attempt.provider <> 'receita_local_index' and attempt.status = 'needs_review'
        ) then 'needs_review'
        when exists (
          select 1 from public.prospecting_cnpj_matches item
          where item.run_id = p_run_id and item.candidate_id = candidate.id
            and item.source <> 'receita_local_index' and item.structurally_valid and item.confirmed_at is null
        ) then 'suggestion'
        when exists (
          select 1 from public.prospecting_cnpj_attempts attempt
          where attempt.run_id = p_run_id and attempt.candidate_id = candidate.id
            and attempt.provider <> 'receita_local_index' and attempt.status in ('suggestion', 'needs_review')
        ) then 'needs_review'
        when exists (
          select 1 from public.prospecting_cnpj_attempts attempt
          where attempt.run_id = p_run_id and attempt.candidate_id = candidate.id and attempt.provider <> 'receita_local_index'
        ) then (
          select case attempt.status when 'source_limited' then 'source_limited' when 'source_unavailable' then 'source_unavailable' else 'not_found' end
          from public.prospecting_cnpj_attempts attempt
          where attempt.run_id = p_run_id and attempt.candidate_id = candidate.id and attempt.provider <> 'receita_local_index'
          order by attempt.created_at desc limit 1
        )
        else 'not_searched'
      end,
      cnpj_last_attempt_at = (
        select max(attempt.created_at) from public.prospecting_cnpj_attempts attempt
        where attempt.run_id = p_run_id and attempt.candidate_id = candidate.id and attempt.provider <> 'receita_local_index'
      ),
      cnpj_source_updated_at = (
        select max(attempt.source_updated_at) from public.prospecting_cnpj_attempts attempt
        where attempt.run_id = p_run_id and attempt.candidate_id = candidate.id and attempt.provider <> 'receita_local_index'
      ),
      updated_at = now()
  where candidate.id in (select item.candidate_id from local_cnpj_cleanup_candidates item)
    and (candidate.cnpj is null or candidate.cnpj_confirmed_match_id in (select item.id from local_cnpj_cleanup_matches item));
  get diagnostics updated_candidates = row_count;

  delete from public.prospecting_cnpj_matches item
  where item.id in (select local.id from local_cnpj_cleanup_matches local);
  get diagnostics deleted_matches = row_count;

  delete from public.prospecting_cnpj_batch_candidates relation
  where relation.run_id = p_run_id
    and relation.batch_id in (select local.id from local_cnpj_cleanup_batches local);

  delete from public.prospecting_cnpj_batch_candidates relation
  where relation.run_id = p_run_id
    and relation.attempt_id in (
      select attempt.id from public.prospecting_cnpj_attempts attempt
      where attempt.run_id = p_run_id and attempt.provider = 'receita_local_index'
    );

  delete from public.prospecting_cnpj_attempts attempt
  where attempt.run_id = p_run_id and attempt.provider = 'receita_local_index';
  get diagnostics deleted_attempts = row_count;

  delete from public.prospecting_cnpj_batches batch
  where batch.run_id = p_run_id
    and batch.id in (select local.id from local_cnpj_cleanup_batches local)
    and not exists (select 1 from public.prospecting_cnpj_attempts attempt where attempt.batch_id = batch.id)
    and not exists (select 1 from public.prospecting_cnpj_batch_candidates relation where relation.batch_id = batch.id);
  get diagnostics deleted_batches = row_count;

  delete from public.prospecting_cnpj_file_imports item
  where item.run_id = p_run_id and item.source = 'receita_local_index';
  get diagnostics deleted_imports = row_count;

  select jsonb_build_object(
    'imports', deleted_imports,
    'batches', deleted_batches,
    'attempts', deleted_attempts,
    'matches', deleted_matches,
    'confirmedMatches', reset_candidates,
    'deletedImports', deleted_imports,
    'deletedBatches', deleted_batches,
    'deletedAttempts', deleted_attempts,
    'deletedMatches', deleted_matches,
    'resetCandidates', reset_candidates
  ) into result_value;
  return result_value;
end;
$$;

revoke all on function public.delete_prospecting_cnpj_local_results(uuid, uuid) from public;
grant execute on function public.delete_prospecting_cnpj_local_results(uuid, uuid) to authenticated;
