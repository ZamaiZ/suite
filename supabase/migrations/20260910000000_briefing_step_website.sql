alter table public.client_briefing_steps
  drop constraint if exists client_briefing_steps_step_chk;

alter table public.client_briefing_steps
  add constraint client_briefing_steps_step_chk
  check (step in ('company', 'brand', 'audience', 'finance', 'website'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'briefing-assets',
  'briefing-assets',
  false,
  10485760,
  array[
    'image/png',
    'image/svg+xml',
    'application/pdf'
  ]::text[]
)
on conflict (id) do nothing;
