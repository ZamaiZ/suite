# Clients Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Clients page as a wide, premium operational list with Leads-style server-side search/filtering and Users-style row presentation.

**Architecture:** `ClientsPage` parses URL params and loads the filtered dataset on the server. `ClientsList` owns deep-link state for `?client=`, while focused client components render the toolbar, summary, skeleton and row; the existing briefing dialog remains the detail surface.

**Tech Stack:** Next.js 16.3.1, React 19.2.8, TypeScript, Tailwind CSS, Motion 13.1.0, React Icons, Supabase.

**Spec:** `docs/superpowers/specs/2026-09-03-clients-page-redesign-design.md`

## Global Constraints

- Do not create or run automated tests, builds, linters, typechecks, or Git commands; repository instructions prohibit them.
- Preserve `ClientBriefingReviewDialog`, portal permissions, existing client actions, and URL deep-link behavior.
- Search and filters are server-side; the client toolbar only debounces and serializes URL updates.
- Use existing semantic tokens and UI primitives; no new dependencies or raw color values.
- Main presentation is one wide list, not a grid or kanban.
- Preserve text + icon status communication, visible focus, reduced motion, and responsive no-horizontal-scroll behavior.

---

## File Structure

- Modify `lib/clients/href.ts` — typed Clients URL params and serialization.
- Modify `app/actions/clients/list-clients.ts` — filtered server query, lead-domain matching, closer options and summary counts.
- Modify `app/(protected)/clients/page.tsx` — parse/validate params and pass server results to the client surface.
- Create `components/custom/ClientsList/ClientsListToolbar.tsx` — debounced search and filters.
- Create `components/custom/ClientsList/ClientsSummary.tsx` — four compact result metrics.
- Create `components/custom/ClientsList/ClientListRow.tsx` — operational client row.
- Create `components/custom/ClientsList/ClientsListSkeleton.tsx` — shared list loading geometry.
- Modify `components/custom/ClientsList/ClientsList.types.ts` — contracts for params, options and summary.
- Modify `components/custom/ClientsList/ClientsList.tsx` — page shell, toolbar, summary, list, deep-link synchronization and transitions.
- Modify `app/(protected)/clients/loading.tsx` — route-level skeleton matching the final page.

## Task 1: Define URL state and server query contract

**Files:**
- Modify `lib/clients/href.ts`
- Modify `app/actions/clients/list-clients.ts`
- Modify `components/custom/ClientsList/ClientsList.types.ts`

**Interfaces:**
- Produces:

```ts
export type ClientsListParams = {
  q: string
  briefing: BriefingListStatus | null
  kickoff: ClientKickoffStage | null
  closer: string | null
}

export type ClientCloserOption = { id: string; name: string }
export type ClientsSummary = {
  total: number
  briefingInProgress: number
  briefingFinalized: number
  kickoffPending: number
}
export type ListClientsResult = {
  status: "success"
  clients: ClientListItem[]
  summary: ClientsSummary
  closerOptions: ClientCloserOption[]
}
```

- [ ] **Step 1: Extend `clientsListHref` without changing existing `client` semantics.**

Accept optional `q`, `briefing`, `kickoff`, `closer`, and `client`; trim `q`, validate enum values and UUIDs, omit empty values, and return `/clients` when no params remain.

```ts
export function clientsListHref(input: {
  q?: string
  briefing?: BriefingListStatus | null
  kickoff?: ClientKickoffStage | null
  closer?: string | null
  client?: string
} = {}): string
```

- [ ] **Step 2: Add typed params to `ClientsListProps`.**

Require `listParams`, `summary` and `closerOptions` alongside existing `clients` and `initialClientId`. Keep `clients` as `ClientListItem[]` so the dialog and existing row data remain compatible.

- [ ] **Step 3: Update `listClients` to accept validated list params.**

Use `requireCommercialMember`, query `clients` ordered by `converted_at desc`, join the related lead domain through `lead_id` or resolve matching lead IDs first, then apply closer and kickoff predicates. Keep the existing closer-name lookup and `deriveBriefingListStatus` mapping.

```ts
export async function listClients(
  params: ClientsListParams = { q: "", briefing: null, kickoff: null, closer: null },
): Promise<ListClientsState>
```

- [ ] **Step 4: Implement name/domain search exactly as a server-side two-source match.**

Sanitize `q` using the same forbidden PostgREST character set as Leads. If non-empty, query `leads` for matching `company_name` or `website_domain`, collect matching lead IDs, and constrain the client query to `company_name.ilike` or `lead_id.in(...)`. If neither source matches, return an empty successful result with zero summary counts.

- [ ] **Step 5: Derive briefing statuses and summary on the server.**

Map each row with `deriveBriefingListStatus`. Filter the derived status when `params.briefing` is set. Count total, in-progress/finalized briefings, and kickoff records whose stage is `none` or `scheduled` for the returned set. Return closer options from the existing closer-role query pattern, sorted by name.

## Task 2: Build the reusable list presentation components

**Files:**
- Create `components/custom/ClientsList/ClientsListToolbar.tsx`
- Create `components/custom/ClientsList/ClientsSummary.tsx`
- Create `components/custom/ClientsList/ClientListRow.tsx`
- Create `components/custom/ClientsList/ClientsListSkeleton.tsx`

**Interfaces:**
- Consumes: `ClientsListParams`, `ClientListItem`, `ClientsSummary`, `ClientCloserOption`, `clientsListHref`, existing `Input`, `Select`, `Button`, Motion and icon conventions.
- Produces: presentational components with no data fetching.

- [ ] **Step 1: Implement `ClientsListToolbar`.**

Mirror `LeadBoardToolbar`: keep a local `draft` query, synchronize it from `listParams.q`, wait 300 ms after trim changes, then call `router.replace(clientsListHref({ ...listParams, q: next }), { scroll: false })`. Use `useTransition` to expose `Input status="loading"`.

Render `Select` controls with icons for briefing, kickoff and closer. Add a clear button when any filter is set. Preserve `client` when replacing list params so an open dialog is not closed merely by a query update.

- [ ] **Step 2: Implement `ClientsSummary`.**

Render four compact metrics with label, value and semantic icon. Keep the summary subordinate to the page title; do not create a dashboard grid. Values come directly from server-returned `ClientsSummary`.

- [ ] **Step 3: Implement `ClientListRow`.**

Follow `TeamMemberRoleRow` dimensions and surface. Use a responsive grid that stacks below `sm` and exposes identity, domain, briefing, kickoff, closer/conversion and actions. Make the primary identity area an anchor when `canManagePortal` is true; preserve modified-click behavior and `clientsListHref({ ...listParams, client: id })`. Keep `ClientCardMenu` in its own action cell.

```tsx
<li className="grid gap-3 px-4 py-3 transition-[background-color] duration-150 ease-out hover:bg-hover sm:grid-cols-[minmax(0,1.45fr)_minmax(10rem,0.85fr)_minmax(10rem,0.85fr)_auto] sm:items-center">
  {/* identity link, briefing status, kickoff status, metadata and portal menu */}
</li>
```

Use icons for statuses and the existing `getCivilFollowUpKind` to render temporal markers (`Hoje`, `Atrasado`, time). Users without permission receive the same row styling without a link.

- [ ] **Step 4: Implement `ClientsListSkeleton`.**

Use the Users loading geometry: editorial header, summary bars, toolbar bars and five list rows with staggered pulse delays. Export a `ClientsListSkeleton` component so route loading and client transition loading share the same shape.

## Task 3: Compose `ClientsList` with URL/deep-link state

**Files:**
- Modify `components/custom/ClientsList/ClientsList.tsx`

**Interfaces:**
- Consumes: Task 1 server contracts and Task 2 components.
- Produces: the same `ClientBriefingReviewDialog` open/close behavior, with filtered list navigation.

- [ ] **Step 1: Replace the narrow max-width wrapper with the Users page shell.**

Use `min-h-0 flex-1 overflow-y-auto px-[var(--page-padding-x)] py-8`, then `mx-auto max-w-6xl`. Add eyebrow, title/count, description, summary and toolbar in that order.

- [ ] **Step 2: Synchronize `?client=` with list params.**

Keep `readClientIdFromLocation`, `popstate`, `openClient`, and `closeClient`, but build every URL through `clientsListHref({ ...listParams, client })`. When filtered results no longer contain the selected client or `canManagePortal` is false, clear local selection and replace the URL without `client` while preserving active filters.

- [ ] **Step 3: Render the list surface and transitions.**

Wrap rows in `LazyMotion`/`AnimatePresence` using `opacity + translateY(8px)` with capped row stagger. Render the list as one `ul` surface with `divide-y divide-border-subtle overflow-hidden rounded-xl border border-border bg-surface shadow-card`. Render distinct empty copy for no clients vs no matching filters.

- [ ] **Step 4: Keep the dialog mounted with the selected client.**

Pass the selected client’s `id` and `company_name` to `ClientBriefingReviewDialog`. Do not duplicate dialog state, briefing state or kickoff state in the page list.

## Task 4: Wire the server page and loading route

**Files:**
- Modify `app/(protected)/clients/page.tsx`
- Modify `app/(protected)/clients/loading.tsx`

**Interfaces:**
- Consumes: `ClientsListParams`, `clientsListHref` validators and `listClients(params)`.
- Produces: server-rendered filtered page and matching streaming/loading surface.

- [ ] **Step 1: Parse and validate `searchParams` in `ClientsPage`.**

Read `q`, `briefing`, `kickoff`, `closer` and `client` with `firstSearchParam`; trim/sanitize query, accept only known enum values and valid UUIDs, then call `listClients(parsedParams)`. Preserve the existing error throw behavior.

- [ ] **Step 2: Pass parsed data to `ClientsList`.**

Provide `clients`, `initialClientId`, `listParams`, `summary` and `closerOptions`. The selected client must be derived from the filtered result, preserving the existing permission guard.

- [ ] **Step 3: Align route loading with the final page.**

Replace the three generic card pulses with the shared `ClientsListSkeleton` or an equivalent server-safe composition: header, four metric placeholders, toolbar placeholders and five wide list rows.

## Task 5: Final manual review against the approved spec

**Files:**
- Review all files changed in Tasks 1–4.

**Interfaces:**
- Consumes: completed page, server loader and existing briefing dialog.
- Produces: no scope expansion and a concise delivery report.

- [ ] **Step 1: Check functional paths manually without automated commands.**

Exercise initial page load, search by company, search by domain, each filter, combined filters, clear filters, browser back/forward, modified-click behavior, opening/closing the dialog, and filtering while a dialog is open.

- [ ] **Step 2: Check visual states manually.**

Inspect populated list, no clients, no search result, no filter result, loading, error, long company/domain text, missing closer, each kickoff state, narrow viewport and reduced-motion preference.

- [ ] **Step 3: Confirm the visual relationship to references.**

The page must read like Users in shell/density and like Leads in toolbar/debounce/filter behavior. The screenshot’s large empty canvas must be replaced by a full-width operational surface.

- [ ] **Step 4: Report only actual state.**

Do not claim automated validation, tests, build, lint, typecheck or Git integration; those actions are explicitly excluded by repository rules and the user request.

## Plan Self-Review

- Spec coverage: Tasks 1–2 cover URL/query contracts and reusable visual primitives; Task 3 covers composition, deep links, responsive list and dialog preservation; Task 4 covers route parsing/loading; Task 5 covers the acceptance criteria manually.
- Type consistency: `ClientsListParams`, `ClientsSummary`, `ClientCloserOption` and `ListClientsResult` are introduced in Task 1 and consumed by Tasks 2–4.
- Scope: No schema changes, no new permissions, no dialog rewrite, no grid/kanban/pagination/realtime.
- Constraint compliance: no automated tests, builds, lint, typecheck or Git commands are included as execution steps.
