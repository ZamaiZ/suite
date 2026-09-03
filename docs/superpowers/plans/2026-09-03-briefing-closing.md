# Briefing Closing / Finalização — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Último step do briefing (“Considerações finais”), finalização com tela de obrigado, edição pós-envio no portal e badge de status na lista de clientes.

**Architecture:** Novo step `closing` em `client_briefing_steps`. Status de briefing no nível do cliente via `briefing_finalized_at` + `briefing_content_updated_at` em `clients`. Portal ganha fases `wizard | complete | editing`. Lista deriva `in_progress | finalized | edited_after_submit`.

**Tech Stack:** Next.js 16 App Router, Server Actions, Zod, Motion (`motion/react`), `useBriefingAutosave`, padrões existentes de step forms.

## Global Constraints

- Identifiers in English; UI copy `pt-BR`.
- No direct `dayjs` imports; use `@/lib/date-time`.
- No new overlapping packages; reuse Motion, Zod, existing UI primitives.
- No explanatory code comments unless requested.
- Do not run lint/typecheck/build/git unless the user asks.

## Design decisions (locked)

See [2026-09-03-briefing-closing-design.md](../specs/2026-09-03-briefing-closing-design.md).

## File map

| Path | Role |
|------|------|
| `docs/superpowers/specs/2026-09-03-briefing-closing-design.md` | Design gravado |
| `docs/superpowers/plans/2026-09-03-briefing-closing.md` | Este plano |
| `supabase/migrations/20260913000000_briefing_step_closing.sql` | Expand step check + client columns |
| `lib/briefing/steps.ts` | Append `closing` |
| `lib/briefing/closing.ts` | Domain helpers |
| `lib/briefing/status.ts` | Derive list status + labels |
| `lib/briefing/touch-content.ts` | `touchBriefingContentUpdatedAt` |
| `lib/validations/briefing-closing.ts` | Zod |
| `app/actions/briefing/load-briefing-closing.ts` | Load step |
| `app/actions/briefing/save-briefing-closing.ts` | Save + complete (+ finalize client) |
| `app/actions/briefing/load-briefing-meta.ts` | Meta from `clients` |
| `app/actions/briefing/index.ts` | Re-exports |
| Existing save actions + secrets + website-assets | Call touch after content write |
| `components/custom/ClientBriefingClosingForm/` | Step form |
| `components/custom/ClientBriefingCompleteScreen/` | Thank-you screen |
| `ClientBriefingWorkspace.tsx` | Phase machine + wire step 8 |
| `list-clients.ts` + `ClientsList.tsx` | Badge |

## Tasks

- [x] Task 0 — Spec + plan docs
- [x] Task 1 — Migration + domain
- [x] Task 2 — Actions
- [x] Task 3 — Closing form + complete screen
- [x] Task 4 — Workspace phases + accesses advance
- [x] Task 5 — Clients list badge
- [x] Task 6 — Manual verification checklist

## Manual verification

1. Migration applied.
2. Accesses Continuar → Considerações.
3. Não → Finalizar → tela obrigado; reload abre obrigado.
4. Sim sem texto bloqueia; com texto finaliza.
5. Editar → wizard; autosave em qualquer step → lista mostra “Editado após envio”.
6. Voltar ao resumo sem re-finalizar; `briefing_finalized_at` unchanged.
7. Cliente não finalizado: saves não setam badge de editado.

## Out of scope

Staff briefing viewer, field-level diff, email/notifications, un-finalize, changing prior step schemas.
