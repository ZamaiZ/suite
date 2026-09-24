-- Pausa/cancelamento precisam funcionar mesmo com uma chamada do fornecedor
-- em voo. A resposta tardia não conclui a página porque complete_prospecting_page
-- exige que a run ainda esteja collecting.
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

revoke all on function public.command_prospecting_run(
  uuid, uuid, text, text
) from public;

grant execute on function public.command_prospecting_run(
  uuid, uuid, text, text
) to authenticated;
