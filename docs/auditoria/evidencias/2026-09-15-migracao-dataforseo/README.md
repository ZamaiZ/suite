# Onda 0 — Sondagem da migração para DataForSEO

Executada em 2026-09-15 contra **Funerária Benttus** (São Paulo/SP) e **Óticas
Diniz** (franquia, para o caso de homônimo), mais `buscaorganica.com.br` no
Lighthouse. Custo total: **US$ 0,0264** — teto do script era US$ 0,10.

Task 1 do plano `../../../superpowers/plans/2026-09-15-migracao-dataforseo-pipeline.md`.

Duas perguntas passaram, duas reprovaram a forma suposta e uma **derrubou uma
decisão do design**. É o que a sondagem existe para fazer.

---

## P1 — O `place_id` é o mesmo do Places? **SIM**

```
ChIJkchU8A1ZzpQR99LmKcm-kT0
```

Começa com `ChIJ`, é o mesmo espaço de identificador do Google Places. **Os
perfis já vinculados continuam casando** e `lead_gbp_profiles.place_id` não
precisa de coluna irmã nem de migração de reconciliação.

Era a única pergunta que podia matar o desenho. Não matou.

O item do Maps trouxe **32 campos**, consistente com os 33 medidos em
2026-09-09 (`../../2026-09-04-impedimentos-dataforseo.md`, T0.2).

## P2 — O `my_business_info` aceita `location_code` de país? **SIM**

`keyword: place_id:ChIJ…` + `location_code: 2076`, **sem coordenada nenhuma**,
devolveu `status_message: "Ok."` e o item completo — incluindo
`latitude: -23.5649348` e `longitude: -46.6528995`.

Consequência: **o fallback de coordenada some de verdade.** Perfil antigo sem
lat/long no snapshot pode ser recoletado sem o Places, porque a própria chamada
devolve a coordenada. E o picker não precisa mandar lat/long junto do
`place_id` — mandar só acelera.

Custo medido: **US$ 0,0054**, contra os US$ 0,002 da busca no Maps. Mais caro
que a busca, e ainda assim a chamada que substitui o Place Details.

Os 41 campos do item:

```
type, rank_group, rank_absolute, position, title, original_title, description,
category, category_ids, additional_categories, cid, feature_id, address,
address_info, place_id, phone, url, contact_url, contributor_url,
book_online_url, domain, logo, main_image, total_photos, snippet, latitude,
longitude, is_claimed, questions_and_answers_count, attributes, place_topics,
rating, hotel_rating, price_level, rating_distribution, people_also_search,
work_time, popular_times, local_business_links, is_directory_item, directory,
services
```

## P3 — Onde está `current_status`? **NÃO ONDE O PLANO SUPUNHA**

O plano mandava ler `item.work_time.current_status`. **Não existe.** O caminho
real é um nível mais fundo, e é **diferente nos dois endpoints**:

| Endpoint | Caminho | Valor medido |
|---|---|---|
| `my_business_info` | `work_time.work_hours.current_status` | `"open"` |
| `serp/google/maps` | `work_hours.current_status` | `"open"` |

O `work_time` do `my_business_info` tem **uma única chave**: `work_hours`.

E o valor é **minúsculo** — `"open"`, não `"OPEN"`.

Do jeito que estava planejado, o mapeador leria `undefined` sempre,
`businessStatus` viraria `null`, o gap `closed` nunca dispararia e a tela nunca
mostraria "Em operação". **Zero silencioso, de graça, sem nada que denunciasse.**

O mapeador passa a ler `work_time.work_hours` com queda para `work_hours`, e a
comparação continua em maiúsculas depois de normalizar.

## P4 — A forma do `timetable`? **CONFIRMADA**

```json
{
  "sunday":  [{ "open": { "hour": 0, "minute": 0 }, "close": { "hour": 24, "minute": 0 } }],
  "monday":  [{ "open": { "hour": 0, "minute": 0 }, "close": { "hour": 24, "minute": 0 } }]
}
```

Chaves de dia em inglês minúsculo, lista de turnos, `open`/`close` com `hour` e
`minute` numéricos. É a forma que o montador de `weekdayDescriptions` supunha.

**Ressalva sobre a fixture:** a Benttus funciona 24 horas, sete dias. Todos os
dias são idênticos e nenhum é fechado, então a fixture **não exercita** dia
fechado nem dois turnos no mesmo dia. Esses dois casos ficam cobertos por
entrada sintética no teste, e isso está dito lá.

## P5 — O `location_code` de cidade ajuda? **NÃO. E o código de país também não.**

Esta é a resposta que derrubou uma decisão do design.

**Consulta genérica `funeraria`:**

| Localidade | Cidades dos resultados |
|---|---|
| `location_code: 2076` (Brasil) | Correntina, Rio do Pires, Wagner, Botuporã, Baianópolis — **Bahia** |
| `location_code: 1001773` ("Sao Paulo,State of Sao Paulo,Brazil", tipo `City`) | Birigui, Araçatuba, Guararapes, Penápolis — **interior de SP** |

**Zero sobreposição** entre os 20 resultados de cada. E nenhum dos dois centrou
na cidade pedida: o código de tipo `City` do DataForSEO se comporta como região
ampla, não como ponto.

**E a cidade na keyword não salva.** `"Otica Diniz Guarulhos SP"` com o código
do país devolveu **um** resultado: *Óticas Diniz Bonsucesso*, no **Rio de
Janeiro**.

**O que funciona é `location_coordinate`:**

| Consulta | Localidade | Resultado |
|---|---|---|
| `Otica Diniz` | `-23.4543,-46.5337,12z` | 20 itens, os primeiros em **Guarulhos** |
| `Otica Diniz` | `-23.4543,-46.5337,15z` | 4 itens, **todos** em Guarulhos |

**Consequência para o desenho:** a tabela `lib/dataforseo/br-location-codes.json`
e o módulo `lib/dataforseo/locations.ts` **não servem** e saem do plano. A busca
precisa de um centroide de cidade, e não de um `location_code`.

O DataForSEO não geocodifica. A decisão sobre de onde vem o centroide está com o
dono do repositório — ver a seção final.

## P6 — O Lighthouse devolve os audits que o extrator lê? **QUASE**

`on_page/lighthouse/live/json`, `for_mobile: true`, **US$ 0,005**. Versão do
Lighthouse: **13.4.0**. O resultado traz `audits` e `categories` **na raiz**,
sem o invólucro `lighthouseResult` que o PSI punha em volta — o extrator precisa
aceitar as duas formas.

| Audit que o extrator lê | Estado |
|---|---|
| `largest-contentful-paint` | presente — `5610.94` |
| `cumulative-layout-shift` | presente — `0.0213` |
| `is-on-https` | presente |
| `is-crawlable` | presente |
| `color-contrast` | presente |
| `final-screenshot` | presente, `data` já com o prefixo `data:image/jpeg;base64,` |
| `viewport` | **AUSENTE** |
| `interaction-to-next-paint` | **AUSENTE** |

**O `viewport` virou `meta-viewport`.** O audit foi renomeado nas versões novas
do Lighthouse, e existe como `meta-viewport` entre os 155 audits devolvidos. O
extrator pede `viewport`, e `auditScoreOne` devolve `true` quando o audit falta
— ou seja, **`viewportOk` passaria sempre, sem medir nada.** Mesmo defeito de
classe do P3: silêncio com cara de aprovação. O extrator passa a pedir
`meta-viewport` com queda para `viewport`.

**O INP não existe mesmo**, nem como `interaction-to-next-paint` nem como
experimental. Confirma o que a spec já assumia: com a saída do CrUX, o medidor
de INP fica vazio nos dois eixos.

`loadingExperience` ausente, como previsto — é campo do Chrome UX Report e o
Lighthouse não o produz.

Scores da coleta: performance `0.56`, accessibility `0.93`, best-practices
`0.73`, seo `1`. As chaves de categoria são as mesmas do PSI, com
`best-practices` hifenizado.

---

## O que muda no plano

1. **Task 2 sai.** `lib/dataforseo/locations.ts` e
   `lib/dataforseo/br-location-codes.json` não resolvem o problema para o qual
   foram desenhados.
2. **Task 4 muda.** `searchGooglePlaces` passa a receber coordenada e zoom, e
   não cidade e UF.
3. **Task 5 muda.** O caminho do `current_status` é
   `work_time.work_hours.current_status`, com queda para `work_hours`.
4. **Task 6 simplifica.** `my_business_info` aceita `location_code: 2076` fixo;
   não há tabela para consultar.
5. **Plano do Lighthouse, Task 3 ganha um caso.** `meta-viewport` com queda
   para `viewport`.

## A pergunta aberta

**De onde vem o centroide da cidade do lead?** O DataForSEO não geocodifica, e
sem coordenada a busca erra de estado. As opções e a decisão estão na conversa
com o dono do repositório; nenhuma linha de código foi escrita até ela existir.

## Arquivos

| Arquivo | O que é |
|---|---|
| `00-locations-br.json` | 5.311 localidades brasileiras (1.832 do tipo `City`) — gratuito |
| `01-maps-pais.json` | busca do nome exato, `location_code: 2076` |
| `02-maps-cidade.json` | busca do nome exato, `location_code: 1001773` |
| `03-info-pais.json` | `my_business_info` com código de país, sem coordenada |
| `04-lighthouse.json` | Lighthouse 13.4.0, mobile |
| `05-generica-pais.json` | `funeraria`, código de país |
| `06-generica-cidade.json` | `funeraria`, código de cidade |
| `07-franquia-com-cidade.json` | `Otica Diniz Guarulhos SP`, código de país |
| `08-franquia-sem-cidade.json` | `Otica Diniz`, código de país |
| `09-coord-guarulhos-z12.json` | `Otica Diniz`, coordenada, zoom 12 |
| `10-coord-guarulhos-z15.json` | `Otica Diniz`, coordenada, zoom 15 |
| `probe-migracao.mjs` | o script, descartável, com `--offline` |

Fixtures gravadas em `lib/leads/gbp-maps-candidate.fixture.json` e
`lib/leads/gbp-business-info.fixture.json`.
