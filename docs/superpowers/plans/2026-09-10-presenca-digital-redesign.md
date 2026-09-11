# Redesign da etapa Presença digital — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar a etapa Presença digital da aba Oportunidade para o mesmo shell de Perfil no Google e Website — cabeçalho fixo com identidade e quatro big numbers, duas abas internas, coluna de oportunidades colapsável com bloco do analista —, repaginando os cards de rede, trocando os dois controles nativos por primitives e extraindo um `DatePicker` de data civil.

**Architecture:** O grid do `LeadGbpPanel` continua hospedando as cinco etapas; a divisão `central | oportunidades` nasce dentro do ramo `digital-presence`, como já nasce nos ramos `website` e `google-profile`. Estado e persistência saem de `LeadDigitalPresencePanel.tsx` para um controller. O alinhamento de cada rede com o site deixa de ser um card separado e passa a ser um chip no card daquela rede, servido pelo mesmo conjunto de gaps que alimenta a coluna de oportunidades — chip e achado não podem divergir porque são a mesma função.

**Tech Stack:** Next.js 16.3.1, React 19.2.8, shadcn base-mira sobre Base UI, Tailwind v4, `motion` 13, `react-icons/ri`, Supabase, Zod 4.

**Spec:** `docs/superpowers/specs/2026-09-10-presenca-digital-redesign-design.md`

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
- **Ausência é `—`, nunca zero.** Uma rede sem data não é uma rede parada.
- **Estado nunca só por cor** — sempre com texto, ícone ou forma junto.
- **Sentence case** em botão, rótulo, título e aba.
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

O `DatePicker` da Tarefa 1 **não pode** levar "base-ui direto" a 3. Ele compõe `components/ui/popover`.

**Grep próprio desta rodada**, que precisa fechar em 0 na Tarefa 9 (hoje devolve 2, ambas em `LeadDigitalPresenceNetworks.tsx`):

```bash
grep -rnE 'type="(date|checkbox)"' --include=*.tsx components/custom app | wc -l
```

**Não há teste automatizado de UI neste repo.** `pnpm test` é `node --test "lib/**/*.test.mjs"` e o único arquivo existente lê fontes como texto — módulos de `lib/leads` importam pelo alias `@/`, que o Node não resolve. O portão desta rodada é `tsc --noEmit`, `pnpm lint` e os greps. Onde este plano diz "rode e confirme que falha", **o que falha é a compilação**, e isso é proposital: o campo novo no review quebra todo literal que não o carrega, e é assim que nenhum caminho de serialização passa despercebido.

**Verificação visual é do usuário.** Ele valida na sessão que já tem aberta. Nenhuma tarefa deste plano pede login, abre navegador ou inicia servidor.

---

## Estrutura de arquivos

**Criados**

| Arquivo | Responsabilidade |
| --- | --- |
| `components/custom/DatePicker/DatePicker.types.ts` | contrato do picker de data civil |
| `components/custom/DatePicker/DatePicker.tsx` | gatilho de 28px, popover com `Calendar`, rodapé "Hoje", limpar |
| `components/custom/DatePicker/index.ts` | reexporta |
| `lib/leads/digital-presence-step-tabs.ts` | `DIGITAL_PRESENCE_STEP_TABS`, `DigitalPresenceStepTabId` |
| `components/custom/LeadDigitalPresencePanel/use-digital-presence-controller.ts` | estado, persistência e derivados da etapa |
| `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceView.tsx` | shell: grid, `Tabs`, painéis, rail |
| `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceHeader.tsx` | cabeçalho fixo: título, identidade, números, avisos, abas |
| `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceIdentityCell.tsx` | célula de identidade com a constelação de redes |
| `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceMetricCells.tsx` | os quatro big numbers |
| `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceAnalystBlock.tsx` | notas da etapa e achado de marca |
| `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceTabPanels.tsx` | composição de cada aba |
| `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceNetworkCard.tsx` | card de uma rede social |
| `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceSiteCards.tsx` | rastreamento, redes no site e identidade visual |

**Modificados**

| Arquivo | Mudança |
| --- | --- |
| `lib/leads/digital-presence-review.ts` | campo `notes`, `DIGITAL_PRESENCE_NOTES_MAX` |
| `lib/validations/lead-digital-presence.ts` | limite de `notes` |
| `lib/leads/digital-presence.ts` | `DigitalPresenceTone`, `socialPostingAge` |
| `lib/leads/digital-presence-opportunities.ts` | `digitalPresenceOpportunityTheme`, `digitalPresenceOpportunitiesByTheme` |
| `lib/leads/digital-presence-presenters.ts` | `digitalPresenceNetworkStates`, `digitalPresenceSiteLinks`, `digitalPresenceTally`; sai `digitalPresenceCheckSections` |
| `components/custom/LeadDigitalPresencePanel/LeadDigitalPresencePanel.tsx` | encolhe para vazios e composição |
| `components/custom/LeadDigitalPresencePanel/LeadDigitalPresencePanel.types.ts` | `readingMode` |
| `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceStepHeader.tsx` | `updatedAt`, `readingMode`, chip de salvo |
| `components/custom/LeadGbpPanel/LeadGbpPanel.tsx` | `fullBleed` inclui `digital-presence`; `readingMode` desce |
| `.claude/skills/suite-frontend/references/components.md` | catálogo do `DatePicker` e do shell da etapa |
| `.claude/skills/suite-frontend/references/layout.md` | a etapa entra na lista do arquétipo "painel de trabalho" |

**Removidos**

| Arquivo | Motivo |
| --- | --- |
| `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceChecks.tsx` | virou `LeadDigitalPresenceSiteCards` |
| `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceNetworks.tsx` | virou `LeadDigitalPresenceNetworkCard` |
| `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceIdentity.tsx` | virou o bloco de marca em `LeadDigitalPresenceSiteCards` |

---

## Tarefa 1: `DatePicker` de data civil

Componente isolado, sem dependência de nenhuma outra tarefa. Vem primeiro porque a Tarefa 7 depende dele existir.

**Files:**
- Create: `components/custom/DatePicker/DatePicker.types.ts`
- Create: `components/custom/DatePicker/DatePicker.tsx`
- Create: `components/custom/DatePicker/index.ts`

**Interfaces:**
- Consumes: `Calendar` de `@/components/ui/calendar`; `Popover`, `PopoverContent`, `PopoverTrigger` de `@/components/ui/popover`; `formatDateOnly`, `isCivilDate`, `todayCivilDate`, `civilDateToCalendarDate`, `calendarDateToCivilDate` de `@/lib/date-time`.
- Produces: `DatePicker(props: DatePickerProps)` e `type DatePickerProps`, exportados de `@/components/custom/DatePicker`.

- [ ] **Step 1: Criar o contrato**

`components/custom/DatePicker/DatePicker.types.ts`:

```ts
export type DatePickerProps = {
  id: string
  /** Data civil `YYYY-MM-DD`, ou `""` para vazio. */
  value?: string
  onValueChange?: (value: string) => void
  label?: string
  placeholder?: string
  error?: string
  disabled?: boolean
  clearable?: boolean
  /** Limites em data civil. Comparação de string basta: ISO ordena. */
  min?: string
  max?: string
  className?: string
  onBlur?: () => void
}
```

- [ ] **Step 2: Escrever o componente**

`components/custom/DatePicker/DatePicker.tsx`:

```tsx
"use client"

import { useState, type MouseEvent } from "react"
import { RiCalendarLine, RiCloseLine } from "react-icons/ri"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "cn"
import {
  calendarDateToCivilDate,
  civilDateToCalendarDate,
  formatDateOnly,
  isCivilDate,
  todayCivilDate,
} from "@/lib/date-time"
import type { DatePickerProps } from "./DatePicker.types"

/**
 * Data civil, sem horário. O `DateTimePicker` não serve onde a grandeza é uma
 * só: ele obriga a inventar um horário que ninguém sabe, e paga por isso com
 * dois chips e uma máquina de dois passos.
 *
 * Compõe o `Popover` de `components/ui`, e não o do pacote Base UI direto — o
 * `DateTimePicker` importa do pacote e é um dos dois itens do baseline de
 * `checks.md`; este aqui não sobe esse número.
 *
 * O nome do pacote não aparece escrito aqui de propósito: o check é um `grep`
 * textual, e um comentário que cite a string faz a contagem acusar um import
 * que não existe.
 */
export function DatePicker({
  id,
  value,
  onValueChange,
  label,
  placeholder,
  error,
  disabled,
  clearable = false,
  min,
  max,
  className,
  onBlur,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)

  const errorId = `${id}-error`
  const hasValue = Boolean(value && isCivilDate(value))
  const displayValue = hasValue && value ? formatDateOnly(value) : ""
  const today = todayCivilDate()
  const todayDisabled = Boolean((min && today < min) || (max && today > max))

  function outOfRange(civilDate: string): boolean {
    if (!civilDate) return true
    return Boolean((min && civilDate < min) || (max && civilDate > max))
  }

  /** Escolher o dia é a decisão inteira: commita e fecha. */
  function select(civilDate: string) {
    if (!isCivilDate(civilDate) || outOfRange(civilDate)) return
    onValueChange?.(civilDate)
    setOpen(false)
  }

  function handleClear(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    onValueChange?.("")
  }

  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      {label ? (
        <label
          htmlFor={id}
          className={cn(
            "text-xs/relaxed font-medium text-muted-foreground",
            disabled ? "opacity-50" : "cursor-pointer",
            error && "text-destructive",
          )}
        >
          {label}
        </label>
      ) : null}

      {/*
        O limpar é irmão do gatilho, não filho: botão dentro de botão é HTML
        inválido, e foi por isso que o `DateTimePicker` precisou de
        `nativeButton={false} render={<div />}`. Com o irmão em absoluto, o
        gatilho continua sendo um `button` de verdade — e o `htmlFor` do rótulo
        volta a funcionar sozinho.
      */}
      <div className="relative">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            id={id}
            disabled={disabled}
            onBlur={onBlur}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(
              "flex h-7 w-full cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 shadow-xs",
              "text-xs/relaxed text-foreground outline-none",
              "transition-[background-color,border-color,color,opacity,scale] duration-150 ease-out",
              "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
              "data-popup-open:border-ring data-popup-open:ring-2 data-popup-open:ring-ring/30",
              "scale-100 active:scale-[0.97] data-pressed:scale-[0.97]",
              "disabled:pointer-events-none disabled:opacity-50",
              clearable && hasValue && !disabled && "pr-8",
              error &&
                "border-destructive focus-visible:border-destructive data-popup-open:border-destructive",
            )}
          >
            <span
              aria-hidden
              className="inline-flex shrink-0 text-muted-foreground"
            >
              <RiCalendarLine size={16} />
            </span>
            <span className="flex min-w-0 flex-1 items-center overflow-hidden">
              {hasValue ? (
                <span className="truncate tabular-nums">{displayValue}</span>
              ) : (
                <span className="truncate text-muted-foreground">
                  {placeholder ?? ""}
                </span>
              )}
            </span>
          </PopoverTrigger>

          <PopoverContent
            align="start"
            className="w-[18.5rem] max-w-[var(--available-width)] gap-0"
          >
            <Calendar
              mode="single"
              selected={civilDateToCalendarDate(value ?? "")}
              onSelect={(date) => {
                const civilDate = calendarDateToCivilDate(date)
                if (civilDate) select(civilDate)
              }}
              disabled={(date) => outOfRange(calendarDateToCivilDate(date))}
              autoFocus
            />
            <div className="mt-2 border-t border-border/70 pt-2">
              <button
                type="button"
                disabled={todayDisabled}
                onClick={() => select(today)}
                className={cn(
                  "h-8 w-full cursor-pointer rounded-md text-xs/relaxed font-medium text-primary",
                  "scale-100 transition-[background-color,transform,opacity,scale] duration-150 ease-out",
                  "active:scale-[0.97]",
                  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                  "disabled:pointer-events-none disabled:opacity-50",
                  "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent",
                )}
              >
                Hoje
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {clearable && hasValue && !disabled ? (
          <button
            type="button"
            aria-label="Limpar data"
            onClick={handleClear}
            className="absolute inset-y-0 right-1.5 inline-flex size-7 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          >
            <RiCloseLine size={16} aria-hidden />
          </button>
        ) : null}
      </div>

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-xs/relaxed text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 3: Criar o barrel**

`components/custom/DatePicker/index.ts`:

```ts
export { DatePicker } from "./DatePicker"
export type { DatePickerProps } from "./DatePicker.types"
```

- [ ] **Step 4: Rodar os portões**

```bash
cd "C:/Users/Eduardo Zamai/Documents/suite"
pnpm exec tsc --noEmit
pnpm lint
echo -n "base-ui direto: "; grep -rn "@base-ui/react" --include=*.tsx components/custom app | wc -l
```

Esperado: `tsc` sem saída, `lint` com zero errors, **base-ui direto = 2** (os dois do baseline). Se der 3, o `DatePicker` está importando do pacote em vez do primitive local — corrija antes de seguir.

- [ ] **Step 5: Parar e sugerir o commit**

```
feat(ui): DatePicker de data civil sobre o Popover local
```

---

## Tarefa 2: campo `notes` no review, de ponta a ponta

O `review` é `jsonb`. **Nenhuma migração.** O portão desta tarefa é o `tsc` reprovando todo literal de `DigitalPresenceReview` que não carregue o campo novo.

**Files:**
- Modify: `lib/leads/digital-presence-review.ts`
- Modify: `lib/validations/lead-digital-presence.ts`

**Interfaces:**
- Produces: `DIGITAL_PRESENCE_NOTES_MAX = 2000`; `DigitalPresenceReview` com `notes: string`. Todas as funções existentes (`emptyDigitalPresenceReview`, `readDigitalPresenceReview`, `digitalPresenceReviewDraft`, `serializeDigitalPresenceReviewDraft`, `stampDigitalPresenceReview`, `pruneDigitalPresenceNetworks`) mantêm nome e assinatura e passam a carregar `notes`.

- [ ] **Step 1: Adicionar o limite e o campo ao tipo**

Em `lib/leads/digital-presence-review.ts`, logo abaixo de `DIGITAL_PRESENCE_FOLLOWERS_MAX`:

```ts
/** Mesmo teto de GBP (`GBP_NOTES_MAX`) e Website (`WEBSITE_NOTES_MAX`). */
export const DIGITAL_PRESENCE_NOTES_MAX = 2000
```

E no tipo:

```ts
export type DigitalPresenceReview = {
  identity: DigitalPresenceIdentityAnswer
  networks: Record<string, DigitalPresenceNetworkAnswer>
  /**
   * Campo livre do analista sobre a etapa inteira. Fora de
   * `isDigitalPresenceComplete` de propósito: contexto não é resposta, e a
   * completude é o portão de `compile-lead-diagnosis.ts:168`.
   */
  notes: string
}
```

- [ ] **Step 2: Rodar o `tsc` e confirmar que ele reprova**

```bash
pnpm exec tsc --noEmit
```

Esperado: **FALHA**, com erros de `Property 'notes' is missing` em `emptyDigitalPresenceReview`, `readDigitalPresenceReview`, `digitalPresenceReviewDraft`, `stampDigitalPresenceReview` e `pruneDigitalPresenceNetworks`. Essa lista é o mapa da tarefa: cada erro é um caminho de leitura ou escrita que precisa do campo.

- [ ] **Step 3: Generalizar o leitor de texto**

`readNote` hoje corta em 400 e serve só à nota da identidade. Troque por um leitor parametrizado, mantendo `readNote` como o caso de 400:

```ts
function readText(value: unknown, max: number): string {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  return trimmed.slice(0, max)
}

function readNote(value: unknown): string {
  return readText(value, DIGITAL_PRESENCE_REVIEW_NOTE_MAX)
}
```

- [ ] **Step 4: Carregar `notes` nos cinco caminhos**

`emptyDigitalPresenceReview`:

```ts
export function emptyDigitalPresenceReview(): DigitalPresenceReview {
  return {
    identity: emptyIdentity(),
    networks: {},
    notes: "",
  }
}
```

`readDigitalPresenceReview` — logo antes do `return review` final:

```ts
  review.notes = readText(row.notes, DIGITAL_PRESENCE_NOTES_MAX)

  return review
```

`digitalPresenceReviewDraft` — no objeto devolvido:

```ts
  return {
    identity: {
      verdict: review.identity.verdict,
      note: review.identity.note,
      updatedAt: null,
      updatedBy: null,
    },
    networks,
    notes: review.notes,
  }
```

`serializeDigitalPresenceReviewDraft` — no `JSON.stringify`:

```ts
  return JSON.stringify({
    identity: {
      verdict: review.identity.verdict,
      note: review.identity.note,
    },
    networks,
    notes: review.notes,
  })
```

`stampDigitalPresenceReview` — no objeto devolvido, junto de `identity` e `networks`:

```ts
    notes: review.notes,
```

`pruneDigitalPresenceNetworks` — **este é o que mais fácil passa despercebido**, porque hoje ele reconstrói o objeto com dois campos:

```ts
export function pruneDigitalPresenceNetworks(
  review: DigitalPresenceReview,
  channelIds: ReadonlyArray<string>,
): DigitalPresenceReview {
  const allowed = new Set(channelIds)
  const networks: Record<string, DigitalPresenceNetworkAnswer> = {}
  for (const [channelId, answer] of Object.entries(review.networks)) {
    if (!allowed.has(channelId)) continue
    networks[channelId] = answer
  }
  // `notes` viaja: podar rede não pode apagar o texto do analista, e esta
  // função roda em todo salvamento (`upsert-digital-presence.ts:70`).
  return { identity: review.identity, networks, notes: review.notes }
}
```

- [ ] **Step 5: Validar o limite na server action**

Em `lib/validations/lead-digital-presence.ts`, importe `DIGITAL_PRESENCE_NOTES_MAX` e acrescente um `refine` ao `reviewJsonSchema`, depois do refine da nota da identidade:

```ts
  .refine(
    (review) => review.notes.length <= DIGITAL_PRESENCE_NOTES_MAX,
    `Notas devem ter no máximo ${DIGITAL_PRESENCE_NOTES_MAX} caracteres.`,
  )
```

- [ ] **Step 6: Rodar os portões**

```bash
pnpm exec tsc --noEmit
pnpm lint
```

Esperado: ambos limpos. Se sobrar algum erro de `notes` faltando, é um caminho de escrita que o Step 4 não cobriu — trate como achado, não como ruído.

- [ ] **Step 7: Parar e sugerir o commit**

```
feat(leads): campo de notas do analista no review de presença digital
```

---

## Tarefa 3: leitura da etapa — abas, temas, estado por rede e saldo

Tudo em `lib`. Nada consome ainda; a tarefa termina compilando com o painel antigo intacto.

**Files:**
- Create: `lib/leads/digital-presence-step-tabs.ts`
- Modify: `lib/leads/digital-presence.ts`
- Modify: `lib/leads/digital-presence-opportunities.ts`
- Modify: `lib/leads/digital-presence-presenters.ts`

**Interfaces:**
- Consumes: `DIGITAL_PRESENCE_NOTES_MAX` e o tipo `DigitalPresenceReview` da Tarefa 2.
- Produces:
  - `type DigitalPresenceStepTabId = "redes" | "site"`, `DIGITAL_PRESENCE_STEP_TABS`
  - `type DigitalPresenceTone = "neutral" | "success" | "warning" | "danger"`
  - `socialPostingAge(lastPostedOn: string, today: string): SocialPostingAge` com `{ label, tone, days }`
  - `digitalPresenceOpportunityTheme(id: string): DigitalPresenceStepTabId`
  - `digitalPresenceOpportunitiesByTheme(items): Record<DigitalPresenceStepTabId, DigitalPresenceOpportunityItem[]>`
  - `digitalPresenceNetworkStates(input): DigitalPresenceNetworkState[]`
  - `digitalPresenceSiteLinks(input): DigitalPresenceSiteLink[] | null`
  - `digitalPresenceTally(input): DigitalPresenceTally`

- [ ] **Step 1: Criar as abas**

`lib/leads/digital-presence-step-tabs.ts`:

```ts
/**
 * Aba e tema são o mesmo eixo: o contador da aba é a contagem do grupo da
 * coluna. Um tipo só evita a tradução no meio do caminho.
 *
 * Duas abas, não quatro. O alinhamento de cada rede com o site vira chip no
 * card daquela rede, então "redes no site" deixa de ser uma seção própria —
 * sobra para a aba do site apenas o que não tem card: rastreamento, redes
 * encontradas sem cadastro, e o veredito de marca.
 */
export type DigitalPresenceStepTabId = "redes" | "site"

export const DIGITAL_PRESENCE_STEP_TABS: ReadonlyArray<{
  id: DigitalPresenceStepTabId
  label: string
}> = [
  { id: "redes", label: "Redes" },
  { id: "site", label: "Site e marca" },
]
```

- [ ] **Step 2: Idade da postagem com tom**

Em `lib/leads/digital-presence.ts`, acrescente o tipo de tom e a leitura completa, e reduza `socialPostingAgeLabel` a um invólucro:

```ts
export type DigitalPresenceTone = "neutral" | "success" | "warning" | "danger"

export type SocialPostingAge = {
  label: string
  tone: DigitalPresenceTone
  days: number
}

/** Metade do corte: onde a cadência começa a preocupar sem ainda ter parado. */
const SOCIAL_SLOWING_DAYS = Math.round(GBP_STALE_POSTS_DAYS / 2)

/**
 * As duas formas do mesmo dado. `label` para quem consome texto; `tone` para a
 * linha poder declarar o estado sem depender de o leitor interpretar a frase —
 * hoje "Parado há mais de 90 dias" e "Publicou hoje" saem na mesma cor.
 */
export function socialPostingAge(
  lastPostedOn: string,
  today: string,
): SocialPostingAge {
  const days = civilDateDiffDays(lastPostedOn, today)
  if (days < 0) {
    // Data no futuro é erro de digitação, não cadência: não afirma estado.
    return { label: formatCivilDate(lastPostedOn), tone: "neutral", days }
  }
  if (isSocialPostingStale(lastPostedOn, today)) {
    return {
      label: `Parado há mais de ${GBP_STALE_POSTS_DAYS} dias`,
      tone: "danger",
      days,
    }
  }
  const label =
    days === 0
      ? "Publicou hoje"
      : days === 1
        ? "Há 1 dia"
        : `Há ${days.toLocaleString("pt-BR")} dias`
  return {
    label,
    tone: days >= SOCIAL_SLOWING_DAYS ? "warning" : "success",
    days,
  }
}

export function socialPostingAgeLabel(
  lastPostedOn: string,
  today: string,
): string {
  return socialPostingAge(lastPostedOn, today).label
}
```

O corpo antigo de `socialPostingAgeLabel` sai inteiro — ele agora é a linha acima. `socialPostingAgeLabel` continua exportada porque `LeadDigitalPresenceNetworks.tsx:196` ainda a consome; ela morre na Tarefa 9, junto com o arquivo.

- [ ] **Step 3: Tema de oportunidade e agrupamento**

Em `lib/leads/digital-presence-opportunities.ts`, no topo dos imports:

```ts
import type { DigitalPresenceStepTabId } from "./digital-presence-step-tabs.ts"
```

E no fim do arquivo:

```ts
/**
 * A oportunidade mora na aba onde o analista a vê. Alinhamento e cadência têm
 * chip no card da rede, então são de `redes`; `social_on_site_unregistered` é
 * de `site` porque essa rede **não tem card** — ela só existe na lista do site.
 */
const THEME_BY_PREFIX: ReadonlyArray<
  readonly [string, DigitalPresenceStepTabId]
> = [
  ["stale_social_posts:", "redes"],
  ["social_not_linked_on_site:", "redes"],
  ["social_handle_mismatch:", "redes"],
  ["social_on_site_unregistered:", "site"],
]

export function digitalPresenceOpportunityTheme(
  id: string,
): DigitalPresenceStepTabId {
  for (const [prefix, theme] of THEME_BY_PREFIX) {
    if (id.startsWith(prefix)) return theme
  }
  // Os ids de gap são literais de template, então `tsc` não consegue exigir
  // exaustividade como faz no `Record` do Website. Cair em "site" mantém o
  // item visível na coluna em vez de sumir do agrupamento.
  return "site"
}

const EMPTY_BY_THEME = (): Record<
  DigitalPresenceStepTabId,
  DigitalPresenceOpportunityItem[]
> => ({
  redes: [],
  site: [],
})

/**
 * Reduce sobre a lista recebida: a soma dos grupos é a lista, por construção.
 * Nenhum item pode sumir entre o contador da aba e o grupo da coluna.
 */
export function digitalPresenceOpportunitiesByTheme(
  items: ReadonlyArray<DigitalPresenceOpportunityItem>,
): Record<DigitalPresenceStepTabId, DigitalPresenceOpportunityItem[]> {
  return items.reduce((acc, item) => {
    acc[digitalPresenceOpportunityTheme(item.id)].push(item)
    return acc
  }, EMPTY_BY_THEME())
}
```

- [ ] **Step 4: Estado por rede, links do site e saldo**

Em `lib/leads/digital-presence-presenters.ts`, mantenha `digitalPresenceCheckSections` onde está (ela morre na Tarefa 9) e acrescente o que vem abaixo.

O arquivo **já importa** de `./digital-channels.ts`, `./digital-presence.ts` e `./digital-presence-review.ts` — some os símbolos novos aos blocos existentes em vez de abrir um segundo `import` para o mesmo módulo.

```ts
import {
  digitalChannelDisplay,
  hrefForDigitalChannel,
} from "./digital-channels.ts"
import {
  socialPostingAge,
  type DigitalPresenceTone,
  type SocialPostingAge,
} from "./digital-presence.ts"
import type { DigitalPresenceNetworkAnswer } from "./digital-presence-review.ts"
import { emptyNetworkAnswer } from "./digital-presence-review.ts"

export type DigitalPresenceAlignment =
  | "aligned"
  | "not_on_site"
  | "mismatch"
  | "unregistered"
  | "unknown"

export const DIGITAL_PRESENCE_ALIGNMENT_LABEL: Record<
  DigitalPresenceAlignment,
  string
> = {
  aligned: "Alinhado ao site",
  not_on_site: "Sem link no site",
  mismatch: "Handle diferente do site",
  unregistered: "No site, sem cadastro",
  unknown: "Sem coleta do site",
}

export const DIGITAL_PRESENCE_ALIGNMENT_TONE: Record<
  DigitalPresenceAlignment,
  DigitalPresenceTone
> = {
  aligned: "success",
  not_on_site: "warning",
  mismatch: "warning",
  unregistered: "warning",
  unknown: "neutral",
}

export type DigitalPresenceNetworkState = {
  channelId: string
  type: SocialChannelType
  label: string
  /** Handle legível, já normalizado pelo `digitalChannelDisplay`. */
  display: string
  href: string | null
  isPrimary: boolean
  answer: DigitalPresenceNetworkAnswer
  alignment: DigitalPresenceAlignment
  /** `null` quando não há data — não medido não é "publicou hoje". */
  age: SocialPostingAge | null
  /** Tom da **superfície do card**: só neutro ou atenção. */
  tone: "neutral" | "warning"
}

/**
 * Um estado por rede cadastrada, servido pelo mesmo conjunto de gaps que
 * alimenta a coluna de oportunidades. Chip do card e achado da coluna não
 * podem divergir porque saem da mesma função.
 */
export function digitalPresenceNetworkStates(input: {
  signals: WebsiteCrawlSignals | null
  channels: ReadonlyArray<LeadDigitalChannel>
  review: DigitalPresenceReview
  today: string
}): DigitalPresenceNetworkState[] {
  const gaps = gapSet(digitalPresenceGapsForAudit(input))
  return socialChannelsFromLead(input.channels)
    .filter((channel): channel is LeadDigitalChannel & { id: string } =>
      typeof channel.id === "string",
    )
    .map((channel) => {
      const type = channel.type as SocialChannelType
      const answer = input.review.networks[channel.id] ?? emptyNetworkAnswer()

      let alignment: DigitalPresenceAlignment = "unknown"
      if (input.signals) {
        if (gaps.has(`social_not_linked_on_site:${type}`)) {
          alignment = "not_on_site"
        } else if (gaps.has(`social_handle_mismatch:${type}`)) {
          alignment = "mismatch"
        } else {
          alignment = "aligned"
        }
      }

      const age =
        !answer.unavailable && answer.lastPostedOn
          ? socialPostingAge(answer.lastPostedOn, input.today)
          : null

      const tone: "neutral" | "warning" =
        answer.unavailable
          ? "neutral"
          : age?.tone === "danger" ||
              alignment === "not_on_site" ||
              alignment === "mismatch"
            ? "warning"
            : "neutral"

      return {
        channelId: channel.id,
        type,
        label: DIGITAL_CHANNEL_LABELS[type],
        display: digitalChannelDisplay(channel.type, channel.value),
        href: hrefForDigitalChannel(channel.type, channel.value),
        isPrimary: channel.is_primary,
        answer,
        alignment,
        age,
        tone,
      }
    })
}

export type DigitalPresenceSiteLink = {
  type: SocialChannelType
  label: string
  href: string | null
  alignment: DigitalPresenceAlignment
}

/**
 * `null` quando não há coleta — a aba inteira vira um vazio, e é assim que a
 * ressalva sai do rodapé da página e passa a ser o conteúdo dela.
 */
export function digitalPresenceSiteLinks(input: {
  signals: WebsiteCrawlSignals | null
  channels: ReadonlyArray<LeadDigitalChannel>
  review: DigitalPresenceReview
  today: string
}): DigitalPresenceSiteLink[] | null {
  const signals = input.signals
  if (!signals) return null
  const gaps = gapSet(digitalPresenceGapsForAudit(input))
  const registered = new Set(
    socialChannelsFromLead(input.channels).map(
      (channel) => channel.type as SocialChannelType,
    ),
  )

  const rows: DigitalPresenceSiteLink[] = []
  for (const type of SOCIAL_CHANNEL_TYPES) {
    const onSite = hasSocialSignal(signals, type)
    if (!onSite && !registered.has(type)) continue

    let alignment: DigitalPresenceAlignment = "aligned"
    if (gaps.has(`social_on_site_unregistered:${type}`)) {
      alignment = "unregistered"
    } else if (gaps.has(`social_handle_mismatch:${type}`)) {
      alignment = "mismatch"
    } else if (gaps.has(`social_not_linked_on_site:${type}`)) {
      alignment = "not_on_site"
    }

    rows.push({
      type,
      label: DIGITAL_CHANNEL_LABELS[type],
      href: signals.socialUrls[type],
      alignment,
    })
  }
  return rows
}

export type DigitalPresenceTally = {
  networks: {
    total: number
    /** Com data e acessível. Uma rede sem data não entra em denominador. */
    measured: number
    active: number
    aligned: number
  }
  followers: { sum: number; measured: number }
  /** `null` sem coleta do site — nunca `{ total: 2, ok: 0 }`. */
  tracking: { total: number; ok: number } | null
  /** `false` sem coleta: alinhamento é desconhecido, não é zero. */
  alignmentKnown: boolean
}

export function digitalPresenceTally(input: {
  signals: WebsiteCrawlSignals | null
  channels: ReadonlyArray<LeadDigitalChannel>
  review: DigitalPresenceReview
  today: string
}): DigitalPresenceTally {
  const states = digitalPresenceNetworkStates(input)
  const measured = states.filter((state) => state.age !== null)
  const withFollowers = states.filter(
    (state) => !state.answer.unavailable && state.answer.followers !== null,
  )
  const signals = input.signals

  return {
    networks: {
      total: states.length,
      measured: measured.length,
      active: measured.filter((state) => state.age?.tone !== "danger").length,
      aligned: states.filter((state) => state.alignment === "aligned").length,
    },
    followers: {
      sum: withFollowers.reduce(
        (total, state) => total + (state.answer.followers ?? 0),
        0,
      ),
      measured: withFollowers.length,
    },
    tracking: signals
      ? {
          total: 2,
          ok:
            (signals.hasGtm || signals.hasGtag ? 1 : 0) +
            (signals.hasFacebookPixel ? 1 : 0),
        }
      : null,
    alignmentKnown: signals !== null,
  }
}
```

- [ ] **Step 5: Rodar os portões**

```bash
pnpm exec tsc --noEmit
pnpm lint
```

Esperado: ambos limpos. `digitalPresenceCheckSections` continua exportada e consumida — não a remova nesta tarefa.

- [ ] **Step 6: Parar e sugerir o commit**

```
feat(leads): leitura de presença digital por rede, tema de aba e saldo da etapa
```

---

## Tarefa 4: `useDigitalPresenceController`

Move o que não é layout para fora do componente. Nesta tarefa o controller ainda não é consumido: ele existe, compila, e a Tarefa 5 o liga.

**Files:**
- Create: `components/custom/LeadDigitalPresencePanel/use-digital-presence-controller.ts`

**Interfaces:**
- Consumes: tudo o que a Tarefa 3 produziu, mais `upsertLeadDigitalPresence` de `@/app/actions/leads`.
- Produces: `useDigitalPresenceController(props: LeadDigitalPresencePanelProps): DigitalPresenceController`.

- [ ] **Step 1: Escrever o controller**

`components/custom/LeadDigitalPresencePanel/use-digital-presence-controller.ts`:

```ts
"use client"

import { useEffect, useRef, useState } from "react"
import {
  upsertLeadDigitalPresence,
  type LeadDigitalPresenceAudit,
} from "@/app/actions/leads"
import { todayCivilDate } from "@/lib/date-time"
import {
  digitalPresenceReviewForChannels,
  socialChannelsFromLead,
} from "@/lib/leads/digital-presence"
import {
  digitalPresenceOpportunitiesByTheme,
  mergeDigitalPresenceOpportunities,
} from "@/lib/leads/digital-presence-opportunities"
import {
  digitalPresenceNetworkStates,
  digitalPresenceSiteLinks,
  digitalPresenceTally,
} from "@/lib/leads/digital-presence-presenters"
import {
  digitalPresenceReviewDraft,
  emptyDigitalPresenceReview,
  serializeDigitalPresenceReviewDraft,
  type DigitalPresenceReview,
} from "@/lib/leads/digital-presence-review"
import type { DigitalPresenceStepTabId } from "@/lib/leads/digital-presence-step-tabs"
import type { LeadDigitalPresencePanelProps } from "./LeadDigitalPresencePanel.types"

const REVIEW_DEBOUNCE_MS = 800

export type DigitalPresenceSaveStatus = "idle" | "saving" | "saved" | "error"

export type DigitalPresenceController = ReturnType<
  typeof useDigitalPresenceController
>

export function useDigitalPresenceController({
  detail,
  canEdit,
  onAuditChange,
  onPendingChange,
}: LeadDigitalPresencePanelProps) {
  const today = todayCivilDate()
  const stored = detail.digitalPresenceAudit
  const [saveStatus, setSaveStatus] = useState<DigitalPresenceSaveStatus>("idle")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [liveReview, setLiveReview] = useState<DigitalPresenceReview>(() =>
    digitalPresenceReviewForChannels(
      stored?.review ?? emptyDigitalPresenceReview(),
      detail.lead.channels,
    ),
  )
  const reviewRef = useRef(liveReview)
  const reviewTimerRef = useRef(0)
  const auditRef = useRef<LeadDigitalPresenceAudit | null>(stored ?? null)
  const onAuditChangeRef = useRef(onAuditChange)
  // Ref de "valor mais recente": a escrita vai para um efeito, nunca no render.
  useEffect(() => {
    onAuditChangeRef.current = onAuditChange
  })

  // Reset ligado à mudança de chave: no render, não em efeito.
  const presenceKey = `${detail.lead.id}|${detail.digitalPresenceAudit?.id ?? ""}`
  const [syncedPresenceKey, setSyncedPresenceKey] = useState(presenceKey)
  if (syncedPresenceKey !== presenceKey) {
    setSyncedPresenceKey(presenceKey)
    setLiveReview(
      digitalPresenceReviewForChannels(
        detail.digitalPresenceAudit?.review ?? emptyDigitalPresenceReview(),
        detail.lead.channels,
      ),
    )
    setSaveStatus("idle")
    setSaveError(null)
  }

  useEffect(() => {
    reviewRef.current = digitalPresenceReviewForChannels(
      detail.digitalPresenceAudit?.review ?? emptyDigitalPresenceReview(),
      detail.lead.channels,
    )
    auditRef.current = detail.digitalPresenceAudit
    window.clearTimeout(reviewTimerRef.current)
  }, [detail.lead.channels, detail.digitalPresenceAudit])

  useEffect(() => {
    return () => window.clearTimeout(reviewTimerRef.current)
  }, [])

  // A etapa lê o crawl do site principal; sem ele, metade da leitura é
  // desconhecida — e "desconhecida" nunca é desenhada como zero.
  const websiteAudit =
    detail.websiteAudits.find((item) => {
      const primary = detail.lead.channels.find(
        (channel) => channel.type === "website" && channel.is_primary,
      )
      return primary ? item.channel_id === primary.id : false
    }) ??
    detail.websiteAudits[0] ??
    null

  const signals = websiteAudit?.crawl.signals ?? null
  const review = liveReview
  const derivedInput = {
    signals,
    channels: detail.lead.channels,
    review,
    today,
  }

  const opportunities = mergeDigitalPresenceOpportunities(derivedInput)
  const grouped = digitalPresenceOpportunitiesByTheme(opportunities)
  const counts: Record<DigitalPresenceStepTabId, number> = {
    redes: grouped.redes.length,
    site: grouped.site.length,
  }

  async function persistReview(draft: DigitalPresenceReview): Promise<boolean> {
    setSaveStatus("saving")
    setSaveError(null)
    onPendingChange(true)
    const formData = new FormData()
    formData.set("lead_id", detail.lead.id)
    formData.set("review", serializeDigitalPresenceReviewDraft(draft))
    const result = await upsertLeadDigitalPresence(formData)
    onPendingChange(false)
    if (result.status === "error") {
      setSaveStatus("error")
      setSaveError(result.message)
      return false
    }
    auditRef.current = result.audit
    onAuditChangeRef.current(result.audit)
    setLiveReview(digitalPresenceReviewDraft(result.audit.review))
    reviewRef.current = digitalPresenceReviewDraft(result.audit.review)
    setSaveStatus("saved")
    return true
  }

  function handleReviewChange(next: DigitalPresenceReview) {
    const draft = digitalPresenceReviewDraft(next)
    reviewRef.current = draft
    setLiveReview(draft)
    window.clearTimeout(reviewTimerRef.current)
    if (!canEdit) return
    const baseline = digitalPresenceReviewDraft(
      auditRef.current?.review ?? emptyDigitalPresenceReview(),
    )
    if (
      serializeDigitalPresenceReviewDraft(draft) ===
      serializeDigitalPresenceReviewDraft(baseline)
    ) {
      return
    }
    reviewTimerRef.current = window.setTimeout(() => {
      const current = reviewRef.current
      if (!current) return
      void persistReview(current)
    }, REVIEW_DEBOUNCE_MS)
  }

  return {
    leadId: detail.lead.id,
    companyName: detail.lead.company_name,
    today,
    canEdit,
    review,
    saveStatus,
    saveError,
    signals,
    hasCollect: signals !== null,
    collectedAt: websiteAudit?.fetched_at ?? null,
    updatedAt: detail.digitalPresenceAudit?.updated_at ?? null,
    /** Chave de re-sincronização dos campos com rascunho local. */
    syncKey: detail.digitalPresenceAudit?.id ?? detail.lead.id,
    channels: socialChannelsFromLead(detail.lead.channels),
    networkStates: digitalPresenceNetworkStates(derivedInput),
    siteLinks: digitalPresenceSiteLinks(derivedInput),
    tally: digitalPresenceTally(derivedInput),
    opportunities,
    grouped,
    counts,
    handleReviewChange,
    handleNotesDraftChange: (notes: string) =>
      handleReviewChange({ ...review, notes }),
    retrySave: () => {
      void persistReview(reviewRef.current)
    },
  }
}
```

- [ ] **Step 2: Rodar os portões**

```bash
pnpm exec tsc --noEmit
pnpm lint
```

Esperado: ambos limpos. O `lint` pode acusar o controller como não usado — ignore; a Tarefa 5 o consome. Se acusar como **erro**, não como warning, pare e reporte.

- [ ] **Step 3: Parar e sugerir o commit**

```
refactor(leads): controller da etapa de presença digital
```

---

## Tarefa 5: shell — view, cabeçalho fixo, identidade, big numbers e abas

A tarefa que muda a tela. As abas ainda renderizam os componentes antigos; as Tarefas 7 e 8 os substituem.

**Files:**
- Create: `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceIdentityCell.tsx`
- Create: `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceMetricCells.tsx`
- Create: `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceHeader.tsx`
- Create: `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceView.tsx`
- Modify: `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceStepHeader.tsx`
- Modify: `components/custom/LeadDigitalPresencePanel/LeadDigitalPresencePanel.tsx`
- Modify: `components/custom/LeadDigitalPresencePanel/LeadDigitalPresencePanel.types.ts`
- Modify: `components/custom/LeadGbpPanel/LeadGbpPanel.tsx:427` e o ramo `digital-presence` em `:567`

**Interfaces:**
- Consumes: `DigitalPresenceController` da Tarefa 4; `StepTabs`, `StepStat`, `StepMeter`, `stepShareTone`, `useWideViewport`, `useCollapsibleRail` de `@/components/custom/LeadStepShell`.
- Produces: `LeadDigitalPresenceView`, `LeadDigitalPresenceHeader`, `LeadDigitalPresenceIdentityCell`, `LeadDigitalPresenceMetricCells`.

- [ ] **Step 1: `readingMode` no contrato do painel**

`LeadDigitalPresencePanel.types.ts`:

```ts
export type LeadDigitalPresencePanelProps = {
  detail: LeadDetail
  canEdit: boolean
  /** Modo reunião: esconde edição. Nunca habilita nada. */
  readingMode?: boolean
  onAuditChange: (audit: LeadDigitalPresenceAudit) => void
  onPendingChange: (pending: boolean) => void
}
```

- [ ] **Step 2: Célula de identidade com a constelação de redes**

`components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceIdentityCell.tsx`:

```tsx
"use client"

import { RiGroupLine } from "react-icons/ri"
import { Badge } from "@/components/ui/badge"
import { cn } from "cn"
import { formatRelativeShort } from "@/lib/date-time"
import { CHANNEL_ICONS } from "@/lib/leads/digital-channel-icons"
import {
  DIGITAL_PRESENCE_ALIGNMENT_LABEL,
  type DigitalPresenceAlignment,
} from "@/lib/leads/digital-presence-presenters"
import { DIGITAL_PRESENCE_IDENTITY_VERDICT_LABEL } from "@/lib/leads/digital-presence-review"
import type { DigitalPresenceController } from "./use-digital-presence-controller"

/**
 * A constelação é o retrato da etapa: uma fileira de glifos que diz, de
 * relance, quantas redes existem e em que estado cada uma está. Hoje esse
 * mesmo retrato exige ler oito cards.
 *
 * O estado nunca é só cor: cada glifo carrega `title` e nome acessível.
 */
const GLYPH: Record<DigitalPresenceAlignment, string> = {
  aligned: "bg-primary/10 text-primary",
  not_on_site: "bg-warning/10 text-warning",
  mismatch: "bg-warning/10 text-warning",
  unregistered: "border border-dashed border-border text-muted-foreground",
  unknown: "bg-accent text-muted-foreground",
}

export function LeadDigitalPresenceIdentityCell({
  controller,
}: {
  controller: DigitalPresenceController
}) {
  const { companyName, networkStates, hasCollect, collectedAt, review } =
    controller
  const verdict = review.identity.verdict

  return (
    <div className="flex min-w-0 flex-col justify-center gap-2 rounded-lg bg-accent/60 px-3 py-2.5 ring-1 ring-foreground/[0.06]">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          <RiGroupLine size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs/[1.5] font-semibold text-foreground">
            {companyName}
          </p>
          <p className="truncate text-xs/[1.5] text-muted-foreground">
            {hasCollect && collectedAt
              ? `Coleta do site ${formatRelativeShort(collectedAt)}`
              : "Sem coleta do site"}
          </p>
        </div>
      </div>

      {networkStates.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-1">
          {networkStates.map((state) => {
            const Icon = CHANNEL_ICONS[state.type]
            const title = `${state.label} · ${
              state.answer.unavailable
                ? "Perfil inacessível"
                : DIGITAL_PRESENCE_ALIGNMENT_LABEL[state.alignment]
            }`
            return (
              <li key={state.channelId}>
                <span
                  title={title}
                  aria-label={title}
                  role="img"
                  className={cn(
                    "inline-flex size-7 items-center justify-center rounded-lg",
                    state.answer.unavailable
                      ? "bg-accent text-muted-foreground/60"
                      : GLYPH[state.alignment],
                  )}
                >
                  <Icon size={15} aria-hidden />
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-xs/[1.5] text-muted-foreground">
          Nenhuma rede cadastrada
        </p>
      )}

      {verdict ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={verdict === "ok" ? "success" : "warning"}>
            Identidade: {DIGITAL_PRESENCE_IDENTITY_VERDICT_LABEL[verdict]}
          </Badge>
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 3: Os quatro big numbers**

`components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceMetricCells.tsx`:

```tsx
"use client"

import {
  RiBarChartBoxLine,
  RiCodeSSlashLine,
  RiLinksLine,
  RiUserFollowLine,
} from "react-icons/ri"
import type { IconType } from "react-icons"
import {
  StepMeter,
  StepStat,
  stepShareTone,
  type StepTone,
} from "@/components/custom/LeadStepShell"
import {
  DIGITAL_PRESENCE_STEP_TABS,
  type DigitalPresenceStepTabId,
} from "@/lib/leads/digital-presence-step-tabs"
import type { DigitalPresenceController } from "./use-digital-presence-controller"

const TAB_LABEL: Record<DigitalPresenceStepTabId, string> = Object.fromEntries(
  DIGITAL_PRESENCE_STEP_TABS.map((item) => [item.id, item.label]),
) as Record<DigitalPresenceStepTabId, string>

function Cell({
  tab,
  onSelectTab,
  icon,
  label,
  value,
  unit,
  tone = "neutral",
  share,
}: {
  tab: DigitalPresenceStepTabId
  onSelectTab: (tab: DigitalPresenceStepTabId) => void
  icon: IconType
  label: string
  value: string
  unit: string
  tone?: StepTone
  /** `null` quando não há escala contra a qual medir — aí a trilha não entra. */
  share: number | null
}) {
  return (
    <button
      type="button"
      onClick={() => onSelectTab(tab)}
      aria-label={`Ver a aba ${TAB_LABEL[tab]}`}
      className="min-w-0 cursor-pointer rounded-lg text-left transition-opacity duration-150 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <StepStat icon={icon} label={label} value={value} unit={unit} tone={tone}>
        {share === null ? null : (
          <StepMeter share={share} tone={tone} className="mt-2" />
        )}
      </StepStat>
    </button>
  )
}

const count = (value: number) => value.toLocaleString("pt-BR")

export function LeadDigitalPresenceMetricCells({
  controller,
  onSelectTab,
}: {
  controller: DigitalPresenceController
  onSelectTab: (tab: DigitalPresenceStepTabId) => void
}) {
  const { tally } = controller
  const { networks, followers, tracking, alignmentKnown } = tally

  // Denominador de atividade é "redes medidas", não "redes cadastradas": uma
  // rede sem data não é uma rede parada, é uma rede que ninguém olhou. Contá-la
  // faria a barra encolher por falta de trabalho do analista.
  const activityShare =
    networks.measured > 0 ? networks.active / networks.measured : null
  const alignmentShare =
    alignmentKnown && networks.total > 0
      ? networks.aligned / networks.total
      : null
  const trackingShare = tracking ? tracking.ok / tracking.total : null

  return (
    <>
      <Cell
        tab="redes"
        onSelectTab={onSelectTab}
        icon={RiBarChartBoxLine}
        label="ATIVIDADE"
        value={networks.measured > 0 ? count(networks.active) : "—"}
        unit={
          networks.measured > 0
            ? `de ${count(networks.measured)} redes medidas`
            : "nenhuma rede medida"
        }
        tone={activityShare === null ? "neutral" : stepShareTone(activityShare)}
        share={activityShare}
      />
      {/*
        Sem mediana de mercado não há denominador, e trilha sem escala mente
        pior que a ausência dela. Este é o único dos quatro sem medidor.
      */}
      <Cell
        tab="redes"
        onSelectTab={onSelectTab}
        icon={RiUserFollowLine}
        label="SEGUIDORES"
        value={followers.measured > 0 ? count(followers.sum) : "—"}
        unit={
          followers.measured > 0
            ? `somados em ${count(followers.measured)} de ${count(networks.total)} redes`
            : "nenhuma rede medida"
        }
        tone="neutral"
        share={null}
      />
      <Cell
        tab="site"
        onSelectTab={onSelectTab}
        icon={RiCodeSSlashLine}
        label="RASTREAMENTO"
        value={tracking ? count(tracking.ok) : "—"}
        unit={tracking ? `de ${count(tracking.total)} tags no HTML` : "sem coleta do site"}
        tone={trackingShare === null ? "neutral" : stepShareTone(trackingShare)}
        share={trackingShare}
      />
      <Cell
        tab="site"
        onSelectTab={onSelectTab}
        icon={RiLinksLine}
        label="ALINHAMENTO"
        value={alignmentShare === null ? "—" : count(networks.aligned)}
        unit={
          !alignmentKnown
            ? "sem coleta do site"
            : networks.total === 0
              ? "nenhuma rede cadastrada"
              : `de ${count(networks.total)} redes cadastradas`
        }
        tone={
          alignmentShare === null ? "neutral" : stepShareTone(alignmentShare)
        }
        share={alignmentShare}
      />
    </>
  )
}
```

- [ ] **Step 4: Reescrever o cabeçalho da etapa**

`LeadDigitalPresenceStepHeader.tsx` — título, subtítulo, data da última edição e chip de salvamento. Sem botão de coleta: a etapa não coleta nada.

```tsx
"use client"

import { RiCheckLine, RiGroupLine } from "react-icons/ri"
import { LeadIconWell } from "@/components/custom/LeadDetailDialog/LeadIconWell"
import { Spinner } from "@/components/ui/spinner"
import { formatRelativeShort } from "@/lib/date-time"

export function LeadDigitalPresenceStepHeader({
  saveStatus,
  updatedAt,
}: {
  saveStatus: "idle" | "saving" | "saved" | "error"
  updatedAt: string | null
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-2.5">
        <LeadIconWell icon={RiGroupLine} />
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-semibold text-foreground">
            Presença digital
          </h2>
          <p className="text-xs/relaxed text-muted-foreground">
            Redes, rastreamento e identidade da marca.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {saveStatus === "saving" ? (
          <span
            className="inline-flex items-center gap-1 text-xs/relaxed text-muted-foreground"
            aria-live="polite"
          >
            <Spinner aria-hidden className="size-3.5" />
            Salvando…
          </span>
        ) : saveStatus === "saved" ? (
          <span
            className="inline-flex items-center gap-1 text-xs/relaxed text-success"
            aria-live="polite"
          >
            <RiCheckLine size={14} aria-hidden />
            Salvo agora
          </span>
        ) : updatedAt ? (
          <span className="inline-flex items-center gap-1 text-xs/relaxed text-muted-foreground">
            <RiCheckLine size={14} aria-hidden className="text-success" />
            Atualizado {formatRelativeShort(updatedAt)}
          </span>
        ) : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: O cabeçalho fixo completo**

`components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceHeader.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useReducedMotion } from "motion/react"
import { RiArrowUpSLine } from "react-icons/ri"
import { StepTabs } from "@/components/custom/LeadStepShell"
import { Button } from "@/components/ui/button"
import { cn } from "cn"
import {
  DIGITAL_PRESENCE_STEP_TABS,
  type DigitalPresenceStepTabId,
} from "@/lib/leads/digital-presence-step-tabs"
import { LeadDigitalPresenceIdentityCell } from "./LeadDigitalPresenceIdentityCell"
import { LeadDigitalPresenceMetricCells } from "./LeadDigitalPresenceMetricCells"
import { LeadDigitalPresenceStepHeader } from "./LeadDigitalPresenceStepHeader"
import type { DigitalPresenceController } from "./use-digital-presence-controller"

const NUMBERS_KEY = "presence:header-numbers"
const NUMBERS_ID = "presence-header-numbers"

/**
 * Primeira linha do grid da coluna central, fora da área de scroll: identidade
 * e números ficam à vista enquanto o analista percorre as abas.
 */
export function LeadDigitalPresenceHeader({
  controller,
  tab,
  counts,
  onSelectTab,
}: {
  controller: DigitalPresenceController
  tab: DigitalPresenceStepTabId
  counts: Record<DigitalPresenceStepTabId, number>
  onSelectTab: (tab: DigitalPresenceStepTabId) => void
}) {
  const reduced = !!useReducedMotion()
  const [numbersOpen, setNumbersOpen] = useState(() => {
    if (typeof window === "undefined") return true
    return window.localStorage.getItem(NUMBERS_KEY) !== "closed"
  })

  function toggleNumbers() {
    setNumbersOpen((current) => {
      const next = !current
      window.localStorage.setItem(NUMBERS_KEY, next ? "open" : "closed")
      return next
    })
  }

  const { saveStatus, saveError, hasCollect } = controller
  const hasNotices = saveStatus === "error" || !hasCollect

  return (
    <div className="border-b border-border/70 bg-background px-5 pt-4">
      <LeadDigitalPresenceStepHeader
        saveStatus={saveStatus}
        updatedAt={controller.updatedAt}
      />

      {/*
        Colapso por `grid-template-rows: 1fr → 0fr` com o filho em
        `overflow-hidden`: anima a altura real sem medir nada em JS.
      */}
      <div
        id={NUMBERS_ID}
        className={cn(
          "grid",
          reduced
            ? "transition-none"
            : "transition-[grid-template-rows,opacity] duration-[280ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
          numbersOpen
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="grid grid-cols-2 items-stretch gap-3 pt-3.5 md:grid-cols-[minmax(0,1.15fr)_repeat(2,minmax(0,1fr))] xl:grid-cols-[minmax(0,1.15fr)_repeat(4,minmax(0,1fr))]">
            <LeadDigitalPresenceIdentityCell controller={controller} />
            <LeadDigitalPresenceMetricCells
              controller={controller}
              onSelectTab={onSelectTab}
            />
          </div>
        </div>
      </div>

      {/*
        Faixa de avisos: a ressalva da coleta morava na última linha da página,
        onde ela rolava para fora da tela junto com o conteúdo.
      */}
      {hasNotices ? (
        <div className="mt-3 flex flex-col gap-1.5">
          {saveStatus === "error" ? (
            <p role="alert" className="text-xs/relaxed text-destructive">
              {saveError ?? "Não foi possível salvar. Tente novamente."}
            </p>
          ) : null}
          {!hasCollect ? (
            <p className="text-xs/relaxed text-muted-foreground">
              Rastreamento e alinhamento vêm da coleta do Website. Sem ela, esta
              etapa mostra só o que o analista registrar.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-end justify-between gap-3">
        <StepTabs
          tabs={DIGITAL_PRESENCE_STEP_TABS}
          counts={counts}
          value={tab}
          layoutId="presence-step-tab-underline"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="mb-1.5 shrink-0 text-muted-foreground"
          aria-expanded={numbersOpen}
          aria-controls={NUMBERS_ID}
          aria-label={
            numbersOpen
              ? "Recolher identidade e números"
              : "Mostrar identidade e números"
          }
          onClick={toggleNumbers}
        >
          <RiArrowUpSLine
            size={14}
            aria-hidden
            className={cn(
              "transition-transform duration-[280ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
              numbersOpen ? "rotate-0" : "rotate-180",
            )}
          />
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: A view, com as abas ainda servidas pelos componentes antigos**

`components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceView.tsx`:

```tsx
"use client"

import { useRef, useState, type ReactNode } from "react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import type { DigitalPresenceStepTabId } from "@/lib/leads/digital-presence-step-tabs"
import { LeadDigitalPresenceChecks } from "./LeadDigitalPresenceChecks"
import { LeadDigitalPresenceHeader } from "./LeadDigitalPresenceHeader"
import { LeadDigitalPresenceIdentity } from "./LeadDigitalPresenceIdentity"
import { LeadDigitalPresenceNetworks } from "./LeadDigitalPresenceNetworks"
import type { DigitalPresenceController } from "./use-digital-presence-controller"

export function LeadDigitalPresenceView({
  controller,
  readingMode,
}: {
  controller: DigitalPresenceController
  readingMode: boolean
}) {
  const panelsRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<DigitalPresenceStepTabId>("redes")

  const panels: Record<DigitalPresenceStepTabId, ReactNode> = {
    redes: (
      <LeadDigitalPresenceNetworks
        channels={controller.channels}
        review={controller.review}
        today={controller.today}
        canEdit={controller.canEdit && !readingMode}
        onChange={controller.handleReviewChange}
      />
    ),
    site: (
      <div className="flex flex-col gap-3.5">
        <LeadDigitalPresenceChecks sections={[]} />
        <LeadDigitalPresenceIdentity
          reviewKey={controller.syncKey}
          review={controller.review}
          canEdit={controller.canEdit && !readingMode}
          onChange={controller.handleReviewChange}
        />
      </div>
    ),
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(next) => setTab(next as DigitalPresenceStepTabId)}
      className="relative grid h-full min-h-0 grid-cols-1 gap-0"
    >
      <div className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)]">
        <LeadDigitalPresenceHeader
          controller={controller}
          tab={tab}
          counts={controller.counts}
          onSelectTab={setTab}
        />
        <div
          ref={panelsRef}
          tabIndex={-1}
          className="min-h-0 overflow-y-auto bg-accent/45 px-5 pt-4 pb-5 outline-none"
        >
          {(Object.keys(panels) as DigitalPresenceStepTabId[]).map((id) => (
            <TabsContent
              key={id}
              value={id}
              // `keepMounted` preserva o rascunho dentro do debounce ao trocar
              // de aba.
              keepMounted
              className="duration-150 data-active:animate-in data-active:fade-in-0"
            >
              {panels[id]}
            </TabsContent>
          ))}
        </div>
      </div>
    </Tabs>
  )
}
```

> Nesta tarefa a view tem **uma coluna só**: `useWideViewport`, `useReducedMotion` e o grid de duas colunas entram na Tarefa 6, junto com a coluna que os justifica. Declará-los aqui deixaria variável sem uso por um commit inteiro.
>
> `LeadDigitalPresenceChecks` recebe `sections={[]}` de propósito: a leitura de checks é substituída inteira na Tarefa 8, e passar a lista antiga aqui manteria a duplicação de redes viva por mais dois commits. Nesses dois commits a aba "Site e marca" mostra só o card de identidade — é intermediário conhecido, não regressão.

- [ ] **Step 7: Encolher o painel**

`LeadDigitalPresencePanel.tsx` inteiro passa a ser:

```tsx
"use client"

import { LeadDigitalPresenceView } from "./LeadDigitalPresenceView"
import { useDigitalPresenceController } from "./use-digital-presence-controller"
import type { LeadDigitalPresencePanelProps } from "./LeadDigitalPresencePanel.types"

/**
 * A etapa monta o próprio shell de tela cheia — cabeçalho fixo, abas e coluna
 * de oportunidades — em `LeadDigitalPresenceView`. Aqui sobra só a ligação com
 * o controller.
 *
 * Sem vazio de nível de etapa: sem rede cadastrada e sem coleta do site, o
 * shell continua montado e cada aba mostra o próprio vazio. O cabeçalho é onde
 * mora a leitura que explica o que falta.
 */
export function LeadDigitalPresencePanel(props: LeadDigitalPresencePanelProps) {
  const controller = useDigitalPresenceController(props)
  return (
    <LeadDigitalPresenceView
      controller={controller}
      readingMode={props.readingMode ?? false}
    />
  )
}
```

- [ ] **Step 8: Ligar tela cheia e modo reunião no `LeadGbpPanel`**

Em `components/custom/LeadGbpPanel/LeadGbpPanel.tsx`, o bloco de `fullBleed` (linha ~420) passa a ser:

```tsx
  // As três etapas montam o próprio shell de tela cheia: cabeçalho fixo, abas e
  // coluna. Padding e scroll do contêiner brigariam com ele.
  const websiteFullBleed =
    selectedStep === "website" &&
    detail.lead.channels.some(
      (channel) => channel.type === "website" && channel.id,
    )
  const fullBleed =
    (selectedStep === "google-profile" &&
      profiles.length > 0 &&
      selected !== null) ||
    websiteFullBleed ||
    // Sem condição: a etapa não depende de canal nem de coleta para montar o
    // shell — cada aba tem o próprio vazio.
    selectedStep === "digital-presence"
```

E o ramo `digital-presence` (linha ~567) ganha uma prop:

```tsx
        ) : selectedStep === "digital-presence" ? (
          <LeadDigitalPresencePanel
            detail={detail}
            canEdit={canEdit}
            readingMode={readingMode}
            onAuditChange={(audit) => {
              onDigitalPresenceChange(detail.lead.id, audit)
            }}
            onPendingChange={onPendingChange}
          />
```

- [ ] **Step 9: Rodar os portões**

```bash
pnpm exec tsc --noEmit
pnpm lint
echo -n "anima sem reduced: "; for f in $(grep -rlE "<m\." --include=*.tsx components/custom app); do grep -q "useReducedMotion" "$f" || echo "$f"; done | wc -l
```

Esperado: `tsc` limpo, `lint` com zero errors, **anima sem reduced = 1** (o do baseline).

- [ ] **Step 10: Parar e sugerir o commit**

```
feat(leads): shell de tela cheia na etapa de presença digital
```

---

## Tarefa 6: coluna de oportunidades e bloco do analista

**Files:**
- Create: `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceAnalystBlock.tsx`
- Modify: `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceView.tsx`

**Interfaces:**
- Consumes: `StepOpportunitiesRail`, `StepNotesField`, `useCollapsibleRail`, `useCaptureShortcut` de `@/components/custom/LeadStepShell`; `DIGITAL_PRESENCE_NOTES_MAX` e `DIGITAL_PRESENCE_REVIEW_NOTE_MAX` de `@/lib/leads/digital-presence-review`.
- Produces: `LeadDigitalPresenceAnalystBlock({ controller, open, onOpenChange, focusSignal })`.

- [ ] **Step 1: O bloco do analista**

`components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceAnalystBlock.tsx`:

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { RiArrowDownSLine, RiArrowUpSLine } from "react-icons/ri"
import { StepNotesField } from "@/components/custom/LeadStepShell"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { cn } from "cn"
import {
  DIGITAL_PRESENCE_NOTES_MAX,
  DIGITAL_PRESENCE_REVIEW_NOTE_MAX,
} from "@/lib/leads/digital-presence-review"
import type { DigitalPresenceController } from "./use-digital-presence-controller"

type Field = "notes" | "brand"

const BLOCK_ID = "presence-analyst-block"

/**
 * Os dois campos ficam **montados** o tempo todo; o inativo recebe `hidden`.
 * `StepNotesField` guarda o valor em `useState(initialValue)` e só
 * re-sincroniza quando a chave muda — desmontar o inativo devolveria o textarea
 * ao valor do servidor e comeria o texto digitado dentro dos 800ms de debounce.
 */
export function LeadDigitalPresenceAnalystBlock({
  controller,
  open,
  onOpenChange,
  focusSignal,
}: {
  controller: DigitalPresenceController
  open: boolean
  onOpenChange: (next: boolean) => void
  /** Contador que o rail incrementa quando o lápis pede foco aqui. */
  focusSignal: number
}) {
  const [field, setField] = useState<Field>("notes")
  const bodyRef = useRef<HTMLDivElement>(null)
  const { canEdit, saveStatus, saveError, review, syncKey } = controller
  const errorMessage = saveStatus === "error" ? saveError : null
  const brand = review.identity.note

  useEffect(() => {
    if (focusSignal === 0) return
    // Um frame depois do `hidden` sair, senão o `focus()` cai num elemento que
    // ainda não é focável.
    const raf = requestAnimationFrame(() => {
      bodyRef.current?.querySelector("textarea")?.focus()
    })
    return () => cancelAnimationFrame(raf)
  }, [focusSignal])

  const dirtyHint = !open && (review.notes || brand) ? "preenchido" : null

  return (
    <div className="border-t border-border/70 bg-popover px-4 pt-3 pb-4">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Bloco do analista
        </p>
        {dirtyHint ? (
          <span className="text-[10px] text-muted-foreground">{dirtyHint}</span>
        ) : null}
        <Kbd className="text-[10px]">Ctrl E</Kbd>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={
            open ? "Recolher bloco do analista" : "Abrir bloco do analista"
          }
          aria-expanded={open}
          aria-controls={BLOCK_ID}
          onClick={() => onOpenChange(!open)}
        >
          {open ? (
            <RiArrowDownSLine size={14} aria-hidden />
          ) : (
            <RiArrowUpSLine size={14} aria-hidden />
          )}
        </Button>
      </div>

      <div id={BLOCK_ID} ref={bodyRef} hidden={!open}>
        {canEdit ? (
          <div className="mt-2 flex rounded-lg bg-border/60 p-[3px]">
            {(
              [
                ["notes", "Notas da etapa"],
                ["brand", "Achado de marca"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setField(id)}
                aria-pressed={field === id}
                className={cn(
                  "h-6.5 flex-1 cursor-pointer rounded-md text-[11px] font-semibold transition-colors",
                  field === id
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-2">
          <StepNotesField
            hidden={canEdit && field !== "notes"}
            id={`presence-notes-${syncKey}`}
            syncKey={syncKey}
            initialValue={review.notes}
            canEdit={canEdit}
            status={saveStatus}
            errorMessage={errorMessage}
            maxLength={DIGITAL_PRESENCE_NOTES_MAX}
            title="Notas da etapa"
            placeholder="Contexto das redes, histórico com a agência, o que a coleta não vê"
            onDraftChange={controller.handleNotesDraftChange}
            onRetry={controller.retrySave}
          />
          {/*
            O "Achado de marca" é a nota do veredito de identidade: ela já
            persistia, mas só existia dentro do card lá embaixo.
          */}
          <StepNotesField
            hidden={canEdit && field !== "brand"}
            id={`presence-brand-${syncKey}`}
            syncKey={syncKey}
            initialValue={brand}
            canEdit={canEdit}
            status={saveStatus}
            errorMessage={errorMessage}
            maxLength={DIGITAL_PRESENCE_REVIEW_NOTE_MAX}
            title="Achado de marca"
            placeholder="Logo, foto e cores das redes estão consistentes com a marca?"
            onDraftChange={(note) =>
              controller.handleReviewChange({
                ...review,
                identity: { ...review.identity, note },
              })
            }
            onRetry={controller.retrySave}
          />
        </div>

        {canEdit ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Salva automaticamente enquanto você digita.
          </p>
        ) : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Ligar a coluna na view**

Em `LeadDigitalPresenceView.tsx`, acrescente os imports e o estado da coluna, e troque o `Tabs` externo pelo grid de duas colunas.

Imports novos:

```tsx
import { useCallback } from "react"
import {
  StepOpportunitiesRail,
  useCaptureShortcut,
  useCollapsibleRail,
  useWideViewport,
} from "@/components/custom/LeadStepShell"
import { DIGITAL_PRESENCE_STEP_TABS } from "@/lib/leads/digital-presence-step-tabs"
import { LeadDigitalPresenceAnalystBlock } from "./LeadDigitalPresenceAnalystBlock"
```

Constantes, no topo do arquivo:

```tsx
const ANALYST_KEY = "presence:analyst-block"
const RAIL_KEY = "presence:opportunities-rail"
const RAIL_W = "21.25rem"
const RAIL_W_CLOSED = "3rem"
```

Corpo, logo depois de `const wide = useWideViewport()`:

```tsx
  const { railOpen, toggle } = useCollapsibleRail({
    enabled: wide,
    storageKey: RAIL_KEY,
  })
  // Abaixo de `xl` a coluna não é coluna: vira a última seção do scroll. O rail
  // de 48px é posicionado em absoluto e só faz sentido em duas colunas.
  const collapsed = wide && !railOpen

  const [analystOpen, setAnalystOpen] = useState(() => {
    if (typeof window === "undefined") return true
    return window.localStorage.getItem(ANALYST_KEY) !== "closed"
  })
  const [analystFocusSignal, setAnalystFocusSignal] = useState(0)

  const setAnalyst = useCallback((next: boolean) => {
    setAnalystOpen(next)
    window.localStorage.setItem(ANALYST_KEY, next ? "open" : "closed")
  }, [])

  /** Abre a coluna, abre o bloco e leva o cursor para o campo. */
  const requestAnalyst = useCallback(() => {
    if (collapsed) toggle()
    setAnalyst(true)
    setAnalystFocusSignal((current) => current + 1)
  }, [collapsed, toggle, setAnalyst])

  /**
   * Ida e volta: de fora, entra no campo; de dentro, recolhe o bloco e devolve
   * o foco ao painel. Sem a volta, o atalho seria uma armadilha de foco.
   */
  const toggleAnalyst = useCallback(() => {
    const inside = document
      .getElementById("presence-analyst-block")
      ?.contains(document.activeElement)
    if (inside) {
      setAnalyst(false)
      panelsRef.current?.focus()
      return
    }
    requestAnalyst()
  }, [requestAnalyst, setAnalyst])

  useCaptureShortcut({
    enabled: true,
    code: "KeyE",
    onMatch: toggleAnalyst,
    allowInFields: true,
  })
```

O `Tabs` externo passa a ser:

```tsx
    <Tabs
      value={tab}
      onValueChange={(next) => setTab(next as DigitalPresenceStepTabId)}
      className="relative grid h-full min-h-0 grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1fr)_var(--rail-w)]"
      style={
        {
          "--rail-w": collapsed ? RAIL_W_CLOSED : RAIL_W,
          transitionProperty: "grid-template-columns",
          transitionDuration: reduced ? "120ms" : "320ms",
          transitionTimingFunction: "cubic-bezier(0.23,1,0.32,1)",
        } as React.CSSProperties
      }
    >
```

E, depois do `</div>` da coluna central, antes de `</Tabs>`:

```tsx
      <StepOpportunitiesRail
        id="presence-opportunities-rail"
        tabs={DIGITAL_PRESENCE_STEP_TABS}
        groups={controller.grouped}
        total={controller.opportunities.length}
        activeTab={tab}
        railOpen={!collapsed}
        onToggleRail={toggle}
        onRequestAnalyst={requestAnalyst}
        emptyLabel="Nenhum problema identificado nesta etapa."
        analyst={
          readingMode ? null : (
            <LeadDigitalPresenceAnalystBlock
              controller={controller}
              open={analystOpen}
              onOpenChange={setAnalyst}
              focusSignal={analystFocusSignal}
            />
          )
        }
      />
```

- [ ] **Step 3: Rodar os portões**

```bash
pnpm exec tsc --noEmit
pnpm lint
```

Esperado: ambos limpos. Se `StepOpportunitiesRail` reclamar do tipo de `groups`, confira que `controller.grouped` é `Record<DigitalPresenceStepTabId, DigitalPresenceOpportunityItem[]>` e que `DigitalPresenceOpportunityItem` tem `id`, `title`, `impact` e `source` — é o formato de `StepOpportunity`.

- [ ] **Step 4: Parar e sugerir o commit**

```
feat(leads): coluna de oportunidades e bloco do analista na presença digital
```

---

## Tarefa 7: aba Redes — o card de rede

Onde os dois controles nativos morrem.

**Files:**
- Create: `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceNetworkCard.tsx`
- Create: `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceTabPanels.tsx`
- Modify: `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceView.tsx`

**Interfaces:**
- Consumes: `DatePicker` da Tarefa 1; `DigitalPresenceNetworkState` da Tarefa 3; `Checkbox` de `@/components/ui/checkbox`.
- Produces: `LeadDigitalPresenceNetworkCard({ state, canEdit, today, onChange })`, `LeadDigitalPresenceTabRedes({ controller, readingMode })`.

- [ ] **Step 1: O card de rede**

`components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceNetworkCard.tsx`:

```tsx
"use client"

import { RiExternalLinkLine, RiStarFill } from "react-icons/ri"
import { StepSectionLabel } from "@/components/custom/LeadStepShell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/custom/DatePicker"
import { cn } from "cn"
import { CHANNEL_ICONS } from "@/lib/leads/digital-channel-icons"
import {
  DIGITAL_PRESENCE_ALIGNMENT_LABEL,
  DIGITAL_PRESENCE_ALIGNMENT_TONE,
  type DigitalPresenceNetworkState,
} from "@/lib/leads/digital-presence-presenters"
import type { DigitalPresenceTone } from "@/lib/leads/digital-presence"
import type { DigitalPresenceNetworkAnswer } from "@/lib/leads/digital-presence-review"

/**
 * Mesma tabela de alfas do `SURFACE` de `StepStat`, conferida por cálculo para
 * AA em claro e escuro. A superfície do card é o estado: rede parada ou
 * desalinhada pede atenção; inacessível recua; em dia é cartão limpo.
 */
const SURFACE: Record<"neutral" | "warning", string> = {
  neutral: "border-border/70 bg-card",
  warning: "border-warning/25 bg-warning/[0.05]",
}

const CHIP: Record<DigitalPresenceTone, string> = {
  neutral: "bg-accent text-muted-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
}

const DOT: Record<DigitalPresenceTone, string> = {
  neutral: "bg-muted-foreground/40",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
}

export function LeadDigitalPresenceNetworkCard({
  state,
  canEdit,
  today,
  onChange,
}: {
  state: DigitalPresenceNetworkState
  canEdit: boolean
  today: string
  onChange: (
    channelId: string,
    partial: Partial<DigitalPresenceNetworkAnswer>,
  ) => void
}) {
  const Icon = CHANNEL_ICONS[state.type]
  const { answer } = state
  const locked = !canEdit || answer.unavailable
  const followersId = `presence-followers-${state.channelId}`
  const dateId = `presence-last-post-${state.channelId}`
  const unavailableId = `presence-unavailable-${state.channelId}`

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-lg border px-3 py-2.5",
        SURFACE[state.tone],
        answer.unavailable && "bg-muted/40",
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          aria-hidden
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-lg",
            answer.unavailable
              ? "bg-accent text-muted-foreground/60"
              : "bg-primary/10 text-primary",
          )}
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs/[1.5] font-semibold text-foreground">
              {state.label}
            </h3>
            {state.isPrimary ? (
              <Badge variant="primary" className="shrink-0">
                <RiStarFill size={12} aria-hidden />
                Principal
              </Badge>
            ) : null}
          </div>
          <p className="truncate text-xs/[1.5] text-muted-foreground">
            {state.display}
          </p>
        </div>
        {state.href ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Abrir o perfil no ${state.label}`}
            className="shrink-0 text-primary"
            onClick={() =>
              window.open(state.href!, "_blank", "noopener,noreferrer")
            }
          >
            <RiExternalLinkLine size={14} aria-hidden />
          </Button>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 border-t border-border/70 pt-3 sm:grid-cols-2">
        <div className="min-w-0">
          <StepSectionLabel>Seguidores</StepSectionLabel>
          <Input
            id={followersId}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="—"
            aria-label={`Seguidores no ${state.label}`}
            className="tabular-nums"
            value={
              answer.followers === null
                ? ""
                : answer.followers.toLocaleString("pt-BR")
            }
            disabled={locked}
            onChange={(event) => {
              // Dígitos crus no estado, separador só na exibição: o valor que
              // vai para o banco é número, não texto formatado.
              const raw = event.target.value.replace(/\D/g, "")
              onChange(state.channelId, {
                followers: raw.length === 0 ? null : Number(raw),
              })
            }}
          />
        </div>

        <div className="min-w-0">
          <StepSectionLabel>Última postagem</StepSectionLabel>
          <DatePicker
            id={dateId}
            value={answer.lastPostedOn ?? ""}
            max={today}
            clearable
            disabled={locked}
            placeholder="—"
            onValueChange={(value) =>
              onChange(state.channelId, {
                lastPostedOn: value.length === 0 ? null : value,
              })
            }
          />
          {state.age ? (
            <p
              className={cn(
                "mt-1.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                CHIP[state.age.tone],
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "inline-block size-1.5 shrink-0 rounded-full",
                  DOT[state.age.tone],
                )}
              />
              {state.age.label}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
        {/*
          Sem coleta do site o chip não aparece: o estado é desconhecido, e chip
          nenhum é mais honesto que um chip cinza afirmando o quê.
        */}
        {state.alignment === "unknown" ? (
          <span />
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
              CHIP[DIGITAL_PRESENCE_ALIGNMENT_TONE[state.alignment]],
            )}
          >
            <span
              aria-hidden
              className={cn(
                "inline-block size-1.5 shrink-0 rounded-full",
                DOT[DIGITAL_PRESENCE_ALIGNMENT_TONE[state.alignment]],
              )}
            />
            {DIGITAL_PRESENCE_ALIGNMENT_LABEL[state.alignment]}
          </span>
        )}

        <div className="flex items-center gap-2">
          <Checkbox
            id={unavailableId}
            checked={answer.unavailable}
            disabled={!canEdit}
            onCheckedChange={(checked) => {
              // Marcar limpa as duas medidas: "não medimos" não pode conviver
              // com um número antigo que ninguém mais consegue conferir.
              if (checked) {
                onChange(state.channelId, {
                  unavailable: true,
                  followers: null,
                  lastPostedOn: null,
                })
                return
              }
              onChange(state.channelId, { unavailable: false })
            }}
          />
          <Label
            htmlFor={unavailableId}
            className={cn(
              "text-xs/relaxed text-muted-foreground",
              canEdit ? "cursor-pointer" : "cursor-default opacity-70",
            )}
          >
            Perfil inacessível
          </Label>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: A aba**

`components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceTabPanels.tsx`:

```tsx
"use client"

import { RiGroupLine } from "react-icons/ri"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  emptyNetworkAnswer,
  type DigitalPresenceNetworkAnswer,
} from "@/lib/leads/digital-presence-review"
import { LeadDigitalPresenceNetworkCard } from "./LeadDigitalPresenceNetworkCard"
import type { DigitalPresenceController } from "./use-digital-presence-controller"

type PanelProps = {
  controller: DigitalPresenceController
  readingMode: boolean
}

export function LeadDigitalPresenceTabRedes({
  controller,
  readingMode,
}: PanelProps) {
  const { networkStates, review, canEdit, today } = controller

  if (networkStates.length === 0) {
    return (
      <Empty className="px-4 py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="size-12 rounded-xl">
            <RiGroupLine size={22} aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Nenhuma rede cadastrada</EmptyTitle>
          <EmptyDescription>
            Inclua Instagram, LinkedIn ou outras no cadastro do lead.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  function patch(
    channelId: string,
    partial: Partial<DigitalPresenceNetworkAnswer>,
  ) {
    const current = review.networks[channelId] ?? emptyNetworkAnswer()
    controller.handleReviewChange({
      ...review,
      networks: {
        ...review.networks,
        [channelId]: { ...current, ...partial },
      },
    })
  }

  /*
    Duas colunas de fluxo, não `grid-cols-2`: os chips de idade e de alinhamento
    entram e saem, as alturas naturais divergem, e o grid faria a linha tomar a
    altura do card mais alto, deixando vão embaixo do card curto.
  */
  const left = networkStates.filter((_, index) => index % 2 === 0)
  const right = networkStates.filter((_, index) => index % 2 === 1)

  return (
    <div className="flex flex-col gap-3.5 xl:flex-row xl:items-start">
      {[left, right].map((column, index) =>
        column.length === 0 ? null : (
          <div
            key={index}
            className="flex min-w-0 flex-1 flex-col gap-3.5"
          >
            {column.map((state) => (
              <LeadDigitalPresenceNetworkCard
                key={state.channelId}
                state={state}
                canEdit={canEdit && !readingMode}
                today={today}
                onChange={patch}
              />
            ))}
          </div>
        ),
      )}
    </div>
  )
}
```

- [ ] **Step 3: Trocar o painel na view**

Em `LeadDigitalPresenceView.tsx`, remova o import de `LeadDigitalPresenceNetworks` e troque a entrada `redes` do mapa `panels`:

```tsx
    redes: (
      <LeadDigitalPresenceTabRedes
        controller={controller}
        readingMode={readingMode}
      />
    ),
```

com `import { LeadDigitalPresenceTabRedes } from "./LeadDigitalPresenceTabPanels"`.

- [ ] **Step 4: Rodar os portões**

```bash
pnpm exec tsc --noEmit
pnpm lint
echo -n "nativos restantes: "; grep -rnE 'type="(date|checkbox)"' --include=*.tsx components/custom app | wc -l
```

Esperado: `tsc` e `lint` limpos; **nativos restantes = 2**, ainda em `LeadDigitalPresenceNetworks.tsx`, que só é removido na Tarefa 9.

- [ ] **Step 5: Parar e sugerir o commit**

```
feat(leads): card de rede com DatePicker, Checkbox e estado por tom
```

---

## Tarefa 8: aba Site e marca

**Files:**
- Create: `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceSiteCards.tsx`
- Modify: `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceTabPanels.tsx`
- Modify: `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceView.tsx`

**Interfaces:**
- Consumes: `digitalPresenceSiteLinks`, `DIGITAL_PRESENCE_ALIGNMENT_LABEL/TONE` da Tarefa 3; `ToggleGroup`, `ToggleGroupItem` de `@/components/ui/toggle-group`.
- Produces: `LeadDigitalPresenceTracking`, `LeadDigitalPresenceSiteLinksCard`, `LeadDigitalPresenceBrand`, e `LeadDigitalPresenceTabSite`.

- [ ] **Step 1: Os três blocos**

`components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceSiteCards.tsx`:

```tsx
"use client"

import { AnimatePresence, useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import type { ReactNode } from "react"
import { RiCodeSSlashLine, RiFacebookCircleLine } from "react-icons/ri"
import { LeadGbpCard } from "@/components/custom/LeadGbpPanel/LeadGbpCard"
import {
  StepSectionLabel,
  StepStat,
} from "@/components/custom/LeadStepShell"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "cn"
import { CHANNEL_ICONS } from "@/lib/leads/digital-channel-icons"
import type { DigitalPresenceTone } from "@/lib/leads/digital-presence"
import {
  DIGITAL_PRESENCE_ALIGNMENT_LABEL,
  DIGITAL_PRESENCE_ALIGNMENT_TONE,
  type DigitalPresenceSiteLink,
} from "@/lib/leads/digital-presence-presenters"
import {
  DIGITAL_PRESENCE_IDENTITY,
  DIGITAL_PRESENCE_IDENTITY_VERDICT_LABEL,
  DIGITAL_PRESENCE_REVIEW_NOTE_MAX,
  type DigitalPresenceIdentityVerdict,
  type DigitalPresenceReview,
} from "@/lib/leads/digital-presence-review"
import type { WebsiteCrawlSignals } from "@/lib/leads/website-audit"

const EASE = [0.23, 1, 0.32, 1] as const

const CHIP: Record<DigitalPresenceTone, string> = {
  neutral: "bg-accent text-muted-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
}

export function LeadDigitalPresenceTracking({
  signals,
}: {
  signals: WebsiteCrawlSignals
}) {
  const hasTag = signals.hasGtm || signals.hasGtag
  return (
    <LeadGbpCard title="Rastreamento">
      <StepSectionLabel aside="pode estar só dentro do GTM">
        No HTML da home
      </StepSectionLabel>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StepStat
          icon={RiCodeSSlashLine}
          label="GOOGLE TAG / GTM"
          value={hasTag ? "Presente" : "Ausente"}
          unit={
            hasTag
              ? signals.hasGtm
                ? "container do GTM"
                : "gtag direto"
              : "não encontrado no HTML"
          }
          tone={hasTag ? "success" : "warning"}
        />
        <StepStat
          icon={RiFacebookCircleLine}
          label="PIXEL DO FACEBOOK"
          value={signals.hasFacebookPixel ? "Presente" : "Ausente"}
          unit={
            signals.hasFacebookPixel
              ? "fbevents.js encontrado"
              : "não aparece no HTML"
          }
          tone={signals.hasFacebookPixel ? "success" : "warning"}
        />
      </div>
    </LeadGbpCard>
  )
}

export function LeadDigitalPresenceSiteLinksCard({
  links,
}: {
  links: DigitalPresenceSiteLink[]
}) {
  return (
    <LeadGbpCard title="Redes encontradas no site">
      {links.length === 0 ? (
        <p className="text-xs/relaxed text-muted-foreground">
          Nenhuma rede no cadastro nem no HTML.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {links.map((link) => {
            const Icon = CHANNEL_ICONS[link.type]
            const tone = DIGITAL_PRESENCE_ALIGNMENT_TONE[link.alignment]
            return (
              <li
                key={link.type}
                className="flex items-center gap-2.5 rounded-lg bg-card px-2.5 py-2 ring-1 ring-foreground/[0.08]"
              >
                <span
                  aria-hidden
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-muted-foreground"
                >
                  <Icon size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs/[1.5] text-foreground">{link.label}</p>
                  {link.href ? (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {link.href}
                    </p>
                  ) : null}
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                    CHIP[tone],
                  )}
                >
                  {DIGITAL_PRESENCE_ALIGNMENT_LABEL[link.alignment]}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </LeadGbpCard>
  )
}

function FieldReveal({
  show,
  id,
  children,
}: {
  show: boolean
  id: string
  children: ReactNode
}) {
  const reduced = !!useReducedMotion()
  return (
    <AnimatePresence initial={false}>
      {show ? (
        <m.div
          key={id}
          initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, height: "auto" }}
          exit={
            reduced
              ? { opacity: 0, transition: { duration: 0.12 } }
              : {
                  opacity: 0,
                  height: 0,
                  transition: { duration: 0.14, ease: EASE },
                }
          }
          transition={{ duration: reduced ? 0.12 : 0.18, ease: EASE }}
          style={reduced ? undefined : { overflow: "hidden" }}
        >
          {children}
        </m.div>
      ) : null}
    </AnimatePresence>
  )
}

const VERDICTS: DigitalPresenceIdentityVerdict[] = ["ok", "issue"]

export function LeadDigitalPresenceBrand({
  reviewKey,
  review,
  canEdit,
  onChange,
}: {
  reviewKey: string
  review: DigitalPresenceReview
  canEdit: boolean
  onChange: (next: DigitalPresenceReview) => void
}) {
  const answer = review.identity

  function patch(partial: {
    verdict?: DigitalPresenceIdentityVerdict | null
    note?: string
  }) {
    onChange({ ...review, identity: { ...answer, ...partial } })
  }

  if (!canEdit) {
    return (
      <LeadGbpCard title={DIGITAL_PRESENCE_IDENTITY.label}>
        <p className="text-xs/relaxed text-muted-foreground">
          {answer.verdict
            ? DIGITAL_PRESENCE_IDENTITY_VERDICT_LABEL[answer.verdict]
            : "Sem julgamento"}
        </p>
        {answer.note ? (
          <p className="mt-1 whitespace-pre-wrap text-xs/relaxed text-muted-foreground">
            {answer.note}
          </p>
        ) : null}
      </LeadGbpCard>
    )
  }

  return (
    <LeadGbpCard title={DIGITAL_PRESENCE_IDENTITY.label}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs/relaxed text-muted-foreground">
          Consistência da marca entre as redes — não o layout do site.
        </p>
        {/*
          `ToggleGroup` no lugar do radiogroup escrito à mão: um primitive por
          papel, e escolher entre opções mutuamente exclusivas é o dele.
          Seleção única é o padrão do grupo — `multiple` é o opt-in —, então a
          composição é a mesma de `LeadWebsiteShotViewer.tsx:34`.
        */}
        <ToggleGroup
          value={answer.verdict ? [answer.verdict] : []}
          onValueChange={(value) => {
            const next = value[0]
            patch({
              verdict:
                next === "ok" || next === "issue"
                  ? (next as DigitalPresenceIdentityVerdict)
                  : null,
            })
          }}
          variant="outline"
          size="sm"
          aria-label={DIGITAL_PRESENCE_IDENTITY.label}
          className="shrink-0"
        >
          {VERDICTS.map((option) => (
            <ToggleGroupItem key={option} value={option}>
              {DIGITAL_PRESENCE_IDENTITY_VERDICT_LABEL[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <FieldReveal show={answer.verdict !== null} id="brand-note">
        <div className="pt-2">
          <label htmlFor={`${reviewKey}-brand-note`} className="sr-only">
            {DIGITAL_PRESENCE_IDENTITY.placeholder}
          </label>
          <Textarea
            id={`${reviewKey}-brand-note`}
            value={answer.note}
            maxLength={DIGITAL_PRESENCE_REVIEW_NOTE_MAX}
            rows={2}
            placeholder={DIGITAL_PRESENCE_IDENTITY.placeholder}
            onChange={(event) => patch({ note: event.target.value })}
            className="min-h-0 resize-y"
          />
          <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
            {answer.note.length}/{DIGITAL_PRESENCE_REVIEW_NOTE_MAX}
          </p>
        </div>
      </FieldReveal>
    </LeadGbpCard>
  )
}
```

> `cn` entra no import deste arquivo — o bloco de links o usa. Confira também que o import de `@/lib/leads/digital-presence-review` traga `DIGITAL_PRESENCE_IDENTITY`, os dois tipos e o `DIGITAL_PRESENCE_REVIEW_NOTE_MAX` num bloco só.

- [ ] **Step 2: A aba**

Em `LeadDigitalPresenceTabPanels.tsx`, acrescente:

```tsx
export function LeadDigitalPresenceTabSite({
  controller,
  readingMode,
}: PanelProps) {
  const { signals, siteLinks, review, canEdit, syncKey } = controller

  if (!signals || !siteLinks) {
    return (
      <Empty className="px-4 py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="size-12 rounded-xl">
            <RiGlobalLine size={22} aria-hidden />
          </EmptyMedia>
          <EmptyTitle>Sem coleta do site</EmptyTitle>
          <EmptyDescription>
            A coleta do Website alimenta esta aba. Analise o site para preencher
            rastreamento e alinhamento.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-3.5 xl:flex-row xl:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-3.5">
        <LeadDigitalPresenceTracking signals={signals} />
        <LeadDigitalPresenceBrand
          reviewKey={syncKey}
          review={review}
          canEdit={canEdit && !readingMode}
          onChange={controller.handleReviewChange}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3.5">
        <LeadDigitalPresenceSiteLinksCard links={siteLinks} />
      </div>
    </div>
  )
}
```

com `RiGlobalLine` acrescentado ao import de `react-icons/ri` e os três blocos importados de `./LeadDigitalPresenceSiteCards`.

- [ ] **Step 3: Trocar o painel na view**

Em `LeadDigitalPresenceView.tsx`, remova os imports de `LeadDigitalPresenceChecks` e `LeadDigitalPresenceIdentity` e troque a entrada `site`:

```tsx
    site: (
      <LeadDigitalPresenceTabSite
        controller={controller}
        readingMode={readingMode}
      />
    ),
```

- [ ] **Step 4: Rodar os portões**

```bash
pnpm exec tsc --noEmit
pnpm lint
```

Esperado: ambos limpos.

- [ ] **Step 5: Parar e sugerir o commit**

```
feat(leads): aba de site e marca da presença digital
```

---

## Tarefa 9: limpeza, skill e checks finais

**Files:**
- Delete: `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceChecks.tsx`
- Delete: `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceNetworks.tsx`
- Delete: `components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceIdentity.tsx`
- Modify: `lib/leads/digital-presence-presenters.ts`
- Modify: `lib/leads/digital-presence.ts`
- Modify: `.claude/skills/suite-frontend/references/components.md`
- Modify: `.claude/skills/suite-frontend/references/layout.md`

- [ ] **Step 1: Apagar os três componentes substituídos**

```bash
cd "C:/Users/Eduardo Zamai/Documents/suite"
rm components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceChecks.tsx
rm components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceNetworks.tsx
rm components/custom/LeadDigitalPresencePanel/LeadDigitalPresenceIdentity.tsx
```

- [ ] **Step 2: Remover a leitura morta**

Em `lib/leads/digital-presence-presenters.ts`, remova `digitalPresenceCheckSections`, `DigitalPresenceCheckSection`, `DigitalPresenceCheckItem` e `DigitalPresenceCheckStatus`, mais os imports que só existiam para elas. Em `lib/leads/digital-presence.ts`, remova `socialPostingAgeLabel` — `socialPostingAge` a substituiu e o único consumidor era o arquivo apagado no Step 1.

- [ ] **Step 3: Rodar o `tsc` e deixar ele apontar o que sobrou**

```bash
pnpm exec tsc --noEmit
```

Esperado: limpo. Se acusar import morto em algum arquivo, é resto da migração — apague o import, não recrie a função.

- [ ] **Step 4: Atualizar a skill no mesmo commit**

A skill envelhece como código; `.claude/skills/suite-frontend/SKILL.md` manda atualizar a referência correspondente **no mesmo commit** em que o componente muda.

Em `references/components.md`:
- acrescente `DatePicker` ao catálogo de módulos compostos de `components/custom`, com uma linha dizendo que ele é data civil, compõe o `Popover` local, e que o `DateTimePicker` continua sendo o de data **mais** horário;
- atualize a contagem de módulos no topo, se ela existir;
- registre que `LeadDigitalPresencePanel` passou a consumir `LeadStepShell`.

Em `references/layout.md`, no arquétipo "Painel de trabalho", a linha de referência passa a citar as três etapas:

```
Referência: `components/custom/LeadGbpPanel` (etapa Perfil no Google),
`components/custom/LeadWebsitePanel` (etapa Website) e
`components/custom/LeadDigitalPresencePanel` (etapa Presença digital). As três
montam a mesma coisa a partir de `components/custom/LeadStepShell`.
```

- [ ] **Step 5: Rodar a bateria completa de `checks.md`**

```bash
cd "C:/Users/Eduardo Zamai/Documents/suite"
pnpm exec tsc --noEmit
pnpm lint
echo -n "cor cravada:        "; grep -rnE "oklch\(|#[0-9a-fA-F]{3,8}|rgba?\(" --include=*.tsx components/custom app | grep -v "oklch(from " | wc -l
echo -n "z-[N] avulso:       "; grep -rnE "z-\[" --include=*.tsx components/custom app | wc -l
echo -n "lucide:             "; grep -rn "lucide-react" --include=*.tsx --include=*.ts components app lib hooks | wc -l
echo -n "cn errado:          "; grep -rn 'cn.*from "@/lib/utils"' --include=*.tsx components app | wc -l
echo -n "motion.* em vez m.: "; grep -rnE "<motion\." --include=*.tsx components app | wc -l
echo -n "base-ui direto:     "; grep -rn "@base-ui/react" --include=*.tsx components/custom app | wc -l
echo -n "altura mágica:      "; grep -rnoE "<(Button|Input|Textarea|SelectTrigger|Toggle)[^>]*className=\"[^\"]*\bh-[0-9]" --include=*.tsx components/custom app | wc -l
echo -n "anima sem reduced:  "; for f in $(grep -rlE "<m\." --include=*.tsx components/custom app); do grep -q "useReducedMotion" "$f" || echo "$f"; done | wc -l
echo -n "remixicon:          "; grep -rn "@remixicon/react" --include=*.tsx components lib app | wc -l
echo -n "nativos da rodada:  "; grep -rnE 'type="(date|checkbox)"' --include=*.tsx components/custom app | wc -l
```

Esperado, linha a linha: cor cravada **5**, z-[N] **0**, lucide **0**, cn errado **0**, motion.* **0**, base-ui direto **2**, altura mágica **0**, anima sem reduced **1**, remixicon **0**, **nativos da rodada 0**.

Qualquer número acima do baseline é coisa desta rodada. Não normalize: encontre e corrija.

- [ ] **Step 6: Entregar com a autocrítica**

Escreva duas linhas dizendo **o que você cortou e por quê**. Se não cortou nada, olhe de novo e tire um acessório.

- [ ] **Step 7: Parar e sugerir o commit**

```
refactor(leads): remover a leitura antiga da presença digital e atualizar a skill
```

---

## Cobertura da spec

| Seção da spec | Tarefa |
| --- | --- |
| Árvore de componentes | 5, 6, 7, 8 |
| `useDigitalPresenceController` | 4 |
| Estado novo (`notes`) | 2 |
| Módulos novos e alterados em `lib` | 3, 9 |
| `components/custom/DatePicker` | 1 |
| Abas e temas de oportunidade | 3 |
| Célula de identidade | 5 |
| Os quatro big numbers | 5 |
| Faixa de avisos | 5 |
| Aba Redes | 7 |
| Aba Site e marca | 8 |
| Coluna de oportunidades | 6 |
| Bloco do analista | 6 |
| Colapso, atalho e modo reunião | 5, 6 |
| Acessibilidade | 1, 5, 6, 7, 8 |
| Responsivo | 5, 6, 7, 8 |
| Cópia | 5, 6, 7, 8 |
| Verificação | 9 |

**Loading não tem tarefa própria, e é deliberado.** A spec pede skeleton com a forma da faixa e de dois cards. `LeadDigitalPresencePanel` não recebe `loading` — quem recebe é o `LeadGbpPanel`, que já resolve o estado de carregamento da aba inteira antes de escolher a etapa. Acrescentar um skeleton aqui exigiria descer uma prop nova por um caminho que hoje não a carrega, para cobrir uma janela que o contêiner já cobre. Se a verificação em tela mostrar um salto de layout ao abrir a etapa, isso vira tarefa própria, com sua própria aprovação.
