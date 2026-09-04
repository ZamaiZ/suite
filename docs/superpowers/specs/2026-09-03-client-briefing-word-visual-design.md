# Client Briefing Word Visual Design Specification

## Goal

Replace the technical Word export with a polished, neutral executive client-briefing document that is easy to scan, preserves all authorized data, and keeps decrypted access credentials inside their correct section.

## Visual direction

Use the `customer_pack` document archetype with a neutral executive adaptation. The document must not depend on client branding or an uploaded logo.

### Tokens

| Role | Value |
| --- | --- |
| Page | A4 portrait, 1.8 cm top/bottom and 1.9 cm left/right margins |
| Font | Inter for every body, heading, table, header and footer run |
| Ink | `1F2937` |
| Muted text | `6B7280` |
| Executive blue | `1D4ED8` |
| Navy | `0F172A` |
| Soft surface | `F8FAFC` |
| Rule / border | `E2E8F0` |
| Body | 10 pt, 1.25 line spacing, 6 pt after |
| Kicker | 9 pt, semibold, uppercase, executive blue |
| Title | 28 pt, semibold, navy |
| Subtitle | 12 pt, muted |
| Heading 1 | 16 pt, semibold, navy, 18 pt before / 8 pt after |
| Heading 2 | 11 pt, semibold, executive blue, 12 pt before / 5 pt after |
| Label | 8.5 pt, semibold, uppercase, muted |
| Value | 10 pt, regular, ink |

## Page furniture

The first page uses a left-aligned customer-pack opening: kicker `BRIEFING DE CLIENTE`, client company name, generated timestamp, and a compact metadata strip containing briefing status and confidentiality. It is not a standalone cover page.

All pages use a quiet header with the client name and `Briefing de cliente`, separated by a thin rule. The footer contains `Uso interno e confidencial`, the generation date, and an actual page-number field. No watermark is used.

## Content presentation

The exporter must replace the generic recursive object renderer with per-step adapters. Internal field keys, enum identifiers, UUIDs, storage paths and raw booleans must never reach the document.

Each adapter returns only present, human-readable items. A missing value displays as `Não informado`; a deliberately negative answer uses `Não`; and intentionally absent assets use the existing business copy where available.

### Empresa

Use a two-column metadata grid for company, contact and address. Render opening hours as a compact weekday list and digital channels as labeled links. Format Brazilian telephone, CNPJ and postal code values.

### Marca e serviços

Use short labeled text blocks for commercial narrative. Render products and services as a three-column table (`Tipo`, `Nome`, `Descrição`), team ownership as compact cards, and competitors/tools as real bullet lists with display labels.

### Persona e localização

Group persona facts in a two-column metadata grid. Present pains, behaviors, cities, neighborhoods and keywords as bullet lists. Show geographic focus, service radius, coordinates and map link together in one location callout.

### Histórico e metas

Render the selected marketing context and goals as labeled blocks. Yes/no choices use human text and show their contextual notes only when present.

### Financeiro

Translate all range and seasonality enums to their business labels. Resolve selected product/service IDs against the Brand snapshot before rendering; UUIDs never appear.

### Website

Render logo preference, color direction, references and notes as labeled items. Use the filename for brandbook and asset kits; do not include storage metadata. Present website references as compact links.

### Acessos

Keep access status, invitation e-mails, URLs and usernames in an ordered access grid. Append decrypted passwords in the same chapter, inside a restrained `Dados sensíveis` callout with a confidentiality caption. This callout is omitted when no password exists.

### Considerações

Render additional information as a concise prose block only when it exists.

### Contato / Kickoff

Use a status summary block followed by a chronological timeline. Every activity is a real bullet/list item with type label, event date, optional meeting timestamp and note. No Unicode fake bullets are used.

## Architecture

`lib/briefing/export-document.ts` becomes an orchestration layer: it still creates the authoritative snapshot and fingerprint, but delegates visual output to focused document helpers. The helpers normalize raw briefing payloads into display-ready rows and assemble styled paragraphs, tables, callouts, headers and footers using `docx` primitives.

The stored snapshot and signed-download flow remain unchanged. This redesign changes only document composition; it must not weaken the existing server-only secret boundary.

## Acceptance criteria

- Every visible run declares Inter.
- A generated file contains consistent A4 geometry, header, footer and page numbering.
- No raw key, enum ID, UUID, storage path or JSON shape is visible.
- The map belongs to Persona e localização and passwords belong to Acessos.
- Every repeated collection is formatted as a real list or a fixed-width table appropriate to the content.
- The document remains neutral and polished when no logo or brand asset exists.
- Existing export authorization, private storage and short-lived signed URL behavior remain intact.
- Automated test, lint, typecheck and build commands are not run, per user and repository constraints.
