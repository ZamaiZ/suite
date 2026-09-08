-- Malha: lease do poll, tamanho 3x3 e reaper de scan obsoleto.
--
-- `polling_at` é o lease: um poll por vez mexe na linha. Sem ele, dois ticks
-- sobrepostos do navegador passavam pela trava otimista antiga (que comparava
-- o status contra ele mesmo), enfileiravam as tarefas duas vezes — custo em
-- dobro — e perdiam escrita em `points`, `processed` e `cost_usd`. O próprio
-- timestamp serve de token: quem escreve confere que o lease ainda é seu.
--
-- A malha 3x3 existe para exercitar o caminho de fila por centavos. Nove
-- pontos cobrem envio em lote, gravação dos identificadores, coleta e
-- transição de status sem gastar o preço de uma 11x11.

alter table public.lead_gbp_grid_scans
  add column if not exists polling_at timestamptz;

-- A constraint de tamanho precisa ser substituída, não acrescentada: mesmo
-- caminho que `20260922000000` usou para `source`.
alter table public.lead_gbp_grid_scans
  drop constraint if exists lead_gbp_grid_scans_size_chk;

do $$
begin
  alter table public.lead_gbp_grid_scans
    add constraint lead_gbp_grid_scans_size_chk
    check (size in (3, 5, 7, 11)) not valid;
exception
  when duplicate_object then null;
end $$;

alter table public.lead_gbp_grid_scans
  validate constraint lead_gbp_grid_scans_size_chk;

-- O índice único parcial só libera a keyword quando o scan sai de queued /
-- running. Uma aba fechada no meio prendia a keyword para sempre; o reaper
-- procura por aqui os scans ativos parados antes de iniciar outra malha.
create index if not exists lead_gbp_grid_scans_stale_idx
  on public.lead_gbp_grid_scans (updated_at)
  where status in ('queued', 'running');
