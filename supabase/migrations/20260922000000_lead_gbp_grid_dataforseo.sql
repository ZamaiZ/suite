-- Malha no DataForSEO: modo de execução e custo real.
--
-- `mode` distingue a coleta live (5×5, resposta em segundos) da fila padrão
-- (7×7 e 11×11, ~3× mais barata). `cost_usd` acumula o custo que a própria API
-- devolve em cada resposta — antes descartado, agora somado por scan.
--
-- `task_ids` guarda o mapa de `tag` -> `task_id` do envio em lote, para que o
-- poll saiba o que buscar sem manter índice paralelo.

alter table public.lead_gbp_grid_scans
  add column if not exists mode text not null default 'live',
  add column if not exists cost_usd numeric(12,6) not null default 0,
  add column if not exists task_ids jsonb not null default '{}'::jsonb;

do $$
begin
  alter table public.lead_gbp_grid_scans
    add constraint lead_gbp_grid_scans_mode_chk
    check (mode in ('live', 'queued')) not valid;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.lead_gbp_grid_scans
    add constraint lead_gbp_grid_scans_cost_chk
    check (cost_usd >= 0) not valid;
exception
  when duplicate_object then null;
end $$;

alter table public.lead_gbp_grid_scans
  validate constraint lead_gbp_grid_scans_mode_chk,
  validate constraint lead_gbp_grid_scans_cost_chk;

-- O SerpAPI deixa de ser produzido, mas os scans antigos continuam legíveis:
-- a constraint segue aceitando o valor histórico.
alter table public.lead_gbp_grid_scans
  drop constraint if exists lead_gbp_grid_scans_source_chk;

alter table public.lead_gbp_grid_scans
  add constraint lead_gbp_grid_scans_source_chk
    check (source in ('serpapi_maps', 'dataforseo_maps'));
