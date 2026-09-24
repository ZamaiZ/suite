-- O ambiente usa proteção contra DELETE sem WHERE. category_name é a chave
-- primária e nunca é nula, então a condição mantém a substituição integral do
-- catálogo sem desabilitar a proteção da sessão.
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

revoke all on function public.replace_prospecting_category_catalog(
  uuid, timestamptz, jsonb
) from public;

grant execute on function public.replace_prospecting_category_catalog(
  uuid, timestamptz, jsonb
) to authenticated;
