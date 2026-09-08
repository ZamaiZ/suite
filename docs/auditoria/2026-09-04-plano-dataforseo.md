# Caminho com o DataForSEO configurado

> **Estado em 2026-09-08:** as etapas 1 e 2 e parte da 3 foram executadas. O
> SerpAPI foi removido, o DataForSEO é o provider único, a malha opera em modo
> híbrido e a página de Ferramentas mostra saldo, uso e calculadora a partir de
> `/v3/appendix/user_data`. A onda 3 entregou a metade da etapa 2 que roda com
> um snapshot só, mais a correção de concorrentes do Maps.
>
> **A etapa 0 continua pendente** — os mapeadores ainda não foram validados
> contra payload real, e é ela que decide se "tempo médio de resposta" existe.
> Da etapa 3 faltam backlinks, concorrentes orgânicos e âncoras.

Plano para o cenário em que a assinatura do DataForSEO está ativa: validar o que existe, tornar o DataForSEO o provider único de todas as operações que dependem de ferramenta, remover o SerpAPI e implementar a etapa final das atualizações de auditoria.

A ordem importa. Cada etapa é pré-requisito da seguinte, e a primeira não produz nenhuma funcionalidade nova — o que é justamente o ponto.

---

## Etapa 0 — Validar os mapeadores antes de escrever qualquer coisa

Nenhum mapeador do DataForSEO jamais rodou contra uma resposta real. Antes de construir em cima deles, é preciso confirmar que a forma suposta é a forma verdadeira.

Rodar uma coleta completa em **um** lead de teste e conferir, campo a campo, contra o payload cru:

- **`mapDataForSeoReviews`** — formato de `timestamp` (a função `dataForSeoTimeToIso` assume `YYYY-MM-DD HH:MM:SS +00:00`), aninhamento de `rating.value`, tipo de `owner_answer`.
- **`mapRankedKeywordsLiveResult`** — presença de `rank_group`, `keyword_info.search_volume`, `keyword_properties.keyword_difficulty`, `search_intent_info.main_intent`, e a chave `metrics.organic`.
- **`mapDataForSeoMapsRank`** — `place_id` nos items e o formato de `check_url`.
- **`google-info`, `google-qna`, `google-updates`** — os mesmos campos que os gaps consomem.

Duas perguntas específicas a responder nesse momento, porque destravam decisões que estão paradas:

1. **A resposta de reviews traz timestamp da resposta do proprietário?** Se sim, "tempo médio de resposta" vira uma linha na ingestão em vez de depender de OAuth do Business Profile. Se não, o item sai do escopo até haver acesso proprietário.
2. **Os items do Maps trazem `url` ou `domain` do negócio?** Se sim, o domínio dos concorrentes sai de graça e não precisa de uma chamada extra ao Places por concorrente.

Saída desta etapa: correções de mapeamento, se houver, e as duas respostas registradas.

---

## Etapa 1 — DataForSEO como provider único e remoção do SerpAPI

Só depois de validado. Esta etapa não adiciona capacidade — ela remove ambiguidade e reduz superfície.

**Por que primeiro:** tudo que vem depois assume DataForSEO. Manter os dois ramos enquanto se adicionam backlinks, concorrentes e matemática de reputação dobraria a superfície de cada feature nova, e o ramo SerpAPI seria escrito para ser apagado em seguida.

**O que sai:** `lib/serpapi/` inteiro (714 linhas), `lib/gbp-vendor/` inteiro, `lib/leads/visibility-seeds.ts` e `lib/leads/visibility-organic-parse.ts` — que existem apenas para gerar e interpretar o conjunto sintético de keywords do caminho SerpAPI. Mais a interface de escolha de provider em `ToolsSettings` e a chave `app_settings`. Ordem de 850 linhas.

**O que muda:** o ramo `else` de `analyze-visibility.ts`, `check-gbp-ranking.ts` e `enrich-gbp-profile.ts` desaparece; `resolveGbpDataProvider` some e as actions passam a exigir credencial DataForSEO diretamente.

**A armadilha, e ela é a mesma da onda 1.** `VisibilitySource` inclui `"serpapi_organic"` e `GbpRankSource` inclui `"serpapi_maps"`. Se esses valores saírem dos tipos, `readVisibilitySnapshot` e `readRankCheck` passam a devolver `null` para as linhas antigas — e como as tabelas agora são append-only, isso **apaga o histórico** dessas coletas na leitura.

Os valores precisam continuar **legíveis** mesmo depois de deixarem de ser **produzidos**. O mesmo princípio dos campos opcionais da coleta ampliada: o leitor tolera o passado, o escritor só produz o presente.

**Consequência a documentar, não a esconder:** snapshots SerpAPI e DataForSEO não são comparáveis entre si. `keywordCount` significa coisas diferentes, `estimatedTraffic` é nulo num e preenchido no outro, e a amostra de reviews é cronológica num e por relevância no outro. A interface precisa marcar a fronteira, senão o primeiro comparativo depois da virada vai mostrar um salto que não aconteceu no site do cliente.

---

## Etapa 2 — A matemática de reputação

> **Feita na onda 3**, em `lib/leads/gbp-reputation.ts`, com as três guardas e a
> regra de apresentação abaixo. A metade que depende de segundo snapshot
> continua pendente, e o tempo de resposta segue preso na etapa 0.

**Funciona com um único snapshot**, sobre o que já está gravado:

- **Média histórica por subtração.** A distribuição por estrela dá a soma exata `S = 1n₁ + … + 5n₅`; as 50 mais recentes dão `S₅₀`. A média do resto é `(S − S₅₀) / (N − 50)`. Isso permite dizer "nas 50 mais recentes a média é 4,1; nas 380 anteriores era 4,6" sem precisar de histórico nenhum — o achado mais comercial do conjunto.
- **Velocidade e frequência** — reviews nos últimos 30/60/90 dias e a taxa da janela coberta.
- **Taxa de resposta** — `replied / sampled`.
- **Tempo de resposta** — se e somente se a etapa 0 confirmar o timestamp.

**Três guardas obrigatórias**, todas identificadas antes de escrever:

1. **Bloquear quando `sortBy !== "newest"`.** Nos snapshots SerpAPI a subtração produziria lixo com aparência de número.
2. **Dessincronia de fonte.** A distribuição vem de `my_business_info` e as reviews de um job separado, disparado depois. Se `S₅₀ > S` ou `N ≤ 50`, não calcular e dizer por quê.
3. **Reviews sem nota.** `rating` pode ser `null`; elas não entram em `S₅₀` nem no divisor.

E uma regra de apresentação: **toda métrica de janela declara a janela que mediu.** "12 nos últimos 90 dias, amostra cobre 4 meses" — nunca um número absoluto. Cinquenta reviews cobrem três semanas num perfil grande e três anos num pequeno; sem declarar, o comparativo futuro compara períodos diferentes.

**Depende de segundo snapshot** — nasce escuro e acende conforme cada lead for recoletado:

- Evolução de nota média e de volume de avaliações
- Reviews removidas, que só são detectáveis comparando dois snapshots

Vale separar as duas metades na entrega, com estado vazio explicando a espera. Se subirem juntas, metade da tela dirá "sem histórico" por semanas e parecerá defeito.

---

## Etapa 3 — Autoridade e concorrência

**Backlinks — feito na onda 4.** `/backlinks/summary/live` em
`lead_backlink_audits` append-only, com seis gaps contando para o pilar de
**Website** (não um quinto pilar) e o card no passo de Website. A cobertura do
plano se confere na tela de Ferramentas, que já lê
`backlinks_subscription_expiry_date` de `/appendix/user_data`.

Duas observações que continuam valendo: backlinks enxerga apenas citação **com
link** — a citação local clássica, NAP num diretório sem link, não aparece, então
"Diretórios / citações locais" fica meio atendido; e `summary` devolve contagens,
não a lista de domínios, que exige outro endpoint.

**Concorrentes.** As duas primeiras mudanças já saíram na onda 3: o teto subiu para 5 na checagem avulsa e o filtro que exigia o cliente no Top 20 caiu, com a seleção unificada num construtor só ao lado da malha. O que sobrou é orgânico.

**Correção deste plano.** A versão anterior mandava "parar de descartar a SERP orgânica em `findOrganicRankForDomain`". Essa função **não existe mais** — saiu junto com o SerpAPI, e com `ranked_keywords` não há SERP para descartar: o endpoint devolve só o que o próprio domínio posiciona. Concorrente orgânico agora é `/dataforseo_labs/google/competitors_domain/live`, endpoint novo e chamada nova, não reaproveitamento.

**Modelo:** concorrente orgânico não tem onde morar. `lead_gbp_rank_checks.competitors` guarda os do Maps; `lead_visibility_audits` só guarda keywords do próprio domínio. Precisa de tabela, append-only, com `captured_at`.

Comparação de keywords em comum, participação de visibilidade e páginas que cada concorrente usa para ranquear são outro endpoint do Labs — não saem do que já é chamado.

**Âncoras 5–6.** O teto de 3 está travado em três lugares, não quatro: `GBP_RANK_KEYWORDS_MAX`, a constraint `cardinality(rank_keywords) <= 3` e a cópia "Máximo de 3 termos" em `LeadGbpRankBlock`. O zod de `lib/validations/lead-gbp.ts` importa a constante e acompanha sozinho. Exige migration — e multiplica o custo da malha, que é pontos × âncoras.

**Consolidação da malha geográfica.** A malha já existe e roda em SerpAPI (`lead_gbp_grid_scans`, `lib/leads/gbp-grid.ts`, `LeadGbpGridSection`). Consolidá-la no DataForSEO tem três itens, nenhum deles estrutural:

1. **Migrar para a fila de tarefas.** Hoje o formato de execução é polling em lotes síncronos, escolhido por funcionar nos dois providers. No DataForSEO isso cairia na faixa `live`, a mais cara. Com `task_post`/`task_get` o custo por ponto despenca e a latência maior não incomoda, porque a interface já opera por polling. O padrão já existe no projeto, nas reviews e nos posts.
2. **Derivar o zoom do espaçamento.** Está fixo em 15 nos dois providers (`GBP_GRID_ZOOM`, `serpApiMapsLl`, `dataForSeoMapsCoordinate`). A linha do scan já guarda o zoom usado, então scans antigos permanecem distinguíveis dos novos quando isso mudar.
3. **Adicionar o ramo do provider.** A coleta por ponto hoje é só `fetchSerpApiGridPoint`. O equivalente em DataForSEO entra ao lado, atrás do mesmo ponto de chamada — e o ramo SerpAPI sai inteiro quando a etapa 1 deste plano acontecer.

A tabela já aceita `dataforseo_maps` em `source`, então nenhuma migration é necessária para a consolidação.

---

## Decisões que precisam sair antes da etapa 3

**Onde autoridade e concorrência entram no diagnóstico.** Os pilares são `google`, `website`, `presence` e `visibility`. Backlinks e concorrentes não têm slot. Ou vira um quinto pilar de autoridade — e aí mexe em scorecard, PDF, prosa e `diagnosis-themes` — ou entra dentro de `visibility`, que é defensável e custa quase nada. **Sem essa decisão a etapa 3 não tem spec.**

**Teto de custo por lead.** Backlinks, detalhes de concorrente e uma eventual malha geográfica multiplicam chamadas. Com 5–6 âncoras, cada ponto extra de malha custa 5–6 requisições. Definir o teto decide se a malha entra.

**Comparabilidade entre providers.** Descartar os snapshots SerpAPI, marcá-los como não-comparáveis, ou exibi-los com ressalva.

---

## Ordem e resumo

| Etapa | Entrega | Bloqueia |
|---|---|---|
| 0 · Validar mapeadores | correções + 2 respostas | tudo |
| 1 · Provider único | −850 linhas, sem capacidade nova | 2 e 3 |
| 2 · Matemática de reputação | 4 métricas com um snapshot; 2 com histórico | — |
| 3 · Autoridade e concorrência | backlinks, 5 concorrentes, âncoras 5–6, consolidação da malha | decisão de pilar |

A etapa 0 é a que costuma ser pulada e a que mais custa quando falha: ela é a única que pode invalidar tudo que vier depois. As etapas 2 e 3 são independentes entre si e podem correr em paralelo depois da 1.
