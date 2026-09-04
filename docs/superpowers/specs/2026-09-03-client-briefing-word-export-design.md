# Client Briefing Word Export — Design Specification

## Objective

Allow an authorized staff member to generate and open a versioned Word snapshot of a finalized client briefing, including the associated Contact / Kickoff context.

## Access and confidentiality

- Generation, metadata lookup and signed download require the existing `canManageClientPortal` authorization for the requested client.
- The client portal never receives export metadata, document content, or a signed URL.
- Passwords are decrypted only in server-only code while composing the snapshot. They are never returned by a Server Action response.
- Because the persisted snapshot contains plaintext passwords, export rows and storage objects are service-role-only; browser access happens exclusively through the guarded signed-URL action.

## Content

The document contains the eight briefing steps in their review order and a final `Contato / Kickoff` section. Empty values render as `Não iniciado`. The Website section embeds a small supplied logo when it can be represented safely and lists the brandbook filename without embedding the PDF. The Audience section includes service radius, coordinates and a Google Maps URL when coordinates exist.

The Kickoff section includes current stage, meeting timestamp, and the activity history captured for the client.

## Versioning

Each generation stores a full JSON snapshot, the generated `.docx`, timestamp, author, filename and a SHA-256 content fingerprint. One export per client is current; older exports remain historical. A current export is stale when the fingerprint changes.

The fingerprint covers finalized/content timestamps, ordered briefing-step timestamps, secret kinds and timestamps, kickoff state/meeting timestamp, and ordered kickoff activity identifiers/timestamps. It therefore changes for briefing, secret, asset-touch or kickoff updates.

## UI

The Briefing overview in `ClientBriefingReviewDialog` displays the export controls only after finalization: `Gerar Word`/`Gerar nova versão`, `Abrir atual`, current export information, and a stale state. It is isolated from the Contact rail and from all editing views.

## Constraints

- Use the existing `docx` package and project UI primitives.
- Preserve the current dialog and briefing review patterns.
- No tests, lint, typecheck, build, or `git` commands are run by explicit user request.
