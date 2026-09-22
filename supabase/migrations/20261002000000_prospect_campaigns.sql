-- Prospeccao: campanhas e empresas descobertas.
--
-- Terceira porta de entrada do modulo de leads. As duas que existiam --
-- cadastro manual e planilha -- pressupoem que alguem ja sabe quem e o lead.
-- Esta inverte: o SDR diz "dentista, 10 km de Guarulhos" e a suite descobre.
--
-- A descoberta NAO escreve em `public.leads`. Fica aqui ate o SDR promover, por
-- tres motivos medidos na sondagem de 2026-09-21
-- (docs/auditoria/evidencias/2026-09-21-prospeccao/):
--
--   1. O universo e grande demais para o board. Dentista num raio de 10 km de
--      Guarulhos: 2.401 empresas. Restaurante: 4.791. Despejar isso na coluna
--      "Novo" destruiria a fila de trabalho.
--   2. So 21% a 40% tem site, e `leads.website_domain` era `not null unique`.
--   3. A maior parte nunca vai virar lead. Prospect descartado precisa deixar
--      rastro para nao voltar na proxima campanha -- e `leads` nao tem delete.

create table if not exists public.prospect_campaigns (
  id                  uuid        primary key default gen_random_uuid(),
  name                text        not null,
  -- Segmento do catalogo da casa, para a lista falar a mesma lingua do board.
  -- Nulo e permitido: nem toda categoria do Google tem segmento equivalente.
  segment_id          uuid        references public.segments(id) on delete set null,
  -- Categorias do catalogo do provedor (`category_name`, snake_case). Ate 10,
  -- que e o teto do endpoint.
  categories          text[]      not null default '{}',
  -- `business_listings` hoje; `serp_maps` fica reservado. A sondagem aprovou o
  -- primeiro, mas em segmento ou cidade pequenos a varredura por malha pode
  -- render mais, e trocar de fonte nao pode exigir migration.
  source              text        not null default 'business_listings',
  state_code          char(2)     not null,
  city                text        not null,
  center_lat          double precision not null,
  center_lng          double precision not null,
  radius_km           numeric(5, 2)    not null,
  -- Filtros de qualificacao aplicados no servidor do provedor: nota maxima,
  -- minimo de avaliacoes, so nao reivindicados, so sem site.
  filters             jsonb       not null default '{}'::jsonb,
  target_count        integer     not null,
  -- Estimativa do `categories_aggregation`, guardada inteira. Custa o mesmo
  -- que uma busca (US$ 0,048 medido, com `limit: 5` ou 100 -- o limit nao
  -- barateia), entao repetir a cada abertura da tela seria pagar duas vezes
  -- pela mesma pergunta.
  estimate            jsonb,
  -- Cursor da paginacao. Mesmo papel do `processed` em `lead_gbp_grid_scans`:
  -- e o que faz o retry retomar em vez de recomprar a lista inteira.
  discovery_offset    integer     not null default 0,
  discovery_token     text,
  discovered_count    integer     not null default 0,
  -- `total_count` que o provedor declarou. Serve para a tela dizer quanto do
  -- universo ja foi trazido, e para o SDR saber que parou por teto, nao por
  -- fim da lista.
  universe_count      integer,
  status              text        not null default 'draft',
  -- Dois custos, e nao um total: a descoberta e barata e previsivel, o
  -- enriquecimento e o que escapa. Somados, ninguem descobre qual estourou.
  discovery_cost_usd  numeric(10, 5) not null default 0,
  enrichment_cost_usd numeric(10, 5) not null default 0,
  -- Lease e teto de tentativa na propria linha: a descoberta paginada e ela
  -- mesma uma fila de uma linha so, como o scan da malha.
  polling_at          timestamptz,
  attempts            integer     not null default 0,
  error_message       text,
  started_at          timestamptz,
  finished_at         timestamptz,
  created_by          uuid        not null references public.users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint prospect_campaigns_name_len_chk
    check (char_length(name) between 2 and 120),
  constraint prospect_campaigns_status_chk
    check (status in ('draft', 'discovering', 'discovered', 'failed')),
  constraint prospect_campaigns_source_chk
    check (source in ('business_listings', 'serp_maps')),
  constraint prospect_campaigns_state_chk
    check (state_code ~ '^[A-Z]{2}$'),
  -- 1 a 100 km. O endpoint aceita raio maior, mas acima disso "regiao" deixa
  -- de descrever o que o SDR consegue atender.
  constraint prospect_campaigns_radius_chk
    check (radius_km >= 1 and radius_km <= 100),
  -- Teto de 1000 por campanha: e o teto de itens por chamada do provedor, e
  -- tambem o que um SDR consegue revisar antes de a lista envelhecer.
  constraint prospect_campaigns_target_chk
    check (target_count between 1 and 1000),
  constraint prospect_campaigns_categories_chk
    check (array_length(categories, 1) is not null
       and array_length(categories, 1) <= 10),
  constraint prospect_campaigns_filters_obj_chk
    check (jsonb_typeof(filters) = 'object'),
  constraint prospect_campaigns_estimate_obj_chk
    check (estimate is null or jsonb_typeof(estimate) = 'object'),
  constraint prospect_campaigns_attempts_chk
    check (attempts >= 0),
  constraint prospect_campaigns_offset_chk
    check (discovery_offset >= 0 and discovered_count >= 0),
  constraint prospect_campaigns_cost_chk
    check (discovery_cost_usd >= 0 and enrichment_cost_usd >= 0)
);

create index if not exists prospect_campaigns_recent_idx
  on public.prospect_campaigns (created_at desc);

create index if not exists prospect_campaigns_status_idx
  on public.prospect_campaigns (status)
  where status in ('discovering', 'draft');

-- A empresa descoberta.
--
-- `listing` guarda o payload cru do provedor. Custa cerca de 4 kB por linha e
-- e o que permite remapear sem recomprar quando o mapeador mudar -- foi o que
-- salvou a visibilidade quando `ai_overview_reference` entrou depois.
create table if not exists public.prospects (
  id                 uuid        primary key default gen_random_uuid(),
  campaign_id        uuid        not null references public.prospect_campaigns(id) on delete cascade,
  place_id           text,
  cid                text,
  title              text        not null,
  category           text,
  category_ids       text[],
  phone_raw          text,
  -- Normalizado por `toStoredPhone` de lib/br-documents.ts: `55` + DDD + local.
  -- E a chave de juncao mais forte que existe para achar o CNPJ, porque a base
  -- publica da Receita tambem guarda telefone. Medido: 71% a 85% preenchido.
  phone_e164         text,
  domain             text,
  url                text,
  address            text,
  -- Medido em 95% a 99% da amostra. Com o numero extraido do logradouro, e a
  -- segunda chave de juncao.
  zip                char(8),
  street_number      text,
  city               text,
  region             text,
  latitude           double precision,
  longitude          double precision,
  rating             numeric(2, 1),
  votes_count        integer,
  -- Medido em 100% da amostra, e entre 32% e 52% vem `false`. Para uma agencia
  -- de GBP e o sinal comercial mais valioso da descoberta.
  is_claimed         boolean,
  work_time          jsonb,
  attributes         jsonb,
  listing            jsonb       not null,
  -- Procedencia. O provedor e banco de dados, nao coleta ao vivo: a mediana da
  -- amostra tinha 88 dias e o maximo 925. Telefone de 2024 apresentado sem data
  -- e uma afirmacao falsa sobre hoje.
  listing_updated_at timestamptz,
  stage              text        not null default 'discovered',
  promoted_lead_id   uuid        references public.leads(id) on delete set null,
  promoted_at        timestamptz,
  dismissed_at       timestamptz,
  dismissed_reason   text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint prospects_stage_chk
    check (stage in ('discovered', 'enriching', 'enriched', 'promoted', 'dismissed')),
  constraint prospects_rating_chk
    check (rating is null or (rating >= 0 and rating <= 5)),
  constraint prospects_zip_chk
    check (zip is null or zip ~ '^\d{8}$'),
  constraint prospects_listing_obj_chk
    check (jsonb_typeof(listing) = 'object'),
  -- Promovido tem lead e data; descartado tem data. Os tres estados nao se
  -- misturam -- mesmo espirito do `leads_opportunity_fields_chk`.
  constraint prospects_stage_fields_chk check (
    (stage = 'promoted' and promoted_lead_id is not null and promoted_at is not null
       and dismissed_at is null)
    or (stage = 'dismissed' and dismissed_at is not null and promoted_lead_id is null)
    or (stage not in ('promoted', 'dismissed') and promoted_lead_id is null
       and promoted_at is null and dismissed_at is null)
  )
);

-- Nao ha unique global por `place_id`: a mesma loja aparecer em duas campanhas
-- e legitimo, e o SDR precisa ver que ja a trabalhou. "Ja e lead" e uma LEITURA
-- contra `lead_gbp_profiles.place_id` -- que ja e unico global -- feita na
-- promocao, nunca uma constraint aqui.
create unique index if not exists prospects_campaign_place_uidx
  on public.prospects (campaign_id, place_id)
  where place_id is not null;

-- Reserva para item sem `place_id`. A sondagem nao achou nenhum, mas sem esta
-- chave reprocessar o mesmo offset apos uma falha duplicaria a linha, e a
-- duplicata so apareceria na contagem da tela.
create unique index if not exists prospects_campaign_fallback_uidx
  on public.prospects (campaign_id, lower(title), coalesce(zip, ''))
  where place_id is null;

create index if not exists prospects_campaign_stage_idx
  on public.prospects (campaign_id, stage);

create index if not exists prospects_place_id_idx
  on public.prospects (place_id)
  where place_id is not null;

create index if not exists prospects_phone_idx
  on public.prospects (phone_e164)
  where phone_e164 is not null;

create index if not exists prospects_domain_idx
  on public.prospects (domain)
  where domain is not null;

alter table public.prospect_campaigns enable row level security;
alter table public.prospects enable row level security;

drop policy if exists "prospect_campaigns_select_commercial" on public.prospect_campaigns;
create policy "prospect_campaigns_select_commercial"
  on public.prospect_campaigns
  for select
  to authenticated
  using (public.is_commercial_member());

drop policy if exists "prospect_campaigns_insert_commercial" on public.prospect_campaigns;
create policy "prospect_campaigns_insert_commercial"
  on public.prospect_campaigns
  for insert
  to authenticated
  with check (public.is_commercial_member());

drop policy if exists "prospect_campaigns_update_commercial" on public.prospect_campaigns;
create policy "prospect_campaigns_update_commercial"
  on public.prospect_campaigns
  for update
  to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

drop policy if exists "prospect_campaigns_delete_commercial" on public.prospect_campaigns;
create policy "prospect_campaigns_delete_commercial"
  on public.prospect_campaigns
  for delete
  to authenticated
  using (public.is_commercial_member());

drop policy if exists "prospects_select_commercial" on public.prospects;
create policy "prospects_select_commercial"
  on public.prospects
  for select
  to authenticated
  using (public.is_commercial_member());

drop policy if exists "prospects_insert_commercial" on public.prospects;
create policy "prospects_insert_commercial"
  on public.prospects
  for insert
  to authenticated
  with check (public.is_commercial_member());

drop policy if exists "prospects_update_commercial" on public.prospects;
create policy "prospects_update_commercial"
  on public.prospects
  for update
  to authenticated
  using (public.is_commercial_member())
  with check (public.is_commercial_member());

drop policy if exists "prospects_delete_commercial" on public.prospects;
create policy "prospects_delete_commercial"
  on public.prospects
  for delete
  to authenticated
  using (public.is_commercial_member());

revoke all on table public.prospect_campaigns from anon, authenticated;
grant select, insert, update, delete on table public.prospect_campaigns to authenticated;

revoke all on table public.prospects from anon, authenticated;
grant select, insert, update, delete on table public.prospects to authenticated;
