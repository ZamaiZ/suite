# Sondagem da Fase 3 — respostas medidas

> Task 1 do plano `docs/superpowers/plans/2026-09-18-fase3-pesquisa.md`.
> Cliente sondado: **Léo Tintas** (`leotintas.com.br`), cidade **Itu/SP**.
> Data: 2026-09-18. **Custo total: US$ 0,2248.**

Cada resposta cita o caminho do campo. Resposta sem caminho não conta.

Os scripts são descartáveis e estão nesta pasta: `probe-pesquisa.mjs` (P0–P4),
`probe-pesquisa-parte2.mjs` (P4), `probe-pesquisa-parte3.mjs` (P6a, P6, P5).

---

## P2 — O item de SERP traz URL completa? **Sim**

`tasks[0].result[0].items[]` com `type: "organic"` traz **`url`** e `domain`
separados: `url: "https://leotintas.com.br/"`.

**O clustering por URL exata está de pé. A Task 9 não muda.**

O item ainda traz `rank_group`, `rank_absolute`, `position`, `breadcrumb`,
`is_featured_snippet` e `faq` — este último é FAQ já extraída do resultado, e é
insumo do pilar F sem chamada extra.

## P3 — PAA vem no mesmo payload? **Sim**

Um bloco `type: "people_also_ask"` dentro do mesmo `items[]`, com as perguntas
em `items[].items[].title`. **Não dobra o custo da fase.**

Medido em `loja de tintas em itu`:

- "Onde posso encontrar as tintas mais baratas?"
- "Qual é o telefone da Léo tintas Itu?"
- "Qual é a marca de tinta boa e barata?"
- "Quais são as 3 melhores marcas de tintas?"

## P7 — `location_code` de cidade funciona na SERP? **Sim**

`location_code: 1031728` (`Itu,State of Sao Paulo,Brazil`) foi aceito e
devolvido no `result[0].location_code`, com `language_code: "pt"`.

A SERP veio com **`local_pack` de 3 itens**, `organic` 19, `people_also_ask` 1,
`related_searches` 2, `google_reviews` 1.

Confirma o problema 2 da spec: a auditoria atual consulta com location de país e
por isso não enxerga o local pack.

## P1 — `keywords_for_keywords` traz `monthly_searches`? **Sim, 12 meses**

`tasks[0].result[]` — o item já traz `search_volume`, `competition`,
`competition_index`, `cpc`, `low_top_of_page_bid`, `high_top_of_page_bid` e
**`monthly_searches`** com 12 entradas na forma
`{"year": 2026, "month": 8, "search_volume": 20}`.

**Sazonalidade é de graça. E o passo separado de `search_volume` é redundante**
— ver a seção de custo.

## P4 — Teto de lote do `search_intent`: **20 aceitos inteiros**

`/dataforseo_labs/google/search_intent/live` com 20 keywords devolveu 20 itens,
US$ 0,0144. O item traz `keyword_intent {label, probability}` e
`secondary_keyword_intents[]`:

```json
{
  "keyword": "loja de tintas",
  "keyword_intent": { "label": "navigational", "probability": 0.3927 },
  "secondary_keyword_intents": [
    { "label": "transactional", "probability": 0.3184 },
    { "label": "commercial", "probability": 0.2644 }
  ]
}
```

O teto máximo não foi medido — 20 foi o lote testado e passou sem recusa.

## P6a — O Labs aceita location de cidade? **Não. Só país.**

Esta pergunta não estava no plano. Ela nasceu do `40501 Invalid Field:
'location_code'` que o `competitors_domain` devolveu com o code de Itu — o mesmo
que a SERP tinha aceitado sem reclamar.

`GET /v3/dataforseo_labs/locations_and_languages` (gratuito):

| medida | valor |
|---|---|
| localidades no Labs, mundo inteiro | **94** |
| localidades do Brasil | **1** |
| `location_type` disponíveis para BR | `Country` apenas |
| Itu | **ausente** |
| São Paulo (estado) | **ausente** |

**Consequência para o desenho:** SERP e Labs não compartilham granularidade.

- SERP (`/serp/google/organic/live/advanced`) → aceita **cidade**
- Labs (`competitors_domain`, `domain_intersection`, `ranked_keywords`,
  `search_intent`) → **só país** (`2076`)

O keyword gap é, portanto, **nacional**. As keywords que vêm dele precisam ser
validadas por SERP local depois — não se pode assumir que disputa nacional
implica disputa em Itu.

## P6 — `competitors_domain` devolve métrica de intersecção? **Sim, mas o resultado não serve**

Com `location_code: 2076`, US$ 0,0132. O item traz `domain`, `avg_position`,
`sum_position`, **`intersections`**, `metrics.organic` (buckets de posição, etv,
count) e `full_domain_metrics`.

A forma é boa. **O conteúdo, para este cliente, é inútil:**

| domínio | intersections |
|---|---|
| instagram.com | 12 |
| facebook.com | 12 |
| **leotintas.com.br** (o próprio cliente) | 12 |
| leotintas.com | 10 |
| listamais.com.br | 9 |
| solutudo.com.br | 9 |
| youtube.com | 8 |
| serasaexperian.com.br | 8 |
| econodata.com.br | 8 |
| cnpj.biz | 8 |

**Nenhuma loja de tintas. Nem uma.** E o próprio domínio do cliente aparece na
lista dos seus concorrentes.

A causa é estrutural, não um acidente deste cliente: `competitors_domain` parte
do perfil orgânico do alvo, e o alvo rankeia para **12 keywords**, quase todas
de marca. Quem mais rankeia para termo de marca são rede social, diretório e
base de CNPJ.

**Isto é a descoberta mais cara da sondagem.** Sem ela, a Task 6 teria entregue
`instagram.com` como concorrente de referência e o keyword gap inteiro sairia
lixo — e o erro só apareceria no fim, depois de pago.

**Correção necessária no plano:** para cliente com footprint pequeno ou de
marca, os concorrentes de referência saem da **SERP das keywords-alvo** — quem
ocupa o top 10 orgânico de `loja de tintas em itu` — e não do perfil do domínio
do cliente. E isso é de graça: a SERP já vai ser coletada na Task 8.

`competitors_domain` continua útil como **segunda fonte**, com filtro de
plataforma (rede social, diretório, agregador de CNPJ) e exclusão do próprio
domínio e suas variações.

## P5 — `domain_intersection` aceita vários domínios? **Não. Par a par.**

Assinatura `target1` / `target2`, US$ 0,0132 por par. **Multiplica por N
concorrentes**, como a spec supunha.

`result[0]` traz `target1`, `target2`, `total_count`, `items_count` e `items[]`.
Cada item: `keyword_data`, `first_domain_serp_element`,
`second_domain_serp_element` — ou seja, dá para ver a posição de cada um dos
dois lados na mesma keyword, que é exatamente o que o gap precisa.

Com `leotintas.com.br` × `instagram.com`: `total_count: 12`.

---

# Sondagem complementar — Task 4

> `probe-pesquisa-parte4.mjs`, mesma data. Custo: **US$ 0,036**.

## P8 — `keywords_for_keywords` aceita 50 seeds? **Não. Máximo 20.**

Mandar 50 devolve `40501 Invalid Field: 'keywords'. Max number exceeded
(20/21)`, e **custa US$ 0** — o erro é barato, mas o fatiamento é obrigatório.

O teto de 20 estava no código como valor de documentação, marcado como não
verificado. Agora é medido.

**Consequência de custo:** 50 seeds são **três chamadas** a US$ 0,09, não uma.
A expansão por `keywords_for_keywords` custa **US$ 0,27**, não US$ 0,09.

## P9 — `keyword_ideas` vale a chamada? **Vale. 72% de novidade.**

US$ 0,036 por 200 itens (`total_count: 1.805.341`, então há paginação por
`offset_token`).

A pergunta não era a forma do payload — era o ganho marginal. Comparando os 200
itens contra as 4.669 candidatas únicas já pagas:

| medida | valor |
|---|---|
| itens lidos | 200 |
| já conhecidos | 56 |
| **inéditos** | **144 (72%)** |

E o que apareceu não foi cauda longa qualquer: `suvinil tintas`, `coral tintas`,
`tinta acrilica acrilex`, `tinta suvinil 18 litros`. **Marcas de tinta** — uma
categoria semântica inteira que seeds genéricos não alcançam, e que para uma
loja revendedora é exatamente o que traz quem já sabe o que quer comprar.

### Três diferenças de forma que quebram em silêncio

| | `keywords_for_keywords` | `keyword_ideas` |
|---|---|---|
| resultado | `result[]` direto | `result[0].items[]` |
| métricas | na raiz do item | dentro de `keyword_info` |
| `competition` | rótulo (`"HIGH"`) | **número 0–1**; rótulo em `competition_level` |

Ler `competition` do `keyword_ideas` como se fosse rótulo produz `"1"` onde
deveria estar `"HIGH"`.

Em troca, ele traz o que o outro não tem: `keyword_properties.keyword_difficulty`
e `search_intent_info.main_intent` — este último **poupa parte das chamadas de
`search_intent`** da Task 5.

### De quebra: a explicação do `languageMismatch`

`keyword_properties` traz `detected_language` e `is_another_language`. Medido,
`suvinil tintas` vem com `detected_language: "eu"` (basco) e
`is_another_language: true`.

É falso positivo do detector de idioma, não erro de configuração da consulta —
o que explica o `languageMismatch: true` que aparece em metade das keywords do
`visibility_audit` e que a spec listou como problema. **Não é sintoma de
localidade errada**, e não deve ser tratado como tal.

---

## Custos medidos

| Chamada | Custo | Nota |
|---|---|---|
| `serp/google/locations/BR` | US$ 0 | gratuito |
| `dataforseo_labs/locations_and_languages` | US$ 0 | gratuito |
| `serp/google/organic/live/advanced` | **US$ 0,004** | por keyword |
| `keywords_data/google_ads/keywords_for_keywords/live` | **US$ 0,09** | por chamada, seeds em lote |
| `keywords_data/google_ads/search_volume/live` | **US$ 0,09** | **redundante — ver abaixo** |
| `dataforseo_labs/google/search_intent/live` | **US$ 0,0144** | lote de 20 |
| `dataforseo_labs/google/competitors_domain/live` | **US$ 0,0132** | |
| `dataforseo_labs/google/domain_intersection/live` | **US$ 0,0132** | por par |

**Duas correções à conta da spec:**

1. A spec diz que a expansão "some no arredondamento". **Falso.**
   `keywords_for_keywords` custa **22× uma SERP**. Com 200 SERPs (US$ 0,80)
   contra 4 chamadas de expansão (US$ 0,36), a expansão é cerca de um terço do
   custo da fase.
2. **`search_volume` separado é desperdício.** Uma chamada de
   `keywords_for_keywords` devolveu **4.831 candidatas** a partir de 3 seeds, já
   com `search_volume` e `monthly_searches`. O passo separado custou outros
   US$ 0,09 pelo dado que já estava na mão. **Cortar da Task 5.**

Nova ordem de grandeza da pesquisa completa, com 50 seeds e teto de 200 SERPs
— corrigida pela sondagem da Task 4:

| Bloco | Chamadas | Custo |
|---|---|---|
| `keywords_for_keywords` — **50 seeds ÷ 20 = 3 chamadas** | 3 | US$ 0,27 |
| `keyword_ideas` | 1–3 | ~US$ 0,04–0,11 |
| SERP das candidatas (200) | 200 | US$ 0,80 |
| `search_intent` (lotes de 20, menos o que veio do ideas) | ~10 | ~US$ 0,14 |
| `competitors_domain` + `domain_intersection` × 5 | 6 | ~US$ 0,08 |
| **Total** | | **~US$ 1,35** |

O total mal se move porque as duas correções se cancelam: o teto de 20 triplicou
a expansão (+US$ 0,18), e cortar o `search_volume` redundante economizou US$ 0,09,
enquanto `search_intent` encolhe com a intenção que o `keyword_ideas` já traz.

**A SERP continua sendo 60% do custo** — e o teto de candidatas continua sendo o
único número que realmente governa o preço da fase.

## Nota de método

O teto da parte 1 conferia o acumulado **antes** de cada chamada — bloqueava a
próxima, mas não impedia a atual de ultrapassar. Gastou US$ 0,184 contra teto de
US$ 0,15. As partes 2 e 3 corrigiram: cada chamada declara uma `reserva` de
custo máximo, conferida antes de gastar.
