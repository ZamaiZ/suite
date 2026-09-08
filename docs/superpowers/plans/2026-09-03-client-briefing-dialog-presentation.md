# Client Briefing Review Dialog Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompose the internal client briefing dialog into a premium, lead-detail-aligned workspace with a persistent expanded navigation rail for Briefing and Contact/Kickoff.

**Architecture:** Keep `ClientBriefingReviewDialog` as the state, caching, editing, and server-action orchestrator. Extract the stable presentation shell into focused header, navigation-rail, and content-header components; only the overview, selected step, and kickoff content panes transition. Preserve the current actions, permission checks, cache invalidation, autosave flush, and dialog URL behavior.

**Tech Stack:** Next.js 16.3.1, React 19.2.8, TypeScript, Tailwind CSS, Motion 13.1.0, React Icons.

**Spec:** `docs/superpowers/specs/2026-09-03-client-briefing-dialog-presentation-design.md`

## Global Constraints

- Do not create or run automated tests, builds, linters, typechecks, or Git commands; the repository rules prohibit them.
- Before writing application code, read the relevant guide under `node_modules/next/dist/docs/`, as required by `AGENTS.md`.
- Preserve existing server actions, permission rules, cache behavior, autosave flush behavior, validation, and URL behavior.
- Reuse semantic design tokens and existing `Button`, `Dialog`, and Motion conventions; do not introduce dependencies or raw color values.
- The desktop rail is fixed and always expanded at 224 px; narrow viewports retain text labels in a horizontal navigation strip.
- Status must be communicated by text and icon in addition to color, and all interactive controls need visible focus treatment.
- Honor `prefers-reduced-motion` with opacity-only transitions of 100–120 ms.

---

## File Structure

- Create: `components/custom/ClientBriefingReviewDialog/ClientBriefingDialogHeader.tsx` — stable client identity, global briefing status/progress, and close action.
- Create: `components/custom/ClientBriefingReviewDialog/ClientBriefingNavigationRail.tsx` — expanded desktop rail; compact horizontal narrow layout; top-level areas and conditional briefing-step list.
- Create: `components/custom/ClientBriefingReviewDialog/ClientBriefingContentHeader.tsx` — contextual breadcrumb, title, step metadata, back action, and edit action.
- Modify: `components/custom/ClientBriefingReviewDialog/ClientBriefingReviewDialog.tsx` — assemble the new shell around unchanged data/state orchestration and pane rendering.
- Modify: `components/custom/BriefingReviewOverview/BriefingReviewOverview.tsx` — make step cards more scannable while keeping its public props intact.
- Modify: `components/custom/ClientKickoffPanel/ClientKickoffPanel.tsx` — reorganize existing kickoff data into contextual summary, progressively disclosed action form, and activity timeline.

## Task 1: Build the stable dialog chrome

**Files:**

- Create: `components/custom/ClientBriefingReviewDialog/ClientBriefingDialogHeader.tsx`
- Create: `components/custom/ClientBriefingReviewDialog/ClientBriefingNavigationRail.tsx`
- Create: `components/custom/ClientBriefingReviewDialog/ClientBriefingContentHeader.tsx`

**Interfaces:**

- Consumes: `BriefingStepId` from `@/lib/briefing/steps`, `StaffBriefingOverview` from `@/app/actions/briefing`, existing `Button`, `cn`, `formatDateTimeShort`, Motion and Remix Icon conventions.
- Produces:

```ts
export type ClientBriefingArea = "briefing" | "contact"

export function ClientBriefingDialogHeader(props: {
  companyName: string
  briefingStatusLabel?: string
  briefingStatusTone: "success" | "warning" | "muted"
  completedCount?: number
  onClose: () => void
  closeDisabled: boolean
}): JSX.Element

export function ClientBriefingNavigationRail(props: {
  companyName: string
  completedCount?: number
  area: ClientBriefingArea
  activeStep: BriefingStepId | null
  steps: StaffBriefingOverview["steps"]
  contactEnabled: boolean
  disabled: boolean
  onAreaChange: (area: ClientBriefingArea) => void
  onStepSelect: (stepId: BriefingStepId) => void
}): JSX.Element

export function ClientBriefingContentHeader(props: {
  area: ClientBriefingArea
  step?: StaffBriefingOverview["steps"][number]
  editing: boolean
  editAvailable: boolean
  busy: boolean
  onBackToOverview: () => void
  onEditToggle: () => void
}): JSX.Element
```

- [ ] **Step 1: Read the current UI and framework guidance before editing.**

Run:

```powershell
Get-Content node_modules\next\dist\docs\app\getting-started\server-and-client-components.md
Get-Content components\custom\LeadDetailDialog\LeadDetailHeader.tsx
Get-Content components\custom\LeadDetailDialog\LeadRecordRail.tsx
Get-Content components\custom\ClientBriefingReviewDialog\ClientBriefingReviewDialog.tsx
```

If the first Next.js path is not present, locate the equivalent guide before coding:

```powershell
rg -l "use client|Client Components" node_modules\next\dist\docs
```

- [ ] **Step 2: Create `ClientBriefingDialogHeader.tsx` as stable identity chrome.**

Implement a single-row header patterned after `LeadDetailHeader`: initials from the existing `getLeadInitials`, company name, briefing state badge, `N/8` count, and the labelled close button. Keep this header unchanged while the user opens a step or switches to kickoff.

```tsx
<header className="grid min-h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border-subtle bg-elevated px-3 sm:px-4">
  <div className="flex min-w-0 items-center gap-2.5">
    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/10 font-sans text-caption font-semibold text-accent">
      {getLeadInitials(companyName)}
    </span>
    <div className="min-w-0">
      <p className="truncate font-sans text-body-sm font-semibold text-fg">
        {companyName}
      </p>
      <p className="font-sans text-caption text-fg-muted">Briefing interno</p>
    </div>
  </div>
  <div className="flex items-center justify-end gap-2">
    {/* badges and close button */}
  </div>
</header>
```

- [ ] **Step 3: Create `ClientBriefingNavigationRail.tsx`.**

Render a semantic `<nav aria-label="Navegação do cliente">` with a 224 px desktop rail and a labeled horizontal strip below `lg`. Show the client summary at the top; follow it with `Briefing` and `Contato e kickoff`. Render the step list only when `area === "briefing"`. Each step button exposes its text state, uses `aria-current="page"` when selected, and has its own icon from the same `BriefingStepId` map used by the overview.

```tsx
<aside className="shrink-0 border-b border-border-subtle bg-elevated lg:w-56 lg:border-r lg:border-b-0">
  <nav
    aria-label="Navegação do cliente"
    className="flex gap-1 overflow-x-auto p-2 lg:h-full lg:flex-col lg:overflow-y-auto"
  >
    {/* client summary and first-level areas */}
    {area === "briefing"
      ? steps.map((step) => (
          <button
            aria-current={activeStep === step.id ? "page" : undefined}
            onClick={() => onStepSelect(step.id)}
          >
            {/* icon, label, text state */}
          </button>
        ))
      : null}
  </nav>
</aside>
```

- [ ] **Step 4: Create `ClientBriefingContentHeader.tsx`.**

For overview, show `Briefing` and a short explanatory subtitle. For a selected step, show a clickable back control plus `Briefing / <step label>`, textual state and formatted update time. For contact, show `Contato e kickoff`. Render `Editar` only for a ready editable step and make it call the supplied toggle. Never move the dialog close control into this component.

- [ ] **Step 5: Manually inspect the components in isolation through the integrated dialog after Task 4.**

Expected: desktop navigation always exposes full labels and step state; narrow layout keeps labels visible rather than collapsing to icon-only controls; focus is visible on all buttons.

## Task 2: Refine overview cards without changing their data contract

**Files:**

- Modify: `components/custom/BriefingReviewOverview/BriefingReviewOverview.tsx:49-151`

**Interfaces:**

- Consumes: existing `BriefingReviewOverviewProps` exactly as defined in `BriefingReviewOverview.types.ts`.
- Produces: the same `onSelectStep(step.id)` behavior, `loading` skeleton behavior, and 8-step overview API for `ClientBriefingReviewDialog`.

- [ ] **Step 1: Preserve the current public signature and status maps.**

Keep `steps`, `onSelectStep`, and `loading` untouched. Retain `STEP_ICONS`, `STATE_LABEL`, `formatDateTimeShort`, `LazyMotion`, and reduced-motion support so no caller or state loader changes.

- [ ] **Step 2: Recompose each card into a scan-friendly hierarchy.**

Use status icon/well, title, textual state, last-update line, and a directional affordance. Preserve semantic state colors but never omit textual state.

```tsx
<button
  type="button"
  onClick={() => onSelectStep(step.id)}
  className="group flex h-full w-full flex-col gap-3 rounded-2xl border px-4 py-3.5 text-left ..."
>
  <span className="flex items-start justify-between gap-3">
    <span className={iconWellClass}>
      {step.state === "completed" ? <RiCheckLine /> : <Icon />}
    </span>
    <RiArrowRightSLine className="text-fg-muted transition-transform duration-200 group-hover:translate-x-0.5" />
  </span>
  <span className="flex min-w-0 flex-col gap-1">
    <span className="truncate font-sans text-body-sm font-semibold text-fg">
      {step.label}
    </span>
    <span className={stateTextClass}>{STATE_LABEL[step.state]}</span>
    <span className="font-sans text-caption text-fg-muted">
      {step.updatedAt ? formatDateTimeShort(step.updatedAt) : "Sem atividade"}
    </span>
  </span>
</button>
```

- [ ] **Step 3: Keep the loading geometry aligned to the final overview.**

Maintain eight skeleton cards and the same responsive column model as the final grid, using `motion-reduce:animate-none` on the pulsing placeholders.

- [ ] **Step 4: Manually verify overview states.**

Expected: all-empty, in-progress and completed inputs remain visually distinguishable; selecting a card still invokes the existing callback; no label is clipped in the normal desktop rail/content width.

## Task 3: Reorganize the Contact/Kickoff area around intent

**Files:**

- Modify: `components/custom/ClientKickoffPanel/ClientKickoffPanel.tsx:15-62`

**Interfaces:**

- Consumes: unchanged `clientId`, `loadClientKickoff`, `logClientKickoffEvent`, `ClientKickoffDetail`, activity labels and `ClientKickoffActivityType`.
- Produces: unchanged create/update payload fields (`client_id`, `type`, `meeting_at`, `channel`, `channel_detail`, `note`) and current state updates after a successful submission.

- [ ] **Step 1: Keep the data lifecycle unchanged.**

Do not change `selectAction`, `submit`, `loadClientKickoff`, or the post-success state merge. Only expand line formatting where needed; retain the `useTransition` pending lock and existing error state.

- [ ] **Step 2: Build the kickoff summary first.**

Render the meeting/status card as the first content unit. Its heading, state badge, next/last meeting and action buttons must be legible before any historical records.

```tsx
<section className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-card">
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div>
      <p className="font-sans text-caption font-medium tracking-wide text-fg-muted uppercase">
        Próximo encontro
      </p>
      <h3 className="mt-1 font-display text-title font-semibold text-fg">
        {meetingLabel}
      </h3>
    </div>
    <span className={stageClass}>
      {CLIENT_KICKOFF_STAGE_LABELS[detail.stage]}
    </span>
  </div>
  <div className="mt-4 flex flex-wrap gap-2">
    {/* eligible existing action buttons */}
  </div>
</section>
```

- [ ] **Step 3: Keep progressive disclosure for the action form.**

Render the fields only while `action !== null`, directly below the action choices. Keep field labels, inline error copy, pending state, and cancel action; add a top label based on `CLIENT_KICKOFF_ACTIVITY_LABELS[action]` so the form explicitly names what will be registered.

- [ ] **Step 4: Reframe the activity list as a timeline.**

Keep existing labels, timestamp, creator, optional meeting time and note. Use the current border-left treatment plus a semantic icon/well for each item; avoid changing sort order or payload content.

- [ ] **Step 5: Manually verify the contact flow.**

Expected: schedule, reschedule, complete, no-show and note retain their existing available actions; choosing an action exposes only its relevant fields; pending disables duplicate submission; successful registration updates summary and timeline.

## Task 4: Integrate the persistent shell and pane transitions

**Files:**

- Modify: `components/custom/ClientBriefingReviewDialog/ClientBriefingReviewDialog.tsx:3-616`

**Interfaces:**

- Consumes: Task 1 components, existing `BriefingReviewOverview`, existing `ClientBriefingExport`, existing `ClientKickoffPanel`, and existing `StepBody`.
- Produces: a dialog where `activeContext` is replaced by `area: ClientBriefingArea`; active briefing step, edit lifecycle, cache, loaders, errors and close safety remain externally invisible and behaviorally identical.

- [ ] **Step 1: Replace the local context union with the shared area type.**

Import `ClientBriefingArea` from `ClientBriefingNavigationRail`. Replace `activeContext` state with:

```ts
const [area, setArea] = useState<ClientBriefingArea>("briefing")
```

In `reset` and the open/client effect, set `area` back to `"briefing"`. Retain `activeStep`, `stepCache`, `stepLoad`, `direction`, `editing`, and `isFinishingEdit` exactly as existing independent state.

- [ ] **Step 2: Make area and step navigation explicit.**

Use one area handler that clears transient step view only when moving to Contact, preserves cache, and refuses navigation while editing/finalizing. Use the existing `openStep` loader for rail selections. Back-to-overview must set area to `"briefing"`, clear `activeStep`, then reset step loading state.

```ts
function selectArea(next: ClientBriefingArea) {
  if (editing || isFinishingEdit || (next === "contact" && !canUseContact))
    return
  setArea(next)
  if (next === "contact") {
    setActiveStep(null)
    setStepLoad({ status: "idle" })
  }
}
```

- [ ] **Step 3: Replace the custom dialog header and two-button aside with the new shell.**

Keep `Dialog size="xl"` and full-height body behavior. Render the stable dialog header, then the rail and a flex content column. Do not alter `Dialog` itself.

```tsx
<Dialog size="xl" header={<ClientBriefingDialogHeader ... />} bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
  <BriefingWriterProvider clientId={clientId} flushRef={editorFlushRef}>
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      <ClientBriefingNavigationRail ... />
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <ClientBriefingContentHeader ... />
        <div className="relative min-h-0 flex-1 overflow-y-auto">{/* animated content pane */}</div>
      </section>
    </div>
  </BriefingWriterProvider>
</Dialog>
```

- [ ] **Step 4: Scope Motion to content only.**

Keep `AnimatePresence mode="wait"`. For overview/contact area changes, use opacity plus horizontal `x` 12–16 px; for opening/backing out of a step use existing direction with `x` 20–24 px. Keep rail and both headers outside `AnimatePresence`. In reduced-motion mode, use opacity-only 100–120 ms transitions.

```ts
const paneTransition = { duration: reduced ? 0.12 : 0.22, ease: EASE }
const areaEnter = reduced ? { opacity: 0 } : { opacity: 0, x: 14 }
const stepEnter = reduced
  ? { opacity: 0 }
  : { opacity: 0, x: direction > 0 ? 24 : -24 }
```

- [ ] **Step 5: Preserve all existing rendering branches inside the new content pane.**

Map overview loading/error/ready branches to `area === "briefing" && !activeStep`; map step loading/error/empty/ready branches to `area === "briefing" && activeStep`; map `ClientKickoffPanel` to `area === "contact"`. Keep `ClientBriefingExport` limited to ready briefing overview and `StepBody` unchanged.

- [ ] **Step 6: Perform manual end-to-end inspection.**

Inspect with a client that has no briefing, a partially complete briefing and a finalized briefing. In each relevant case, verify: open/close; rail state; overview-to-step-to-overview; Briefing-to-Contact-to-Briefing; edit then finish; close while editing; kickoff registration; loading/error branches; keyboard focus; narrow viewport; and reduced-motion preference.

## Task 5: Final visual and behavior review

**Files:**

- Review: `components/custom/ClientBriefingReviewDialog/ClientBriefingReviewDialog.tsx`
- Review: `components/custom/ClientBriefingReviewDialog/ClientBriefingDialogHeader.tsx`
- Review: `components/custom/ClientBriefingReviewDialog/ClientBriefingNavigationRail.tsx`
- Review: `components/custom/ClientBriefingReviewDialog/ClientBriefingContentHeader.tsx`
- Review: `components/custom/BriefingReviewOverview/BriefingReviewOverview.tsx`
- Review: `components/custom/ClientKickoffPanel/ClientKickoffPanel.tsx`

**Interfaces:**

- Consumes: completed Tasks 1–4 and the requirements in the linked spec.
- Produces: final human-reviewed presentation with no scope expansion.

- [ ] **Step 1: Compare the implementation to the approved wireframe and spec.**

Confirm the permanent rail, client identity/progress, two first-level areas, conditional step list, contextual content header, overview, step detail and kickoff hierarchy all exist. Remove any duplicate two-button side navigation or state-dependent dialog header left from the prior composition.

- [ ] **Step 2: Check accessibility and motion manually.**

Confirm visible focus on rail items, back/edit/close controls; readable non-color status text; `aria-current` on the selected step; no hidden icon-only navigation in narrow mode; and opacity-only reduced-motion transitions.

- [ ] **Step 3: Check visual stability manually.**

Confirm rail and headers do not shift when content loads, errors, changes area or opens a step. Confirm content has a single intentional scroll container and no horizontal overflow at narrow widths.

- [ ] **Step 4: Record the manual QA result in the delivery summary.**

Report the inspected states and any unresolved limitation. Do not run automated test, build, lint, typecheck, or Git commands.

## Plan Self-Review

- Spec coverage: Tasks 1 and 4 implement the shell, rail, navigation, header persistence, responsive behavior and Motion constraints. Task 2 implements overview hierarchy. Task 3 implements the Contact/Kickoff hierarchy and progressive disclosure. Task 5 covers accessibility, states and visual stability.
- Scope check: No task changes database, server action, permissions, validation, URL behavior, briefing rules or global `Dialog` styling.
- Constraint check: The plan explicitly excludes tests, builds, linters, typechecks and Git commands in favor of manual inspection, per repository instruction.
- Naming check: `ClientBriefingArea`, `ClientBriefingDialogHeader`, `ClientBriefingNavigationRail`, and `ClientBriefingContentHeader` are defined in Task 1 and consumed consistently in Task 4.
