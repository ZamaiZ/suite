# Briefing History Step — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Novo step `history` (“Histórico e metas”) entre `audience` e `finance` — experiências anteriores e expectativas — com autosave/complete no padrão existente.

**Architecture:** Payload jsonb em `client_briefing_steps`; UI em `ClientBriefingHistoryForm` com 2 `BriefingSectionCard`; condicionais e sanitize no domain layer.

**Tech Stack:** Next.js 16 App Router, Server Actions, Zod, `RadioGroup`, `useBriefingAutosave`.

## Global Constraints

- Identifiers in English; UI copy `pt-BR`.
- No direct `dayjs` imports; no new overlapping packages.
- No explanatory code comments unless requested.
- Do not run lint/typecheck/git unless the user asks.

## Design decisions (locked)

See [2026-09-03-briefing-history-design.md](../specs/2026-09-03-briefing-history-design.md).

## File map

| Path                                                           | Role                                     |
| -------------------------------------------------------------- | ---------------------------------------- |
| `supabase/migrations/20260911000000_briefing_step_history.sql` | Add `history` to step check              |
| `lib/briefing/steps.ts`                                        | Insert step between audience and finance |
| `lib/briefing/history.ts`                                      | Domain helpers                           |
| `lib/validations/briefing-history.ts`                          | Zod                                      |
| `app/actions/briefing/load-briefing-history.ts`                | Load                                     |
| `app/actions/briefing/save-briefing-history.ts`                | Save + complete                          |
| `components/custom/ClientBriefingHistoryForm/`                 | Form                                     |
| `ClientBriefingWorkspace.tsx`                                  | Wire step                                |

## Tasks

- [x] Task 0 — Spec + plan docs
- [x] Task 1 — Domain + validation + migration
- [x] Task 2 — Actions
- [x] Task 3 — UI
- [x] Task 4 — Workspace
- [ ] Task 5 — Manual verification checklist

## Out of scope

- Changing Marca marketing-tools questions; admin/export/PDF; external questionnaire numbering / emojis.
