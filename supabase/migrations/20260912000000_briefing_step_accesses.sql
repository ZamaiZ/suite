alter table public.client_briefing_steps
  drop constraint if exists client_briefing_steps_step_chk;

alter table public.client_briefing_steps
  add constraint client_briefing_steps_step_chk
  check (step in (
    'company',
    'brand',
    'audience',
    'history',
    'finance',
    'website',
    'accesses'
  ));

create table if not exists public.client_briefing_secrets (
  id          uuid        primary key default gen_random_uuid(),
  client_id   uuid        not null references public.clients(id) on delete cascade,
  kind        text        not null,
  ciphertext  text        not null,
  iv          text        not null,
  updated_at  timestamptz not null default now(),
  constraint client_briefing_secrets_client_kind_key unique (client_id, kind),
  constraint client_briefing_secrets_kind_chk check (
    kind in ('wordpress', 'hosting_domain')
    or kind like 'other:%'
  )
);

create index if not exists client_briefing_secrets_client_id_idx
  on public.client_briefing_secrets (client_id);

alter table public.client_briefing_secrets enable row level security;

revoke all on table public.client_briefing_secrets from anon, authenticated;
