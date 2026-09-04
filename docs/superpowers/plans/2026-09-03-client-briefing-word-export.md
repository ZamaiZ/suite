# Client Briefing Word Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate secure, versioned Word exports for finalized client briefings, including Kickoff context.

**Architecture:** Server-only modules build the sensitive snapshot, calculate its fingerprint and render the Word buffer. Guarded briefing actions persist metadata and private storage objects, while a focused client component exposes only export state and temporary signed downloads in the staff briefing overview.

**Tech Stack:** Next.js Server Actions, Supabase, `docx`, React, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-03-client-briefing-word-export-design.md`

## Global Constraints

- Require `canManageClientPortal` through `loadStaffClient` and `denyUnlessCanManage`.
- Export only finalized briefings.
- Keep plaintext passwords within server-only execution and persisted export snapshots.
- No direct authenticated access to export table rows or objects.
- Do not run tests, lint, typecheck, build, or `git` commands.

---

### Task 1: Export persistence

**Files:**
- Create: `supabase/migrations/20260916000000_client_briefing_exports.sql`

- [x] Create the private `clients` bucket, the versioned export table, indexes, unique-current constraint and service-role-only grants.

### Task 2: Snapshot and Word renderer

**Files:**
- Create: `lib/briefing/export-document.ts`

- [x] Read and normalize briefing, encrypted secret and kickoff data with the existing parsers.
- [x] Create a deterministic SHA-256 fingerprint and render a `.docx` buffer from the snapshot.

### Task 3: Guarded export actions

**Files:**
- Create: `app/actions/briefing/client-briefing-export.ts`
- Modify: `app/actions/briefing/index.ts`

- [x] Provide metadata, generation and signed-URL actions using the existing staff authorization boundary.

### Task 4: Briefing overview controls

**Files:**
- Create: `components/custom/ClientBriefingExport/ClientBriefingExport.tsx`
- Create: `components/custom/ClientBriefingExport/index.ts`
- Modify: `components/custom/ClientBriefingReviewDialog/ClientBriefingReviewDialog.tsx`

- [x] Render generation, stale state and signed-document controls solely in the finalized Briefing overview.

### Task 5: Delivery review

- [x] Confirm the code paths preserve the server-only secret boundary by inspection.
- [x] Do not run automated checks, per the explicit project and user constraints.
