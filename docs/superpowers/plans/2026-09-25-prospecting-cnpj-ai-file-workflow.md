# Prospecting CNPJ AI File Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace BigQuery CNPJ lookup with one complete Markdown research file per run, CSV import staged in small chunks, and an atomic reviewable import into the existing CNPJ confirmation flow.

**Architecture:** A server Route Handler streams a complete run export as Markdown. The browser parses the returned CSV and sends bounded chunks to authenticated Server Actions, which store only temporary staging rows; one database function validates exact run coverage and applies suggestions transactionally. Existing candidate review and confirmation remain the only path that writes a confirmed CNPJ to a candidate or lead. BigQuery execution code and credentials are removed while historical confirmed values and match records are retained.

**Tech Stack:** Next.js 16 App Router Route Handlers and Server Actions, React client UI, Supabase/PostgreSQL migration and security-definer RPCs, TypeScript, Zod, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-25-prospecting-cnpj-ai-file-workflow-design.md`

## Global Constraints

- Do not execute `git`, `typecheck`, `build`, `lint`, or `test`.
- Do not add tests or run tests.
- Read relevant installed Next.js documentation before implementing Route Handlers or Server Actions.
- Follow `.agents/skills/suite-frontend` and its token, component, and writing references for UI changes.
- Keep all CNPJ file processing server-authorized and scoped to a commercial member and one prospecting run.
- Preserve confirmed CNPJ values and their historical match references; use forward-only migrations.
- Do not call an AI provider or public CNPJ lookup from the Suite.
- Export all candidates in one Markdown file per run, regardless of pagination, filters, selection, or count.
- Stage imports in bounded chunks; no candidate or match data changes until a complete, exact-coverage import commits atomically.

## Review Focus

- A CSV with missing, duplicate, changed, or foreign run/candidate IDs never applies business data; manually review the staging finalizer against the import contract.
- A CNPJ with invalid check digits or a `found` row without safe source evidence never becomes a suggestion; manually review the shared parser and database constraints.
- A pre-confirmed candidate remains untouched by import; manually review the finalizer's locking and skip logic and the existing confirmation RPC boundary.
- A large file or interrupted chunk upload leaves no visible partial suggestions; manually review staging expiry, chunk ownership, and commit state transitions.
- Old confirmed CNPJ references remain usable after BigQuery code retirement; manually review migration dependencies, source mapping, RLS, and the confirmation dialog query.

---

### Task 1: Establish the portable CNPJ file contracts

**Files:**
- Create: `lib/prospecting/cnpj-files.ts`
- Create: `lib/prospecting/cnpj-csv.ts`

**Interfaces:**
- `CnpjResearchCandidate` and `CnpjResearchMatch`: source-independent transport types declared in `lib/prospecting/cnpj-files.ts`; match type includes researched registration city/state separately from the candidate's original city/state.
- `renderCnpjResearchMarkdown(run, candidates, exportedAt): AsyncIterable<string>` yields a complete single-file Markdown document with the fixed CSV header and one encoded candidate row per candidate.
- `parseCnpjResearchCsv(chunks: AsyncIterable<Uint8Array> | ReadableStream<Uint8Array>): AsyncIterable<CnpjCsvRow>` parses UTF-8 RFC 4180 records including quoted commas, escaped quotes, and embedded newlines without loading the whole CSV into one string.
- `validateCnpjCsvRow(row): CnpjCsvRowValidation` validates exact columns, identifiers, research status, CNPJ check digits, safe HTTPS source URL and date, and field lengths.

- [x] **Step 1: Define shared types and immutable CSV header**
  Add the exact 21-column ordered header from the approved spec, including separate `matched_city` and `matched_state_code` output fields, and type the `found`, `not_found`, and `ambiguous` row variants as a discriminated union. Keep source fields optional only for the two non-found variants.
- [x] **Step 2: Render the Markdown instructions and source rows**
  Stream all candidate context as a fenced JSON payload inside the Markdown; include run ID, export timestamp, expected row count, official-source preference, identity checks, no-guess instructions, the exact CSV output header, and the requirement to preserve IDs and return only CSV. JSON is input data only; the downloaded artifact remains one `.md` file.
- [x] **Step 3: Implement the streaming CSV record parser**
  Parse `Uint8Array` chunks with `TextDecoder` streaming mode. Track quoted-field state across chunk boundaries and reject unterminated quotes, invalid UTF-8, extra/missing fields, malformed headers, and unsupported row endings with a row/column diagnostic.
- [x] **Step 4: Add row validation and safe URL handling**
  Reuse `normalizeCnpj` and `isValidCnpj`; cap text fields to the existing database column limits; require HTTPS source URLs for `found`; parse dates and normalize them to ISO strings. Do not use descriptive fields as identity keys.
- [x] **Step 5: Review the serialization contract manually**
  Inspect the CSV encoder and parser together against quoted commas, quotes, line breaks, empty cells, UTF-8 accents, and IDs. Do not add or execute tests.

### Task 2: Add temporary import staging and atomic database commit

**Files:**
- Create: `supabase/migrations/20261008000000_prospecting_cnpj_file_import.sql`

**Interfaces:**
- `public.create_prospecting_cnpj_file_import(p_run_id uuid, p_actor_id uuid)` creates an actor-owned staging session and derives the expected candidate count from the database.
- `public.stage_prospecting_cnpj_file_chunk(p_import_id uuid, p_run_id uuid, p_actor_id uuid, p_chunk_index integer, p_rows jsonb)` accepts at most 50 validated rows and stores them only in temporary import tables.
- `public.commit_prospecting_cnpj_file_import(p_import_id uuid, p_actor_id uuid)` verifies the full candidate set for the run and applies all outcomes in one database transaction; repeat commits return the persisted summary without duplicate data.
- `public.abort_prospecting_cnpj_file_import(p_import_id uuid, p_actor_id uuid)` deletes only that member's uncommitted staging session.
- A partial unique index for `source = 'ai_research'` on `(run_id, candidate_id, cnpj)` prevents a later upload of the same result from creating another suggestion.
- Staging session rows expire after 24 hours; creating a session or staging a chunk removes expired sessions and cascades their rows.

- [x] **Step 1: Add import session and row tables**
  Store session ID, run ID, actor ID, server-derived expected candidate count, received row count, chunk count, state (`staging`, `committed`, `aborted`), expiry, and timestamps. Store candidate ID, source row number, normalized research fields, and chunk index in a child table with unique `(import_id, candidate_id)` and `(import_id, chunk_index, candidate_id)` constraints. Enable RLS, revoke direct client access, and grant function execution only to the intended roles.
- [x] **Step 2: Add authenticated session and staging RPCs**
  Require `p_actor_id = auth.uid()` and commercial membership. Create sessions only for visible runs; derive their expected candidate count in SQL. For each staged chunk, confirm every candidate belongs to that run, enforce chunk size 1–50, restrict rows to the shared schema, and reject duplicate candidate IDs. Keep all changes confined to staging.
- [x] **Step 3: Implement a single transactional finalizer**
  Lock the import session. Require all staged rows to share the run ID and require exact equality between staged candidate IDs and all current candidate IDs in the run. Recheck CNPJ/source constraints and expiry. For a `found` candidate with no existing confirmed CNPJ, create a completed CNPJ result group, attempt, and match using groups of no more than 50; use source `ai_research`, the checked-at date as the source date, the provided HTTPS URL, and map `matched_city`/`matched_state_code` to the researched match location. Reuse an existing same-run, same-candidate, same-CNPJ AI suggestion instead of inserting a duplicate. For `not_found` and `ambiguous`, write their respective statuses without a match. Count already-confirmed candidates as skipped and never change their CNPJ, confirmation metadata, or linked lead.
- [x] **Step 4: Make retry and expiry behavior safe**
  Commit all match, attempt, candidate-status, and session-state changes in the same transaction. Persist a summary on successful commit; return it unchanged on repeated commit. Ensure abort/expiry can remove only staging data and cannot remove historical CNPJ matches.
- [x] **Step 5: Retire obsolete database job entry points without removing historical matches**
  Drop only the old create/claim/start/record BigQuery job RPCs. Keep match, attempt, batch, RLS, and confirmation relationships needed to read historical suggestions and the newly imported review matches. Map any legacy active/error candidate statuses to `not_searched`, then narrow current status constraints to states used by the file flow while preserving `confirmed`, `suggestion`, `needs_review`, and `not_found` data.
- [x] **Step 6: Manually review migration dependency order**
  Inspect every dropped function dependency, FK, RLS policy, source constraint, and transaction boundary against `20261007000000_prospecting_cnpj_enrichment.sql`. Do not apply the migration to a live Supabase project from this task.

### Task 3: Implement full-run Markdown download

**Files:**
- Create: `app/api/prospecting/[runId]/cnpj-research/route.ts`
- Modify: `lib/prospecting/cnpj-files.ts`

**Interfaces:**
- `GET /api/prospecting/{runId}/cnpj-research` returns a streamed UTF-8 Markdown attachment named `prospecting-cnpj-{runId}.md`.
- The handler derives actor identity from the authenticated session and never accepts candidate data from the browser.

- [x] **Step 1: Read and follow installed Route Handler documentation**
  Use `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` and the installed route reference. Keep this route under `app/api`, away from page segment collisions.
- [x] **Step 2: Authenticate and authorize the run**
  Call the repository's commercial-member guard, validate the UUID route parameter, and query run metadata by run ID through the authenticated Supabase server client. Return `404` for a missing or inaccessible run to avoid disclosing its existence.
- [x] **Step 3: Page through the complete candidate set**
  Query `prospecting_run_candidates` ordered by discovery position in bounded pages, embedding only the fields needed by the Markdown contract. Use `run_id` on every page and fail the response if any page read fails.
- [x] **Step 4: Stream one complete Markdown attachment**
  Feed pages to the Markdown generator and stream the response with UTF-8, `Content-Disposition: attachment`, and `Cache-Control: private, no-store`. Include the exact expected row count. No selected IDs, search filter, or client-supplied candidate fields affect export scope.
- [x] **Step 5: Manually inspect route authorization and file formatting**
  Review the request path, response headers, cancellation behavior, data escaping, and end-of-stream error behavior. Do not run build or browser tests.

### Task 4: Implement bounded CSV staging and commit actions

**Files:**
- Modify: `app/actions/prospecting/cnpj.ts`
- Modify: `app/actions/prospecting/index.ts`
- Modify: `lib/prospecting/cnpj-files.ts`

**Interfaces:**
- `startProspectingCnpjFileImportAction({ runId }): { status: "success"; importId: string } | { status: "error"; message: string }` creates an actor-owned staging session and derives the candidate count from the database.
- `stageProspectingCnpjFileChunkAction({ importId, chunkIndex, rows }): { status: "success" } | { status: "error"; message: string }` validates and stores at most 50 records.
- `commitProspectingCnpjFileImportAction({ importId }): { status: "success"; summary: { suggestions: number; notFound: number; ambiguous: number; skipped: number } } | { status: "error"; message: string }` commits all rows atomically and revalidates the run.
- `abortProspectingCnpjFileImportAction({ importId }): { status: "success" } | { status: "error"; message: string }` cleans up uncommitted staging after client cancellation or parse failure.

- [x] **Step 1: Read installed Server Action guidance**
  Use `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` and the installed `use-server` reference. Keep each chunk under 50 rows so action request bodies remain bounded; do not change the global body-size limit.
- [x] **Step 2: Validate action payloads and actor scope**
  Define strict Zod schemas for UUIDs, chunk indices, row variants, string lengths, URL/date fields, and maximum 50-row chunks. Call `requireCommercialMember()` in every action; never trust an actor ID supplied by the browser.
- [x] **Step 3: Implement session creation and chunk staging**
  Call the matching staging RPCs using the authenticated session. Return actionable row numbers for invalid rows. On a failed chunk, preserve only temporary staging and provide an abort path.
- [x] **Step 4: Implement final commit and cache refresh**
  Call the finalizer RPC; on success revalidate `/prospecting/{runId}` and return only summary counts. On failure, leave all candidate and match business data untouched.
- [x] **Step 5: Add abort behavior**
  Call the scoped abort RPC when the client parser rejects the file or the user cancels before final commit. Expiry remains the recovery path if the browser closes unexpectedly.
- [x] **Step 6: Preserve the existing list and confirmation actions**
  Keep `listProspectingCnpjMatchesAction` and `confirmProspectingCandidateCnpjAction`; update them to accept `ai_research` suggestions plus legacy `opencnpj_bigquery` match records, while restricting newly committed rows to the AI source.

### Task 5: Add the run-level export/import UI and align CNPJ review

**Files:**
- Create: `components/custom/Prospecting/ProspectingCnpjFileTools.tsx`
- Modify: `components/custom/Prospecting/ProspectingRunPage.tsx`
- Modify: `components/custom/Prospecting/ProspectingCnpjReviewDialog.tsx`
- Modify: `components/custom/Prospecting/ProspectingCandidateTable.tsx`
- Modify: `lib/prospecting/reads.ts`
- Modify: `components/custom/Prospecting/index.ts` (only if required by the established export pattern)

**Interfaces:**
- `ProspectingCnpjFileTools({ runId, onImported })` renders the export button, CSV file chooser, bounded chunk progress, success counts, and row-level errors.
- Import status never presents a CNPJ as confirmed; confirmation still flows through `ProspectingCnpjReviewDialog`.

- [x] **Step 1: Read the UI references**
  Use `.agents/skills/suite-frontend/references/tokens.md`, `components.md`, and `writing.md`. Keep the existing dense control row, semantic colors, `Button`, Remix icons, and localized copy.
- [x] **Step 2: Add the export control**
  Link to the authorized Markdown Route Handler, name the action clearly, and explain in one short line that it downloads the entire run and that the external model supplies research.
- [x] **Step 3: Add CSV selection and incremental staging**
  Accept `.csv` only, parse the file as a stream, validate the exact header/rows, then call start, chunk actions sequentially, and commit only after all rows were parsed and staged. Display progress; abort temporary staging on parse/action failure; reset the file input to permit retry.
- [x] **Step 4: Present useful result summaries and diagnostics**
  Show suggestions, not-found, ambiguous, and skipped counts on successful commit. Show row number and field for parser/validation failures. Avoid claiming source verification or automatic confirmation.
- [x] **Step 5: Replace BigQuery poll/search controls**
  Remove `cnpjBatch`, active-batch loading, polling effects, resume/search handlers, and BigQuery-specific message states from `ProspectingRunPage`; mount the new run-level file tools adjacent to current candidate-table actions.
- [x] **Step 6: Align candidate review status and sources**
  Remove `source_limited`/`source_unavailable` labels from current flow, add AI research wording, display the source checked date, and render only safe HTTPS source URLs as external links. Retain a neutral legacy source label for old OpenCNPJ matches without exposing a live BigQuery action.
- [x] **Step 7: Manually inspect the UI states**
  Read the changed component markup for idle, parsing, staging, commit, retry, empty CSV, validation failure, successful import, ambiguous/no-result, and pre-confirmed candidate states. Do not run UI tests.

### Task 6: Remove the BigQuery dependency and configuration

**Files:**
- Delete: `lib/prospecting/cnpj-provider-adapter.ts`
- Delete: `lib/prospecting/cnpj-provider.ts`
- Modify: `app/actions/prospecting/cnpj.ts`
- Modify: `app/actions/prospecting/index.ts`
- Modify: `components/custom/Prospecting/ProspectingRunPage.tsx`
- Modify: `.env.example`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: any tracked deployment sample that defines the `PROSPECTING_CNPJ_*BIGQUERY*` variables, if present

- [x] **Step 1: Remove automated BigQuery imports and provider code**
  Remove `@google-cloud/bigquery` imports, provider query/job functions, batch start/advance/resume actions, batch progress types used only by polling, source-specific error copy, and obsolete provider-only types. Retain the generic CNPJ checksum helper, source-independent CNPJ research types, and historical match review.
- [x] **Step 2: Remove obsolete credential documentation**
  Delete the three BigQuery variables and their comments from `.env.example`; remove matching entries from tracked deployment examples. Do not print or expose secret values from local environment files.
- [x] **Step 3: Remove the direct package dependency**
  Remove `@google-cloud/bigquery` and its unused lockfile entries from `package.json` and `pnpm-lock.yaml`. If the package manager is unavailable, make the matching manifest and lockfile edits manually and inspect the resulting entries. Do not execute any prohibited verification command.
- [x] **Step 4: Search source/configuration text manually**
  Use `rg` to find live code/config references to BigQuery jobs and `PROSPECTING_CNPJ_BIGQUERY_*`. Historical migration names and old database records may retain archival references; runtime paths must not import or invoke them.

### Task 7: Perform the authorized no-test review

**Files:**
- Review all files listed in Tasks 1–6.

- [x] **Step 1: Review the complete change manually**
  Inspect the exact CSV header consistency across Markdown generation, parsing, staging schema, and UI actions; check session ownership, run membership, bounded chunk size, exact candidate coverage, transaction atomicity, CNPJ confirmation boundary, safe source links, RLS, and migration preservation.
- [x] **Step 2: Search for retired runtime references**
  Use `rg` for removed action names, polling state, BigQuery adapter imports, BigQuery credentials, and obsolete source-specific copy. Do not use `git` for diff/status inspection.
- [x] **Step 3: Report the verification boundary**
  State clearly that no tests, typecheck, build, or lint were run because repository instructions prohibit them. Report manual review findings and any remaining deployment-specific upload/response limits.

---

## Handoff

The tasks are sequential because the CSV type contract is consumed by both the staging migration and the UI, and the UI depends on the finalized database/action interfaces. Implementing natively in this session is recommended so those shared contracts stay consistent while the existing BigQuery flow is retired. The external model's context limit is outside the Suite's control; incomplete output must fail closed with no business-data changes.
