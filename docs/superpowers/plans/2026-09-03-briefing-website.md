# Briefing Website Step — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Novo step `website` após `finance` — identidade (logo + inventário + uploads), política de cores, sites que gosta/não gosta — com autosave/complete no padrão existente.

**Architecture:** Payload jsonb em `client_briefing_steps`; bytes em bucket Storage `briefing-assets` via Server Actions do portal (`requirePortalClient` + admin client). UI em `ClientBriefingWebsiteForm` com 3 `BriefingSectionCard`.

**Tech Stack:** Next.js 16 App Router, Server Actions, Supabase Storage, Zod, `BriefingChoiceCard` / `BriefingChipField` / `useBriefingAutosave`.

## Global Constraints

- Identifiers in English; UI copy `pt-BR`.
- No direct `dayjs` imports; no new overlapping packages.
- No explanatory code comments unless requested.
- Do not run lint/typecheck/git unless the user asks.

## Design decisions (locked)

See [2026-09-03-briefing-website-design.md](../specs/2026-09-03-briefing-website-design.md).

## File map

| Path                                                           | Role                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------- |
| `supabase/migrations/20260910000000_briefing_step_website.sql` | Add `website` to step check + create `briefing-assets` bucket |
| `lib/briefing/steps.ts`                                        | Append `{ id: "website", label: "Website" }`                  |
| `lib/briefing/website.ts`                                      | Domain helpers                                                |
| `lib/validations/briefing-website.ts`                          | Zod                                                           |
| `app/actions/briefing/load-briefing-website.ts`                | Load                                                          |
| `app/actions/briefing/save-briefing-website.ts`                | Save + complete                                               |
| `app/actions/briefing/website-assets.ts`                       | Upload / remove / signed URL                                  |
| `components/custom/BriefingAssetUpload/`                       | Upload UI                                                     |
| `components/custom/ClientBriefingWebsiteForm/`                 | Form                                                          |
| `ClientBriefingWorkspace.tsx`                                  | Wire step                                                     |

## Tasks

- [ ] Task 0 — Spec + plan docs (done when these files exist)
- [ ] Task 1 — Domain + validation + migration
- [ ] Task 2 — Actions
- [ ] Task 3 — UI
- [ ] Task 4 — Workspace
- [ ] Task 5 — Manual verification checklist

## Out of scope

- Color hex/picker; institutional photo step; auto palette extraction; background orphan GC.
