# Briefing Accesses Step — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Novo step `accesses` (“Acessos”) após `website` — status por ferramenta, convites Google e credenciais WordPress/hospedagem — com autosave de metadados e segredos isolados/criptografados.

**Architecture:** Metadados em `client_briefing_steps` (`step = 'accesses'`). Senhas em `client_briefing_secrets` (ciphertext AES-256-GCM, chave `BRIEFING_SECRETS_KEY`). Load devolve só `secretFlags`; senha nunca retorna ao cliente. Sem reveal interno no v1.

**Tech Stack:** Next.js 16 App Router, Server Actions, Zod, `useBriefingAutosave`, `RadioGroup`, `BriefingChipField`, Node `crypto`.

## Global Constraints

- Identifiers in English; UI copy `pt-BR`.
- No direct `dayjs` imports; no new overlapping packages.
- No explanatory code comments unless requested.
- Do not run lint/typecheck/git unless the user asks.

## Design decisions (locked)

See [2026-09-03-briefing-accesses-design.md](../specs/2026-09-03-briefing-accesses-design.md).

## File map

| Path | Role |
|------|------|
| `supabase/migrations/20260912000000_briefing_step_accesses.sql` | Add `accesses` + secrets table |
| `lib/briefing/steps.ts` | Append accesses step |
| `lib/briefing/accesses.ts` | Domain helpers |
| `lib/briefing/secrets.ts` | Encrypt/decrypt + kinds |
| `lib/validations/briefing-accesses.ts` | Zod |
| `app/actions/briefing/load-briefing-accesses.ts` | Load |
| `app/actions/briefing/save-briefing-accesses.ts` | Save + complete |
| `app/actions/briefing/save-briefing-secret.ts` | Upsert/delete secret |
| `components/custom/ClientBriefingAccessesForm/` | Form |
| `ClientBriefingWorkspace.tsx` | Wire step |
| `.env.example` | `BRIEFING_SECRETS_KEY` |

## Tasks

- [x] Task 0 — Spec + plan docs
- [x] Task 1 — Domain + validation + migration + env
- [x] Task 2 — Actions
- [x] Task 3 — UI
- [x] Task 4 — Workspace
- [x] Task 5 — Manual verification checklist

## Manual verification

1. Migration aplicada + `BRIEFING_SECRETS_KEY` no `.env.local`.
2. Todos “Não” → Continuar libera.
3. WordPress “Sim” sem senha → bloqueia; com senha → salva; reload → hint “salva”.
4. Search Console “Sim” sem e-mail → bloqueia; e-mail válido → ok.
5. Outras com chips; “Não” limpa secrets órfãos.
6. Website Continuar → step Acessos.

## Out of scope

Reveal interno, export/admin/PDF, prefill Empresa, Vault/pgsodium, alterar steps anteriores.
