# Prospecting CNPJ AI File Workflow

## Goal

Replace automated public CNPJ lookup through BigQuery with a file round-trip in each prospecting run: export a Markdown research brief for an external AI model, import its completed CSV, and review suggested CNPJs in the existing confirmation flow.

## User workflow

1. On a prospecting run page, the user downloads one `.md` file containing all candidates in that run, independent of current pagination, filters, or selection.
2. The user gives that file to an AI model that can research the web. The model researches candidates individually and returns only a UTF-8 CSV using the exact schema embedded in the Markdown instructions.
3. The user imports that CSV into the same run.
4. The application validates the complete file before writing anything. Valid found results become review suggestions. Valid `not_found` and `ambiguous` outcomes update the search status without creating a CNPJ match.
5. The user reviews each suggestion and explicitly confirms a CNPJ through the existing review dialog. Confirmation remains the only action that writes a CNPJ to the prospecting candidate and any linked lead.

The application does not call an AI model, perform CNPJ web searches, or fetch third-party CNPJ data during export or import.

## Approaches considered

### Recommended: file import as suggestions, retaining the review gate

The Markdown/CSV workflow replaces the BigQuery provider. Imported records use the existing candidate review experience and do not directly overwrite confirmed data. This keeps the external research step simple while retaining the application's existing explicit confirmation boundary.

### Directly write imported values

This would require fewer review actions but would let a mistaken or hallucinated AI match overwrite company data. It is rejected because correct candidate-to-CNPJ attribution cannot be guaranteed by CSV syntax or checksum validation.

### Export only, with no in-app CSV import

This would keep the generated data outside the prospecting workflow and would not satisfy the need to return the results to the app. It is rejected.

## Markdown export contract

- Export scope is the full run, not the visible page, filters, or selected candidate IDs.
- The export is always one Markdown file per run, even when the run contains more than 50 candidates. Export queries read the full run in bounded database pages.
- The Markdown contains the run ID, export timestamp, a concise task description, detailed per-company research instructions, the CSV schema, and every candidate's available input fields.
- Candidate rows carry stable `run_id` and `candidate_id` identifiers. Candidate ID is the only association key used on import; names, domains, and addresses are never used to guess an association.
- Candidate input data includes company name, primary category, address, phone, website, website domain, city, state, and any already recorded CNPJ.
- Instructions require individual research for each candidate, comparison of company name and location, preference for authoritative or primary sources, source URL and research date for each found match, no inference from a similar name, and blank CNPJ fields when the match is unverified.
- The model must preserve identifiers and input columns, return one data row per candidate, use UTF-8 and standard comma-separated CSV quoting, and return only the CSV content/file.

## CSV return contract

The CSV has an exact ordered header:

```text
run_id,candidate_id,company_name,primary_category,address,phone,website,website_domain,city,state_code,existing_cnpj,research_status,cnpj,legal_name,trade_name,registration_status,primary_cnae,source_url,source_checked_at
```

- `run_id`, `candidate_id`, and the original candidate fields are copied from the Markdown export and are immutable input context.
- The CSV has exactly one row for every candidate included in the Markdown export. Import checks complete candidate coverage against the run; an incomplete AI response is rejected without applying business data.
- `research_status` is one of `found`, `not_found`, or `ambiguous`.
- A `found` row requires a structurally valid CNPJ, source URL, and parseable source date. Legal name, trade name, registration status, and primary CNAE are optional.
- `not_found` and `ambiguous` rows have an empty CNPJ and do not create a match. Supporting source fields may be empty.
- Import rejects a malformed header, missing/extra columns, invalid encoding/content, duplicate candidate IDs, unknown candidate IDs, run-ID mismatch, missing candidates, invalid status/CNPJ, or invalid required source fields. The error identifies the row or column when possible.
- The complete CSV is parsed and validated before business data is changed. Large files are uploaded as bounded chunks into isolated temporary staging records. Staged rows are not visible as CNPJ suggestions and do not change candidates. A final authenticated operation verifies complete run coverage and applies every row in one database transaction. Interrupted uploads expire and are cleaned up without changing business data.
- Import never changes candidate identity fields, lead identity fields, or a previously confirmed CNPJ. A candidate with an existing confirmed CNPJ is reported as skipped and remains unchanged.
- A found row is stored with its claimed source URL and date and is displayed as an AI-researched suggestion in the existing CNPJ review dialog. Structural validation confirms only CNPJ format/check digits; it does not claim that external research is factually correct.

## Persistence and authorization

- Export and import are authenticated, server-side operations authorized against the commercial user's access to the requested run.
- Imported rows are constrained to candidates that belong to that exact run. Client-provided names and other descriptive fields are never persisted as candidate updates.
- Persistence uses the existing CNPJ suggestion/review relationships where their constraints support the manual-import source. Any schema changes are additive migrations; they preserve confirmed CNPJs and historical match references.
- A single import is all-or-nothing. Re-importing a CSV must not create duplicate suggestions or replace a confirmed result.
- Import staging is scoped to actor and run, expires, and can be committed only once after all rows have been staged and validated.
- The single-file upload does not depend on increasing Next.js Server Action request-size limits. Bounded chunk requests write only to staging; a final database operation owns atomic application.

## User interface

- Replace the current “Pesquisar CNPJ” and “Retomar pesquisa CNPJ” batch controls with an export button and a CSV import control scoped to the current run.
- Keep both actions adjacent to the candidate table's existing run-level tools and use the suite's existing Button, file input/form, feedback, and spacing conventions.
- Explain briefly that export includes the entire run and import adds review suggestions; do not imply that the app itself performed the web research.
- Show successful import counts (suggestions, not-found, ambiguous, skipped) and row-specific validation errors. Keep the existing CNPJ status and review affordances aligned with imported results.

## BigQuery retirement and data safety

- Remove the runtime BigQuery adapter, job polling/start/resume actions, BigQuery-specific copy/status handling, Google Cloud CNPJ environment variables, and the `@google-cloud/bigquery` direct dependency.
- Remove or retire only the database structures and fields that exist solely for automated provider jobs after confirming they are not required by imported suggestions, confirmed values, RLS, or historical foreign keys.
- Preserve existing confirmed prospecting and lead CNPJ values and historical records referenced by them. Do not rewrite old migrations; use a new forward migration for schema changes.
- This change does not remove DataForSEO prospecting, other public/business-listing collection, IBGE city boundaries, or non-CNPJ enrichment.

## Failure handling

- Export reports an authorization or data-loading error and does not produce a partial Markdown file.
- Import rejects malformed, incomplete, duplicated, invalid, or resource-exhausting files before business-data persistence, reports actionable row-level diagnostics, and leaves the database untouched on validation failure. Interrupted staging uploads expire without changing business data.
- The export can exceed the context capacity of a chosen external AI model. The app still generates one complete Markdown file; it rejects a returned CSV that does not cover every exported candidate rather than silently importing partial results.
- Database errors roll back the entire import; the UI reports that nothing was imported.
- The CSV source URL is rendered as an external link only after safe URL parsing and protocol validation.
- Research ambiguity remains explicit; no automatic candidate matching, CNPJ guessing, or silent overwrite is allowed.

## Acceptance criteria

1. A run-level export contains all candidates in the run across pages and filters, with stable IDs and complete available source context.
2. The embedded instructions specify the output schema, per-company identity checks, source evidence, and no-guess behavior.
3. A correctly completed CSV imports only to its originating run and surfaces found results through the existing review UI.
4. A malformed, partial, duplicated, cross-run, or invalid-CNPJ CSV produces useful errors and writes no rows.
5. Confirmation remains explicit, and import cannot overwrite an already confirmed CNPJ.
6. Existing confirmed CNPJs and leads remain intact after the migration and removal of the BigQuery integration.
7. BigQuery credentials and package dependency are no longer required to use the CNPJ file workflow.
8. An export with more than 50 candidates remains one Markdown file; a matching CSV can be staged in bounded chunks and applied atomically.

## Constraints

- Follow the repository's `AGENTS.md`: do not execute `git`, `typecheck`, `build`, `lint`, or `test`; do not add or run tests.
- Follow the repository's Next.js agent rule and read relevant installed Next.js documentation before implementation.
- Follow `.agents/skills/suite-frontend` for all UI changes.
