# Verificação manual — Prospecção Business Listings

Data do roteiro: 2026-09-22  
Status geral: **CORREÇÃO DE CUSTO ESCRITA; MIGRAÇÃO `20261004000000` E EXECUÇÃO NO APP PENDENTES**

Este documento não substitui evidência. Preencha ambiente, IDs redigidos, horários, resultado observado e divergências durante a execução. Nunca cole credenciais, headers, payload bruto do fornecedor, GeoJSON completo ou dados pessoais desnecessários.

## Pré-requisitos

- [x] Aplicar `20260925000000_prospecting_business_listings.sql`, `20260925000001_leads_optional_website.sql`, `20261002000000_prospecting_category_catalog_safe_delete.sql` e `20261003000000_prospecting_force_halt.sql`. Confirmação do responsável em 2026-09-22.
- [ ] Aplicar `20261004000000_prospecting_abandoned_page_cost.sql`, criada depois dessa confirmação.
- [ ] Confirmar backup ou ambiente descartável antes da migração.
- [ ] Configurar credenciais DataForSEO somente no servidor.
- [ ] Entrar com membro comercial autenticado.
- [ ] Atualizar o catálogo gratuito de categorias.
- [ ] Registrar ambiente: `________________`.
- [ ] Registrar executor e horário: `________________`.

## 1. Inspeção estática

Status: **CONCLUÍDA POR INSPEÇÃO**

- Rotas `/prospecting` e `/prospecting/[id]`, actions de coleta/importação e componentes de UI existem.
- DTOs enviados ao navegador não incluem `boundary_geometry`, `offset_token`, `lease_owner` nem payload bruto.
- Links de site, telefone e Google Maps possuem guarda para valor ausente; ausência aparece como `—`.
- A UI usa tokens semânticos, primitives locais e ícones `react-icons/ri`.
- O polling chama uma página por vez e compartilha uma trava entre mudanças de filtro.
- A importação chama um candidato por vez, preserva falhas recuperáveis e não inicia auditorias GBP, Q&A, reviews ou posts.
- Não foram executados `git`, `typecheck`, `build`, `lint` ou `test`, conforme a regra do projeto.
- O endpoint gratuito de categorias respondeu com status `20000`, custo `0`, 5.318 categorias e uma ocorrência de `demolition_contractor`, com `business_count` 51.433.
- A busca de categorias foi corrigida para filtrar no banco, sem depender do primeiro bloco limitado pelo PostgREST, e para reconhecer o alias português `demolição`.
- Catálogo vazio passa a ser sincronizado automaticamente na primeira busca autenticada; o botão de atualização permanece como recuperação manual.

Evidência: inspeção com `rg` em `app/actions/prospecting`, `components/custom/Prospecting`, rotas protegidas e migrações.  
Divergências: a migração cria o catálogo vazio; a busca anterior filtrava em memória depois de solicitar 10.000 linhas, mas o PostgREST pode limitar a resposta a 1.000; e o safe-update do ambiente rejeitou o `DELETE` sem `WHERE` do RPC com SQLSTATE `21000`. Busca e migração corretiva `20261002000000_prospecting_category_catalog_safe_delete.sql` foram ajustadas por inspeção; compilação não foi alegada.

## 2. Geografia municipal

Status: **PENDENTE**

1. Criar pesquisa de `Demolição` em `São Paulo/SP`, categoria principal `demolition_contractor`, com limite pequeno.
2. Antes de iniciar, conferir código IBGE, centro e raio na confirmação.
3. Depois da coleta, localizar ao menos um candidato `inside`; registrar `outside` e `ambiguous` quando a amostra permitir.
4. Conferir coordenadas em fonte cartográfica oficial sem copiar o GeoJSON para a evidência.

Consulta de apoio:

```sql
select id, ibge_code, city, state_code, center_latitude, center_longitude,
       radius_km, total_count, fetched_count
from public.prospecting_runs
where id = '<RUN_ID>';

select prc.territory_class, count(*)
from public.prospecting_run_candidates prc
where prc.run_id = '<RUN_ID>'
group by prc.territory_class;
```

Run ID redigido: `________________`  
Resultado observado: `________________`  
Evidência redigida: `________________`

## 3. Categoria, paginação e custo

Status: **PENDENTE**

Tentativa autenticada inicial: run redigida `8fe01296…`, categoria `marketing_agency`, Guarulhos/SP. O fornecedor rejeitou a primeira página antes da coleta; recibo `failed`, `fetched_count = 0` e custo confirmado `US$ 0`. A documentação pública confirma `limit` máximo 1.000 e exemplifica o raio em quilômetros inteiros; o request foi ajustado para arredondar o círculo para cima e preservar a cobertura antes do geofence. Nova tentativa controlada pendente.

Incidente de gasto: uma run posterior permaneceu `collecting` com página `claimed`, sem recibo/candidatos e com `actual_cost_usd = 0`. O polling antigo reagendava após erro e o comando de pausa recusava lease ativa. As ações agora finalizam falha desconhecida, interrompem o polling e permitem pausa/cancelamento imediato (`20261003000000_prospecting_force_halt.sql`, aplicada).

Causa raiz do custo não registrado, localizada por leitura do caminho de pagamento: a chamada paga sai entre `claim_prospecting_page` e `complete_prospecting_page`, dentro de um server action dirigido pelo polling do navegador. Se a requisição morre nesse intervalo — aba fechada, navegação, queda de conexão, restart do servidor — nenhum dos dois recibos roda e a cobrança não entra em `actual_cost_usd`. Pior: vencidos os 90 s de reserva, o `claim` antigo reivindicava o **mesmo `cursor_key`** e refazia a chamada, pagando duas vezes e registrando zero. Não havia reconciliação de página abandonada em nenhum ponto do código.

Correção em `20261004000000_prospecting_abandoned_page_cost.sql`: reserva vencida sobre página `claimed` não é mais reivindicada. A página vira `unknown` com `cost_usd` nulo e a pesquisa termina em `failed`, o mesmo tratamento já dado ao envelope desconhecido — o roteiro 4 abaixo passa a cobrir também este caminho. `fail_prospecting_page` deixou de reescrever run `cancelled`/`completed`: o recibo tardio soma o gasto sem apagar o estado terminal escolhido pela pessoa. O aviso "Custo pendente de confirmação" do detalhe já cobre a run resultante.

Falhas de compilação corrigidas junto, todas do mesmo lote: `parsed.data` possivelmente indefinido dentro da closure de busca de categorias; `result.started` lido sobre o estado de erro estreito de pausar/retomar/cancelar; e `LeadWritePayload.website` opcional chegando onde a planilha exige site — a planilha voltou a recusar linha sem website com mensagem própria, que é a única regra que ela não divide com o schema compartilhado. Dois `setState` síncronos dentro de efeito viraram derivação no render. Bateria completa depois das correções: `tsc --noEmit` limpo, `eslint` com 0 erros e 32 avisos preexistentes, `node --test` com 414 passes, `next build` concluído com `/prospecting` e `/prospecting/[id]`.

1. Confirmar `demolition_contractor` como categoria principal persistida.
2. Confirmar que `total_count` permanece separado de aceitos, ambíguos, duplicados e rejeitados.
3. Somar `cost_usd` das páginas e comparar com `actual_cost_usd` da pesquisa.
4. Usar orçamento que comporte a primeira página e impeça a seguinte; confirmar pausa por `budget` antes de nova chamada.
5. Em ambiente controlado, elevar a tarifa observada antes da página seguinte; confirmar pausa `vendor_price_change` sem novo recibo.

```sql
select id, status, pause_reason, primary_category, category_names,
       total_count, fetched_count, accepted_count, ambiguous_count,
       duplicate_count, rejected_count, actual_cost_usd, budget_usd
from public.prospecting_runs
where id = '<RUN_ID>';

select status, input_offset, received_count, cost_usd
from public.prospecting_run_pages
where run_id = '<RUN_ID>'
order by created_at;
```

Custo somado: `________________`  
Custo da pesquisa: `________________`  
Resultado observado: `________________`

## 4. Envelope de custo desconhecido

Status: **PENDENTE**

1. Em chamada controlada e de baixo limite, interromper a conexão após o envio e antes do envelope ser recebido.
2. Confirmar página `unknown`, `cost_usd` nulo, aviso de custo desconhecido e cursor da pesquisa não avançado.
3. Confirmar que o polling não tenta novamente o mesmo cursor automaticamente.

```sql
select cursor_key, status, input_offset, output_offset, cost_usd,
       lease_owner, lease_expires_at
from public.prospecting_run_pages
where run_id = '<RUN_ID>'
order by created_at;
```

Resultado observado: `________________`  
Decisão humana registrada: `________________`

## 5. Concorrência e idempotência da coleta

Status: **PENDENTE**

1. Abrir a mesma pesquisa em dois navegadores autenticados.
2. Manter ambos no detalhe durante pelo menos duas páginas.
3. Confirmar uma única linha por `cursor_key`, nenhum contador duplicado e ausência de duas leases ativas.

```sql
select cursor_key, count(*)
from public.prospecting_run_pages
where run_id = '<RUN_ID>'
group by cursor_key
having count(*) > 1;
```

Esperado: zero linhas.  
Resultado observado: `________________`

## 6. Pausa, recarga e retomada

Status: **PENDENTE**

1. Pausar entre duas páginas, recarregar e confirmar que o cursor não volta ao início.
2. Retomar e concluir.
3. Confirmar categorias, tarifas, limite, orçamento e fronteira imutáveis.
4. Simular lease vencida em ambiente controlado; confirmar retomada sem recriar recibo concluído.

Resultado observado: `________________`

## 7. Lead com telefone e sem site

Status: **PENDENTE**

1. Importar candidato confirmado com telefone e sem website.
2. Abrir `/leads?lead=<ID>`, editar e usar o telefone.
3. Confirmar `—` para site ausente.
4. Tentar as quatro auditorias dependentes de site e confirmar a mensagem `Este lead não possui site para esta análise.` sem chamada paga.
5. Confirmar separadamente que a planilha ainda rejeita linha sem website.

Lead ID redigido: `________________`  
Resultado observado: `________________`

## 8. Conflito tardio e importação idempotente

Status: **PENDENTE**

1. Selecionar candidato elegível.
2. Criar um lead conflitante antes de confirmar a importação.
3. Importar e confirmar `conflict`, `relatedLeadId` e nenhuma nova linha de lead.
4. Repetir a importação de candidato já importado; confirmar o mesmo `leadId` e contagem inalterada.

Resultado observado: `________________`

## 9. Autorização e payload do navegador

Status: **PENDENTE**

1. Com outro membro ou UUID adulterado, chamar leitura, comando, revisão e importação de pesquisa fora do escopo permitido.
2. Adulterar `created_by`, custo, cursor e categorias no request; confirmar rejeição sanitizada e nenhuma mutação.
3. No painel de rede, procurar `boundary_geometry`, `offset_token`, `lease_owner`, `raw_payload`, credenciais, stack e mensagem crua do fornecedor.

Esperado: nenhum campo sensível nas respostas.  
Resultado observado: `________________`

## Fechamento

- [ ] Todos os itens pendentes acima possuem evidência redigida.
- [ ] Custos foram reconciliados.
- [ ] Divergências foram registradas e classificadas.
- [ ] A limitação de cobertura DataForSEO foi comunicada.
- [ ] A liberação foi aprovada por: `________________` em `________________`.
