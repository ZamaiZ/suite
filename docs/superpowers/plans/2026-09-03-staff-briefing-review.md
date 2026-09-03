# Staff Briefing Review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na suite, quem gerencia o portal do cliente acompanha o briefing em um dialog quase fullscreen (somente leitura), com URL `?client=`, enquanto copiar/gerar/rotacionar saem para o menu `⋯` do card.

**Architecture:** Fluxo staff paralelo ao portal — não reutiliza `ClientBriefingWorkspace` nem os forms. Overview leve → detalhe lazy por step via viewers read-only. Auth: `loadStaffClient` + `denyUnlessCanManage`. URL espelha o padrão `?lead=` do LeadBoard (`pushState`/`popstate`).

**Tech Stack:** Next.js 16 App Router, Server Actions, Motion (`LazyMotion`/`AnimatePresence`), Base UI `Menu`, `Dialog` `size="xl"`, `react-icons/ri`, `@/lib/date-time`.

## Global Constraints

- Identifiers in English; UI copy `pt-BR`.
- No direct `dayjs`; use `@/lib/date-time`.
- No new packages with overlapping roles.
- No explanatory code comments.
- Do not run lint/typecheck/build/git unless the user asks.
- Never import `lib/supabase/admin.ts` from `components/`.

## Design decisions (locked)

See [2026-09-03-staff-briefing-review-design.md](../specs/2026-09-03-staff-briefing-review-design.md).

## File map

| Path | Role |
|------|------|
| `lib/clients/href.ts` | `isClientId`, `clientsListHref` |
| `app/actions/clients/list-clients.ts` | `canManagePortal` |
| `app/(protected)/clients/page.tsx` | `initialClientId` |
| `components/custom/ClientsList/*` | URL sync, gated card, dialog + menu |
| `components/custom/ClientCardMenu/*` | Portal actions menu |
| `app/actions/briefing/load-staff-briefing-overview.ts` | Overview |
| `app/actions/briefing/load-staff-briefing-step.ts` | Step payload |
| `app/actions/briefing/reveal-staff-briefing-secret.ts` | Reveal secret |
| `app/actions/briefing/sign-staff-briefing-website-asset.ts` | Sign asset |
| `lib/briefing/review-step-state.ts` | Step state helper |
| `components/custom/ClientBriefingReviewDialog/*` | Dialog shell |
| `components/custom/BriefingReviewOverview/*` | Tile grid |
| `components/custom/BriefingReviewField/*` | Read primitives |
| `components/custom/BriefingReviewSecretField/*` | Secret UI |
| `components/custom/BriefingReviewCompany` … `Closing` | Step viewers |

## Tasks

- [x] Task 0 — Spec + plan docs
- [x] Task 1 — List gate + URL helpers + card menu
- [x] Task 2 — Staff briefing actions
- [x] Task 3 — Review dialog shell + overview
- [x] Task 4 — Read primitives + step viewers
- [x] Task 5 — Manual verification checklist

## Manual verification

1. Closer do cliente: card + `⋯` + dialog + overview + drill + revelar + asset.
2. Comercial sem manage: card estático, sem `⋯`.
3. Admin / commercial_manager / customer_success: qualquer cliente.
4. `?client=` deep-link + browser back.
5. Briefing vazio / parcial / finalizado / editado após envio.
6. Gerar / copiar / rotacionar (confirm) via menu; reveal dialog de código.
7. Confirm `ClientDetailDialog` no longer mounted from `/clients`.

## Out of scope

Realtime, refresh button, `?step=`, edit from suite, audit table for reveals, keeping `ClientDetailDialog` as portal ficha.
