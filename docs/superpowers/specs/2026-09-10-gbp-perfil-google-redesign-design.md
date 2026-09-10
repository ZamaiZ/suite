# Redesign da etapa "Perfil no Google" — especificação

## Objetivo

Reorganizar a etapa **Perfil no Google** da aba Oportunidade do `LeadDetailDialog`. Hoje ela é um scroll único de nove cards em três linhas de grade, com alturas desiguais, a malha geográfica atrás de um disclosure fechado e os dois campos do analista no fim de tudo. O analista rola para preencher e o closer rola para ler.

O redesign mantém exatamente os mesmos dados — `lead_gbp_profiles`, `lead_gbp_snapshots`, `lead_gbp_rank_checks`, `lead_gbp_grid_scans` — e troca a estrutura por: dialog em tela cheia, cabeçalho fixo com identidade e quatro big numbers de altura única, quatro abas internas (`Perfil · Reputação · Ranking · Diretórios`), uma coluna de oportunidades colapsável à direita com o bloco do analista no pé, e um modo reunião que esconde controles de edição.

Nenhuma migração de banco, nenhuma server action nova, nenhum token de cor novo.

Referência visual: `Auditoria Digital.dc.html` do pacote de handoff, prancha **`1a` ("Grade disciplinada")** para a interface, prancha **`2a`** apenas para dois comportamentos — o colapso da coluna e o bloco do analista na lateral.

## Diagnóstico do handoff

O handoff descreve um repositório ligeiramente diferente deste. As correções abaixo estão embutidas em toda a especificação; ficam registradas aqui porque cada uma custaria um ciclo de debug para quem implementasse o texto original.

**O `SidebarProvider` do shadcn não existe neste app.** Não há `components/ui/sidebar.tsx`. Os donos do `Ctrl+B` são dois listeners próprios: `components/custom/Sidebar/Sidebar.tsx:104` e `components/custom/MobileNavigation/MobileNavigation.tsx:191`. Ambos casam `e.ctrlKey && e.code === "KeyB"` em `window`, fase de bubble, e ambos já ignoram `input`/`textarea`/`select`/`contenteditable`. Só o do `Sidebar` tem guarda de largura. Nenhum dos dois olha `metaKey`, então `⌘+B` no macOS não colide com nada.

**Não existe `GbpOpportunityId`.** Os identificadores são `GbpGapId` — 32 valores em `GBP_GAP_IDS` (`lib/leads/gbp.ts:116`) — mais `GBP_REPUTATION_OPPORTUNITY_ID = "reputation_note"`.

**O total da coluna não é o badge da trilha.** O badge vem de `gbpGapsForProfile(...).length` (`LeadGbpPanel.tsx:184`); a coluna vem de `mergeGbpOpportunities(...)`, que é os gaps mais um item quando `reputation_note` está preenchido. Assim que o analista escreve a leitura da reputação, os dois números divergem em 1.

**O teste proposto para o mapa de temas não roda.** `pnpm test` é `node --test "lib/**/*.test.mjs"`, e `gbp-opportunities.ts` importa `@/lib/leads/gbp` — alias que o Node não resolve. O único teste existente do repo contorna isso lendo os fontes como texto.

**A terceira coluna não cabe no grid do `LeadGbpPanel`.** Esse grid hospeda as cinco etapas da trilha; uma coluna de 340px ali apareceria vazia em Website, Presença digital, Visibilidade e Diagnóstico.

**Renderizar só o painel da aba ativa quebra a malha.** `LeadGbpGridSection` guarda o scan em estado local (`:67`) junto com o efeito de `pollLeadGbpGridScan`, e nunca devolve o scan ao pai. Desmontá-lo mata um scan em andamento.

**Desmontar o textarea inativo perde texto.** `LeadGbpNotesCard` guarda `value` em `useState(initialValue)` e só re-sincroniza quando `profileId` muda (`:38`). No remount ele lê `profile.notes` do servidor, não o rascunho.

**As classes de tela cheia propostas não bastam.** `max-h-[calc(100dvh-2rem)]` está fora do condicional em `LeadDetailDialog.tsx:414`, e `tailwind-merge` só substitui chaves iguais.

## Arquitetura

### Árvore de componentes

```
LeadGbpPanel                      grid-cols-[17rem_minmax(0,1fr)]   ← inalterado
├─ LeadGbpAuditRail                                                 ← inalterado
└─ ramo selectedStep === "google-profile"
   └─ LeadGbpProfileView          grid-cols-[minmax(0,1fr)_21.25rem]
      ├─ coluna central           grid-rows-[auto_minmax(0,1fr)]
      │  ├─ LeadGbpProfileHeader  (fora do scroll)
      │  │  ├─ LeadGbpStepHeader
      │  │  ├─ faixa identidade + 4 big numbers
      │  │  ├─ faixa de avisos e vínculo
      │  │  └─ barra de abas
      │  └─ Tabs / TabsContent keepMounted × 4
      │     ├─ LeadGbpTabProfile
      │     ├─ LeadGbpTabReputation
      │     ├─ LeadGbpTabRanking
      │     └─ LeadGbpTabDirectories
      └─ LeadGbpOpportunitiesRail grid-rows-[auto_minmax(0,1fr)_auto]
```

O grid de três colunas da prancha `1a` é montado em dois níveis: as 17rem da trilha continuam no `LeadGbpPanel`, e a divisão `central | oportunidades` nasce dentro do ramo `google-profile`. Visualmente é o mesmo resultado; estruturalmente é o que mantém as outras quatro etapas intocadas. O colapso anima o grid interno.

`LeadGbpProfileCard` deixa de existir com esse nome: seu conteúdo se divide entre o hook de estado e o `LeadGbpProfileView`, que é só composição.

### `useGbpProfileController`

Todo o estado e todas as ações do card atual saem para `components/custom/LeadGbpPanel/use-gbp-profile-controller.ts`. O hook recebe o que o card recebe hoje (`profile`, `profiles`, `companyName`, `location`, `canEdit`, `actionPending`, callbacks) e devolve um objeto único que a view repassa às abas e ao rail como prop.

O objeto carrega: os derivados (`gaps`, `reputation`, `opportunities`, `collecting`, `collectingPosts`, `collectingReviews`, `failedJobs`, `pollTimedOut`, `mapsUri`), o estado de salvamento (`notesStatus`, `savingReplyTime`, `busy`, `error`) e as ações, todas com a assinatura que já têm: `handleRefresh`, `handleEnrich`, `handlePrimary`, `handleRemove`, `handleSaveRankKeywords`, `handleCheckRanking`, `handleReplyTimeChange`, `handleDraftChange`, `handleReputationDraftChange`, `persistNotes`.

Prop única em vez de doze: as abas precisam de recortes sobrepostos do mesmo estado, e assinaturas longas são onde argumentos de mesmo tipo trocam de lugar sem ninguém notar. Um hook em vez de context: esta área do app se comunica por prop, e um context aqui seria o primeiro — o ganho não paga a exceção.

Os refs de rascunho (`notesRef`, `reputationRef`), o timer de debounce e o efeito de flush no unmount migram para o hook sem mudança de comportamento.

### Estado novo

| Estado | Tipo | Onde mora | Padrão |
| --- | --- | --- | --- |
| `readingMode` | `boolean` | `LeadDetailDialog` | ver precedência abaixo |
| `stepTab` | `GbpProfileTabId` | `LeadGbpProfileView` | `"perfil"`, reset por perfil |
| `railOpen` | `boolean` | `use-collapsible-rail` | ver precedência abaixo |
| `oppFilter` | `"todas" \| GbpOpportunityTheme` | `LeadGbpOpportunitiesRail` | `"todas"` |
| `analystField` | `"notes" \| "reputation"` | `LeadGbpOpportunitiesRail` | `"notes"` |
| `gridMounted` | `boolean` | `LeadGbpTabRanking` | `false`, vira `true` na primeira visita e não volta |

Reaproveitados sem mudança: `notesStatus`, `savingReplyTime`, `busy`, `pollTimedOut`, `selectedId`, `selectedStep` e todos os `on*Change` do dialog.

**Precedência de `readingMode`.** Quando `canEdit === false`, o modo está ligado e o botão não aparece — não há o que esconder de quem já não edita. Quando `canEdit === true`, o valor inicial é o que estiver em `localStorage["gbp:reading-mode"]`, e `false` se não houver nada. Escrito como expressão: `canEdit ? (stored ?? false) : true`.

**Precedência de `railOpen`.** A preferência gravada em `localStorage["gbp:opportunities-rail"]` (`"open" | "closed"`) vence sempre que existe. Sem preferência gravada, a coluna nasce aberta em `xl` e acima, recolhida abaixo disso. Escrito como expressão: `stored ?? matchMedia("(min-width: 80rem)").matches`.

Os dois são lidos em inicializador preguiçoso de `useState`, nunca no corpo do render. O `DialogContent` só monta quando o dialog abre, então não há passada de servidor para divergir — mas o inicializador preguiçoso é o que garante isso mesmo se o dialog um dia montar fechado.

### Módulos novos em `lib`

`lib/leads/gbp-profile-tabs.ts` exporta `GBP_PROFILE_TABS` (id, rótulo, ícone) e `GbpProfileTabId`.

`lib/leads/gbp-opportunities.ts` ganha `GbpOpportunityTheme`, o mapa `GBP_OPPORTUNITY_THEME` e o helper `gbpOpportunitiesByTheme`.

## Temas e contagem

Contadores das abas, grupos da coluna e badge da trilha saem da **mesma** lista. A garantia de que não divergem é de tipo, não de teste: o mapa é declarado como

```ts
Record<GbpGapId | typeof GBP_REPUTATION_OPPORTUNITY_ID, GbpOpportunityTheme>
```

e `tsc --noEmit` recusa a compilação se um id novo entrar em `GBP_GAP_IDS` sem tema. `gbpOpportunitiesByTheme` é um reduce sobre a lista recebida, então a soma dos grupos é a lista, estruturalmente.

**Perfil (19)** — `name_mismatch`, `missing_website`, `website_unmatched`, `missing_hours`, `no_photos`, `few_photos`, `closed`, `unclaimed`, `no_secondary_categories`, `missing_description`, `thin_description`, `no_services`, `no_posts`, `stale_posts`, `unanswered_questions`, `category_off_segment`, `description_missing_services`, `description_missing_region`, `description_missing_category`.

**Reputação (11)** — `low_rating`, `few_reviews`, `weak_review_replies`, `unreplied_negative_reviews`, `slow_review_replies`, `review_burst`, `latest_review_unanswered`, `negative_replies_ignored`, `dormant_reviews`, `reviews_removed`, `reputation_note`.

**Ranking (1)** — `not_in_map_top3`.

**Diretórios (2)** — `missing_directory_listings`, `directory_nap_mismatch`.

Duas classificações são deliberadas e não óbvias. `no_photos` e `few_photos` não têm card em aba nenhuma — só o big number `FOTOS` no cabeçalho fixo; ficam em Perfil por ser o menos errado. `unanswered_questions` fica em Perfil porque o card de Q&A mora nessa aba.

O handoff descrevia achados de Ranking para SoLV, ARP e ausência na malha. Eles não existem em `GBP_GAP_IDS` e não serão criados aqui — Ranking tem um id só, e é por isso que o lead de referência mostra "Ranking 1".

**Reconciliação do badge da trilha.** `LeadGbpPanel` passa a calcular `googleAlertCount` com `mergeGbpOpportunities(...).length` em vez de `gbpGapsForProfile(...).length`. Uma fonte só para trilha, abas e coluna. O badge sobe 1 quando o analista escreve a leitura da reputação, o que é o comportamento correto: é um achado que entrou na lista.

## Shell do dialog

`DialogContent` em `LeadDetailDialog.tsx` passa a ter, no ramo `tab === "opportunity"`, **quatro** overrides — `h-[calc(100dvh-1rem)]`, `max-h-[calc(100dvh-1rem)]`, `w-[calc(100%-1rem)]`, `max-w-none`. O `max-h` é obrigatório: `tailwind-merge` resolve por chave, e sem ele o `max-h-[calc(100dvh-2rem)]` das classes base continua clampando a altura. As abas `activity` e `record` seguem com as dimensões de hoje.

`LeadDetailHeader` ganha três props: `readingMode`, `onReadingModeChange` e `showReadingMode`. O botão **Modo reunião** entra entre o contador de atividades e o `LeadClaimActions`, só quando `showReadingMode` — que o dialog liga quando a aba ativa é `opportunity` e `canEditGbp` é verdadeiro. `Button variant="outline"`, altura 28px, `text-muted-foreground`; quando ligado, ponto `size-1.5 rounded-full bg-primary` antes do rótulo. Separador `w-px h-5 bg-border` depois dele.

`readingMode` desce como prop: `LeadDetailDialog → LeadGbpPanel → LeadGbpProfileView → controller`.

## Cabeçalho fixo da etapa

Primeira linha do grid da coluna central, fora do scroll. `px-5 pt-4`, `bg-background`, `border-b border-border/70`.

**Linha de título.** `LeadGbpStepHeader` como está, mais uma prop `readingMode`: sob modo reunião, "Atualizar coleta" e "Ver no Google" saem. O `DropdownMenu ⋮` de ações do perfil, que hoje é irmão do `StepHeader` no `LeadGbpProfileCard`, entra dentro do `StepHeader`, à direita — e some sob modo reunião. Ele ganha um item novo, **Adicionar perfil**, que abre o `LeadGbpPlacePicker` (ver faixa de avisos abaixo).

**Faixa de identidade e big numbers.** `mt-3.5`, `grid grid-cols-[minmax(0,1.15fr)_repeat(4,minmax(0,1fr))] gap-3 items-stretch`. Os cinco itens têm a mesma altura — é o ponto do redesign.

A célula de identidade substitui o card do `LeadGbpIdentity`: `rounded-lg px-3 py-2.5 bg-accent/60 ring-1 ring-foreground/[0.06]`, `flex items-center gap-2.5`. Capa `size-11 rounded-lg object-cover` de `enrichment.mainImageUrl`, com o fallback de iniciais que já existe (`bg-primary/10 text-primary text-[13px] font-semibold`) e o mesmo tratamento de `onError`. Nome `text-xs/[1.5] font-semibold truncate`. `Badge variant="primary"` com `RiStarFill size={12}` quando `is_primary`. Endereço `text-xs/[1.5] text-muted-foreground truncate`. Linha de badges com status operacional (`bg-success/10 text-success` quando `OPERATIONAL`, `bg-accent text-muted-foreground` caso contrário) e reivindicação (`Badge variant="success"` / `variant="warning"`). Com dois ou mais perfis, o `Select` de troca aparece aqui, `SelectTrigger size="sm"`.

As quatro células de métrica substituem os cards do `LeadGbpSummaryCards` e perdem o `LeadIconWell` — o número é o elemento. `rounded-lg px-3 py-2.5 bg-card ring-1 ring-foreground/10`, `flex flex-col justify-center gap-0.5`. Rótulo `text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground`. Valor `text-[26px] font-semibold tracking-[-0.02em] leading-[1.15] tabular-nums`, `—` quando nulo. Complemento `text-[11px] text-muted-foreground`. As fontes continuam `formatGbpRating`, `formatGbpCount`, `gbpPhotosLabel` e `bestMapsPosition`.

**Faixa de avisos e vínculo.** Linha que só existe quando há o que dizer, entre a faixa de big numbers e as abas. Ela recebe o que hoje está solto no ramo `google-profile` do `LeadGbpPanel`: o aviso "N sites sem perfil vinculado" com o botão Revisar, a mensagem de erro de vínculo com o link para o cadastro existente, as mensagens de coleta ("Coletando postagens…", "Coletando avaliações…", "Ainda coletando — abra de novo."), os erros de job falho e o erro geral do controller. O `LeadGbpPlacePicker` abre nessa faixa, empurrando as abas para baixo enquanto estiver aberto; fecha ao vincular. Fora esses momentos a faixa não ocupa altura, e o cabeçalho fixo mantém a altura de projeto.

O botão "Adicionar perfil", hoje solto no fim do scroll, deixa de existir como botão de página e vira item do menu `⋮`.

**Barra de abas.** `mt-3.5 flex gap-6`. Usa `Tabs` do registry com `variant="line"`, `TabsList` e `TabsTrigger` — a mesma composição que `LeadDetailHeader` já faz para as abas do dialog, inclusive o sublinhado: `after:hidden` no trigger e um `m.span` com `layoutId="gbp-step-tab-underline"` no ativo, `absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary`, `duration 0.18` e `ease [0.23, 1, 0.32, 1]`. Com `useReducedMotion`, o `layoutId` sai e a duração cai para `0.12`.

Rótulo `text-[13px]`, ativa `font-semibold text-foreground`, inativa `font-medium text-muted-foreground`. Contador `inline-flex h-[18px] px-1.5 rounded-md text-[10px] font-semibold tabular-nums`; ativa `bg-warning/[0.12] text-warning`, inativa `bg-accent text-muted-foreground`. Aba sem achados não mostra contador.

## Painéis das abas

`TabsContent` com **`keepMounted`** nas quatro. É o que preserva o scan em andamento da malha, o rascunho de termos do `LeadGbpRankBlock`, o "Ver mais" da descrição e o estado de expansão das avaliações ao trocar de aba — e é o que o `LeadDetailDialog` já faz na aba `record` (`LeadDetailDialog.tsx:513`). `TabsContent` repassa a prop para o `Tabs.Panel` do Base UI (`components/ui/tabs.tsx:71`), então não há componente novo para isso.

Área de scroll: `min-h-0 overflow-y-auto px-5 pt-4 pb-5`, fundo `bg-accent/45`. Cards internos `rounded-lg bg-card ring-1 ring-foreground/10 p-3`, título `h3 text-sm font-semibold`, corpo `text-xs/relaxed`. Em cada linha de grade, `items-stretch` e `h-full` nos cards; nenhum card com altura fixa.

**Perfil** — `grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-3.5 items-start`.

`LeadGbpInformationCard` reaproveitado, com as linhas em duas colunas (`grid grid-cols-2 gap-x-5`), cada linha `flex items-start gap-2.5 py-2 border-t border-border/70` com `LeadIconWell`, rótulo `text-xs/relaxed text-muted-foreground` e valor `text-xs/relaxed`. Ordem: Categoria principal, Categorias secundárias, Telefone, Site no perfil, Site do cadastro, Horário, Status, Reivindicação. Os gaps continuam pintando `text-warning` com `RiAlertLine`. A descrição sai da lista e vira bloco no pé do card, `border-t border-border/70 pt-2.5`, texto `text-xs/[1.7] line-clamp-4` e o botão Ver mais/Ver menos em `text-primary font-medium`.

Coluna direita empilhada em `grid gap-3.5`: **Serviços** extraído para `LeadGbpServicesCard` — cabeçalho com "N declarados" e os itens como chips `inline-flex h-[22px] px-2 rounded-md bg-accent text-[11px] text-accent-foreground`, porque a lista vertical de 18 linhas é o que estica a coluna hoje; **Postagens** (`LeadGbpPostsBlock`) em `grid grid-cols-[120px_minmax(0,1fr)] gap-3`, thumb `h-24 w-full rounded-lg object-cover` com fallback `RiImageLine` sobre `bg-background`, texto `line-clamp-3`, data por `formatRelativeShort` e link "Ver postagem ↗"; **Perguntas (Q&A)** (`LeadGbpQnaBlock`) como card curto.

**Reputação** — `grid grid-cols-2 gap-3.5 items-start`. `LeadGbpReviewsBlock` divide-se em dois cards.

À esquerda, distribuição e leitura: nota `text-[40px] font-semibold tracking-[-0.03em] tabular-nums` seguida de "de 5 · N avaliações"; as barras atuais com `star` `w-6`, trilha `h-1.5 rounded-full bg-accent` e contagem `w-6 text-right tabular-nums`, tons 5 `bg-success`, 4 `bg-warning`, 3 `bg-warning/70`, 2 `bg-muted-foreground/40`, 1 `bg-destructive/80`; a caixa de leitura da amostra `rounded-lg border border-border/70 px-3 py-2` com as linhas de `gbpReputation` uma por parágrafo `text-xs/relaxed`, destaques em `text-foreground` e o resto em `text-muted-foreground`, na ordem de hoje; e a linha de tempo de resposta com o `Select size="sm"` das faixas `GBP_REPLY_TIME_*`.

À direita, avaliações em destaque: cabeçalho com link "Ver todas as N", itens `rounded-lg border border-border/70 px-3 py-2.5`, meta com cinco `RiStarFill size={12}` (preenchidas `text-warning`, vazias `text-border`) e `formatDateTimeShort`, chip "Respondida" `bg-success/10 text-success` quando há `ownerAnswer`, texto `line-clamp-3`.

**Ranking** — `grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-3.5 items-start`. `LeadGbpRankBlock` e `LeadGbpGridSection` deixam de ser aninhados e viram irmãos.

A malha ocupa o card grande à esquerda. O disclosure `open`/`setOpen` sai e os controles (Keyword, Malha, Execução, Raio, Rodar malha, custo e requisições) sobem para o cabeçalho do card, em linha. O cabeçalho traz o meta `"keyword" · 7×7 · 5 km · fila · N de N pontos · US$ X` com `formatUsd`, e as métricas ARP/ATRP/SoLV com rótulo `text-[11px] uppercase tracking-[0.06em] text-muted-foreground` e valor `text-[22px] font-semibold tabular-nums`.

O `LeadGbpGridMap` monta na primeira visita à aba Ranking e permanece montado dali em diante — `gridMounted` só vai de `false` para `true`. Sem isso, `keepMounted` faria o Google Maps JS e os tiles carregarem em todo perfil aberto, inclusive nos que ninguém vai olhar; com isso, o custo só aparece para quem entra na aba. O card renderiza o cabeçalho, as métricas e a legenda desde o começo; só o mapa é adiado. `className="h-[300px] rounded-lg"`, marcadores `scale: 12`, rótulo 11px/600, faixas de `GBP_GRID_BANDS`, legenda com dots `size-2.5` e `text-xs/relaxed text-muted-foreground`.

À direita, dois cards: **Ranking no Maps** com a tabela `Termo · Posição · Data · Maps`, chip de posição `rounded-md px-1.5 py-0.5 text-xs/relaxed font-medium` no `positionTone` atual, `Input h-7` e `Button variant="outline"` "Checar ranking", máximo de 3 termos; e **Quem aparece na região** com `gbpGridPositionSnapshot`, cabeçalho "Em N células medidas · o perfil não aparece em M" e até 8 linhas de título mais "N células · pos. média X · à frente em Y" em `tabular-nums`.

**Diretórios** — um card só, largura total. Cabeçalho com o texto explicativo atual verbatim (`max-w-[640px] text-xs/relaxed text-muted-foreground`) e os três resumos: cadastrados em `text-success`, divergentes em `text-destructive`, ausentes em `text-warning`. Lista dos 22 diretórios em `grid grid-cols-3 gap-x-6`, cada linha `flex items-center justify-between py-1.75 border-t border-border/70` com link `text-xs/relaxed` no tom do estado (`present` `text-success`, `absent` `text-warning`, `nap_mismatch` `text-destructive`, nulo `text-muted-foreground`) e `Select size="sm"`.

## Coluna de oportunidades

`border-l border-border/70`, `bg-popover/70`, `grid-rows-[auto_minmax(0,1fr)_auto]`, `min-h-0`.

**Cabeçalho** — `px-4 pt-4 pb-3 border-b border-border/70`. `h3` "Oportunidades" `text-sm font-semibold` e contador "N de M" `text-xs/relaxed tabular-nums text-muted-foreground`. `Kbd` com `Ctrl B` e o botão de recolher `»` (`Button variant="outline" size="icon-sm"`, `aria-label="Recolher oportunidades"`, `aria-expanded`, `aria-controls`). Chips de filtro `Todas · Perfil · Reputação · Ranking · Diretórios`, `h-6 px-2.5 rounded-full text-[11px] font-medium`, ativo `bg-primary text-primary-foreground border-primary` e inativo `bg-card text-muted-foreground border-border`. Filtram em memória; nenhuma requisição. Trocar de aba **não** muda o filtro — a coluna mostra tudo por padrão e a aba ativa só destaca visualmente seu grupo.

**Lista** — `min-h-0 overflow-y-auto px-4 pt-3 pb-4`. Grupos na ordem Perfil, Reputação, Ranking, Diretórios; cabeçalho de grupo `text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground` com régua `h-px flex-1 bg-border/70` e contagem `text-[11px] tabular-nums`. O grupo da aba ativa usa `text-primary`. Itens `flex items-start gap-2 px-2.5 py-2 rounded-lg bg-card ring-1 ring-foreground/[0.08]`, dot `size-1.5 rounded-full mt-1.5` (`bg-warning` para alto, `bg-border` para médio), título `text-xs/[1.5]`, detalhe `text-[11px] text-muted-foreground line-clamp-2`, chip de impacto `text-[10px] font-medium rounded-md px-1.5 py-0.5` (`bg-warning/10 text-warning` / `bg-accent text-muted-foreground`). Itens com `source === "analyst"` mantêm o rótulo "Analista" no detalhe.

`LeadGbpOpportunitiesCard` reduz-se ao item de lista e passa a ser usado só aqui.

**Bloco do analista** — pé da coluna, `px-4 pt-3 pb-4 border-t border-border/70 bg-popover`. Cabeçalho "Bloco do analista" `text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground` com o contador `N/2000 tabular-nums` do campo visível. Chave segmentada de dois botões, `p-[3px] rounded-lg bg-border/60`, ambos `flex-1 h-6.5 rounded-md text-[11px] font-semibold`, ativo `bg-card text-foreground shadow-xs` e inativo `text-muted-foreground`. Rodapé "Salva automaticamente enquanto você digita." `text-[11px] text-muted-foreground`, com os estados `Salvando…`, `✓ Salvo agora` e erro mais "Salvar notas" que `LeadGbpNotesCard` já trata.

`LeadGbpNotesCard` ganha `variant="rail"`: sem card externo, `Textarea` `h-24 resize-none rounded-lg bg-background text-xs/[1.6]`, contador e estados de salvamento na linha do cabeçalho.

**Os dois campos ficam montados o tempo todo**; o inativo recebe o atributo `hidden`. Desmontá-lo devolveria o textarea ao `initialValue` no remount — que é `profile.notes` do servidor, não o rascunho — e o texto digitado dentro dos 800ms de debounce, ou depois de um erro de salvamento, voltaria atrás na tela. Manter os dois montados custa um textarea escondido e resolve o problema na raiz.

As duas instâncias antigas do `LeadGbpNotesCard` saem da grade do corpo. O efeito de flush no unmount continua no controller.

**Estado recolhido** — a coluna vai de `21.25rem` a `3rem`. O conteúdo da coluna **continua montado** e recebe `inert`; o que aparece por cima, na faixa de 48px, é um rail próprio: `flex flex-col items-center gap-3.5 py-3.5 border-l border-border/70 bg-popover` com o botão `«` (`size-7 rounded-lg border border-border/70`, `aria-label="Abrir oportunidades"`), badge de contagem `min-w-[22px] h-[18px] rounded-full bg-warning/[0.12] text-[10px] font-semibold text-warning tabular-nums`, rótulo vertical `[writing-mode:vertical-rl] text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground` e, no pé, um `RiEditLine`.

Manter o conteúdo montado é o que preserva o filtro escolhido, o campo do analista selecionado e o rascunho não salvo enquanto a coluna está fechada — e é o que dá à transição algo para desvanecer. O `RiEditLine` chama `open()` e, no callback do fim da transição, foca o `Textarea` ativo por ref.

## Colapso e atalho

`components/custom/LeadGbpPanel/use-collapsible-rail.ts` devolve `railOpen`, `toggle`, `open` e `close`, e grava a preferência em `localStorage`. Fica ao lado do componente, e não em `hooks/`, pelo mesmo motivo do controller: a chave de `localStorage`, o breakpoint e a condição de registro do atalho são desta coluna, não de um comportamento reutilizável.

**Transição.** `grid-template-columns` do grid interno do `LeadGbpProfileView`, `320ms cubic-bezier(0.23, 1, 0.32, 1)`. O conteúdo da coluna acompanha com `opacity 220ms ease` (delay de 80ms ao abrir) e `translate-x-3 → 0`. Com `useReducedMotion`, sem transform e 120ms.

**Atalho.** `keydown` em `window` com `{ capture: true }`, condição `e.code === "KeyB" && (e.ctrlKey || e.metaKey) && !e.repeat`, seguida de `preventDefault()` e `stopPropagation()`. A condição casa `e.code` — e não `e.key` — porque é exatamente o que `Sidebar.tsx` e `MobileNavigation.tsx` testam; casar por `e.key` deixaria layouts de teclado onde os dois handlers discordam. A captura em `window` acontece antes da fase de bubble em `window`, que é onde os dois listeners do app estão, então `stopPropagation()` impede que o sidebar e o painel mobile reajam junto.

O listener ignora alvos `input`, `textarea`, `select` e `[contenteditable]`, como os dois handlers existentes já fazem — é o que mantém `Ctrl+B` inofensivo dentro do textarea do analista. Ele só é registrado quando o dialog está aberto, a aba ativa é `opportunity` e a viewport está em `xl` ou acima; abaixo disso a coluna não é uma coluna e o atalho volta a ser do app. Com o dialog fechado, nada é registrado.

## Modo reunião

O modo nunca habilita nada — só esconde. `canEdit` continua vindo de `detail.canEditGbp && !readOnly`, e o modo reunião é um filtro por cima disso.

Escondidos: "Atualizar coleta", o `⋮` de ações do perfil, "Rodar malha" e os controles da malha, "Checar ranking" e o `Input` de termos, o `Select` de tempo de resposta. Os `Select` de estado dos diretórios viram texto. Os dois campos do analista viram texto puro — o caminho `!canEdit` que `LeadGbpNotesCard` já trata. O botão de toggle some quando `canEdit === false`, porque nesse caso não há nada para alternar.

## Acessibilidade

As abas ganham semântica pelo `Tabs` do registry: `role="tablist"`, `aria-selected` e navegação por seta vêm do Base UI.

O botão de colapso tem `aria-expanded` e `aria-controls` apontando para a coluna. A coluna recolhida recebe o atributo **`inert`** em vez de `aria-hidden` mais `pointer-events-none`: `aria-hidden` sobre conteúdo que ainda contém elementos focáveis deixa o foco entrar em algo que o leitor de tela não anuncia. React 19.2 suporta `inert` como prop booleana, e ele resolve foco, ponteiro e árvore de acessibilidade de uma vez.

Ordem de foco: trilha, cabeçalho da etapa, abas, painel ativo, coluna. Foco visível em tudo — o anel padrão do app já cobre.

Contraste: conferir 4,5:1 em texto sobre `bg-accent` e nos chips `text-warning`/`text-success` sobre fundo `/10`. Se algum cair abaixo, usar o token cheio no texto, nunca uma versão com alfa.

## Responsivo

Abaixo de `xl`, a coluna nasce recolhida quando não há preferência gravada, e o atalho não é registrado. Abaixo de `lg`, o corpo volta a empilhar como hoje — trilha em cima —, o grid de duas colunas do `LeadGbpProfileView` colapsa para uma, e a coluna de oportunidades vira a seção final do scroll com o bloco do analista abaixo dela.

## Loading

O skeleton do `LeadGbpPanel` segue o shell novo: trilha como hoje, faixa de cinco blocos de 64px, barra de quatro pílulas de aba, grade de dois cards altos e coluna direita com seis linhas de 44px. O `Pulse` antigo do skeleton de nove cards sai.

## Cópia

A cópia de corpo continua vindo dos presenters, verbatim. Três rótulos mudam, porque os atuais não cabem no espaço novo:

| Onde | Hoje | Passa a ser |
| --- | --- | --- |
| Big numbers | Nota no Google, Avaliações, Fotos, Melhor posição | `NOTA`, `AVALIAÇÕES`, `FOTOS`, `MELHOR POSIÇÃO` |
| Badge de identidade | Perfil principal | `Principal` |
| Chip de impacto (`GBP_IMPACT_LABEL`) | Alto impacto, Médio impacto | `Alto`, `Médio` |

`GBP_IMPACT_LABEL` é o rótulo que muda em `lib`; os outros dois são string literal de componente.

## Fora de escopo

As etapas 2 a 5 da trilha — Website, Presença digital, Visibilidade, Diagnóstico — continuam como estão. O padrão de abas mais coluna colapsável pode ser estendido a elas depois, em outra rodada.

Nenhum achado novo é criado: os gaps de SoLV, ARP e ausência na malha que o handoff descrevia ficam para quando alguém decidir gerá-los em `gbpGapsForProfile`.

As pranchas `1b` e `1c` do arquivo de referência estão descartadas; `0a` serve só para diff visual.

## Verificação

- `pnpm lint` e `pnpm exec tsc --noEmit` limpos. O `tsc` é o que trava o mapa de temas incompleto.
- Os cinco blocos da faixa de identidade com altura idêntica em 1280, 1440 e 1920px; nome longo trunca sem empurrar as métricas.
- Trocar de aba não recarrega nada, não perde rascunho de notas nem de termos de ranking, e não interrompe um scan de malha em andamento.
- `Ctrl + B` com o dialog aberto move só a coluna; o sidebar do app não reage. Com o dialog fechado, o atalho volta a ser do sidebar. A preferência sobrevive a recarregar a página.
- Digitar no bloco do analista, trocar de campo, trocar de aba e fechar o dialog salva uma vez, sem requisição duplicada; erro mostra "Salvar notas" e o retry funciona.
- Contador da trilha, soma dos contadores das abas e total da coluna são o mesmo número, com e sem leitura da reputação preenchida.
- Comparação lado a lado com a prancha `1a` em 1440×900.
