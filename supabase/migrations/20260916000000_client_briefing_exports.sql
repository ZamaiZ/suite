insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clients',
  'clients',
  false,
  26214400,
  array['application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.client_briefing_exports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  document jsonb not null,
  content_fingerprint text not null,
  storage_path text not null unique,
  file_name text not null,
  is_current boolean not null default true,
  exported_at timestamptz not null default now(),
  exported_by uuid not null references public.users(id)
);

create unique index if not exists client_briefing_exports_one_current_idx
  on public.client_briefing_exports (client_id)
  where is_current;

create index if not exists client_briefing_exports_client_exported_at_idx
  on public.client_briefing_exports (client_id, exported_at desc);

alter table public.client_briefing_exports enable row level security;
revoke all on public.client_briefing_exports from anon, authenticated;
