-- Auditoria de lead deixa de sobrescrever e passa a acumular snapshots.
-- Os indices unicos que forcavam uma linha por chave viram indices de leitura
-- ordenados pelo timestamp que cada tabela ja possui.

drop index if exists public.lead_website_audits_channel_id_uidx;

create index if not exists lead_website_audits_channel_recent_idx
  on public.lead_website_audits (channel_id, fetched_at desc);

drop index if exists public.lead_visibility_audits_lead_id_uidx;

create index if not exists lead_visibility_audits_lead_recent_idx
  on public.lead_visibility_audits (lead_id, fetched_at desc);

alter table public.lead_gbp_rank_checks
  drop constraint if exists lead_gbp_rank_checks_profile_keyword_key;

drop index if exists public.lead_gbp_rank_checks_profile_keyword_uidx;

create index if not exists lead_gbp_rank_checks_profile_keyword_recent_idx
  on public.lead_gbp_rank_checks (profile_id, keyword, checked_at desc);

-- Amostra de paginas fixada no primeiro crawl do canal, para que duas coletas
-- comparem as mesmas URLs mesmo que o menu da home mude.

alter table public.lead_digital_channels
  add column if not exists audit_paths text[] not null default '{}';

do $$
begin
  alter table public.lead_digital_channels
    add constraint lead_digital_channels_audit_paths_len_chk
    check (cardinality(audit_paths) <= 8) not valid;
exception
  when duplicate_object then null;
end $$;

alter table public.lead_digital_channels
  validate constraint lead_digital_channels_audit_paths_len_chk;

-- Momento em que o cliente foi convertido passa a ancorar o baseline da
-- auditoria. O baseline de cada dimensao e o snapshot mais recente com
-- timestamp menor ou igual a esta data.

alter table public.clients
  add column if not exists baseline_at timestamptz;
