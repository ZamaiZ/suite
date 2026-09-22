# Sondagem da Fase 0 — prospecção por segmento e região

Medido em 2026-09-21 contra a conta real. Custo total: **US$ 0,27** (US$ 0,048 na sondagem 1, US$ 0,225 na 2).

Pergunta que decidia o desenho: o `business_data/business_listings` do DataForSEO serve como motor de descoberta no Brasil?

**Serve.** Mas a sondagem 1 quase produziu a conclusão errada, e o motivo importa mais que o resultado.

## O erro de método da sondagem 1

`probe-business-listings.mjs` pediu `order_by: ["rating.votes_count,desc"]` e concluiu que **90% das empresas têm site**. Isso é viés de seleção puro: ela leu os 100 restaurantes *mais avaliados* de Guarulhos — Coco Bambu e semelhantes —, que são exatamente os que têm estrutura.

O que denunciou foi o próprio agregado da mesma área, na mesma sondagem: 7.034 salões de beleza e apenas 432 `websites_count`. Seis por cento, não noventa.

`probe-sem-vies.mjs` refez sem `order_by`, em quatro cenários.

## Os números reais

| | Restaurante GRU | Salão GRU | Dentista GRU | Dentista Londrina |
|---|---|---|---|---|
| universo (`total_count`) | 4.791 | 7.034 | 2.401 | 705 |
| com site | 21% | 29% | 40% | 25% |
| **com telefone** | 71% | 85% | 83% | 84% |
| **com CEP** | 95% | 98% | 95% | 99% |
| sem site **mas** com telefone | 51% | 57% | 45% | 60% |
| **`is_claimed = false`** | **50%** | 32% | 36% | **52%** |
| nota < 4,0 | 10% | 3% | 6% | 9% |
| sem nenhuma avaliação | 17% | 23% | 23% | 31% |

`place_id`, `cid`, `address`, `rating`, `attributes` e `is_claimed`: **100% preenchidos** nas duas sondagens.

## As quatro consequências de desenho

**1. O CNPJ do rodapé não é o resolvedor principal.** Ele depende de a empresa ter site, e só 21–40% têm. Multiplicando pela fração que publica CNPJ no rodapé, a cobertura fica na casa de 10–20%. O plano original tratava esse caminho como o principal; ele é o *mais preciso*, não o de maior alcance.

**2. Telefone e CEP são as chaves fortes — e são exatamente as chaves de junção com a base pública da Receita Federal.** 71–85% e 95–99%. Isso reposiciona o espelho da Receita de "fase opcional" para "o caminho de maior alcance", e o código foi escrito para recebê-lo como resolvedor adicional, sem retrabalho.

**3. `is_claimed = false` é o achado comercial da sondagem.** Entre 32% e 52% dos perfis da área não são reivindicados, e o filtro funciona no servidor: `is_claimed: false` para dentista em Guarulhos devolve `total_count` 916 de 2.401. Para uma agência de GBP, essa é a lista.
A sondagem 1 dizia 2% — de novo o viés: quem tem muita avaliação já reivindicou o perfil.

**4. A amostra de 100 não é aleatória; o agregado é a verdade.** Para dentista em Guarulhos o agregado dá `websites_count` 519 de 2.401 (22%) e a amostra dá 40%. A estimativa da tela tem que sair do `categories_aggregation`, nunca de extrapolar a primeira página do `search`.

## Formato do payload (o que o mapeador precisa saber)

- `business_listings/categories` — **gratuito**, 5.318 categorias, cada uma `{ category_name, business_count }`. Note: `category_name`, não `category`.
- `categories_aggregation/live` — `result[0].items[]`, cada item `{ categories: [...], aggregation: { count, websites_count, top_categories, top_countries, top_attributes } }`. O `total_count` do nível de cima é o número de **categorias distintas** na área, não de empresas.
- `search/live` — `result[0]` traz `total_count`, `count`, `offset`, `offset_token` e `items[]`. O item tem `category_ids[]` em snake_case (batem com `category_name` do catálogo) e `category` no rótulo legível.
- `last_updated_time` veio em **100%** da amostra: mediana de 88 dias, máximo de 925. É banco de dados, não coleta ao vivo — por isso `prospects.listing_updated_at` existe e a ficha mostra a data.

## Custo — aqui a tabela fecha

`search` com 100 itens: **medido US$ 0,048** contra US$ 0,012 + 100 × 0,00036 = **US$ 0,048 de tabela**. Exato.

Isso é diferente do que o `SERP_CAVEAT` em `lib/dataforseo/usage.ts` registra para a seção `serp`, onde o medido ficou 5× acima da tabela. A parcela por item do `business_listings` é confiável; a de SERP não é.

`categories_aggregation` com `limit: 5` também custou US$ 0,048 — ou seja, **o agregado é cobrado como uma busca, e o `limit` não barateia**. Planejar custa o mesmo que uma página de descoberta; vale cachear por campanha.

## Arquivos

| Arquivo | O quê |
|---|---|
| `probe-business-listings.mjs` | sondagem 1 (com o viés) |
| `01-categories.json` | catálogo completo, 5.318 categorias |
| `02-categories-aggregation.json` | densidade por categoria em Guarulhos |
| `03-search-amostra.json` | 100 restaurantes ordenados por avaliação |
| `04-resumo.json` | resumo da sondagem 1 |
| `probe-sem-vies.mjs` | sondagem 2 (correção) |
| `05-sem-vies-*.json` | os quatro cenários, crus |
| `06-aggregation-dentist.json` | `websites_count` contra a amostra |
| `07-nao-reivindicados.json` | `is_claimed: false` |
| `08-resumo-sem-vies.json` | resumo da sondagem 2 |
