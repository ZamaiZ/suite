# Redesign da etapa "Website" — especificação

## Objetivo

Reorganizar a etapa **Website** da aba Oportunidade do `LeadDetailDialog`. Hoje ela é um scroll único de sete blocos empilhados dentro do slot genérico do `LeadGbpPanel`: cabeçalho, seletor de canal, quatro cards de resumo, capturas do PageSpeed, autoridade externa, validação visual, três cards de checks e, no fim de tudo, as oportunidades.

O redesign mantém exatamente os mesmos dados — `lead_website_audits`, `lead_website_reviews`, `lead_backlink_audits` — e troca a estrutura pelo shell que a etapa **Perfil no Google** ganhou em `2026-09-10-gbp-perfil-google-redesign-design.md`: cabeçalho fixo com identidade e quatro big numbers, quatro abas internas (`Auditoria · PageSpeed · Validação visual · Autoridade externa`), coluna de oportunidades colapsável à direita com o bloco do analista no pé, e modo reunião.

A spec do GBP fecha dizendo: *"As etapas 2 a 5 da trilha continuam como estão. O padrão de abas mais coluna colapsável pode ser estendido a elas depois, em outra rodada."* Esta é a rodada, e ela também extrai a parte reaproveitável do shell para que Presença digital e Visibilidade não precisem de uma terceira cópia.

**Nenhuma migração de banco. Nenhum token de cor novo. Nenhum achado novo é criado.** Uma server action existente ganha um campo.

## Diagnóstico

Sete constatações, cada uma com o arquivo que a produz. Elas são o motivo de cada decisão adiante.

**Os quatro cards de resumo não são big numbers.** Em `LeadWebsiteSummaryCards.tsx:34` o valor é `text-xs/relaxed font-semibold` — a mesma escala do rótulo logo acima. Não há hierarquia para declarar. Pior: `"12 na amostra"` chega como uma string única, então nem existe um número separado para enfatizar. O `LeadIconWell` à esquerda disputa altura com o valor.

**A autoridade externa é um monólito de texto.** `LeadWebsiteBacklinksCard.tsx` tem 317 linhas, oito métricas em `text-xs` e a leitura da rede de links em parágrafos cinza sequenciais: `"Links por TLD: …"`, `"Links por país: …"`, `"Onde o link mora: …"`. É o tell que `layout.md` nomeia — *meta em `A · B · C`; frase pronta não tem hierarquia para declarar, e o componente só consegue imprimi-la inteira, em cinza*. Distribuição percentual desenhada como frase é a forma errada para o dado.

**A validação visual está separada da evidência que ela julga.** `LeadWebsiteReview` diz "Julgue pelas capturas", e as capturas estão em `LeadWebsiteScreenshots`, um card acima. Responder seis critérios exige seis idas e voltas no scroll.

**As oportunidades estão no fim do scroll.** `LeadWebsitePanel.tsx:404`. Quem lê a etapa para vender percorre a auditoria inteira antes de chegar na lista que interessa.

**Não existe área do analista.** A coluna `notes` de `lead_website_reviews` existe, é selecionada em `website-access.ts:32` e **nada na interface escreve nela**. Hoje ela só é lida como fallback para o critério `other` em `website-review.ts:readWebsiteReview`. O Website é a única etapa da trilha sem campo livre do analista.

**Os três cards de checks têm alturas desiguais e nenhum saldo.** `LeadWebsiteChecks.tsx` usa `xl:grid-cols-3` com 6, 7 e 4 itens; nenhum cabeçalho diz quantos passaram. O estado vem só de ícone e cor, e o número dentro do detalhe (`"3 de 12 páginas sem H1"`) fica em `muted-foreground` junto com o resto da frase.

**`LeadWebsitePanel.tsx` faz tudo.** 475 linhas com estado de canal, polling do PageSpeed, debounce e persistência da revisão, sete derivações e a composição da tela. É o mesmo acúmulo que o `LeadGbpProfileCard` tinha antes do controller.

### Um desalinhamento de contagem, conhecido e mantido

`LeadGbpPanel.tsx:266` calcula `websiteAlertCount` a partir da auditoria do **canal principal**, enquanto o painel mostra o canal **selecionado**. Com mais de um site cadastrado e o analista olhando o secundário, badge da trilha e total da coluna divergem. Não é regressão desta rodada e não entra nela: corrigir exige decidir se a trilha soma todos os canais ou segue a seleção, e essa é uma pergunta de produto. Fica registrado aqui para não ser descoberto como bug.

## Arquitetura

### Árvore de componentes

```
LeadGbpPanel                       grid-cols-[17rem_minmax(0,1fr)]   ← 2 linhas mudam
├─ LeadGbpAuditRail                                                  ← inalterado
└─ ramo selectedStep === "website"                                   ← entra no fullBleed
   └─ LeadWebsiteView              grid-cols-[minmax(0,1fr)_var(--rail-w)]
      ├─ coluna central            grid-rows-[auto_minmax(0,1fr)]
      │  ├─ LeadWebsiteHeader      (fora do scroll)
      │  │  ├─ LeadWebsiteStepHeader     ações + ⋮ + seletor de canal
      │  │  ├─ LeadWebsiteIdentityCell + LeadWebsiteMetricCells
      │  │  ├─ faixa de avisos           coleta, timeout, job falho, erro
      │  │  └─ StepTabs                  com contador por aba
      │  └─ Tabs / TabsContent keepMounted × 4
      │     ├─ LeadWebsiteTabAudit
      │     ├─ LeadWebsiteTabPagespeed
      │     ├─ LeadWebsiteTabReview
      │     └─ LeadWebsiteTabAuthority
      └─ StepOpportunitiesRail     grid-rows-[auto_minmax(0,1fr)_auto]
         └─ LeadWebsiteAnalystBlock
```

A divisão `central | oportunidades` nasce dentro do ramo `website`, exatamente como nasceu dentro do ramo `google-profile`. O grid do `LeadGbpPanel` continua hospedando as cinco etapas sem uma terceira coluna que apareceria vazia nas outras três.

### `useWebsiteController`

Todo o estado e todas as ações saem de `LeadWebsitePanel.tsx` para `components/custom/LeadWebsitePanel/use-website-controller.ts`. O hook recebe `detail`, `canEdit` e os três callbacks; devolve um objeto único que a view repassa às abas e ao rail.

O objeto carrega os derivados (`channels`, `selected`, `audit`, `siteHref`, `gaps`, `sections`, `tally`, `reviewEvidence`, `opportunities`, `backlinkSnapshot`, `collecting`, `jobsActive`, `failedJobs`, `pollTimedOut`), o estado de salvamento (`reviewStatus`, `notesStatus`, `busy`, `error`) e as ações com a assinatura que já têm: `handleAnalyze`, `handleAnalyzeBacklinks`, `handleReviewDraftChange`, `handleNotesDraftChange`, `persistReview`, `persistNotes`, `setSelectedId`.

Os ajustes de estado no render (`syncedChannelsKey`, `syncedAuditId`, `syncedPollKey`), o intervalo de polling, os refs de rascunho e os timers de debounce migram sem mudança de comportamento. Prop única em vez de doze pelo mesmo motivo do GBP: as abas precisam de recortes sobrepostos do mesmo estado.

`LeadWebsitePanel.tsx` sobra com o que é dele: escolher o canal inicial, tratar os dois estados vazios (`nenhum site cadastrado` e `nenhuma coleta`) e montar a `LeadWebsiteView`.

### Estado novo

| Estado | Tipo | Onde mora | Padrão |
| --- | --- | --- | --- |
| `stepTab` | `WebsiteStepTabId` | `LeadWebsiteView` | `"auditoria"`, reset por canal |
| `railOpen` | `boolean` | `use-collapsible-rail` | preferência gravada; sem ela, aberta em `xl` |
| `oppFilter` | `"todas" \| WebsiteStepTabId` | `StepOpportunitiesRail` | `"todas"` |
| `analystField` | `"notes" \| "finding"` | `LeadWebsiteAnalystBlock` | `"notes"` |
| `numbersOpen` | `boolean` | `LeadWebsiteHeader` | `localStorage["website:header-numbers"]`, aberto |
| `shotDevice` | `"mobile" \| "desktop"` | `LeadWebsiteTabReview` | `"mobile"` |
| `okOpen[section]` | `boolean` | `LeadWebsiteAuditCard` | `false` — aprovados nascem recolhidos |

Chaves de `localStorage` novas: `website:opportunities-rail`, `website:analyst-block`, `website:header-numbers`. Namespace próprio: recolher a coluna no GBP não deve recolher no Website, porque a densidade das duas telas é diferente.

Todas as leituras de `localStorage` e `matchMedia` em inicializador preguiçoso de `useState`, nunca no corpo do render.

### `components/custom/LeadStepShell/` — o que é extraído

A etapa Website é a segunda a usar este shell, e Presença digital e Visibilidade são as próximas. O que é genuinamente compartilhado sai de `LeadGbpPanel` para uma pasta neutra; o que ainda é do GBP fica onde está.

| Arquivo novo | Vem de | Importadores a atualizar |
| --- | --- | --- |
| `StepMetrics.tsx` | `LeadGbpPanel/LeadGbpMetrics.tsx` | 3 (`LeadGbpGridCompetitors`, `LeadGbpGridSection`, `LeadGbpReputationRead`) |
| `StepTabs.tsx` | `LeadGbpPanel/LeadGbpStepTabs.tsx`, generalizado | 1 (`LeadGbpProfileHeader`) |
| `StepOpportunityItem.tsx` | extraído de `LeadGbpOpportunitiesCard.tsx` | 1 (`LeadGbpOpportunitiesRail`) |
| `StepOpportunitiesRail.tsx` | shell genérico extraído de `LeadGbpOpportunitiesRail.tsx` | 1 |
| `use-collapsible-rail.ts` | `LeadGbpPanel/use-collapsible-rail.ts`, com `storageKey` | 1 (`LeadGbpProfileView`) |

Renomes em `StepMetrics.tsx`: `GbpTone → StepTone`, `GbpStat → StepStat`, `GbpMeter → StepMeter`, `GbpMeterRow → StepMeterRow`, `GbpSectionLabel → StepSectionLabel`, `GbpCountCell → StepCountCell`. Os comentários que documentam os alfas conferidos por cálculo viajam junto — eles são o motivo de `danger` não ter fundo lavado, e perder isso custaria a auditoria de contraste de novo.

`StepTabs` passa a receber `tabs`, `counts`, `value` e `layoutId`. `StepOpportunitiesRail` recebe `title`, `tabs`, `groups`, `total`, `activeTab`, `railOpen`, `onToggleRail` e um slot `analyst: ReactNode` — o bloco do analista continua sendo de cada etapa, porque os campos que ele edita são diferentes em cada uma.

**`LeadGbpCard` não se move nesta rodada.** Ele tem 21 importadores em cinco painéis; renomeá-lo para `StepCard` é uma passada mecânica de vinte arquivos que não pertence a uma tarefa de UI da etapa Website. Fica como débito registrado, com sua própria aprovação — `checks.md` é explícito: *corrigir um desses débitos é trabalho próprio, não carona*.

`LeadGbpOpportunitiesCard` continua existindo para Diagnóstico, Presença digital e Visibilidade, que ainda são scroll de cards. Só o item de lista sai dele.

### Módulos novos em `lib`

`lib/leads/website-step-tabs.ts` — `WEBSITE_STEP_TABS` (id, rótulo) e `WebsiteStepTabId`.

`lib/leads/website-opportunities.ts` — ganha `WEBSITE_OPPORTUNITY_THEME` e `websiteOpportunitiesByTheme`.

`lib/leads/website-presenters.ts` — ganha `websiteCheckTally` e `websiteCheckGroups`.

## Temas e contagem

Contadores das abas, grupos da coluna e total do rail saem da **mesma** lista. A garantia é de tipo:

```ts
export const WEBSITE_OPPORTUNITY_THEME: Record<
  | WebsiteGapId
  | BacklinkGapId
  | `review:${WebsiteReviewCriterionId}`,
  WebsiteStepTabId
>
```

São 43 gaps de crawl, 9 de backlinks e 7 de revisão — três uniões fechadas. `tsc --noEmit` recusa a compilação se um id novo entrar sem tema, que é a mesma trava que segurou o GBP e é mais barata e mais confiável que um teste num runner que não resolve o alias `@/`.

**PageSpeed (4)** — `slow_performance`, `poor_cwv`, `not_responsive`, `a11y_issues`.

**Validação visual (7)** — os sete `review:*`, todos de `source: "analyst"`.

**Autoridade externa (9)** — todos os `BacklinkGapId`.

**Auditoria (39)** — os demais `WebsiteGapId`: HTTPS, conteúdo misto, indexação, sitemap, canonical, redirects, robots, headers de segurança, titles, metas, headings, conteúdo, imagens, links internos, schema, CTA, contato e NAP.

**A regra do corte, e por que ela não é "quem produz o gap".** `websitePagespeedGaps` produz seis ids, não quatro: além dos quatro acima, ele também levanta `mixed_content` e `noindex`. Os dois ficam em **Auditoria**, porque não são métricas do PageSpeed — são fatos binários sobre o site, com item de check próprio (`Segurança`, `Indexação`) e, no caso de `noindex`, uma segunda fonte no crawl (`website-audit.ts:1021`). Temar por origem faria a mesma checagem mudar de aba conforme qual coleta chegasse primeiro.

A regra é: **os quatro que a aba PageSpeed mede em profundidade vão para PageSpeed; todo o resto segue o card de check onde a evidência mora.** Os itens `Velocidade`, `Core Web Vitals`, `Responsividade` e `Acessibilidade` continuam visíveis nos cards da Auditoria — o item de check é o resumo em uma linha, a aba PageSpeed é a medição com lab, campo e captura, e a oportunidade mora onde ela se resolve. Sem esse corte, a aba PageSpeed nasceria com contador zero permanente.

## Cabeçalho fixo da etapa

Primeira linha do grid da coluna central, fora do scroll. `px-5 pt-4`, `bg-background`, `border-b border-border/70`. Mesma estrutura de `LeadGbpProfileHeader`, inclusive o colapso por `grid-template-rows: 1fr → 0fr` com o filho em `overflow-hidden` e o botão de dobrar na linha das abas.

**Linha de título.** `LeadWebsiteStepHeader` como está, mais três mudanças: ganha `readingMode` (esconde "Atualizar coleta" e "Abrir site"), ganha um `DropdownMenu ⋮` à direita com **Definir como principal**, **Atualizar backlinks** e **Adicionar site**, e o `Select` de canal — hoje um bloco solto de `max-w-sm` abaixo do header — desce para a célula de identidade.

**Faixa de identidade e big numbers.** `mt-3.5`, `grid grid-cols-2 gap-3 items-stretch md:grid-cols-[minmax(0,1.15fr)_repeat(2,minmax(0,1fr))] xl:grid-cols-[minmax(0,1.15fr)_repeat(4,minmax(0,1fr))]`. Os cinco blocos têm a mesma altura — é o ponto do redesign, igual ao do GBP.

A célula de identidade: `rounded-lg px-3 py-2.5 bg-accent/60 ring-1 ring-foreground/[0.06]`, `flex items-center gap-2.5`. Miniatura `size-11 rounded-lg object-cover object-top` da captura desktop (`pagespeed.desktop.screenshot`), com fallback `RiGlobalLine` sobre `bg-primary/10 text-primary` e o mesmo tratamento de `onError` do GBP. Domínio em `text-xs/[1.5] font-semibold truncate`; `finalUrl` abaixo em `text-xs/[1.5] text-muted-foreground truncate`. Linha de badges: `Principal` (`Badge variant="primary"` com `RiStarFill size={12}`) quando `is_primary`, `HTTPS` (`variant="success"` quando `crawl.https`, `variant="warning"` quando não) e `Indexável` / `Sem indexação` a partir de `websiteHomePage(crawl).indexable`. Com dois ou mais canais, o `Select` de troca aparece aqui, `SelectTrigger size="sm"`.

**Os quatro big numbers.** Cada um é a manchete de uma aba e clicar nele troca para ela — `StepStat` embrulhado em `button type="button"` com `aria-label` dizendo o destino. Cada célula usa `StepStat` com um `StepMeter` como `children`, que é o que declara a escala.

| Célula | Valor | Complemento | Medidor | Tom |
| --- | --- | --- | --- | --- |
| `APROVAÇÕES` | `websiteCheckTally(sections).ok` | `de N checks` | `ok / total` | `success` ≥ 80%, `warning` ≥ 50%, senão `danger` |
| `PERFORMANCE` | `websiteMinPerformance(pagespeed)` | `pior entre mobile e desktop` | `score / 100` | `danger` < 50, `warning` < 90, `success` ≥ 90 |
| `VALIDAÇÃO` | `websiteReviewProgress(review).done` | `de 6 critérios julgados` | `done / total` | `primary` |
| `DOMÍNIOS` | `snapshot.referringDomains` | `mediana N no mercado` | `domains / mediana`, teto 1 | `success` ≥ mediana, senão `warning` |

A mediana vem de `competitorReferringDomainsMedian`, que já existe em `backlinks-audit.ts:350` e hoje só é consumida para gerar o gap `behind_on_referring_domains`. Sem concorrentes na coleta, o complemento vira `no total` e o medidor não é renderizado — trilha sem escala mente pior que a ausência dela.

Ausência é `—` com complemento `sem coleta`, nunca zero. A regra já está escrita em `LeadWebsiteBacklinksCard.tsx:29` e passa a valer para as quatro células: *um domínio sem coleta não é um domínio sem autoridade, e a tela não pode confundir os dois.*

**Faixa de avisos.** Linha que só existe quando há o que dizer, entre os big numbers e as abas. Recebe o que hoje está solto no meio do scroll: `"Coletando PageSpeed…"`, `"Ainda coletando o PageSpeed — abra de novo."`, os erros de job falho de `websitePsiJobsFailedWithoutReady` e o erro geral do controller. Fora esses momentos não ocupa altura, e o cabeçalho mantém a altura de projeto.

**Barra de abas.** `StepTabs` com `layoutId="website-step-tab-underline"`. Mesma composição do GBP: `TabsList variant="line"`, `after:hidden` no trigger, `m.span` no ativo, contador `bg-warning/[0.12] text-warning` quando ativa e `bg-accent text-muted-foreground` quando não. Aba sem achados não mostra contador.

**Sem ícone na aba.** A barra do GBP não tem, e duas barras de etapa que diferem custam mais do que o ícone entrega — a aba já é rótulo curto com contador. `WEBSITE_STEP_TABS` carrega só `id` e `label`; o campo `icon` de `GBP_PROFILE_TABS`, que ninguém renderiza, é débito existente e não é copiado.

## Painéis das abas

`TabsContent` com **`keepMounted`** nas quatro — preserva o rascunho da revisão dentro dos 800ms de debounce, o dispositivo escolhido nas capturas e os disclosures de aprovados. Área de scroll `min-h-0 overflow-y-auto px-5 pt-4 pb-5`, fundo `bg-accent/45`. Cards `LeadGbpCard` como hoje; em cada linha de grade, `items-stretch` e nenhum card com altura fixa.

### Auditoria

`grid grid-cols-1 gap-3.5 xl:grid-cols-3 items-stretch` — os três pilares que já existem em `websiteCheckSections`: Estrutura técnica (6), SEO on-page (7), Conversão e UX (4).

Cada card ganha **cabeçalho de saldo**: à direita do título, `4 de 6` em `text-[11px] tabular-nums text-muted-foreground` e um `StepMeter` de `h-1` com a fração de aprovados, no tom da faixa. É o que falta hoje: os cards dizem o estado de cada item e nunca dizem o estado do pilar.

Os itens são reordenados por estado — `error`, `warn`, `pending`, `ok` — e os aprovados entram recolhidos atrás de um disclosure `Ver os 4 aprovados` / `Ocultar`, `text-[11px] text-primary font-medium`, animado pelo colapso de grid. O que precisa de trabalho fica visível sem rolar; o que passou continua auditável.

Cada linha vira `flex items-start gap-2 border-t border-border/70 py-2 first:border-t-0`: ícone de estado no tom atual (`RiCheckboxCircleLine`/`RiErrorWarningLine`/`RiTimeLine`/`RiCloseCircleLine`), rótulo `text-xs/relaxed font-medium text-foreground`, e o detalhe em `muted-foreground` — com uma mudança: quando o detalhe é uma contagem, o número sai da frase. `WebsiteCheckItem` ganha um campo opcional `count?: { value: number; total: number; noun: string }`, preenchido pelo `sampleCount` que hoje monta a string. A linha renderiza `3` em `text-[13px] font-semibold tabular-nums text-warning` seguido de `de 12 páginas sem H1` em cinza. O campo é opcional e `detail` continua obrigatório: nenhum item perde a frase, e quem não tem contagem renderiza como hoje.

Dois helpers novos em `website-presenters.ts`, ao lado de quem monta as seções — é o único lugar onde eles não podem divergir dela:

```ts
websiteCheckTally(sections): { ok, warn, pending, error, total }
websiteCheckGroups(section): { open: WebsiteCheckItem[]; approved: WebsiteCheckItem[] }
```

`total` conta todos os itens, inclusive os `pending`. Um check aguardando PageSpeed **não** é um check aprovado, e somá-lo no numerador faria a fração subir sozinha quando a coleta ainda nem voltou.

### PageSpeed

`grid grid-cols-1 gap-3.5 xl:grid-cols-2 items-stretch` — um card por estratégia, **Mobile** e **Desktop**, irmãos e simétricos.

Cabeçalho do card: rótulo da estratégia, e o score de performance como big number local (`text-[28px] font-semibold tracking-[-0.02em] tabular-nums`) no tom da faixa, com `StepMeter` embaixo.

Corpo, três blocos separados por `border-t border-border/70`:

1. **Core Web Vitals** — três `StepMeterRow`, um por métrica, com **lab e campo lado a lado**: rótulo `LCP`, valor `1,1s lab · 828ms campo`, e a barra medindo contra o limiar (`PSI_LCP_NEEDS_MS`, `PSI_INP_NEEDS_MS`, `PSI_CLS_NEEDS`), com `success` abaixo do limiar e `warning` acima. Hoje isso é a string `"LCP 828ms · INP … · CLS … · campo LCP 1145ms"` inteira em cinza, e o limiar não aparece em lugar nenhum — o leitor não sabe contra o quê. Métrica ausente é `—`; campo ausente diz `sem dado de campo`, que é informação (o site não tem tráfego suficiente no CrUX), não vazio.
2. **Estado** — dois chips: `Viewport` (`viewportOk`) e `Acessibilidade` (`accessibility` com `contrastFails`), no padrão de tom do `StepStat`.
3. **Captura** — a captura daquela execução, `max-h-64 w-full rounded-lg border border-border/70 object-cover object-top`. Ela mora aqui porque foi desta execução que os números saíram; hoje as duas capturas vivem num card próprio que precisa de uma frase explicando por que está ali.

Fila e falha são por estratégia, dentro do card da estratégia: `Aguardando PageSpeed` com `Spinner`, ou a mensagem de erro do job. Some a linha de status solta acima de tudo.

O card de uma estratégia sem coleta mostra a moldura completa com `—` nos números e a área de captura em `border-dashed` — o skeleton promete o layout que vem.

### Validação visual

`grid grid-cols-1 gap-3.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start` — capturas à esquerda, critérios à direita. **É a correção principal desta aba:** o analista julga olhando, sem rolar.

À esquerda, card de capturas com `ToggleGroup` de dois itens (`Mobile` / `Desktop`) no cabeçalho e a captura em `sticky top-0` dentro do painel, altura máxima `calc(100dvh-22rem)`. `ToggleGroup` e não `Toggle`: são opções mutuamente exclusivas numa barra, que é o que `components.md` manda. Sem captura, `border-dashed` com `Aguardando captura`.

À direita, os sete critérios de `WEBSITE_REVIEW_CATALOG` como hoje, com dois ajustes de leitura: a evidência de máquina sobe para um chip `inline-flex h-[22px] px-2 rounded-md bg-accent text-[11px] text-accent-foreground` acima do veredito, em vez de ser um `<p>` cinza indistinguível do rótulo; e o cabeçalho ganha o progresso `3 de 6` com `StepMeter`, no lugar do texto solto de hoje.

O `VerdictGroup`, o `FieldReveal` que revela a nota só quando há veredito e os estados de salvamento ficam como estão — funcionam, e mexer neles é risco sem retorno.

### Autoridade externa

O card de 317 linhas quebra em quatro, `grid grid-cols-1 gap-3.5 xl:grid-cols-2 items-start`.

1. **Perfil do domínio** — `backlinkProfileShape` como manchete em `text-xs/relaxed text-foreground`, e quatro `StepCountCell` (`Rank`, `Backlinks`, `Domínios`, `Links/domínio`) em `grid grid-cols-2 gap-2 sm:grid-cols-4`. O botão de coletar e o `Coletado há…` ficam no cabeçalho deste card.
2. **Composição** — o que hoje são três parágrafos vira **barra empilhada com legenda**, uma por eixo: Dofollow vs nofollow, TLD, país e onde o link mora. `StepMeter` empilhado ou barra segmentada de `h-2 rounded-full` com os cinco `chart-*` — e a legenda embaixo em `grid grid-cols-2 gap-x-4 text-[11px]`, cada item com dot `size-2 rounded-full`, rótulo e `tabular-nums`. O comentário que hoje mora no JSX (*as distribuições contam links, não domínios*) vira o `aside` do `StepSectionLabel`, onde ele é lido em vez de ser cortado do código.
3. **Risco** — card de tom próprio, `border-warning/25 bg-warning/[0.05]` quando há achado e `border-border/70` quando não. Spam score como `StepStat`, e a leitura de rede (`scheme`) com os clusters de âncora e IP em listas de `flex items-baseline justify-between`. A ressalva do provider — *a pontuação diz "parece", não "é"; abrir a página é o que decide* — vira rodapé do card em `text-[10px]`, não mais um parágrafo cinza no meio da pilha. As três frases condicionais sobre truncamento da amostra ficam **verbatim**: elas distinguem "nada encontrado" de "não verificado", e essa distinção é o valor do card.
4. **Mercado** — concorrentes que dividem domínios de referência, cada linha com `StepMeterRow` medindo contra o maior do conjunto, e a mediana marcada. Hoje é uma lista de `domínio · N domínios · M links` em cinza; a comparação, que é o ponto, tem que ser vista.

Coleta anterior aos campos `linkLocations` e `scheme` continua avisando o que faltou, com o texto de hoje.

## Coluna de oportunidades

`StepOpportunitiesRail`, `border-l border-border/70`, `bg-popover/70`, `grid-rows-[auto_minmax(0,1fr)_auto]`, `21.25rem` aberta e `3rem` recolhida.

Cabeçalho com `h3 "Oportunidades"`, contador `N de M`, `Kbd Ctrl B` e o botão de recolher. Chips de filtro `Todas · Auditoria · PageSpeed · Validação · Autoridade`. Lista agrupada na ordem das abas, com cabeçalho de grupo, régua `h-px flex-1 bg-border/70` e contagem; o grupo da aba ativa em `text-primary`. Itens pelo `StepOpportunityItem`, com dot de impacto, título, detalhe em `line-clamp-2` e chip de impacto. Itens de `source: "analyst"` mantêm o prefixo `Analista ·`.

Recolhida, o conteúdo continua montado e recebe `inert`; por cima aparece o rail de 48px com o botão `«`, o badge de contagem, o rótulo vertical e o `RiEditLine` que abre a coluna, abre o bloco e foca o campo. Tudo isso já está escrito e testado em `LeadGbpOpportunitiesRail` — a extração é o que evita reescrevê-lo com pequenas diferenças.

**Bloco do analista** — pé da coluna. Chave segmentada de dois campos:

| Chave | Persiste em | Máximo |
| --- | --- | --- |
| `Notas da etapa` | `lead_website_reviews.notes` | 2000 |
| `Achado visual` | `review.other.note` | 400 (`WEBSITE_REVIEW_NOTE_MAX`) |

Os dois ficam **montados** o tempo todo, o inativo com `hidden` — mesma razão do GBP: o valor vive em `useState(initialValue)` e desmontar devolveria o textarea ao valor do servidor, comendo o rascunho dentro do debounce ou depois de um erro. `LeadGbpNotesCard variant="rail"` é reaproveitado para o campo de notas; o `Achado visual` é o critério `other` de `WEBSITE_REVIEW_CATALOG`, que hoje é a última linha do card de validação e ninguém encontra.

Os dois salvam pela mesma action, com o mesmo debounce de 800ms e o mesmo `onRetry`.

## Notas do analista — caminho de escrita

A coluna existe no banco com `char_length(trim(notes))` entre 1 e 2000, ou nulo. Falta o caminho. Seis arquivos, **sem migração**:

| Arquivo | Mudança |
| --- | --- |
| `lib/leads/website-review.ts` | `websiteReviewsByChannel` passa a devolver `Map<string, { review, notes }>`; **o fallback de `notes` para o critério `other` sai** |
| `lib/leads/website-audit.ts` | `LeadWebsiteAudit` ganha `notes: string \| null`; `readLeadWebsiteAuditRow` e `readLeadWebsiteAudits` repassam |
| `app/actions/leads/website-access.ts` | `loadWebsiteReviewsForLead` e `loadWebsiteReviewForChannel` devolvem o par |
| `app/actions/leads/get-lead.ts` | repassa o mapa novo — o `select` já traz `notes` |
| `lib/validations/lead-website.ts` | `updateWebsiteAuditSchema` ganha `notes`: string opcional, `trim`, máximo 2000, **vazio vira `null`** |
| `app/actions/leads/update-website-audit.ts` | grava `notes` no mesmo `upsert`, e devolve `{ ...audit, review, notes }` |

**O fallback tem que sair.** Hoje `readWebsiteReview(value, fallbackNotes)` copia `notes` para dentro de `other` quando a revisão está vazia. Com o campo de notas na tela, o mesmo texto apareceria em dois lugares e o analista editaria dois campos que são um só. Para as linhas antigas — revisão vazia e `notes` preenchida — o texto passa a aparecer só em `Notas da etapa`, que é onde ele foi escrito.

O vazio precisa virar `null` explicitamente: o check do banco rejeita string de comprimento zero, e um `upsert` com `""` falha com erro de constraint no meio do debounce.

## Colapso, atalho e modo reunião

`use-collapsible-rail` ganha `storageKey` e é chamado com `"website:opportunities-rail"`. O `Ctrl/⌘ + B` continua capturado em `window` na fase de captura, com `preventDefault` e `stopPropagation`, para que o sidebar do app e o painel mobile não reajam junto. O `Ctrl/⌘ + Shift + E` que leva ao bloco do analista segue o mesmo padrão, com `allowInFields` para permitir a volta de dentro do textarea.

`readingMode` desce de `LeadGbpPanel` para `LeadWebsitePanel` — hoje ele para no ramo `google-profile`. Escondidos sob modo reunião: `Atualizar coleta`, `Abrir site`, o `⋮`, `Analisar backlinks`, os `VerdictGroup` da validação (viram texto) e os dois campos do analista (caminho `!canEdit` que `LeadGbpNotesCard` já trata). O modo nunca habilita nada — só esconde.

## Acessibilidade

Abas com semântica do `Tabs` do registry. Botão de colapso com `aria-expanded` e `aria-controls`; coluna recolhida com `inert`, não `aria-hidden`. Big number clicável é `button` com `aria-label` nomeando o destino — `"Ver a aba PageSpeed"` —, porque o rótulo visível é `PERFORMANCE` e sozinho ele não diz que clicar leva a algum lugar.

Estado nunca só por cor: cada item de check mantém o ícone junto do tom, cada chip mantém o texto. As barras de composição da autoridade externa têm legenda com rótulo textual — cinco fatias em tons de verde sem legenda seriam indistinguíveis em monocromia.

A rampa `chart-*` é sequencial, não categórica. Nas barras de composição isso é aceitável porque as fatias **são** ordenadas por participação; a legenda declara a ordem. Em qualquer eixo sem ordem natural, usar tom único com opacidade decrescente.

Contraste: conferir 4,5:1 nos chips de evidência sobre `bg-accent` e nos tons `warning`/`success` sobre fundo `/10`. Os alfas do `StepStat` já vêm conferidos por cálculo; qualquer superfície nova segue a mesma tabela, e `destructive` continua sem lavagem — ele reprova com qualquer alfa.

## Responsivo

Abaixo de `xl`, a coluna nasce recolhida quando não há preferência gravada e o atalho não é registrado; os grids de duas colunas das abas colapsam para uma, e a captura da Validação visual perde o `sticky`. Abaixo de `lg`, o corpo empilha como hoje — trilha em cima — e a coluna de oportunidades vira a última seção do scroll, com o bloco do analista abaixo dela. A faixa de big numbers vai a `grid-cols-2` abaixo de `md`.

## Loading

O skeleton do `LeadWebsitePanel` segue o shell novo: faixa de cinco blocos de 64px, quatro pílulas de aba, três cards altos e coluna direita com seis linhas de 44px. O skeleton de hoje — que não existe, porque o painel só monta com `detail` carregado — passa a existir para o intervalo entre trocar de etapa e ter a auditoria em mãos.

## Cópia

O corpo continua vindo dos presenters, verbatim. Rótulos novos ou alterados:

| Onde | Hoje | Passa a ser |
| --- | --- | --- |
| Big numbers | Segurança, Páginas, Sitemap, Schema | `APROVAÇÕES`, `PERFORMANCE`, `VALIDAÇÃO`, `DOMÍNIOS` |
| Abas | — | `Auditoria`, `PageSpeed`, `Validação visual`, `Autoridade externa` |
| Bloco do analista | — | `Notas da etapa`, `Achado visual` |
| Disclosure de aprovados | — | `Ver os N aprovados` / `Ocultar aprovados` |

`Segurança`, `Sitemap` e `Schema` não desaparecem: os três continuam como itens de check dentro de Estrutura técnica e SEO on-page, que é onde eles têm evidência. O que sai é a duplicação deles como card de resumo sem número.

## Fora de escopo

- Presença digital, Visibilidade e Diagnóstico continuam como estão. O `LeadStepShell` extraído aqui é o que as prepara.
- Renomear `LeadGbpCard` para `StepCard` — 21 importadores, tarefa própria.
- O desalinhamento do badge da trilha com mais de um canal, descrito no diagnóstico.
- Nenhum gap novo é gerado. As oportunidades são as que `websiteGapsForAudit`, `websitePagespeedGaps`, `backlinkGapsForSnapshot` e a revisão já produzem.
- Os três débitos do baseline de `checks.md` (`NavTree`, `DateTimePicker`/`TimePicker`, `LeadGbpAuditStep`).

## Verificação

- `pnpm lint` e `pnpm exec tsc --noEmit` limpos. O `tsc` é o que trava o mapa de temas incompleto.
- Os greps de `checks.md` iguais ao baseline: cor cravada 5, base-ui direto 2, anima sem reduced 1, todo o resto zero.
- Os cinco blocos da faixa com altura idêntica em 1280, 1440 e 1920px; domínio longo trunca sem empurrar as métricas.
- Trocar de aba não recarrega nada, não perde rascunho de nota nem veredito não salvo, e não reinicia o polling do PageSpeed.
- `Ctrl + B` com o dialog aberto move só a coluna do Website; o sidebar do app não reage. A preferência sobrevive a recarregar, e é independente da do GBP.
- Digitar em `Notas da etapa`, trocar para `Achado visual`, trocar de aba e fechar o dialog salva uma vez, sem requisição duplicada. Apagar a nota inteira grava `null` e não estoura a constraint.
- Soma dos contadores das abas igual ao total da coluna, com e sem revisão preenchida e com e sem coleta de backlinks.
- Um lead com PageSpeed só de desktop, um sem backlinks e um sem revisão renderizam os quatro big numbers com `—` e complemento `sem coleta`, nunca zero.
- Comparação lado a lado com a etapa Perfil no Google em 1440×900: mesma altura de faixa, mesma barra de abas, mesma coluna.
