alter type public.app_role add value if not exists 'customer_success';

create type public.lead_status as enum (
  'new',
  'contacting',
  'follow_up',
  'denied',
  'interested'
);

create type public.lead_activity_type as enum (
  'no_contact',
  'call_later',
  'denied',
  'interested'
);

create table public.leads (
  id                 uuid                     primary key default gen_random_uuid(),
  company_name       text                     not null,
  website            text                     not null,
  website_domain     text                     not null unique,
  instagram          text,
  linkedin           text,
  contact_name       text,
  phone              text,
  email              text,
  status             public.lead_status       not null default 'new',
  assigned_sdr_id    uuid                     references public.users(id) on delete set null,
  next_follow_up_at  timestamptz,
  created_by         uuid                     not null references public.users(id),
  created_at         timestamptz              not null default now(),
  updated_at         timestamptz              not null default now(),
  constraint leads_owner_status_chk check (
    (assigned_sdr_id is null and status = 'new')
    or (assigned_sdr_id is not null and status <> 'new')
  )
);

create index leads_assigned_sdr_id_idx on public.leads (assigned_sdr_id);
create index leads_status_idx on public.leads (status);
create index leads_next_follow_up_at_idx
  on public.leads (next_follow_up_at)
  where next_follow_up_at is not null;

create table public.lead_activities (
  id             uuid                         primary key default gen_random_uuid(),
  lead_id        uuid                         not null references public.leads(id) on delete cascade,
  type           public.lead_activity_type    not null,
  note           text,
  denied_reason  text,
  follow_up_at   timestamptz,
  created_by     uuid                         not null references public.users(id),
  created_at     timestamptz                  not null default now(),
  constraint lead_activities_type_fields_chk check (
    (
      type = 'denied'
      and denied_reason is not null
      and length(trim(denied_reason)) > 0
    )
    or (
      type = 'call_later'
      and follow_up_at is not null
      and denied_reason is null
    )
    or (
      type in ('no_contact', 'interested')
      and follow_up_at is null
      and denied_reason is null
    )
  )
);

create index lead_activities_lead_id_idx
  on public.lead_activities (lead_id, created_at desc);

alter table public.leads enable row level security;
alter table public.lead_activities enable row level security;

create policy "leads_select_commercial"
  on public.leads
  for select
  to authenticated
  using (public.is_commercial_member());

create policy "leads_insert_commercial"
  on public.leads
  for insert
  to authenticated
  with check (public.is_commercial_member());

create policy "leads_update_commercial"
  on public.leads
  for update
  to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

create policy "lead_activities_select_commercial"
  on public.lead_activities
  for select
  to authenticated
  using (public.is_commercial_member());

create policy "lead_activities_insert_commercial"
  on public.lead_activities
  for insert
  to authenticated
  with check (public.is_commercial_member());

create policy "lead_activities_update_commercial"
  on public.lead_activities
  for update
  to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

revoke all on table public.leads from anon, authenticated;
grant select, insert, update on table public.leads to authenticated;

revoke all on table public.lead_activities from anon, authenticated;
grant select, insert, update on table public.lead_activities to authenticated;
