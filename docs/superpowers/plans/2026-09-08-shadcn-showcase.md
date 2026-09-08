# Shadcn Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a protected, categorized live catalog for the 59 installed lowercase shadcn component modules.

**Architecture:** Keep route pages server-side under the existing protected route group and place all interaction in a focused `components/custom/Showcase` client feature. A typed registry drives category routes, overview cards, and navigation while six category modules own their live examples. The existing shadcn-generated global tokens remain unchanged and are the visual source for the catalog.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Base UI, shadcn component source, Lucide React, Recharts, Embla Carousel, TanStack Table v9.

**Spec:** `docs/superpowers/specs/2026-09-08-shadcn-showcase-design.md`

## Global Constraints

- Import only lowercase shadcn module paths from `@/components/ui/<module>` inside the Showcase feature.
- Do not import wrappers in PascalCase, including `@/components/ui/Button`, `@/components/ui/Dialog`, or any sibling wrapper directory.
- Do not install or render `native-select` or `direction`.
- Do not modify `app/globals.css`, token files, `components.json`, dependencies, authentication, or database code.
- Preserve `requireCommercialMember` by keeping routes under `app/(protected)`.
- Use no external data, server actions, mutations, tests, lint, typecheck, build commands, or git commands.
- Use manual browser verification only.

---

## File Structure

- Modify: `components/custom/navigation.ts` — add the Showcase navigation group and seven leaves.
- Create: `app/(protected)/showcase/page.tsx` — protected overview route.
- Create: `app/(protected)/showcase/[category]/page.tsx` — protected typed category route.
- Create: `components/custom/Showcase/Showcase.types.ts` — category IDs and metadata contracts.
- Create: `components/custom/Showcase/showcase-registry.tsx` — category registry, icons, counts, hrefs and validation helper.
- Create: `components/custom/Showcase/ShowcaseOverview.tsx` — overview cards and inventory explanation.
- Create: `components/custom/Showcase/ShowcaseCategory.tsx` — client dispatcher and one local Toaster.
- Create: `components/custom/Showcase/ShowcaseSection.tsx` — repeated preview/coverage/accessibility framing.
- Create: `components/custom/Showcase/ShowcaseDocsLink.tsx` — consistent official-documentation link.
- Create: `components/custom/Showcase/categories/ActionsShowcase.tsx` — nine action and feedback modules.
- Create: `components/custom/Showcase/categories/FormsShowcase.tsx` — fourteen form modules plus Date Picker composition.
- Create: `components/custom/Showcase/categories/NavigationShowcase.tsx` — eight navigation and command modules.
- Create: `components/custom/Showcase/categories/OverlaysShowcase.tsx` — ten overlay and disclosure modules.
- Create: `components/custom/Showcase/categories/ContentShowcase.tsx` — fourteen content/data modules plus Data Table composition.
- Create: `components/custom/Showcase/categories/MessagingShowcase.tsx` — four conversation and attachment modules.
- Create: `components/custom/Showcase/index.ts` — feature exports consumed by route pages.

### Task 1: Establish typed navigation and route boundaries

**Files:**
- Modify: `components/custom/navigation.ts`
- Create: `components/custom/Showcase/Showcase.types.ts`
- Create: `components/custom/Showcase/showcase-registry.tsx`
- Create: `components/custom/Showcase/index.ts`
- Create: `app/(protected)/showcase/page.tsx`
- Create: `app/(protected)/showcase/[category]/page.tsx`

**Interfaces:**
- Produces `ShowcaseCategoryId = "actions" | "forms" | "navigation" | "overlays" | "content" | "messaging"`.
- Produces `SHOWCASE_CATEGORIES`, each with `id`, `label`, `description`, `href`, `icon`, and `componentCount`.
- Produces `isShowcaseCategory(value: string): value is ShowcaseCategoryId`.

- [ ] Define `ShowcaseCategoryId` and `ShowcaseCategory` with the six exact IDs and their component counts: 9, 14, 8, 10, 14 and 4.
- [ ] Implement `SHOWCASE_CATEGORIES` as the only list of category metadata, with paths `/showcase/actions`, `/showcase/forms`, `/showcase/navigation`, `/showcase/overlays`, `/showcase/content` and `/showcase/messaging`.
- [ ] Implement `isShowcaseCategory` using the registry IDs rather than a second handwritten array.
- [ ] Add a `Showcase` group to `NAV_ITEMS`, after `Home` and before `CRM`, with a `Visão geral` leaf at `/showcase` followed by one leaf per registry category.
- [ ] Implement the overview server route as a thin render of `ShowcaseOverview`.
- [ ] Implement the dynamic server route with `PageProps<"/showcase/[category]">`; resolve params, call `notFound()` for an invalid slug, and render `ShowcaseCategory` with the validated ID.
- [ ] Manually verify `/showcase`, all six category URLs, invalid `/showcase/unknown`, and active states in desktop and mobile navigation.

### Task 2: Build the shared catalog frame

**Files:**
- Create: `components/custom/Showcase/ShowcaseOverview.tsx`
- Create: `components/custom/Showcase/ShowcaseCategory.tsx`
- Create: `components/custom/Showcase/ShowcaseSection.tsx`
- Create: `components/custom/Showcase/ShowcaseDocsLink.tsx`

**Interfaces:**
- `ShowcaseSection({ title, description, documentationHref, composition, children, notes })` renders one accessible component section.
- `ShowcaseCategory({ category }: { category: ShowcaseCategoryId })` selects exactly one category module and mounts one `Toaster`.

- [ ] Implement `ShowcaseOverview` with title, protected-catalog explanation, total `59`, and a card/link for every category from `SHOWCASE_CATEGORIES`.
- [ ] Implement `ShowcaseDocsLink` as a normal external anchor with descriptive accessible text, `target="_blank"` and `rel="noreferrer"`.
- [ ] Implement `ShowcaseSection` with a labelled heading, purpose text, preview surface, composition description, official-doc link, icon guidance, color-token guidance and accessibility/antiuse note slots.
- [ ] Implement `ShowcaseCategory` as a client component with a switch that renders all and only the category modules. Mount `<Toaster />` once after the selected module.
- [ ] Keep page padding, overflow behavior, type classes and background consistent with existing protected pages; do not edit global CSS or token files.
- [ ] Manually verify headings form a sensible outline, cards wrap on small screens, focus rings are visible and changing the existing app theme updates preview colors.

### Task 3: Implement Ações e feedback

**Files:**
- Create: `components/custom/Showcase/categories/ActionsShowcase.tsx`

**Interfaces:**
- Consumes `ShowcaseSection` and lowercase imports from `alert`, `alert-dialog`, `button`, `button-group`, `progress`, `spinner`, `toast`, `toggle`, `toggle-group`.
- Produces `ActionsShowcase(): React.ReactNode`.

- [ ] Render Button with all six local variants, all eight sizes, leading/trailing Lucide icons, icon-only accessible label, `aria-invalid`, and disabled state.
- [ ] Render Button Group with text, separator and mixed button controls.
- [ ] Render Alert in default and destructive variants with title, description and action.
- [ ] Render Alert Dialog with a non-destructive cancel path and a separate destructive confirmation path; both examples expose title and description.
- [ ] Render Progress at 0, partial and complete values with `ProgressLabel` and `ProgressValue`; render Spinner in standalone and button-loading contexts.
- [ ] Render Toggle and Toggle Group for pressed/unpressed, single/multiple selection, sizes and disabled choices.
- [ ] Use the local toast manager to demonstrate default, success, info, warning, error, loading, action, close and `toast.promise` transitions without persisting an external operation.
- [ ] Manually verify tab order, Escape close for Alert Dialog, disabled controls, icon-only button labels and toast action/close behavior.

### Task 4: Implement Formulários

**Files:**
- Create: `components/custom/Showcase/categories/FormsShowcase.tsx`

**Interfaces:**
- Consumes `ShowcaseSection` and lowercase imports from `calendar`, `checkbox`, `combobox`, `field`, `input`, `input-group`, `input-otp`, `label`, `popover`, `questionnaire`, `radio-group`, `select`, `slider`, `switch`, `textarea`.
- Produces `FormsShowcase(): React.ReactNode`.

- [ ] Build Field examples for label, description, required indicator, error, horizontal/vertical layout and grouped controls.
- [ ] Render Input and Textarea examples for normal, placeholder, disabled, invalid and typed input states; render Input Group with start/end addons and button addon.
- [ ] Render Checkbox, Radio Group, Switch and Slider as controlled local examples with selected/checked, disabled and invalid/error coverage.
- [ ] Render Select and Combobox with local choices, placeholder, search, selection, clear, empty result and disabled state.
- [ ] Render Calendar in single and range mode, a disabled-date rule and accessible month navigation.
- [ ] Compose Date Picker directly from Button, Popover and Calendar for single and range values. Do not create or import a `date-picker` base module.
- [ ] Render Input OTP with empty, partial, complete and invalid examples.
- [ ] Render Questionnaire with required radio choices, multi-choice, freeform input, skip, previous/next, submit, progress and validation error.
- [ ] Manually verify labels connect to controls, keyboard selection works, disabled values cannot change, invalid text is nearby and date range selection works.

### Task 5: Implement Navegação e comandos

**Files:**
- Create: `components/custom/Showcase/categories/NavigationShowcase.tsx`

**Interfaces:**
- Consumes `ShowcaseSection` and lowercase imports from `breadcrumb`, `command`, `kbd`, `menubar`, `navigation-menu`, `pagination`, `sidebar`, `tabs`.
- Produces `NavigationShowcase(): React.ReactNode`.

- [ ] Render Breadcrumb with links, current page, separators and collapsed ellipsis.
- [ ] Render Kbd alone and within a Command item; use semantic keyboard labels instead of text-only shortcut decoration.
- [ ] Render Command in a locally controlled CommandDialog with groups, query input, selected item, shortcut and empty result. Choose a hotkey that does not conflict with the application sidebar `Ctrl+B` shortcut.
- [ ] Render Menubar and Navigation Menu with nested content, separators, disabled item and active trigger state.
- [ ] Render Pagination with first/current/last visual states, previous/next disabled boundaries and ellipsis.
- [ ] Render a confined SidebarProvider example with header, content, group, menu, footer and trigger. It must not replace or control the application sidebar.
- [ ] Render Tabs with active, inactive and disabled trigger states plus linked content panels.
- [ ] Manually verify keyboard navigation, menu dismissal by Escape, arrow-key interaction where provided, active state visibility and no conflict with the global sidebar.

### Task 6: Implement Camadas e revelação

**Files:**
- Create: `components/custom/Showcase/categories/OverlaysShowcase.tsx`

**Interfaces:**
- Consumes `ShowcaseSection` and lowercase imports from `accordion`, `collapsible`, `context-menu`, `dialog`, `drawer`, `dropdown-menu`, `hover-card`, `popover`, `sheet`, `tooltip`.
- Produces `OverlaysShowcase(): React.ReactNode`.

- [ ] Render Accordion and Collapsible in closed/open/default-open/disabled configurations.
- [ ] Render Context Menu and Dropdown Menu with regular, checkbox, radio, submenu, label, separator, disabled and destructive items.
- [ ] Render Dialog with trigger, title, description, close, action and cancel; render Sheet for all four sides and optional close control.
- [ ] Render Drawer using a bottom sheet with swipe handle and a side drawer direction so both mobile-oriented and lateral behavior are visible.
- [ ] Render Popover, Hover Card and Tooltip with side, align, offset and Kbd-content coverage. Tooltip must supplement, not replace, a visible label.
- [ ] Ensure every overlay demonstration has a trigger, title/description when its primitive requires it, and local controlled state only when a reset is necessary.
- [ ] Manually verify focus enters modal overlays, Escape and close controls work, backdrop behavior is correct, context menu opens by secondary click and hover content remains readable with keyboard focus.

### Task 7: Implement Conteúdo e dados

**Files:**
- Create: `components/custom/Showcase/categories/ContentShowcase.tsx`

**Interfaces:**
- Consumes `ShowcaseSection` and lowercase imports from `aspect-ratio`, `avatar`, `badge`, `card`, `carousel`, `chart`, `empty`, `item`, `marker`, `resizable`, `scroll-area`, `separator`, `skeleton`, `table`.
- Consumes `@tanstack/react-table` v9 to create a feature-local Data Table demonstration.
- Produces `ContentShowcase(): React.ReactNode`.

- [ ] Render Aspect Ratio with non-network local decorative surfaces rather than external images.
- [ ] Render Avatar image fallback, status badge and grouped avatars; render every Badge and Marker variant.
- [ ] Render Card default/small with header, title, description, action, content and footer; include edge-to-edge content guidance using `--card-spacing`.
- [ ] Render Carousel horizontal and vertical examples, previous/next disabled boundaries and keyboard operation.
- [ ] Render Chart with a typed local `ChartConfig`, legend, tooltip, text labels and distinguishable series beyond color alone.
- [ ] Render Empty, Item, Resizable, Scroll Area, Separator and Skeleton with all local variants, media/actions, drag panel behavior and long-scroll content as applicable.
- [ ] Render basic Table with caption, header, body, selected row, footer and intentional horizontal overflow.
- [ ] Implement a category-local Data Table composition using `useTable`, explicit TanStack v9 features, local rows and columns, filtering, sorting, selection, column visibility and pagination. Do not create a reusable `components/ui/data-table.tsx`.
- [ ] Manually verify carousel buttons/keys, resizable handle keyboard behavior, scroll region visibility, chart legend/text, table overflow and all Data Table controls.

### Task 8: Implement Conversas e anexos

**Files:**
- Create: `components/custom/Showcase/categories/MessagingShowcase.tsx`

**Interfaces:**
- Consumes `ShowcaseSection` and lowercase imports from `attachment`, `bubble`, `message`, `message-scroller`.
- Produces `MessagingShowcase(): React.ReactNode`.

- [ ] Render Attachment in default/sm/xs, horizontal/vertical and `idle`, `uploading`, `processing`, `error`, `done` states with media, content, title, description and actions.
- [ ] Render Bubble with every variant, start/end alignment and reactions positioned at top/bottom.
- [ ] Render Message composition with author content, timestamps and grouped messages.
- [ ] Render Message Scroller with enough static mock messages to demonstrate initial scroll, scrolling away and return-to-bottom behavior without network or streaming data.
- [ ] Manually verify attachment error contrast, bubble alignment, long-text wrapping, reactions do not obscure message text and the scroller control remains keyboard reachable.

### Task 9: Run the final manual acceptance pass

**Files:**
- Modify only if a concrete acceptance defect is found in a Showcase file created by Tasks 1–8.

**Interfaces:**
- Consumes all prior Showcase routes and categories.
- Produces a manually reviewed protected catalog with 59 accounted components.

- [ ] Compare the six category component counts against the registry: 9 + 14 + 8 + 10 + 14 + 4 = 59.
- [ ] Inspect Showcase imports and confirm they use only lowercase `@/components/ui/<module>` paths, plus allowed framework/library imports.
- [ ] Navigate the overview and every category in both light and dark theme, desktop and narrow mobile viewport.
- [ ] Traverse each interactive example with keyboard, checking focus visibility, labels, Escape behavior and disabled/invalid states.
- [ ] Confirm no Native Select, Direction or PascalCase wrapper is rendered or imported by the Showcase feature.
- [ ] Do not run test, lint, typecheck, build or git commands; record only manual-browser findings in the implementation handoff.

## Plan Self-Review

- Spec coverage: Tasks 1–2 implement protection, routing, navigation, registry, shared shell, generated-token usage and local Toaster. Tasks 3–8 cover every category and all 59 components; Tasks 4 and 7 cover Date Picker and Data Table compositions. Task 9 covers the explicit acceptance criteria.
- Placeholder scan: no incomplete markers, generic test steps or unnamed interfaces remain.
- Type consistency: route slugs, `ShowcaseCategoryId`, registry IDs and category component contracts use the same six values throughout.
