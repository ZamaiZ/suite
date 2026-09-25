# Pesquisa local de CNPJ por leitura direta dos CSVs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans`. Execute one task at a time in order. Do not delegate. The repository instructions prohibit Git commands and all automated tests/build/lint/typecheck commands.

**Goal:** Replace the oversized persistent CNPJ index with cancellable streaming searches over the Receita CSVs and clear controls for local state and persisted results.

**Architecture:** A detached local Node worker validates and streams the 20 source CSVs, keeping only current-prospecting lookups and bounded matches in memory. Local status and bounded event files expose progress and cancellation; server actions stage and commit completed results through the existing Supabase import RPCs. A new protected RPC previews and deletes only `receita_local_index` data for the selected run.

**Tech Stack:** Next.js server actions and React client components; Node.js worker using `node:fs` and `node:readline`; Supabase Postgres RPC/migrations. The full SQLite/FTS index is removed from this flow.

**Spec:** [2026-09-25-cnpj-local-csv-streaming-design.md](../specs/2026-09-25-cnpj-local-csv-streaming-design.md)

## Global Constraints

- Read the installed Next.js guides under `node_modules/next/dist/docs/` before changing application code.
- Before changing the prospecting UI, read and apply the `suite-frontend` skill.
- Do not run Git, build, lint, typecheck, or automated tests; do not add tests.
- Stream the roughly 24 GB CSV source on each search; never load the source dataset into memory or create a permanent duplicate.
- Preserve CNPJ validation, truncation outcomes, scoring, and tie thresholds from the current local matcher.
- Do not write search results to Supabase until matching completes; cancel during staging by aborting the temporary import.
- Scope cleanup to `receita_local_index` and the selected run; never delete source CSVs or other result sources.
- Send candidate input through the worker's `stdin`; keep only the bounded temporary matches file in the configured Suite state directory, and delete it after the job reaches a terminal state.

## Review Focus

- **Unbalanced CSV sizes:** `Empresas0` is much larger than the other company partitions and `Estabelecimentos0` is much larger than the other establishment partitions; progress must use bytes/rows and must not imply even partition sizes. (Task 2, progress.)
- **Large prospecting runs:** retain the 20,000-candidate ceiling and bounded result counts; reject oversized payloads before worker spawn. (Tasks 1 and 2.)
- **Source mutation or malformed data:** if a source file disappears, changes size/mtime, or has an unexpected field count during scanning, fail without staging results. (Tasks 1 and 3.)
- **Cancellation timing:** cancellation during scan or staging must leave no committed partial results; after an atomic commit starts, report its actual outcome instead of a false cancellation. (Tasks 2 and 3.)
- **Mixed-source confirmations:** delete a confirmed CNPJ only when its `cnpj_confirmed_match_id` points to the local match being deleted; preserve every non-local match and unrelated candidate value. (Task 3, cleanup RPC.)

---

## File Structure

- `scripts/prospecting-cnpj-local-worker.mjs` — source inspection, CSV parsing, streaming matching, progress events, cancel checks, terminal status, and temporary result output. Remove SQLite schema/build/pilot/search code.
- `lib/prospecting/local-cnpj-scan/contracts.ts` — shared source, scan state, candidate, result, and cleanup summary types.
- `lib/prospecting/local-cnpj-scan/config.ts` — resolve source and local-state paths with source/state separation checks; prefer `PROSPECTING_CNPJ_STATE_DIR` and accept `PROSPECTING_CNPJ_INDEX_DIR` as a legacy fallback.
- `lib/prospecting/local-cnpj-scan/worker-client.ts` — stream candidate input to the worker, start/detect processes, read status/events, request cancellation, and clean temporary match files.
- `app/actions/prospecting/cnpj-local-scan.ts` — authorize run access, start/poll/cancel scans, stage results in bounded batches, commit/abort imports, and expose cleanup preview/delete actions.
- `app/actions/prospecting/index.ts` — export the new local scan actions and remove obsolete local-index action exports.
- `components/custom/Prospecting/ProspectingCnpjLocalTools.tsx` — present source health, scan phases, progress, result totals, state-directory location, cancel, and separate local-state/Supabase cleanup controls.
- `supabase/migrations/20261010000000_prospecting_cnpj_local_result_cleanup.sql` — add protected preview and transactional cleanup RPCs for the selected run/source.
- `.env.example` — document `PROSPECTING_CNPJ_DATA_DIR`, `PROSPECTING_CNPJ_STATE_DIR`, and the production opt-in; omit the obsolete index variable.
- `docs/prospecting/cnpj-local-scan.md` — replace index-build instructions with direct scan behavior, runtime trade-offs, and safe cleanup steps.
- `docs/superpowers/specs/2026-09-25-prospecting-cnpj-local-index-design.md` and `docs/superpowers/plans/2026-09-25-prospecting-cnpj-local-index.md` — add a prominent superseded notice linking to the streaming design and this plan; preserve the old documents as history.
- Delete `app/actions/prospecting/cnpj-local-index.ts` and `lib/prospecting/local-cnpj-index/{config.ts,contracts.ts,worker-client.ts}` after all consumers move to the scan modules.
- `components/custom/Prospecting/ProspectingRunPage.tsx` — keep the existing `runId` integration; change only if the new controls require an additional callback or layout slot.

## Task 1: Replace the full index with a streaming matcher

**Files:**
- Create: `lib/prospecting/local-cnpj-scan/contracts.ts`
- Create: `lib/prospecting/local-cnpj-scan/config.ts`
- Modify: `scripts/prospecting-cnpj-local-worker.mjs`
- Delete after consumer migration: `lib/prospecting/local-cnpj-index/contracts.ts`
- Delete after consumer migration: `lib/prospecting/local-cnpj-index/config.ts`

**Interfaces:**
- Produces `LocalCnpjSourceInspection` with `snapshotKey`, competence, 20 file records, total bytes, missing files, layout errors, and `ready`; `LocalCnpjSourceInspectionState` adds enabled/status/message for the UI.
- Produces `LocalCnpjScanInput` as an array of the existing `CnpjSearchCandidate` shape and `LocalCnpjScanResult` with one validated research result per candidate.
- Worker modes become `inspect`, `scan`, and `status`; remove `pilot` and `build` modes and all `node:sqlite` imports.

- [ ] **Step 1: Define source and scan contracts**

  Add `LocalCnpjSourceFile`, `LocalCnpjSourceInspection`, `LocalCnpjSourceInspectionState`, `LocalCnpjScanStatus`, `LocalCnpjScanState`, and scan summary types. The state includes `executionId`, `runId`, `snapshotKey`, phase, current file, bytes/rows read, candidate totals, timestamps, terminal summary, and message. `LocalCnpjScanStatus` includes `scan_complete` between matching and staging.

- [ ] **Step 2: Rename configuration around scan state**

  Move path resolution into `local-cnpj-scan/config.ts`. Keep `PROSPECTING_CNPJ_DATA_DIR`; prefer new `PROSPECTING_CNPJ_STATE_DIR` and fall back to existing `PROSPECTING_CNPJ_INDEX_DIR` so the current `.env.local` continues to work. Verify source and state paths are disjoint. Update `.env.example` and move/update `docs/prospecting/cnpj-local-index.md` to `docs/prospecting/cnpj-local-scan.md` with the new terminology and no index-build steps.

- [ ] **Step 3: Remove SQLite index construction**

  In `prospecting-cnpj-local-worker.mjs`, remove `DatabaseSync`, `createIndexDb`, `pilot`, `build`, `search`, index manifest writes, and index-specific estimates. Retain Latin-1 CSV parsing, layout inspection, CNPJ validation, normalization, and source snapshot generation.

- [ ] **Step 4: Stream company and establishment rows**

  Parse the bounded candidate input first. Build in-memory exact lookup maps for normalized phones and CEPs and a token-to-candidate map for company names. Stream `Empresas` to associate matching legal names with company bases, then stream `Estabelecimentos` once to evaluate exact phone/CEP and legal/trade-name candidates. Keep only candidate-specific capped match sets and overflow flags; preserve current limits (30 phone rows, 50 CEP rows, 40 name rows), score formula, confidence gate, tie margin, validation, and ambiguous outcome on truncation.

  Write one result per input candidate to a temporary result file. Do not include source rows that are not candidate matches. Re-inspect the source metadata before staging and fail if `snapshotKey` changed.

- [ ] **Step 5: Remove obsolete modules and verify source references**

  Search source files for `local-cnpj-index`, `pilot`, `build`, `manifest.json`, and `node:sqlite`. Remove only obsolete index-flow references; retain the new streaming worker and source status references.

  Add a superseded notice to the old index design and implementation plan that links to this streaming design and plan. Keep the prior documents for history rather than leaving them to look like current instructions.

## Task 2: Add observable background execution and cancellation

**Files:**
- Create: `lib/prospecting/local-cnpj-scan/worker-client.ts`
- Modify: `scripts/prospecting-cnpj-local-worker.mjs`
- Modify: `lib/prospecting/local-cnpj-scan/contracts.ts`

**Interfaces:**
- `startCnpjScanWorker(paths, executionId, runId, snapshotKey, candidates): Promise<boolean>` starts a detached worker, sends the bounded candidate payload through `stdin`, and resolves only after the input stream is flushed or startup fails.
- `readCnpjScanState(paths): Promise<LocalCnpjScanState>` reads and validates status and checks whether the recorded PID is alive while phase is `scanning`.
- `requestCnpjScanCancellation(paths, executionId): Promise<boolean>` writes a cancellation marker only for the active matching execution.
- `appendCnpjScanEvent(paths, event)` writes bounded, redacted JSONL events from server actions; the worker writes the same event envelope from its own script. Neither path logs candidate PII.

- [ ] **Step 1: Create bounded job storage**

  Store `result.json`, `status.json`, `events.jsonl`, and an optional `cancel.json` only under the resolved state directory. Serialize candidate input to the worker's `stdin` rather than to disk. Enforce 20,000 candidates and a 32 MB serialized-input cap before spawn. Use a UUID execution directory and reject path traversal or symlink escapes. Cap the temporary result file at 32 MB.

- [ ] **Step 2: Start and identify the worker**

  Spawn the existing worker script detached with `windowsHide: true`, store PID and `startedAt` in the execution lock, and refuse a second active job. The coordinator keeps the lock through scan, staging, and commit/abort; worker exit at `scan_complete` does not release it. On startup, reconcile a stale lock only after confirming its PID is not running and the coordinator has no pending import. Preserve a terminal failure state if startup or worker exit fails.

- [ ] **Step 3: Report scan progress**

  Update status every 250,000 rows or 2 seconds, whichever comes first, with current path, file bytes read, row count, completed files, total bytes, free bytes, phase, and last update. Append only phase changes, aggregated progress, and terminal events to the bounded event log.

- [ ] **Step 4: Implement cooperative cancellation**

  Check the marker at row intervals and before switching file families. On cancellation, stop reading, close streams, write `cancelled`, and clean the temporary result file only after the worker exits. The cancel action must not kill the PID.

- [ ] **Step 5: Reconcile stale executions and retention**

  If a worker PID is gone while status is `scanning`, report `failed` with an interruption message. A stopped worker with `scan_complete`, `staging`, or `committing` is expected; those phases are owned by the coordinator and its lock. Keep only the most recent 10 terminal event histories; remove temporary match files immediately after import/cancel/failure and expire stale job directories after 24 hours. Candidate input is never retained on disk.

## Task 3: Orchestrate results and database cleanup safely

**Files:**
- Create: `app/actions/prospecting/cnpj-local-scan.ts`
- Create: `supabase/migrations/20261010000000_prospecting_cnpj_local_result_cleanup.sql`
- Modify: `app/actions/prospecting/cnpj.ts` only if the existing stage/commit/abort actions need to accept cancellation progress metadata.

**Interfaces:**
- `inspectLocalCnpjSourceAction(): Promise<LocalCnpjSourceInspectionState>`
- `startLocalCnpjScanAction(input): Promise<LocalCnpjScanState>` where input is `{ runId: string }`.
- `getLocalCnpjScanStateAction(input): Promise<LocalCnpjScanState>` where input is `{ executionId: string }`.
- `getActiveLocalCnpjScanStateAction(input): Promise<LocalCnpjScanState | null>` where input is `{ runId: string }`, allowing a reloaded page to resume showing the local active job.
- `getLocalCnpjScanEventsAction(input): Promise<LocalCnpjScanEvent[]>` where input is `{ executionId: string }`.
- `cancelLocalCnpjScanAction(input): Promise<LocalCnpjScanState>` where input is `{ executionId: string }`.
- `stageNextLocalCnpjScanChunkAction(input): Promise<LocalCnpjScanState>` stages at most 10 chunks (500 rows) per call.
- `commitLocalCnpjScanAction(input): Promise<LocalCnpjScanState>` where input is `{ executionId: string }`.
- `clearLocalCnpjScanArtifactsAction(): Promise<{ deletedBytes: number; deletedEvents: number }>` refuses while any execution lock is active.
- `previewLocalCnpjCleanupAction(input): Promise<LocalCnpjCleanupPreview>` and `deleteLocalCnpjResultsAction(input): Promise<LocalCnpjCleanupSummary>` both accept `{ runId: string }`.
- RPCs: `preview_prospecting_cnpj_local_cleanup(uuid, uuid) -> jsonb` and `delete_prospecting_cnpj_local_results(uuid, uuid) -> jsonb`.

- [ ] **Step 1: Start authorized scans**

  Require a commercial member, validate `runId`, fetch run context and candidates using the existing 500-row paging pattern, enforce the 20,000 limit, inspect the source, compute `snapshotKey`, and stream the bounded candidate payload to the detached worker's `stdin`.

- [ ] **Step 2: Poll and cancel only the active execution**

  Require a commercial member on every action. Check execution UUID, associated run ID, active lock, and current status before returning state or writing a cancel marker. Reject requests for another user's execution.

- [ ] **Step 3: Stage completed results in bounded batches**

  When worker status is `scan_complete`, create the existing local-index import with source `receita_local_index` and the inspected dataset version; store its `importId` in local job state. Stage no more than 10 50-row chunks per action call; update `staging` progress after each successful RPC. If cancellation or a chunk error occurs before commit, call `abort_prospecting_cnpj_file_import` and return a terminal state with no committed results. On page reload, reconcile a saved import with its Supabase status before resuming or expiring the job.

  Keep the execution lock from scan start through commit/abort. The worker process may exit at `scan_complete`, but the coordinator owns the lock while results are waiting to be staged or committed; a second scan must not overwrite the active job state.

- [ ] **Step 4: Commit and clean execution payloads**

  Commit only after every input candidate has a result and every chunk is staged. Persist existing summaries and `dataset_version`; set status `completed` only after commit succeeds. Delete the temporary match file after terminal completion while retaining bounded redacted events.

- [ ] **Step 5: Add protected preview and delete RPCs**

  In the migration, validate `p_actor_id = auth.uid()` and `prospecting_is_commercial_member`, lock the selected run, refuse deletion while a `receita_local_index` import remains in `staging`, and restrict every count/delete to `source = 'receita_local_index'` and the supplied `run_id`. Preview import, batch, attempt, match, and confirmed-match counts. In the delete RPC, reset candidate CNPJ/status only where the confirmed pointer references a local match being deleted; preserve remaining non-local confirmed data and recompute unconfirmed status from remaining non-local attempts/matches. Delete local batches/imports transactionally and return actual affected counts.

## Task 4: Replace the index UI with scan operations

**Files:**
- Modify: `components/custom/Prospecting/ProspectingCnpjLocalTools.tsx`
- Modify: `app/actions/prospecting/index.ts`
- Modify: `components/custom/Prospecting/ProspectingRunPage.tsx` only if required by the new state callbacks.
- Delete: `app/actions/prospecting/cnpj-local-index.ts`
- Delete after imports move: `lib/prospecting/local-cnpj-index/worker-client.ts`

**Interfaces:**
- The client component retains `runId` and `onImported` props.
- UI state is `LocalCnpjScanState`; status labels cover `not_configured`, `source_ready`, `scanning`, `scan_complete`, `staging`, `committing`, `completed`, `cancelled`, and `failed`.

- [ ] **Step 1: Replace setup actions with direct scan actions**

  Remove pilot/build buttons and replace them with source validation and “Pesquisar CNPJs”. On mount, load any active execution for this `runId` so a page reload resumes status. After `scan_complete`, call `stageNextLocalCnpjScanChunkAction` serially until staging finishes, then commit. Keep the same `runId` and refresh the prospecting view only after an import commit succeeds.

- [ ] **Step 2: Show phase and actual work**

  Render source competence, 20-file readiness, total raw bytes, current file, rows/bytes scanned, candidates processed, elapsed time, last activity, and a progress bar based on bytes read rather than partition count. Show the event timeline with timestamp, phase, aggregate result counts, and any error. Identify that matches are staged to the selected prospecting run in Supabase. Show ETA only after measured rate is available and label it as an estimate.

- [ ] **Step 3: Serialize polling and expose cancellation**

  Replace `setInterval` with recursive `setTimeout` scheduled after each state response. Poll only while the execution is active. Show “Cancelar pesquisa” during scanning/staging; disable it while the atomic commit is in progress and explain that the result is being finalized.

- [ ] **Step 4: Add separate cleanup controls**

  Show the configured state-directory path and explain that the temporary matches file is removed after terminal completion. Add “Limpar estado e eventos locais” with visible local size/counts and active-worker blocking. Add “Apagar resultados locais desta prospecção” with RPC preview counts, including confirmed local CNPJs, and a separate confirmation. Do not offer a control that targets the CSV source directory.

- [ ] **Step 5: Remove stale UI vocabulary and animation warning**

  Remove copy about creating or deleting a persistent index. Inspect the `maxWidth` animation warning in the component's motion ancestors and use animatable numeric endpoints if this component causes it; do not conflate it with worker state.

## Task 5: Integrate and review the complete flow

**Files:**
- Modify: `app/actions/prospecting/index.ts`
- Modify: `components/custom/Prospecting/ProspectingRunPage.tsx` only for final wiring
- Review: all files listed above and the approved spec

**Interfaces:**
- `app/actions/prospecting/index.ts` exports only the new scan and cleanup actions; no consumer imports `cnpj-local-index.ts`.
- A completed search refreshes the existing prospecting route and displays the committed summary.

- [ ] **Step 1: Wire imports and remove dead index code**

  Update the action barrel and component imports; remove obsolete pilot, build, SQLite index, and local manifest code without changing AI research or other CNPJ sources.

- [ ] **Step 2: Review the server/client state contract**

  Check every status transition from source validation through scan, staging, commit, cancellation, failure, and cleanup. Confirm terminal states cannot restart polling and no state response contains candidate PII.

- [ ] **Step 3: Review database cleanup boundaries**

  Trace the cleanup RPC from preview through delete. Confirm run/actor/source predicates are present in every data operation and that confirmed CNPJs from non-local sources remain untouched.

- [ ] **Step 4: Review file-system boundaries and failure cleanup**

  Confirm candidate input travels only through `stdin`, temporary matches/events stay under the Suite state directory, original CSV paths are read-only, process locks protect active jobs, and crash/cancel paths do not leave PII payloads or false active statuses.

- [ ] **Step 5: Apply repository verification constraints**

  Do not run Git, build, lint, typecheck, or tests. Perform source review only and report the exact manual UI operation the user can use to observe a real scan, cancellation, and cleanup after the changes are available.

---

## Execution Handoff

The five tasks are sequential because the UI and database import depend on the worker's status/result contract. Use native execution in this session; do not delegate. After the user approves this plan, invoke the execution-plan workflow and complete one task at a time. Do not run automated tests or Git commands.
