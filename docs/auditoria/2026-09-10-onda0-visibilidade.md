# Onda 0 da visibilidade — o mapeador finalmente rodou contra payload real

`2026-09-04-impedimentos-dataforseo.md` registrava, na seção "O que continua
impedido":

> `mapRankedKeywordsLiveResult` assume a presença de `rank_group` e de
> `metrics.organic`. A primeira coleta real é também a primeira validação — e é o
> passo que ainda não foi feito.

Foi feito em **2026-09-10**, contra `buscaorganica.com.br`. Quatro chamadas,
**US$ 0,1008 no total**. As suposições de forma passaram. O que reprovou foi
outra coisa: **três dos sete campos que a etapa exibe não sustentam o que
afirmam**, e a idade do dado nunca esteve na tela.

Evidência em `evidencias/2026-09-10-visibilidade/` — tabela comparativa das 110
keywords, resumo com custos, um item completo com os 12 blocos de
`keyword_data`, e os dois scripts que reproduzem a medição. Os payloads crus
completos (840 KB cada) não foram versionados; os scripts os regeram.

## O que foi medido

| chamada | custo | veredito |
|---|---|---|
| `GET /appendix/user_data` | grátis | tabela de preços do Labs conferida |
| `ranked_keywords/live` (`limit: 1000`) | US$ 0,0252 | forma OK, conteúdo com três defeitos |
| `bulk_keyword_difficulty/live` (110 kws) | US$ 0,0252 | **reprovado — não resolve nada** |
| `search_intent/live` (110 kws) | US$ 0,0252 | aprovado, com ressalva |
| `ranked_keywords/live` com `item_types` ampliado | US$ 0,0252 | pergunta respondida, custo zero extra |

**A tabela da conta fechou a conta desta vez.** `dataforseo_labs` cobra
US$ 0,012 `per_request` + US$ 0,00012 `per_result`, e 0,012 + 110 × 0,00012 =
**0,0252** exato, nas quatro chamadas. A ressalva de `usage.ts` — a tabela é
piso, não orçamento — continua valendo para `serp` e `on_page`, mas o Labs é
previsível.

Consequência de preço que muda uma decisão: **`limit` é cobrado por linha
devolvida, não por linha pedida.** Subir de 100 para 1.000 não custa nada num
domínio pequeno, e num domínio de 1.000 keywords custa US$ 0,132 — pelo dado que
se precisa. O teto de 100 em `RANKED_KEYWORDS_LIMIT` economizava nada e
truncava sempre.

## 1. A URL: 70% do footprint está num subdomínio de homologação

O mapeador grava `relative_url` e descarta `url`. A medição mostrou o preço
disso:

| host | keywords | ETV/mês |
|---|---|---|
| `www.buscaorganica.com.br` | 33 | 348,3 |
| `aprov.buscaorganica.com.br` | **77** | **119,4** |

```
url         https://aprov.buscaorganica.com.br/polyban.com.br/produtos
relative_url  /polyban.com.br/produtos        ← é isto que gravávamos
domain        aprov.buscaorganica.com.br      ← host completo
main_domain   buscaorganica.com.br            ← domínio registrável
subdomain     null                            ← null nas 110 linhas
```

Três consequências, todas verificadas:

- **`serp_item.subdomain` é inútil.** `null` nas 110. Quem quiser o host tem que
  ler `domain`; quem quiser o registrável, `main_domain`. O campo com o nome
  certo é o único que não serve.
- **`isHomepageUrl` inventa host.** Ele reconstrói
  `https://${snapshot.domain}${path}`, o que produz
  `https://buscaorganica.com.br/polyban.com.br/produtos` — **uma URL que não
  existe**. O gap `homepage_only` e a tabela do analista trabalham em cima
  disso.
- **O achado é comercial, não só técnico.** Um subdomínio de aprovação
  indexado, carregando 119 dos 468 cliques estimados do domínio, é exatamente o
  tipo de coisa que a auditoria existe para encontrar. Estávamos apagando a
  evidência no mapeamento.

## 2. O KD: `bulk_keyword_difficulty` foi testado e reprovado

A hipótese era que `keyword_properties.keyword_difficulty` dentro de
`ranked_keywords` servisse cache degradado, e que o endpoint dedicado
corrigisse. **Não corrige.**

| | `ranked_keywords` | `bulk_keyword_difficulty` |
|---|---|---|
| KD = 0 | 98 de 110 | **98 de 110** |
| KD = `null` | 0 | **0** |
| divergências | — | **1** (`consultoria de seo`: 8 → 2) |

**A DataForSEO nunca devolve `null` neste campo.** A documentação diz "escala
logarítmica 0–100, `null` se indisponível"; na prática, na base brasileira, o
indisponível vem como `0`. Que é pior que `null`, porque tem cara de resposta —
e a tela ainda imprimia `` `${difficulty}%` ``, transformando um índice num
percentual que ele não é.

**Uma pista de causa.** `keyword_properties.is_another_language` é `true` em
**36 das 110**, e `detected_language` classifica *"busca organica"* como **`en`**.
Das 36 mal detectadas, **28 têm KD 0**. Parte do buraco é keyword em português
tratada como fora de idioma.

**Decisão:** não adicionar a chamada. `0` passa a ser lido como ausência, os 12
KD reais aparecem sem `%`, e a dificuldade passa a ser contada por sinais que já
vêm pagos na mesma resposta e que ninguém lia:

- `keyword_info.competition_level` (`LOW`/`MEDIUM`/`HIGH`, do Google Ads),
  `competition` (0–1), `cpc`, `low/high_top_of_page_bid`.
- `keyword_data.avg_backlinks_info` — o perfil de backlink **do top-10 daquela
  keyword**: `referring_domains: 42,7`, `rank: 206`, `main_domain_rank: 500`. É
  a matéria-prima da dificuldade, não a estimativa dela.
- `serp_item.rank_info` (`page_rank: 710`) e `serp_item.backlinks_info` (407
  domínios de referência) — a autoridade da página do próprio lead.

## 3. O intent: os dois índices discordam, e um terço é chute

`search_intent/live` foi aprovado, mas não pelo motivo que se esperava.

- **25 de 110 (23%)** discordam entre `search_intent_info.main_intent` do
  `ranked_keywords` e o `label` do endpoint dedicado. São índices diferentes,
  não o mesmo dado em dois lugares.
- Probabilidade: mínima **0,3667** · mediana **0,7439** · máxima **1,0**.
  **36 de 110 (33%) abaixo de 0,60.**
- `foreign_intent` preenchido em **39 de 110** — intenções secundárias que o
  mapeador descartava.

Exemplos da divergência:

```
banheiro quimico preço          ranked transactional → dedicado commercial   (p=0,79)
bom negócio atividades de …     ranked commercial    → dedicado navigational (p=0,94)
martinrea-honsel                ranked navigational  → dedicado informational (p=0,83)
```

**A chamada dedicada não compra correção — compra confiança declarada.** Não
existe verdade de referência para intent: Semrush, Ahrefs e Ubersuggest têm
modelos próprios e discordam entre si. O que muda é que, com `probability`, a
tela pode calar em vez de estampar uma letra. Uma classificação de 0,37 deixa de
ser visualmente idêntica a uma de 0,98.

## 4. A idade do dado — o achado que ninguém tinha procurado

Nenhum dos três `last_updated_time` era lido. Medidos contra 2026-09-10:

| campo | mínimo | mediana | máximo |
|---|---|---|---|
| `serp_info.last_updated_time` (**a posição**) | 8 d | **59 d** | **108 d** |
| `keyword_info.last_updated_time` (volume) | 13 d | 16 d | 26 d |
| `search_intent_info.last_updated_time` | 125 d | 133 d | 138 d |

**A posição exibida tem, em mediana, dois meses.** E o cabeçalho da etapa
carimba `fetched_at` — a hora do clique — como se fosse a hora da medida.

Esta é, na leitura desta onda, a maior causa isolada de "não bate com a outra
ferramenta". Cada vendor reindexa num ciclo próprio; apresentar índice de junho
como coleta de setembro produz divergência garantida, e a divergência aparece
como erro nosso.

## 5. `item_types` filtra `items`, nunca `metrics`

Pergunta levantada ao decidir se valia ampliar `item_types`: as métricas mudam
de semântica? **Não** — mas a primeira redação desta seção afirmou mais do que a
medição sustentava, e vale registrar a correção.

As cinco seções estão **sempre presentes** como chave:

```
metrics: organic · paid · featured_snippet · local_pack · ai_overview_reference
```

E **`metrics.organic` é idêntico** nas duas chamadas — que é o que decidia a
pergunta. O que **não** é idêntico: a seção de um tipo **não pedido volta
`null`**, e só a pedida vem preenchida.

| seção | `item_types: [organic]` | com os três |
|---|---|---|
| `organic` | idêntico | idêntico |
| `paid`, `featured_snippet` | `{}` | `{}` |
| `local_pack` | **`null`** | `{count: 0, etv: 0, …}` |
| `ai_overview_reference` | **`null`** | `{count: 0, etv: 0, …}` |

Ou seja: ao contrário do que a primeira leitura concluiu, `metrics.local_pack` e
`metrics.ai_overview_reference` **não estavam sendo pagas e descartadas** — elas
não vinham, porque não eram pedidas. Passam a vir com `item_types` ampliado, e o
custo não muda (US$ 0,0252 nas duas), porque se paga por linha devolvida e este
domínio não tem resultado nesses dois tipos.

**Ressalva honesta, e ela ficou mais forte:** justamente porque vieram zerados,
**a forma de `serp_item` para `local_pack` e `ai_overview_reference` continua
não medida**. O mapeador nasce defensivo nesses dois tipos, e o primeiro lead
que os tiver é a validação — o mesmo erro que esta onda veio corrigir, se for
esquecido.

> **Resolvido em 2026-09-11, metade.** A onda 0 da Presença em IA mediu
> `ai_overview_reference` contra `puroclean.com` em US/en, que tem 4.677 linhas
> desse tipo: dezessete campos, incluindo `text` — o trecho citado, que estava
> pago e no lixo — e o par `rank_group` / `rank_absolute`, que **não são
> equivalentes**. `rank_absolute` vale 1 em 93 de 100 porque é a posição do
> bloco na SERP; `rank_group` é a posição entre as fontes citadas. O mapeador já
> preferia `rank_group`, e agora sabe por quê.
>
> A mesma medição respondeu a pergunta que sobrou daqui: com o controle cheio e
> `buscaorganica.com.br` vazio, **o zero do lead é real**, não defeito de
> leitura. Ver `2026-09-10-onda0-presenca-em-ia.md`.
>
> **`local_pack` continua não observado.** A ressalva vale inteira para ele.

## 6. O que mais está pago e no lixo

`keyword_data` tem **12 blocos**; o mapeador lia 3. `serp_item` tem **31
campos**; o mapeador lia 4.

- `metrics.organic.is_new: 103, is_up: 4, is_down: 0, is_lost: 0` e, por linha,
  `rank_changes.previous_rank_absolute`. Movimento de posição, de graça.
  (Cautela: `is_new` em 103 de 110 sugere reconstrução recente do índice, não
  103 keywords novas.)
- `serp_info.serp_item_types` — o que a SERP **realmente contém**. `ai_overview`
  em **49 das 110**. É evidência observada, não palpite de modelo, e responde
  parte da pergunta de intenção sem custo.
- `keyword_info.monthly_searches` (12 meses) e `search_volume_trend`
  (`monthly: -18, quarterly: -18, yearly: -33` na keyword de marca).
- `serp_item.title`, `description`, `estimated_paid_traffic_cost`,
  `is_featured_snippet` (0 nesta amostra).
- O campo `cost` da resposta, que `fetchRankedKeywordsLive` descarta — enquanto
  `lead_gbp_grid_scans.cost_usd` guarda o dele.

## O que esta onda não resolve

**Nada disto faz o KD ou o intent baterem com Ubersuggest ou Semrush.** Índices
e modelos são proprietários e diferentes; discordância entre vendors é o
comportamento normal, não o defeito. O que a correção entrega é parar de afirmar
mais do que o dado sustenta: URL real em vez de caminho inventado, `—` em vez de
`0%`, rótulo com probabilidade em vez de letra seca, e a idade do índice visível.

O desenho que sai daqui está em
`../superpowers/specs/2026-09-10-visibilidade-confiabilidade-design.md`.
