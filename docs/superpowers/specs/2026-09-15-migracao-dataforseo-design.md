# Migração para DataForSEO — Fim da Chave do Google — Design

## Objetivo

Remover **toda** dependência de API do Google do produto, e no caminho unificar
as duas etapas do pipeline de oportunidades numa só.

Hoje a busca de estabelecimento consome o Places em duas fases — autocomplete a
cada tecla, detalhes ao selecionar — e a coleta do DataForSEO só acontece depois,
num segundo botão. Passa a ser: **busca explícita devolve os locais; a seleção
faz a coleta completa, grava e devolve o perfil pronto.**

Não é redesenho da auditoria, não é mudança nas regras de gap além das que a
troca de fonte obriga, e não é ampliação de escopo de coleta.

## O que motivou

A chave do Google é consumida em **seis pontos**, por dois produtos diferentes,
e nenhum deles tem dono claro:

| # | Onde | API do Google | Para quê |
|---|---|---|---|
| A1 | `lib/places/client.ts` `autocompletePlaces` | Places Autocomplete | typeahead do picker de leads **e** do briefing (intent `address`) |
| A2 | `lib/places/client.ts` `fetchPlaceDetails` | Place Details | `link`, `refresh`, `enrich` (fallback de coordenada), `check-ranking` (fallback), `applyBriefingPlace` |
| A3 | `lib/places/geocode.ts` `geocodeAddressText` | Places Text Search | endereço → lat/long do mapa de raio do briefing |
| A4 | `lib/pagespeed/client.ts` | PageSpeed Insights | usa `GOOGLE_PLACES_API_KEY` como fallback de chave |
| B1 | `components/custom/LeadGbpPanel/LeadGbpGridMap.tsx` | Maps JavaScript | render da malha geográfica |
| B2 | `components/custom/BriefingServiceRadiusMap/BriefingServiceRadiusMapCanvas.tsx` | Maps JavaScript | render do raio de atendimento |

O que destrava a migração é um achado já medido, registrado em
`../../auditoria/2026-09-04-impedimentos-dataforseo.md` (T0.2, 2026-09-09): **o
item do Maps traz 33 campos** — `place_id`, `cid`, `latitude`, `longitude`,
`address_info`, `phone`, `url`, `domain`, `category`, `rating`, `work_hours`,
`is_claimed`, `total_photos` — e o mapeador atual lê três.

E a documentação do `business_data/google/my_business_info/live`, endpoint que o
`enrich` **já chama hoje**, confirma que o mesmo item devolve `latitude`,
`longitude`, `place_id`, `cid`, `address_info`, `phone`, `url`, `domain`,
`work_time`, `work_hours`, `current_status`, `rating`, `rating_distribution`,
`total_photos`, `main_image`, `logo`, `is_claimed`, `category`,
`additional_categories`, `description`, `attributes`, `place_topics`,
`people_also_search` e `check_url`.

**Uma chamada produz o snapshot e o enrichment juntos.** É isso que torna a
etapa única possível, e não só desejável.

## Decisões aprovadas

- **Chave do Google eliminada por completo.** Saem `GOOGLE_PLACES_API_KEY`,
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` e `PAGESPEED_API_KEY`.
- **PageSpeed migra para `on_page/lighthouse/live/json`**, com a perda dos dados
  de campo assumida e declarada na tela. Ver *A perda do CrUX*, abaixo.
- **LocationIQ como provider único** de tiles, geocoding e autocomplete de
  endereço. Plano gratuito de 5.000 requisições/dia, uso comercial permitido.
  Descartados MapTiler e Stadia, cujos planos gratuitos são explicitamente
  *non-commercial*, e os tiles públicos do OpenStreetMap, cuja política
  desencoraja aplicação e permite bloqueio sem aviso.
- **Um botão só, "Recoletar".** `refresh` e `enrich` deixam de existir como
  caminhos separados.
- **`GbpSnapshot` não muda de forma.** Só troca a origem dos valores. É o que
  mantém gaps, presenters, malha e ranking intactos.
- **Onda 0 de sondagem antes de qualquer mapeador.** Ver *Onda 0*, abaixo.

## Fora de escopo

- **Galeria de fotos.** O `photoNames` do Places era o único caminho para o
  binário da foto, e a tarefa planejada em
  `../plans/2026-09-09-report0-cobertura.md` perde a fonte. O `total_photos`
  conta e o `main_image` mostra uma; galeria, não. Perda aceita, não esquecida.
- **Recuperar dado de campo por outra via.** A CrUX API resolveria, e foi
  recusada por ser chave do Google.
- **Reprocessar histórico.** Snapshots antigos continuam legíveis com os valores
  que têm. A fronteira fica visível na interface, como a fronteira do SerpAPI já
  fica.
- **Horário de funcionamento no briefing sem perfil vinculado.** Ver *Briefing*.

---

## Arquitetura

### O que é deletado

`lib/places/` inteiro (`client.ts`, `geocode.ts`, `parse-input.ts`, `index.ts`)
e `lib/google-maps/` inteiro (`load.ts`, `map-styles.ts`, `index.ts`).

A dependência `@googlemaps/js-api-loader` sai do `package.json`. **Ela é também
a origem dos typings globais `google.maps`**, então os dois canvas são
reescritos, não adaptados — não existe caminho incremental aqui.

### O que nasce

| Arquivo | Responsabilidade | Depende de |
|---|---|---|
| `lib/dataforseo/maps-search.ts` | busca de estabelecimento por nome | `client.ts`, `maps-task.ts` |
| `lib/leads/gbp-maps-candidate.ts` | mapeador puro do item do Maps → candidato da lista | nada |
| `lib/leads/gbp-business-info-map.ts` | mapeador puro do `google_business_info` → `GbpSnapshot` | `gbp.ts` (tipos) |
| `lib/locationiq/city-center.ts` | cidade + UF → centroide, com cache | `locationiq/client.ts` |
| `lib/dataforseo/lighthouse.ts` | Lighthouse por estratégia | `client.ts` |
| `lib/locationiq/client.ts` | geocode, autocomplete, reverse | nada |
| `lib/locationiq/index.ts` | superfície pública | `client.ts` |
| `lib/maplibre/style.ts` | estilo claro e escuro sobre tiles do LocationIQ | `theme/shadcn-palette` |

Cada mapeador é **puro e testável sem rede**, como `maps-task.ts` já é, e cada
um é travado por fixture de payload real colhido na onda 0 — o que
`lib/leads/visibility-labs-map.test.mjs` já faz e o que impediu a suposição de
forma anterior de sobreviver seis meses sem execução.

### Variáveis de ambiente

```
LOCATIONIQ_API_KEY=<chave de servidor>
NEXT_PUBLIC_LOCATIONIQ_API_KEY=<chave de tiles, restrita por referrer>
```

Duas chaves porque são dois perfis de risco: a de servidor faz geocoding e
autocomplete e nunca vai ao navegador; a de tiles vai, e por isso é restrita por
referrer no painel do LocationIQ. Reusar uma só repetiria o acoplamento que a
linha 27 de `lib/pagespeed/client.ts` criou entre PageSpeed e Places.

---

## O fluxo novo

### Busca

`app/actions/leads/search-places.ts` substitui `suggest-places.ts`.

```
serp/google/maps/live/advanced
  language_code:       "pt"
  se_domain:           "google.com.br"
  depth:               20
  keyword:             <o nome digitado>
  location_coordinate: "<lat>,<lon>,12z"   ← centroide da cidade do lead
```

US$ 0,002 medido para `depth: 20` — o preço de tabela, confirmado na onda 0 do
Report 0.

**A localização vem de coordenada, e isso foi medido — não suposto.** O desenho
original usava `location_code`, e a onda 0 o reprovou em 2026-09-15
(`../../auditoria/evidencias/2026-09-15-migracao-dataforseo/README.md`, P5):

- `location_code: 2076` (Brasil) para `funeraria` devolveu resultados na
  **Bahia**;
- `location_code` de tipo `City` de São Paulo devolveu o **interior de SP** —
  zero sobreposição com o anterior, e nenhum dos dois na cidade pedida;
- e pôr a cidade na keyword **não salva**: `"Otica Diniz Guarulhos SP"` com o
  código do país voltou uma ótica no **Rio de Janeiro**.

Com `location_coordinate` no centroide de Guarulhos, a mesma consulta devolveu
20 resultados começando em Guarulhos no zoom 12, e 4 resultados todos em
Guarulhos no zoom 15. **Zoom 12 é o escolhido**: a busca quer candidatos
suficientes para o analista reconhecer o certo, e o 15 recorta cedo demais.

**De onde vem o centroide:** o DataForSEO não geocodifica. `lib/locationiq/city-center.ts`
resolve cidade + UF pelo LocationIQ — uma chamada gratuita, memoizada por
cidade no processo, porque centroide de município não muda. É o mesmo provider
já escolhido para o briefing, e é o que faz a onda 1 depender dele.

### O typeahead morre, e a lista melhora

O picker de `components/custom/LeadGbpPanel/LeadGbpPlacePicker.tsx` deixa de
buscar a cada tecla. Vira campo com submissão explícita — Enter ou botão —
porque cada busca custa e leva segundos.

Em troca, cada candidato deixa de ser duas linhas de texto. O item do Maps já
traz **categoria, nota, número de avaliações, telefone, domínio e se o perfil é
reivindicado**, tudo na mesma resposta paga. O analista escolhe vendo o perfil,
não adivinhando pelo nome — que é justamente o caso em que o vínculo errado
acontece hoje, com franquias e filiais de mesmo nome.

O `PLACES_SUGGEST_MIN_CHARS` vira `GBP_SEARCH_MIN_CHARS` e muda de casa, de
`lib/places` para `lib/leads/gbp.ts`. O `suggestPlacesSchema` de
`lib/validations/lead-gbp.ts` perde o `session_token`, que era conceito de
cobrança do Places e não significa nada no DataForSEO.

### Seleção

`linkLeadGbpProfile` absorve o `enrichLeadGbpProfile` inteiro. Numa action:

1. valida e checa conflito de `place_id` — inalterado
2. `my_business_info/live` → **snapshot e enrichment do mesmo item**
3. em paralelo: `google_qna` live, `task_post` de reviews, `task_post` de updates
4. insere perfil, snapshot e os dois jobs
5. devolve o perfil completo

Os passos 2 a 4 são o corpo atual de `app/actions/leads/enrich-gbp-profile.ts`,
extraído para uma função interna `collectGbpProfile` em
`app/actions/leads/gbp-collect.ts`, chamada pelos dois caminhos. Não há
duplicação: existe um lugar só que sabe coletar um perfil.

**O ramo de conflito vai junto, e não depois.** Quando o `place_id` já está no
mesmo lead, `link-gbp-profile.ts:70` hoje delega a `refreshGbpProfileById`. Esse
ramo passa a chamar `collectGbpProfile` na mesma onda em que o vínculo é
unificado — deixá-lo para a onda 2 faria um revínculo colher do Places enquanto
um vínculo novo colhe do DataForSEO, com as duas fontes gravando na mesma coluna
no mesmo dia.

**A ordem importa e é a mesma de hoje:** o perfil precisa existir antes do
snapshot por causa da chave estrangeira, e o snapshot antes da releitura, porque
`GBP_SELECT` o embeda. O comentário que registra isso em `link-gbp-profile.ts`
continua válido e vem junto.

### Recoleta

`refresh-gbp-profile.ts` e `enrich-gbp-profile.ts` são substituídos por
`recollect-gbp-profile.ts`, que chama a mesma `collectGbpProfile`. Um botão
"Recoletar" em `use-gbp-profile-controller.ts` no lugar de `handleRefresh` e
`handleEnrich`.

Some a possibilidade de perfil meio-coletado — hoje um perfil vinculado e nunca
analisado existe, tem snapshot sem enrichment, e as regras de gap carregam
ramos só para esse estado.

### O fallback de coordenada deixa de existir

`enrich-gbp-profile.ts:69` e `check-gbp-ranking.ts:70` chamam o Places quando o
snapshot não tem lat/long. Como `my_business_info` devolve `latitude` e
`longitude`, a própria recoleta recupera a coordenada. Em `check-gbp-ranking.ts`
o ramo vira: sem coordenada, exige recoleta antes de checar ranking — uma
mensagem, não uma chamada escondida a outro provider.

---

## Mapeamento campo a campo

`GbpSnapshot` mantém a forma. Só muda de onde cada valor vem.

| Campo | Vinha do Places | Passa a vir de |
|---|---|---|
| `placeId` | `id` | `place_id` |
| `displayName` | `displayName.text` | `title` |
| `formattedAddress` | `formattedAddress` | `address` |
| `primaryTypeDisplayName` | localizado do Google | `category` |
| `types` | `types` | `category_ids` |
| `primaryType` | `primaryType` | primeiro de `category_ids` |
| `businessStatus` | `OPERATIONAL` / `CLOSED_*` | `work_time.work_hours.current_status`, **traduzido** |
| `weekdayDescriptions` | texto pronto | montado de `work_hours.timetable` |
| `googleMapsUri` | `googleMapsUri` | `check_url` ?? `https://www.google.com/maps?cid=<cid>` |
| `nationalPhoneNumber` | `nationalPhoneNumber` | `phone` |
| `websiteUri` | `websiteUri` | `url` |
| `websiteDomain` | `normalizeWebsiteDomain(websiteUri)` | `normalizeWebsiteDomain(url)` |
| `rating` | `rating` | `rating.value` |
| `userRatingCount` | `userRatingCount` | `rating.votes_count` |
| `photoCount` | `photoNames.length`, teto 10 | `total_photos` — **total real** |
| `photoNames` | referências do Places | `[]` |
| `latitude` / `longitude` | `location.*` | `latitude` / `longitude` |

### O `businessStatus` é traduzido de propósito

A regra `startsWith("CLOSED")` em `lib/leads/gbp.ts:389` e a comparação
`=== "OPERATIONAL"` em `LeadGbpIdentityCell.tsx:95` e
`LeadGbpInformationCard.tsx:192` continuam funcionando sem uma linha alterada.

Se o vocabulário do DataForSEO vazasse para o snapshot, perfis antigos e novos
passariam a significar coisas diferentes **na mesma coluna** — que é exatamente
o defeito que a fronteira do SerpAPI documenta. O mapeador traduz na entrada, e
o vocabulário armazenado continua sendo um só.

**O caminho foi medido, e não é o que a documentação sugeria.** A onda 0 achou
`current_status` um nível mais fundo, e em lugares diferentes nos dois
endpoints: `work_time.work_hours.current_status` no `my_business_info` e
`work_hours.current_status` no item do Maps. O valor vem **minúsculo**
(`"open"`). Lido no caminho errado, `businessStatus` seria `null` para sempre e
o gap `closed` nunca dispararia — sem erro, sem log, sem nada.

### `photoNames` fica no tipo, e é sempre vazio

O campo permanece em `GbpSnapshot` e em `readGbpSnapshot` porque **linhas
antigas o têm**, e removê-lo do leitor apagaria dado gravado. Snapshots novos o
trazem vazio.

### `no_photos` muda de regra

Hoje: `!enrichment && snapshot.photoCount === 0` — escrita quando o enrichment
era opcional. Com a coleta unificada o enrichment sempre existe, então a regra
**nunca dispararia**, e um perfil sem foto nenhuma deixaria de ser achado.

Passa a ser `enrichment.totalPhotos === 0`. O rótulo "Sem fotos na API" em
`GBP_GAP_LABELS` vira "Sem fotos no perfil", porque agora é verdade — a contagem
deixou de ser o que a API devolveu e passou a ser o que o perfil tem. O
complemento "na API (máx. 10)" de `lib/leads/gbp-presenters.ts:110` sai junto.

---

## Briefing

### Autocomplete e detalhe de endereço

`app/actions/briefing/suggest-addresses.ts` passa ao Autocomplete do LocationIQ
com `countrycodes=br`. O `applyBriefingPlace` lê o endereço estruturado do
LocationIQ no lugar de `addressComponents`, e o `parseBrazilianAddress` que já
existe em `lib/briefing/address.ts` continua como rede — ele já é chamado hoje e
já resolve o caso do endereço vindo só como texto.

`addressFromPlaceComponents` é substituído por `addressFromLocationIq`, e o tipo
`PlaceAddressComponentLike` sai junto — os dois existiam só para o formato de
componentes do Places. O `mergeAddress` e o `joinBrazilianAddress` não mudam.

**E a segunda chamada some.** O Places exigia autocomplete e depois detalhes,
porque a sugestão vinha só com texto; o autocomplete do LocationIQ devolve
endereço estruturado e coordenada no mesmo resultado. O `applyBriefingPlace`,
que era essa segunda chamada, deixa de ter o que buscar e é removido.

### O horário sai do caminho do briefing

`suggest-addresses.ts:115` preenche `hoursLines` a partir de
`weekdayDescriptions` do Places. **O LocationIQ não devolve horário de
funcionamento.**

Com perfil do Google vinculado ao lead, o horário continua vindo do snapshot —
que é a fonte melhor, porque é o horário que o cliente publica. Sem perfil
vinculado, o campo fica para o cliente preencher no briefing, e a tela para de
prometer preenchimento automático. O `hours_locked` do schema perde o propósito
e sai.

### Geocoding do mapa de raio

`geocodeAddressText` vira `lib/locationiq/geocode.ts` com a mesma assinatura de
resultado. `resolveAudienceMapCoordinates` em `lib/briefing/geocode-address.ts`
não muda de forma.

O literal `source: "gbp" | "places"` do `ResolvedMapCoordinates` passa a
`"gbp" | "geocode"`. É valor derivado em tempo de leitura, não coluna
persistida — conferido: `companyAddressFingerprint` é que fecha o cache, e o
`source` só informa a origem na mesma resposta.

---

## Mapa

Os dois canvas viram **MapLibre GL** com tiles raster do LocationIQ. Tema claro
e escuro continuam lidos do `SHADCN_PALETTE`, como hoje.

- **`BriefingServiceRadiusMapCanvas.tsx`** — o `google.maps.Circle` vira um
  polígono de círculo geodésico (64 vértices) numa camada `fill` + `line`. O
  `fitCircle` vira `fitBounds` sobre os limites calculados do polígono, com o
  mesmo padding de 28.
- **`LeadGbpGridMap.tsx`** — os marcadores viram uma camada `circle` com
  `circle-color` por faixa. **As faixas de `GBP_GRID_BANDS` não mudam**: a
  ordem, os rótulos e a decisão de pintar "Falhou" em tom neutro continuam como
  estão, e a legenda continua saindo da mesma lista.

O `loadGoogleMaps` some. `lib/maplibre/style.ts` exporta o estilo claro e o
escuro; não há carregador assíncrono de script, porque o MapLibre é pacote npm.

---

## PageSpeed

`fetchPagespeedStrategy` mantém a assinatura e passa a chamar
`on_page/lighthouse/live/json` com `for_mobile` derivado da estratégia. Cerca de
US$ 0,005 por estratégia, US$ 0,01 por site com mobile e desktop.

`lib/pagespeed/client.ts` é substituído por `lib/dataforseo/lighthouse.ts`, e o
único chamador — `app/actions/leads/poll-website-jobs.ts:88` — troca o import. O
fluxo de jobs, o `claimWebsitePagespeedJob` e o `mergeWebsitePagespeed` não
mudam.

### A perda do CrUX

`extractWebsitePsiStrategy` em `lib/leads/website-pagespeed.ts:309` lê **duas**
fontes da resposta do PSI: `lighthouseResult`, que é laboratório, e
`root.loadingExperience`, que é **campo do Chrome UX Report**. O Lighthouse não
produz a segunda — nem o do DataForSEO nem nenhum outro. É telemetria que o
Google anexa.

Consequências, todas assumidas:

1. **`fieldLcpMs`, `fieldInpMs` e `fieldCls` passam a ser sempre `null`** em
   coletas novas. O leitor de linhas gravadas (`website-pagespeed.ts:183-185`)
   continua lendo os valores antigos — dado gravado não se apaga.
2. **`strategyCwvNeedsImprovement` fica só com laboratório.** A função
   `metricNeedsImprovement(lab, field, limiar)` continua existindo e continua
   correta; o argumento de campo só chega `null`.
3. **O INP praticamente desaparece.** O Lighthouse padrão não emite
   `interaction-to-next-paint` — é métrica de campo por natureza, e o
   `experimental-interaction-to-next-paint` que o extrator tenta como segunda
   opção não vem em execução comum. Na prática o medidor de INP passa a ficar
   vazio nos dois eixos. É a maior perda desta migração, e está aqui escrita
   para não ser descoberta como defeito depois.
4. **`LeadWebsitePagespeedCard.tsx` ganha estado explícito de ausência.** Hoje
   `website-presenters.ts:119` simplesmente não escreve a linha "campo LCP …"
   quando o valor é nulo, e silêncio se confunde com aprovação. O card passa a
   dizer que dado de campo deixou de ser coletado em 2026-09-15 — mesma razão
   pela qual a fronteira do SerpAPI está na tela.
5. **`diagnosis-strengths.ts:178-179` não quebra.** Já faz
   `fieldLcpMs ?? lcpMs`. A prosa do diagnóstico passa a falar de laboratório
   sempre, o que é verdade e não precisa de ressalva por lead.

O `PSI_INP_NEEDS_MS` e o `PSI_INP_POOR_MS` **continuam definidos**, para ler
linhas antigas e para o dia em que houver fonte de campo de novo.

---

## Onda 0 — sondagem antes de mapeador

Esta seção não é zelo. O documento de impedimentos registra que **os mapeadores
escritos contra documentação falharam contra resposta real**, e que
`mapRankedKeywordsLiveResult` só parou de falhar quando virou fixture de payload
verdadeiro. Nenhum mapeador novo é escrito sem payload real na mão.

Seis perguntas, custo estimado abaixo de US$ 0,05, evidência salva em
`../../auditoria/evidencias/2026-09-15-migracao-dataforseo/` com script `.mjs`,
JSONs crus e `README.md`, no formato que
`evidencias/2026-09-11-lista-ordenada/` já usa.

**Executada em 2026-09-15. US$ 0,0264.** Evidências e respostas cruas em
`../../auditoria/evidencias/2026-09-15-migracao-dataforseo/README.md`.

| # | Pergunta | Resposta medida |
|---|---|---|
| 1 | O `place_id` do item do Maps é o mesmo `ChIJ…` do Places? | **Sim.** `ChIJkchU8A1ZzpQR99LmKcm-kT0`. Os registros existentes continuam válidos — era a única que podia matar o desenho |
| 2 | O `my_business_info` aceita `location_code` de país sem coordenada? | **Sim**, e devolve `latitude`/`longitude` no item. O fallback de coordenada some de verdade. US$ 0,0054 |
| 3 | Onde está `current_status`? | **Não onde a documentação sugeria.** `work_time.work_hours.current_status`, minúsculo. Ver acima |
| 4 | Qual a forma de `work_hours.timetable`? | Confirmada: dia em inglês → lista de `{open:{hour,minute}, close:{hour,minute}}` |
| 5 | O `location_code` de cidade ajuda? | **Não, e o de país também não.** Reprovou o desenho da busca. Ver *Busca*, acima |
| 6 | O Lighthouse devolve os audits que o extrator lê? | Quase: `viewport` virou **`meta-viewport`**, e `interaction-to-next-paint` não existe |

**As duas reprovações valeram o gasto**, e as duas são da mesma família: lidas
no caminho antigo, `current_status` e `viewport` não dariam erro — dariam
`null` e `true`, que na tela viram "sem informação" e "aprovado". Silêncio com
cara de resultado é o defeito que esta etapa já cometeu antes, e é por isso que
mapeador novo não se escreve contra documentação.

As duas fixtures que saíram da onda — um item de Maps e um
`google_business_info` — travam `gbp-maps-candidate.test.mjs` e
`gbp-business-info-map.test.mjs`. **Ressalva:** a empresa medida abre 24 horas
todos os dias, então a fixture não exercita dia fechado nem dois turnos; esses
dois casos ficam em entrada sintética no teste.

---

## Ordem de execução

Cinco ondas depois da 0, cada uma fechando sozinha e deixando a árvore
funcionando.

- **Onda 0 — sondagem.** As seis perguntas, as evidências, as duas fixtures.
  **Concluída em 2026-09-15.**
- **Onda 1 — busca e vínculo.** `maps-search.ts`, os dois mapeadores,
  `search-places.ts`, `gbp-collect.ts`, `linkLeadGbpProfile` unificado, o picker
  com busca explícita e lista rica, **e o ramo de conflito apontando para
  `collectGbpProfile`**. Ao fim desta onda o Places ainda existe, usado só por
  `refresh`, `check-ranking` e briefing.
- **Onda 2 — recoleta.** `recollect-gbp-profile.ts`, o botão único, a remoção do
  fallback de coordenada, a regra nova de `no_photos`. Ao fim, **nenhuma action
  de lead chama o Places.**
- **Onda 3 — briefing.** LocationIQ em autocomplete, detalhe e geocoding; o
  horário sai do caminho do briefing. Ao fim, `lib/places/` não tem chamador.
- **Onda 4 — mapa.** MapLibre nos dois canvas. Ao fim, `lib/google-maps/` não
  tem chamador.
- **Onda 5 — Lighthouse e limpeza.** `lib/dataforseo/lighthouse.ts`, a regra de
  Core Web Vitals só com laboratório, o aviso no card. E então: deletar
  `lib/places/`, deletar `lib/google-maps/`, remover
  `@googlemaps/js-api-loader`, remover as três variáveis do `.env.example` e do
  `.env.local`.

A ordem é por dependência, não por gosto: cada onda remove o último chamador de
alguma coisa, e a onda 5 só pode deletar o que as anteriores esvaziaram.

**A onda 0 mudou a ordem numa coisa.** Como a busca passou a precisar de
centroide e o DataForSEO não geocodifica, a onda 1 depende do
`lib/locationiq/client.ts`, que era da onda 3. O cliente do LocationIQ é escrito
na onda 1; a onda 3 passa a só consumi-lo. Consequência prática: **a chave do
LocationIQ precisa estar configurada antes da onda 1**, e não antes da 3.

---

## Testes

Cada mapeador puro ganha teste `.mjs` contra fixture de payload real, no padrão
de `lib/leads/visibility-labs-map.test.mjs`:

- `lib/leads/gbp-maps-candidate.test.mjs` — item do Maps → candidato
- `lib/leads/gbp-business-info-map.test.mjs` — `google_business_info` →
  `GbpSnapshot`, incluindo a tradução de `current_status` e o montador de
  `weekdayDescriptions`
- `lib/dataforseo/locations.test.mjs` — cidade + UF → `location_code`, com o
  fallback para Brasil

As regras que mudam ganham caso próprio no teste de gaps já existente:
`no_photos` com `totalPhotos: 0`, e Core Web Vitals sem campo.

A verificação de tipos e lint roda **uma vez, no fim**, como bateria completa.

## Riscos, e o que cada um custa

| Risco | Probabilidade | Se acontecer |
|---|---|---|
| `place_id` do DataForSEO diverge do Places | baixa — o `my_business_info` já é chamado hoje com `place_id` vindo do Places e funciona | coluna de identificador nova e migração de reconciliação; a onda 0 descobre antes de qualquer código |
| Busca por nome pior que o autocomplete do Google | média | o `depth` sobe de 20 para 50 ao custo do mesmo preço de tabela, e o `location_code` de cidade entra |
| Latência da busca incomoda o analista | alta, e é inerente | é segundos, com estado de carregamento explícito; em troca a lista mostra o perfil inteiro e o vínculo errado fica mais difícil |
| LocationIQ estoura 5.000/dia | muito baixa no volume atual — o briefing geocodifica uma vez por endereço e o resultado é fechado por `companyAddressFingerprint` | plano pago do próprio LocationIQ, ou trocar o provider de geocoding sem tocar no resto, porque `lib/locationiq/` é a única fronteira |
| Tiles do LocationIQ piores que os do Google | média | é troca estética, não de dado; as duas telas mostram círculo e pontos sobre base, não navegação |
