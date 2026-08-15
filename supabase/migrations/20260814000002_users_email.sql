alter table public.users
  add column email text;

update public.users as profile
set email = auth_user.email
from auth.users as auth_user
where profile.id = auth_user.id
  and auth_user.email is not null;

alter table public.users
  alter column email set not null;

create unique index users_email_key on public.users (email);

create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into public.users (id, name, email, created_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
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

create or replace function public.sync_user_email()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if new.email is not distinct from old.email then
    return new;
  end if;

  update public.users
  set email = new.email
  where id = new.id;

  return new;
end;
$$;

revoke all on function public.sync_user_email()
  from public, anon, authenticated;

drop trigger if exists on_auth_user_email_updated on auth.users;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  execute procedure public.sync_user_email();
