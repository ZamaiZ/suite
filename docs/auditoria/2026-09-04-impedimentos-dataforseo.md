# Impedimentos — resolvidos e remanescentes

Este documento nasceu registrando o que a auditoria não conseguia fazer sem o DataForSEO. Com a assinatura ativa e a migração concluída, a maior parte deixou de ser impedimento. O que sobrou está na segunda metade.

## Resolvido pela migração

O SerpAPI foi removido e o DataForSEO passou a ser o provider único de todas as coletas. Caíram junto:

- **A chave global de provider.** `lib/gbp-vendor/` inteiro deixou de existir. Não há mais escolha a fazer nem ramo a manter.
- **A cota mensal como limite estrutural.** O SerpAPI cobrava uma busca de plano por requisição; num plano de 5.000/mês, uma malha 11×11 consumia 121 delas. O DataForSEO cobra por requisição e a malha inteira sai por centavos.
- **A amostra de reviews por relevância.** O SerpAPI devolvia `most_relevant`, sem `owner_answer` e com `replied` fixo em zero, o que inviabilizava velocidade de avaliações, taxa de resposta e evolução de nota. O DataForSEO devolve as mais recentes, com resposta do proprietário. **A matemática saiu na onda 3** — média histórica por subtração, janelas de 30/60/90 dias e taxa de resposta —, com bloqueio explícito quando o snapshot é do SerpAPI, porque ali a subtração produziria lixo com cara de número.
- **A ausência de backlinks.** O SerpAPI não tem o produto. O DataForSEO tem — falta implementar, mas deixou de ser impossível.
- **O conjunto sintético de keywords.** A visibilidade orgânica no SerpAPI era medida contra keywords que o próprio sistema inventava a partir do nome da empresa. Agora vem de `ranked_keywords`, que devolve o que o domínio de fato posiciona, com volume, dificuldade, intenção e tráfego estimado.

**A malha geográfica** passou a operar em modo híbrido: 5×5 no live, 7×7 e 11×11 na fila padrão, onde o `task_post` aceita 100 tarefas por requisição — 121 pontos saem em duas chamadas.

**O custo deixou de ser estimativa.** O campo `cost` que a API devolve em toda resposta era descartado; agora é lido, propagado e somado em `lead_gbp_grid_scans.cost_usd`. E `/v3/appendix/user_data`, que é gratuito, alimenta a página de Ferramentas com saldo, limites, uso por seção e a tabela de preços da própria conta.

## O que continua impedido

**O histórico coletado antes da migração veio todo do SerpAPI** e não é comparável com o novo. `keywordCount` significava "quantas keywords buscamos" e agora significa o footprint do domínio; `estimatedTraffic` era nulo e agora vem preenchido; a amostra de reviews era por relevância e agora é cronológica. Os dados antigos continuam legíveis de propósito — os valores `serpapi_maps`, `serpapi_organic` e `serpapi` permanecem nos tipos e nas constraints —, mas a fronteira precisa ficar visível na interface. O primeiro comparativo depois da virada vai mostrar saltos que não aconteceram no site do cliente.

**Os mapeadores do DataForSEO nunca executaram contra resposta real** até agora. Foram escritos contra documentação: `dataForSeoTimeToIso` assume um formato de timestamp, `mapDataForSeoReviews` assume `rating.value` aninhado e `owner_answer` como string, `mapRankedKeywordsLiveResult` assume a presença de `rank_group` e de `metrics.organic`. A primeira coleta real é também a primeira validação — e é o passo que ainda não foi feito.

**Duas perguntas seguem em aberto**, ambas respondidas pela primeira coleta: a resposta de reviews traz timestamp da resposta do proprietário? Se sim, "tempo médio de resposta" vira uma linha na ingestão em vez de depender de OAuth do Business Profile. E os items do Maps trazem `url` ou `domain` do negócio? Se sim, o domínio dos concorrentes sai sem chamada extra.

## O que nunca foi impedimento do provider

Continuam ausentes por escopo, e não mudam com a assinatura:

- **Search Console e GA4** — exigem OAuth do cliente. Sem eles não há páginas indexadas reais, cobertura, query, evento ou conversão.
- **Métricas proprietárias do GBP** — exigem OAuth do titular mais aprovação prévia do Google. Estruturalmente pós-venda.
- **LGPD, citations, links quebrados, formulários, schema validado e deep-research** — escopo não implementado.
