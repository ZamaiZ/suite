# Shadcn UI Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every targeted PascalCase UI wrapper and its consumers with the installed shadcn primitives, using the shadcn Mira/Mist token system and `react-icons`.

**Architecture:** The shadcn files in `components/ui` remain the only reusable primitive layer. Consumers compose them directly with `Field`, `InputGroup`, `Popover`, `Calendar`, `Select`, `Combobox`, and Dialog slots. `lib/date-time.ts` owns the only reusable date conversion because it is domain data handling rather than a visual wrapper.

**Tech Stack:** Next.js 16, React 19, Base UI, shadcn, Tailwind CSS 4, `react-icons`, `input-otp`, React Day Picker.

**Spec:** `docs/superpowers/specs/2026-09-08-shadcn-ui-migration-design.md`

## Global Constraints

- Use only the shadcn components under `components/ui` in lower-case paths.
- Do not create replacement PascalCase wrappers or reexports.
- Use `react-icons/ri`; do not add Lucide imports to modified files.
- Use `primary` for action/selection, `accent` for neutral interaction surfaces, `ring` for focus, and `destructive` for invalid/destructive state.
- Keep data format and business behavior intact, especially `YYYY-MM-DD` civil dates and Select multi-value strings.
- The repository prohibits test, build, lint, and Git commands. Perform only static import/reference checks and manually inspect changed routes in the existing development environment.

---

### Task 1: Normalize the shadcn primitives used by the migration

**Files:**

- Modify: `components/ui/checkbox.tsx`
- Modify: `components/ui/calendar.tsx`
- Modify: `components/ui/dialog.tsx`
- Modify: `components/ui/input-otp.tsx`
- Modify: `components/ui/select.tsx`
- Modify: `components/ui/combobox.tsx`

**Consumes:** Mira/Mist canonical tokens in `app/globals.css`.

**Produces:** The icon-free-shadcn dependency baseline used by all migrated consumers.

- [ ] Replace each Lucide import with its stated Remix equivalent from the spec.
- [ ] Preserve each primitive’s `data-slot`, Base UI render contract, keyboard behavior, and export names.
- [ ] Confirm visually that every primitive still uses canonical `primary`, `accent`, `ring`, `destructive`, `popover`, and `foreground` utilities; do not introduce aliases such as `text-fg` or `bg-surface`.
- [ ] Static check: search the six files for `lucide-react` and confirm zero matches.

### Task 2: Replace Button imports and legacy button props

**Files:**

- Modify: `app/(public)/access-pending/page.tsx`
- Modify: all current consumers of `@/components/ui/Button` under `components/custom`, including Sidebar, Lead flows, Client Briefing forms, Client Portal, import workspace, and authentication forms.
- Delete: `components/ui/Button/Button.tsx`
- Delete: `components/ui/Button/Button.types.ts`
- Delete: `components/ui/Button/index.ts`

**Consumes:** `Button` and `buttonVariants` from `components/ui/button.tsx`.

**Produces:** Direct shadcn Button usage with React Icons as child content.

- [ ] Change each import to `@/components/ui/button`.
- [ ] Translate variants exactly: `primary→default`, `danger→destructive`, `soft→secondary` for panel actions or `ghost` for navigational actions; preserve `secondary`, `outline`, and `ghost`.
- [ ] Replace every `leadingIcon`/`trailingIcon` prop with the existing `Ri*` icon as a child, before/after the label. Add `aria-hidden` to decorative icons.
- [ ] Convert icon-only buttons to a shadcn icon size and provide `aria-label`.
- [ ] Static check: confirm no `leadingIcon=`, `trailingIcon=`, `variant="primary"`, `variant="danger"`, or `variant="soft"` remains outside historical documentation.

### Task 3: Migrate simple selection controls through Field composition

**Files:**

- Modify: `components/custom/ClientBriefingAudienceForm/ClientBriefingAudienceForm.tsx`
- Modify: `components/custom/ClientBriefingBrandForm/ClientBriefingBrandForm.tsx`
- Modify: `components/custom/ClientBriefingAccessesForm/ClientBriefingAccessesForm.tsx`
- Modify: `components/custom/ClientBriefingClosingForm/ClientBriefingClosingForm.tsx`
- Modify: `components/custom/ClientBriefingHistoryForm/ClientBriefingHistoryForm.tsx`
- Modify: `components/custom/BriefingCatalogEditor/BriefingCatalogEditor.tsx`
- Modify: `components/custom/BriefingHoursEditor/BriefingHoursEditor.tsx`
- Modify: `components/custom/LeadGbpPanel/LeadGbpGridSection.tsx`
- Delete: `components/ui/Checkbox/*`
- Delete: `components/ui/RadioGroup/*`
- Delete: `components/ui/Slider/*`
- Delete: `components/ui/Switch/*`

**Consumes:** `Field`, `FieldLabel`, `FieldDescription`, `Checkbox`, `RadioGroup`, `RadioGroupItem`, `Slider`, and `Switch`.

**Produces:** Direct primitive composition with preserved controlled values and error semantics.

- [ ] Replace wrappers with a Field container whenever a label, required state, description, or error exists.
- [ ] Pass `aria-invalid` to the actual control and render its error text with a stable `id` referenced by `aria-describedby`.
- [ ] Keep controlled/uncontrolled behavior unchanged: `checked/defaultChecked`, `value/defaultValue`, `onCheckedChange`, and `onValueChange` remain primitive props.
- [ ] For range Slider, pass a two-number array; for single Slider, pass a one-number array and keep value formatting local to the form.
- [ ] Static check: no imports remain from the four PascalCase component directories.

### Task 4: Migrate textual inputs without reintroducing visual wrappers

**Files:**

- Modify: all 17 current Input consumers under `components/custom`, including `ClientBriefingCompanyForm`, `ClientBriefingAccessesForm`, `ClientPortalGate`, `CreateUserForm`, `LeadForm`, `LeadActivityForm`, `LeadBoardToolbar`, `LeadClosingPanel`, `LeadDetailDialog`, `LeadDigitalPresencePanel`, `LoginForm`, and `ToolsSettings`.
- Modify: all eight current Textarea consumers under `components/custom`.
- Modify: `components/custom/ClientPortalGate/ClientPortalGate.tsx`
- Delete: `components/ui/Input/*`
- Delete: `components/ui/Textarea/*`
- Delete: `components/ui/InputOTP/*`

**Consumes:** `Input`, `Textarea`, `InputOTP`, `InputOTPGroup`, `InputOTPSlot`, `InputOTPSeparator`, `Field`, and `InputGroup` primitives.

**Produces:** Native shadcn field composition with domain formatting implemented at the consumer boundary.

- [ ] Replace `label` and `error` props with Field slots and preserve all existing form identifiers and error messages.
- [ ] Replace `variant="password"` with `type="password"`; compose the visibility toggle with `InputGroupButton`, `RiEyeLine`, and `RiEyeOffLine`.
- [ ] Replace `variant="phone"`, `"cep"`, `"cpf"`, `"cnpj"`, and `"currency"` with the existing formatter called from the local `onChange`; set `inputMode`, `autoComplete`, and `pattern` explicitly.
- [ ] Replace status adornments with an InputGroup end addon only where loading/success/error feedback is visible today.
- [ ] Rebuild the portal OTP field from the four lower-case OTP primitives while retaining `onComplete`, paste transformation, character filtering, and one-time-code autocomplete.
- [ ] Static check: no `variant=` values that belonged only to the old Input API remain.

### Task 5: Classify and migrate Select consumers to Select or Combobox

**Files:**

- Modify: `components/custom/ClientBriefingCompanyForm/ClientBriefingCompanyForm.tsx`
- Modify: `components/custom/ClientsList/ClientsListToolbar.tsx`
- Modify: `components/custom/LeadActivityForm/LeadActivityForm.tsx`
- Modify: `components/custom/LeadBoard/LeadBoardToolbar.tsx`
- Modify: `components/custom/LeadBoard/LeadDropDialogs.tsx`
- Modify: `components/custom/LeadClosingPanel/LeadClosingPanel.tsx`
- Modify: `components/custom/LeadDetailDialog/LeadActivityTimeline.tsx`
- Modify: `components/custom/LeadDigitalChannels/LeadDigitalChannels.tsx`
- Modify: `components/custom/LeadGbpPanel/LeadGbpGridSection.tsx`
- Modify: `components/custom/LeadGbpPanel/LeadGbpIdentity.tsx`
- Modify: `components/custom/LeadLocationField/LeadLocationField.tsx`
- Modify: `components/custom/LeadWebsitePanel/LeadWebsitePanel.tsx`
- Modify: `components/custom/TeamRoleManager/TeamRoleManager.tsx`
- Modify: `components/custom/ToolsSettings/ToolsSettings.tsx`
- Delete: `components/ui/Select/*`

**Consumes:** `Select` primitive family for static single choices; `Combobox` primitive family for dynamic, search, clearable, multi-value, chip, description, or loading choices.

**Produces:** No generic high-level Select wrapper; each consumer explicitly chooses the correct primitive.

- [ ] Use `Select` for every currently declared `searchable={false}` single-value field that has no clear button, loading state, icon metadata, or async result list.
- [ ] Use `Combobox` for Clients toolbar search, Lead board filters, lead location, clearable closing/denied reasons, dynamic team/closer options, and every multi-select field.
- [ ] Map persisted strings to option objects at the consumer boundary; convert selected option objects back to the exact current string or string-array payload.
- [ ] Compose labels/errors with Field. Use `ComboboxChips` only for current multi-select UIs.
- [ ] Static check: no `SelectItem`/`SelectProps` import or PascalCase Select import remains.

### Task 6: Add civil-date conversion and replace DatePicker with Calendar plus Popover

**Files:**

- Modify: `lib/date-time.ts`
- Modify: `components/ui/DateTimePicker/DateTimePicker.tsx` (somente a dependência interna do calendário)
- Modify: every current DatePicker consumer discovered by the direct component import search and every DatePicker usage re-exported through a form module.
- Delete: `components/ui/DatePicker/DatePicker.tsx`
- Delete: `components/ui/DatePicker/DatePicker.types.ts`
- Delete: `components/ui/DatePicker/DatePickerCalendar.tsx`
- Delete: `components/ui/DatePicker/index.ts`

**Consumes:** `Calendar`, `Popover`, `PopoverTrigger`, `PopoverContent`, `Button`, `Field`, `civilDateToCalendarDate`, and `calendarDateToCivilDate`.

**Produces:** Inline shadcn date-picker compositions that preserve string storage and local civil-date semantics.

- [ ] Add `civilDateToCalendarDate` using a local noon constructor after `isCivilDate` validation.
- [ ] Add `calendarDateToCivilDate` using local getters and zero-padded month/day output.
- [ ] Replace the internal `DatePickerCalendar` dependency in `DateTimePicker` with lower-case `Calendar`, preserving its public DateTimePicker contract.
- [ ] Replace each DatePicker invocation with a controlled Popover+Calendar composition: selected date derives from the string; selecting a Date converts immediately back to `YYYY-MM-DD`; min/max use the same converter.
- [ ] Preserve clearability and the “Hoje” action where they exist using standard Button variants.
- [ ] Static check: no `DatePicker` PascalCase import or `DatePickerCalendar` reference remains.

### Task 7: Replace Dialog and Tooltip only after composed fields

**Files:**

- Modify: all 14 current Dialog consumers, including Client Briefing review, Client Portal code reveal, Lead board dialogs, Lead creation/detail dialogs, Google Business Profile pickers, import dialogs, segment, and tag fields.
- Modify: `components/custom/LeadBoard/LeadBoardCardFace.tsx`
- Modify: `components/custom/LeadCreate/LeadCreate.tsx`
- Modify: `components/custom/NavTree/NavTree.tsx`
- Modify: `components/custom/Sidebar/Sidebar.tsx`
- Delete: `components/ui/Dialog/*`
- Delete: `components/ui/Tooltip/*`

**Consumes:** lower-case Dialog and Tooltip slot APIs.

**Produces:** Native portal, focus, close, and tooltip positioning behavior without a custom dialog portal context.

- [ ] Translate old controlled Dialog state to `open` and `onOpenChange`; use `DialogClose` for explicit close actions and retain current `onExited` side effects through close-state handlers.
- [ ] Place title/description in Dialog slot components; map custom footer/header JSX into DialogHeader and DialogFooter without nested `<dialog>` elements.
- [ ] Exercise every Select, Combobox, Calendar, and Popover inside a migrated Dialog in the existing development environment; ensure it remains visible, clickable, and keyboard-accessible.
- [ ] Replace Tooltip `content`, `side`, and trigger cloning with Tooltip slots. Remove semantic tooltip tones and use the standard foreground/background presentation.
- [ ] Static check: no imports remain from `components/ui/Dialog` or `components/ui/Tooltip`.

### Task 8: Remove stale API surface and perform migration audit

**Files:**

- Delete: all targeted PascalCase directories under `components/ui` after their consumers are migrated.
- Modify: `docs/superpowers/specs/2026-09-08-shadcn-ui-migration-design.md` only if implementation uncovers a specification change.

**Consumes:** All prior tasks.

**Produces:** A single lower-case shadcn UI API with no stale custom control layer.

- [ ] Search `app`, `components`, and `lib` for each deleted PascalCase import and confirm zero matches.
- [ ] Search migrated files for `lucide-react` and confirm zero matches.
- [ ] Search migrated files for old manual token utilities (`text-fg`, `bg-surface`, `border-input-border`, `bg-accent` on primary actions) and replace them with canonical shadcn utilities.
- [ ] Inspect light and dark routes containing forms, popovers, modal fields, buttons, and selection controls in the existing development environment.
- [ ] Record any newly discovered behavior gap in the spec before making out-of-scope changes.

## Registro de implementação — 2026-09-08

- Os diretórios PascalCase de `Button`, `Checkbox`, `DatePicker`, `Dialog`, `Input`, `InputOTP`, `RadioGroup`, `Select`, `Slider`, `Switch`, `Textarea` e `Tooltip` foram removidos depois da migração dos consumidores.
- Os consumidores agora usam os primitives lower-case do shadcn. Composições de domínio que precisam preservar máscara, label, erro, carregamento ou seleção múltipla permanecem no domínio e são formadas por `Field`, `InputGroup`, `Select`, `Combobox`, `Calendar`, `Popover` e demais primitives shadcn.
- `DateTimePicker` mantém seu contrato público por ainda ser uma composição de domínio, mas sua etapa de data passou a usar `Calendar` shadcn e as conversões civis do domínio.
- Os ícones dos primitives e consumidores migrados usam `react-icons/ri`; a auditoria de imports em `app`, `components` e `lib` não encontrou `lucide-react`.
- Auditorias estáticas também não encontraram imports dos caminhos PascalCase removidos nem referências a `DatePickerCalendar` ou ao portal antigo de Dialog.
- Não foram executados build, lint, typecheck ou testes, conforme a regra explícita do repositório. A validação desta etapa foi estática.
