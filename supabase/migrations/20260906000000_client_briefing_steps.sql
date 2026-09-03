create table if not exists public.client_briefing_steps (
  id              uuid        primary key default gen_random_uuid(),
  client_id       uuid        not null references public.clients(id) on delete cascade,
  step            text        not null,
  payload         jsonb       not null,
  source_snapshot jsonb       not null,
  updated_at      timestamptz not null default now(),
  completed_at    timestamptz,
  constraint client_briefing_steps_step_chk check (step in ('company')),
  constraint client_briefing_steps_client_step_key unique (client_id, step)
);

create index if not exists client_briefing_steps_client_id_idx
  on public.client_briefing_steps (client_id);

alter table public.client_briefing_steps enable row level security;

revoke all on table public.client_briefing_steps from anon, authenticated;
