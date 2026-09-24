# Prospecção Persistence Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist valid Business Listings pages, reject malformed candidates individually, and make paid collection failures diagnosable without exposing business data or automatically repeating a possibly charged request.

**Architecture:** Keep the existing page claim and receipt flow. Add stage-aware server logging with safe error classification, validate known database constraints before persistence, and update `complete_prospecting_page` in a new migration so row-level data violations roll back only that candidate while system errors still fail the full receipt.

**Tech Stack:** Next.js server actions, TypeScript, Supabase PostgREST RPC, PostgreSQL PL/pgSQL migrations.

**Spec:** `docs/superpowers/specs/2026-09-24-prospeccao-persistencia-segura-design.md`

## Global Constraints

- Do not run `git`, `typecheck`, `build`, `lint`, or `test`.
- Do not create or run tests.
- Do not make another paid DataForSEO search during implementation.
- Do not log raw vendor payloads, company names, phones, websites, credentials, raw database `details`, or raw database `hint` values.
- Preserve known costs and never retry a cursor automatically after an uncertain or failed paid page.
- Do not modify an existing migration; add a new corrective migration.

## Review Focus

- A company title longer than 300 characters is rejected without discarding other records from its page.
- A rating outside 0–5 is rejected without discarding valid records.
- Negative or noninteger review/photo counts are rejected without discarding valid records.
- A listing with only one coordinate or an out-of-range coordinate is rejected without discarding valid records.
- Schema, authorization, and infrastructure errors still fail the page and are not misclassified as candidate rejections.

---

### Task 1: Record failure stage and safe database error classification

**Files:**
- Modify: `app/actions/prospecting/runs.ts`
- Modify: `lib/prospecting/conflicts.ts`

**Interfaces:**
- Consumes: `advanceProspectingRunAction`, `failPage`, and Supabase RPC error objects already used in this module.
- Produces: Structured server logs with stage, run/page identifiers, known cost, item counts, SQLSTATE/PostgREST code, and a whitelisted constraint name when present.

- [ ] **Step 1: Define the bounded stage vocabulary**

Use the union `"normalize" | "conflicts" | "classify" | "complete_rpc"` for the post-vendor work. Set the stage immediately before each operation so an exception log points to the exact boundary.

- [ ] **Step 2: Extract only safe error fields**

Add a helper that takes a Supabase error and returns its code plus a constraint identifier matched only by `constraint "([a-zA-Z0-9_]+)"` and present in an exact set of constraints from the existing prospecting migration. Do not include raw message, details, or hint values in logs.

```ts
function safeDatabaseFailure(error: {
  code?: string
  message?: string
} | null) {
  const constraint = error?.message?.match(
    /constraint "([a-zA-Z0-9_]+)"/i,
  )?.[1]
  return {
    code: error?.code ?? "unknown",
    constraint: constraint ?? null,
  }
}
```

- [ ] **Step 3: Log the RPC error branch**

Before calling `failPage`, emit `[prospecting] page completion RPC failed` with `runId`, `pageId`, `stage: "complete_rpc"`, `safeDatabaseFailure(completionError)`, `costUsd`, and `itemCount`. Do not log `items` or provider data.

- [ ] **Step 4: Make the outer catch stage-aware**

Emit the current stage, `runId`, `pageId`, confirmed page cost, received item count, and only `error.name` for thrown JavaScript errors. Keep the user-facing and persisted error message generic.

- [ ] **Step 5: Bound conflict lookup filter URLs**

In `lib/prospecting/conflicts.ts`, split each de-duplicated `.in()` value list so the URL-encoded filter expression stays under 3,500 characters. Run chunks sequentially per table and keep the existing five table lookups parallel. Combine returned rows; on the first error, return that error unchanged so its SQLSTATE remains available as the wrapped cause.

- [ ] **Step 6: Inspect the action paths statically**

Read the edited branches and confirm both the Supabase returned-error path and thrown-exception path carry the stage while preserving the existing known-cost `failPage` receipt.

### Task 2: Reject candidate values that violate known constraints

**Files:**
- Create: `lib/prospecting/candidate-validation.ts`
- Modify: `lib/prospecting/candidates.ts`
- Modify: `app/actions/prospecting/runs.ts`

**Interfaces:**
- Consumes: `NormalizedProspectingCandidate` from `lib/prospecting/types.ts`; preserves finite fractional/negative counts through normalization so validation can reject rather than erase them.
- Produces: `validateNormalizedCandidate(candidate): string | null`, returning a stable rejection code or `null`.

- [ ] **Step 1: Implement stable validation codes**

Return the first matching code in this order: `invalid_coordinates`, `invalid_rating`, `invalid_reviews_count`, `invalid_total_photos`, `company_name_too_long`. A missing company name remains valid here because the SQL schema and classification allow a null name.

```ts
export function validateNormalizedCandidate(
  candidate: NormalizedProspectingCandidate,
): string | null {
  const hasLatitude = candidate.latitude !== null
  const hasLongitude = candidate.longitude !== null
  if (hasLatitude !== hasLongitude) return "invalid_coordinates"
  if (
    (candidate.latitude !== null &&
      (candidate.latitude < -90 || candidate.latitude > 90)) ||
    (candidate.longitude !== null &&
      (candidate.longitude < -180 || candidate.longitude > 180))
  ) return "invalid_coordinates"
  if (candidate.rating !== null && (candidate.rating < 0 || candidate.rating > 5)) {
    return "invalid_rating"
  }
  if (
    candidate.reviewsCount !== null &&
    (!Number.isInteger(candidate.reviewsCount) ||
      candidate.reviewsCount < 0 ||
      candidate.reviewsCount > 2_147_483_647)
  ) return "invalid_reviews_count"
  if (
    candidate.totalPhotos !== null &&
    (!Number.isInteger(candidate.totalPhotos) ||
      candidate.totalPhotos < 0 ||
      candidate.totalPhotos > 2_147_483_647)
  ) return "invalid_total_photos"
  if (
    candidate.companyName !== null &&
    Array.from(candidate.companyName.trim()).length > 300
  ) {
    return "company_name_too_long"
  }
  return null
}
```

- [ ] **Step 2: Count rejected normalized results before conflict lookup**

Call the validator after `normalizeBusinessListing`. Increment the page rejection count and skip invalid candidates; continue the existing missing-identity rejection behavior. Keep rejection reasons out of business-facing text and log only aggregated stable rejection codes.

- [ ] **Step 3: Keep rejected results in receipt arithmetic**

Pass the combined count of missing-identity and invalid-candidate results as `p_rejected_count`. Ensure only validated candidates participate in conflict lookup and classification.

- [ ] **Step 4: Inspect all database-bound candidate fields statically**

Compare the validator with constraints in `20260925000000_prospecting_business_listings.sql`. Confirm every validated field has matching source types and that optional values remain `null`.

### Task 3: Isolate known row-level persistence failures in PostgreSQL

**Files:**
- Create: `supabase/migrations/20261005000000_prospecting_candidate_isolation.sql`

**Interfaces:**
- Consumes: Existing `complete_prospecting_page(uuid, uuid, integer, integer, text, jsonb, integer, numeric)` and the validated candidate JSON produced by Task 2.
- Produces: Same RPC signature and outcome shape, with candidate-level rejection count included in page/run counters.

- [ ] **Step 1: Copy the current function definition exactly**

Copy `complete_prospecting_page` from `20260925000000_prospecting_business_listings.sql` into the new migration, retaining its authorization, page lease, cursor, cost, and run-state checks. Do not edit the older migration.

- [ ] **Step 2: Wrap each candidate’s two writes in one exception block**

Place the `prospecting_candidates` upsert and `prospecting_run_candidates` upsert inside one PL/pgSQL `BEGIN ... EXCEPTION` block. Keep `normalized_count`, acceptance, ambiguity, and duplicate increments after both writes succeed.

- [ ] **Step 3: Catch only whitelisted candidate check constraints**

Use `GET STACKED DIAGNOSTICS` to read the failed constraint name after `check_violation`. Increment the local rejected count only for these existing candidate constraints: `prospecting_candidates_name_check`, `prospecting_candidates_coordinates_check`, `prospecting_candidates_rating_check`, `prospecting_candidates_counts_check`, `prospecting_run_candidates_position_check`, `prospecting_run_candidates_territory_check`, `prospecting_run_candidates_category_check`, `prospecting_run_candidates_review_check`, and `prospecting_run_candidates_conflict_check`. Re-raise every other check violation and every other SQLSTATE. The TypeScript validator handles the known numeric and coordinate input bounds before the RPC.

- [ ] **Step 4: Preserve page counts and atomic receipt**

Initialize the local rejection count from `p_rejected_count`. Compute `received_count` as successful normalized candidates plus all rejected candidates. Keep the page receipt, cursor, totals, and actual cost in the existing outer transaction so system errors roll back the whole completion.

- [ ] **Step 5: Preserve function privileges**

Repeat the existing revoke/grant statements for this exact function signature. Keep the function `SECURITY DEFINER` and `SET search_path = ''`.

- [ ] **Step 6: Review the migration statically against the current function**

Compare declarations, guards, return JSON, counters, and grants line by line. Confirm only candidate-level error isolation and rejection accounting changed.

### Task 4: Record incident evidence and deployment requirements

**Files:**
- Create: `docs/auditoria/evidencias/2026-09-24-prospeccao-persistencia/README.md`

**Interfaces:**
- Consumes: User-provided run/page records and the migration from Task 3.
- Produces: Redacted incident record and read-only SQL needed to compare installed function/migration state.

- [ ] **Step 1: Record observed facts without personal or business data**

Document three failed first pages for `construction_company` in Guarulhos, each with a confirmed cost of US$ 0.084, zero fetched candidates, and the same generic failure. Use only the last eight characters of each run/page UUID if identifiers are needed.

- [ ] **Step 2: Record the uncertainty accurately**

State that the generic error covers both the completion RPC error branch and thrown errors before the RPC; do not claim which exact stage failed until the new stage log identifies it.

- [ ] **Step 3: Add read-only migration comparison SQL**

Include a query against `pg_proc`/`pg_get_functiondef` for `complete_prospecting_page` and a query of `prospecting_run_pages` cost/status totals. Do not include service credentials or tokens.

- [ ] **Step 4: State paid verification boundary**

Record that no paid search was run during implementation and that any future live verification incurs the UI-confirmed estimated cost for the selected page.

### Task 5: Final static review

**Files:**
- Review: `app/actions/prospecting/runs.ts`
- Review: `lib/prospecting/candidate-validation.ts`
- Review: `supabase/migrations/20261005000000_prospecting_candidate_isolation.sql`
- Review: `docs/auditoria/evidencias/2026-09-24-prospeccao-persistencia/README.md`

**Interfaces:**
- Consumes: Deliverables from Tasks 1–4.
- Produces: Change summary with explicit validation limits; no test/build claims.

- [ ] **Step 1: Trace the page lifecycle from claim to final receipt**

Verify every success path completes once, every known-cost failure uses the existing failure receipt once, and every unknown-cost path prevents automatic retry.

- [ ] **Step 2: Check privacy and accounting invariants**

Confirm no raw result or contact data reaches logs; invalid candidates increase rejected counts; accepted/ambiguous/duplicate counts include only successfully written rows; and cost is not added twice.

- [ ] **Step 3: Report unverified deployment state plainly**

Do not claim the remote migration is applied or a paid search is fixed until the database definition and a real post-change run are observed. Do not start that paid run as part of this plan.

### Follow-up: Disambiguate the completion receipt counters

The operator applied the first corrective migration and ran a paid page. The
new log reported SQLSTATE `42702` at `complete_rpc` after 200 items were
received. Static inspection found PL/pgSQL locals named `received_count` and
`normalized_count` colliding with columns updated on `prospecting_run_pages`.
Migration `20261006000000_prospecting_candidate_variable_resolution.sql`
replaces those local names with `v_received_count` and `v_normalized_count`.
Apply this new migration before another paid run; the failed retest already
cost US$ 0.084.
