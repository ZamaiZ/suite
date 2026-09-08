-- Malha geográfica do perfil no Maps.
--
-- Um scan por linha, com a malha inteira em `points`. Estado e progresso moram
-- aqui em vez de numa tabela de jobs: a malha é o dado e o progresso ao mesmo
-- tempo, e separá-los criaria uma segunda tabela sem ganho.
--
-- Cada ponto é uma busca paga do plano. Por isso os pontos são gravados
-- conforme chegam, para que um retry retome nos pendentes em vez de refazer
-- tudo, e uma falha no meio preserve o que já foi coletado.

create table if not exists public.lead_gbp_grid_scans (
  id             uuid        primary key default gen_random_uuid(),
  lead_id        uuid        not null references public.leads(id) on delete cascade,
  profile_id     uuid        not null references public.lead_gbp_profiles(id) on delete cascade,
  keyword        text        not null,
  center_lat     double precision not null,
  center_lng     double precision not null,
  size           integer     not null,
  radius_km      numeric(5,2) not null,
  zoom           integer     not null,
  source         text        not null,
  status         text        not null,
  processed      integer     not null default 0,
  total          integer     not null,
  points         jsonb       not null default '[]'::jsonb,
  error_message  text,
  started_at     timestamptz,
  captured_at    timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint lead_gbp_grid_scans_keyword_len_chk
    check (char_length(trim(keyword)) between 1 and 80),
  constraint lead_gbp_grid_scans_size_chk
    check (size in (5, 7, 11)),
  constraint lead_gbp_grid_scans_radius_chk
    check (radius_km >= 1 and radius_km <= 25),
  constraint lead_gbp_grid_scans_zoom_chk
    check (zoom between 3 and 21),
  constraint lead_gbp_grid_scans_source_chk
    check (source in ('serpapi_maps', 'dataforseo_maps')),
  constraint lead_gbp_grid_scans_status_chk
    check (status in ('queued', 'running', 'ready', 'partial', 'failed')),
  constraint lead_gbp_grid_scans_total_chk
    check (total = size * size),
  constraint lead_gbp_grid_scans_processed_chk
    check (processed >= 0 and processed <= total),
  constraint lead_gbp_grid_scans_error_len_chk
    check (
      error_message is null
      or char_length(trim(error_message)) between 1 and 500
    )
);

create index if not exists lead_gbp_grid_scans_profile_recent_idx
  on public.lead_gbp_grid_scans (profile_id, keyword, captured_at desc);

create index if not exists lead_gbp_grid_scans_lead_id_idx
  on public.lead_gbp_grid_scans (lead_id);

-- Trava contra disparo duplo no banco: dois cliques simultâneos passariam pela
-- validação da aplicação, mas não por aqui.
create unique index if not exists lead_gbp_grid_scans_active_uidx
  on public.lead_gbp_grid_scans (profile_id, keyword)
  where status in ('queued', 'running');

alter table public.lead_gbp_grid_scans enable row level security;

drop policy if exists "lead_gbp_grid_scans_select_commercial" on public.lead_gbp_grid_scans;
create policy "lead_gbp_grid_scans_select_commercial"
  on public.lead_gbp_grid_scans
  for select
  to authenticated
  using (public.is_commercial_member());

drop policy if exists "lead_gbp_grid_scans_insert_commercial" on public.lead_gbp_grid_scans;
create policy "lead_gbp_grid_scans_insert_commercial"
  on public.lead_gbp_grid_scans
  for insert
  to authenticated
  with check (public.is_commercial_member());

drop policy if exists "lead_gbp_grid_scans_update_commercial" on public.lead_gbp_grid_scans;
create policy "lead_gbp_grid_scans_update_commercial"
  on public.lead_gbp_grid_scans
  for update
  to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

drop policy if exists "lead_gbp_grid_scans_delete_commercial" on public.lead_gbp_grid_scans;
create policy "lead_gbp_grid_scans_delete_commercial"
  on public.lead_gbp_grid_scans
  for delete
  to authenticated
  using (public.is_commercial_member());

revoke all on table public.lead_gbp_grid_scans from anon, authenticated;
grant select, insert, update, delete on table public.lead_gbp_grid_scans to authenticated;
