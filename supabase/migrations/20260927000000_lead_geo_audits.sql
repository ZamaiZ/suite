-- Coleta da etapa de Presenca em IA.
--
-- Append-only desde o dia 1, ao contrario de `lead_visibility_audits`, que
-- nasceu com indice unico por lead e precisou da 20260917000000 para virar
-- historico. Sem acumulo nao existe "antes", e a auditoria nao serve de
-- baseline.
--
-- A etapa nao coleta: ela le os snapshots de website, visibilidade e backlinks
-- que ja existem e os reprojeta sob o vocabulario de GEO. Por isso o snapshot
-- guarda `sources`, com a data de cada origem -- carimbar a hora do clique como
-- se fosse a hora da medida foi o defeito que a onda 0 da visibilidade achou.

create table if not exists public.lead_geo_audits (
  id          uuid        primary key default gen_random_uuid(),
  lead_id     uuid        not null references public.leads(id) on delete cascade,
  domain      text        not null,
  snapshot    jsonb       not null,
  fetched_at  timestamptz not null default now(),
  fetched_by  uuid        not null references public.users(id),
  constraint lead_geo_audits_snapshot_obj_chk
    check (jsonb_typeof(snapshot) = 'object')
);

create index if not exists lead_geo_audits_lead_recent_idx
  on public.lead_geo_audits (lead_id, fetched_at desc);

alter table public.lead_geo_audits enable row level security;

drop policy if exists "lead_geo_audits_select_commercial" on public.lead_geo_audits;
create policy "lead_geo_audits_select_commercial"
  on public.lead_geo_audits
  for select
  to authenticated
  using (public.is_commercial_member());

drop policy if exists "lead_geo_audits_insert_commercial" on public.lead_geo_audits;
create policy "lead_geo_audits_insert_commercial"
  on public.lead_geo_audits
  for insert
  to authenticated
  with check (public.is_commercial_member());

drop policy if exists "lead_geo_audits_update_commercial" on public.lead_geo_audits;
create policy "lead_geo_audits_update_commercial"
  on public.lead_geo_audits
  for update
  to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

drop policy if exists "lead_geo_audits_delete_commercial" on public.lead_geo_audits;
create policy "lead_geo_audits_delete_commercial"
  on public.lead_geo_audits
  for delete
  to authenticated
  using (public.is_commercial_member());

revoke all on table public.lead_geo_audits from anon, authenticated;
grant select, insert, update, delete on table public.lead_geo_audits to authenticated;
