# Onda 0 da Presença em IA — a metade gratuita

`2026-09-10-presenca-em-ia-design.md` abriu a onda 0 com cinco perguntas, e
avisou que a primeira podia reprovar metade do desenho:

> **`GET /appendix/user_data` — a conta tem a seção `ai_optimization`
> liberada, e a que preço?** A evidência de 2026-09-10 registrou
> `labs_prices_raw_keys` e só listou `dataforseo_labs`.

Tem. **Sete chamadas, HTTP 200 em todas, US$ 0,00 no total** — as quatro
perguntas de cobertura são gratuitas por tabela, e a tabela confirmou. Nenhuma
reprovação.

Evidência em `evidencias/2026-09-10-presenca-em-ia/`, com quatro scripts que
reproduzem tudo: `probe.mjs` (grátis), `probe-pago.mjs`, `probe-pago-2.mjs`
(as correções) e `cortar-cru.mjs`.

**Sobre o que ficou versionado.** A onda 0 da visibilidade fixou a regra — cru
grande não se versiona, o script o regera. Aqui há uma tensão que lá não havia:
`18-llm_mentions-lead.json` é a única observação da forma do dataset para um
lead brasileiro, e regerá-lo custa US$ 0,107. Por isso `cortar-cru.mjs` corta o
**volume** e preserva a **forma**: o envelope inteiro, os três primeiros itens de
cada lista, e `_items_original_length` ao lado — sem ele, uma lista de três itens
mentiria sobre quantos vieram. De 1,4 MB para 656 KB, com os dezessete campos do
`serp_item` e os quinze do item de `llm_mentions` intactos.

De `user_data` saíram `login`, `rates` e `money.limits`; a árvore de preço fica,
crua e achatada, em `01-precos-ai-optimization.json` — é ela que orça as ondas 2
e 3.

## O que foi medido

| chamada | custo | veredito |
|---|---|---|
| `GET /appendix/user_data` | grátis | **`ai_optimization` está na conta**, com 61 linhas de preço |
| `GET /ai_optimization/llm_mentions/locations_and_languages` | grátis | 94 locations, **Brasil (2076) com `pt`** |
| `GET /ai_optimization/ai_keyword_data/locations_and_languages` | grátis | 94 locations, **Brasil (2076) com `pt`** |
| `GET /ai_optimization/{4 plataformas}/llm_responses/models` | grátis | as quatro respondem com lista |

Saldo da conta na medição: **US$ 48,52**.

## 0. A assinatura de `llm_mentions` é um campo próprio, e está ativa

`user_data` devolve sete chaves no resultado, e duas delas não são preço nem
saldo:

```
backlinks_subscription_expiry_date    "2050-01-01 00:00:00 +00:00"
llm_mentions_subscription_expiry_date "2050-01-01 00:00:00 +00:00"
```

**`llm_mentions` tem assinatura separada do saldo**, como backlinks já tinha, e
a nossa está ativa sem data prática de expiração. Isso é diferente de estar na
tabela de preços: a tabela diz quanto custa, a assinatura diz se pode chamar.
Uma sem a outra daria erro de permissão com cara de dado vazio.

**Consequência para a página de Ferramentas:** hoje ela lê saldo, limites, uso e
preço. Esses dois campos de expiração **não são lidos** por `usage.ts`, e são
exatamente o tipo de coisa que só aparece quando quebra — assinatura vencida
viraria "não foi possível coletar" sem dizer por quê. Vale ler os dois e mostrar
na tela, e é trabalho de minutos porque a chamada já é feita.

## 1. A seção está liberada, e o preço muda a ordem das ondas

A spec orçou a onda 2 como *"duas chamadas baratas"* e a onda 3 — a sondagem —
como a cara. **A tabela da conta inverte isso.** Comparando com o Labs, que a
onda 0 da visibilidade já fechou na vírgula:

| operação | por requisição | por resultado | custo real do caso |
|---|---|---|---|
| `dataforseo_labs/ranked_keywords/live` *(baliza)* | 0,012 | 0,00012 | **0,0252** com 110 linhas |
| `ai_keyword_data/keywords_search_volume/live` | **0,01** | **0,0001** | **0,021** com 110 keywords |
| `llm_responses/live` | **0,0006** | — | **0,019** em 32 execuções + repasse do LLM |
| `llm_responses/task_post` | 0,0002 | — | fila, com caução de 0,01 por tarefa |
| `llm_mentions/*/live` | **0,10** | **0,001** | **0,20** com 100 linhas |
| `llm_scraper/live/advanced` | 0,004 | — | preço fixo, sem repasse |

Três consequências, todas de decisão:

**A demanda em IA é mais barata que a coleta de visibilidade que já rodamos.**
US$ 0,021 pelas mesmas 110 keywords. Não é "chamada paga a mais"; é a chamada
mais barata da auditoria inteira.

**A sondagem em LLM não é a parte cara.** Trinta e duas execuções custam
US$ 0,019 de taxa — **menos de um décimo de uma única chamada de
`llm_mentions`**. O que sobe o custo ali é o repasse do modelo, que não está na
tabela e só aparece em `money_spent`. A ressalva de `usage.ts` vale aqui em
cheio: **a tabela é piso, não orçamento.**

**`llm_mentions` é o item caro, e é o único.** US$ 0,10 por requisição é oito
vezes o Labs, antes de contar linha. Com três chamadas por lead — citações,
concorrência e as menções em si — a etapa passaria de US$ 0,40. Isso decide a
forma: **botão pago separado, com custo visível na linha**, no padrão da malha
geográfica, nunca dentro da coleta base.

## 2. As variantes `_lite` não são mais baratas

Esperava-se economia; não há. `target_metrics_lite`, `top_mentioned_domains_lite`,
`top_mentioned_pages_lite`, `top_mentioned_brands_lite` e
`top_mentioned_brand_categories_lite` cobram **exatamente o mesmo** que as
versões completas: 0,10 por requisição e 0,001 por linha.

"Lite" ali é funcionalidade reduzida, não preço reduzido. Escolher a lite para
economizar seria perder campo sem ganhar nada — o tipo de decisão que passaria
despercebida por meses.

## 3. A tabela da conta lista endpoints que a documentação não menciona

A documentação do overview lista `target_metrics` e `multi_target_metrics`. A
tabela da conta tem esses **e mais quatro** que o overview não cita:

```
llm_mentions/aggregated_metrics/live
llm_mentions/cross_aggregated_metrics/live
llm_mentions/search/live
llm_mentions/top_domains/live
llm_mentions/top_pages/live
```

`search/live` e `search_mentions/live` são entradas **separadas**, com o mesmo
preço. `top_domains` e `top_mentioned_domains` também. Não dá para saber pela
tabela qual par é sinônimo, qual é o nome antigo e qual faz outra coisa — preço
igual não é prova de comportamento igual.

**Fica em aberto, e a metade paga responde.** Chamar o endpoint errado a
US$ 0,10 a tentativa é o motivo de a pergunta estar registrada aqui em vez de
ser resolvida no código.

## 4. Brasil e português passaram nos dois datasets

`llm_mentions` e `ai_keyword_data` devolvem **94 locations cada**, e Brasil
aparece em ambas como `location_code: 2076` com `available_languages: ["pt"]`.

Isso derruba a leitura da spec de que `llm_mentions` seria inútil para lead
brasileiro. A trava documentada — *"`chat_gpt` data is available for the
`United States` and `English` only"* — vale para a plataforma `chat_gpt` e para
o dataset de `brand_entities`. **`platform: google` não a carrega.**

O que segue reprovado é só a via de marca pré-extraída: Competitor Dominance
por `brand_entities` continua EUA/inglês. O que passa a existir é a mesma tabela
por **casamento de nome na resposta**, via `cross_aggregated_metrics` /
`multi_target_metrics` com `keyword_entity`, `search_scope: ["answer"]` e
`match_type: "word_match"` — que é exatamente o desenho que a spec já aprovou
para a sondagem: casar contra três listas que já pagamos (nome do lead,
`gbp-grid-competitors`, `/backlinks/competitors/live`).

**Ressalva que não se mede aqui:** cobertura de location não é cobertura de
dado. Brasil estar na lista não prova que o dataset tenha menção de um negócio
local brasileiro. A pergunta 7 da metade paga é essa.

## 5. Os modelos, e por que eles ficam gravados

As quatro plataformas responderam. Os topos de cada uma na medição:

| plataforma | modelos no topo da lista |
|---|---|
| `chat_gpt` | `gpt-5.6-terra`, `gpt-5.6-sol`, `gpt-5.6-luna`, `gpt-5.5`, `gpt-5.4-*` |
| `claude` | `claude-sonnet-5`, `claude-opus-5`, `claude-haiku-4-5`, `claude-fable-5-1` |
| `gemini` | `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.5-flash-lite` |
| `perplexity` | `sonar-reasoning-pro`, `sonar-pro`, `sonar` |

`llm_responses/live` cobra a mesma taxa nas quatro — **não há linha por
plataforma na tabela**. A diferença de custo entre elas é inteiramente o
repasse do modelo, e portanto a escolha do modelo é a escolha do custo.

O nome escolhido entra em `GeoPromptRun.modelName` e fica gravado **por
execução**. Trocar de modelo entre coletas é a mesma armadilha que
`lead_geo_reviews.prompt_set` existe para evitar: método divergente na mesma
série temporal, que já custou o `maps-task.ts`. A lista acima não é
documentação — é o que a conta oferecia em 2026-09-10, e ela muda.

## 6. `llm_scraper` — um caminho que a spec não considerou

Não estava em nenhuma das cinco perguntas, e apareceu na tabela:
`llm_scraper/live/advanced` a **US$ 0,004 por requisição, preço fixo, sem
repasse de LLM**. Existe para `chat_gpt` e `gemini` apenas, e tem
`locations`/`languages` próprios (gratuitos).

A diferença com `llm_responses` é a natureza do que se mede: `llm_responses`
chama o modelo por API; `llm_scraper` raspa a **interface real** do produto. Para
a pergunta "o lead aparece quando alguém pergunta ao ChatGPT", a interface é o
que o usuário final vê.

**Não decidido aqui.** Fica registrado como alternativa a medir na metade paga,
com a pergunta certa: o `advanced` devolve as fontes citadas com URL, como
`annotations` devolve?

---

# A metade paga

Doze chamadas cobradas, **US$ 0,51 no total**, em três rodadas — a segunda e a
terceira existem porque a primeira trouxe **dois erros meus**, e os dois estão
registrados abaixo com o mesmo peso das respostas. Scripts: `probe-pago.mjs`
(corrigido para produzir tudo isto numa rodada limpa) e `probe-pago-2.mjs`.

| pergunta | custo | veredito |
|---|---|---|
| p6 `ai_keyword_data` | 0,021 | **aprovado, e forte** |
| p5 `ranked_keywords` ×2, forma do `ai_overview_reference` | 0,030 | **respondida — a forma está observada** |
| p9 `llm_responses` ×7 (4 plataformas + retentativas) | 0,118 | **as quatro respondem, cada uma diferente** |
| p8 `backlinks` com filtro ×5 | 0,121 | **reprovado, com controle positivo** |
| p7 `llm_mentions` ×2 | 0,217 | **funciona para o Brasil** |

**Dois controles positivos.** `buscaorganica.com.br` pode devolver vazio por dez
motivos, e "vazio" sozinho não distingue *não tem* de *não sabemos ler*. Por
isso p5, p7 e p8 rodaram também contra `puroclean.com` em US/en — o domínio do
relatório de referência, que **prova** ter dez citações em AI Overview e presença
em Reddit e YouTube. Controle vazio reprova o leitor; controle cheio com BR vazio
reprova a cobertura. São vereditos diferentes, e sem o controle os dois viram o
mesmo.

## 7. p6 — a demanda em IA responde em português, e não é fração do Google

**110 keywords enviadas, 110 devolvidas.** Nenhum `null`, nenhum campo ausente,
doze meses de `ai_monthly_searches` em todas.

| `ai_search_volume` | keywords |
|---|---|
| positivo | **61** |
| zero | 49 |
| nulo | 0 |

Passou no teste que o `keyword_difficulty` reprovou: não é zero em massa com
cara de resposta. E o achado que não estava na pergunta — **a distribuição é
própria, não uma fração do volume orgânico:**

| keyword | volume no Google | `ai_search_volume` |
|---|---|---|
| `sanitarios` | 5.400 | **12.559** |
| `banheiro químicos` | 18.100 | 234 |
| `consultoria de seo` | 880 | 2 |
| `primeira pagina do google` | 170 | 10 |

Uma keyword com **mais** busca em IA que no Google, e outra com 1% do volume. Não
dá para derivar uma da outra por regra de três, e é isso que torna o número útil:
ele diz onde a demanda migrou, o que o relatório de referência não mede.

Custo confirmado na vírgula: 0,01 + 110 × 0,0001 = **US$ 0,021**, exato.

## 8. p5 — a forma do `ai_overview_reference` saiu do escuro

A onda 0 da visibilidade ampliou `item_types`, recebeu os dois tipos novos
**zerados**, e registrou que a forma seguia não observada. Está observada. O
`serp_item` tem dezessete campos:

```
se_type  type  rank_group  rank_absolute  source  domain  title  url  text
main_domain  relative_url  etv  estimated_paid_traffic_cost  clickstream_etv
rank_changes  backlinks_info  rank_info
```

Três coisas que só o payload diz:

**`rank_group` e `rank_absolute` são números diferentes** — 5 e 1 na primeira
linha do controle. A coluna "POSITION" do relatório de referência é uma das
duas, e escolher a errada troca "quinta citação da lista" por "primeira", sem
que nada quebre.

**`text` traz o trecho citado.** A frase que o AI Overview de fato usou, não só a
URL. É o campo que transforma a tabela numa evidência que o lead lê e reconhece.

**`domain` vem com `www.`, `main_domain` sem.** O mesmo par que já custou uma
leitura errada na onda 0 da visibilidade, quando 77 das 110 keywords estavam num
subdomínio de homologação e o mapeador gravava `relative_url`.

E o veredito que fecha a pergunta aberta:

| alvo | `total_count` | itens |
|---|---|---|
| `puroclean.com` US/en *(controle)* | **4.677** | 50 |
| `buscaorganica.com.br` BR/pt | — | **0** |

**Controle cheio, lead vazio: o leitor funciona e o zero do lead é real.** O
`aiOverview.count: 0` do snapshot não é defeito de mapeamento, e
`no_ai_overview_presence` está certo em disparar. A ressalva de seis meses pode
sair do documento.

## 9. p7 — `llm_mentions` tem negócio local brasileiro

| alvo | `total_count` |
|---|---|
| `puroclean.com` US/en *(controle)* | 3.150 |
| `buscaorganica.com.br` BR/pt | **7** |

Sete não é muito. É **mais que zero**, que é a única coisa que a pergunta
precisava decidir — e vem com a forma inteira. Cada item traz:

```
platform  model_name  location_code  language_code  question  answer  sources
search_results  ai_search_volume  monthly_searches  first_response_at
last_response_at  brand_entities  fan_out_queries  is_web_search_based
```

E `sources[]`, que é o que a etapa precisa, traz por fonte: `domain`, `url`,
`title`, `snippet`, `source_name`, `rank`, `publication_date`.

No controle, a primeira fonte da primeira linha é **Reddit** — `rank: 1`,
`domain: "www.reddit.com"`, com o trecho citado. Ou seja: **a seção "Important
Citations" do relatório de referência sai inteira daqui**, com a fonte que a IA
de fato citou, sem depender de ninguém emitir backlink.

`model_name` vem `google_ai_overview`, e `question` é o prompt real — não uma
keyword. Isso resolve de uma vez as duas seções que faltavam.

## 10. p8 — a via de backlink para citação está reprovada

Cinco chamadas, três formas do filtro, contra o controle que tem dez links
provados pelo relatório de referência:

| filtro | `total_count` |
|---|---|
| `in` com as formas nuas | 0 |
| `in` com `www.` e subdomínios | 0 |
| `like` `%reddit.com` | 0 |
| **sem filtro** | **4.927** |

O índice funciona — sem filtro ele devolve 4.927 domínios de referência, e os
vinte primeiros são reais. **Nenhum deles é Reddit, YouTube ou Wikipedia.**

A ressalva da onda 8 — *"link encontrado prova a citação; link ausente não prova
ausência de citação"* — sai desta medição **endurecida**: para as três fontes que
mais importam em GEO, a via de backlink não encontra nada mesmo quando a citação
existe e é pública. A onda 2 de citações **não** se constrói sobre
`/backlinks/backlinks/live`. Se constrói sobre `llm_mentions`.

Isso também encerra a comparação de preço que motivou rodar as duas: a via barata
não é uma alternativa mais barata, é uma alternativa que não responde.

## 11. p9 — as quatro plataformas respondem, e nenhuma igual à outra

Um prompt de marca, com `web_search`, contra as quatro:

| plataforma | modelo | `money_spent` | `input_tokens` | annotations | com `url` | com `start_index` |
|---|---|---|---|---|---|---|
| `perplexity` | `sonar` | **0,0057** | 29 | 20 | 20 | 0 |
| `chat_gpt` | `gpt-5-mini` | 0,0146 | 8.818 | 9 | 9 | **9** |
| `claude` | `claude-haiku-4-5` | 0,0238 | 10.797 | 3 | 3 | 0 |
| `gemini` | `gemini-2.5-flash` | 0,0368 | 104 | 31 | 31 | **31** |

**US$ 0,0808 por prompt nas quatro.** Projetando os oito prompts que a spec
dimensiona: **US$ 0,65 por sondagem** — contra os US$ 0,019 que a tabela da conta
sugere. O repasse do modelo é 34× a taxa, e é a tabela sendo piso outra vez.

### Cada plataforma recusa um campo diferente

Três das quatro devolveram `40501 Invalid Field` na primeira tentativa, cada uma
apontando para um campo distinto do mesmo corpo:

| plataforma | recusa |
|---|---|
| `chat_gpt` | `max_output_tokens` |
| `gemini` | `web_search_country_iso_code` **e** `web_search_city` |
| `perplexity` | `web_search_city` |
| `claude` | aceitou tudo |

**Um construtor único de requisição — o desenho óbvio para quatro plataformas com
o mesmo shape — falharia em três delas.** E `40501` não cobra nada, então a
falha seria invisível no custo e apareceria só como "essa plataforma nunca traz
dado".

**O gemini não aceita recorte geográfico nenhum.** A sondagem nele mede sem
`BR` e sem cidade, e a tela precisa dizer isso — uma taxa de menção comparada
entre plataformas onde uma delas não tem o mesmo recorte é comparação de coisas
diferentes.

### `50301` é execução que não aconteceu

`gemini-3.5-flash` e `gemini-3.5-flash-lite` devolveram
`50301 3rd Party API Service Unavailable (rate_limit_exceeded)` em três
tentativas, **com custo zero**. Não é campo errado nem conta sem permissão: é
limite do provedor, do lado de lá. `gemini-2.5-flash` respondeu na primeira.

`GeoPromptRun` precisa distinguir os dois casos. Gravar um `50301` como
`mentioned: false` seria **inventar ausência** — a mesma classe de erro que
`fetchBacklinkSchemeLive` recusa ao não devolver leitura zerada.

### `start_index` não é portável

Só `chat_gpt` e `gemini` preenchem `start_index`/`end_index`. Em `claude` e
`perplexity` os dois vêm `null`, com `url` e `title` presentes.

A spec já dizia que `position` é a ordem de ocorrência entre as marcas
detectadas e **não** posição em lista numerada. Esta medição prova que não havia
alternativa: o índice de caractere não existe em metade das plataformas.

### As respostas variam entre execuções

O `gemini` foi chamado duas vezes com o mesmo prompt. Na primeira, 17
annotations e o domínio do lead citado; na segunda, 31 annotations e **o domínio
não citado**. O relatório de referência avisa disso em letra miúda — *"LLM
responses can vary from one execution to the next"* — e a medição confirma.

Consequência direta: **taxa de menção de uma execução só não é medida.** Ou a
sondagem repete, ou a tela apresenta o número como indicação direcional, com a
data. Fingir precisão aqui é o mesmo defeito do `` `${difficulty}%` ``.

## 12. `multi_target_metrics` — a dominância existe para o Brasil

Medido em 2026-09-11, duas chamadas, **US$ 0,206**. Era a Task 4 do plano das
ondas 2/3, e a regra da casa mandava validar a forma antes de escrever mapeador —
a documentação já havia errado duas vezes nesta etapa.

**A forma documentada estava certa:** `targets: [{ key, target: [...] }]`, com
cada entrada sendo `{keyword, search_scope, search_filter, match_type}` ou
`{domain, search_scope, search_filter, include_subdomains}`. Cada alvo entrou com
os dois — a marca por **nome na resposta** e o domínio nas **fontes** —, porque
ser citado no texto e ser citado como fonte são perguntas diferentes.

**O controle bateu com o relatório de referência:**

| alvo | `mentions` | `ai_search_volume` | taxa no relatório |
|---|---|---|---|
| SERVPRO | **2.670** | 2.805.900 | 88% |
| Paul Davis Restoration | 239 | 547.200 | 73% |
| PuroClean | 234 | 86.260 | 73% |

A ordem é a mesma. **Mas a escala não é**, e isso é uma armadilha de tela:
`mentions` dá SERVPRO 11× o PuroClean; a taxa de citação do relatório dá 1,2×.
São métricas diferentes — uma conta menções no dataset inteiro, a outra a
**fração de prompts** em que a marca aparece. Apresentar `mentions` com rótulo de
"taxa" seria comparar coisas diferentes com a mesma palavra.

**E o Brasil respondeu:**

| alvo | `mentions` | `ai_search_volume` |
|---|---|---|
| Conversion | 50 | 37.420 |
| Agência Mestre | 15 | 6.750 |
| **Busca Orgânica** (lead) | **2** | 650 |

Duas menções não é muito. É **número real, comparável com concorrentes reais**, e
é a primeira vez que a tabela de Competitor Dominance existe para lead
brasileiro.

### `brand_entities` e `search_results_domain` vêm vazios em `google`

As duas chaves **existem** no `aggregated_metrics` da plataforma `google` e as
duas vêm como array **vazio**, nos dois alvos. Confirma a nota do
`top_mentioned_brands`: dado de marca pré-extraída é `chat_gpt`, que é
EUA/inglês.

**O erro de leitura que isso pegou foi meu, de novo, e é o terceiro da série.** A
primeira versão do probe testou `Boolean(agg.brand_entities_title)` — e array
vazio é *truthy*. O veredito saiu "presente" para um campo sem dado nenhum, que é
a forma mais cara de errar aqui: a tela prometeria dominância por marca e
mostraria nada. `.length > 0` é a checagem, e o script ganhou um modo `--offline`
que re-deriva o veredito dos dumps em disco — corrigir a conta de um `.length`
não vale US$ 0,21.

### `sources_domain` vem rico, e muda o desenho da onda 2b

A mesma chamada devolve, agregado por alvo e no total, quais domínios a IA citou:

| US/en | menções | | BR/pt | menções |
|---|---|---|---|---|
| `www.servpro.com` | 2.690 | | `www.conversion.com.br` | 43 |
| `www.youtube.com` | **835** | | `www.youtube.com` | **28** |
| `www.reddit.com` | **506** | | `www.organicadigital.com` | 9 |
| `m.yelp.com` | 469 | | `www.idinheiro.com.br` | 3 |

**Isto é a seção "Important Citations" do relatório, já agregada, sem chamada
extra.** YouTube e Reddit aparecem no topo dos dois mercados — exatamente as
fontes que o relatório diz serem as mais citadas por IA, e exatamente as que a
via de backlink não encontrava.

**Consequência de desenho:** `multi_target_metrics` sozinha entrega **duas** das
três coisas que a onda 2b precisava — dominância e fontes de autoridade — por
US$ 0,103. O que só `search_mentions` dá é o detalhe por pergunta: a frase que
alguém perguntou e o que a IA respondeu.

A onda 2b passa a ser **condicional**: `multi_target_metrics` sempre;
`search_mentions` **só quando o lead tem menção**. Lead com zero menções não paga
os US$ 0,107 de uma chamada que não pode trazer nada — e lead com zero menções
vai ser a maioria.

## Os dois erros da primeira rodada

Ficam registrados porque os dois produziriam veredito errado com cara de
resposta, e os dois só apareceram por causa dos controles.

**1. `annotations` no caminho errado.** Li `items[].annotations[]`, que é o que a
documentação descreve. O campo mora em `items[].sections[].annotations[]`. A
leitura errada devolveu `annotations_count: 0` numa resposta que tinha três,
todas apontando para o domínio do lead — e o veredito que sairia dali é o mais
caro possível: *"a plataforma não devolve annotations"*, que mata a métrica
determinística da sondagem inteira. **A onda 3 escrita a partir da documentação
nasce quebrada e silenciosa.**

**2. Filtro de backlinks sem `www.`.** Mandei `["reddit.com", "youtube.com", …]`
em igualdade exata e recebi zero nos dois alvos. Na mesma medição, `llm_mentions`
devolvia `domain: "www.reddit.com"`. Concluir "não há citação" dali teria sido
falso negativo nosso apresentado como ausência de citação do lead — a mesma
classe de erro do operador `site:` que a Task 0 de citações reprovou em
2026-09-09. A segunda rodada testou três formas do filtro e a chamada sem filtro
nenhum; **só aí o veredito de reprovação passou a valer.**

## O que as ondas 2 e 3 herdam desta medição

- **Onda 2 — citações:** `llm_mentions/search_mentions/live`, `platform: google`,
  Brasil + `pt`. **Não** `/backlinks/backlinks/live`. US$ 0,10 + 0,001/linha.
- **Onda 2 — demanda:** `ai_keyword_data/keywords_search_volume/live`,
  US$ 0,021 pelas mesmas 110 keywords. Ler `0` como zero medido, não como
  ausência — 61 das 110 vieram positivas.
- **Onda 2 — AI Overview:** já está pago e gravado. O zero do lead é real. Falta
  só decidir entre `rank_group` e `rank_absolute` e exibir o `text`.
- **Onda 3 — sondagem:** corpo por plataforma, nunca um só. `50301` é execução
  que não aconteceu. `position` pela ordem de ocorrência. US$ 0,65 por sondagem
  de oito prompts, com `money_spent` somado na linha.
- **Página de Ferramentas:** ler os dois campos de expiração de assinatura, que
  a chamada já traz e ninguém lê.

## O que continua não medido

- **Qual dos pares de endpoint de `llm_mentions` é o certo.**
  `search_mentions/live` respondeu e é o que a onda 2 usa; `search/live`,
  `aggregated_metrics` e `cross_aggregated_metrics` continuam sem execução, e a
  tabela da conta cobra o mesmo pelos quatro.
- **`multi_target_metrics` com lead + concorrentes.** É a tabela de Competitor
  Dominance para o Brasil, e não foi chamada — a forma do `target` com
  `keyword_entity` e `search_scope: ["answer"]` segue suposta.
- **`brand_entities` em `platform: google`.** A chave existe no item; se vem
  preenchida fora do `chat_gpt`, não foi verificado.
- **`llm_scraper`,** a US$ 0,004 fixo sem repasse de modelo. Só `chat_gpt` e
  `gemini`. Continua registrado como alternativa não medida.
- **Se sete menções bastam.** O dataset cobre o Brasil, mas um lead menor que
  `buscaorganica.com.br` pode vir com zero — e a US$ 0,10 a chamada, a tela
  precisa saber dizer "olhamos e não há" sem cobrar por isso duas vezes.
