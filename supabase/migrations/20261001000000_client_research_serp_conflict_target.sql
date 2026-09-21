-- Corrige o alvo de conflito da fila de SERP.
--
-- A `20260930000000` criou o indice unico sobre a EXPRESSAO
-- `(run_id, lower(keyword))`. O `upsert` do PostgREST declara o alvo por
-- COLUNA (`on_conflict=run_id,keyword`), e o Postgres so casa a especificacao
-- com uma constraint ou indice sobre as mesmas colunas -- indice sobre
-- expressao nao serve.
--
-- O sintoma foi silencioso do lado de fora: `42P10 there is no unique or
-- exclusion constraint matching the ON CONFLICT specification`. A action
-- devolvia a mensagem de "fila nao pode ser criada" **depois** de a expansao
-- ja ter sido cobrada, e nenhuma linha era gravada.
--
-- A protecao contra caixa diferente nao se perde: `buildCandidatePool` ja
-- deduplica ignorando caixa e acento antes de qualquer escrita. O indice existe
-- para corrida entre duas execucoes simultaneas, e para isso a coluna basta.

drop index if exists public.client_research_serp_tasks_run_keyword_uidx;

create unique index if not exists client_research_serp_tasks_run_keyword_uidx
  on public.client_research_serp_tasks (run_id, keyword);
