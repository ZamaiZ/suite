# Redesign da etapa "Perfil no Google" — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** reorganizar a etapa Perfil no Google em dialog de tela cheia, com cabeçalho fixo, quatro abas internas e uma coluna de oportunidades colapsável que hospeda o bloco do analista.

**Architecture:** o estado e as ações do `LeadGbpProfileCard` saem para um hook (`useGbpProfileController`), que devolve um objeto único; o `LeadGbpProfileView` compõe cabeçalho fixo, quatro `TabsContent keepMounted` e a coluna de oportunidades. O grid de três colunas da prancha `1a` nasce em dois níveis — as 17rem da trilha continuam no `LeadGbpPanel`, e a divisão `central | oportunidades` fica dentro do ramo `google-profile`, o que mantém as outras quatro etapas da trilha intocadas.

**Tech Stack:** Next.js 16 (App Router), React 19.2, Tailwind v4, shadcn sobre `@base-ui/react`, `react-icons/ri`, `motion` v13 (`motion/react` + `motion/react-m`).

**Spec:** `docs/superpowers/specs/2026-09-10-gbp-perfil-google-redesign-design.md`

## Global Constraints

- **Nenhum token de cor novo.** Todos os valores citados no spec existem em `app/globals.css`. Nada de hex ou oklch escrito à mão.
- **Nenhuma migração, nenhuma server action nova.** As assinaturas de `updateLeadGbpProfile`, `updateLeadGbpAnalystReview`, `updateLeadGbpRankKeywords`, `checkLeadGbpRanking`, `refreshLeadGbpProfile`, `enrichLeadGbpProfile`, `removeLeadGbpProfile`, `pollLeadGbpJobs`, `pollLeadGbpGridScan` e `startLeadGbpGridScan` não mudam.
- **Cópia de corpo verbatim dos presenters.** Só três rótulos mudam, na Task 4 e na Task 7: big numbers para `NOTA` / `AVALIAÇÕES` / `FOTOS` / `MELHOR POSIÇÃO`, badge de identidade para `Principal`, e `GBP_IMPACT_LABEL` para `Alto` / `Médio`.
- **Estado derivado de prop se ajusta no render, não em efeito.** É o padrão de todo este diretório (`const [synced, setSynced] = useState(x); if (synced !== x) { ... }`). Manter.
- **`motion`:** `useReducedMotion` de `motion/react`, `* as m` de `motion/react-m`. `EASE = [0.23, 1, 0.32, 1]`, duração `0.18` normal e `0.12` reduzida.
- **Modo reunião nunca habilita nada** — só esconde. `canEdit` continua sendo `detail.canEditGbp && !readOnly`.
- **Verificação de cada task:** `pnpm lint` e `pnpm exec tsc --noEmit` limpos. Este repo não tem runner de teste de componente (`pnpm test` é `node --test "lib/**/*.test.mjs"`), então a checagem de comportamento é feita no preview do browser, descrita passo a passo em cada task.

## Estrutura de arquivos

**Criar**

| Arquivo | Responsabilidade |
| --- | --- |
| `lib/leads/gbp-profile-tabs.ts` | `GbpProfileTabId`, `GBP_PROFILE_TABS` |
| `components/custom/LeadGbpPanel/use-gbp-profile-controller.ts` | todo o estado e todas as ações da etapa |
| `components/custom/LeadGbpPanel/use-collapsible-rail.ts` | `railOpen`, persistência, atalho `Ctrl/⌘ + B` |
| `components/custom/LeadGbpPanel/LeadGbpProfileView.tsx` | grid `central \| coluna`, composição |
| `components/custom/LeadGbpPanel/LeadGbpProfileHeader.tsx` | cabeçalho fixo (título, faixa, avisos, abas) |
| `components/custom/LeadGbpPanel/LeadGbpIdentityCell.tsx` | célula de identidade da faixa |
| `components/custom/LeadGbpPanel/LeadGbpMetricCells.tsx` | as quatro células de big number |
| `components/custom/LeadGbpPanel/LeadGbpStepNotices.tsx` | faixa de avisos, erros e picker |
| `components/custom/LeadGbpPanel/LeadGbpStepTabs.tsx` | barra de abas com contadores |
| `components/custom/LeadGbpPanel/LeadGbpTabProfile.tsx` | painel Perfil |
| `components/custom/LeadGbpPanel/LeadGbpTabReputation.tsx` | painel Reputação |
| `components/custom/LeadGbpPanel/LeadGbpTabRanking.tsx` | painel Ranking, com o mount preguiçoso da malha |
| `components/custom/LeadGbpPanel/LeadGbpTabDirectories.tsx` | painel Diretórios |
| `components/custom/LeadGbpPanel/LeadGbpServicesCard.tsx` | Serviços em chips |
| `components/custom/LeadGbpPanel/LeadGbpOpportunitiesRail.tsx` | coluna aberta e rail recolhido |
| `components/custom/LeadGbpPanel/LeadGbpAnalystBlock.tsx` | chave segmentada + os dois campos |

**Modificar**

`lib/leads/gbp-opportunities.ts` · `LeadDetailDialog.tsx` · `LeadDetailHeader.tsx` · `LeadGbpPanel.tsx` · `LeadGbpStepHeader.tsx` · `LeadGbpInformationCard.tsx` · `LeadGbpReviewsBlock.tsx` · `LeadGbpRankBlock.tsx` · `LeadGbpGridSection.tsx` · `LeadGbpDirectoriesCard.tsx` · `LeadGbpNotesCard.tsx` · `LeadGbpOpportunitiesCard.tsx` · `LeadGbpPostsBlock.tsx`

**Remover ao final (Task 10)**

`LeadGbpProfileCard.tsx` (conteúdo migrou), `LeadGbpIdentity.tsx` e `LeadGbpSummaryCards.tsx` (substituídos pelas células), `UpcomingStepPlaceholder` e o `Pulse` do skeleton antigo.

---

### Task 1: Temas das oportunidades e reconciliação da contagem

**Files:**
- Modify: `lib/leads/gbp-opportunities.ts`
- Create: `lib/leads/gbp-profile-tabs.ts`
- Modify: `components/custom/LeadGbpPanel/LeadGbpPanel.tsx:184-210` (cálculo de `alertCount`)

**Interfaces:**
- Consumes: `GbpGapId` e `GBP_GAP_IDS` de `lib/leads/gbp.ts`; `GBP_REPUTATION_OPPORTUNITY_ID` e `GbpOpportunityItem` do próprio arquivo.
- Produces:
  ```ts
  export type GbpOpportunityTheme = "perfil" | "reputacao" | "ranking" | "diretorios"
  export const GBP_OPPORTUNITY_THEME: Record<GbpGapId | typeof GBP_REPUTATION_OPPORTUNITY_ID, GbpOpportunityTheme>
  export function gbpOpportunityTheme(id: string): GbpOpportunityTheme
  export function gbpOpportunitiesByTheme(
    items: GbpOpportunityItem[],
  ): Record<GbpOpportunityTheme, GbpOpportunityItem[]>
  // lib/leads/gbp-profile-tabs.ts
  export type GbpProfileTabId = GbpOpportunityTheme
  export const GBP_PROFILE_TABS: ReadonlyArray<{ id: GbpProfileTabId; label: string; icon: IconType }>
  ```

- [ ] **Step 1: Declarar o tipo e o mapa vazio, para o `tsc` acusar o que falta**

Em `lib/leads/gbp-opportunities.ts`, depois de `GBP_REPUTATION_OPPORTUNITY_ID`:

```ts
export type GbpOpportunityTheme =
  | "perfil"
  | "reputacao"
  | "ranking"
  | "diretorios"

/**
 * Trilha, abas e coluna leem a mesma lista; o que impede as três de divergirem
 * é este mapa ser exaustivo. `Record` sobre a união inteira faz o `tsc` recusar
 * a compilação quando um gap novo entra em `GBP_GAP_IDS` sem tema — que é mais
 * barato e mais confiável que um teste, num runner que não importa TS.
 */
export const GBP_OPPORTUNITY_THEME: Record<
  GbpGapId | typeof GBP_REPUTATION_OPPORTUNITY_ID,
  GbpOpportunityTheme
> = {}
```

- [ ] **Step 2: Rodar o `tsc` e confirmar que ele falha listando as 33 chaves**

```bash
pnpm exec tsc --noEmit
```

Esperado: FAIL em `gbp-opportunities.ts`, com "Type '{}' is missing the following properties from type 'Record<...>': name_mismatch, missing_website, …". Se passar, o `Record` foi escrito com tipo frouxo — corrigir antes de seguir.

- [ ] **Step 3: Preencher o mapa**

```ts
export const GBP_OPPORTUNITY_THEME: Record<
  GbpGapId | typeof GBP_REPUTATION_OPPORTUNITY_ID,
  GbpOpportunityTheme
> = {
  // Perfil — informação, conteúdo e mídia do próprio perfil.
  name_mismatch: "perfil",
  missing_website: "perfil",
  website_unmatched: "perfil",
  missing_hours: "perfil",
  // Fotos não têm card em aba nenhuma, só o big number do cabeçalho; Perfil é
  // o destino menos errado.
  no_photos: "perfil",
  few_photos: "perfil",
  closed: "perfil",
  unclaimed: "perfil",
  no_secondary_categories: "perfil",
  missing_description: "perfil",
  thin_description: "perfil",
  no_services: "perfil",
  no_posts: "perfil",
  stale_posts: "perfil",
  // O card de Q&A mora na aba Perfil.
  unanswered_questions: "perfil",
  category_off_segment: "perfil",
  description_missing_services: "perfil",
  description_missing_region: "perfil",
  description_missing_category: "perfil",

  // Reputação
  low_rating: "reputacao",
  few_reviews: "reputacao",
  weak_review_replies: "reputacao",
  unreplied_negative_reviews: "reputacao",
  slow_review_replies: "reputacao",
  review_burst: "reputacao",
  latest_review_unanswered: "reputacao",
  negative_replies_ignored: "reputacao",
  dormant_reviews: "reputacao",
  reviews_removed: "reputacao",
  [GBP_REPUTATION_OPPORTUNITY_ID]: "reputacao",

  // Ranking — hoje existe um id só; SoLV, ARP e ausência na malha não são
  // gerados por `gbpGapsForProfile` e não são criados aqui.
  not_in_map_top3: "ranking",

  // Diretórios
  missing_directory_listings: "diretorios",
  directory_nap_mismatch: "diretorios",
}
```

- [ ] **Step 4: Rodar o `tsc` e confirmar que passa**

```bash
pnpm exec tsc --noEmit
```

Esperado: PASS.

- [ ] **Step 5: Escrever o agrupador**

No mesmo arquivo:

```ts
const EMPTY_BY_THEME = (): Record<GbpOpportunityTheme, GbpOpportunityItem[]> => ({
  perfil: [],
  reputacao: [],
  ranking: [],
  diretorios: [],
})

export function gbpOpportunityTheme(id: string): GbpOpportunityTheme {
  // Id fora do mapa só existe se alguém montar um item à mão; cair em "perfil"
  // mantém o item visível em vez de sumir do agrupamento.
  return (
    GBP_OPPORTUNITY_THEME[id as keyof typeof GBP_OPPORTUNITY_THEME] ?? "perfil"
  )
}

/**
 * Reduce sobre a lista recebida: a soma dos grupos é a lista, por construção.
 * Nenhum item pode sumir entre o contador da aba e o grupo da coluna.
 */
export function gbpOpportunitiesByTheme(
  items: GbpOpportunityItem[],
): Record<GbpOpportunityTheme, GbpOpportunityItem[]> {
  return items.reduce((acc, item) => {
    acc[gbpOpportunityTheme(item.id)].push(item)
    return acc
  }, EMPTY_BY_THEME())
}
```

- [ ] **Step 6: Criar o módulo das abas**

`lib/leads/gbp-profile-tabs.ts`:

```ts
import type { IconType } from "react-icons"
import {
  RiBarChartBoxLine,
  RiFileList3Line,
  RiMapPin2Line,
  RiStarLine,
} from "react-icons/ri"
import type { GbpOpportunityTheme } from "@/lib/leads/gbp-opportunities"

/**
 * Aba e tema são o mesmo eixo: o contador da aba é a contagem do grupo. Um
 * tipo só evita a tradução no meio do caminho.
 */
export type GbpProfileTabId = GbpOpportunityTheme

export const GBP_PROFILE_TABS: ReadonlyArray<{
  id: GbpProfileTabId
  label: string
  icon: IconType
}> = [
  { id: "perfil", label: "Perfil", icon: RiMapPin2Line },
  { id: "reputacao", label: "Reputação", icon: RiStarLine },
  { id: "ranking", label: "Ranking", icon: RiBarChartBoxLine },
  { id: "diretorios", label: "Diretórios", icon: RiFileList3Line },
]
```

- [ ] **Step 7: Reconciliar o badge da trilha**

Em `LeadGbpPanel.tsx`, o `alertCount` hoje é `gbpGapsForProfile(...).length`. Ele passa a ser o total de oportunidades, para bater com a coluna assim que o analista preencher a leitura da reputação. Substituir o bloco `const alertCount = selected ? gbpGapsForProfile(...).length : 0` por:

```ts
  const selectedGaps = selected
    ? gbpGapsForProfile(
        selected.payload,
        detail.lead.company_name,
        selected.matched_website_key,
        selected.enrichment,
        {
          posts: selected.posts,
          postsReady:
            selected.posts !== null && !gbpJobQueued(selected.jobs, "updates"),
          reviews: selected.reviews,
          reviewsReady:
            selected.reviews !== null &&
            !gbpJobQueued(selected.jobs, "reviews"),
          qna: selected.qna,
          rankKeywords: selected.rank_keywords,
          rankChecks: selected.rankChecks,
          analystReview: selected.analyst_review,
          today: todayCivilDate(),
          reviewsDelta: selected.reviews_delta,
          location: leadLocation,
        },
      )
    : []
  // O badge da trilha conta oportunidades, não gaps: `mergeGbpOpportunities`
  // acrescenta a leitura da reputação do analista, e a coluna mostra esse item.
  // Contar gaps aqui fazia trilha e coluna divergirem em 1 assim que o campo
  // fosse preenchido.
  const alertCount = selected
    ? mergeGbpOpportunities({
        gaps: selectedGaps,
        reputation: gbpReputation({
          reviews: selected.reviews,
          distribution: selected.enrichment?.ratingDistribution ?? null,
          today: todayCivilDate(),
        }),
        reviewsDelta: selected.reviews_delta,
        rankChecks: selected.rankChecks,
        keywords: selected.rank_keywords,
        reputationNote: selected.reputation_note,
        analystReview: selected.analyst_review,
        enrichment: selected.enrichment,
        location: leadLocation,
      }).length
    : 0
```

Acrescentar os imports `mergeGbpOpportunities` de `@/lib/leads/gbp-opportunities` e `gbpReputation` de `@/lib/leads/gbp-reputation`.

- [ ] **Step 8: Verificar**

```bash
pnpm exec tsc --noEmit && pnpm lint
```

Depois, no preview: abrir um lead `interested`, ir na aba Oportunidade, anotar o badge de alertas da trilha; escrever qualquer coisa em "Leitura da reputação" e esperar o `✓ Salvo agora`; o badge sobe 1 e passa a bater com a contagem do card "Oportunidades encontradas".

- [ ] **Step 9: Commit**

```bash
git add lib/leads/gbp-opportunities.ts lib/leads/gbp-profile-tabs.ts components/custom/LeadGbpPanel/LeadGbpPanel.tsx docs/superpowers/specs/2026-09-10-gbp-perfil-google-redesign-design.md docs/superpowers/plans/2026-09-10-gbp-perfil-google-redesign.md
git commit -m "feat(gbp): classificar oportunidades por tema e reconciliar badge da trilha"
```

---

### Task 2: Dialog em tela cheia e botão Modo reunião

**Files:**
- Modify: `components/custom/LeadDetailDialog/LeadDetailDialog.tsx:411-416` (classes do `DialogContent`), mais o estado novo
- Modify: `components/custom/LeadDetailDialog/LeadDetailHeader.tsx`

**Interfaces:**
- Produces: `LeadDetailHeader` passa a aceitar `readingMode: boolean`, `showReadingMode: boolean`, `onReadingModeChange: (next: boolean) => void`. `LeadGbpPanel` passa a aceitar `readingMode: boolean` (consumido só na Task 4 em diante; nesta task ele é recebido e ignorado, para o tipo já existir).

- [ ] **Step 1: Quatro overrides no `DialogContent`**

`max-h-` é obrigatório: `tailwind-merge` resolve por chave, e o `max-h-[calc(100dvh-2rem)]` das classes base continuaria clampando a altura.

```tsx
          className={cn(
            "h-[min(50rem,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-4xl grid-rows-[minmax(0,1fr)] gap-0 overflow-hidden bg-background p-0",
            tab === "opportunity" &&
              "h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-none",
          )}
```

- [ ] **Step 2: Estado do modo reunião no dialog**

Perto dos outros `useState` do `LeadDetailDialog`:

```tsx
const canEditGbp = (detail?.canEditGbp ?? false) && !readOnly
// Inicializador preguiçoso: `localStorage` nunca é lido no corpo do render.
// Quem não pode editar entra em modo reunião — não há o que esconder de quem
// já não edita — e o botão some.
const [readingModePref, setReadingModePref] = useState(() => {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem("gbp:reading-mode") === "on"
})
const readingMode = canEditGbp ? readingModePref : true

function handleReadingModeChange(next: boolean) {
  setReadingModePref(next)
  window.localStorage.setItem("gbp:reading-mode", next ? "on" : "off")
}
```

- [ ] **Step 3: Passar as props**

No `LeadDetailHeader`: `readingMode={readingMode}`, `showReadingMode={tab === "opportunity" && canEditGbp}`, `onReadingModeChange={handleReadingModeChange}`. No `LeadGbpPanel`: `readingMode={readingMode}`.

- [ ] **Step 4: Botão no header**

Em `LeadDetailHeader.tsx`, na `div` da direita, entre o contador de atividades e o `LeadClaimActions`:

```tsx
        {showReadingMode ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="h-7 gap-1.5 px-2 text-muted-foreground"
              aria-pressed={readingMode}
              onClick={() => onReadingModeChange(!readingMode)}
            >
              {readingMode ? (
                <span
                  aria-hidden
                  className="inline-block size-1.5 rounded-full bg-primary"
                />
              ) : null}
              Modo reunião
            </Button>
            <span aria-hidden className="h-5 w-px bg-border" />
          </>
        ) : null}
```

Acrescentar `readingMode`, `showReadingMode` e `onReadingModeChange` à assinatura e ao tipo de props.

- [ ] **Step 5: Adicionar `readingMode` ao tipo do painel**

Em `LeadGbpPanel.types.ts`, acrescentar `readingMode: boolean` a `LeadGbpPanelProps`; em `LeadGbpPanel.tsx`, desestruturar a prop. Ela ainda não é usada — a Task 4 a consome.

- [ ] **Step 6: Verificar**

```bash
pnpm exec tsc --noEmit && pnpm lint
```

No preview: abrir um lead `interested`. Na aba Oportunidade o dialog ocupa a tela quase inteira; nas abas Atividade e Cadastro ele volta ao tamanho de antes. O botão Modo reunião só aparece na aba Oportunidade, liga e desliga com o ponto verde, e a escolha sobrevive a recarregar a página. Com um lead sem permissão de edição, o botão não aparece.

- [ ] **Step 7: Commit**

```bash
git add components/custom/LeadDetailDialog components/custom/LeadGbpPanel/LeadGbpPanel.types.ts components/custom/LeadGbpPanel/LeadGbpPanel.tsx
git commit -m "feat(gbp): tela cheia na aba Oportunidade e toggle de modo reunião"
```

---

### Task 3: Extrair `useGbpProfileController`

Refactor puro: a tela não muda um pixel. Fazer sozinho, antes de mexer em layout, é o que permite revisar a migração de estado sem ruído visual.

**Files:**
- Create: `components/custom/LeadGbpPanel/use-gbp-profile-controller.ts`
- Modify: `components/custom/LeadGbpPanel/LeadGbpProfileCard.tsx`

**Interfaces:**
- Consumes: as server actions de `@/app/actions/leads`, `gbpGapsForProfile`, `gbpReputation`, `mergeGbpOpportunities`, `gbpJobQueued`, `latestGbpCollectedAt`.
- Produces:
  ```ts
  export type GbpProfileController = {
    profile: LeadGbpProfile
    profiles: LeadGbpProfile[]
    companyName: string
    canEdit: boolean
    gaps: GbpGapId[]
    reputation: GbpReputation
    opportunities: GbpOpportunityItem[]
    mapsUri: string | null
    updatedAt: string | null
    collecting: boolean
    collectingPosts: boolean
    collectingReviews: boolean
    pollTimedOut: boolean
    queuedKey: string
    failedJobs: LeadGbpProfile["jobs"]
    busy: boolean
    error: string | null
    notesStatus: GbpNotesStatus
    savingReplyTime: boolean
    onSelectProfile: (profileId: string) => void
    handleRefresh: () => void
    handleEnrich: () => void
    handlePrimary: () => void
    handleRemove: () => void
    handleSaveRankKeywords: (keywords: string[]) => Promise<void>
    handleCheckRanking: () => Promise<void>
    handleReplyTimeChange: (band: GbpReplyTimeBand | null) => void
    handleDraftChange: (next: string) => void
    handleReputationDraftChange: (next: string) => void
    persistNotes: () => Promise<boolean>
    onUpdated: (profile: LeadGbpProfile) => void
    onPendingChange: (pending: boolean) => void
  }

  export function useGbpProfileController(input: {
    profile: LeadGbpProfile
    profiles: LeadGbpProfile[]
    companyName: string
    location: LeadLocation
    canEdit: boolean
    actionPending: boolean
    onSelectProfile: (profileId: string) => void
    onUpdated: (profile: LeadGbpProfile) => void
    onRemoved: (profileId: string) => void
    onPendingChange: (pending: boolean) => void
  }): GbpProfileController
  ```

- [ ] **Step 1: Mover estado e ações**

Criar `use-gbp-profile-controller.ts` com `"use client"` no topo e mover, **sem alterar uma linha de lógica**, tudo o que hoje está em `LeadGbpProfileCard.tsx` entre o início do componente e o `return`: as constantes `POLL_MS`, `POLL_MAX_MS`, `NOTES_DEBOUNCE_MS`, a função `queuedKindsKey`, os `useState`, os refs (`onUpdatedRef`, `notesRef`, `reputationRef`, `notesTimerRef`, `profileRef`), os ajustes de estado no render (`syncedProfileId`, `syncedPollKey`), os três `useEffect` (sincronização dos refs, polling de jobs, flush no unmount), os derivados (`gaps`, `reputation`, `opportunities`, `collecting*`, `failedJobs`) e as funções `analystFieldsDirty`, `persistNotes`, `scheduleAnalystSave`, `handleReplyTimeChange`, `handleDraftChange`, `handleReputationDraftChange`, `run`, `handleRefresh`, `handleEnrich`, `handlePrimary`, `handleSaveRankKeywords`, `handleCheckRanking`, `handleRemove`.

Terminar com o `return` do objeto `GbpProfileController`, incluindo `updatedAt: latestGbpCollectedAt(profile)` e `mapsUri` (`enrichment?.checkUrl ?? profile.google_maps_uri ?? snapshot.googleMapsUri`).

- [ ] **Step 2: `LeadGbpProfileCard` passa a consumir o hook**

O componente fica só com a chamada do hook e o JSX atual, lendo tudo do objeto devolvido. Nenhuma mudança de markup nesta task.

```tsx
export function LeadGbpProfileCard(props: {
  profile: LeadGbpProfile
  profiles: LeadGbpProfile[]
  companyName: string
  location: LeadLocation
  canEdit: boolean
  actionPending: boolean
  onSelectProfile: (profileId: string) => void
  onUpdated: (profile: LeadGbpProfile) => void
  onRemoved: (profileId: string) => void
  onPendingChange: (pending: boolean) => void
}) {
  const c = useGbpProfileController(props)
  // …o mesmo JSX de hoje, trocando `notesStatus` por `c.notesStatus`, etc.
}
```

- [ ] **Step 3: Verificar que nada mudou**

```bash
pnpm exec tsc --noEmit && pnpm lint
```

No preview, sobre um lead com perfil vinculado: a tela é idêntica à de antes. Digitar em Notas da etapa e esperar `✓ Salvo agora`; trocar de perfil no `Select` e voltar; clicar em Atualizar coleta e ver o spinner. Se algum desses três quebrou, o refactor mexeu em lógica — reverter e mover de novo.

- [ ] **Step 4: Commit**

```bash
git add components/custom/LeadGbpPanel/use-gbp-profile-controller.ts components/custom/LeadGbpPanel/LeadGbpProfileCard.tsx
git commit -m "refactor(gbp): extrair estado e ações da etapa para useGbpProfileController"
```

---

### Task 4: Cabeçalho fixo — título, faixa de identidade e big numbers, avisos

O corpo continua sendo a grade de nove cards de hoje; só o topo muda. Isso mantém a tela usável entre esta task e a próxima.

**Files:**
- Create: `LeadGbpProfileView.tsx`, `LeadGbpProfileHeader.tsx`, `LeadGbpIdentityCell.tsx`, `LeadGbpMetricCells.tsx`, `LeadGbpStepNotices.tsx`
- Modify: `LeadGbpStepHeader.tsx`, `LeadGbpPanel.tsx`

**Interfaces:**
- Consumes: `GbpProfileController` da Task 3.
- Produces:
  ```tsx
  function LeadGbpProfileView(props: {
    controller: GbpProfileController
    readingMode: boolean
    notices: ReactNode      // conteúdo da faixa vindo do LeadGbpPanel
  }): ReactNode
  function LeadGbpProfileHeader(props: {
    controller: GbpProfileController
    readingMode: boolean
    notices: ReactNode
    tab: GbpProfileTabId
    onTabChange: (id: GbpProfileTabId) => void   // usado a partir da Task 5
  }): ReactNode
  ```

- [ ] **Step 1: `LeadGbpStepHeader` ganha `readingMode` e o menu `⋮`**

O `DropdownMenu` de ações do perfil, hoje irmão do `StepHeader` dentro do `LeadGbpProfileCard`, entra no `StepHeader`, à direita de "Ver no Google". Novas props: `readingMode: boolean`, `isPrimary: boolean`, `onPrimary`, `onRefresh`, `onRemove`, `onAddProfile`. Sob `readingMode`, "Atualizar coleta", "Ver no Google" e o `⋮` não são renderizados. O menu ganha o item **Adicionar perfil** (`RiAddLine`), que chama `onAddProfile`.

- [ ] **Step 2: Célula de identidade**

`LeadGbpIdentityCell.tsx` — mesma informação e mesmas fontes do `LeadGbpIdentity` (incluindo `coverFailed` com o ajuste no render por `coverKey`, e o `Select` quando há 2+ perfis), no formato de célula do spec §"Cabeçalho fixo da etapa": `rounded-lg px-3 py-2.5 bg-accent/60 ring-1 ring-foreground/[0.06] flex items-center gap-2.5`, capa `size-11`, nome `text-xs/[1.5] font-semibold truncate`, badge `Principal`, endereço `text-xs/[1.5] text-muted-foreground truncate`, badges de status e reivindicação, `SelectTrigger size="sm"`.

- [ ] **Step 3: Células de métrica**

`LeadGbpMetricCells.tsx` — as quatro células do spec, sem `LeadIconWell`: `rounded-lg px-3 py-2.5 bg-card ring-1 ring-foreground/10 flex flex-col justify-center gap-0.5`, rótulo `text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground` com os textos `NOTA`, `AVALIAÇÕES`, `FOTOS`, `MELHOR POSIÇÃO`, valor `text-[26px] font-semibold tracking-[-0.02em] leading-[1.15] tabular-nums` (`—` quando nulo), complemento `text-[11px] text-muted-foreground`. Fontes inalteradas: `formatGbpRating`, `formatGbpCount`, `gbpPhotosLabel`, `bestMapsPosition`.

- [ ] **Step 4: Faixa de avisos**

`LeadGbpStepNotices.tsx` recebe `children` e só renderiza o wrapper quando há filho — `React.Children.count(children) > 0` não basta com condicionais que devolvem `null`, então o `LeadGbpPanel` monta um array e passa `notices` já filtrado. O wrapper é `mt-3 flex flex-col gap-2`.

O que vai nele, vindo do `LeadGbpPanel`: o aviso de sites sem perfil (com Revisar), o `LeadGbpPlacePicker`, o erro de vínculo com o link para o cadastro existente. E, vindo do controller: `Coletando postagens…`, `Coletando avaliações…`, `Ainda coletando — abra de novo.`, os erros de job falho e o `error` geral.

- [ ] **Step 5: `LeadGbpProfileHeader` e `LeadGbpProfileView`**

`LeadGbpProfileHeader`: `px-5 pt-4 bg-background border-b border-border/70`, com `LeadGbpStepHeader`, a faixa `mt-3.5 grid grid-cols-[minmax(0,1.15fr)_repeat(4,minmax(0,1fr))] gap-3 items-stretch` (identidade + 4 métricas), a faixa de avisos e — a partir da Task 5 — a barra de abas.

`LeadGbpProfileView`: `grid min-h-0 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_21.25rem]`, com a coluna central em `grid min-h-0 grid-rows-[auto_minmax(0,1fr)]`: o header na primeira linha, e na segunda `min-h-0 overflow-y-auto px-5 pt-4 pb-5 bg-accent/45` com o corpo. Nesta task o corpo é o JSX de cards que o `LeadGbpProfileCard` tem hoje, menos o `StepHeader`, o `⋮`, o `LeadGbpIdentity` e o `LeadGbpSummaryCards`, que subiram.

- [ ] **Step 6: `LeadGbpPanel` renderiza a view**

O ramo `google-profile` deixa de ter o `div flex flex-col gap-3` com banner, picker e botão soltos: monta o array de `notices` e renderiza `<LeadGbpProfileView … />` ocupando a altura toda. A coluna central do painel perde o `overflow-y-auto` e o padding (agora são da view): passa a `min-h-0`.

- [ ] **Step 7: Verificar**

```bash
pnpm exec tsc --noEmit && pnpm lint
```

No preview, a 1440×900: os cinco blocos da faixa têm a mesma altura; repetir a 1280 e a 1920. Um perfil com nome longo trunca sem empurrar as métricas. Rolar o corpo: o cabeçalho fica parado. Ligar o Modo reunião: "Atualizar coleta", "Ver no Google" e o `⋮` somem. Num lead com site não coberto, o aviso aparece na faixa e o botão Revisar abre o picker ali mesmo.

- [ ] **Step 8: Commit**

```bash
git add components/custom/LeadGbpPanel
git commit -m "feat(gbp): cabeçalho fixo com identidade, big numbers e faixa de avisos"
```

---

### Task 5: Abas e os quatro painéis

**Files:**
- Create: `LeadGbpStepTabs.tsx`, `LeadGbpTabProfile.tsx`, `LeadGbpTabReputation.tsx`, `LeadGbpTabRanking.tsx`, `LeadGbpTabDirectories.tsx`, `LeadGbpServicesCard.tsx`
- Modify: `LeadGbpProfileView.tsx`, `LeadGbpProfileHeader.tsx`, `LeadGbpInformationCard.tsx`, `LeadGbpReviewsBlock.tsx`, `LeadGbpPostsBlock.tsx`, `LeadGbpDirectoriesCard.tsx`

**Interfaces:**
- Consumes: `GBP_PROFILE_TABS` e `GbpProfileTabId` (Task 1); `gbpOpportunitiesByTheme` (Task 1); `GbpProfileController` (Task 3).
- Produces: cada painel é `function LeadGbpTabX({ controller, readingMode }: { controller: GbpProfileController; readingMode: boolean }): ReactNode`.

- [ ] **Step 1: Barra de abas**

`LeadGbpStepTabs.tsx` usa `Tabs`/`TabsList variant="line"`/`TabsTrigger` do registry — a mesma composição de `LeadDetailHeader.tsx:117-140`, inclusive o `after:hidden` no trigger e o sublinhado como `m.span` com `layoutId="gbp-step-tab-underline"`. Estilos no spec §"Barra de abas". Os contadores vêm de `gbpOpportunitiesByTheme(controller.opportunities)[tab.id].length`; aba sem achado não mostra contador.

- [ ] **Step 2: `Tabs` envolve header e corpo**

O `Tabs` root precisa envolver `TabsList` (no header) e os `TabsContent` (no corpo), então ele sobe para o `LeadGbpProfileView`, com `value={tab}` e `onValueChange`. O estado `tab` vive na view:

```tsx
const [tab, setTab] = useState<GbpProfileTabId>("perfil")
// Reset ligado à troca de perfil: no render, não em efeito.
const [syncedProfileId, setSyncedProfileId] = useState(controller.profile.id)
if (syncedProfileId !== controller.profile.id) {
  setSyncedProfileId(controller.profile.id)
  setTab("perfil")
}
```

- [ ] **Step 3: Os quatro `TabsContent` com `keepMounted`**

```tsx
{GBP_PROFILE_TABS.map((item) => (
  <TabsContent
    key={item.id}
    value={item.id}
    keepMounted
    className="duration-150 data-active:animate-in data-active:fade-in-0"
  >
    {/* painel correspondente */}
  </TabsContent>
))}
```

`keepMounted` é o que preserva o scan em andamento da malha, o rascunho de termos do `LeadGbpRankBlock`, o "Ver mais" da descrição e a expansão das avaliações ao trocar de aba. `TabsContent` repassa a prop para o `Tabs.Panel` do Base UI (`components/ui/tabs.tsx:71`); é o mesmo recurso que o dialog já usa na aba `record`.

- [ ] **Step 4: Painel Perfil**

`grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-3.5 items-start`. `LeadGbpInformationCard` passa as linhas para `grid grid-cols-2 gap-x-5` e move a descrição para bloco no pé do card (`border-t border-border/70 pt-2.5`, `text-xs/[1.7] line-clamp-4`, Ver mais/Ver menos em `text-primary font-medium`); Serviços sai dele para `LeadGbpServicesCard`, com os itens em chips `inline-flex h-[22px] px-2 rounded-md bg-accent text-[11px] text-accent-foreground`. Coluna direita em `grid gap-3.5`: Serviços, `LeadGbpPostsBlock` no formato `grid grid-cols-[120px_minmax(0,1fr)] gap-3`, `LeadGbpQnaBlock`. Detalhes no spec §"Painéis das abas → Perfil".

- [ ] **Step 5: Painel Reputação**

`grid grid-cols-2 gap-3.5 items-start`. `LeadGbpReviewsBlock` divide-se em dois cards — distribuição + leitura da amostra + tempo de resposta à esquerda, avaliações em destaque à direita. Nenhum cálculo novo: `gbpReputation` e os presenters continuam a fonte, na ordem de hoje. Estilos no spec §"Painéis das abas → Reputação".

- [ ] **Step 6: Painel Diretórios**

Card único de largura total, lista em `grid grid-cols-3 gap-x-6`, os três resumos no cabeçalho. Spec §"Painéis das abas → Diretórios".

- [ ] **Step 7: Painel Ranking (provisório)**

Nesta task, o painel só reposiciona o que já existe: `grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-3.5 items-start`, com `LeadGbpRankBlock` à esquerda e o card "Quem aparece na região" à direita. A malha continua aninhada e com disclosure — a Task 6 cuida dela.

- [ ] **Step 8: `items-stretch` e `h-full`**

Em cada linha de grade dos quatro painéis, `items-stretch` no container e `h-full` nos cards. Nenhum card com altura fixa.

- [ ] **Step 9: Verificar**

```bash
pnpm exec tsc --noEmit && pnpm lint
```

No preview: as quatro abas trocam com o sublinhado animado e os contadores somam o total da coluna de hoje. Abrir Ranking, digitar um termo novo no `Input` sem salvar, ir para Perfil e voltar — o termo continua digitado. Abrir "Ver mais" na descrição, trocar de aba e voltar — continua aberto. Cada aba cabe em 900px de altura, com scroll só onde há muito conteúdo.

- [ ] **Step 10: Commit**

```bash
git add components/custom/LeadGbpPanel
git commit -m "feat(gbp): quatro abas internas com painéis keepMounted"
```

---

### Task 6: Malha geográfica desaninhada e com mount preguiçoso

**Files:**
- Modify: `LeadGbpRankBlock.tsx`, `LeadGbpGridSection.tsx`, `LeadGbpTabRanking.tsx`

**Interfaces:**
- Produces: `LeadGbpGridSection` ganha `mapMounted: boolean` e deixa de ter `open`/`setOpen`.

- [ ] **Step 1: Desaninhar**

Remover o `<LeadGbpGridSection …/>` de dentro do `LeadGbpRankBlock` (`:268`) e renderizá-lo como irmão, no painel Ranking, à esquerda. `LeadGbpRankBlock` passa a ser só a tabela de Ranking no Maps.

- [ ] **Step 2: Tirar o disclosure**

Em `LeadGbpGridSection`, remover `const [open, setOpen] = useState(false)` (`:67`), o `button` de `:211-217` e o `{open ? … : null}`. O conteúdo passa a renderizar direto, e os controles (Keyword, Malha, Execução, Raio, Rodar malha, custo, requisições) vão para o cabeçalho do card, em linha.

- [ ] **Step 3: Mount preguiçoso do mapa**

Em `LeadGbpTabRanking.tsx`:

```tsx
// `keepMounted` deixa este painel montado desde que o perfil abre; sem esta
// guarda, o Google Maps JS e os tiles carregariam em todo perfil aberto,
// inclusive nos que ninguém vai olhar. Uma vez visitado, o mapa fica — voltar
// para a aba não deve recarregar a malha.
const [mapMounted, setMapMounted] = useState(false)
if (active && !mapMounted) setMapMounted(true)
```

`active` vem do `TabsContent` pai por prop (`tab === "ranking"`). Passar `mapMounted` ao `LeadGbpGridSection`, que renderiza cabeçalho, métricas e legenda sempre, e o `LeadGbpGridMap` só quando `mapMounted`. O efeito de `pollLeadGbpGridScan` **não** é condicionado ao mapa: ele continua rodando pelo `scan`, senão um scan iniciado e deixado na aba pararia de preencher.

- [ ] **Step 4: Mapa a 300px e modo reunião**

`className="h-[300px] rounded-lg"` no `LeadGbpGridMap`. Sob `readingMode`, os controles do cabeçalho e o botão Rodar malha não são renderizados.

- [ ] **Step 5: Verificar**

```bash
pnpm exec tsc --noEmit && pnpm lint
```

No preview: abrir um lead e ficar na aba Perfil — na aba Network do browser, nenhuma requisição a `maps.googleapis.com`. Ir para Ranking: a malha aparece aberta, com o mapa. Iniciar uma malha, trocar para Perfil, esperar uns 15 segundos e voltar: os pontos continuaram preenchendo (o polling não parou) e o mapa não recarregou.

- [ ] **Step 6: Commit**

```bash
git add components/custom/LeadGbpPanel
git commit -m "feat(gbp): malha aberta na aba Ranking, com mapa montado sob demanda"
```

---

### Task 7: Coluna de oportunidades

**Files:**
- Create: `LeadGbpOpportunitiesRail.tsx`
- Modify: `LeadGbpOpportunitiesCard.tsx`, `LeadGbpProfileView.tsx`, `lib/leads/gbp-opportunities.ts` (`GBP_IMPACT_LABEL`)

**Interfaces:**
- Consumes: `gbpOpportunitiesByTheme` (Task 1), `GbpProfileController` (Task 3).
- Produces:
  ```tsx
  function LeadGbpOpportunitiesRail(props: {
    controller: GbpProfileController
    readingMode: boolean
    activeTab: GbpProfileTabId
    railOpen: boolean          // sempre true até a Task 9
    onToggleRail: () => void
  }): ReactNode
  ```

- [ ] **Step 1: Rótulos de impacto**

```ts
export const GBP_IMPACT_LABEL: Record<GbpOpportunityImpact, string> = {
  high: "Alto",
  medium: "Médio",
}
```

- [ ] **Step 2: `LeadGbpOpportunitiesCard` vira item de lista**

Reduzir a `LeadGbpOpportunityItem`, sem `LeadGbpCard` em volta: `flex items-start gap-2 px-2.5 py-2 rounded-lg bg-card ring-1 ring-foreground/[0.08]`, dot `size-1.5 rounded-full mt-1.5` (`bg-warning` alto, `bg-border` médio), título `text-xs/[1.5]`, detalhe `text-[11px] text-muted-foreground line-clamp-2`, chip `text-[10px] font-medium rounded-md px-1.5 py-0.5`. Itens `source === "analyst"` mantêm o rótulo "Analista".

- [ ] **Step 3: A coluna**

`LeadGbpOpportunitiesRail` com `grid grid-rows-[auto_minmax(0,1fr)_auto] min-h-0 border-l border-border/70 bg-popover/70`. Cabeçalho, lista agrupada e o pé (vazio nesta task; a Task 8 põe o bloco do analista). Estilos e comportamento no spec §"Coluna de oportunidades" — inclusive: os chips filtram em memória, e **trocar de aba não muda o filtro**; a aba ativa só pinta o cabeçalho do seu grupo em `text-primary`.

- [ ] **Step 4: Montar na view**

`LeadGbpProfileView` renderiza a coluna na segunda célula do grid. Passar `activeTab={tab}`. `railOpen` fixo em `true` e `onToggleRail` como no-op até a Task 9 — o botão `»` já existe, só ainda não faz nada.

- [ ] **Step 5: Remover o card antigo do corpo**

Tirar `<LeadGbpOpportunitiesCard items={opportunities} />` da grade do painel Ranking.

- [ ] **Step 6: Verificar**

```bash
pnpm exec tsc --noEmit && pnpm lint
```

No preview: a coluna aparece à direita com os quatro grupos; o contador do cabeçalho, a soma dos grupos e a soma dos contadores das abas são o mesmo número, e batem com o badge da trilha. Clicar em cada chip filtra sem recarregar. Trocar de aba muda a cor do cabeçalho do grupo e não mexe no filtro.

- [ ] **Step 7: Commit**

```bash
git add components/custom/LeadGbpPanel lib/leads/gbp-opportunities.ts
git commit -m "feat(gbp): coluna de oportunidades agrupada por tema com filtro"
```

---

### Task 8: Bloco do analista no pé da coluna

**Files:**
- Create: `LeadGbpAnalystBlock.tsx`
- Modify: `LeadGbpNotesCard.tsx`, `LeadGbpOpportunitiesRail.tsx`, `LeadGbpProfileView.tsx`

**Interfaces:**
- Produces: `LeadGbpNotesCard` ganha `variant?: "card" | "rail"` (padrão `"card"`) e `hidden?: boolean`.

- [ ] **Step 1: `variant="rail"` no `LeadGbpNotesCard`**

Sem `LeadGbpCard` em volta; `Textarea` `h-24 resize-none rounded-lg bg-background text-xs/[1.6]`; contador e estados de salvamento na linha do cabeçalho, não abaixo do campo. O caminho `!canEdit` (texto puro) continua igual.

- [ ] **Step 2: Os dois campos, ambos montados**

`LeadGbpAnalystBlock` renderiza as **duas** instâncias sempre, e aplica `hidden` na inativa:

```tsx
{/* Os dois montados o tempo todo: `LeadGbpNotesCard` guarda o valor em
    `useState(initialValue)` e só re-sincroniza quando `profileId` muda, então
    desmontar o inativo devolveria o textarea ao valor do servidor — e o texto
    digitado dentro dos 800ms de debounce, ou depois de um erro de salvamento,
    voltaria atrás na tela. */}
<LeadGbpNotesCard variant="rail" hidden={field !== "notes"} … />
<LeadGbpNotesCard variant="rail" hidden={field !== "reputation"} … />
```

Chave segmentada, contador do campo visível e rodapé conforme o spec §"Bloco do analista".

- [ ] **Step 3: Montar no pé da coluna e remover as instâncias antigas**

O bloco vai na terceira linha do grid da coluna (`px-4 pt-3 pb-4 border-t border-border/70 bg-popover`). Tirar as duas instâncias de `LeadGbpNotesCard` da grade do corpo.

- [ ] **Step 4: Verificar**

```bash
pnpm exec tsc --noEmit && pnpm lint
```

No preview, o teste que importa: digitar em Notas da etapa e, **antes** do `✓ Salvo agora` aparecer, clicar em Leitura da reputação e voltar — o texto tem de estar lá. Depois: digitar nos dois campos, trocar de aba, fechar o dialog e reabrir — os dois salvos, uma requisição só (conferir na aba Network). Forçar um erro de rede e checar que aparece "Salvar notas" e que o retry funciona.

- [ ] **Step 5: Commit**

```bash
git add components/custom/LeadGbpPanel
git commit -m "feat(gbp): bloco do analista no pé da coluna de oportunidades"
```

---

### Task 9: Colapso da coluna e atalho

**Files:**
- Create: `use-collapsible-rail.ts`
- Modify: `LeadGbpProfileView.tsx`, `LeadGbpOpportunitiesRail.tsx`

**Interfaces:**
- Produces:
  ```ts
  export function useCollapsibleRail(input: { enabled: boolean }): {
    railOpen: boolean
    toggle: () => void
    open: () => void
    close: () => void
  }
  ```

- [ ] **Step 1: O hook**

```ts
const STORAGE_KEY = "gbp:opportunities-rail"
const WIDE = "(min-width: 80rem)"

export function useCollapsibleRail({ enabled }: { enabled: boolean }) {
  // Inicializador preguiçoso: `localStorage` e `matchMedia` nunca no render.
  // A preferência gravada vence sempre que existe; sem ela, aberta em `xl`.
  const [railOpen, setRailOpen] = useState(() => {
    if (typeof window === "undefined") return true
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === "open") return true
    if (stored === "closed") return false
    return window.matchMedia(WIDE).matches
  })

  const set = useCallback((next: boolean) => {
    setRailOpen(next)
    window.localStorage.setItem(STORAGE_KEY, next ? "open" : "closed")
  }, [])

  const toggle = useCallback(() => {
    setRailOpen((current) => {
      const next = !current
      window.localStorage.setItem(STORAGE_KEY, next ? "open" : "closed")
      return next
    })
  }, [])

  useEffect(() => {
    if (!enabled) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) return
      // `e.code`, não `e.key`: é exatamente o que Sidebar.tsx:104 e
      // MobileNavigation.tsx:191 testam. Casar por `e.key` deixaria layouts de
      // teclado onde os dois handlers discordam sobre o mesmo toque.
      if (e.code !== "KeyB" || !(e.ctrlKey || e.metaKey)) return
      const target = e.target as Element | null
      const tag = target?.tagName.toLowerCase() ?? ""
      if (["input", "textarea", "select"].includes(tag)) return
      // Sem o `target &&` na frente, `target?.getAttribute(...)` devolve
      // `undefined` quando não há alvo, `undefined !== null` é verdadeiro, e o
      // atalho morreria calado. Os handlers do app testam um alvo não-nulo.
      if (target && target.getAttribute("contenteditable") !== null) return
      e.preventDefault()
      // Os dois listeners do app escutam `window` em bubble; capturar aqui é o
      // que impede o sidebar e o painel mobile de reagirem ao mesmo toque.
      e.stopPropagation()
      toggle()
    }
    window.addEventListener("keydown", onKeyDown, { capture: true })
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true })
  }, [enabled, toggle])

  return {
    railOpen,
    toggle,
    open: useCallback(() => set(true), [set]),
    close: useCallback(() => set(false), [set]),
  }
}
```

`enabled` vem da view: `true` só quando o painel da etapa está montado e a viewport está em `xl` ou acima (via `window.matchMedia(WIDE)` em um `useState` + listener de `change`). Abaixo disso a coluna não é coluna, e o atalho volta a ser do app.

- [ ] **Step 2: Animar o grid**

Na `LeadGbpProfileView`, a coluna direita passa a `21.25rem` ou `3rem` conforme `railOpen`, com `transition-[grid-template-columns] duration-[320ms] ease-[cubic-bezier(0.23,1,0.32,1)]`. O conteúdo da coluna com `opacity 220ms ease` (delay 80ms ao abrir) e `translate-x-3 → 0`. Com `useReducedMotion`, sem transform e 120ms.

- [ ] **Step 3: `inert` no lugar de `aria-hidden`**

A coluna **continua montada** quando recolhida e recebe `inert={!railOpen}`. É o que preserva o filtro, o campo selecionado e o rascunho não salvo enquanto está fechada, e o que dá à transição algo para desvanecer. `aria-hidden` sobre conteúdo com elementos focáveis deixaria o foco entrar em algo que o leitor de tela não anuncia; `inert` resolve foco, ponteiro e árvore de acessibilidade de uma vez, e React 19.2 o aceita como prop booleana.

- [ ] **Step 4: Rail recolhido**

Sobre a faixa de 48px: botão `«` (`size-7 rounded-lg border border-border/70`, `aria-label="Abrir oportunidades"`), badge de contagem, rótulo vertical e o `RiEditLine` no pé, que chama `open()` e foca o `Textarea` ativo por ref no `transitionend`. O botão `»` do cabeçalho aberto ganha `aria-expanded={railOpen}` e `aria-controls` apontando para o id da coluna.

- [ ] **Step 5: Verificar**

```bash
pnpm exec tsc --noEmit && pnpm lint
```

No preview, com o dialog aberto na aba Oportunidade: `Ctrl + B` recolhe e abre só a coluna — o sidebar do app não reage. Fechar o dialog e apertar `Ctrl + B`: o sidebar volta a responder. Recolher, recarregar a página e reabrir o lead: continua recolhida. Com a coluna recolhida, apertar Tab repetidamente não entra em nada dentro dela. Escolher um filtro, recolher, abrir: o filtro continua escolhido. Digitar no bloco do analista, recolher antes de salvar, abrir: o texto continua lá.

- [ ] **Step 6: Commit**

```bash
git add components/custom/LeadGbpPanel
git commit -m "feat(gbp): coluna de oportunidades colapsável com Ctrl+B"
```

---

### Task 10: Modo reunião completo, responsivo, skeleton e limpeza

**Files:**
- Modify: `LeadGbpPanel.tsx` (skeleton, responsivo), `LeadGbpDirectoriesCard.tsx`, `LeadGbpReviewsBlock.tsx`, `LeadGbpRankBlock.tsx`
- Delete: `LeadGbpProfileCard.tsx`, `LeadGbpIdentity.tsx`, `LeadGbpSummaryCards.tsx`

- [ ] **Step 1: Fechar o modo reunião**

Propagar `readingMode` aos que faltam e esconder: o `Select` de tempo de resposta (`LeadGbpReviewsBlock`), o `Input` de termos e o botão "Checar ranking" (`LeadGbpRankBlock`), os `Select` de estado dos diretórios — que viram texto (`LeadGbpDirectoriesCard`). Conferir a regra: nada no modo reunião **habilita** coisa alguma.

- [ ] **Step 2: Skeleton novo**

No `LeadGbpPanel`, trocar o skeleton de nove cards pelo shell novo: trilha como hoje, faixa de cinco blocos de 64px, barra de quatro pílulas, grade de dois cards altos, coluna direita com seis linhas de 44px.

- [ ] **Step 3: Responsivo**

Abaixo de `xl`, a coluna nasce recolhida quando não há preferência gravada (já vem do hook) e o atalho não é registrado. Abaixo de `lg`, o corpo empilha como hoje, o grid da view colapsa para uma coluna, e a coluna de oportunidades vira a seção final do scroll com o bloco do analista abaixo dela.

- [ ] **Step 4: Limpeza**

Apagar `LeadGbpProfileCard.tsx`, `LeadGbpIdentity.tsx` e `LeadGbpSummaryCards.tsx`; remover `UpcomingStepPlaceholder` e o `Pulse` antigo se ficaram sem uso; conferir `components/custom/LeadGbpPanel/index.ts`.

```bash
pnpm exec tsc --noEmit
```

Esperado: PASS. Um import órfão apareceria aqui.

- [ ] **Step 5: Contraste e ordem de foco**

Conferir 4,5:1 em texto sobre `bg-accent` e nos chips `text-warning`/`text-success` sobre fundo `/10`, em light e dark. Se algum cair abaixo, usar o token cheio no texto — nunca uma versão com alfa.

Com o dialog aberto na aba Oportunidade, apertar Tab desde o topo e conferir a ordem: trilha → cabeçalho da etapa → abas → painel ativo → coluna. A ordem sai da ordem do DOM que a arquitetura produz; se divergir, é sinal de que algum bloco foi montado fora do lugar. Foco visível em cada parada — o anel padrão do app já cobre.

- [ ] **Step 6: Verificação final**

```bash
pnpm lint && pnpm exec tsc --noEmit
```

E, a 1440×900, comparar lado a lado com a prancha `1a` de `Auditoria Digital.dc.html`. Rodar a lista do spec §"Verificação" inteira.

- [ ] **Step 7: Commit**

```bash
git add -A components/custom/LeadGbpPanel
git commit -m "feat(gbp): modo reunião completo, skeleton e responsivo do shell novo"
```

---

## Ordem e pontos de parada

As tasks 1 a 3 são invisíveis ao usuário e podem ser revisadas por `tsc` e por "a tela não mudou". Da 4 em diante cada task deixa a tela em estado usável, então dá para parar em qualquer uma. As tasks 5 e 9 são as que mais merecem revisão em preview antes de seguir: a 5 porque `keepMounted` muda o ciclo de vida de tudo que está nas abas, e a 9 porque o atalho disputa com dois listeners do app.
