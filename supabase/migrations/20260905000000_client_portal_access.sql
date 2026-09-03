alter table public.clients
  add column if not exists portal_slug text,
  add column if not exists portal_code_hash text,
  add column if not exists portal_code_generated_at timestamptz,
  add column if not exists portal_code_rotated_at timestamptz,
  add column if not exists portal_code_rotated_by uuid references public.users(id) on delete set null,
  add column if not exists portal_session_version integer not null default 0,
  add column if not exists portal_auth_failures integer not null default 0,
  add column if not exists portal_locked_until timestamptz;

alter table public.clients
  drop constraint if exists clients_portal_slug_hash_chk;

alter table public.clients
  add constraint clients_portal_slug_hash_chk check (
    (
      portal_slug is null
      and portal_code_hash is null
    )
    or (
      portal_slug is not null
      and length(trim(portal_slug)) > 0
      and portal_code_hash is not null
      and length(trim(portal_code_hash)) > 0
    )
  );

create unique index if not exists clients_portal_slug_uidx
  on public.clients (portal_slug)
  where portal_slug is not null;

create index if not exists clients_portal_rotated_by_idx
  on public.clients (portal_code_rotated_by)
  where portal_code_rotated_by is not null;
