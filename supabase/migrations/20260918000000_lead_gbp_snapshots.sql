-- Os dados variaveis do perfil do Google saem das colunas mutaveis de
-- lead_gbp_profiles para uma tabela append-only. O perfil continua guardando
-- payload como estado corrente, porque lib/briefing/prefill.ts o le direto.

create table if not exists public.lead_gbp_snapshots (
  id           uuid        primary key default gen_random_uuid(),
  profile_id   uuid        not null references public.lead_gbp_profiles(id) on delete cascade,
  captured_at  timestamptz not null default now(),
  payload      jsonb       not null,
  enrichment   jsonb,
  reviews      jsonb,
  posts        jsonb,
  qna          jsonb
);

create index if not exists lead_gbp_snapshots_profile_recent_idx
  on public.lead_gbp_snapshots (profile_id, captured_at desc);

alter table public.lead_gbp_snapshots enable row level security;

create policy "lead_gbp_snapshots_select_commercial"
  on public.lead_gbp_snapshots
  for select
  to authenticated
  using (public.is_commercial_member());

create policy "lead_gbp_snapshots_insert_commercial"
  on public.lead_gbp_snapshots
  for insert
  to authenticated
  with check (public.is_commercial_member());

create policy "lead_gbp_snapshots_update_commercial"
  on public.lead_gbp_snapshots
  for update
  to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

create policy "lead_gbp_snapshots_delete_commercial"
  on public.lead_gbp_snapshots
  for delete
  to authenticated
  using (public.is_commercial_member());

revoke all on table public.lead_gbp_snapshots from anon, authenticated;
grant select, insert, update, delete on table public.lead_gbp_snapshots to authenticated;

-- Carga inicial: cada perfil vira um primeiro snapshot, datado pelo timestamp
-- mais recente que ele tiver entre enriquecimento, reviews, posts e coleta.

insert into public.lead_gbp_snapshots (
  profile_id,
  captured_at,
  payload,
  enrichment,
  reviews,
  posts,
  qna
)
select
  profile.id,
  greatest(
    coalesce(profile.enrichment_at, profile.fetched_at),
    coalesce(profile.reviews_at, profile.fetched_at),
    coalesce(profile.posts_at, profile.fetched_at),
    coalesce(profile.qna_at, profile.fetched_at),
    profile.fetched_at
  ),
  profile.payload,
  profile.enrichment,
  profile.reviews,
  profile.posts,
  profile.qna
from public.lead_gbp_profiles as profile
where not exists (
  select 1
  from public.lead_gbp_snapshots as existing
  where existing.profile_id = profile.id
);

alter table public.lead_gbp_profiles
  drop constraint if exists lead_gbp_profiles_enrichment_at_chk,
  drop constraint if exists lead_gbp_profiles_posts_at_chk,
  drop constraint if exists lead_gbp_profiles_reviews_at_chk,
  drop constraint if exists lead_gbp_profiles_qna_at_chk;

alter table public.lead_gbp_profiles
  drop column if exists enrichment,
  drop column if exists enrichment_at,
  drop column if exists reviews,
  drop column if exists reviews_at,
  drop column if exists posts,
  drop column if exists posts_at,
  drop column if exists qna,
  drop column if exists qna_at;
