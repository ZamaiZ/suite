# Malha Geográfica do Perfil no Maps — Design

## Objetivo

Mostrar em que posição o perfil do cliente aparece no Google Maps para uma keyword, ponto a ponto, dentro de uma malha centrada na coordenada do perfil. Hoje o ranking é checado num único ponto — a coordenada do próprio perfil —, o que responde "apareço aqui" e nada sobre o entorno.

O objetivo desta entrega é **visualizar**, não analisar em profundidade. A leitura competitiva que a malha permite fica como dado guardado, não como tela.

## Decisões aprovadas

- Malha quadrada de **5×5 (padrão), 7×7 ou 11×11** pontos. O custo em buscas é `size²` e fica visível na interface antes de rodar.
- **Raio de 1 a 25 km**, padrão 5. O raio é a **meia-largura do quadrado**, não o círculo circunscrito: os cantos ficam a `raio·√2` do centro.
- **Uma keyword por scan**, escolhida entre as que já estão em `rank_keywords`. Rodar as três de uma vez triplicaria o custo para responder três perguntas que serão lidas separadamente.
- **Zoom fixo em 15** na requisição. Não é o zoom da tela — é o que o buscador usa para decidir a área considerada em cada ponto, e o valor anterior (17) está acima do recomendado.
- **Apenas SerpAPI** nesta entrega. O DataForSEO fica para a consolidação, junto com a migração para a fila de tarefas.
- **Concorrentes por ponto guardados desde já** — o top 3 daquele ponto, independentemente de o cliente aparecer. A resposta já os traz; descartar obrigaria a reescanear, que é a parte cara.
- **A malha é expansível dentro do bloco de ranking**, não um passo próprio da trilha de auditoria.
- Snapshot append-only, seguindo o padrão estabelecido: cada scan é uma linha nova e nenhum apaga o anterior.

## Fora de escopo

- Malha para o Local Pack da busca web — é outro endpoint.
- Malha multi-keyword numa rodada.
- Tela de comparação competitiva. O dado é capturado; a visualização vem depois.
- Comparação entre dois scans no tempo. O append-only já deixa possível.
- DataForSEO, incluindo a migração para `task_post` e a derivação do zoom a partir do espaçamento — ambos registrados como dívida no plano de consolidação.
- Alterar o teto de três keywords do perfil.

## Arquitetura

### Economia como restrição de projeto

Cada ponto é uma busca do plano SerpAPI. Uma malha 11×11 custa 121 buscas; num plano de 5.000 por mês isso é 41 scans para a carteira inteira. Quatro decisões saem daí e estão embutidas no desenho:

- **A cota é conferida uma vez, antes do primeiro ponto**, com `requireSerpApiQuota(size²)`.
- **Retomar, nunca reiniciar.** Os pontos são gravados conforme chegam, e um retry busca apenas os que continuam pendentes. Uma falha no ponto 47 não pode custar os 46 anteriores.
- **Falha parcial preserva o que foi pago.** Se a cota acabar ou a API errar no meio, o scan termina como `partial` e o mapa exibe o que veio.
- **Trava contra disparo duplo** por índice único parcial: não existe um segundo scan `queued` ou `running` para o mesmo perfil e keyword.

E uma economia que cai de graça: numa malha de tamanho ímpar, **o ponto central é exatamente a coordenada do perfil** — a mesma que `check-gbp-ranking` consulta hoje. O scan grava esse resultado também em `lead_gbp_rank_checks`, mantendo o bloco de ranking atualizado sem uma chamada paga adicional.

### Modelo

`lead_gbp_grid_scans`, append-only, uma linha por scan com a malha inteira em `points`. Cento e vinte e um pontos dão cerca de 10 KB de jsonb — mesma ordem do `crawl` que já é gravado.

Estado e progresso moram na própria linha (`status`, `processed`, `total`) em vez de numa tabela de jobs: aqui a malha é o dado e o progresso ao mesmo tempo, e separá-los criaria uma segunda tabela sem ganho.

Cada ponto carrega estado próprio — `pending`, `done` ou `failed` —, o que distingue "ainda não coletado" de "coletado e o cliente não aparece". Sem isso, uma falha no meio deixaria buracos indistinguíveis de ausências reais.

A linha guarda `source` e `zoom` usados. Quando a consolidação no DataForSEO acontecer, é o que permitirá saber quais scans antigos são comparáveis com os novos — o mesmo problema de comparabilidade já mapeado na visibilidade orgânica.

### Geometria

Espaçamento `2R/(size−1)`. Deslocamento em graus por aproximação equirretangular, com `111,32 km` por grau de latitude e `111,32·cos(lat)` por grau de longitude. Para raios abaixo de 25 km o erro é irrelevante.

A linha 0 é o topo (norte) e a coluna 0 é a esquerda (oeste), para que a ordem de leitura da matriz corresponda à leitura do mapa.

### Execução

Formato único, que funciona no SerpAPI hoje e no DataForSEO depois sem reescrita: uma action inicia o scan e uma action de poll processa um lote a cada chamada.

O poll reivindica o scan com trava otimista — o mesmo `.eq("status", …)` usado nos jobs de PageSpeed —, o que serializa a escrita e torna seguro o read-modify-write do jsonb. Cada chamada processa até dez pontos com concorrência quatro, grava e devolve o progresso.

Efeito colateral desejado: **a malha preenche na tela enquanto roda**, que é como a ferramenta de referência se comporta.

### Coleta por ponto

Uma função nova ao lado de `fetchSerpApiMapsRank`, com duas diferenças: recebe o zoom em vez de fixá-lo, e captura o **top 3 daquele ponto sem filtrar pela posição do cliente**. A função atual só guarda concorrentes quando o cliente aparece — na malha, o ponto onde ele não aparece é exatamente aquele em que saber quem está lá interessa.

`serpApiMapsLl` ganha um parâmetro de zoom com padrão 17, de modo que a chamada existente continua idêntica.

### Métricas

As três do vocabulário padrão, derivadas dos pontos sem custo adicional:

- **ARP** — média das posições onde o perfil aparece
- **ATRP** — média sobre todos os pontos, contando ausência como `GBP_MAPS_DEPTH + 1`
- **SoLV** — percentual de pontos em que aparece no top 3

### Interface

O mapa reaproveita o carregador e os estilos de `lib/google-maps/`, no mesmo formato de `BriefingServiceRadiusMapCanvas`: marcador central do perfil e um marcador circular numerado por ponto, com faixa de cor por posição.

Os controles — keyword, tamanho, raio, prévia de custo e progresso — expandem dentro de `LeadGbpRankBlock`.

## Arquivos previstos

- Criar `supabase/migrations/*_lead_gbp_grid_scans.sql`.
- Criar `lib/leads/gbp-grid.ts` — constantes, tipos, geometria, leitura e métricas.
- Criar `app/actions/leads/start-gbp-grid-scan.ts` e `app/actions/leads/poll-gbp-grid-scan.ts`.
- Criar `lib/validations/lead-gbp-grid.ts`.
- Criar `components/custom/LeadGbpPanel/LeadGbpGridMap.tsx`.
- Modificar `lib/serpapi/google-maps-rank.ts` — zoom parametrizado e coleta por ponto.
- Modificar `app/actions/leads/gbp-access.ts` — carregamento do scan mais recente.
- Modificar `components/custom/LeadGbpPanel/LeadGbpRankBlock.tsx` — controles e expansão.
- Modificar `app/actions/leads/index.ts` — exportar as actions novas.

## Critérios de aceitação

- Iniciar uma malha 5×5 debita a verificação de cota uma única vez, por 25 buscas, antes do primeiro ponto.
- Um segundo disparo para o mesmo perfil e keyword, com um scan em andamento, é recusado sem consumir busca.
- Interromper e repetir o poll retoma nos pontos pendentes e não refaz os já concluídos.
- Uma falha de API no meio do scan deixa o registro em `partial`, preserva os pontos já coletados e informa o motivo.
- O ponto central de uma malha ímpar coincide com a coordenada do perfil e é gravado também em `lead_gbp_rank_checks`.
- Um ponto onde o perfil não aparece guarda `position` nula e ainda assim o top 3 daquele ponto.
- O mapa exibe o marcador do perfil ao centro e um marcador numerado por ponto, preenchendo conforme o scan avança.
- ARP, ATRP e SoLV são exibidos e batem com os pontos coletados.
- Rodar a malha duas vezes produz dois registros, e a interface mostra o mais recente.
- A linha do scan guarda `source` e `zoom` utilizados.
