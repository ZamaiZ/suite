do $$ begin
  create type public.client_kickoff_stage as enum ('none', 'scheduled', 'no_show', 'completed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.client_activity_type as enum ('kickoff_scheduled', 'kickoff_rescheduled', 'kickoff_no_show', 'kickoff_completed', 'kickoff_note');
exception when duplicate_object then null;
end $$;

alter table public.clients
  add column if not exists kickoff_stage public.client_kickoff_stage not null default 'none',
  add column if not exists kickoff_meeting_at timestamptz;

alter table public.clients drop constraint if exists clients_kickoff_fields_chk;
alter table public.clients add constraint clients_kickoff_fields_chk check (
  (kickoff_stage in ('none', 'completed') and kickoff_meeting_at is null)
  or (kickoff_stage in ('scheduled', 'no_show') and kickoff_meeting_at is not null)
);

create index if not exists clients_kickoff_meeting_at_idx
  on public.clients (kickoff_meeting_at) where kickoff_meeting_at is not null;

create table if not exists public.client_activities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  type public.client_activity_type not null,
  channel public.lead_activity_channel,
  channel_detail text,
  note text,
  meeting_at timestamptz,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  constraint client_activities_type_fields_chk check (
    (type in ('kickoff_scheduled', 'kickoff_rescheduled') and meeting_at is not null and channel is not null)
    or (type in ('kickoff_no_show', 'kickoff_completed') and meeting_at is null and channel is null and channel_detail is null)
    or (type = 'kickoff_note' and meeting_at is null and channel is not null and note is not null and length(trim(note)) > 0)
  )
);

create index if not exists client_activities_client_created_at_idx on public.client_activities (client_id, created_at desc);
alter table public.client_activities enable row level security;
create policy "client_activities_select_commercial" on public.client_activities for select to authenticated using (public.is_commercial_member());
create policy "client_activities_insert_commercial" on public.client_activities for insert to authenticated with check (public.is_commercial_member());
revoke all on public.client_activities from anon, authenticated;
grant select, insert on public.client_activities to authenticated;
