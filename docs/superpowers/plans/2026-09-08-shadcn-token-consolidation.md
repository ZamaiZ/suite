# Shadcn Token Consolidation Implementation Plan

**Goal:** Make the installed shadcn Mira/Mist theme the only product color palette across CSS, server output, PDF, metadata, and maps.

**Architecture:** Canonical CSS tokens remain in `app/globals.css`. A small TypeScript mirror exposes their resolved values only to environments that cannot resolve CSS custom properties. Legacy CSS names remain as derived compatibility aliases so components need no class refactor.

**Constraints:** Do not modify component token classes; do not run tests, builds, lint, or Git commands; use only the shadcn palette.

### Task 1: Establish non-CSS theme constants

- [x] Create `lib/theme/shadcn-palette.ts` with the resolved light and dark values of the existing shadcn Mira/Mist tokens.
- [x] Use the constants in static metadata and all server/canvas/map color consumers.

### Task 2: Make shadcn canonical in CSS

- [x] Remove the manual primitive palette import and file.
- [x] Replace manual semantic color values with aliases derived exclusively from canonical shadcn variables.
- [x] Keep layout, typography, sizing, and shadow aliases independent of product palette values.

### Task 3: Remove product-specific color literals

- [x] Replace PDF, Google Maps, radius-map, and grid-map literals with the TypeScript constants.
- [x] Inspect remaining literals and leave only shadcn canonical token declarations or selector values required by third-party generated markup.
