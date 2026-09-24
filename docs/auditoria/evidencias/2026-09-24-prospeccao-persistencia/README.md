# Incidente de persistência na prospecção — 2026-09-24

## Evidência recebida

Três pesquisas autenticadas de `construction_company` em Guarulhos/SP falharam
na primeira página. O limite autorizado era 200 resultados e o orçamento US$
1,00. Cada página teve custo confirmado de US$ 0,084; a execução registrou o
mesmo total em `actual_cost_usd`. As três pesquisas ficaram `failed`, com
`fetched_count = 0`, sem candidatos, e a página terminou `failed` em
`offset:0`, também com `received_count = 0`.

IDs foram minimizados para correlacionar a evidência sem expor UUIDs completos:

| Horário UTC da criação | Run (sufixo) | Página (sufixo) | Estado | Custo da página |
|---|---|---|---|---:|
| 2026-09-24 17:48 | `1c698670` | `d4a0e144` | `failed` | US$ 0,084 |
| 2026-09-24 17:41 | `2019925c` | `f8152697` | `failed` | US$ 0,084 |
| 2026-09-23 01:27 | `3cfb4fe6` | `e537e347` | `failed` | US$ 0,084 |

O mapeamento `construction_company` foi salvo. Esses registros não confirmam a
quantidade exata devolvida pela DataForSEO nem o ponto exato da falha local.
`advanceProspectingRunAction` usa a mesma mensagem final para erro do RPC de
conclusão e exceção em normalização, busca de conflitos ou classificação. A
versão anterior não registrava o erro retornado pelo RPC.

## Reteste após a primeira migration corretiva

Após aplicar `20261005000000_prospecting_candidate_isolation.sql`, uma nova
primeira página chegou ao RPC de conclusão com 200 itens, custo confirmado de
US$ 0,084 e zero rejeições locais. O log registrou SQLSTATE `42702`
(`ambiguous_column`), provando que a falha agora está no SQL da conclusão e não
na normalização ou consulta de conflitos. A função tem variáveis PL/pgSQL com
os mesmos nomes das colunas de recibo (`received_count` e `normalized_count`),
deixando as expressões de atualização ambíguas. A migration seguinte renomeia
as variáveis locais para `v_received_count` e `v_normalized_count`.

Run e página do reteste, minimizados para correlação: `edb335bc` e `0725f6af`.

## Comportamento após a correção local

A coleta registra o estágio (`normalize`, `conflicts`, `classify` ou
`complete_rpc`), custo confirmado, quantidade de itens e código SQLSTATE/
PostgREST. A mensagem e os detalhes crus do erro não são registrados; a
constraint é extraída por whitelist, pois detalhes do PostgreSQL podem conter
valores da linha rejeitada.

Os itens com identidade ausente ou que violam limites conhecidos são contados
como rejeitados antes da consulta de conflitos. A função SQL isola somente
constraints conhecidas das tabelas de candidatos. Erros de autorização, schema,
infraestrutura e outras constraints continuam falhando a página inteira. O
recibo mantém cursor e custo atômicos; um cursor falho não é repetido
automaticamente.

## Conferência do banco

Compare a definição ativa da função com a migration local. Execute em contexto
administrativo somente leitura:

```sql
select p.oid::regprocedure as signature,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'complete_prospecting_page';
```

Reconcilie os recibos conhecidos sem retornar payload de candidatos:

```sql
select right(r.id::text, 8) as run_suffix,
       r.actual_cost_usd,
       count(p.id) as page_count,
       count(p.id) filter (where p.status = 'failed') as failed_pages,
       count(p.id) filter (where p.status = 'unknown') as unknown_pages,
       sum(p.cost_usd) filter (where p.cost_usd is not null) as receipted_cost_usd
from public.prospecting_runs r
left join public.prospecting_run_pages p on p.run_id = r.id
where right(r.id::text, 8) in ('1c698670', '2019925c', '3cfb4fe6')
group by r.id, r.actual_cost_usd
order by run_suffix;
```

Se a tabela de histórico de migrations estiver disponível ao operador:

```sql
select version
from supabase_migrations.schema_migrations
where version in (
  '20260925000000',
  '20261003000000',
  '20261004000000',
  '20261005000000'
)
order by version;
```

## Limite de validação

O operador executou uma chamada paga de reteste após a primeira migration; ela
confirmou a resposta de 200 itens, mas falhou na conclusão com SQLSTATE `42702`.
Essa tentativa já teve custo de US$ 0,084. A nova migration de desambiguação
ainda precisa ser aplicada antes de outro reteste. Uma busca posterior pode
custar até o máximo de primeira página mostrado na confirmação da tela.
