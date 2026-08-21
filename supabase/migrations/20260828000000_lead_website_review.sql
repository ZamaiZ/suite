alter table public.lead_website_audits
  add column if not exists review jsonb not null default '{}'::jsonb;

update public.lead_website_audits
set review = jsonb_build_object(
  'other',
  jsonb_build_object(
    'verdict', null,
    'note', trim(notes)
  )
)
where notes is not null
  and char_length(trim(notes)) > 0
  and review = '{}'::jsonb;
