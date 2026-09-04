# Client Kickoff Implementation Plan

> **For agentic workers:** Execute in the current workspace without Git commands, tests, lint, typecheck, or build, as explicitly requested.

**Goal:** Add post-briefing kickoff scheduling, contact history, and list status for clients.

**Architecture:** Persist kickoff state on clients and immutable events in `client_activities`. Keep domain transitions in `lib/clients/kickoff.ts`, actions in `app/actions/clients`, and present the new capability as a lazily loaded Contact panel within the current briefing dialog.

**Tech Stack:** Next.js Server Actions, Supabase, React, Zod, existing Base UI components.

**Spec:** `docs/superpowers/specs/2026-09-03-client-kickoff-design.md`

## Global Constraints

- `completed` is terminal.
- Authorize with `canManageClientPortal` and require `briefing_finalized_at`.
- Do not change `clients.stage`.
- Do not run Git, tests, lint, typecheck, or build.

---

### Task 1: Persist the kickoff domain

**Files:**
- Create: `supabase/migrations/20260915000000_client_kickoff.sql`
- Modify: `lib/clients/types.ts`, `lib/clients/parse.ts`

- [ ] Add enums, client fields, activity table, constraints, indexes, RLS, and grants.
- [ ] Extend the shared client record/select/parser with kickoff state.

### Task 2: Add transition and validation contracts

**Files:**
- Create: `lib/clients/kickoff.ts`, `lib/validations/client-kickoff.ts`

- [ ] Define labels, transition validation, action availability, and kickoff activity parsing.
- [ ] Validate client id, event type, channel, optional detail/note, and civil meeting datetime.

### Task 3: Expose secure client actions

**Files:**
- Create: `app/actions/clients/load-client-kickoff.ts`, `app/actions/clients/log-client-kickoff-event.ts`
- Modify: `app/actions/clients/index.ts`

- [ ] Load current state and timeline after server-side authorization.
- [ ] Log allowed events and return a compact state patch and timeline activity.

### Task 4: Add the Contact panel

**Files:**
- Create: `components/custom/ClientKickoffPanel/*`, `components/custom/ClientKickoffTimeline/*`
- Modify: `components/custom/ClientBriefingReviewDialog/ClientBriefingReviewDialog.tsx`

- [ ] Render rail, briefing gate, lazy loading, contextual actions, channel picker, datetime picker, and timeline.
- [ ] Keep briefing editing isolated from panel navigation.

### Task 5: Project kickoff in the client list

**Files:**
- Modify: `app/actions/clients/list-clients.ts`, `components/custom/ClientsList/ClientsList.tsx`

- [ ] Select and map kickoff state.
- [ ] Render stage badge and scheduled-only time mark with the established date helpers.
