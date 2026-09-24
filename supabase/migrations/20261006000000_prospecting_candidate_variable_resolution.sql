-- Disambiguate PL/pgSQL counters from same-named receipt columns. Replaces the RPC body without changing its signature or privileges.
-- Isola somente violações de dados conhecidas por candidato. Falhas de schema,
-- autorização e infraestrutura continuam revertendo a conclusão inteira.
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
  v_normalized_count integer := 0;
  accepted_delta integer := 0;
  ambiguous_delta integer := 0;
  duplicate_delta integer := 0;
  v_received_count integer;
  rejected_count_value integer;
  failed_constraint text;
  next_status text := 'collecting';
begin
  if p_actor_id is distinct from auth.uid()
    or not public.prospecting_is_commercial_member(p_actor_id)
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array'
    or p_rejected_count is null
    or p_rejected_count < 0
    or p_cost_usd is null
    or p_cost_usd < 0
    or (p_total_count is not null and p_total_count < 0)
    or (p_next_offset is not null and p_next_offset < 0)
  then
    raise exception 'invalid page receipt' using errcode = '22023';
  end if;

  rejected_count_value := p_rejected_count;

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
      or item.discovery_position is null
      or item.discovery_position < 0
      or item.territory_class is null
      or item.territory_class not in ('inside', 'outside', 'ambiguous')
      or item.category_class is null
      or item.category_class not in ('exact', 'related', 'mismatch')
      or (
        item.blocked_reason is not null
        and item.blocked_reason not in (
          'outside_city', 'ambiguous_location', 'category_mismatch',
          'closed_forever', 'missing_name', 'missing_contact'
        )
      )
    then
      rejected_count_value := rejected_count_value + 1;
      continue;
    end if;

    begin
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
    exception
      when check_violation then
        get stacked diagnostics failed_constraint = constraint_name;
        if failed_constraint in (
          'prospecting_candidates_name_check',
          'prospecting_candidates_coordinates_check',
          'prospecting_candidates_rating_check',
          'prospecting_candidates_counts_check',
          'prospecting_run_candidates_position_check',
          'prospecting_run_candidates_territory_check',
          'prospecting_run_candidates_category_check',
          'prospecting_run_candidates_review_check',
          'prospecting_run_candidates_conflict_check'
        ) then
          rejected_count_value := rejected_count_value + 1;
          continue;
        end if;
        raise;
    end;
    v_normalized_count := v_normalized_count + 1;
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

  v_received_count := v_normalized_count + rejected_count_value;
  if p_next_offset is null
    or v_received_count = 0
    or run_row.fetched_count + v_received_count >= run_row.result_limit
    or (
      p_total_count is not null
      and run_row.fetched_count + v_received_count >= p_total_count
    )
  then
    next_status := 'completed';
  end if;

  update public.prospecting_run_pages
  set
    status = 'completed',
    output_offset = p_next_offset,
    output_offset_token = p_next_offset_token,
    received_count = v_received_count,
    normalized_count = v_normalized_count,
    rejected_count = rejected_count_value,
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
    fetched_count = fetched_count + v_received_count,
    accepted_count = accepted_count + accepted_delta,
    ambiguous_count = ambiguous_count + ambiguous_delta,
    duplicate_count = duplicate_count + duplicate_delta,
    rejected_count = rejected_count + rejected_count_value,
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
    'receivedCount', v_received_count,
    'normalizedCount', v_normalized_count,
    'rejectedCount', rejected_count_value
  );
end;
$$;

revoke all on function public.complete_prospecting_page(
  uuid, uuid, integer, integer, text, jsonb, integer, numeric
) from public;

grant execute on function public.complete_prospecting_page(
  uuid, uuid, integer, integer, text, jsonb, integer, numeric
) to authenticated;
