# Redesign da etapa Website — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar a etapa Website da aba Oportunidade para o mesmo shell da etapa Perfil no Google — cabeçalho fixo com identidade e quatro big numbers, quatro abas internas, coluna de oportunidades colapsável com bloco do analista —, repaginando os quatro blocos de conteúdo e extraindo a parte reaproveitável do shell para `LeadStepShell`.

**Architecture:** O grid do `LeadGbpPanel` continua hospedando as cinco etapas da trilha; a divisão `central | oportunidades` nasce dentro do ramo `website`, como já nasce dentro do ramo `google-profile`. Estado e ações saem de `LeadWebsitePanel.tsx` para um controller. Contadores de aba, grupos da coluna e total do rail saem da mesma lista, com exaustividade garantida por `tsc`.

**Tech Stack:** Next.js 16.3.1, React 19.2.8, shadcn base-mira sobre Base UI, Tailwind v4, `motion` 13, `react-icons/ri`, Supabase, Zod 4.

**Spec:** `docs/superpowers/specs/2026-09-10-website-etapa-redesign-design.md`

## Global Constraints

Valem para **todas** as tarefas. Vêm de `.claude/skills/suite-frontend/` — leia `references/tokens.md` antes da primeira classe e `references/checks.md` antes de dizer que terminou.

- **Cor só por token semântico.** Nada de `oklch(`, `#hex` ou `rgb(` em `components/custom` ou `app`.
- **`accent` é superfície Mist, nunca teal textual.** Teal de texto é `text-primary`.
- **Ícone só de `react-icons/ri`.** Zero Lucide em código de produto.
- **`cn` importado de `"cn"`**, nunca de `@/lib/utils`.
- **`m.*` de `motion/react-m`**, nunca `motion.*` — o `LazyMotion strict` da raiz deixa o conteúdo invisível no DOM.
- **`useReducedMotion` em todo componente que anima**, com `initial={reduced ? false : {...}}` — `false`, não `undefined`.
- **Easing único `[0.23, 1, 0.32, 1]`.** Durações: 120ms micro-estado, 180ms revelação, 280ms colapso, 550ms crescimento de dado. Sair delas exige comentário na linha.
- **Empilhamento só por `--z-index-*`.** Nada de `z-[60]` avulso.
- **Altura de controle vem de `size`.** Nada de `h-10` num `Button`/`Input`/`SelectTrigger`.
- **Nada de `@base-ui/react` direto** quando existe equivalente em `components/ui`.
- **Não escreva primitive à mão.** O que faltar se instala pelo CLI do shadcn.
- **Ausência é `—`, nunca zero.** Um domínio sem coleta não é um domínio sem autoridade.
- **Estado nunca só por cor** — sempre com texto, ícone ou forma junto.
- **O commit é do usuário.** Cada tarefa termina com a mensagem sugerida e **para**. Não rode `git commit`, `git push`, nem crie branch ou PR.

**Comandos de verificação** (Git Bash; `grep -P` não funciona e `bc` não existe):

```bash
cd "C:/Users/Eduardo Zamai/Documents/suite"
pnpm exec tsc --noEmit
pnpm lint
```

**Baseline dos greps de `checks.md`** — qualquer número acima disto é regressão desta rodada:

| Check | Baseline |
| --- | --- |
| cor cravada | 5 (`NavTree`) |
| base-ui direto | 2 (`DateTimePicker`, `TimePicker`) |
| anima sem reduced | 1 (`LeadGbpAuditStep`) |
| todos os outros | 0 |

**Verificação visual exige sessão.** O app pede login. Antes da primeira tarefa com verificação em tela (Tarefa 8 em diante), peça ao usuário para abrir o app e autenticar; sem isso a verificação visual não acontece e a tarefa não pode ser dada como concluída.

**Não há teste automatizado de UI neste repo.** `pnpm test` é `node --test "lib/**/*.test.mjs"` e o único arquivo existente lê fontes como texto — módulos de `lib/leads` importam pelo alias `@/`, que o Node não resolve. O portão desta rodada é `tsc --noEmit` (que é o que trava o mapa de temas incompleto), `pnpm lint`, os greps acima e a verificação em tela. Onde este plano diz "rode e confirme que falha", o que falha é a **compilação**, e isso é proposital.

---

## Estrutura de arquivos

**Criados**

| Arquivo | Responsabilidade |
| --- | --- |
| `components/custom/LeadStepShell/StepMetrics.tsx` | primitives de leitura numérica de etapa (movido de `LeadGbpMetrics.tsx`) |
| `components/custom/LeadStepShell/StepTabs.tsx` | barra de abas de etapa, genérica no id |
| `components/custom/LeadStepShell/StepOpportunityItem.tsx` | linha de oportunidade da coluna |
| `components/custom/LeadStepShell/StepOpportunitiesRail.tsx` | coluna colapsável: cabeçalho, filtros, grupos, slot do analista |
| `components/custom/LeadStepShell/StepNotesField.tsx` | campo de texto com autosave (movido de `LeadGbpNotesCard.tsx`, sem a variante morta `card`) |
| `components/custom/LeadStepShell/use-collapsible-rail.ts` | colapso, atalho e preferência (movido, com `storageKey`) |
| `components/custom/LeadStepShell/index.ts` | reexporta o que os painéis consomem |
| `lib/leads/website-step-tabs.ts` | `WEBSITE_STEP_TABS`, `WebsiteStepTabId` |
| `components/custom/LeadWebsitePanel/use-website-controller.ts` | estado, polling, persistência e derivados da etapa |
| `components/custom/LeadWebsitePanel/LeadWebsiteView.tsx` | shell: grid, `Tabs`, painéis, rail |
| `components/custom/LeadWebsitePanel/LeadWebsiteHeader.tsx` | cabeçalho fixo: título, identidade, números, avisos, abas |
| `components/custom/LeadWebsitePanel/LeadWebsiteIdentityCell.tsx` | célula de identidade do site |
| `components/custom/LeadWebsitePanel/LeadWebsiteMetricCells.tsx` | os quatro big numbers |
| `components/custom/LeadWebsitePanel/LeadWebsiteTabPanels.tsx` | composição de cada aba |
| `components/custom/LeadWebsitePanel/LeadWebsiteAuditCard.tsx` | card de pilar com saldo e disclosure de aprovados |
| `components/custom/LeadWebsitePanel/LeadWebsitePagespeedCard.tsx` | card por estratégia: score, CWV, estado, captura |
| `components/custom/LeadWebsitePanel/LeadWebsiteShotViewer.tsx` | capturas com troca de dispositivo, para a Validação visual |
| `components/custom/LeadWebsitePanel/LeadWebsiteAuthorityCards.tsx` | perfil, composição, risco e mercado |
| `components/custom/LeadWebsitePanel/LeadWebsiteStackedBar.tsx` | barra empilhada com legenda |
| `components/custom/LeadWebsitePanel/LeadWebsiteAnalystBlock.tsx` | notas da etapa e achado visual |

**Modificados**

| Arquivo | Mudança |
| --- | --- |
| `components/custom/LeadGbpPanel/LeadGbpProfileHeader.tsx` | consome `StepTabs` |
| `components/custom/LeadGbpPanel/LeadGbpProfileView.tsx` | consome `use-collapsible-rail` de `LeadStepShell` com `storageKey` |
| `components/custom/LeadGbpPanel/LeadGbpOpportunitiesRail.tsx` | vira wrapper fino de `StepOpportunitiesRail` |
| `components/custom/LeadGbpPanel/LeadGbpOpportunitiesCard.tsx` | perde `LeadGbpOpportunityItem` |
| `components/custom/LeadGbpPanel/LeadGbpAnalystBlock.tsx` | consome `StepNotesField` com `syncKey` e `maxLength` |
| `components/custom/LeadGbpPanel/LeadGbpGridCompetitors.tsx`, `LeadGbpGridSection.tsx`, `LeadGbpReputationRead.tsx` | importam de `StepMetrics` |
| `components/custom/LeadGbpPanel/LeadGbpPanel.tsx` | `fullBleed` inclui `website`; `readingMode` desce |
| `components/custom/LeadWebsitePanel/LeadWebsitePanel.tsx` | encolhe para seleção de canal, vazios e composição |
| `components/custom/LeadWebsitePanel/LeadWebsiteStepHeader.tsx` | `readingMode`, menu `⋮`, seletor de canal |
| `components/custom/LeadWebsitePanel/LeadWebsiteReview.tsx` | repaginado para duas colunas |
| `components/custom/LeadWebsitePanel/LeadWebsiteBacklinksCard.tsx` | quebrado em quatro cards |
| `lib/leads/website-opportunities.ts` | `WEBSITE_OPPORTUNITY_THEME`, `websiteOpportunitiesByTheme` |
| `lib/leads/website-presenters.ts` | `count` em `WebsiteCheckItem`, `websiteCheckTally`, `websiteCheckGroups` |
| `lib/leads/website-review.ts` | entry `{ review, notes }`; sai o fallback para `other` |
| `lib/leads/website-audit.ts` | `LeadWebsiteAudit.notes` |
| `app/actions/leads/website-access.ts`, `analyze-website.ts`, `poll-website-jobs.ts`, `update-website-audit.ts` | repassam e gravam `notes` |
| `lib/validations/lead-website.ts` | campo `notes` |

**Removidos**

| Arquivo | Motivo |
| --- | --- |
| `components/custom/LeadGbpPanel/LeadGbpMetrics.tsx` | movido para `LeadStepShell/StepMetrics.tsx` |
| `components/custom/LeadGbpPanel/LeadGbpStepTabs.tsx` | virou `StepTabs` |
| `components/custom/LeadGbpPanel/use-collapsible-rail.ts` | movido |
| `components/custom/LeadGbpPanel/LeadGbpNotesCard.tsx` | virou `StepNotesField`; a variante `card` era código morto |
| `components/custom/LeadWebsitePanel/LeadWebsiteChecks.tsx` | virou `LeadWebsiteAuditCard` |
| `components/custom/LeadWebsitePanel/LeadWebsiteScreenshots.tsx` | a captura passa a morar no card da estratégia e no visor da validação |
| `components/custom/LeadWebsitePanel/LeadWebsiteSummaryCards.tsx` | virou `LeadWebsiteMetricCells` |

---

## Tarefa 1: Mover os primitives numéricos para `LeadStepShell`

Movimento mecânico e sem mudança visual. Ele vem primeiro porque a Tarefa 8 depende dos primitives já estarem no lugar neutro.

**Files:**
- Create: `components/custom/LeadStepShell/StepMetrics.tsx`
- Create: `components/custom/LeadStepShell/index.ts`
- Delete: `components/custom/LeadGbpPanel/LeadGbpMetrics.tsx`
- Modify: `components/custom/LeadGbpPanel/LeadGbpGridCompetitors.tsx`, `LeadGbpGridSection.tsx`, `LeadGbpReputationRead.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: `StepTone = "neutral" | "primary" | "success" | "warning" | "danger"`; `StepMeter({ share, tone?, className?, trackClassName? })`; `StepMeterRow({ label, value, share, tone? })`; `StepStat({ icon?, label, value, unit?, hint?, tone?, children? })`; `StepSectionLabel({ children, aside? })`; `StepCountCell({ value, label, dim? })`.

- [ ] **Step 1: Mover o arquivo preservando o histórico**

```bash
cd "C:/Users/Eduardo Zamai/Documents/suite"
mkdir -p components/custom/LeadStepShell
git mv components/custom/LeadGbpPanel/LeadGbpMetrics.tsx components/custom/LeadStepShell/StepMetrics.tsx
```

- [ ] **Step 2: Renomear os seis símbolos dentro do arquivo movido**

```bash
sed -i \
  -e 's/\bGbpTone\b/StepTone/g' \
  -e 's/\bGbpMeterRow\b/StepMeterRow/g' \
  -e 's/\bGbpMeter\b/StepMeter/g' \
  -e 's/\bGbpStat\b/StepStat/g' \
  -e 's/\bGbpSectionLabel\b/StepSectionLabel/g' \
  -e 's/\bGbpCountCell\b/StepCountCell/g' \
  components/custom/LeadStepShell/StepMetrics.tsx
```

Ajuste à mão o comentário de topo do arquivo, que hoje diz "Primitivos de leitura numérica da etapa. Existem porque os presenters entregavam frases (`parts.join(" · ")`)…". Troque a primeira frase por:

```tsx
/**
 * Primitivos de leitura numérica de etapa, compartilhados por Perfil no Google
 * e Website. Existem porque os presenters entregavam frases
 * (`parts.join(" · ")`) e frase pronta não tem hierarquia para declarar — o
 * componente só podia imprimi-la inteira, em cinza.
 */
```

A tabela de alfas conferidos por cálculo, logo acima de `SURFACE`, **fica intacta**. Ela é o motivo de `danger` não ter fundo lavado, e perdê-la custa a auditoria de contraste de novo.

- [ ] **Step 3: Criar o barril**

`components/custom/LeadStepShell/index.ts`:

```ts
export {
  StepCountCell,
  StepMeter,
  StepMeterRow,
  StepSectionLabel,
  StepStat,
  type StepTone,
} from "./StepMetrics"
```

- [ ] **Step 4: Atualizar os três importadores**

```bash
sed -i \
  -e 's#from "\./LeadGbpMetrics"#from "@/components/custom/LeadStepShell"#' \
  -e 's/\bGbpTone\b/StepTone/g' \
  -e 's/\bGbpMeterRow\b/StepMeterRow/g' \
  -e 's/\bGbpMeter\b/StepMeter/g' \
  -e 's/\bGbpStat\b/StepStat/g' \
  -e 's/\bGbpSectionLabel\b/StepSectionLabel/g' \
  -e 's/\bGbpCountCell\b/StepCountCell/g' \
  components/custom/LeadGbpPanel/LeadGbpGridCompetitors.tsx \
  components/custom/LeadGbpPanel/LeadGbpGridSection.tsx \
  components/custom/LeadGbpPanel/LeadGbpReputationRead.tsx
```

- [ ] **Step 5: Verificar que nenhum nome antigo sobrou**

```bash
grep -rnE "\b(LeadGbpMetrics|GbpTone|GbpMeterRow|GbpMeter|GbpStat|GbpSectionLabel|GbpCountCell)\b" --include=*.tsx --include=*.ts components app lib
```

Esperado: **nenhuma linha**. Se sair alguma, é um importador que o `sed` não pegou.

As fronteiras `\b` são obrigatórias: sem elas, `GbpStat` casa dentro de `GbpState`, um tipo pré-existente em `app/actions/leads/`, e o grep devolve 16 falsos positivos que não têm nada a ver com esta tarefa.

- [ ] **Step 6: Compilar**

```bash
pnpm exec tsc --noEmit && pnpm lint
```

Esperado: os dois limpos.

- [ ] **Step 7: Parar para o commit**

O commit é do usuário. Mensagem sugerida:

```
refactor(step-shell): move os primitives numéricos para LeadStepShell
```

---

## Tarefa 2: `StepTabs`, `StepOpportunityItem` e o hook do rail

**Files:**
- Create: `components/custom/LeadStepShell/StepTabs.tsx`, `components/custom/LeadStepShell/StepOpportunityItem.tsx`, `components/custom/LeadStepShell/use-collapsible-rail.ts`
- Delete: `components/custom/LeadGbpPanel/LeadGbpStepTabs.tsx`, `components/custom/LeadGbpPanel/use-collapsible-rail.ts`
- Modify: `components/custom/LeadStepShell/index.ts`, `components/custom/LeadGbpPanel/LeadGbpProfileHeader.tsx`, `LeadGbpProfileView.tsx`, `LeadGbpOpportunitiesRail.tsx`, `LeadGbpOpportunitiesCard.tsx`

**Interfaces:**
- Consumes: Tarefa 1 (`LeadStepShell/index.ts`).
- Produces: `StepTabDef<Id>`, `StepTabs<Id>({ tabs, counts, value, layoutId, ariaLabel })`; `StepOpportunity`, `STEP_IMPACT_LABEL`, `StepOpportunityItem({ item })`; `useCollapsibleRail({ enabled, storageKey })`, `useWideViewport()`, `useCaptureShortcut({ enabled, code, onMatch, allowInFields? })`.

- [ ] **Step 1: Mover o hook e parametrizar a chave**

```bash
git mv components/custom/LeadGbpPanel/use-collapsible-rail.ts components/custom/LeadStepShell/use-collapsible-rail.ts
```

No arquivo movido, remova a constante `STORAGE_KEY` e troque a assinatura:

```ts
export function useCollapsibleRail({
  enabled,
  storageKey,
}: {
  enabled: boolean
  /** Chave de `localStorage` da etapa. Cada etapa tem a sua: recolher a coluna
   *  no GBP não deve recolher no Website — a densidade das duas é diferente. */
  storageKey: string
}) {
  const [railOpen, setRailOpen] = useState(() => {
    if (typeof window === "undefined") return true
    const stored = window.localStorage.getItem(storageKey)
    if (stored === "open") return true
    if (stored === "closed") return false
    return window.matchMedia(WIDE).matches
  })

  const set = useCallback(
    (next: boolean) => {
      setRailOpen(next)
      window.localStorage.setItem(storageKey, next ? "open" : "closed")
    },
    [storageKey],
  )

  const toggle = useCallback(() => {
    setRailOpen((current) => {
      const next = !current
      window.localStorage.setItem(storageKey, next ? "open" : "closed")
      return next
    })
  }, [storageKey])

  useCaptureShortcut({ enabled, code: "KeyB", onMatch: toggle })

  return {
    railOpen,
    toggle,
    open: useCallback(() => set(true), [set]),
    close: useCallback(() => set(false), [set]),
  }
}
```

O comentário de topo, que explica por que a captura vence os listeners do `Sidebar` e do `MobileNavigation`, fica inteiro — ele é o que impede alguém de "simplificar" para bubble e quebrar os três de uma vez.

- [ ] **Step 2: `StepTabs`, genérica no id**

`components/custom/LeadStepShell/StepTabs.tsx`, a partir do conteúdo de `LeadGbpStepTabs.tsx`:

```tsx
"use client"

import { useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "cn"

export type StepTabDef<Id extends string> = {
  id: Id
  label: string
}

/**
 * Mesma composição das abas do dialog (`LeadDetailHeader`): o sublinhado do
 * registry sai (`after:hidden`) e quem anima é o `m.span` com `layoutId`.
 *
 * Sem ícone: a aba já é rótulo curto com contador, e duas barras de etapa que
 * diferem custam mais do que o ícone entrega.
 */
export function StepTabs<Id extends string>({
  tabs,
  counts,
  value,
  layoutId,
  ariaLabel = "Seções da etapa",
}: {
  tabs: ReadonlyArray<StepTabDef<Id>>
  counts: Record<Id, number>
  value: Id
  /** Único por etapa — dois `layoutId` iguais fariam os sublinhados brigarem. */
  layoutId: string
  ariaLabel?: string
}) {
  const reduced = !!useReducedMotion()

  return (
    <TabsList
      variant="line"
      aria-label={ariaLabel}
      className="mt-3.5 h-auto items-stretch gap-6 p-0"
    >
      {tabs.map((item) => {
        const active = value === item.id
        const count = counts[item.id]
        return (
          <TabsTrigger
            key={item.id}
            value={item.id}
            className={cn(
              "relative h-auto flex-none cursor-pointer gap-1.5 rounded-none border-0 px-0 pt-0 pb-2.5 text-[13px] after:hidden",
              active
                ? "font-semibold data-active:text-foreground"
                : "font-medium text-muted-foreground",
            )}
          >
            {item.label}
            {count > 0 ? (
              <span
                className={cn(
                  "inline-flex h-[18px] items-center rounded-md px-1.5 text-[10px] font-semibold tabular-nums",
                  active
                    ? "bg-warning/[0.12] text-warning"
                    : "bg-accent text-muted-foreground",
                )}
              >
                {count}
              </span>
            ) : null}
            {active ? (
              <m.span
                layoutId={reduced ? undefined : layoutId}
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary"
                transition={{
                  duration: reduced ? 0.12 : 0.18,
                  ease: [0.23, 1, 0.32, 1],
                }}
              />
            ) : null}
          </TabsTrigger>
        )
      })}
    </TabsList>
  )
}
```

Apague `components/custom/LeadGbpPanel/LeadGbpStepTabs.tsx`.

- [ ] **Step 3: `StepOpportunityItem`**

`components/custom/LeadStepShell/StepOpportunityItem.tsx`, com o corpo que hoje está em `LeadGbpOpportunitiesCard.tsx`:

```tsx
import { cn } from "cn"

export type StepOpportunity = {
  id: string
  title: string
  impact: "high" | "medium"
  source?: "machine" | "analyst"
  detail?: string
}

export const STEP_IMPACT_LABEL: Record<StepOpportunity["impact"], string> = {
  high: "Alto",
  medium: "Médio",
}

/** Linha da coluna de oportunidades de uma etapa. */
export function StepOpportunityItem({ item }: { item: StepOpportunity }) {
  return (
    <li className="flex items-start gap-2 rounded-lg bg-card px-2.5 py-2 ring-1 ring-foreground/[0.08]">
      <span
        aria-hidden
        className={cn(
          "mt-1.5 inline-block size-1.5 shrink-0 rounded-full",
          item.impact === "high" ? "bg-warning" : "bg-border",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs/[1.5] text-foreground">{item.title}</p>
        {item.detail ? (
          <p className="line-clamp-2 text-[11px] text-muted-foreground">
            {item.source === "analyst" ? "Analista · " : null}
            {item.detail}
          </p>
        ) : null}
      </div>
      <span
        className={cn(
          "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
          item.impact === "high"
            ? "bg-warning/10 text-warning"
            : "bg-accent text-muted-foreground",
        )}
      >
        {STEP_IMPACT_LABEL[item.impact]}
      </span>
    </li>
  )
}
```

Em `LeadGbpOpportunitiesCard.tsx`, apague `LeadGbpOpportunityItem` e o import de `cn` se ele ficar sem uso. `LeadGbpOpportunitiesCard` (o card de lista) **fica** — Diagnóstico, Presença digital e Visibilidade ainda o consomem.

- [ ] **Step 4: Estender o barril**

```ts
export {
  StepCountCell,
  StepMeter,
  StepMeterRow,
  StepSectionLabel,
  StepStat,
  type StepTone,
} from "./StepMetrics"
export { StepTabs, type StepTabDef } from "./StepTabs"
export {
  STEP_IMPACT_LABEL,
  StepOpportunityItem,
  type StepOpportunity,
} from "./StepOpportunityItem"
export {
  useCaptureShortcut,
  useCollapsibleRail,
  useWideViewport,
} from "./use-collapsible-rail"
```

- [ ] **Step 5: Ligar os consumidores do GBP**

Em `LeadGbpProfileHeader.tsx`, troque o import e a chamada:

```tsx
import { StepTabs } from "@/components/custom/LeadStepShell"
import { GBP_PROFILE_TABS } from "@/lib/leads/gbp-profile-tabs"

// no lugar de <LeadGbpStepTabs tab={tab} counts={counts} />
<StepTabs
  tabs={GBP_PROFILE_TABS}
  counts={counts}
  value={tab}
  layoutId="gbp-step-tab-underline"
/>
```

`GBP_PROFILE_TABS` tem um campo `icon` que ninguém renderiza; ele satisfaz `StepTabDef` por estrutura e não precisa ser removido nesta tarefa.

Em `LeadGbpProfileView.tsx`:

```tsx
import {
  useCaptureShortcut,
  useCollapsibleRail,
  useWideViewport,
} from "@/components/custom/LeadStepShell"

const { railOpen, toggle } = useCollapsibleRail({
  enabled: wide,
  storageKey: "gbp:opportunities-rail",
})
```

Em `LeadGbpOpportunitiesRail.tsx`, troque o import de `LeadGbpOpportunityItem` por `StepOpportunityItem` de `@/components/custom/LeadStepShell` e ajuste o uso.

- [ ] **Step 6: Compilar e conferir os resíduos**

```bash
pnpm exec tsc --noEmit && pnpm lint
grep -rn "LeadGbpStepTabs\|LeadGbpOpportunityItem\|LeadGbpPanel/use-collapsible-rail" --include=*.tsx --include=*.ts components app
```

Esperado: `tsc` e `lint` limpos, e **nenhuma linha** no grep.

- [ ] **Step 7: Verificar o GBP em tela**

Abra um lead com perfil vinculado, aba Oportunidade, etapa Perfil no Google. Confirme: as quatro abas trocam com o sublinhado animando, os contadores aparecem, `Ctrl+B` recolhe e abre a coluna, e a preferência sobrevive a recarregar a página. **Nada pode ter mudado visualmente.**

- [ ] **Step 8: Parar para o commit**

```
refactor(step-shell): extrai abas, item de oportunidade e o hook do rail
```

---

## Tarefa 3: `StepOpportunitiesRail` genérico

**Files:**
- Create: `components/custom/LeadStepShell/StepOpportunitiesRail.tsx`
- Modify: `components/custom/LeadStepShell/index.ts`, `components/custom/LeadGbpPanel/LeadGbpOpportunitiesRail.tsx`

**Interfaces:**
- Consumes: Tarefa 2 (`StepOpportunity`, `StepOpportunityItem`, `StepTabDef`).
- Produces: `StepOpportunitiesRail<Id>({ id, title, tabs, groups, total, activeTab, railOpen, onToggleRail, onRequestAnalyst, analyst, emptyLabel })`.

- [ ] **Step 1: Escrever o rail genérico**

`components/custom/LeadStepShell/StepOpportunitiesRail.tsx` é o corpo de `LeadGbpOpportunitiesRail.tsx` com quatro trocas: `controller.opportunities` vira a prop `total`, `gbpOpportunitiesByTheme(...)` vira a prop `groups`, `GBP_PROFILE_TABS` vira a prop `tabs`, e `<LeadGbpAnalystBlock/>` vira `{analyst}`. O filtro continua sendo estado interno.

```tsx
"use client"

import { useState, type ReactNode } from "react"
import { RiArrowLeftSLine, RiArrowRightSLine, RiEditLine } from "react-icons/ri"
import { StepOpportunityItem, type StepOpportunity } from "./StepOpportunityItem"
import type { StepTabDef } from "./StepTabs"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { cn } from "cn"

export function StepOpportunitiesRail<Id extends string>({
  id,
  title = "Oportunidades",
  tabs,
  groups,
  total,
  activeTab,
  railOpen,
  onToggleRail,
  onRequestAnalyst,
  analyst,
  emptyLabel = "Nenhum problema identificado nesta coleta.",
}: {
  /** Único por etapa: é o alvo de `aria-controls`. */
  id: string
  title?: string
  tabs: ReadonlyArray<StepTabDef<Id>>
  groups: Record<Id, StepOpportunity[]>
  total: number
  activeTab: Id
  railOpen: boolean
  onToggleRail: () => void
  onRequestAnalyst: () => void
  analyst: ReactNode
  emptyLabel?: string
}) {
  const [filter, setFilter] = useState<"todas" | Id>("todas")
  const shown = filter === "todas" ? total : groups[filter].length

  return (
    <>
      {/* Rail de 48px: só aparece quando a coluna está recolhida. */}
      {!railOpen ? (
        <div className="absolute inset-y-0 right-0 z-10 flex w-12 flex-col items-center gap-3.5 border-l border-border/70 bg-popover py-3.5">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={`Abrir ${title.toLowerCase()}`}
            aria-expanded={false}
            aria-controls={id}
            className="size-7 rounded-lg"
            onClick={onToggleRail}
          >
            <RiArrowLeftSLine size={14} aria-hidden />
          </Button>
          {total > 0 ? (
            <span className="inline-flex h-[18px] min-w-[22px] items-center justify-center rounded-full bg-warning/[0.12] text-[10px] font-semibold tabular-nums text-warning">
              {total}
            </span>
          ) : null}
          <span className="flex-1 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase [writing-mode:vertical-rl]">
            {title}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Abrir o bloco do analista (Ctrl E)"
            onClick={onRequestAnalyst}
          >
            <RiEditLine size={14} aria-hidden />
          </Button>
        </div>
      ) : null}

      <aside
        id={id}
        // Continua montada quando recolhida: é o que preserva o filtro, o campo
        // do analista e o rascunho não salvo. `inert` resolve foco, ponteiro e
        // árvore de acessibilidade de uma vez.
        inert={!railOpen}
        className={cn(
          "grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-l border-border/70 bg-popover/70 transition-opacity duration-200",
          railOpen ? "opacity-100 delay-75" : "opacity-0",
        )}
      >
        <div className="border-b border-border/70 px-4 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-heading flex-1 text-sm font-semibold text-foreground">
              {title}
            </h3>
            <Kbd className="text-[10px]">Ctrl B</Kbd>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={`Recolher ${title.toLowerCase()}`}
              aria-expanded={railOpen}
              aria-controls={id}
              onClick={onToggleRail}
            >
              <RiArrowRightSLine size={14} aria-hidden />
            </Button>
          </div>
          <p className="mt-0.5 text-xs/relaxed tabular-nums text-muted-foreground">
            {shown} de {total}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {(
              [
                ["todas", "Todas"],
                ...tabs.map((item) => [item.id, item.label] as const),
              ] as ReadonlyArray<readonly ["todas" | Id, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
                className={cn(
                  "inline-flex h-6 cursor-pointer items-center rounded-full border px-2.5 text-[11px] font-medium transition-colors",
                  filter === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto px-4 pt-3 pb-4">
          {total === 0 ? (
            <p className="text-xs/relaxed text-muted-foreground">{emptyLabel}</p>
          ) : (
            <div className="flex flex-col gap-4">
              {tabs
                .filter((item) => filter === "todas" || filter === item.id)
                .map((item) => {
                  const items = groups[item.id]
                  if (items.length === 0) return null
                  return (
                    <section key={item.id} className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-[11px] font-semibold tracking-[0.08em] uppercase",
                            activeTab === item.id
                              ? "text-primary"
                              : "text-muted-foreground",
                          )}
                        >
                          {item.label}
                        </span>
                        <span className="h-px flex-1 bg-border/70" />
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          {items.length}
                        </span>
                      </div>
                      <ul className="flex flex-col gap-1.5">
                        {items.map((opportunity) => (
                          <StepOpportunityItem
                            key={opportunity.id}
                            item={opportunity}
                          />
                        ))}
                      </ul>
                    </section>
                  )
                })}
            </div>
          )}
        </div>

        {analyst}
      </aside>
    </>
  )
}
```

- [ ] **Step 2: `LeadGbpOpportunitiesRail` vira wrapper**

Substitua o corpo inteiro do arquivo por:

```tsx
"use client"

import { LeadGbpAnalystBlock } from "./LeadGbpAnalystBlock"
import type { GbpProfileController } from "./use-gbp-profile-controller"
import { StepOpportunitiesRail } from "@/components/custom/LeadStepShell"
import { gbpOpportunitiesByTheme } from "@/lib/leads/gbp-opportunities"
import {
  GBP_PROFILE_TABS,
  type GbpProfileTabId,
} from "@/lib/leads/gbp-profile-tabs"

export function LeadGbpOpportunitiesRail({
  controller,
  activeTab,
  railOpen,
  onToggleRail,
  analystOpen,
  onAnalystOpenChange,
  analystFocusSignal,
  onRequestAnalyst,
}: {
  controller: GbpProfileController
  activeTab: GbpProfileTabId
  railOpen: boolean
  onToggleRail: () => void
  analystOpen: boolean
  onAnalystOpenChange: (next: boolean) => void
  analystFocusSignal: number
  onRequestAnalyst: () => void
}) {
  return (
    <StepOpportunitiesRail
      id="gbp-opportunities-rail"
      tabs={GBP_PROFILE_TABS}
      groups={gbpOpportunitiesByTheme(controller.opportunities)}
      total={controller.opportunities.length}
      activeTab={activeTab}
      railOpen={railOpen}
      onToggleRail={onToggleRail}
      onRequestAnalyst={onRequestAnalyst}
      analyst={
        <LeadGbpAnalystBlock
          controller={controller}
          open={analystOpen}
          onOpenChange={onAnalystOpenChange}
          focusSignal={analystFocusSignal}
        />
      }
    />
  )
}
```

- [ ] **Step 3: Exportar no barril**

```ts
export { StepOpportunitiesRail } from "./StepOpportunitiesRail"
```

- [ ] **Step 4: Compilar**

```bash
pnpm exec tsc --noEmit && pnpm lint
```

- [ ] **Step 5: Verificar o GBP em tela**

Etapa Perfil no Google: os chips de filtro filtram, o grupo da aba ativa fica em teal, o contador `N de M` acompanha o filtro, `Ctrl+B` recolhe, o rail de 48px aparece com o badge, e o lápis abre a coluna e foca o textarea. `Ctrl+Shift+E` continua indo e voltando do campo.

- [ ] **Step 6: Parar para o commit**

```
refactor(step-shell): generaliza a coluna de oportunidades
```

---

## Tarefa 4: Abas e temas de oportunidade do Website

**Files:**
- Create: `lib/leads/website-step-tabs.ts`
- Modify: `lib/leads/website-opportunities.ts`

**Interfaces:**
- Consumes: `WebsiteGapId` (`lib/leads/website-audit.ts`), `BacklinkGapId` (`lib/leads/backlinks-audit.ts`), `WebsiteReviewCriterionId` (`lib/leads/website-review.ts`).
- Produces: `WebsiteStepTabId = "auditoria" | "pagespeed" | "validacao" | "autoridade"`; `WEBSITE_STEP_TABS`; `WEBSITE_OPPORTUNITY_THEME`; `websiteOpportunityTheme(id: string): WebsiteStepTabId`; `websiteOpportunitiesByTheme(items): Record<WebsiteStepTabId, WebsiteOpportunityItem[]>`.

- [ ] **Step 1: Definir as abas**

`lib/leads/website-step-tabs.ts`:

```ts
/**
 * Aba e tema são o mesmo eixo: o contador da aba é a contagem do grupo da
 * coluna. Um tipo só evita a tradução no meio do caminho — que é por onde a
 * trilha e a lista da tela já divergiram uma vez no GBP.
 *
 * Sem campo `icon`: a barra de abas não renderiza ícone.
 */
export type WebsiteStepTabId =
  | "auditoria"
  | "pagespeed"
  | "validacao"
  | "autoridade"

export const WEBSITE_STEP_TABS: ReadonlyArray<{
  id: WebsiteStepTabId
  label: string
}> = [
  { id: "auditoria", label: "Auditoria" },
  { id: "pagespeed", label: "PageSpeed" },
  { id: "validacao", label: "Validação visual" },
  { id: "autoridade", label: "Autoridade externa" },
]
```

- [ ] **Step 2: Escrever o mapa de temas**

No fim de `lib/leads/website-opportunities.ts`, com os imports novos no topo (`import type { BacklinkGapId } from "./backlinks-audit.ts"`, `import type { WebsiteStepTabId } from "./website-step-tabs.ts"`, e `WEBSITE_STEP_TABS` para o `EMPTY_BY_THEME`):

```ts
/**
 * Contadores das abas, grupos da coluna e total do rail saem da mesma lista. A
 * garantia de que não divergem é de tipo, não de teste: `Record` sobre as três
 * uniões inteiras faz o `tsc` recusar a compilação quando um id novo entra sem
 * tema — mais barato e mais confiável que um teste, num runner que não resolve
 * o alias `@/`.
 *
 * A regra do corte não é "quem produz o gap". `websitePagespeedGaps` também
 * levanta `mixed_content` e `noindex`, e os dois ficam em Auditoria: não são
 * métricas do PageSpeed, são fatos binários com item de check próprio, e
 * `noindex` ainda tem segunda fonte no crawl. Temar por origem faria a mesma
 * checagem mudar de aba conforme qual coleta chegasse primeiro.
 */
export const WEBSITE_OPPORTUNITY_THEME: Record<
  WebsiteGapId | BacklinkGapId | `review:${WebsiteReviewCriterionId}`,
  WebsiteStepTabId
> = {
  // PageSpeed — as quatro métricas que a aba mede em profundidade.
  slow_performance: "pagespeed",
  poor_cwv: "pagespeed",
  not_responsive: "pagespeed",
  a11y_issues: "pagespeed",

  // Auditoria — estrutura técnica.
  no_https: "auditoria",
  mixed_content: "auditoria",
  noindex: "auditoria",
  noindex_internal_pages: "auditoria",
  robots_blocks_search: "auditoria",
  missing_sitemap: "auditoria",
  sitemap_bloat: "auditoria",
  weak_security_headers: "auditoria",
  canonical_missing: "auditoria",
  canonical_points_elsewhere: "auditoria",
  canonical_external: "auditoria",
  canonical_insecure: "auditoria",
  canonical_vs_noindex: "auditoria",
  canonical_non_indexable: "auditoria",
  host_canonicalization: "auditoria",
  slash_canonicalization: "auditoria",
  https_canonicalization: "auditoria",
  redirect_chain: "auditoria",
  temporary_redirect: "auditoria",
  redirect_loop: "auditoria",
  few_pages: "auditoria",
  unfriendly_urls: "auditoria",

  // Auditoria — SEO on-page.
  generic_title: "auditoria",
  missing_meta_description: "auditoria",
  missing_h1: "auditoria",
  duplicate_h1: "auditoria",
  heading_hierarchy: "auditoria",
  thin_content: "auditoria",
  images_missing_alt: "auditoria",
  no_internal_links: "auditoria",
  no_schema: "auditoria",
  no_local_schema: "auditoria",
  no_service_pages: "auditoria",
  no_blog: "auditoria",

  // Auditoria — conversão e UX.
  weak_cta: "auditoria",
  contact_only_in_footer: "auditoria",
  nap_mismatch: "auditoria",
  no_privacy_policy: "auditoria",
  no_terms: "auditoria",

  // Autoridade externa — o catálogo inteiro de backlinks.
  no_backlinks: "autoridade",
  few_referring_domains: "autoridade",
  low_authority_rank: "autoridade",
  broken_backlinks: "autoridade",
  mostly_nofollow: "autoridade",
  toxic_backlinks: "autoridade",
  sitewide_link_pattern: "autoridade",
  behind_on_referring_domains: "autoridade",
  link_scheme_detected: "autoridade",

  // Validação visual — o julgamento do analista.
  "review:design": "validacao",
  "review:cta_visible": "validacao",
  "review:narrow_layout": "validacao",
  "review:sample_pages": "validacao",
  "review:nap_group": "validacao",
  "review:content_quality": "validacao",
  "review:other": "validacao",
}

const EMPTY_BY_THEME = (): Record<
  WebsiteStepTabId,
  WebsiteOpportunityItem[]
> => ({
  auditoria: [],
  pagespeed: [],
  validacao: [],
  autoridade: [],
})

export function websiteOpportunityTheme(id: string): WebsiteStepTabId {
  // Id fora do mapa só existe se alguém montar um item à mão; cair em
  // "auditoria" mantém o item visível em vez de sumir do agrupamento.
  return (
    WEBSITE_OPPORTUNITY_THEME[
      id as keyof typeof WEBSITE_OPPORTUNITY_THEME
    ] ?? "auditoria"
  )
}

/**
 * Reduce sobre a lista recebida: a soma dos grupos é a lista, por construção.
 * Nenhum item pode sumir entre o contador da aba e o grupo da coluna.
 */
export function websiteOpportunitiesByTheme(
  items: ReadonlyArray<WebsiteOpportunityItem>,
): Record<WebsiteStepTabId, WebsiteOpportunityItem[]> {
  return items.reduce((acc, item) => {
    acc[websiteOpportunityTheme(item.id)].push(item)
    return acc
  }, EMPTY_BY_THEME())
}
```

`BacklinkOpportunityItem` e `WebsiteOpportunityItem` têm a mesma forma estrutural (`id`, `title`, `impact`, `source`, `detail?`), então a lista concatenada pelo painel tipa como `WebsiteOpportunityItem[]` sem conversão.

- [ ] **Step 3: Provar que o mapa está exaustivo**

```bash
pnpm exec tsc --noEmit
```

Esperado: **limpo**. Para provar que a trava funciona, apague temporariamente a linha `no_terms: "auditoria",`, rode de novo e confirme o erro `Property 'no_terms' is missing in type ...`. Recoloque a linha.

- [ ] **Step 4: Compilar e lintar**

```bash
pnpm exec tsc --noEmit && pnpm lint
```

- [ ] **Step 5: Parar para o commit**

```
feat(website): abas da etapa e mapa de temas das oportunidades
```

---

## Tarefa 5: Saldo dos checks e contagem destacada

**Files:**
- Modify: `lib/leads/website-presenters.ts`

**Interfaces:**
- Consumes: `WebsiteCheckSection`, `WebsiteCheckItem`, `websiteCheckSections` (mesmo arquivo).
- Produces: `WebsiteCheckCount = { value: number; total: number; noun: string }`; `WebsiteCheckItem.count?: WebsiteCheckCount`; `websiteCheckTally(sections): { ok, warn, pending, error, total }`; `websiteCheckGroups(section): { open: WebsiteCheckItem[]; approved: WebsiteCheckItem[] }`.

- [ ] **Step 1: Estender o tipo do item**

```ts
export type WebsiteCheckCount = {
  value: number
  total: number
  /** Complemento depois do número, ex. "de 12 páginas sem H1". */
  noun: string
}

export type WebsiteCheckItem = {
  id: string
  label: string
  detail: string
  status: WebsiteCheckStatus
  /**
   * Quando o detalhe é uma contagem, ela vem também destrinchada para a linha
   * poder destacar o número. `detail` continua obrigatório: quem não tem
   * contagem renderiza como sempre.
   */
  count?: WebsiteCheckCount
}
```

- [ ] **Step 2: Fazer `sampleCount` devolver os dois formatos**

Substitua a função atual por um par — a de string continua existindo porque o texto dela é o `detail`:

```ts
function sampleCount(total: number, bad: number, warnLabel: string): string {
  return `${bad.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} ${warnLabel}`
}

function sampleCountItem(
  total: number,
  bad: number,
  warnLabel: string,
): Pick<WebsiteCheckItem, "detail" | "status" | "count"> {
  return {
    status: "warn",
    detail: sampleCount(total, bad, warnLabel),
    count: { value: bad, total, noun: `de ${total.toLocaleString("pt-BR")} ${warnLabel}` },
  }
}
```

- [ ] **Step 3: Trocar os cinco pontos de uso**

Em `headingDetail`:

```ts
if (gaps.has("missing_h1")) {
  const missing = crawl.pages.filter((page) => page.h1.length === 0).length
  return sampleCountItem(crawl.pages.length, missing, "páginas sem H1")
}
```

Em `websiteCheckSections`, nos itens `title`, `meta`, `content` e `images`, troque cada bloco

```ts
? {
    status: "warn" as const,
    detail: sampleCount(total, genericTitles, "páginas com title genérico"),
  }
```

por

```ts
? sampleCountItem(total, genericTitles, "páginas com title genérico")
```

e o mesmo para `missingMeta` / `"páginas sem meta"`, `thinPages` / `"páginas com pouco conteúdo"`, `missingAlt` / `"páginas com imagens sem alt"`. O tipo de retorno de `headingDetail` passa de `Pick<WebsiteCheckItem, "detail" | "status">` para `Pick<WebsiteCheckItem, "detail" | "status" | "count">`.

- [ ] **Step 4: Escrever os dois helpers**

```ts
export type WebsiteCheckTally = {
  ok: number
  warn: number
  pending: number
  error: number
  total: number
}

/**
 * `total` conta todos os itens, inclusive os `pending`. Um check aguardando
 * PageSpeed não é um check aprovado, e somá-lo no numerador faria a fração
 * subir sozinha antes de a coleta voltar.
 */
export function websiteCheckTally(
  sections: readonly WebsiteCheckSection[],
): WebsiteCheckTally {
  const tally: WebsiteCheckTally = {
    ok: 0,
    warn: 0,
    pending: 0,
    error: 0,
    total: 0,
  }
  for (const section of sections) {
    for (const item of section.items) {
      tally[item.status] += 1
      tally.total += 1
    }
  }
  return tally
}

const OPEN_ORDER: Record<WebsiteCheckStatus, number> = {
  error: 0,
  warn: 1,
  pending: 2,
  ok: 3,
}

/**
 * O que precisa de trabalho fica visível sem rolar; o que passou continua
 * auditável atrás do disclosure.
 */
export function websiteCheckGroups(section: WebsiteCheckSection): {
  open: WebsiteCheckItem[]
  approved: WebsiteCheckItem[]
} {
  const open = section.items
    .filter((item) => item.status !== "ok")
    .sort((left, right) => OPEN_ORDER[left.status] - OPEN_ORDER[right.status])
  return {
    open,
    approved: section.items.filter((item) => item.status === "ok"),
  }
}
```

- [ ] **Step 5: Compilar e lintar**

```bash
pnpm exec tsc --noEmit && pnpm lint
```

- [ ] **Step 6: Confirmar que nada mudou em tela**

Abra a etapa Website de um lead com coleta. Os três cards de checks ainda existem e os textos são os mesmos — esta tarefa só acrescentou dados que ninguém consome ainda.

- [ ] **Step 7: Parar para o commit**

```
feat(website): saldo dos checks e contagem destacada no presenter
```

---

## Tarefa 6: Ligar a coluna `notes` de ponta a ponta

Sem migração — a coluna existe, com `char_length(trim(notes))` entre 1 e 2000 ou nulo.

**Files:**
- Modify: `lib/leads/website-review.ts`, `lib/leads/website-audit.ts`, `app/actions/leads/website-access.ts`, `app/actions/leads/analyze-website.ts`, `app/actions/leads/poll-website-jobs.ts`, `app/actions/leads/update-website-audit.ts`, `lib/validations/lead-website.ts`

**Interfaces:**
- Consumes: nada das tarefas anteriores.
- Produces: `WEBSITE_NOTES_MAX = 2000`; `WebsiteReviewEntry = { review: WebsiteReview; notes: string | null }`; `emptyWebsiteReviewEntry()`; `websiteReviewsByChannel(rows): Map<string, WebsiteReviewEntry>`; `LeadWebsiteAudit.notes: string | null`; `updateLeadWebsiteAudit` aceita o campo de formulário `notes`.

- [ ] **Step 1: Entry no lugar da revisão nua**

Em `lib/leads/website-review.ts`:

```ts
export const WEBSITE_NOTES_MAX = 2000

export type WebsiteReviewEntry = {
  review: WebsiteReview
  notes: string | null
}

export function emptyWebsiteReviewEntry(): WebsiteReviewEntry {
  return { review: emptyWebsiteReview(), notes: null }
}
```

Tire o segundo parâmetro de `readWebsiteReview`:

```ts
export function readWebsiteReview(value: unknown): WebsiteReview {
  const review = emptyWebsiteReview()
  const row = objectRecord(value)
  if (row) {
    for (const criterion of WEBSITE_REVIEW_CATALOG) {
      const item = objectRecord(row[criterion.id])
      if (!item) continue
      const verdict = criterion.hasVerdict
        ? readVerdict(item.verdict, criterion.allowsNa)
        : null
      review[criterion.id] = {
        verdict,
        note: readNote(item.note),
        updatedAt: asString(item.updatedAt),
        updatedBy: asString(item.updatedBy),
      }
    }
  }
  return review
}
```

`isReviewEmpty` fica sem uso; apague-a. Acrescente, acima de `readWebsiteReview`, o comentário que explica a remoção:

```ts
/**
 * O fallback de `notes` para o critério `other` saiu quando o bloco do analista
 * ganhou campo próprio de notas: o mesmo texto apareceria em dois lugares e o
 * analista editaria dois campos que são um só. Linhas antigas com revisão vazia
 * e `notes` preenchida passam a mostrar o texto só em "Notas da etapa", que é
 * onde ele foi escrito.
 */
```

Ajuste `readLeadWebsiteReviewRow` (a chamada perde o segundo argumento) e `websiteReviewsByChannel`:

```ts
export function websiteReviewsByChannel(
  rows: unknown,
): Map<string, WebsiteReviewEntry> {
  const map = new Map<string, WebsiteReviewEntry>()
  if (!Array.isArray(rows)) return map
  for (const item of rows) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const parsed = readLeadWebsiteReviewRow(item as Record<string, unknown>)
    if (!parsed) continue
    map.set(parsed.channel_id, { review: parsed.review, notes: parsed.notes })
  }
  return map
}
```

- [ ] **Step 2: `notes` na auditoria**

Em `lib/leads/website-audit.ts`, no tipo:

```ts
  /**
   * Hidratada de `lead_website_reviews` pela camada de acesso: e um campo de
   * apresentacao, nao uma coluna do snapshot.
   */
  review: WebsiteReview
  /** Notas livres do analista, por canal. Mesma origem da revisao. */
  notes: string | null
```

Na leitura da linha, troque o parâmetro e a montagem:

```ts
export function readLeadWebsiteAuditRow(
  row: Record<string, unknown>,
  entry: WebsiteReviewEntry = emptyWebsiteReviewEntry(),
): LeadWebsiteAudit | null {
```

e, no objeto devolvido, `review: entry.review` e `notes: entry.notes`.

Em `readLeadWebsiteAudits`, o mapa passa a ser de entries:

```ts
export function readLeadWebsiteAudits(
  embed: unknown,
  reviewsByChannel?: ReadonlyMap<string, WebsiteReviewEntry>,
): LeadWebsiteAudit[] {
```

- [ ] **Step 3: Camada de acesso**

Em `app/actions/leads/website-access.ts`:

```ts
export async function loadWebsiteReviewForChannel(
  supabase: SupabaseClient,
  channelId: string,
): Promise<WebsiteReviewEntry> {
  const { data, error } = await supabase
    .from("lead_website_reviews")
    .select(WEBSITE_REVIEW_SELECT)
    .eq("channel_id", channelId)
    .maybeSingle()
  if (error || !data) return emptyWebsiteReviewEntry()
  const parsed = readLeadWebsiteReviewRow(data as Record<string, unknown>)
  if (!parsed) return emptyWebsiteReviewEntry()
  return { review: parsed.review, notes: parsed.notes }
}

export async function loadWebsiteReviewsForLead(
  supabase: SupabaseClient,
  leadId: string,
): Promise<Map<string, WebsiteReviewEntry>> {
  const { data, error } = await supabase
    .from("lead_website_reviews")
    .select(WEBSITE_REVIEW_SELECT)
    .eq("lead_id", leadId)
  if (error) return new Map()
  return websiteReviewsByChannel(data)
}
```

As duas chamadas de `readLeadWebsiteAuditRow` dentro deste arquivo já passam o resultado dessas funções; só os tipos mudam. `analyze-website.ts:104` e `poll-website-jobs.ts:49` idem — a variável local muda de nome de `review` para `entry`, e nada mais.

- [ ] **Step 4: Validação**

Em `lib/validations/lead-website.ts`:

```ts
import {
  readWebsiteReview,
  WEBSITE_NOTES_MAX,
  WEBSITE_REVIEW_NOTE_MAX,
} from "@/lib/leads/website-review"

/**
 * Vazio vira `null`: o check do banco rejeita string de comprimento zero, e um
 * upsert com "" falharia com erro de constraint no meio do debounce.
 */
const notesSchema = z
  .string()
  .trim()
  .max(
    WEBSITE_NOTES_MAX,
    `Notas devem ter no máximo ${WEBSITE_NOTES_MAX} caracteres.`,
  )
  .transform((value) => (value.length === 0 ? null : value))

export const updateWebsiteAuditSchema = z.object({
  audit_id: z.uuid("Auditoria inválida."),
  review: reviewJsonSchema,
  notes: notesSchema,
})

export function readUpdateWebsiteAuditFields(formData: FormData) {
  return {
    audit_id: formText(formData, "audit_id"),
    review: formText(formData, "review"),
    notes: formText(formData, "notes"),
  }
}
```

`formText` já devolve `""` quando o campo não vem, então `notes` ausente vira `null` sem tratamento extra.

- [ ] **Step 5: Gravação**

Em `app/actions/leads/update-website-audit.ts`, dentro do `upsert`, acrescente `notes: parsed.data.notes,` e devolva:

```ts
  return {
    status: "success",
    audit: { ...loaded.audit, review, notes: parsed.data.notes },
  }
```

- [ ] **Step 6: Compilar e lintar**

```bash
pnpm exec tsc --noEmit && pnpm lint
```

Esperado: limpo. Se `tsc` reclamar de `readWebsiteReview` com dois argumentos, é um call site que ficou para trás — procure com `grep -rn "readWebsiteReview(" --include=*.ts lib app`.

- [ ] **Step 7: Verificar que a gravação existente não regrediu**

Abra a etapa Website de um lead com coleta, marque um veredito na Validação visual e confirme o `✓ Salvo agora`. Recarregue e confirme que o veredito persistiu. O painel ainda não manda `notes`; o objetivo aqui é provar que o caminho antigo continua inteiro.

- [ ] **Step 8: Parar para o commit**

```
feat(website): grava as notas do analista por canal
```

---

## Tarefa 7: `useWebsiteController`

Refatoração pura: nenhuma mudança visual. Ela isola o estado antes de o shell ser montado, para que a Tarefa 8 seja só composição.

**Files:**
- Create: `components/custom/LeadWebsitePanel/use-website-controller.ts`
- Modify: `components/custom/LeadWebsitePanel/LeadWebsitePanel.tsx`

**Interfaces:**
- Consumes: Tarefa 4 (`websiteOpportunitiesByTheme`), Tarefa 5 (`websiteCheckTally`), Tarefa 6 (`LeadWebsiteAudit.notes`).
- Produces: `WebsiteController` com os campos abaixo, e `useWebsiteController(input): WebsiteController`.

- [ ] **Step 1: Escrever o hook**

`use-website-controller.ts` recebe o que o painel recebe hoje e devolve um objeto único. Mova para dentro dele, **sem mudança de comportamento**, tudo o que hoje está em `LeadWebsitePanel.tsx` entre a declaração de `channels` e `handleAnalyze`: os três ajustes de estado no render (`syncedChannelsKey`, `syncedAuditId`, `syncedPollKey`), o efeito de polling, os refs (`reviewRef`, `reviewTimerRef`, `auditRef`, `onAuditChangeRef`), `persistReview` e `handleReviewDraftChange`.

Forma do retorno:

```ts
export type WebsiteController = {
  // seleção
  channels: LeadDigitalChannel[]
  selected: LeadDigitalChannel | null
  selectedId: string | null
  setSelectedId: (id: string) => void
  siteHref: string | null

  // coleta
  audit: LeadWebsiteAudit | null
  canEdit: boolean
  busy: boolean
  jobsActive: boolean
  pollTimedOut: boolean
  failedJobs: WebsitePsiJob[]
  error: string | null
  handleAnalyze: () => void

  // derivados
  gaps: WebsiteGapId[]
  sections: WebsiteCheckSection[]
  tally: WebsiteCheckTally
  reviewEvidence: Record<WebsiteReviewCriterionId, string> | null
  review: WebsiteReview | null
  opportunities: WebsiteOpportunityItem[]
  backlinkAudit: LeadBacklinkAudit | null

  // persistência do analista — um salvamento só, dois campos
  saveStatus: "idle" | "saving" | "saved" | "error"
  saveError: string | null
  retrySave: () => void
  notes: string
  handleReviewDraftChange: (next: WebsiteReview) => void
  handleNotesDraftChange: (next: string) => void
}
```

Três acréscimos em relação ao que existe hoje:

1. `tally` — `websiteCheckTally(sections)`.
2. `opportunities` já existe no painel; passa a viver aqui, com a mesma concatenação de `mergeWebsiteOpportunities` e `backlinkOpportunitiesFromSnapshot` e a mesma ordenação por impacto.
3. O caminho das notas — **um único** debounce para os dois campos.

O terceiro é código novo, não movimentação. Os dois campos vão para a mesma linha de `lead_website_reviews` pela mesma action; dois timers independentes disparariam requisições concorrentes para a mesma linha, e a última a chegar apagaria o campo que a outra acabou de gravar. Um timer só, e o `FormData` leva sempre os dois valores mais recentes:

```ts
const draftRef = useRef<{ review: WebsiteReview; notes: string } | null>(null)
const timerRef = useRef(0)

/** Fonte única do que vai para o servidor: sempre os dois campos juntos. */
function currentDraft() {
  const current = auditRef.current
  return (
    draftRef.current ?? {
      review: current ? websiteReviewDraft(current.review) : emptyWebsiteReview(),
      notes: current?.notes ?? "",
    }
  )
}

async function persistDraft(draft: { review: WebsiteReview; notes: string }) {
  const current = auditRef.current
  if (!current) return true
  const unchanged =
    serializeWebsiteReviewDraft(draft.review) ===
      serializeWebsiteReviewDraft(current.review) &&
    draft.notes.trim() === (current.notes ?? "")
  if (unchanged) {
    setSaveStatus("idle")
    return true
  }
  setSaveStatus("saving")
  setSaveError(null)
  const formData = new FormData()
  formData.set("audit_id", current.id)
  formData.set("review", serializeWebsiteReviewDraft(draft.review))
  formData.set("notes", draft.notes)
  const result = await updateLeadWebsiteAudit(formData)
  if (result.status === "error") {
    setSaveStatus("error")
    setSaveError(result.message)
    return false
  }
  onAuditChange(result.audit)
  setLiveReview(websiteReviewDraft(result.audit.review))
  setLiveNotes(result.audit.notes ?? "")
  setSaveStatus("saved")
  return true
}

function schedule(next: { review: WebsiteReview; notes: string }) {
  draftRef.current = next
  window.clearTimeout(timerRef.current)
  if (!canEdit || !auditRef.current) return
  timerRef.current = window.setTimeout(() => {
    const draft = draftRef.current
    if (!draft) return
    setLiveReview(draft.review)
    setLiveNotes(draft.notes)
    void persistDraft(draft)
  }, REVIEW_DEBOUNCE_MS)
}

function handleReviewDraftChange(review: WebsiteReview) {
  schedule({ ...currentDraft(), review })
}

function handleNotesDraftChange(notes: string) {
  schedule({ ...currentDraft(), notes })
}
```

O painel de hoje tem `reviewStatus` e `reviewError`; o controller expõe `saveStatus` e `saveError`, um par só para os dois campos, e `retrySave` como `onRetry` de ambos. Um salvamento é um salvamento: dois indicadores de "Salvando…" para uma requisição só seria mentira na tela. `LeadWebsiteReview` continua recebendo `status` e `errorMessage` com os mesmos nomes de prop — só a origem muda.

O `notes` que sai do servidor é `string | null`; o que vive no estado é `string`. A conversão acontece na fronteira (`result.audit.notes ?? ""`) e no envio (`formData.set("notes", draft.notes)`, com o `trim`-para-`null` do lado do Zod).

- [ ] **Step 2: Consumir o hook no painel**

`LeadWebsitePanel.tsx` passa a ser:

```tsx
export function LeadWebsitePanel(props: LeadWebsitePanelProps) {
  const controller = useWebsiteController(props)
  if (!controller.selected) return <EmptyNoChannel />
  // ... o JSX de hoje, lendo tudo de `controller`
}
```

Nesta tarefa o JSX **continua exatamente o mesmo** — os mesmos sete blocos empilhados, na mesma ordem. Só a origem dos dados muda.

- [ ] **Step 3: Compilar e lintar**

```bash
pnpm exec tsc --noEmit && pnpm lint
```

- [ ] **Step 4: Verificar em tela que nada mudou**

Etapa Website de um lead com coleta: os mesmos blocos na mesma ordem. Dispare "Atualizar coleta" e confirme que o polling do PageSpeed roda e a tela atualiza sozinha quando os jobs voltam. Troque de canal num lead com dois sites e confirme que a auditoria acompanha.

- [ ] **Step 5: Parar para o commit**

```
refactor(website): extrai o estado da etapa para useWebsiteController
```

---

## Tarefa 8: Shell — view, cabeçalho fixo, identidade, big numbers e abas

Esta é a tarefa que muda a cara da etapa. O conteúdo das abas ainda é o dos cards atuais, redistribuídos; a repaginação de cada um vem nas Tarefas 10 a 13.

**Files:**
- Create: `LeadWebsiteView.tsx`, `LeadWebsiteHeader.tsx`, `LeadWebsiteIdentityCell.tsx`, `LeadWebsiteMetricCells.tsx`, `LeadWebsiteTabPanels.tsx` (todos em `components/custom/LeadWebsitePanel/`)
- Modify: `LeadWebsitePanel.tsx`, `LeadWebsiteStepHeader.tsx`, `components/custom/LeadGbpPanel/LeadGbpPanel.tsx`
- Delete: `components/custom/LeadWebsitePanel/LeadWebsiteSummaryCards.tsx`

**Interfaces:**
- Consumes: Tarefas 1, 2, 4, 5, 7.
- Produces: `LeadWebsiteView({ controller, readingMode })`; `LeadWebsiteHeader({ controller, readingMode, tab, counts })`; `LeadWebsiteMetricCells({ controller, onSelectTab })`.

- [ ] **Step 1: Abrir o `fullBleed` para a etapa Website**

Em `LeadGbpPanel.tsx`, a expressão de `fullBleed` hoje é:

```tsx
const fullBleed =
  selectedStep === "google-profile" && profiles.length > 0 && selected !== null
```

Passa a ser:

```tsx
// As duas etapas montam o próprio shell de tela cheia: cabeçalho fixo, abas e
// coluna. Padding e scroll do contêiner brigariam com ele.
const websiteFullBleed =
  selectedStep === "website" &&
  detail.lead.channels.some((channel) => channel.type === "website" && channel.id)
const fullBleed =
  (selectedStep === "google-profile" &&
    profiles.length > 0 &&
    selected !== null) ||
  websiteFullBleed
```

E o ramo `website` passa `readingMode`:

```tsx
<LeadWebsitePanel
  detail={detail}
  canEdit={canEdit}
  readingMode={readingMode}
  onAuditChange={/* como está */}
  onBacklinkAuditChange={/* como está */}
  onPendingChange={onPendingChange}
/>
```

`LeadWebsitePanelProps` ganha `readingMode: boolean`.

- [ ] **Step 2: Célula de identidade**

`LeadWebsiteIdentityCell.tsx`: `rounded-lg px-3 py-2.5 bg-accent/60 ring-1 ring-foreground/[0.06]`, `flex items-center gap-2.5`.

- Miniatura: `img` `size-11 rounded-lg object-cover object-top` com `src` de `audit?.pagespeed?.desktop?.screenshot ?? audit?.pagespeed?.mobile?.screenshot`. Sem captura, ou em `onError`, um `span` `inline-flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary` com `RiGlobalLine size={20}`.
- Domínio: `text-xs/[1.5] font-semibold truncate` — use `digitalChannelDisplay(selected.type, selected.value)`.
- Abaixo: `crawl.finalUrl` em `text-xs/[1.5] text-muted-foreground truncate`.
- Badges numa linha `mt-1 flex flex-wrap items-center gap-1.5`: `Badge variant="primary"` com `RiStarFill size={12}` e o texto `Principal` quando `selected.is_primary`; `Badge variant={crawl.https ? "success" : "warning"}` com `HTTPS` / `Sem HTTPS`; `Badge variant={home?.indexable === false ? "warning" : "muted"}` com `Sem indexação` / `Indexável`, onde `home = websiteHomePage(crawl)`.
- Com dois ou mais canais, um `Select` de troca no fim da célula, `SelectTrigger size="sm"` e `className="w-full"`. É o `Select` que hoje mora solto acima do painel — remova-o de lá.

- [ ] **Step 3: Os quatro big numbers**

`LeadWebsiteMetricCells.tsx` usa `StepStat` com um `StepMeter` como `children`. Cada célula é embrulhada num `button type="button"` com `className="text-left"` e `aria-label` nomeando o destino.

```tsx
const performance = websiteMinPerformance(audit?.pagespeed ?? null)
const progress = websiteReviewProgress(review)
const median = snapshot?.competitors
  ? competitorReferringDomainsMedian(snapshot.competitors)
  : null
```

| Célula | `label` | `value` | `unit` | `tone` | medidor |
| --- | --- | --- | --- | --- | --- |
| Auditoria | `APROVAÇÕES` | `tally.ok` | `de ${tally.total} checks` | `success` se `ok/total ≥ 0.8`, `warning` se `≥ 0.5`, senão `danger` | `share = tally.total ? tally.ok / tally.total : 0` |
| PageSpeed | `PERFORMANCE` | `performance` | `pior entre mobile e desktop` | `danger < 50`, `warning < 90`, senão `success` | `share = performance / 100` |
| Validação | `VALIDAÇÃO` | `progress.done` | `de ${progress.total} critérios julgados` | `primary` | `share = progress.done / progress.total` |
| Autoridade | `DOMÍNIOS` | `snapshot?.referringDomains` | `mediana ${median} no mercado`, ou `no total` sem mediana | `success` se `≥ median`, senão `warning`; `neutral` sem mediana | `share = Math.min(1, domains / median)`; **sem medidor quando não há mediana** |

Valor nulo é `"—"` com `unit` `"sem coleta"`, `tone` `neutral` e sem medidor. Trilha sem escala mente pior que a ausência dela.

- [ ] **Step 4: Cabeçalho fixo**

`LeadWebsiteHeader.tsx` é o `LeadGbpProfileHeader` adaptado: `border-b border-border/70 bg-background px-5 pt-4`, colapso dos números por `grid-rows-[1fr] → grid-rows-[0fr]` com o filho em `overflow-hidden`, chave `website:header-numbers`, e o botão de dobrar na linha das abas com `aria-expanded` / `aria-controls`.

Grid da faixa: `grid grid-cols-2 items-stretch gap-3 pt-3.5 md:grid-cols-[minmax(0,1.15fr)_repeat(2,minmax(0,1fr))] xl:grid-cols-[minmax(0,1.15fr)_repeat(4,minmax(0,1fr))]`.

Entre a faixa e as abas, a faixa de avisos — só existe quando há o que dizer:

```tsx
const notices =
  controller.error || controller.jobsActive || controller.pollTimedOut || failed.length > 0 ? (
    <div className="mt-3 flex flex-col gap-2">{/* … */}</div>
  ) : null
```

Ela recebe, verbatim, o que hoje está solto no meio do scroll: o `role="alert"` do erro geral, `"Coletando PageSpeed…"`, `"Ainda coletando o PageSpeed — abra de novo."` e as mensagens de job falho de `websitePsiJobsFailedWithoutReady`.

Abas: `StepTabs` com `tabs={WEBSITE_STEP_TABS}`, `layoutId="website-step-tab-underline"` e `counts` vindos de `websiteOpportunitiesByTheme(controller.opportunities)`.

- [ ] **Step 5: A view**

`LeadWebsiteView.tsx` espelha `LeadGbpProfileView`: `Tabs` como raiz, `grid h-full min-h-0 grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1fr)_var(--rail-w)]`, com `--rail-w` em `21.25rem` / `3rem` e a transição de `grid-template-columns` em 320ms (120ms com `reduced`). A coluna central é `grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)]`, o corpo é `min-h-0 overflow-y-auto bg-accent/45 px-5 pt-4 pb-5 outline-none` com `tabIndex={-1}`, e os quatro `TabsContent` levam **`keepMounted`**.

Nesta tarefa a coluna da direita ainda não existe. Monte o grid com **uma coluna só** (`xl:grid-cols-1`, sem `--rail-w`) e troque para duas na Tarefa 9. Nada de placeholder vazio reservando a faixa: um grid que ainda não se dividiu é honesto, uma coluna vazia na tela é bug aos olhos de quem revisa.

- [ ] **Step 6: Distribuir o conteúdo atual nas abas**

`LeadWebsiteTabPanels.tsx`, provisoriamente:

| Aba | Conteúdo nesta tarefa |
| --- | --- |
| `auditoria` | `LeadWebsiteChecks` (como está) |
| `pagespeed` | `LeadWebsiteScreenshots` (como está) |
| `validacao` | `LeadWebsiteReview` (como está) |
| `autoridade` | `LeadWebsiteBacklinksCard` (como está) |

`LeadGbpOpportunitiesCard` sai do fim do scroll — as oportunidades passam a viver na coluna, que chega na próxima tarefa. Até lá elas ficam **fora da tela**; é uma tarefa de diferença e está previsto.

- [ ] **Step 7: Menu de ações e modo reunião no `LeadWebsiteStepHeader`**

Acrescente a prop `readingMode: boolean` e esconda `Atualizar coleta` e `Abrir site` quando ela for verdadeira. Acrescente um `DropdownMenu` com `DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}` e `aria-label="Ações do site"`, contendo `Atualizar backlinks` (`RiLinksLine`) — os itens `Definir como principal` e `Adicionar site` exigem ações que ainda não existem para canal de site e **não entram nesta rodada**; o menu nasce com um item só e cresce quando elas existirem.

- [ ] **Step 8: Apagar os summary cards**

```bash
rm components/custom/LeadWebsitePanel/LeadWebsiteSummaryCards.tsx
grep -rn "LeadWebsiteSummaryCards" --include=*.tsx components app
```

Esperado: nenhuma linha.

- [ ] **Step 9: Compilar, lintar e verificar em tela**

```bash
pnpm exec tsc --noEmit && pnpm lint
```

Em tela, na etapa Website de um lead com coleta:
- Os cinco blocos da faixa com **altura idêntica** em 1280, 1440 e 1920px; domínio longo trunca sem empurrar as métricas.
- As quatro abas trocam com o sublinhado animando; o contador aparece nas abas com achados e a soma dos quatro é o total de oportunidades.
- Clicar num big number troca para a aba correspondente.
- O botão de dobrar recolhe a faixa e a preferência sobrevive a recarregar.
- Um lead sem PageSpeed mostra `—` e `sem coleta`, nunca `0`.

- [ ] **Step 10: Parar para o commit**

```
feat(website): shell da etapa com cabeçalho fixo, big numbers e abas
```

---

## Tarefa 9: Coluna de oportunidades e bloco do analista

**Files:**
- Create: `components/custom/LeadWebsitePanel/LeadWebsiteAnalystBlock.tsx`, `components/custom/LeadStepShell/StepNotesField.tsx` (movido)
- Modify: `LeadWebsiteView.tsx`, `components/custom/LeadStepShell/index.ts`, `components/custom/LeadGbpPanel/LeadGbpAnalystBlock.tsx`
- Delete: `components/custom/LeadGbpPanel/LeadGbpNotesCard.tsx`

**Interfaces:**
- Consumes: Tarefas 2, 3, 4, 6, 7.
- Produces: `StepNotesField({ id, syncKey, initialValue, canEdit, status, errorMessage, maxLength, title, placeholder, hidden, className, onDraftChange, onRetry })`; `StepNotesStatus`; `LeadWebsiteAnalystBlock({ controller, open, onOpenChange, focusSignal })`.

- [ ] **Step 1: Ligar o rail na view**

Volte o grid da view para duas colunas (`xl:grid-cols-[minmax(0,1fr)_var(--rail-w)]`) e monte:

```tsx
const wide = useWideViewport()
const { railOpen, toggle } = useCollapsibleRail({
  enabled: wide,
  storageKey: "website:opportunities-rail",
})
const collapsed = wide && !railOpen
const grouped = websiteOpportunitiesByTheme(controller.opportunities)

<StepOpportunitiesRail
  id="website-opportunities-rail"
  tabs={WEBSITE_STEP_TABS}
  groups={grouped}
  total={controller.opportunities.length}
  activeTab={tab}
  railOpen={!collapsed}
  onToggleRail={toggle}
  onRequestAnalyst={requestAnalyst}
  analyst={
    <LeadWebsiteAnalystBlock
      controller={controller}
      open={analystOpen}
      onOpenChange={setAnalyst}
      focusSignal={analystFocusSignal}
    />
  }
/>
```

`analystOpen`, `setAnalyst`, `analystFocusSignal`, `requestAnalyst`, `toggleAnalyst` e o `useCaptureShortcut({ code: "KeyE", allowInFields: true })` são cópia literal de `LeadGbpProfileView.tsx:57-100`, com a chave `website:analyst-block` e o id `website-analyst-block`.

- [ ] **Step 2: Bloco do analista**

`LeadWebsiteAnalystBlock.tsx` é o `LeadGbpAnalystBlock` com dois campos diferentes:

| Chave | Componente | Persiste em | Máximo |
| --- | --- | --- | --- |
| `Notas da etapa` | `LeadGbpNotesCard variant="rail"` | `lead_website_reviews.notes` | `WEBSITE_NOTES_MAX` (2000) |
| `Achado visual` | `Textarea` no mesmo desenho | `review.other.note` | `WEBSITE_REVIEW_NOTE_MAX` (400) |

O campo de texto vem de `LeadGbpNotesCard`, que precisa de três ajustes antes de servir às duas etapas — e o terceiro é uma remoção:

1. `profileId`, que só serve de chave de re-sincronização, vira `syncKey: string`. O Website passa o `channel_id` do canal selecionado.
2. `GBP_NOTES_MAX` deixa de ser fixo e vira a prop `maxLength`, com `GBP_NOTES_MAX` como padrão. O Website passa `WEBSITE_NOTES_MAX`.
3. **A variante `card` é código morto.** O único importador do componente é `LeadGbpAnalystBlock`, e os dois usos passam `variant="rail"`. Apague o ramo `card`, o import de `LeadGbpCard` e a prop `variant`.

Sem a variante `card` o componente não tem mais nada de GBP: mova-o para `components/custom/LeadStepShell/StepNotesField.tsx`, exporte no barril e atualize os dois call sites de `LeadGbpAnalystBlock`. `GbpNotesStatus` vira `StepNotesStatus`.

```bash
git mv components/custom/LeadGbpPanel/LeadGbpNotesCard.tsx components/custom/LeadStepShell/StepNotesField.tsx
grep -rn "LeadGbpNotesCard\|GbpNotesStatus" --include=*.tsx --include=*.ts components app
```

O segundo comando tem que sair vazio ao fim do passo.

Os dois campos ficam **montados** o tempo todo, o inativo com `hidden` — o valor vive em `useState(initialValue)` e desmontar devolveria o textarea ao valor do servidor, comendo o rascunho dentro do debounce.

- [ ] **Step 3: Compilar, lintar e verificar em tela**

```bash
pnpm exec tsc --noEmit && pnpm lint
```

Em tela:
- A coluna abre e recolhe com `Ctrl+B`; a preferência é independente da do GBP (recolha no Website, vá ao Perfil no Google e confirme que lá continua como estava).
- Os chips filtram; o grupo da aba ativa fica em teal; `N de M` acompanha o filtro.
- **A soma dos contadores das quatro abas é igual ao total da coluna.** Confira com e sem revisão preenchida e com e sem coleta de backlinks.
- Escreva em `Notas da etapa`, troque para `Achado visual`, troque de aba, feche o dialog: salva uma vez, sem requisição duplicada. Reabra e confirme que os dois textos voltaram.
- Apague a nota inteira e confirme `✓ Salvo agora` — sem erro de constraint. Recarregue e confirme que ficou vazia.
- `Ctrl+Shift+E` entra no campo e sai dele.

- [ ] **Step 4: Parar para o commit**

```
feat(website): coluna de oportunidades e bloco do analista
```

---

## Tarefa 10: Aba Auditoria

**Files:**
- Create: `components/custom/LeadWebsitePanel/LeadWebsiteAuditCard.tsx`
- Modify: `LeadWebsiteTabPanels.tsx`
- Delete: `components/custom/LeadWebsitePanel/LeadWebsiteChecks.tsx`

**Interfaces:**
- Consumes: Tarefa 5 (`websiteCheckGroups`, `WebsiteCheckItem.count`), Tarefa 1 (`StepMeter`).
- Produces: `LeadWebsiteAuditCard({ section })`.

- [ ] **Step 1: Card de pilar com saldo**

Cabeçalho do `LeadGbpCard`: à direita do título, `N de M` em `text-[11px] tabular-nums text-muted-foreground` e um `StepMeter` `trackClassName="h-1"` com `share = ok / total` da seção, no mesmo tom por faixa dos big numbers (`≥ 0.8` success, `≥ 0.5` warning, senão danger).

- [ ] **Step 2: Linhas com número destacado**

```tsx
<li className="flex items-start gap-2 border-t border-border/70 py-2 first:border-t-0 first:pt-0">
  <Icon size={14} aria-hidden className={cn("mt-0.5 shrink-0", STATUS_TONE[item.status])} />
  <div className="min-w-0">
    <p className="text-xs/relaxed font-medium text-foreground">{item.label}</p>
    {item.count ? (
      <p className="text-xs/relaxed text-muted-foreground">
        <span className={cn("text-[13px] font-semibold tabular-nums", STATUS_TONE[item.status])}>
          {item.count.value.toLocaleString("pt-BR")}
        </span>{" "}
        {item.count.noun}
      </p>
    ) : (
      <p className="text-xs/relaxed text-muted-foreground">{item.detail}</p>
    )}
  </div>
</li>
```

`STATUS_ICON` e `STATUS_TONE` são copiados de `LeadWebsiteChecks.tsx` para o arquivo novo, com os mesmos valores — o arquivo de origem é apagado no Passo 4.

- [ ] **Step 3: Disclosure dos aprovados**

`websiteCheckGroups(section)` separa `open` de `approved`. Os `open` renderizam direto; os `approved` ficam atrás de um botão `text-[11px] font-medium text-primary` com o rótulo `Ver os N aprovados` / `Ocultar aprovados`, `aria-expanded` e `aria-controls`. O colapso é o de grid — `grid-rows-[0fr] → grid-rows-[1fr]` com o filho em `overflow-hidden`, 280ms, easing da casa, `transition-none` com `reduced`. Sem aprovados, o botão não é renderizado.

- [ ] **Step 4: Ligar na aba**

```tsx
<div className="grid grid-cols-1 items-stretch gap-3.5 xl:grid-cols-3">
  {controller.sections.map((section) => (
    <LeadWebsiteAuditCard key={section.id} section={section} />
  ))}
</div>
```

Apague `LeadWebsiteChecks.tsx` e confirme com `grep -rn "LeadWebsiteChecks" --include=*.tsx components app`.

- [ ] **Step 5: Compilar, lintar e verificar em tela**

```bash
pnpm exec tsc --noEmit && pnpm lint
```

Em tela: os três cards com saldo no cabeçalho; reprovados no topo, aprovados recolhidos; o número da contagem destacado no tom do estado; o disclosure anima e o `aria-expanded` acompanha. Um pilar com tudo aprovado mostra `6 de 6`, medidor cheio e nenhuma linha aberta.

- [ ] **Step 6: Parar para o commit**

```
feat(website): aba Auditoria com saldo por pilar e aprovados recolhidos
```

---

## Tarefa 11: Aba PageSpeed

**Files:**
- Create: `components/custom/LeadWebsitePanel/LeadWebsitePagespeedCard.tsx`
- Modify: `LeadWebsiteTabPanels.tsx`

**Interfaces:**
- Consumes: Tarefa 1 (`StepMeter`, `StepMeterRow`, `StepStat`), `WebsitePsiStrategy`, `PSI_LCP_NEEDS_MS`, `PSI_INP_NEEDS_MS`, `PSI_CLS_NEEDS`.
- Produces: `LeadWebsitePagespeedCard({ label, strategy, job })`.

- [ ] **Step 1: Um card por estratégia**

```tsx
<div className="grid grid-cols-1 items-stretch gap-3.5 xl:grid-cols-2">
  <LeadWebsitePagespeedCard
    label="Mobile"
    strategy={audit?.pagespeed?.mobile ?? null}
    job={audit?.jobs.find((item) => item.kind === "pagespeed_mobile") ?? null}
  />
  <LeadWebsitePagespeedCard
    label="Desktop"
    strategy={audit?.pagespeed?.desktop ?? null}
    job={audit?.jobs.find((item) => item.kind === "pagespeed_desktop") ?? null}
  />
</div>
```

- [ ] **Step 2: Cabeçalho com score**

Score em `text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] tabular-nums` no tom da faixa (`danger < 50`, `warning < 90`, `success ≥ 90`), com `StepMeter share={performance / 100}` embaixo. Sem coleta: `—`, tom `neutral`, sem medidor.

- [ ] **Step 3: Core Web Vitals lab e campo**

Três `StepMeterRow`, separados do cabeçalho por `border-t border-border/70 pt-3`:

| Métrica | `label` | `value` | `share` | `tone` |
| --- | --- | --- | --- | --- |
| LCP | `LCP` | `${lab} lab · ${campo} campo` | `Math.min(1, (lab ?? campo) / (PSI_LCP_NEEDS_MS * 2))` | `success` se ambos `≤ PSI_LCP_NEEDS_MS`, senão `warning` |
| INP | `INP` | idem | `Math.min(1, valor / (PSI_INP_NEEDS_MS * 2))` | idem com `PSI_INP_NEEDS_MS` |
| CLS | `CLS` | idem | `Math.min(1, valor / (PSI_CLS_NEEDS * 2))` | idem com `PSI_CLS_NEEDS` |

A formatação de milissegundos é a que já existe em `website-presenters.ts` — exporte `formatMs` de lá em vez de reescrevê-la. Métrica ausente é `—`; campo ausente é `sem dado de campo`, que é informação (o site não tem tráfego suficiente no CrUX), não vazio.

O denominador `limiar × 2` é uma escolha de escala: coloca o limiar no meio da barra, de modo que "no limite" seja meia barra e o leitor veja quanto falta. Documente isso num comentário — é o tipo de constante que alguém "corrige" depois sem saber por quê.

- [ ] **Step 4: Estado e captura**

Bloco `border-t border-border/70 pt-3` com dois chips no padrão de tom do `StepStat`: `Viewport` (`viewportOk`) e `Acessibilidade` (`accessibility`, com `contrastFails` no complemento quando maior que zero).

Captura por último: `img` `max-h-64 w-full rounded-lg border border-border/70 object-cover object-top`, `alt={`Captura ${label}`}`. Sem captura: `div` `border-dashed border-border/70` com `Aguardando captura`.

- [ ] **Step 5: Fila e falha por estratégia**

Quando não há `strategy` e o job está `queued`/`running`: `Spinner` mais `Aguardando PageSpeed` dentro do card. Quando `failed`: `role="alert"` com `job.error_message` ou o texto padrão. A linha de status solta acima de tudo sai — ela já está na faixa de avisos do cabeçalho para o caso geral, e aqui o aviso é por estratégia.

- [ ] **Step 6: Compilar, lintar e verificar em tela**

```bash
pnpm exec tsc --noEmit && pnpm lint
```

Em tela: um lead com PageSpeed só de desktop mostra o card mobile inteiro com `—` e a moldura tracejada da captura, sem quebrar o grid. Dispare uma coleta e confirme que o card entra em `Aguardando PageSpeed` e se preenche sozinho quando o job volta.

- [ ] **Step 7: Parar para o commit**

```
feat(website): aba PageSpeed com CWV lab e campo por estratégia
```

---

## Tarefa 12: Aba Validação visual

**Files:**
- Create: `components/custom/LeadWebsitePanel/LeadWebsiteShotViewer.tsx`
- Modify: `components/custom/LeadWebsitePanel/LeadWebsiteReview.tsx`, `LeadWebsiteTabPanels.tsx`
- Delete: `components/custom/LeadWebsitePanel/LeadWebsiteScreenshots.tsx`

**Interfaces:**
- Consumes: Tarefa 1 (`StepMeter`), `WEBSITE_REVIEW_CATALOG`, `websiteReviewProgress`, `websiteReviewEvidence`.
- Produces: `LeadWebsiteShotViewer({ pagespeed })`.

- [ ] **Step 1: Visor de capturas**

`LeadGbpCard` com `ToggleGroup` de dois itens (`Mobile`, `Desktop`) no cabeçalho — `ToggleGroup` e não dois `Toggle`, porque são opções mutuamente exclusivas numa barra. A captura escolhida em `w-full rounded-lg border border-border/70 object-cover object-top`, com `sticky top-0` no contêiner e `max-h-[calc(100dvh-22rem)]`. Sem captura: `border-dashed` com `Aguardando captura`.

Abaixo de `xl`, o `sticky` sai (`xl:sticky`).

- [ ] **Step 2: Duas colunas na aba**

```tsx
<div className="grid grid-cols-1 items-start gap-3.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
  <LeadWebsiteShotViewer pagespeed={audit.pagespeed} />
  <LeadWebsiteReview {...} />
</div>
```

- [ ] **Step 3: Progresso no cabeçalho do card**

Troque o texto solto `{done} de {total}` por `N de M` em `text-[11px] tabular-nums` mais um `StepMeter share={done / total}` `trackClassName="h-1"` tom `primary`, na linha do título.

- [ ] **Step 4: Evidência como chip**

Em `CriterionRow`, a evidência de máquina hoje é um `<p className="text-xs/relaxed text-muted-foreground">` indistinguível do rótulo. Passa a ser:

```tsx
{evidence ? (
  <span className="mt-1 inline-flex h-[22px] items-center rounded-md bg-accent px-2 text-[11px] text-accent-foreground">
    {evidence}
  </span>
) : null}
```

O `VerdictGroup`, o `FieldReveal` e os estados de salvamento **não mudam** — funcionam, e mexer neles é risco sem retorno.

- [ ] **Step 5: Apagar o card de capturas antigo**

```bash
rm components/custom/LeadWebsitePanel/LeadWebsiteScreenshots.tsx
grep -rn "LeadWebsiteScreenshots" --include=*.tsx components app
```

Esperado: nenhuma linha.

- [ ] **Step 6: Compilar, lintar e verificar em tela**

```bash
pnpm exec tsc --noEmit && pnpm lint
```

Em tela: dá para julgar os seis critérios **sem rolar** para achar a captura em 1440×900; trocar de dispositivo não perde veredito nem nota; um veredito marcado aparece na coluna de oportunidades como item de `Validação visual` com o prefixo `Analista ·`.

- [ ] **Step 7: Parar para o commit**

```
feat(website): aba Validação visual com a captura ao lado do julgamento
```

---

## Tarefa 13: Aba Autoridade externa

**Files:**
- Create: `components/custom/LeadWebsitePanel/LeadWebsiteAuthorityCards.tsx`, `LeadWebsiteStackedBar.tsx`
- Modify: `LeadWebsiteBacklinksCard.tsx` (reduzido a cabeçalho e ação), `LeadWebsiteTabPanels.tsx`

**Interfaces:**
- Consumes: Tarefa 1 (`StepCountCell`, `StepMeterRow`, `StepSectionLabel`, `StepStat`), `backlinkMetrics`, `backlinkProfileShape`, `formatBacklinkShare`, `formatLinksPerDomain`, `competitorReferringDomainsMedian`, `BACKLINK_LINK_SPAM_SCORE`.
- Produces: `LeadWebsiteStackedBar({ items })` com `items: Array<{ label: string; value: number }>`; `LeadWebsiteAuthorityProfile`, `LeadWebsiteAuthorityComposition`, `LeadWebsiteAuthorityRisk`, `LeadWebsiteAuthorityMarket`.

- [ ] **Step 1: Barra empilhada**

`LeadWebsiteStackedBar.tsx`: `flex h-2 overflow-hidden rounded-full bg-accent`, uma `span` por fatia com `width` proporcional e `bg-chart-1` a `bg-chart-5` em ordem. Legenda em `mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]`, cada item com dot `size-2 rounded-full` da mesma cor, rótulo `truncate text-muted-foreground` e valor `shrink-0 tabular-nums`.

A rampa `chart-*` é **sequencial**, não categórica. Aqui isso é legítimo porque as fatias são ordenadas por participação, e a legenda declara a ordem — sem legenda, cinco tons de verde seriam indistinguíveis. Documente isso num comentário no arquivo.

Anima na montagem **o contêiner**, não as fatias: `m.span` externo com `initial={reduced ? false : { scaleX: 0 }}`, `animate={{ scaleX: 1 }}`, `className="origin-left …"` e `transition={{ duration: reduced ? 0 : 0.55, ease: [0.23, 1, 0.32, 1] }}`.

`scaleX`, e não `width`. O raio mora no **contêiner** (`rounded-full overflow-hidden`), não nas fatias — então escalar não deforma ponta arredondada nenhuma, e a lei do orçamento de motion ("em qualquer coisa que se repita, anime só `transform` e `opacity`") continua valendo sem abrir uma segunda exceção ao lado do `StepMeter`. Quatro barras na aba, uma transformação cada.

As fatias em si não animam: elas têm `width` proporcional fixo, e o contêiner cresce por cima. Fatia diminuta ganha `min-w-1`; zero não inventa pixel.

- [ ] **Step 2: Perfil do domínio**

`backlinkProfileShape(snapshot)` como manchete em `text-xs/relaxed text-foreground`; quatro `StepCountCell` em `grid grid-cols-2 gap-2 sm:grid-cols-4`: `Rank`, `Backlinks`, `Domínios`, `Links/domínio`. O botão de coletar e o `Coletado há…` ficam no cabeçalho deste card — é o que sobra de `LeadWebsiteBacklinksCard`.

- [ ] **Step 3: Composição**

Quatro `LeadWebsiteStackedBar`, cada uma sob um `StepSectionLabel`:

| Eixo | Itens | `aside` do rótulo |
| --- | --- | --- |
| Dofollow | dofollow vs nofollow, de `backlinkMetrics(snapshot).dofollowShare` | — |
| TLD | `snapshot.topTlds` | `conta links, não domínios` |
| País | `snapshot.topCountries` | `conta links, não domínios` |
| Onde o link mora | `snapshot.linkLocations` | `conta links, não domínios` |

O `aside` é onde entra o comentário que hoje está no JSX (*as distribuições contam links, não domínios, e ficam ao lado de "Domínios" — sem dizer isso o leitor soma errado*). Eixo sem dado não renderiza barra: `linkLocations === null` mantém o aviso de coleta anterior aos campos.

- [ ] **Step 4: Risco**

Card com `className={cn(hasRisk ? "border-warning/25 bg-warning/[0.05]" : undefined)}`. `StepStat` para `Spam score`; a leitura de `snapshot.scheme` com os clusters de âncora e de IP em listas `flex items-baseline justify-between gap-2`, e as amostras com link quando há `url`.

As três frases condicionais sobre truncamento da amostra ficam **verbatim** — elas distinguem "nada encontrado" de "não verificado", e essa distinção é o valor do card. A ressalva do provider (*a pontuação é do provider e diz "parece", não "é". Abrir a página é o que decide.*) vira rodapé em `text-[10px]/[1.45] text-muted-foreground`, depois de um `border-t border-border/70 pt-2`.

- [ ] **Step 5: Mercado**

`snapshot.competitors` em `StepMeterRow`, um por concorrente: `label` é o domínio, `value` é `${domínios} domínios · ${links} links`, `share` é `referringDomains / max(todos, inclusive o lead)`. Acrescente uma linha para o próprio lead no topo, em tom `primary`, para a comparação existir. Sob a lista, `mediana N domínios` em `text-[11px] text-muted-foreground`.

- [ ] **Step 6: Compor a aba**

```tsx
<div className="grid grid-cols-1 items-start gap-3.5 xl:grid-cols-2">
  <LeadWebsiteAuthorityProfile … />
  <LeadWebsiteAuthorityComposition … />
  <LeadWebsiteAuthorityRisk … />
  <LeadWebsiteAuthorityMarket … />
</div>
```

Sem snapshot, um card só com o texto de hoje (`O resumo de backlinks ainda não foi coletado para este domínio.`) e o botão de coletar.

- [ ] **Step 7: Compilar, lintar e verificar em tela**

```bash
pnpm exec tsc --noEmit && pnpm lint
```

Em tela: um lead sem backlinks mostra o vazio com o botão; um lead com coleta antiga (sem `linkLocations`/`scheme`) mostra os avisos de campo ausente sem quebrar; as barras animam uma vez na montagem e não re-animam ao trocar de aba e voltar.

- [ ] **Step 8: Parar para o commit**

```
feat(website): aba Autoridade externa com composição, risco e mercado
```

---

## Tarefa 14: Modo reunião, skeleton, responsivo e fechamento

**Files:**
- Modify: `LeadWebsiteView.tsx`, `LeadWebsiteHeader.tsx`, `LeadWebsiteReview.tsx`, `LeadWebsiteAuthorityCards.tsx`, `LeadWebsitePanel.tsx`

**Interfaces:**
- Consumes: todas as anteriores.
- Produces: nada novo.

- [ ] **Step 1: Modo reunião**

`readingMode` já desce até o painel desde a Tarefa 8. Feche o circuito: sob modo reunião somem `Atualizar coleta`, `Abrir site`, o `⋮`, `Analisar backlinks`; os `VerdictGroup` da Validação visual viram texto (o caminho `!canEdit` que `CriterionRow` já trata — passe `canEdit={controller.canEdit && !readingMode}`); e os dois campos do analista viram texto puro pelo mesmo caminho.

O modo **nunca habilita nada** — só esconde. `canEdit` continua vindo de `detail.canEditGbp && !readOnly`.

- [ ] **Step 2: Skeleton**

No ramo de carregamento do `LeadWebsitePanel`, o mesmo desenho do shell: faixa de cinco blocos de 64px, quatro pílulas de aba, três cards altos e coluna direita com seis linhas de 44px. Use o `Pulse` de `LeadGbpPanel.tsx:648` como referência — `Skeleton` com `rounded-xl`, `motion-reduce:animate-none` e `animationDelay` crescente. Skeleton com a forma errada mente: ele promete o layout que vem.

- [ ] **Step 3: Responsivo**

Confira e ajuste nos três degraus:

| Largura | Comportamento |
| --- | --- |
| `< md` | faixa de números em `grid-cols-2` |
| `< xl` | grids das abas em uma coluna; `sticky` da captura sai; coluna de oportunidades nasce recolhida sem preferência gravada e o atalho não é registrado |
| `< lg` | trilha em cima (comportamento do `LeadGbpPanel`, já existente); a coluna vira a última seção do scroll com o bloco do analista abaixo |

- [ ] **Step 4: Rodar os greps de reprovação**

```bash
cd "C:/Users/Eduardo Zamai/Documents/suite"
echo -n "cor cravada:        "; grep -rnE "oklch\(|#[0-9a-fA-F]{3,8}|rgba?\(" --include=*.tsx components/custom app | grep -v "oklch(from " | wc -l
echo -n "z-[N] avulso:       "; grep -rnE "z-\[" --include=*.tsx components/custom app | wc -l
echo -n "lucide:             "; grep -rn "lucide-react" --include=*.tsx --include=*.ts components app lib hooks | wc -l
echo -n "cn errado:          "; grep -rn 'cn.*from "@/lib/utils"' --include=*.tsx components app | wc -l
echo -n "motion.* em vez m.: "; grep -rnE "<motion\." --include=*.tsx components app | wc -l
echo -n "base-ui direto:     "; grep -rn "@base-ui/react" --include=*.tsx components/custom app | wc -l
echo -n "altura mágica:      "; grep -rnoE "<(Button|Input|Textarea|SelectTrigger|Toggle)[^>]*className=\"[^\"]*\bh-[0-9]" --include=*.tsx components/custom app | wc -l
echo -n "anima sem reduced:  "; for f in $(grep -rlE "<m\." --include=*.tsx components/custom app); do grep -q "useReducedMotion" "$f" || echo "$f"; done | wc -l
```

Esperado: `cor cravada 5`, `base-ui direto 2`, `anima sem reduced 1`, todo o resto `0`. Qualquer número acima disso é coisa nova desta rodada e tem que ser corrigido antes de fechar.

**Atenção ao `z-[N]`:** `StepOpportunitiesRail` usa `z-10` (classe da escala, não `z-[N]` avulso) — isso passa. Se você precisar de outro degrau, use `--z-index-*`.

- [ ] **Step 5: Piso de acessibilidade**

- Foco visível em claro **e** escuro, inclusive sobre `card` e sobre a coluna.
- `aria-label` em todo controle só de ícone: botão de dobrar a faixa, `⋮`, botões do rail, big numbers clicáveis (`Ver a aba PageSpeed`).
- Coluna recolhida com `inert`, nunca `aria-hidden`.
- `prefers-reduced-motion` respeitado nas barras, no sublinhado das abas, nos colapsos e na transição da coluna.
- Contraste 4,5:1 nos chips de evidência sobre `bg-accent` e nos tons `warning`/`success` sobre fundo `/10`. `destructive` continua sem lavagem — ele reprova com qualquer alfa.
- A página nunca rola na horizontal; conteúdo largo rola no próprio contêiner.

- [ ] **Step 6: Comparação lado a lado**

Em 1440×900, abra a etapa Perfil no Google e depois a Website. A altura da faixa, a barra de abas e a largura da coluna têm que ser as mesmas. Diferença aqui é bug de composição, não escolha de design.

- [ ] **Step 7: Autocrítica**

Escreva duas linhas: **o que você cortou e por quê.** Se não cortou nada, você não terminou — olhe de novo e tire um acessório.

- [ ] **Step 8: Parar para o commit**

```
feat(website): modo reunião, skeleton e ajustes responsivos da etapa
```

---

## Cobertura da spec

| Seção da spec | Tarefa |
| --- | --- |
| Diagnóstico | — (motivação) |
| Árvore de componentes | 7, 8, 9 |
| `useWebsiteController` | 7 |
| Estado novo | 8, 9, 10, 12 |
| `LeadStepShell` | 1, 2, 3 |
| Temas e contagem | 4 |
| Cabeçalho fixo | 8 |
| Painel Auditoria | 5, 10 |
| Painel PageSpeed | 11 |
| Painel Validação visual | 12 |
| Painel Autoridade externa | 13 |
| Coluna de oportunidades | 3, 9 |
| Bloco do analista | 9 |
| Notas — caminho de escrita | 6 |
| Colapso, atalho e modo reunião | 2, 9, 14 |
| Acessibilidade | 14 (e checks por tarefa) |
| Responsivo | 14 |
| Loading | 14 |
| Cópia | 8, 9, 10 |
| Verificação | 14 |

**Uma redução deliberada em relação à spec.** A spec previa `Definir como principal` e `Adicionar site` no menu `⋮`. Não existem server actions para essas duas operações em canal de site — só para perfil do GBP —, e criá-las é trabalho de domínio, não de UI. O menu nasce com `Atualizar backlinks` e cresce quando as ações existirem. Registrado aqui para não parecer esquecimento.
