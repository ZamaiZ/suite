do $$ begin
  create type public.closing_stage as enum (
    'open',
    'no_show',
    'standby',
    'won_pending'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.leads add column if not exists closing_stage      public.closing_stage;
alter table public.leads add column if not exists legal_name         text;
alter table public.leads add column if not exists tax_id             text;
alter table public.leads add column if not exists signer_name        text;
alter table public.leads add column if not exists contract_ref       text;
alter table public.leads add column if not exists invoice_ref        text;
alter table public.leads add column if not exists contract_sent_at   timestamptz;
alter table public.leads add column if not exists contract_signed_at timestamptz;
alter table public.leads add column if not exists invoice_sent_at    timestamptz;
alter table public.leads add column if not exists paid_at            timestamptz;

update public.leads
set
  status = 'contacting',
  closing_stage = null
where status = 'interested'
  and (assigned_closer_id is null or closing_meeting_at is null);

update public.leads
set closing_stage = 'open'::public.closing_stage
where status = 'interested'
  and assigned_closer_id is not null
  and closing_meeting_at is not null
  and closing_stage is null;

alter table public.leads
  drop constraint if exists leads_opportunity_fields_chk;

alter table public.leads
  add constraint leads_opportunity_fields_chk check (
    (
      status = 'interested'
      and assigned_closer_id is not null
      and closing_meeting_at is not null
      and closing_stage is not null
    )
    or (
      status = 'converted'
      and assigned_closer_id is not null
      and closing_meeting_at is not null
      and closing_stage is null
      and contract_signed_at is not null
      and paid_at is not null
    )
    or (
      status not in ('interested', 'converted')
      and assigned_closer_id is null
      and closing_meeting_at is null
      and closing_stage is null
      and legal_name is null
      and tax_id is null
      and signer_name is null
      and contract_ref is null
      and invoice_ref is null
      and contract_sent_at is null
      and contract_signed_at is null
      and invoice_sent_at is null
      and paid_at is null
    )
  );

create index if not exists leads_closing_stage_idx
  on public.leads (closing_stage)
  where closing_stage is not null;

alter table public.lead_activities
  drop constraint if exists lead_activities_type_fields_chk;

alter table public.lead_activities
  add constraint lead_activities_type_fields_chk check (
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
      type = 'no_contact'
      and follow_up_at is null
      and denied_reason is null
    )
    or (
      type = 'interested'
      and denied_reason is null
    )
    or (
      type = 'closing_lost'
      and denied_reason is not null
      and length(trim(denied_reason)) > 0
      and channel is null
      and channel_detail is null
    )
    or (
      type = 'meeting_rescheduled'
      and follow_up_at is not null
      and denied_reason is null
      and channel is null
      and channel_detail is null
    )
    or (
      type = 'closing_standby'
      and follow_up_at is not null
      and denied_reason is null
      and channel is not null
    )
    or (
      type in ('meeting_no_show', 'closing_won')
      and follow_up_at is null
      and denied_reason is null
      and channel is null
      and channel_detail is null
    )
  );

create table if not exists public.clients (
  id             uuid        primary key default gen_random_uuid(),
  lead_id        uuid        not null unique references public.leads(id),
  company_name   text        not null,
  closer_id      uuid        references public.users(id) on delete set null,
  converted_at   timestamptz not null default now(),
  stage          text        not null default 'initial',
  constraint clients_stage_chk check (stage = 'initial')
);

create index if not exists clients_converted_at_idx
  on public.clients (converted_at desc);

create index if not exists clients_closer_id_idx
  on public.clients (closer_id)
  where closer_id is not null;

alter table public.clients enable row level security;

drop policy if exists "clients_select_commercial" on public.clients;
create policy "clients_select_commercial"
  on public.clients
  for select
  to authenticated
  using (public.is_commercial_member());

drop policy if exists "clients_insert_commercial" on public.clients;
create policy "clients_insert_commercial"
  on public.clients
  for insert
  to authenticated
  with check (public.is_commercial_member());

drop policy if exists "clients_update_commercial" on public.clients;
create policy "clients_update_commercial"
  on public.clients
  for update
  to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

drop policy if exists "clients_delete_commercial" on public.clients;
create policy "clients_delete_commercial"
  on public.clients
  for delete
  to authenticated
  using (public.is_commercial_member());

revoke all on table public.clients from anon, authenticated;
grant select, insert, update, delete on table public.clients to authenticated;
