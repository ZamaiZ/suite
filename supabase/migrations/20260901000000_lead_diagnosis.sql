insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'leads',
  'leads',
  false,
  20971520,
  array['application/pdf']::text[]
)
on conflict (id) do nothing;

create policy "leads_storage_select_commercial"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'leads'
    and public.is_commercial_member()
  );

create policy "leads_storage_insert_commercial"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'leads'
    and public.is_commercial_member()
  );

create policy "leads_storage_update_commercial"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'leads'
    and public.is_commercial_member()
  )
  with check (
    bucket_id = 'leads'
    and public.is_commercial_member()
  );

create policy "leads_storage_delete_commercial"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'leads'
    and public.is_commercial_member()
  );

create table public.lead_diagnosis_drafts (
  lead_id           uuid        primary key references public.leads(id) on delete cascade,
  document          jsonb       not null,
  facts_fingerprint text        not null,
  updated_at        timestamptz not null default now(),
  updated_by        uuid        not null references public.users(id)
);

alter table public.lead_diagnosis_drafts enable row level security;

create policy "lead_diagnosis_drafts_select_commercial"
  on public.lead_diagnosis_drafts
  for select
  to authenticated
  using (public.is_commercial_member());

create policy "lead_diagnosis_drafts_insert_commercial"
  on public.lead_diagnosis_drafts
  for insert
  to authenticated
  with check (public.is_commercial_member());

create policy "lead_diagnosis_drafts_update_commercial"
  on public.lead_diagnosis_drafts
  for update
  to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

create policy "lead_diagnosis_drafts_delete_commercial"
  on public.lead_diagnosis_drafts
  for delete
  to authenticated
  using (public.is_commercial_member());

revoke all on table public.lead_diagnosis_drafts from anon, authenticated;
grant select, insert, update, delete on table public.lead_diagnosis_drafts to authenticated;

create table public.lead_diagnosis_exports (
  id           uuid        primary key default gen_random_uuid(),
  lead_id      uuid        not null references public.leads(id) on delete cascade,
  document     jsonb       not null,
  storage_path text        not null,
  file_name    text        not null,
  is_current   boolean     not null default false,
  exported_at  timestamptz not null default now(),
  exported_by  uuid        not null references public.users(id)
);

create index lead_diagnosis_exports_lead_id_exported_at_idx
  on public.lead_diagnosis_exports (lead_id, exported_at desc);

create unique index lead_diagnosis_exports_lead_id_current_uidx
  on public.lead_diagnosis_exports (lead_id)
  where is_current;

alter table public.lead_diagnosis_exports enable row level security;

create policy "lead_diagnosis_exports_select_commercial"
  on public.lead_diagnosis_exports
  for select
  to authenticated
  using (public.is_commercial_member());

create policy "lead_diagnosis_exports_insert_commercial"
  on public.lead_diagnosis_exports
  for insert
  to authenticated
  with check (public.is_commercial_member());

create policy "lead_diagnosis_exports_update_commercial"
  on public.lead_diagnosis_exports
  for update
  to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

create policy "lead_diagnosis_exports_delete_commercial"
  on public.lead_diagnosis_exports
  for delete
  to authenticated
  using (public.is_commercial_member());

revoke all on table public.lead_diagnosis_exports from anon, authenticated;
grant select, insert, update, delete on table public.lead_diagnosis_exports to authenticated;
