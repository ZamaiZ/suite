create table public.tags (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  slug        text        not null unique,
  created_at  timestamptz not null default now(),
  constraint tags_name_len_chk check (char_length(trim(name)) between 1 and 32),
  constraint tags_slug_format_chk check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create table public.lead_tags (
  lead_id     uuid        not null references public.leads(id) on delete cascade,
  tag_id      uuid        not null references public.tags(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (lead_id, tag_id)
);

create index lead_tags_tag_id_idx on public.lead_tags (tag_id);

alter table public.tags enable row level security;
alter table public.lead_tags enable row level security;

create policy "tags_select_commercial"
  on public.tags
  for select
  to authenticated
  using (public.is_commercial_member());

create policy "tags_insert_commercial"
  on public.tags
  for insert
  to authenticated
  with check (public.is_commercial_member());

create policy "lead_tags_select_commercial"
  on public.lead_tags
  for select
  to authenticated
  using (public.is_commercial_member());

create policy "lead_tags_insert_commercial"
  on public.lead_tags
  for insert
  to authenticated
  with check (public.is_commercial_member());

create policy "lead_tags_delete_commercial"
  on public.lead_tags
  for delete
  to authenticated
  using (public.is_commercial_member());

revoke all on table public.tags from anon, authenticated;
grant select, insert on table public.tags to authenticated;

revoke all on table public.lead_tags from anon, authenticated;
grant select, insert, delete on table public.lead_tags to authenticated;
