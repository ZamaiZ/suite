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
    'accesses',
    'closing'
  ));

alter table public.clients
  add column if not exists briefing_finalized_at timestamptz,
  add column if not exists briefing_content_updated_at timestamptz;
