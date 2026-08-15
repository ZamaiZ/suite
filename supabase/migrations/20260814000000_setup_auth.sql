drop table if exists public.users cascade;

create table public.users (
  id          uuid        primary key references auth.users(id) on delete cascade,
  name        text        not null,
  created_at  timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users_select_own" on public.users
  for select
  to authenticated
  using (id = (select auth.uid()));

create table if not exists public.rate_limit_buckets (
  key          text        not null,
  window_start timestamptz not null,
  count        integer     not null default 0,
  primary key (key, window_start)
);

revoke all on public.rate_limit_buckets from anon, authenticated;

create or replace function public.check_rate_limit(
  p_key            text,
  p_window_seconds integer,
  p_max_requests   integer
)
  returns boolean
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_count        integer;
begin
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limit_buckets (key, window_start, count)
  values (p_key, v_window_start, 1)
  on conflict (key, window_start)
  do update set count = public.rate_limit_buckets.count + 1
  returning count into v_count;

  if random() < 0.05 then
    delete from public.rate_limit_buckets
    where window_start < now() - interval '24 hours';
  end if;

  return v_count <= p_max_requests;
end;
$$;

revoke execute on function public.check_rate_limit from public, anon, authenticated;
grant  execute on function public.check_rate_limit to service_role;

create type public.app_role as enum (
  'admin',
  'commercial_manager',
  'sdr',
  'closer',
  'analyst'
);

create table public.user_roles (
  user_id     uuid            not null references public.users(id) on delete cascade,
  role        public.app_role not null,
  created_at  timestamptz     not null default now(),
  primary key (user_id, role)
);

create index user_roles_role_idx on public.user_roles (role);

alter table public.user_roles enable row level security;

create or replace function public.has_role(p_role public.app_role)
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = p_role
  );
$$;

create or replace function public.has_any_role(p_roles public.app_role[])
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = any(coalesce(p_roles, array[]::public.app_role[]))
  );
$$;

create or replace function public.is_commercial_member()
  returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
  );
$$;

create policy "user_roles_select_own_or_commercial"
  on public.user_roles
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_commercial_member()
  );

create policy "users_select_commercial_members"
  on public.users
  for select
  to authenticated
  using (public.is_commercial_member());

create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into public.users (id, name, created_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    now()
  )
  on conflict (id) do nothing;

  lock table public.user_roles in share row exclusive mode;

  if not exists (select 1 from public.user_roles) then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin'::public.app_role);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

create or replace function public.replace_user_roles(
  p_user_id uuid,
  p_roles public.app_role[]
)
  returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_roles public.app_role[] := coalesce(p_roles, array[]::public.app_role[]);
begin
  if auth.uid() is null or not public.has_role('admin'::public.app_role) then
    raise exception 'Not authorized to manage user roles'
      using errcode = '42501';
  end if;

  lock table public.user_roles in share row exclusive mode;

  if not public.has_role('admin'::public.app_role) then
    raise exception 'Not authorized to manage user roles'
      using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'User not found'
      using errcode = 'P0002';
  end if;

  perform 1
  from public.users
  where id = p_user_id
  for update;

  if not found then
    raise exception 'User not found'
      using errcode = 'P0002';
  end if;

  if array_position(v_roles, null::public.app_role) is not null then
    raise exception 'Roles cannot contain null values'
      using errcode = '22023';
  end if;

  if not ('admin'::public.app_role = any(v_roles)) and not exists (
    select 1
    from public.user_roles
    where user_id <> p_user_id
      and role = 'admin'::public.app_role
  ) then
    raise exception 'At least one administrator is required'
      using errcode = '23514';
  end if;

  delete from public.user_roles
  where user_id = p_user_id
    and not (role = any(v_roles));

  insert into public.user_roles (user_id, role)
  select p_user_id, normalized_roles.role
  from (
    select distinct unnest(v_roles) as role
  ) as normalized_roles
  on conflict (user_id, role) do nothing;
end;
$$;

revoke all on table public.users from anon, authenticated;
grant select on table public.users to authenticated;

revoke all on table public.user_roles from public, anon, authenticated;
grant select on table public.user_roles to authenticated;

revoke all on function public.handle_new_user()
  from public, anon, authenticated;
revoke all on function public.has_role(public.app_role)
  from public, anon, authenticated;
revoke all on function public.has_any_role(public.app_role[])
  from public, anon, authenticated;
revoke all on function public.is_commercial_member()
  from public, anon, authenticated;
revoke all on function public.replace_user_roles(uuid, public.app_role[])
  from public, anon, authenticated;

grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.has_any_role(public.app_role[]) to authenticated;
grant execute on function public.is_commercial_member() to authenticated;
grant execute on function public.replace_user_roles(uuid, public.app_role[])
  to authenticated;
