-- Página `claimed` com reserva vencida não é "nada aconteceu": a chamada paga
-- pode ter saído e a resposta se perdido junto com a requisição. Reivindicar o
-- mesmo cursor pagava de novo, e a primeira cobrança nunca entrava em
-- actual_cost_usd. Agora o cursor abandonado vira custo desconhecido e encerra
-- a pesquisa, igual ao envelope desconhecido, devolvendo a decisão a uma pessoa.

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

  -- Só sobra um estado possível aqui: `claimed` com reserva vencida. A linha
  -- existir significa que uma chamada foi reservada e nunca prestou contas.
  -- Não dá para distinguir "morreu antes de chamar o fornecedor" de "chamou,
  -- foi cobrado e perdeu a resposta", então o cursor não é refeito: vira custo
  -- desconhecido e a pesquisa termina para uma pessoa decidir.
  if found then
    update public.prospecting_run_pages
    set
      status = 'unknown',
      cost_usd = null,
      lease_owner = null,
      lease_expires_at = null,
      error_message = 'A reserva venceu antes do recibo; o custo desta página é desconhecido.',
      completed_at = now(),
      updated_at = now()
    where id = page_row.id;

    update public.prospecting_runs
    set
      status = 'failed',
      pause_reason = null,
      lease_owner = null,
      lease_expires_at = null,
      error_message = 'Uma página ficou sem recibo e o custo dela é desconhecido.',
      finished_at = coalesce(finished_at, now()),
      updated_at = now()
    where id = p_run_id;

    return jsonb_build_object(
      'outcome', 'unknown',
      'pageId', page_row.id
    );
  end if;

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

  -- O custo entra sempre que o envelope foi lido, inclusive quando a resposta
  -- chegou depois de a pessoa já ter cancelado: o fornecedor cobrou do mesmo
  -- jeito. O que não pode é a falha reescrever um estado terminal escolhido por
  -- ela — cancelada continua cancelada, e o recibo tardio só soma o gasto.
  update public.prospecting_runs
  set
    status = case
      when status in ('cancelled', 'completed') then status
      else 'failed'
    end,
    pause_reason = null,
    actual_cost_usd = actual_cost_usd
      + case when p_known_envelope then greatest(coalesce(p_cost_usd, 0), 0) else 0 end,
    lease_owner = null,
    lease_expires_at = null,
    error_message = left(nullif(btrim(p_error_message), ''), 500),
    finished_at = coalesce(finished_at, now()),
    updated_at = now()
  where id = page_row.run_id;

  return jsonb_build_object('outcome', next_status);
end;
$$;

revoke all on function public.claim_prospecting_page(
  uuid, uuid, integer
) from public;

grant execute on function public.claim_prospecting_page(
  uuid, uuid, integer
) to authenticated;

revoke all on function public.fail_prospecting_page(
  uuid, uuid, boolean, numeric, text
) from public;

grant execute on function public.fail_prospecting_page(
  uuid, uuid, boolean, numeric, text
) to authenticated;
