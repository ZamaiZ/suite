create type public.lead_digital_channel_type as enum (
  'website',
  'instagram',
  'linkedin'
);

create table public.lead_digital_channels (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid not null references public.leads(id) on delete cascade,
  type            public.lead_digital_channel_type not null,
  value           text not null,
  normalized_key  text not null,
  is_primary      boolean not null default false,
  sort_order      integer not null,
  created_at      timestamptz not null default now(),
  constraint lead_digital_channels_value_len_chk
    check (char_length(trim(value)) between 1 and 500),
  constraint lead_digital_channels_key_len_chk
    check (char_length(trim(normalized_key)) between 1 and 500)
);

create unique index lead_digital_channels_type_key_uidx
  on public.lead_digital_channels (type, normalized_key);

create unique index lead_digital_channels_primary_per_type_uidx
  on public.lead_digital_channels (lead_id, type)
  where is_primary;

create index lead_digital_channels_lead_id_idx
  on public.lead_digital_channels (lead_id, sort_order);

insert into public.lead_digital_channels (
  lead_id,
  type,
  value,
  normalized_key,
  is_primary,
  sort_order
)
select
  id,
  'website',
  website,
  website_domain,
  true,
  0
from public.leads;

insert into public.lead_digital_channels (
  lead_id,
  type,
  value,
  normalized_key,
  is_primary,
  sort_order
)
select distinct on (handle)
  id,
  'instagram',
  '@' || handle,
  handle,
  true,
  1
from (
  select
    id,
    created_at,
    lower(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(trim(instagram), '^https?://', '', 'i'),
            '^(www\.)?(instagram\.com|instagr\.am)/',
            '',
            'i'
          ),
          '^@',
          ''
        ),
        '/.*$',
        ''
      )
    ) as handle
  from public.leads
  where instagram is not null
    and length(trim(instagram)) > 0
) parsed
where handle ~ '^[a-z0-9._]{1,30}$'
  and handle ~ '[a-z0-9]'
order by handle, created_at, id;

insert into public.lead_digital_channels (
  lead_id,
  type,
  value,
  normalized_key,
  is_primary,
  sort_order
)
select distinct on (normalized_key)
  id,
  'linkedin',
  'https://' || normalized_key,
  normalized_key,
  true,
  2
from (
  select
    id,
    created_at,
    'linkedin.com/' || lower(kind) || '/' || lower(slug) as normalized_key
  from (
    select
      id,
      created_at,
      (regexp_match(
        lower(
          regexp_replace(
            regexp_replace(
              regexp_replace(trim(linkedin), '^https?://(www\.)?', '', 'i'),
              '[?#].*$',
              ''
            ),
            '/+$',
            ''
          )
        ),
        '(?:[a-z0-9.-]+\.)?linkedin\.com/(company|in)/([^/]+)'
      )) as matched
    from public.leads
    where linkedin is not null
      and length(trim(linkedin)) > 0
  ) extracted
  cross join lateral (
    select
      matched[1] as kind,
      matched[2] as slug
  ) parts
  where matched is not null
    and slug ~ '^[a-z0-9._%-]+$'
) parsed
order by normalized_key, created_at, id;

alter table public.leads
  drop column instagram,
  drop column linkedin;

alter table public.lead_digital_channels enable row level security;

create policy "lead_digital_channels_select_commercial"
  on public.lead_digital_channels
  for select
  to authenticated
  using (public.is_commercial_member());

create policy "lead_digital_channels_insert_commercial"
  on public.lead_digital_channels
  for insert
  to authenticated
  with check (public.is_commercial_member());

create policy "lead_digital_channels_update_commercial"
  on public.lead_digital_channels
  for update
  to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

create policy "lead_digital_channels_delete_commercial"
  on public.lead_digital_channels
  for delete
  to authenticated
  using (public.is_commercial_member());

revoke all on table public.lead_digital_channels from anon, authenticated;
grant select, insert, update, delete on table public.lead_digital_channels to authenticated;
