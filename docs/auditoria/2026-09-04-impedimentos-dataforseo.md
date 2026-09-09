# Impedimentos — resolvidos e remanescentes

Este documento nasceu registrando o que a auditoria não conseguia fazer sem o DataForSEO. Com a assinatura ativa e a migração concluída, a maior parte deixou de ser impedimento. O que sobrou está na segunda metade.

## Resolvido pela migração

O SerpAPI foi removido e o DataForSEO passou a ser o provider único de todas as coletas. Caíram junto:

- **A chave global de provider.** `lib/gbp-vendor/` inteiro deixou de existir. Não há mais escolha a fazer nem ramo a manter.
- **A cota mensal como limite estrutural.** O SerpAPI cobrava uma busca de plano por requisição; num plano de 5.000/mês, uma malha 11×11 consumia 121 delas. O DataForSEO cobra por requisição e a malha inteira sai por centavos.
- **A amostra de reviews por relevância.** O SerpAPI devolvia `most_relevant`, sem `owner_answer` e com `replied` fixo em zero, o que inviabilizava velocidade de avaliações, taxa de resposta e evolução de nota. O DataForSEO devolve as mais recentes, com resposta do proprietário. **A matemática saiu na onda 3** — média histórica por subtração, janelas de 30/60/90 dias e taxa de resposta —, com bloqueio explícito quando o snapshot é do SerpAPI, porque ali a subtração produziria lixo com cara de número.
- **A ausência de backlinks.** O SerpAPI não tem o produto. O DataForSEO tem, e **a onda 4 implementou**: `/backlinks/summary/live` em tabela append-only, com os gaps entrando no pilar de Website. O pilar F saiu de zero.
- **O conjunto sintético de keywords.** A visibilidade orgânica no SerpAPI era medida contra keywords que o próprio sistema inventava a partir do nome da empresa. Agora vem de `ranked_keywords`, que devolve o que o domínio de fato posiciona, com volume, dificuldade, intenção e tráfego estimado.

**A malha geográfica** passou a operar em modo híbrido: 5×5 no live, 7×7 e 11×11 na fila padrão, onde o `task_post` aceita 100 tarefas por requisição — 121 pontos saem em duas chamadas.

**O custo deixou de ser estimativa.** O campo `cost` que a API devolve em toda resposta era descartado; agora é lido, propagado e somado em `lead_gbp_grid_scans.cost_usd`. E `/v3/appendix/user_data`, que é gratuito, alimenta a página de Ferramentas com saldo, limites, uso por seção e a tabela de preços da própria conta.

## O que continua impedido

**O histórico coletado antes da migração veio todo do SerpAPI** e não é comparável com o novo. `keywordCount` significava "quantas keywords buscamos" e agora significa o footprint do domínio; `estimatedTraffic` era nulo e agora vem preenchido; a amostra de reviews era por relevância e agora é cronológica. Os dados antigos continuam legíveis de propósito — os valores `serpapi_maps`, `serpapi_organic` e `serpapi` permanecem nos tipos e nas constraints —, mas a fronteira precisa ficar visível na interface. O primeiro comparativo depois da virada vai mostrar saltos que não aconteceram no site do cliente.

**O mapeador de backlinks executou.** A coleta em `buscaorganica.com.br` trouxe
os 14 campos e todos mapearam, com `first_seen` no formato
`YYYY-MM-DD HH:MM:SS +00:00` — o mesmo que `dataForSeoTimeToIso` assume, o que
reforça a suposição do mapeador de avaliações. O que a coleta reprovou não foi o
mapeamento e sim a leitura: as regras de gap não reconheciam perfil concentrado,
e a onda 6 corrigiu isso.

**Os demais mapeadores do DataForSEO nunca executaram contra resposta real** até agora. Foram escritos contra documentação: `dataForSeoTimeToIso` assume um formato de timestamp, `mapDataForSeoReviews` assume `rating.value` aninhado e `owner_answer` como string, `mapRankedKeywordsLiveResult` assume a presença de `rank_group` e de `metrics.organic`. A primeira coleta real é também a primeira validação — e é o passo que ainda não foi feito.

**A pergunta do timestamp foi respondida duas vezes, e a segunda corrigiu a primeira.** A interface do Google mostra "2 meses atrás" para os dois lados, e a onda 5 concluiu daí que a data da resposta não existia. Existe: `owner_timestamp` está no endpoint **padrão** que já chamamos, em `yyyy-mm-dd hh:mm:ss +00:00`. A onda 7 passou a lê-lo e o tempo de resposta virou **medido**; a faixa do analista ficou como reserva para perfil ainda não recoletado. A lição é a mesma da etapa 0: o JSON tem mais que a tela, e concluir a partir da interface é concluir errado.

**Uma pergunta continua em aberto**, e a primeira coleta real responde: os items do Maps trazem `url` ou `domain` do negócio? Se sim, o domínio dos concorrentes sai sem chamada extra.

## Citações em diretórios: o SERP `site:` foi testado e reprovado

A Task 0 do plano de citações rodou em 2026-09-09 e **matou o desenho antes de
qualquer linha de código**. Três chamadas, US$ 0,029 no total.

**O operador `site:` é honrado de forma inconsistente.** Em
`"Busca Orgânica" site:facebook.com` ele valeu — 9 dos 10 orgânicos vieram do
domínio pedido. Em `"Busca Orgânica" site:apontador.com.br` ele foi **ignorado**:
voltaram Reddit, YouTube e Instagram. E as aspas não impõem correspondência
exata em nenhum dos dois.

Com a regra simples (`found` = existe resultado), o Apontador seria marcado como
encontrado por causa de um post do Reddit. Com a guarda de duas condições —
domínio do resultado casando com o diretório **e** nome da empresa no título ou
na URL — os três alvos deram `found: false`, incluindo Facebook e Instagram,
onde a empresa tem página. Falso positivo de um lado, falso negativo do outro.

**A tabela da conta não fecha a conta do SERP.** `/appendix/user_data` declara
`serp/live/advanced` a US$ 0,002 e `serp/task_post` a US$ 0,0006; as chamadas
cobraram **US$ 0,01** no live avançado do Maps e **US$ 0,003** num `task_post`
orgânico com `depth: 10`, mas **US$ 0,006** com `depth: 100`. Não é um
multiplicador único: a seção `serp` tem um preço só por método — existe
`live/advanced`, e não um por Maps ou por Orgânico — e nem motor nem
profundidade aparecem nela. A tabela serve de piso, não de orçamento, e a
calculadora passou a dizer isso na tela.

A 20 diretórios, o desenho custaria da ordem de US$ 0,06 por lead na fila, e
não os US$ 0,012 orçados.

**O que ficou validado e continua valendo:** o `task_post` em lote aceita `tag`
por tarefa e devolve o valor em `tasks[i].data.tag`, como a malha já usa; e
`task_get` é gratuito depois do post.

## Citações por backlink: medido, encerrado, e a chamada foi reaproveitada

Depois de corrigidos os dois defeitos — o filtro `["domain_from", "in", …]`, que
é inválido, e o vazio ambíguo que virava `[]` — a chamada foi rodada à mão em
2026-09-09 contra `buscaorganica.com.br`, por US$ 0,038364:

- envelope `20000`, task `20000`, `total_count: 406`, `items_count: 399`, teto
  de 1000. **Sem truncamento.**
- 399 domínios de referência distintos, casados contra os 20 diretórios do
  catálogo: **zero**.
- E nenhuma rede social no índice: não há `facebook.com`, `instagram.com` nem
  `linkedin.com` apontando para o domínio.

O `[]` estava certo. Diretório publica ficha e quase nunca emite link
rastreável — o campo "site" da ficha sai como redirecionador, é montado por
JavaScript, ou não é publicado. **Backlink responde quem linka; citação é quem
publica página sobre o negócio.** Sem os dois canais — SERP reprovado na Task 0,
backlink medido aqui — não sobra método automático, e o checklist do analista
volta a ser o único que fecha o estado. A tela diz isso.

**A chamada não foi descartada, foi reapontada.** Os mesmos 399 domínios, pelo
mesmo preço, respondem uma pergunta que tem resposta: existe rede de links
artificiais apontando para este site. No perfil medido:

- 52 dos 399 domínios com `backlink_spam_score` ≥ 30. A distribuição tem um vão
  limpo em 20–29 (347 abaixo de 20, 5 no meio, 52 acima), e o corte mora nele.
- a mesma âncora *"High Quality Dofollow Backlinks DA 50 PA 40 Premium PBN
  Network"* em **12 domínios sem relação entre si**, mais 7 com
  *"JOIN OUR TELEGRAM …/darksidelinks"* e 4 com outro canal de Telegram.
- 150, 102 e 52 domínios concentrados em três IPs.

E o `backlinks_spam_score` **do domínio**, que o resumo já trazia, marcou **2 de
100**. A regra `toxic_backlinks` estava em silêncio sobre tudo isso. O gap novo
`link_scheme_detected` exige contagem **e** proporção, e não dispara na mesma
amostra depois de removidos os suspeitos — foi conferido.

## O que nunca foi impedimento do provider

Continuam ausentes por escopo, e não mudam com a assinatura:

- **Search Console e GA4** — exigem OAuth do cliente. Sem eles não há páginas indexadas reais, cobertura, query, evento ou conversão.
- **Métricas proprietárias do GBP** — exigem OAuth do titular mais aprovação prévia do Google. Estruturalmente pós-venda.
- **Links quebrados, formulários, schema validado e deep-research** — escopo não implementado.

LGPD saiu na onda 3. **Citations saiu na onda 5**, mas por outro caminho: não há API que responda "este negócio está cadastrado no Apontador?", então virou checklist fixo preenchido pelo analista. Cobertura declarada, não medida — e a interface diz isso.
