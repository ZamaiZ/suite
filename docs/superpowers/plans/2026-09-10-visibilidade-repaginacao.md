# Visibilidade — Repaginação para o Shell de Etapa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar a Visibilidade para o mesmo shell das outras três etapas operacionais e, no mesmo movimento, tornar visível o dado que a correção de confiabilidade passou a coletar.

**Architecture:** Doze tarefas em três blocos. Do **domínio puro para dentro** (tabela, review, temas, agregações — tudo testável com `node --test`), depois o **shell** (controller, view, cabeçalho), depois as **quatro abas**, uma por tarefa. A ordem não é estética: cada bloco compila e é revisável sozinho, e nenhuma tarefa de tela depende de outra tarefa de tela.

**Tech Stack:** Next.js (App Router, Server Actions), TypeScript, Supabase (jsonb + RLS), shadcn base-mira sobre Base UI, `motion/react-m`, `node --test` com type-stripping do Node 22.

**Spec:** `docs/superpowers/specs/2026-09-10-visibilidade-repaginacao-design.md`
**Spec irmã (dado):** `docs/superpowers/specs/2026-09-10-visibilidade-confiabilidade-design.md`
**Skill de front-end:** `.claude/skills/suite-frontend/` — leia `references/tokens.md` antes da primeira classe e `references/checks.md` antes de dizer que terminou.

## Global Constraints

Valem para **todas** as tarefas.

### Processo

- **Verificação em bloco, no fim.** Não rode `pnpm lint`, `pnpm exec tsc --noEmit` nem `pnpm test` por tarefa — o dono do repo pediu uma passada só, na **Task 12**. Escreva com cuidado: sem o portão a cada tarefa, erro de tipo se acumula.
- **O `git` é do dono do repo.** Cada tarefa termina com a mensagem sugerida e **para**. Não rode `git commit`, `git push`, nem crie branch ou PR.
- **Leia `node_modules/next/dist/docs/` antes de escrever código de Next.** Esta versão tem breaking changes (`AGENTS.md` na raiz).
- **Sem subagentes de busca neste repo.** Ler e buscar direto.
- **Ambiente Git Bash no Windows:** `grep -P` não funciona e `bc` não existe. Use `grep -E`.

### Front-end — leis da skill

- **Cor só por token semântico.** Zero `oklch(`, `#hex` ou `rgb(` em `components/custom`.
- **`accent` é superfície Mist, nunca teal textual.** Teal de texto é `text-primary`.
- **Ícone só de `react-icons/ri`.** Zero Lucide.
- **`cn` importado de `"cn"`**, nunca de `@/lib/utils`.
- **`m.*` de `motion/react-m`**, nunca `motion.*` — o `LazyMotion strict` da raiz deixa o conteúdo invisível no DOM.
- **`useReducedMotion` em todo componente que anima**, com `initial={reduced ? false : {...}}` — `false`, não `undefined`.
- **Easing único `[0.23, 1, 0.32, 1]`.** Durações: 120ms micro-estado, 180ms revelação, 280ms colapso, 550ms crescimento de dado. Sair delas exige comentário na linha.
- **Empilhamento só por `--z-index-*`.** Nada de `z-[60]` avulso.
- **Altura de controle vem de `size`.** Nada de `h-10` num `Button`/`Input`/`SelectTrigger`.
- **Nada de `@base-ui/react` direto** quando existe equivalente em `components/ui`.
- **Não escreva primitive à mão.** O que faltar se instala pelo CLI do shadcn — e **troque o import de `@remixicon/react` por `react-icons/ri` depois de todo `add`**.
- **Ausência é `—`, nunca zero.**
- **Trilha sem escala não é renderizada.** Barra de fração só onde "cheio" é bom.
- **Estado nunca só por cor** — sempre com texto, ícone ou forma junto.
- **Meta nunca em `A · B · C`.** Frase pronta não tem hierarquia para declarar.
- **Sobrancelha caixa-alta só quando carrega informação que o título não carrega.**

### Estado — leis do `state.md`

- **Ajuste ligado a chave vai no render, não em efeito.**
- **Dependência de efeito é chave, nunca objeto.**
- **Esconder não é desmontar.** `hidden` em campo com rascunho; `keepMounted` no `TabsContent`.
- **Um debounce por linha do banco.** Um `saveStatus` e um `saveError` só.
- **Campo ausente não é campo vazio.** `optionalFormText` devolve `undefined`, e campo ausente não entra no `upsert`.
- **Preferência de UI com inicializador preguiçoso e chave por tela:** `visibility:opportunities-rail`, `visibility:analyst-block`, `visibility:header-numbers`.
- **Recolhido recebe `inert`, nunca `aria-hidden`.**
- **Atalho desta tela registra em `window` na fase de captura** — `useCaptureShortcut` já faz.

### Valores exatos

- `RAIL_W = "21.25rem"`, `RAIL_W_CLOSED = "3rem"`
- `VISIBILITY_NOTES_MAX = 2000`, `VISIBILITY_REVIEW_NOTE_MAX = 400`
- `VISIBILITY_STALE_SERP_DAYS = 90` (já existe em `visibility-audit.ts`)
- `VISIBILITY_LOW_TRAFFIC = 50` (já existe)
- Debounce de autosave: **800ms**, como nas outras etapas
- Teto inicial da tabela: **50 linhas**, incremento de **50**

---

## File Structure

**Criar**

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20260926000000_lead_visibility_reviews.sql` | tabela e RLS |
| `lib/leads/visibility-review.ts` | critérios, catálogo, veredito, progresso, leitor |
| `lib/leads/visibility-review.test.mjs` | progresso, leitor tolerante, oportunidades |
| `lib/leads/visibility-step-tabs.ts` | `VisibilityStepTabId`, `VISIBILITY_STEP_TABS` |
| `lib/leads/visibility-pages.ts` | agregação por página, host e intenção |
| `lib/leads/visibility-pages.test.mjs` | as três agregações |
| `lib/validations/lead-visibility-review.ts` | zod da action |
| `app/actions/leads/upsert-visibility-review.ts` | upsert do review |
| `components/custom/LeadStepShell/StepCard.tsx` | o card promovido |
| `components/custom/LeadVisibilityPanel/use-visibility-controller.ts` | todo o estado e as ações |
| `…/LeadVisibilityView.tsx` | grid `central \| coluna`, abas, atalhos |
| `…/LeadVisibilityHeader.tsx` | cabeçalho fixo com colapso |
| `…/LeadVisibilityIdentityCell.tsx` | domínio, badges, idade do índice |
| `…/LeadVisibilityMetricCells.tsx` | os quatro big numbers |
| `…/LeadVisibilityTabPanels.tsx` | os quatro painéis |
| `…/LeadVisibilityRankedList.tsx` | linha ranqueada com barra |
| `…/LeadVisibilityIndexAgeGauge.tsx` | régua de banda da idade |
| `…/LeadVisibilityAnalystBlock.tsx` | notas + critérios na coluna |
| `…/LeadVisibilityReview.tsx` | a aba Validação |

**Modificar**

| Arquivo | Mudança |
|---|---|
| `components/custom/LeadStepShell/index.ts` | exporta `StepCard` |
| `components/custom/LeadGbpPanel/LeadGbpCard.tsx` | reexporta do shell |
| os 8 consumidores de `LeadGbpCard` | importam do shell |
| `components/custom/LeadGbpPanel/LeadGbpPanel.tsx:427` | `fullBleed` inclui `visibility`; `readingMode` chega |
| `lib/leads/visibility-opportunities.ts` | tema por gap, `byTheme`, oportunidades do analista |
| `…/LeadVisibilityKeywordsTable.tsx` | filtros, ordenação, teto |
| `…/LeadVisibilityPanel.tsx` | casca fina sobre controller e view |
| `…/LeadVisibilityPanel.types.ts` | `readingMode` |
| `…/index.ts` | exporta o que a etapa expõe |
| `lib/leads/diagnosis-compile.ts` | lê o review da Visibilidade |
| `app/actions/leads/index.ts` | exporta a action nova |
| `app/actions/leads/get-lead.ts` | `LeadDetail.visibilityReview` e a consulta |
| `.claude/skills/suite-frontend/references/components.md` · `layout.md` | `StepCard` no shell, Visibilidade no arquétipo |

**Apagar**

| Arquivo | Por quê |
|---|---|
| `…/LeadVisibilityChecks.tsx` | os checks viram a lista da coluna de oportunidades |
| `…/LeadVisibilitySummaryCards.tsx` | substituído pelos big numbers do cabeçalho |
| `…/LeadVisibilityStepHeader.tsx` | reescrito com custo e idade |

---

### Task 1: `StepCard` no shell, e os oito consumidores

`LeadGbpCard` é consumido por 8 arquivos **fora** do GBP — Website (4), Presença digital (1), Diagnóstico (1) e Visibilidade (2). É um primitive do shell morando na pasta errada. Primeiro, porque tudo que vem depois consome.

**Files:**
- Create: `components/custom/LeadStepShell/StepCard.tsx`
- Modify: `components/custom/LeadStepShell/index.ts`
- Modify: `components/custom/LeadGbpPanel/LeadGbpCard.tsx`
- Modify: os 8 consumidores listados pelo grep do Step 3

**Interfaces:**
- Produces: `StepCard({ title, children, className })` — **mesma API** de `LeadGbpCard`.

- [ ] **Step 1: Criar o card no shell**

`components/custom/LeadStepShell/StepCard.tsx`, com o corpo idêntico ao de `LeadGbpCard`:

```tsx
import type { ReactNode } from "react"
import { cn } from "cn"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * Card de seção das etapas de auditoria. Nasceu como `LeadGbpCard`, dentro da
 * pasta do Perfil no Google, e acabou consumido por Website, Presença digital,
 * Diagnóstico e Visibilidade — oito arquivos fora do dono. Era um primitive do
 * shell morando na pasta errada, e etapa importando componente de etapa vizinha
 * é acoplamento que não se justifica.
 */
export function StepCard({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <Card size="sm" render={<section />} className={cn("min-h-0", className)}>
      <CardHeader>
        <CardTitle render={<h3 />} className="font-semibold">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 flex-1">{children}</CardContent>
    </Card>
  )
}
```

Em `index.ts` do shell, junto dos outros exports:

```ts
export { StepCard } from "./StepCard"
```

- [ ] **Step 2: Reexportar do lugar antigo**

`components/custom/LeadGbpPanel/LeadGbpCard.tsx` passa a ser só:

```tsx
/**
 * Reexport de compatibilidade. O componente mora em
 * `components/custom/LeadStepShell/StepCard.tsx` desde a repaginação da
 * Visibilidade. Este arquivo some quando o último import antigo migrar.
 */
export { StepCard as LeadGbpCard } from "@/components/custom/LeadStepShell"
```

Com isso **nenhum consumidor quebra**, e a migração acontece arquivo a arquivo em vez de num big bang.

- [ ] **Step 3: Migrar os oito consumidores**

```bash
grep -rln "LeadGbpCard" --include=*.tsx components/custom
```

Em cada um, trocar o import e o uso:

```tsx
// antes
import { LeadGbpCard } from "@/components/custom/LeadGbpPanel/LeadGbpCard"
// depois
import { StepCard } from "@/components/custom/LeadStepShell"
```

e `<LeadGbpCard` → `<StepCard`, `</LeadGbpCard>` → `</StepCard>`.

Os arquivos são: `LeadDiagnosisPanel/LeadDiagnosisPanel.tsx`, `LeadDigitalPresencePanel/LeadDigitalPresenceSiteCards.tsx`, `LeadVisibilityPanel/LeadVisibilityChecks.tsx`, `LeadVisibilityPanel/LeadVisibilityKeywordsTable.tsx`, `LeadWebsitePanel/LeadWebsiteAuditCard.tsx`, `LeadWebsitePanel/LeadWebsiteAuthorityCards.tsx`, `LeadWebsitePanel/LeadWebsitePagespeedCard.tsx`, `LeadWebsitePanel/LeadWebsiteReview.tsx` — mais os do próprio GBP.

- [ ] **Step 4: Apagar o reexport quando não houver mais import antigo**

```bash
grep -rn "LeadGbpCard" --include=*.tsx components/custom | wc -l
```

Se der `0`, apague `components/custom/LeadGbpPanel/LeadGbpCard.tsx`. Se der mais que zero, **pare e liste** — sobrou consumidor que o Step 3 não viu.

- [ ] **Step 5: Atualizar a skill no mesmo passo**

`references/components.md`: acrescentar `StepCard` à tabela de módulos do `LeadStepShell` e remover a menção a `LeadGbpCard` como componente do GBP. A skill diz: *"Skill que mente sobre os tokens é pior que skill nenhuma: ela é obedecida."*

- [ ] **Step 6: Commit (marcar a fronteira, não executar)**

```
refactor(shell): promove LeadGbpCard para StepCard no shell de etapa
```

---

### Task 2: A tabela do review e o domínio do julgamento

**Files:**
- Create: `supabase/migrations/20260926000000_lead_visibility_reviews.sql`
- Create: `lib/leads/visibility-review.ts`
- Create: `lib/leads/visibility-review.test.mjs`
- Create: `lib/validations/lead-visibility-review.ts`
- Create: `app/actions/leads/upsert-visibility-review.ts`
- Modify: `app/actions/leads/index.ts`

**Interfaces:**
- Produces: `VisibilityReview`, `VISIBILITY_REVIEW_CATALOG`, `VISIBILITY_REVIEW_CHIP_IDS`, `emptyVisibilityReview()`, `readVisibilityReviewRow()`, `visibilityReviewProgress()`, `visibilityReviewOpportunityId()`, `upsertLeadVisibilityReview(formData)`.

- [ ] **Step 1: A migração**

Espelha `20260919000000_lead_website_reviews.sql`, com o mesmo cabeçalho explicando o porquê, e **reexecutável**:

```sql
-- O julgamento do analista sai do snapshot e passa a viver por lead.
-- `lead_visibility_audits` e append-only desde 20260917000000: julgamento humano
-- gravado la seria versionado junto com a coleta e duplicado a cada analise.

create table if not exists public.lead_visibility_reviews (
  id          uuid        primary key default gen_random_uuid(),
  lead_id     uuid        not null references public.leads(id) on delete cascade,
  review      jsonb       not null default '{}'::jsonb,
  notes       text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid        references public.users(id),
  constraint lead_visibility_reviews_notes_len_chk
    check (notes is null or char_length(trim(notes)) between 1 and 2000),
  constraint lead_visibility_reviews_review_obj_chk
    check (jsonb_typeof(review) = 'object')
);

create unique index if not exists lead_visibility_reviews_lead_id_uidx
  on public.lead_visibility_reviews (lead_id);

alter table public.lead_visibility_reviews enable row level security;
```

Mais as quatro políticas no padrão `<tabela>_<acao>_commercial`, cada uma precedida de `drop policy if exists`, e `revoke all … from anon, authenticated` seguido de `grant select, insert, update, delete … to authenticated` — copie a forma exata de `20260919000000_lead_website_reviews.sql`.

- [ ] **Step 2: Escrever os testes que falham**

`lib/leads/visibility-review.test.mjs`:

```js
import assert from "node:assert/strict"
import { test } from "node:test"

import {
  emptyVisibilityReview,
  readVisibilityReviewRow,
  visibilityReviewProgress,
  VISIBILITY_REVIEW_CHIP_IDS,
} from "./visibility-review.ts"

test("o progresso conta os critérios com veredito, e ignora `other`", () => {
  const review = emptyVisibilityReview()
  assert.deepEqual(visibilityReviewProgress(review), { done: 0, total: 4 })
  review.host_intent.verdict = "ok"
  review.other.note = "texto solto não é veredito"
  assert.deepEqual(visibilityReviewProgress(review), { done: 1, total: 4 })
})

test("`other` fica de fora da lista de critérios com chip", () => {
  assert.equal(VISIBILITY_REVIEW_CHIP_IDS.includes("other"), false)
  assert.equal(VISIBILITY_REVIEW_CHIP_IDS.length, 4)
})

test("linha ausente lê como review vazio, não como null", () => {
  // Lead nunca julgado não é lead com julgamento perdido. A tela precisa de um
  // objeto para montar os quatro critérios em branco.
  const parsed = readVisibilityReviewRow(null)
  assert.deepEqual(visibilityReviewProgress(parsed.review), { done: 0, total: 4 })
  assert.equal(parsed.notes, null)
})

test("veredito inválido vira null em vez de derrubar a linha", () => {
  const parsed = readVisibilityReviewRow({
    review: { host_intent: { verdict: "talvez", note: "x" } },
    notes: "nota",
  })
  assert.equal(parsed.review.host_intent.verdict, null)
  assert.equal(parsed.review.host_intent.note, "x")
  assert.equal(parsed.notes, "nota")
})
```

- [ ] **Step 3: Escrever `lib/leads/visibility-review.ts`**

Espelha `lib/leads/website-review.ts` na forma. O catálogo é o da spec:

```ts
export const VISIBILITY_NOTES_MAX = 2000
export const VISIBILITY_REVIEW_NOTE_MAX = 400

export const VISIBILITY_REVIEW_CRITERION_IDS = [
  "host_intent",
  "brand_terms",
  "cannibalization",
  "local_fit",
  "other",
] as const

export type VisibilityReviewCriterionId =
  (typeof VISIBILITY_REVIEW_CRITERION_IDS)[number]

export type VisibilityReviewVerdict = "ok" | "issue" | "na"

export type VisibilityReviewAnswer = {
  verdict: VisibilityReviewVerdict | null
  note: string
  updatedAt: string | null
  updatedBy: string | null
}

export type VisibilityReview = Record<
  VisibilityReviewCriterionId,
  VisibilityReviewAnswer
>

export type VisibilityReviewImpact = "high" | "medium"

export type VisibilityReviewCriterion = {
  id: VisibilityReviewCriterionId
  label: string
  /** Vira o título da oportunidade quando o veredito é `issue`. */
  title: string
  impact: VisibilityReviewImpact
  allowsNa: boolean
  hasVerdict: boolean
  placeholder: string
}

/** `other` é nota livre, sem veredito — por isso fica fora do denominador. */
export const VISIBILITY_REVIEW_CHIP_IDS = [
  "host_intent",
  "brand_terms",
  "cannibalization",
  "local_fit",
] as const satisfies readonly VisibilityReviewCriterionId[]
```

E o catálogo, com o `placeholder` dizendo a pergunta que o analista responde:

```ts
export const VISIBILITY_REVIEW_CATALOG: readonly VisibilityReviewCriterion[] = [
  {
    id: "host_intent",
    label: "Subdomínio fora do principal",
    title: "Consolidar o tráfego no domínio principal",
    impact: "high",
    allowsNa: true,
    hasVerdict: true,
    // A máquina vê o host; só o humano sabe se ele é homologação, ambiente de
    // cliente ou produto de verdade.
    placeholder: "Esse host é homologação, cliente ou produto?",
  },
  {
    id: "brand_terms",
    label: "Termos de marca",
    title: "Ranquear além dos termos de marca",
    impact: "high",
    allowsNa: false,
    hasVerdict: true,
    // `isBrandKeyword` casa por token do nome da empresa. "Busca Orgânica" é
    // literalmente um termo genérico — a heurística não separa marca de
    // categoria, e no top 10 essa diferença decide o diagnóstico.
    placeholder: "As keywords do topo são marca ou categoria?",
  },
  {
    id: "cannibalization",
    label: "Canibalização entre páginas",
    title: "Resolver páginas disputando a mesma busca",
    impact: "medium",
    allowsNa: false,
    hasVerdict: true,
    // `ranked_keywords` devolve uma linha por keyword. Duas páginas disputando
    // o mesmo termo é padrão *entre* linhas, que nenhuma regra por linha vê.
    placeholder: "Há duas URLs disputando a mesma busca?",
  },
  {
    id: "local_fit",
    label: "Aderência local",
    title: "Alinhar as buscas locais à região atendida",
    impact: "medium",
    allowsNa: true,
    hasVerdict: true,
    // `isLocalKeyword` casa `\bem\b` e o nome da cidade. Grosseiro por
    // construção, e cego para a região que o negócio de fato atende.
    placeholder: "As buscas locais batem com a área atendida?",
  },
  {
    id: "other",
    label: "Outro achado",
    title: "Tratar achado do analista",
    impact: "medium",
    allowsNa: false,
    hasVerdict: false,
    placeholder: "O que mais apareceu nesta coleta?",
  },
]
```

`readVisibilityReviewRow(row: Record<string, unknown> | null)` devolve
`{ review, notes }` — **nunca `null`**, porque lead sem julgamento precisa dos
quatro critérios em branco na tela. Veredito fora do enum vira `null` sem
derrubar a nota.

- [ ] **Step 4: Zod e action**

`lib/validations/lead-visibility-review.ts` espelha o do Website, com
`optionalFormText` para o par ausente/vazio — **campo ausente não é campo
vazio**: `undefined` não entra no `upsert` e preserva o que estava lá; string
vazia grava `null`.

`app/actions/leads/upsert-visibility-review.ts`:

```ts
"use server"

// Um upsert por lead, com `onConflict: "lead_id"`. O par (review, notes) chega
// junto porque grava na mesma linha pela mesma action — dois timers de debounce
// para a mesma linha fariam a última requisição sobrescrever o campo que a
// outra acabou de gravar.
```

Autorização por `requireCommercialMember` e `denyVisibilityEdit`, como
`analyze-visibility.ts` já faz. Exportar em `app/actions/leads/index.ts`.

- [ ] **Step 5: O review chega ao `LeadDetail`**

Sem este passo o controller da Task 5 leria um campo que não existe.

Em `app/actions/leads/get-lead.ts`, o tipo `LeadDetail` (linha ~75) ganha o
campo ao lado de `visibilityAudit`:

```ts
visibilityAudit: LeadVisibilityAudit | null
visibilityReview: LeadVisibilityReview
```

**Não é anulável.** Lead nunca julgado não é lead com julgamento perdido: a tela
precisa dos quatro critérios em branco para montar, e `readVisibilityReviewRow`
já devolve o vazio quando a linha não existe.

Na consulta, acrescente o `select` da tabela nova ao mesmo bloco paralelo em que
`visibilityRow` já é buscado, e na montagem (linha ~350):

```ts
visibilityReview: readVisibilityReviewRow(
  visibilityReviewRow as Record<string, unknown> | null,
),
```

Confira também `app/actions/leads/compile-lead-diagnosis.ts:151`, que monta o
próprio contexto — ele recebe o review na Task 11.

- [ ] **Step 6: Commit**

```
feat(visibilidade): tabela e domínio do julgamento do analista
```

---

### Task 3: Tema de oportunidade e as abas

**Files:**
- Create: `lib/leads/visibility-step-tabs.ts`
- Modify: `lib/leads/visibility-opportunities.ts`
- Modify: `lib/leads/visibility-review.test.mjs` (acrescenta os testes de tema)

**Interfaces:**
- Consumes: `VisibilityGapId`, `VisibilityReview` das tasks anteriores.
- Produces: `VisibilityStepTabId`, `VISIBILITY_STEP_TABS`, `visibilityOpportunityTheme()`, `visibilityOpportunitiesByTheme()`.

- [ ] **Step 1: Escrever os testes que falham**

```js
test("todo gap tem tema, e o Record cobre as quatro abas", () => {
  const byTheme = visibilityOpportunitiesByTheme([])
  assert.deepEqual(Object.keys(byTheme).sort(), [
    "keywords",
    "paginas",
    "panorama",
    "validacao",
  ])
})

test("o host não-canônico cai na aba de páginas", () => {
  const byTheme = visibilityOpportunitiesByTheme([
    { id: "non_canonical_host_traffic", title: "x", impact: "high", source: "machine" },
  ])
  assert.equal(byTheme.paginas.length, 1)
  assert.equal(byTheme.panorama.length, 0)
})

test("o achado do analista cai na aba de validação", () => {
  const byTheme = visibilityOpportunitiesByTheme([
    { id: "review:host_intent", title: "y", impact: "high", source: "analyst" },
  ])
  assert.equal(byTheme.validacao.length, 1)
})
```

- [ ] **Step 2: O arquivo de abas**

```ts
/**
 * Aba e tema são o mesmo eixo: o contador da aba é a contagem do grupo da
 * coluna. Um tipo só evita a tradução no meio do caminho — que é por onde a
 * trilha e a lista da tela já divergiram uma vez no GBP.
 *
 * Sem campo `icon`: nem a barra do Website nem a do GBP renderizam ícone, e
 * três barras de etapa que diferem custam mais do que o ícone entrega.
 */
export type VisibilityStepTabId =
  | "panorama"
  | "keywords"
  | "paginas"
  | "validacao"

export const VISIBILITY_STEP_TABS: ReadonlyArray<{
  id: VisibilityStepTabId
  label: string
}> = [
  { id: "panorama", label: "Panorama" },
  { id: "keywords", label: "Keywords" },
  { id: "paginas", label: "Páginas" },
  { id: "validacao", label: "Validação" },
]
```

- [ ] **Step 3: Tema por gap, exaustivo**

Em `visibility-opportunities.ts`. O `Record` sobre a união inteira é o portão:
gap novo sem tema **não compila**.

```ts
const GAP_THEME: Record<VisibilityGapId, VisibilityStepTabId> = {
  not_ranking: "panorama",
  thin_keyword_footprint: "panorama",
  low_organic_traffic: "panorama",
  brand_only_visibility: "keywords",
  no_local_top20: "keywords",
  homepage_only: "paginas",
  non_canonical_host_traffic: "paginas",
}

/** `review:<id>` é do analista e mora sempre na aba de validação. */
export function visibilityOpportunityTheme(id: string): VisibilityStepTabId {
  if (id.startsWith("review:")) return "validacao"
  return GAP_THEME[id as VisibilityGapId] ?? "panorama"
}
```

`mergeVisibilityOpportunities` passa a aceitar o `review` e a emitir os itens
`review:*` quando o critério tem veredito `issue` **e** nota preenchida — mesma
regra de `websiteReviewHasOpportunity`. **A máquina não escreve em `review`, e
campo em branco do analista não gera gap.**

- [ ] **Step 4: Commit**

```
feat(visibilidade): tema de oportunidade e as quatro abas
```

---

### Task 4: Agregação por página, host e intenção

O dado já está no snapshot desde a correção de confiabilidade. Falta a leitura.

**Files:**
- Create: `lib/leads/visibility-pages.ts`
- Create: `lib/leads/visibility-pages.test.mjs`

**Interfaces:**
- Consumes: `VisibilitySnapshot` da spec irmã.
- Produces: `visibilityPages()`, `visibilityIntentBreakdown()`, `visibilityCanonicalTrafficShare()`, `type VisibilityPageRow`.

- [ ] **Step 1: Escrever os testes que falham**

```js
test("agrupa por URL completa e soma o tráfego", () => {
  const pages = visibilityPages(SNAPSHOT)
  const top = pages[0]
  assert.equal(top.url.full, "https://www.buscaorganica.com.br/")
  assert.equal(top.keywords, 2)
  assert.ok(top.traffic > 0)
})

test("ordena por tráfego, não por contagem de keywords", () => {
  // A página que carrega o domínio nem sempre é a que tem mais termos.
  const pages = visibilityPages(SNAPSHOT)
  for (let i = 1; i < pages.length; i++) {
    assert.ok(pages[i - 1].traffic >= pages[i].traffic)
  }
})

test("a intenção sem classificação confiável é uma linha, não um buraco", () => {
  // Um terço das classificações medidas ficou abaixo do limiar. Some-las do
  // total faria as porcentagens somarem menos que 100 sem explicação.
  const rows = visibilityIntentBreakdown(SNAPSHOT)
  const unclassified = rows.find((r) => r.id === "unclassified")
  assert.ok(unclassified)
  assert.equal(
    rows.reduce((sum, r) => sum + r.keywords, 0),
    SNAPSHOT.keywords.length,
  )
})

test("a fração do tráfego no host canônico é 1 quando só há um host", () => {
  assert.equal(visibilityCanonicalTrafficShare([]), null)
  assert.equal(
    visibilityCanonicalTrafficShare([
      { host: "www.x.com.br", keywords: 10, traffic: 100, isCanonical: true },
    ]),
    1,
  )
})
```

O `SNAPSHOT` do teste sai de `lib/leads/visibility-labs-map.fixture.json`
passado por `mapRankedKeywordsLiveResult` — o mesmo payload real de 2026-09-10.

- [ ] **Step 2: Implementar**

```ts
export type VisibilityPageRow = {
  url: VisibilityUrl
  keywords: number
  traffic: number
  bestPosition: number | null
}

/** Agrupa por `url.full`; linha sem URL não entra. Ordena por tráfego. */
export function visibilityPages(
  snapshot: VisibilitySnapshot,
): VisibilityPageRow[]

/**
 * Distribuição de intenção. As keywords abaixo do limiar de probabilidade
 * entram como `unclassified` — uma linha própria, não um buraco: somem da conta
 * e as porcentagens fecham em menos de 100 sem explicar por quê.
 */
export function visibilityIntentBreakdown(
  snapshot: VisibilitySnapshot,
): Array<{ id: string; label: string; keywords: number; traffic: number }>

/** `null` sem hosts — sem denominador não há fração, e trilha sem escala mente. */
export function visibilityCanonicalTrafficShare(
  hosts: ReadonlyArray<VisibilityHost>,
): number | null
```

- [ ] **Step 3: Commit**

```
feat(visibilidade): agregação por página, host e intenção
```

---

### Task 5: O controller

Tira o estado de dentro do componente, como as outras três etapas já fazem.

**Files:**
- Create: `components/custom/LeadVisibilityPanel/use-visibility-controller.ts`
- Modify: `components/custom/LeadVisibilityPanel/LeadVisibilityPanel.types.ts`

**Interfaces:**
- Consumes: tasks 2–4.
- Produces: `useVisibilityController(input)` → `VisibilityController` com `audit`, `snapshot`, `review`, `notes`, `opportunities`, `busy`, `error`, `saveStatus`, `saveError`, `canEdit`, `city`, `companyName`, `handleAnalyze()`, `saveReview()`.

- [ ] **Step 1: Espelhar `use-website-controller.ts`**

Leia o arquivo inteiro antes de escrever — ele resolve, nesta ordem: sincronização por chave no render, debounce único por linha do banco, `saveStatus`/`saveError` únicos, e `handleAnalyze` com `onPendingChange`.

Três pontos que **não** são cópia:

```ts
// 1. A chave de sincronização é o lead, não o canal: a Visibilidade tem um
//    review por lead, e não um por canal como o Website.
const syncKey = detail.lead.id

// 2. Um timer só para `review` + `notes`, porque gravam na mesma linha pela
//    mesma action. Dois timers fariam a última requisição sobrescrever o campo
//    que a outra acabou de gravar.
function schedule(next: { review: VisibilityReview; notes: string }) {
  draftRef.current = next
  window.clearTimeout(timerRef.current)
  timerRef.current = window.setTimeout(() => persist(draftRef.current), 800)
}

// 3. `handleAnalyze` custa ~US$ 0,05 em duas chamadas pagas. `busy` trava o
//    botão durante a coleta — clique duplo é dinheiro.
```

- [ ] **Step 2: `readingMode` no tipo**

`LeadVisibilityPanel.types.ts` ganha `readingMode: boolean`, como os três irmãos.

- [ ] **Step 3: Commit**

```
refactor(visibilidade): extrai o controller da etapa
```

---

### Task 6: O shell — view, cabeçalho, identidade e big numbers

A tarefa estrutural. Ao fim dela a etapa já monta o layout, ainda que as abas estejam com conteúdo mínimo.

**Files:**
- Create: `LeadVisibilityView.tsx`, `LeadVisibilityHeader.tsx`, `LeadVisibilityIdentityCell.tsx`, `LeadVisibilityMetricCells.tsx`, `LeadVisibilityTabPanels.tsx`
- Modify: `LeadVisibilityPanel.tsx`, `index.ts`, `LeadGbpPanel.tsx:427`
- Delete: `LeadVisibilitySummaryCards.tsx`, `LeadVisibilityStepHeader.tsx`, `LeadVisibilityChecks.tsx`

**Interfaces:**
- Consumes: `useVisibilityController`, `VISIBILITY_STEP_TABS`, `visibilityOpportunitiesByTheme`, `StepOpportunitiesRail`, `StepStat`, `StepMeter`, `StepTabs`, `useCollapsibleRail`, `useCaptureShortcut`, `useWideViewport`.
- Produces: `LeadVisibilityView`, `LeadVisibilityHeader`.

- [ ] **Step 1: Abrir o `fullBleed`**

Em `LeadGbpPanel.tsx:427`, a Visibilidade entra na condição — e o comentário explica por quê ela não tem condicional própria:

```tsx
const fullBleed =
  (selectedStep === "google-profile" &&
    profiles.length > 0 &&
    selected !== null) ||
  websiteFullBleed ||
  selectedStep === "digital-presence" ||
  // Sem condição, como a presença digital: a Visibilidade monta o shell mesmo
  // sem site cadastrado e sem coleta — cada aba tem o próprio vazio, e o botão
  // de analisar mora no cabeçalho fixo.
  selectedStep === "visibility"
```

E `readingMode={readingMode}` passa a ser passado ao `<LeadVisibilityPanel>`.

- [ ] **Step 2: A view**

Copie a estrutura de `LeadWebsiteView.tsx` — ela já resolve o grid de duas
colunas com `--rail-w`, o `collapsed` abaixo de `xl`, os dois atalhos, o
`keepMounted` e o reset de aba por chave. Troque:

- `RAIL_KEY = "visibility:opportunities-rail"`, `ANALYST_KEY = "visibility:analyst-block"`
- `layoutId="visibility-step-tab-underline"` — **`layoutId` é namespace global**; repetir o do Website faria os dois sublinhados brigarem
- `id="visibility-opportunities-rail"`
- a chave de reset de aba é `detail.lead.id`, não o canal

- [ ] **Step 3: O cabeçalho**

Copie a estrutura de `LeadWebsiteHeader.tsx`: colapso por
`grid-template-rows: 1fr → 0fr` com o filho em `overflow-hidden`, faixa de
avisos condicional, e o botão de dobrar na linha das abas.

A faixa de avisos da Visibilidade diz quatro coisas, cada uma só quando existe:

```tsx
{error ? <p role="alert" …>{error}</p> : null}
{busy ? <p …><Spinner … />Analisando visibilidade…</p> : null}
{/* A segunda chamada pode falhar sozinha sem derrubar a coleta. Quando falha,
    a tabela inteira mostra "—" na intenção, e o motivo precisa estar escrito. */}
{snapshot && snapshot.keywords.every((k) => k.intent === null) ? (
  <p …>Intenção não coletada nesta análise.</p>
) : null}
{snapshot && snapshot.droppedRows > 0 ? (
  <p …>{snapshot.droppedRows} linha(s) ilegível(is) descartada(s) na coleta.</p>
) : null}
```

- [ ] **Step 4: A célula de identidade**

Domínio como link para `https://<domain>`, `main_domain` abaixo quando diferir,
e **três badges separadas** — nunca uma string juntada:

```tsx
<Badge variant="secondary">Brasil · pt</Badge>
<Badge variant="secondary">DataForSEO · índice</Badge>
{indexAge ? (
  <Badge variant="secondary">Índice de ~{indexAge.serpMedianDays} dias</Badge>
) : null}
```

As duas primeiras são procedência fixa e podem ser uma string cada; o que não
pode é as três virarem `A · B · C` num parágrafo cinza.

- [ ] **Step 5: Os quatro big numbers**

Copie a forma de `LeadWebsiteMetricCells.tsx` — o `Cell` com `button`,
`aria-label={'Ver a aba ' + TAB_LABEL[tab]}` e o `StepStat` dentro. Os valores
são os da spec:

```tsx
<Cell tab="panorama" icon={RiTrafficLightLine} label="TRÁFEGO"
  value={fmt(metrics.estimatedTraffic, 0)}
  unit="cliques/mês"
  hint={cost === null ? undefined : `≈ US$ ${fmt(cost, 0)}/mês em mídia`}
  tone={traffic === null ? "neutral" : traffic < VISIBILITY_LOW_TRAFFIC ? "warning" : "success"}
  share={null} />
```

**`share={null}` em TRÁFEGO não é esquecimento.** Não existe denominador para
tráfego orgânico — sem mediana de mercado, a trilha desenharia uma escala que
não existe, e `layout.md` é explícito: *"trilha sem escala mente pior que
trilha ausente"*.

TOP 10 usa `share = (top3 + pos4to10) / keywordCount` com `stepShareTone`.
PÁGINAS usa `share = visibilityCanonicalTrafficShare(hosts)` com
`stepShareTone` — é a trilha que pinta o card de `warning` quando há host
secundário, sem precisar dizê-lo na unidade. VALIDAÇÃO usa
`visibilityReviewProgress` e tom `primary`.

Sem coleta, os quatro são `—`, `tone="neutral"` e `share={null}`.

- [ ] **Step 6: O painel vira casca**

`LeadVisibilityPanel.tsx` passa a montar o controller e delegar para a view,
como `LeadWebsitePanel.tsx` faz. Apagar `LeadVisibilitySummaryCards.tsx`,
`LeadVisibilityStepHeader.tsx` e `LeadVisibilityChecks.tsx` — os checks viram a
lista da coluna de oportunidades, que é onde os gaps já moram nas outras etapas.

- [ ] **Step 7: Commit**

```
feat(visibilidade): shell de etapa com cabeçalho fixo, big numbers e coluna
```

---

### Task 7: Aba Panorama

**Files:**
- Create: `LeadVisibilityIndexAgeGauge.tsx`
- Modify: `LeadVisibilityTabPanels.tsx`

- [ ] **Step 1: Distribuição de posições**

Reaproveita `LeadWebsiteStackedBar` — **não escreva outro**. Os buckets são
ordenados (Top 3 → 51–100), então a rampa sequencial `chart-1..5` é legítima, e
é exatamente a ressalva já escrita naquele arquivo.

```tsx
<StepCard title="Distribuição de posições">
  <LeadWebsiteStackedBar
    items={[
      { label: "Top 3", count: buckets.top3 },
      { label: "4–10", count: buckets.pos4to10 },
      { label: "11–20", count: buckets.pos11to20 },
      { label: "21–50", count: buckets.pos21to50 },
      { label: "51–100", count: buckets.pos51to100 },
    ]}
    total={metrics.keywordCount ?? undefined}
  />
</StepCard>
```

`positionBuckets === null` → o card não renderiza a barra, e diz "sem footprint
medido nesta coleta".

- [ ] **Step 2: A régua de idade do índice**

Forma copiada de `LeadWebsiteVitalGauge`: as **zonas são o fundo**, o **dado é o
marcador**. Menor é melhor, e o limiar é `VISIBILITY_STALE_SERP_DAYS = 90`.

```tsx
/**
 * Régua de banda, não barra de fração. A idade do índice é métrica onde menor é
 * melhor e existe limiar — numa barra de fração, 59 dias sobre 90 encheria 65%
 * da trilha e leria como "quase cheio", que é o contrário do dado.
 *
 * Dois marcadores, não uma frase: mediana sólida, máximo vazado. `"59d mediana ·
 * 109d máximo"` em cinza não declara qual dos dois olhar primeiro.
 */
```

Zonas: `0–30` recente (`success`), `30–90` envelhecendo (`warning`), `90+`
velho (`destructive`). Escala até `max(120, serpMaxDays)`.

- [ ] **Step 3: Cobertura e custo**

Um `StepCard` com `StepCountCell`: keywords no índice, linhas na amostra, custo
da coleta em US$, e a data da coleta. `coverage.truncated` vira a ressalva no
`aside` do `StepSectionLabel` — `"ordenadas por tráfego"` —, não um parágrafo
cinza solto.

- [ ] **Step 4: Commit**

```
feat(visibilidade): aba Panorama com distribuição, idade do índice e cobertura
```

---

### Task 8: Aba Keywords — a tabela que aguenta mil linhas

**Files:**
- Modify: `LeadVisibilityKeywordsTable.tsx`

- [ ] **Step 1: A linha de filtros**

Uma linha acima da tabela, no vocabulário da toolbar do board:

| controle | primitive | valores |
|---|---|---|
| busca | `InputGroup` | texto livre na keyword |
| intenção | `Select` | todas · as quatro · sem classificação |
| posição | `ToggleGroup` | todas · top 3 · top 10 · 11–20 · 21+ |
| host | `Select` | só quando `hosts.length > 1` |

**`Toggle` filtra, `Button` age, `ToggleGroup` escolhe, `Select` agrupa sem
busca.** É a lei "um primitive por papel".

- [ ] **Step 2: Ordenação por cabeçalho**

`position` · `traffic` · `volume` · `difficulty`. O cabeçalho clicável é
`button` com `aria-sort` na `<th>`, e a seta de direção é ícone, nunca só cor.

- [ ] **Step 3: Teto com "ver mais"**

```tsx
const [limit, setLimit] = useState(50)
```

Reset do teto ligado ao filtro **no render, não em efeito** — é a primeira lei
de `state.md`:

```tsx
const filterKey = `${query}|${intent}|${band}|${host}|${sort}|${dir}`
const [syncedFilterKey, setSyncedFilterKey] = useState(filterKey)
if (syncedFilterKey !== filterKey) {
  setSyncedFilterKey(filterKey)
  setLimit(50)
}
```

O contador acima declara `mostrando N de M`, e o botão diz `Ver mais 50`.

- [ ] **Step 4: A linha**

Além do que já existe, a linha ganha: seta de movimento quando
`position.previous` existe, chip de `ai_overview` quando está em `serpFeatures`,
e marca discreta quando `languageMismatch`. Tudo com `title`, nada só por cor.

- [ ] **Step 5: Commit**

```
feat(visibilidade): tabela de keywords com filtros, ordenação e teto
```

---

### Task 9: Aba Páginas

**Files:**
- Create: `LeadVisibilityRankedList.tsx`
- Modify: `LeadVisibilityTabPanels.tsx`

- [ ] **Step 1: A linha ranqueada**

Componente genérico: rótulo, valor, barra proporcional ao maior item.
`layout.md`: *"Lista de `nome · N` em cinza não é comparada, é lida item a
item. A barra é o gancho que faz o maior saltar antes da leitura."*

Anima o contêiner com `scaleX`, não a largura de cada linha — o raio mora no
contêiner, então não há ponta a deformar e a lei de animar só `transform` e
`opacity` continua de pé. É o mesmo argumento de `LeadWebsiteStackedBar`.

- [ ] **Step 2: Hosts**

Um `StepCard` com a lista por host. O não-canônico vem com tom `warning` **e**
o rótulo `fora do host principal` — estado nunca só por cor.

- [ ] **Step 3: Páginas**

`visibilityPages(snapshot)`, ordenado por tráfego. Cada linha mostra o `path`,
prefixado pelo host quando não-canônico, com a URL completa no `title` e link
para ela.

- [ ] **Step 4: Intenção**

A mesma lista ranqueada, **não** uma barra empilhada. Intenção é categórica sem
ordem natural, e a rampa `chart-*` é sequencial — usá-la faria o leitor ler
hierarquia onde não existe. A linha `sem classificação confiável` entra com as
demais, em `text-muted-foreground`.

- [ ] **Step 5: Commit**

```
feat(visibilidade): aba Páginas com hosts, páginas e intenção
```

---

### Task 10: Aba Validação e o bloco do analista

**Files:**
- Create: `LeadVisibilityReview.tsx`, `LeadVisibilityAnalystBlock.tsx`
- Modify: `LeadVisibilityTabPanels.tsx`, `LeadVisibilityView.tsx`

- [ ] **Step 1: A aba**

Copie a forma de `LeadWebsiteReview.tsx`: um bloco por critério, com
`ToggleGroup` de veredito (`Ok` · `Problema` · `N/A` quando `allowsNa`) e campo
de nota. `host_intent` só aparece habilitado quando há host não-canônico — com
`na` pré-selecionável, nunca escondido.

- [ ] **Step 2: O bloco na coluna**

Copie `LeadWebsiteAnalystBlock.tsx`. Os campos ficam **montados** o tempo todo;
o inativo recebe `hidden`. Desmontar devolveria o textarea ao valor do servidor,
e o texto digitado dentro dos 800ms de debounce voltaria atrás na tela.

- [ ] **Step 3: O atalho**

`useCaptureShortcut({ code: "KeyE", allowInFields: true })`, com a ida e a
volta: de fora entra no campo; de dentro, recolhe e devolve o foco ao painel.
Sem a volta, o atalho é armadilha de foco.

- [ ] **Step 4: Commit**

```
feat(visibilidade): aba Validação e bloco do analista
```

---

### Task 11: O diagnóstico lê o julgamento, e a skill conta a verdade

**Files:**
- Modify: `lib/leads/diagnosis-compile.ts`
- Modify: `app/actions/leads/compile-lead-diagnosis.ts:151`
- Modify: `.claude/skills/suite-frontend/references/components.md` · `layout.md`

- [ ] **Step 1: O review chega ao diagnóstico**

`mergeVisibilityOpportunities` já emite os `review:*` desde a Task 3. Falta
`diagnosis-compile.ts` passar o `review` no contexto — como já passa
`analystReview` para o GBP.

- [ ] **Step 2: A skill**

`references/layout.md`, no arquétipo "Painel de trabalho": a Visibilidade entra
na lista de referências junto com GBP, Website e Presença digital.
`references/components.md`: `StepCard` na tabela do shell, e a frase *"é o que
Visibilidade e Diagnóstico devem consumir quando forem repaginadas"* perde a
Visibilidade.

A skill manda atualizar a referência **no mesmo commit** em que o código muda.

- [ ] **Step 3: Commit**

```
feat(visibilidade): julgamento no diagnóstico e skill atualizada
```

---

### Task 12: Verificação — a única passada

Aqui rodam todos os portões de uma vez, como o dono do repo pediu. **Funde
também a Task 7 do plano de confiabilidade**, que ficou pendente: ela
verificaria exatamente os componentes que este plano reescreveu.

- [ ] **Step 1: Portões de compilação**

```bash
pnpm test && pnpm lint && pnpm exec tsc --noEmit
```

Esperado: testes verdes, **zero errors** no lint (warnings são débito antigo) e
`tsc` sem saída.

- [ ] **Step 2: Os greps de reprovação**

Rode o bloco inteiro de `references/checks.md` e compare com o baseline de
2026-09-10: cor cravada **5**, base-ui direto **2**, anima sem reduced **1**,
todos os outros **zero**. Qualquer número acima é coisa nova desta entrega.

- [ ] **Step 3: Pedir o login**

O app exige sessão. **Peça as credenciais ao dono do repo** — sem elas a
verificação visual não roda.

- [ ] **Step 4: Subir o preview**

Browser pane (`preview_start` com o `name` de `.claude/launch.json`), **nunca**
`pnpm dev` pelo terminal.

- [ ] **Step 5: Os onze critérios da spec de repaginação**

- [ ] shell de tela cheia: cabeçalho fora do scroll, só o corpo rola
- [ ] quatro big numbers colapsam, persistem, e cada um leva à sua aba
- [ ] `Ctrl/⌘ B` abre e fecha a coluna; recolhida, continua montada com `inert`
- [ ] `Ctrl/⌘ Shift E` entra no campo do analista e sai dele
- [ ] o texto do analista sobrevive à troca de aba e ao recolhimento
- [ ] host não-canônico aparece na aba Páginas **e** deixa PÁGINAS em `warning`
- [ ] sem coleta, os quatro big numbers são `—` e nenhuma trilha é renderizada
- [ ] snapshot **v1** abre sem quebrar, com as leituras novas em `—`
- [ ] tabela com mil linhas renderiza 50, filtra, ordena e cresce sem travar
- [ ] `resize_window` mobile: a coluna vira a última seção do scroll
- [ ] `colorScheme: "dark"`: nenhum texto some, foco visível

- [ ] **Step 6: Os sete critérios da spec de confiabilidade**

Uma coleta real (~US$ 0,05, duas chamadas) num lead com site, e conferir: URL
completa no `title`, nenhuma dificuldade com `%`, KD zero como `—`, nenhuma
intenção abaixo de 0,60, "Coletado em" separado de "Índice de", cobertura
declarada, `non_canonical_host_traffic` nas oportunidades.

- [ ] **Step 7: Console limpo**

`read_console_messages` sem erro.

- [ ] **Step 8: Screenshot e autocrítica**

`computer {action: "screenshot"}` da etapa com dado real, enviado com
`SendUserFile`. E duas linhas: **o que você cortou e por quê.** `checks.md`:
*"Se não cortou nada, você não terminou."*

- [ ] **Step 9: Commit**

```
docs(visibilidade): registra a verificação da repaginação
```

---

## O que este plano deliberadamente não faz

- **Não muda nada da coleta.** Endpoint, limite, mapeamento e regra de gap ficam como a spec de confiabilidade deixou.
- **Não repagina o Diagnóstico.** É a quinta etapa e tem shell próprio a decidir.
- **Não cria paleta categórica.** Intenção é linha ranqueada justamente para não precisar de uma.
- **Não vira `LeadGbpCard` em design novo.** A Task 1 move o arquivo e mantém a API — refatoração de local, não de aparência.
