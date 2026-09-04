# Client Briefing Word Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompose the generated briefing Word as a neutral executive document with semantic, human-readable content.

**Architecture:** Keep snapshot, fingerprint, storage and authorization intact. Replace only the generic document composer with typed display adapters and reusable Word layout primitives for styles, metadata grids, tables, callouts, header and footer.

**Tech Stack:** Next.js, TypeScript, `docx` 9.7.1.

**Spec:** `docs/superpowers/specs/2026-09-03-client-briefing-word-visual-design.md`

## Global Constraints

- Use Inter in every visible document run.
- Use A4 portrait with the visual tokens defined by the spec.
- Never expose plaintext passwords outside server-only snapshot generation or the generated document.
- Preserve private storage, signed URL and `canManageClientPortal` behavior.
- Do not run tests, lint, typecheck, build or `git` commands.

---

### Task 1: Document design system

**Files:**
- Modify: `lib/briefing/export-document.ts`

**Produces:** Reusable helpers for styled paragraphs, metadata grids, tables, real bullet lists, headers, footers and sensitive callouts.

- [x] Encode Inter styles, A4 geometry, header/footer furniture and document tokens with `docx` primitives.

### Task 2: Semantic briefing adapters

**Files:**
- Modify: `lib/briefing/export-document.ts`

**Consumes:** `ClientBriefingExportDocument` raw snapshot.

**Produces:** Human-readable content for Company, Brand, Audience, History, Finance, Website, Accesses, Closing and Kickoff.

- [x] Replace recursive object flattening with per-step adapters.
- [x] Resolve finance selections from Brand products/services and map enums to display labels.
- [x] Keep map and decrypted secret content in their correct sections.

### Task 3: Integration review

**Files:**
- Modify: `docs/superpowers/plans/2026-09-03-client-briefing-word-visual.md`

- [x] Confirm by inspection that snapshot, fingerprint, export action and signed download interfaces are unchanged.
- [x] Do not run automated checks, per explicit constraints.
