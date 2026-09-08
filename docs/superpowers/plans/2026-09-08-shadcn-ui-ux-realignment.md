# Realinhamento visual shadcn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restabelecer uma UI legível, contrastada e consistente em light/dark usando tokens Mira/Mist e primitives shadcn lower-case.

**Architecture:** Primeiro corrigir o contrato de cor e as receitas dos primitives, pois consumidores compostos herdariam qualquer falha desta camada. Em seguida, migrar controles de domínio e navegação para módulos shadcn locais, preservando APIs, estado, dados e regras de negócio. A auditoria final elimina aliases de cor com significado ambíguo e imports diretos de Base UI em componentes de domínio.

**Tech Stack:** Next.js, React, Tailwind CSS v4, shadcn base-mira/Mist, Base UI através de `components/ui`, `react-icons/ri`.

**Spec:** `docs/superpowers/specs/2026-09-08-shadcn-ui-ux-realignment-design.md`

## Global Constraints

- Teal é apenas `primary`; Mist é apenas `accent` de superfície.
- Não introduzir hex, RGB ou uma paleta de produto fora dos tokens Mira/Mist e derivados com `color-mix`.
- Usar `react-icons/ri`; não aceitar import novo de `lucide-react`.
- Não alterar payloads, validações, máscaras, busca assíncrona, seleção múltipla ou valores civis de data/hora.
- Não executar `git`, build, lint, typecheck ou testes; validar por inspeção estática e verificação manual nos dois temas.
- Não criar wrappers genéricos novos para reproduzir APIs PascalCase removidas.

---

## Estrutura de arquivos e responsabilidade

- `app/globals.css`: tokens canônicos shadcn e mapeamento Tailwind, sem sobreposição semântica ambígua.
- `styles/tokens/semantic.css`: aliases transitórios e derivados de contraste; sem paleta própria.
- `lib/theme/shadcn-palette.ts`: espelho exato dos tokens que não podem ser lidos por CSS, como PDF e mapas.
- `components/ui/*.tsx`: receitas reutilizáveis de controles lower-case e seus estados.
- `components/custom/**`: composição de domínio; não contém recipes paralelos de menu, select, rádio ou controle de texto.
- `components/custom/LeadBoard/**`: referência inicial de aplicação da gramática visual.

### Task 1: Formalizar o contrato canônico de cor

**Files:**
- Modify: `app/globals.css`
- Modify: `styles/tokens/semantic.css`
- Modify: `lib/theme/shadcn-palette.ts`
- Modify: `docs/superpowers/specs/2026-09-08-shadcn-token-consolidation.md`

**Consumes:** Tema Mira/Mist existente, contrato da spec atual e espelho TypeScript de paleta.

**Produces:** Um conjunto de tokens de conteúdo, superfície, borda e status que possui o mesmo significado em CSS e no servidor.

- [ ] Definir níveis de conteúdo derivados de `foreground` e `muted-foreground` para conteúdo forte, padrão, secundário, placeholder e ícone; usar `color-mix(in oklch, ...)` exclusivamente entre tokens canônicos.
- [ ] Aplicar os mesmos níveis no bloco `.dark`, evitando que texto corrente seja branco absoluto e que conteúdo claro perca contraste sobre `card` ou `popover`.
- [ ] Manter `--primary` teal e `--accent` Mist; não criar `--accent` alternativo nem mapear utilitários `accent` para teal.
- [ ] Retirar de `@theme` as exposições compatíveis que fazem `text-accent-fg` significar foreground de primary, deixando `accent-foreground` como o único texto sobre `accent`.
- [ ] Atualizar o espelho `SHADCN_PALETTE` para os valores efetivos de `background`, `foreground`, `primary`, `accent`, `border`, `input` e seus pares dark.
- [ ] Registrar no documento de tokens a matriz: primary=teal, accent=Mist, status=success/warning/destructive, texto=camadas de conteúdo.
- [ ] Inspecionar com `rg` que não foram inseridos valores de cor literais fora dos arquivos de tema/espelho autorizados.

### Task 2: Criar receitas visíveis e acessíveis para os campos shadcn

**Files:**
- Modify: `components/ui/input.tsx`
- Modify: `components/ui/input-group.tsx`
- Modify: `components/ui/textarea.tsx`
- Modify: `components/ui/select.tsx`
- Modify: `components/ui/combobox.tsx`
- Modify: `components/ui/input-otp.tsx`
- Modify: `components/ui/field.tsx`

**Consumes:** Tokens de Task 1.

**Produces:** Campo textual, grupo, popup e validação com a mesma superfície, borda, foco e erro em light/dark.

- [ ] Fazer `Input`, `Textarea` e `InputGroup` usarem fundo de campo, borda perceptível, `hover:border-*`, focus ring teal, placeholder secundário e estado inválido destructive.
- [ ] Definir variantes explícitas de altura para contextos compacto, padrão e toolbar, substituindo classes locais de altura como responsabilidade de cada tela.
- [ ] Fazer `SelectTrigger`, `ComboboxInput` e seus popups herdarem exatamente a receita de superfície/borda do campo, sem `bg-input/20` que dilui a visualização no light.
- [ ] Garantir que lista, vazio, carregamento, item destacado, item selecionado e clear button de Select/Combobox usam `accent` somente como superfície e `primary` somente para seleção.
- [ ] Corrigir os slots de `InputOTP` para que bordas entre slots, caret, slot ativo e erro sejam perceptíveis em ambos os temas.
- [ ] Padronizar `FieldLabel`, `FieldDescription` e `FieldError` sobre os níveis de texto produzidos na Task 1, preservando associação ARIA.
- [ ] Inspecionar todos os componentes modificados para garantir que nenhum estado usa `text-accent` ou `text-accent-fg` legado.

### Task 3: Corrigir controles de escolha e ações

**Files:**
- Modify: `components/ui/button.tsx`
- Modify: `components/ui/toggle.tsx`
- Modify: `components/ui/toggle-group.tsx`
- Modify: `components/ui/checkbox.tsx`
- Modify: `components/ui/radio-group.tsx`
- Modify: `components/ui/switch.tsx`
- Modify: `components/ui/slider.tsx`
- Modify: `components/ui/badge.tsx`

**Consumes:** Tokens e receita de interação das Tasks 1–2.

**Produces:** Ações, filtros e escolhas que distinguem semântica de seleção, status e destruição.

- [ ] Garantir que `Button` default use teal e que `secondary`, `outline`, `ghost` e `destructive` tenham texto, hover e disabled legíveis.
- [ ] Ajustar `Toggle` para estado ligado com `primary` e texto sobre primary, mantendo `outline` para filtros na toolbar.
- [ ] Garantir que checkbox e rádio desligados tenham fundo de campo e borda visível; ligados usam `primary` e `primary-foreground`.
- [ ] Adicionar contorno estável ao switch desligado; separar superfície desligada (`muted`/`input`) de foco (`ring`) e ligado (`primary`).
- [ ] Trocar o thumb `bg-white` do slider por token de superfície e usar `primary` apenas no range ativo.
- [ ] Revisar Badge para que um badge de estado não seja confundido com filtro ativo e sempre tenha texto/ícone contrastado.
- [ ] Verificar visualmente estados normal, hover, focus-visible, pressed/checked, invalid e disabled em light e dark.

### Task 4: Reestruturar o Lead Board como implementação de referência

**Files:**
- Modify: `components/custom/LeadBoard/LeadBoardToolbarToggle.tsx`
- Modify: `components/custom/LeadBoard/LeadBoardToolbar.tsx`
- Modify: `components/custom/LeadBoard/LeadBoardColumn.tsx`
- Modify: `components/custom/LeadBoard/LeadBoardCardFace.tsx`
- Modify: `components/custom/LeadBoard/LeadBoard.tsx`
- Modify: `components/custom/LeadBoard/LeadCityFilter.tsx`

**Consumes:** `Toggle`, `Button`, `InputGroup`, `Select`, `Combobox`, `Badge`, tokens e receitas corrigidos.

**Produces:** Toolbar com semântica de filtro correta e kanban com níveis de conteúdo legíveis.

- [ ] Substituir o `<button aria-pressed>` de `LeadBoardToolbarToggle` por `Toggle`, com `pressed` e `onPressedChange`; manter o ponto de pendência como badge isolado.
- [ ] Remover `activeTone`; ambos os filtros ativos usam teal. “Ligar hoje” mantém warning apenas em dados de prazo, nunca no estado de seleção.
- [ ] Trocar o botão manual “Limpar filtros” por `Button variant="ghost"` com texto e foco padrão.
- [ ] Usar `InputGroup` para busca, `Select` para escopo/segmento/tag estáticos e `Combobox` para cidade pesquisável; preservar debounce, URL params, loading e limpeza.
- [ ] Converter cores legadas de cartão/coluna/chip por intenção: título=conteúdo forte, domínio/metadado=secundário, ícone contextual=secundário, seleção=primary, hover=Mist.
- [ ] Confirmar que cartões não usem `bg-accent text-accent-fg` e que informações de atraso/fechamento continuem destructive, warning ou success conforme dados.
- [ ] Verificar manualmente toolbar e cards em 1280px e em largura estreita, nos temas claro e escuro.

### Task 5: Migrar menus de domínio para DropdownMenu shadcn

**Files:**
- Modify: `components/custom/ClientCardMenu/ClientCardMenu.tsx`
- Modify: `components/custom/LeadClaimActions/LeadClaimActions.tsx`
- Modify: `components/custom/LeadImport/LeadImportFileCard.tsx`
- Modify: `components/custom/LeadDigitalChannels/LeadDigitalChannels.tsx`
- Modify: `components/custom/LeadGbpPanel/LeadGbpProfileCard.tsx`

**Consumes:** `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `Button` e tokens corrigidos.

**Produces:** Todos os menus de reticências usam o mesmo popup, foco, atalhos e item destructive.

- [ ] Trocar import direto de `@base-ui/react/menu` pelos exports de `components/ui/dropdown-menu`.
- [ ] Renderizar trigger de reticências como `Button variant="ghost" size="icon"` com `aria-label` específico do recurso.
- [ ] Trocar `Menu.Item` por `DropdownMenuItem`; ações de remoção, rotação ou revogação usam `variant="destructive"`.
- [ ] Preservar `closeOnClick={false}` para confirmação em duas etapas e o bloqueio de propagação necessário dentro de cards clicáveis.
- [ ] Manter carregamento, permissões, falhas e copy-to-clipboard; apresentar texto de erro/status fora do item acionável quando necessário.
- [ ] Conferir por teclado: Enter/Espaço abre, setas percorrem, Escape fecha e foco retorna ao trigger.

### Task 6: Migrar comboboxes de domínio para o módulo local

**Files:**
- Modify: `components/custom/BriefingAddressSearch/BriefingAddressSearch.tsx`
- Modify: `components/custom/LeadBoard/LeadCityFilter.tsx`
- Modify: `components/custom/LeadSegmentField/LeadSegmentField.tsx`
- Modify: `components/custom/LeadTagField/LeadTagField.tsx`
- Modify: `components/custom/LeadGbpPanel/LeadGbpPlacePicker.tsx`
- Modify: `components/ui/combobox.tsx` only if a missing lower-case slot prevents preservation of public behavior.

**Consumes:** Combobox estilizado da Task 2 e ações/buscas existentes.

**Produces:** Busca assíncrona, carregamento, paginação, seleção única/múltipla e chips sem import direto do primitive externo.

- [ ] Substituir `Combobox.Root`, `Input`, `Portal`, `Positioner`, `Popup`, `List`, `Item` e `Empty` diretos pelos slots lower-case locais equivalentes.
- [ ] Preservar `items`, igualdade de objetos, `itemToStringLabel`, `inputValue`, `onInputValueChange`, filtro remoto, debounce, cancelamento por request id e `modal={false}` quando o picker estiver dentro de outro overlay.
- [ ] Para cidade, manter paginação “Carregar mais”, limpar cidade/UF e foco programático no input.
- [ ] Para tags, segmentos e endereços, preservar chips, seleção múltipla, descrições, ícones, erro e limpeza.
- [ ] Se o `ComboboxInput` local precisar de ref ou addon inicial/final para preservar algum desses fluxos, ampliar esse slot em `components/ui/combobox.tsx`; não duplicar um combobox manual no domínio.
- [ ] Confirmar que nenhum dos cinco arquivos importa `@base-ui/react/combobox` ao final.

### Task 7: Migrar cartões de escolha e os seletores de data/hora

**Files:**
- Modify: `components/custom/BriefingChoiceCard/BriefingChoiceCard.tsx`
- Modify: `components/custom/BriefingChoiceCard/BriefingChoiceCardGroup.tsx`
- Modify: `components/ui/DateTimePicker/DateTimePicker.tsx`
- Modify: `components/ui/TimePicker/TimePicker.tsx`
- Modify: `components/ui/TimePicker/TimePickerPanel.tsx`
- Modify: `components/ui/TimePicker/TimePickerClock.tsx`

**Consumes:** `RadioGroup`, `RadioGroupItem`, `Field`, `Popover`, `Calendar`, `Button`, `ToggleGroup` e `InputGroup`.

**Produces:** Cards e seletores de data/hora visualmente nativos da biblioteca, mantendo contratos públicos e data civil.

- [ ] Substituir os imports diretos de rádio por `RadioGroup` e `RadioGroupItem`; o card continua acessível por label e usa primary apenas quando checked.
- [ ] Substituir botões internos de DateTime/TimePicker por `Button` ou `ToggleGroup` conforme são ação momentânea ou seleção persistente.
- [ ] Substituir `Popover` direto por `components/ui/popover`, preservando o portal, o cálculo de altura do relógio e o comportamento de fechar/commit.
- [ ] Fazer trigger de data/hora seguir a receita de campo da Task 2, com ícone secundário, placeholder secundário, clear action ghost e erro destructive.
- [ ] Trocar todos os estados `bg-accent-muted text-fg` de data/hora por pares coerentes de `primary`/`primary-foreground` para escolha ativa e `accent`/`accent-foreground` para seleção passiva.
- [ ] Manter `civilDateToCalendarDate`, `calendarDateToCivilDate`, `YYYY-MM-DD`, horário civil, min/max, “Hoje”, “Agora” e acessibilidade da popup.

### Task 8: Reconstituir tema e navegação com primitives semânticos

**Files:**
- Modify: `components/ui/ThemeToggle/ThemeToggle.tsx`
- Modify: `components/custom/Sidebar/Sidebar.tsx`
- Modify: `components/custom/NavTree/NavTree.tsx`
- Modify: `components/custom/MobileNavigation/MobileNavigation.tsx`
- Modify: `components/custom/navigation.ts` if navigation metadata needs a stable key/label for shadcn menu slots.

**Consumes:** `DropdownMenuRadioGroup`, `Sidebar`, `SidebarMenu`, `SidebarMenuButton`, `Collapsible`, `Sheet`, `Tooltip`, `Button` e Theme API atual.

**Produces:** Tema explícito e navegação hierárquica que preservam dados, atalho Ctrl+B, animação e responsividade sem recipes manuais de controls.

- [ ] Transformar ThemeToggle em `DropdownMenu` com radio items “Sistema”, “Claro” e “Escuro”; o trigger mostra o estado atual e não exige que a pessoa deduza o próximo estado do ciclo.
- [ ] Usar `Sidebar`/`SidebarMenu` para estrutura desktop, `Sheet` para mobile e `Collapsible` para grupos expansíveis; preservar `NAV_ITEMS`, estado de rota e persistência de colapso.
- [ ] Substituir triggers de recolher, logout e ações de item por `Button` com variante apropriada; conservar tooltip apenas no modo colapsado.
- [ ] Mapear ícone ativo para `text-primary`, fundo ativo para `sidebar-accent` ou `primary/10` conforme contexto, e texto para camadas de conteúdo corretas.
- [ ] Preservar carregamento de rota e árvores visuais, mas remover uso de `text-accent`/`text-accent-fg` legado e de botões manuais quando houver primitive equivalente.
- [ ] Conferir teclado, foco, hover, rota atual e viewport mobile em ambos os temas.

### Task 9: Auditar consumidores de formulário e controles nativos remanescentes

**Files:**
- Modify: todos os arquivos retornados por `rg -l '<(button|input|textarea|select)' components/custom app --glob '*.tsx'`, exceto uploads que exigem input nativo.
- Modify: `components/custom/BriefingFormControls/BriefingFormControls.tsx`

**Consumes:** Primitives corrigidos nas Tasks 2–3.

**Produces:** Nenhum input, textarea, select ou botão manual quando um primitive shadcn se aplicar sem perda de comportamento.

- [ ] Classificar cada ocorrência como upload nativo, link semântico, primitive shadcn já composto ou duplicação manual.
- [ ] Trocar campos textuais e textareas duplicados por `Input`/`Textarea`/`InputGroup`/`Field`, preservando identificador, autoComplete, inputMode, máscara, onBlur, erro e contador.
- [ ] Trocar escolhas simples por `Select`, escolhas pesquisáveis por `Combobox`, múltiplas por `Combobox` com chips ou `CheckboxGroup` conforme a interação existente.
- [ ] Trocar ações comuns por `Button`, filtros por `Toggle`, grupos exclusivos por `ToggleGroup`, e ações contextuais por `DropdownMenu`.
- [ ] Reduzir `BriefingFormControls` a composições de domínio estritamente necessárias; não manter uma API visual paralela ao shadcn.
- [ ] Confirmar que upload de arquivo continua nativo e acessível, com trigger shadcn apenas como apresentação quando aplicável.

### Task 10: Impedir regressão de ícones e imports de primitives

**Files:**
- Modify: `components.json`
- Modify: `docs/superpowers/specs/2026-09-08-shadcn-ui-ux-realignment-design.md` only if the chosen generator policy changes.
- Modify: documentação de contribuição existente, if one is found; otherwise create `docs/ui-component-generation.md`.

**Consumes:** Decisão explícita de que ícones de produto são `react-icons/ri`.

**Produces:** Regra verificável para que novos componentes não reintroduzam Lucide ou Base UI direto no domínio.

- [ ] Alterar `components.json` de `"iconLibrary": "lucide"` para `"iconLibrary": "remixicon"`, impedindo geração futura de Lucide; como o gerador não oferece `react-icons`, documentar a substituição manual obrigatória para `react-icons/ri` no mesmo change set.
- [ ] Documentar a regra: `components/ui` é a única fronteira permitida para imports de `@base-ui/react`; `components/custom` importa somente modules lower-case locais.
- [ ] Documentar equivalências: reticências=`DropdownMenu`, filtro=`Toggle`, ação=`Button`, campo pesquisável=`Combobox`, escolha=`RadioGroup`/`Checkbox`.
- [ ] Buscar `lucide-react` e imports diretos de `@base-ui/react/(menu|combobox|radio|radio-group|popover)` em `app` e `components/custom`; resolver cada ocorrência não justificada.

### Task 11: Auditoria de aceite visual e estática

**Files:**
- Modify: `docs/superpowers/plans/2026-09-08-shadcn-ui-ux-realignment.md` to check completed items and record evidence.

**Consumes:** Todas as tasks anteriores.

**Produces:** Registro de conformidade e lista explícita de qualquer exceção aprovada.

- [ ] Buscar referências legadas: `text-accent`, `text-accent-fg`, `bg-accent-muted`, `text-fg`, `text-fg-secondary`, `text-fg-muted`, `border-input-border` e `bg-input` em consumidores; classificar cada remanescente como token permitido ou converter por intenção.
- [ ] Buscar imports de `lucide-react`, de componentes PascalCase removidos e de Base UI direto em domínio; o resultado deve estar vazio salvo exceções documentadas de primitive sem módulo local.
- [ ] Inspecionar manualmente: Login, criação de usuário, formulário de briefing, Lead Board, detalhes de lead, cliente, importação, Select/Combobox dentro de Dialog, DateTimePicker e sidebar.
- [ ] Para cada rota, observar light e dark em estado normal, hover, focus-visible, disabled, erro, loading, seleção e popup aberto.
- [ ] Validar por teclado Toggle, DropdownMenu, Combobox, Dialog, Date/TimePicker, sidebar e tema.
- [ ] Registrar na seção de implementação deste plano somente exceções que preservem uma limitação funcional real; não registrar como exceção uma receita visual duplicada.

## Mapeamento de cobertura da spec

- Contrato de tokens e contraste: Task 1.
- Inputs, selects, comboboxes, OTP e campos: Task 2.
- Buttons, toggles, rádio, checkbox, switch, slider e badges: Task 3.
- Lead Board e `LeadBoardToolbarToggle`: Task 4.
- Menus contextuais de domínio: Task 5.
- Comboboxes de domínio: Task 6.
- Cards de escolha, calendário e horário: Task 7.
- Sidebar, navegação e tema: Task 8.
- Controles manuais remanescentes: Task 9.
- Política de ícones e fronteira Base UI: Task 10.
- Aceite visual, acessível e estático: Task 11.

## Registro de implementação — 2026-09-08

- O contrato de conteúdo ganhou níveis derivados de Mira/Mist em `styles/tokens/semantic.css`; o corpo e aliases de conteúdo não exibem cópia corrente como preto/branco absoluto.
- `Input`, `InputGroup`, `Textarea`, `Select`, `InputOTP`, `Checkbox`, `RadioGroup`, `Switch`, `Slider` e `Toggle` receberam superfície de campo, borda perceptível, foco por ring e estados teal/destructive coerentes.
- `LeadBoardToolbarToggle` agora é `Toggle`; o estado de filtro ativo é teal e o indicador de pendência continua independente.
- Menus de cliente, lead, importação, canais e GBP usam `DropdownMenu`; comboboxes e cartões de escolha de domínio usam os primitives lower-case locais.
- `ThemeToggle` agora expõe Sistema, Claro e Escuro em `DropdownMenuRadioGroup`. Triggers da sidebar e navegação foram convertidos para `Button` e os estados ativos usam primary.
- Date/TimePicker e os campos textuais de maior uso receberam tokens e componentes lower-case, preservando data civil, IDs, limites, handlers e ARIA.
- `components.json` deixou de indicar Lucide. Ícones de produto permanecem em `react-icons/ri`.
- A busca estática não encontrou `lucide-react`, imports diretos de `@base-ui/react` em `components/custom`, caminhos PascalCase removidos, `text-accent-fg`, `bg-accent-muted` ou controles nativos nos campos auditados.
- Não foram executados git, build, lint, typecheck ou testes, conforme regras do repositório. Não havia aplicação em execução nas superfícies disponíveis para uma inspeção visual live; a validação desta entrega é estática.
