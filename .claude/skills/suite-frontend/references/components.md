# Componentes

48 módulos em `components/ui`, 238 componentes. Variantes e tamanhos abaixo são transcritos do `cva` real de cada arquivo. Quando o módulo for composto, abra o `.tsx` — ele está do lado e nunca desatualiza.

## Mapa de decisão

| Preciso de | Use | Não use |
|---|---|---|
| ação que muda estado ou navega | `Button` | `Toggle` |
| filtro binário que persiste | `Toggle` | `Button` com variante manual |
| opções mutuamente exclusivas numa barra | `ToggleGroup` | vários `Toggle` |
| menu de reticências | `DropdownMenu` | — |
| escolha em lista curta e fixa | `Select` | `Combobox` |
| escolha pesquisável, assíncrona ou múltipla | `Combobox` | `Select` |
| escolha única sempre visível | `RadioGroup` | `Select` |
| escolha em cartão | `RadioGroup` com layout de card | cartão clicável à mão |
| confirmação destrutiva | `AlertDialog` | `Dialog` |
| feedback transitório | `Toast` | `Alert` |
| aviso persistente na página | `Alert` | `Toast` |
| rótulo de estado | `Badge` | `Button size="xs"` |
| campo com rótulo, erro e ajuda | `Field` | `Label` + `Input` soltos |
| prefixo, sufixo ou botão dentro do campo | `InputGroup` | `div` com `absolute` |
| paleta de comandos | `Command` | `Combobox` |
| lista de registros com ação | `Item` | `Card` por linha |
| tabela de dados | `Table` | `Item` em grid |
| esperar sem saber quanto falta | `Spinner` | `Progress` |
| esperar sabendo a fração | `Progress` | `Spinner` |
| esperar mostrando a forma que vem | `Skeleton` | `Spinner` |

## O que não está instalado

Não existem em `components/ui`: `context-menu`, `sheet`, `sidebar`, `hover-card`, `navigation-menu`, `resizable`, `scroll-area`, `carousel`.

Quando a tarefa pedir um deles: componha com o que existe, ou instale pelo CLI do shadcn. **Nunca escreva um primitive à mão** — ele nasce fora do contrato de tokens e do vocabulário de foco, e vira o próximo realinhamento.

Como não há `context-menu`, menu de reticências e clique direito caem os dois em `DropdownMenu`.

Os tokens `--color-sidebar-*` existem em `globals.css`, mas quem os consome é `components/custom/Sidebar` e `NavTree` — implementação de produto, não primitive de registry.

## Módulos

### Ações e feedback

#### Button
Ação que muda estado ou navega. Não é filtro (`Toggle`), não é escolha exclusiva (`ToggleGroup`), não é rótulo (`Badge`).
Exporta: `Button`, `buttonVariants`
`variant`: `default` · `outline` · `secondary` · `ghost` · `destructive` · `link`
`size`: `default` (h-7) · `xs` (h-5) · `sm` (h-6) · `lg` (h-8) · `icon` (size-7) · `icon-xs` (size-5) · `icon-sm` (size-6) · `icon-lg` (size-8)
⚠ `destructive` é fundo `destructive/10` com texto vermelho, não bloco vermelho sólido — `destructive` não tem par `-foreground`. Exclusão de verdade é `AlertDialog` com este botão no confirmar.
⚠ O ícone dimensiona sozinho por `size`, via `[&_svg:not([class*='size-'])]`. Passar `size={14}` no ícone anula a regra e desalinha a linha.
⚠ Botão sem texto visível exige `aria-label`.

#### ButtonGroup
Ações irmãs coladas, com bordas compartilhadas. Não é `ToggleGroup` — aqui cada botão faz coisa diferente.
Exporta: `ButtonGroup`, `ButtonGroupText`, `ButtonGroupSeparator`
`orientation`: `horizontal` (padrão) · `vertical`

#### Toggle
Filtro binário que persiste. Não é `Button` com estado pintado à mão.
Exporta: `Toggle`, `toggleVariants`
`variant`: `default` · `outline`
`size`: `default` · `sm` (h-6) · `lg` (h-8)
⚠ Ligado usa `primary`. `warning` não significa "selecionado" — significa atenção. Se o item também tem pendência, isso é um `Badge` separado.

#### ToggleGroup
Opções mutuamente exclusivas numa barra. Para múltiplas independentes, são `Toggle` soltos.
Exporta: `ToggleGroup`, `ToggleGroupItem`

#### Badge
Rótulo de estado ou contagem. Não é botão, não é filtro.
Exporta: `Badge`, `badgeVariants`
`variant`: `default` · `secondary` · `destructive` · `primary` · `success` · `warning` · `muted` · `outline` · `ghost` · `link`
⚠ Tem `success` e `warning` próprios — não pinte um `default` com classe de cor.

#### Alert
Aviso que fica na página enquanto a condição durar. Para algo que passa, é `Toast`.
Exporta: `Alert`, `AlertTitle`, `AlertDescription`, `AlertAction`
`variant`: `default` · `destructive`
⚠ Só duas variantes. Aviso de atenção é `default` com ícone e texto que dizem a gravidade — não invente `variant="warning"`.

#### Toast
Feedback transitório de uma ação. Não carrega informação que o usuário precise reler.
Exporta: `ToastProvider`, `ToastPortal`, `ToastViewport`, `Toast`, `ToastContent`, `ToastTitle`, `ToastDescription`, `ToastAction`, `ToastClose`, `ToastIcon`, `ToastList`, `Toaster`
Composição: `Toaster` na raiz da tela → o resto é interno. Dispare pelo hook, não montando `Toast` à mão.
⚠ 12 componentes, 229 linhas. O verbo do toast é o mesmo do botão que o disparou: `Publicar` → `Publicado`.

#### Spinner
Espera sem fração conhecida.
Exporta: `Spinner`
⚠ Se você sabe quanto falta, é `Progress`. Se sabe a forma do que vem, é `Skeleton`.

#### Progress
Espera com fração conhecida, ou medida de 0 a 100.
Exporta: `Progress`, `ProgressTrack`, `ProgressIndicator`, `ProgressLabel`, `ProgressValue`
Composição: `Progress` → `ProgressLabel` + `ProgressValue` + `ProgressTrack` → `ProgressIndicator`.

#### Skeleton
Espera mostrando o layout que vai chegar.
Exporta: `Skeleton`
⚠ Skeleton com forma errada mente. Se a lista vem com 3 linhas, mostre 3 — não 8.

### Formulários

#### Field
Campo completo: rótulo, controle, descrição e erro, com as ligações ARIA já feitas.
Exporta: `FieldSet`, `FieldLegend`, `FieldGroup`, `Field`, `FieldContent`, `FieldLabel`, `FieldTitle`, `FieldDescription`, `FieldSeparator`, `FieldError`
`orientation`: `vertical` (padrão) · `horizontal` · `responsive`
Composição: `FieldSet` → `FieldLegend` → `FieldGroup` → `Field` → `FieldLabel` + `FieldContent` (controle) + `FieldDescription` + `FieldError`.
⚠ É aqui que moram `aria-invalid` e `aria-describedby`. Montar `Label` + `Input` à mão perde os dois e quebra o leitor de tela.

#### Label
Rótulo isolado, quando `Field` é demais.
Exporta: `Label`

#### Input
Entrada de texto de uma linha.
Exporta: `Input`
⚠ Altura vem do registry. `h-10` aqui desalinha da toolbar inteira.

#### Textarea
Entrada de várias linhas.
Exporta: `Textarea`

#### InputGroup
Campo com prefixo, sufixo, ícone ou botão dentro da moldura.
Exporta: `InputGroup`, `InputGroupAddon`, `InputGroupButton`, `InputGroupText`, `InputGroupInput`, `InputGroupTextarea`
`align` (addon): `inline-start` (padrão) · `inline-end` · `block-start` · `block-end`
`size` (button): `xs` (padrão) · `sm` · `icon-xs` · `icon-sm`
Composição: `InputGroup` → `InputGroupAddon align=…` + `InputGroupInput`.
⚠ É o primitive da busca em toolbar. Ícone posicionado por `absolute` sobre um `Input` é a versão errada.

#### InputOTP
Código de verificação em casas separadas.
Exporta: `InputOTP`, `InputOTPGroup`, `InputOTPSlot`, `InputOTPSeparator`

#### Checkbox
Escolha binária independente dentro de formulário. Filtro persistente em toolbar é `Toggle`.
Exporta: `Checkbox`
⚠ Desligado tem contorno; ligado é `primary`. Sem o contorno, o estado desligado some no escuro.

#### RadioGroup
Escolha única entre opções visíveis. Muitas opções ou busca → `Select`/`Combobox`.
Exporta: `RadioGroup`, `RadioGroupItem`
⚠ É a base do cartão de escolha. `BriefingChoiceCard` já faz isso — use, não refaça.

#### Switch
Liga e desliga com efeito imediato. Se só vale depois de salvar, é `Checkbox`.
Exporta: `Switch`

#### Slider
Valor contínuo numa faixa.
Exporta: `Slider`
⚠ O thumb usa `background` e contorno do tema. `bg-white` cravado some no claro.

#### Select
Escolha em lista curta e fixa, sem busca.
Exporta: `SelectGroup`, `SelectValue`, `SelectTrigger`, `SelectContent`, `SelectLabel`, `SelectItem`, `SelectSeparator`, `SelectScrollUpButton`, `SelectScrollDownButton`
Composição: `Select` → `SelectTrigger` → `SelectValue`; `SelectContent` → `SelectGroup` → `SelectLabel` + `SelectItem`.
⚠ Precisou de busca, carregamento ou múltipla seleção? É `Combobox`. Adaptar `Select` para isso foi o erro do filtro de cidade.

#### Combobox
Escolha pesquisável, assíncrona ou múltipla, com chips.
Exporta: `ComboboxValue`, `ComboboxRootLabel`, `ComboboxTrigger`, `ComboboxClear`, `ComboboxContent`, `ComboboxList`, `ComboboxItem`, `ComboboxGroup`, `ComboboxLabel`, `ComboboxCollection`, `ComboboxEmpty`, `ComboboxSeparator`, `ComboboxChips`, `ComboboxChip`, `ComboboxChipsInput`
Composição: raiz → `ComboboxChips` (se múltiplo) → `ComboboxChip` + `ComboboxChipsInput`; `ComboboxContent` → `ComboboxList` → `ComboboxGroup`/`ComboboxItem`, com `ComboboxEmpty` **dentro** de `ComboboxList`.
⚠ 15 componentes em 324 linhas. Compor de memória erra a ordem — abra o arquivo.

#### Calendar
Seleção de data em grade mensal.
Exporta: `Calendar`, `CalendarDayButton`
⚠ Data e hora civil já estão resolvidas em `DateTimePicker` e `TimePicker`. Não recrie a regra de fuso.

### Navegação e comandos

#### Tabs
Troca de vista dentro do mesmo contexto, sem mudar de rota.
Exporta: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, `tabsListVariants`
`variant` (list): `default` (fundo `muted`) · `line` (sublinhado, sem fundo)
⚠ Aba não é navegação de página. Se o conteúdo merece URL própria, é rota.

#### Breadcrumb
Caminho de volta numa hierarquia.
Exporta: `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbPage`, `BreadcrumbSeparator`, `BreadcrumbEllipsis`
⚠ A página atual é `BreadcrumbPage`, não `BreadcrumbLink` — ela não é clicável.

#### Pagination
Navegação entre páginas de resultado.
Exporta: `Pagination`, `PaginationContent`, `PaginationItem`, `PaginationLink`, `PaginationPrevious`, `PaginationNext`, `PaginationEllipsis`

#### Command
Paleta de comandos e busca com teclado.
Exporta: `Command`, `CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandSeparator`, `CommandItem`, `CommandShortcut`
Composição: `CommandDialog` → `Command` → `CommandInput` + `CommandList` → `CommandGroup` → `CommandItem`. `CommandEmpty` dentro de `CommandList`.
⚠ É para comandos, não para escolher valor de campo — isso é `Combobox`.

#### Kbd
Tecla ou atalho no texto.
Exporta: `Kbd`, `KbdGroup`
⚠ Atalho documentado na interface só vale se estiver realmente ligado. `Ctrl+B` e `Ctrl+E` existem no painel GBP.

#### Accordion
Seções que abrem e fecham numa lista, uma ou várias por vez.
Exporta: `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`

#### Collapsible
Um trecho que abre e fecha. Para vários irmãos coordenados, é `Accordion`.
Exporta: `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`

### Camadas

#### Dialog
Tarefa focada que interrompe a página. Um objetivo por diálogo.
Exporta: `Dialog`, `DialogTrigger`, `DialogPortal`, `DialogClose`, `DialogOverlay`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`
Composição: `Dialog` → `DialogTrigger` + `DialogContent` → `DialogHeader` (`DialogTitle` + `DialogDescription`) + corpo + `DialogFooter`.
⚠ `DialogTitle` é obrigatório mesmo quando invisível — é o nome acessível da camada. Escondido vai em `sr-only`.

#### AlertDialog
Confirmação de algo irreversível. Não tem fechar por clique fora.
Exporta: `AlertDialog`, `AlertDialogTrigger`, `AlertDialogPortal`, `AlertDialogOverlay`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogFooter`, `AlertDialogMedia`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction`, `AlertDialogCancel`
Composição: igual ao `Dialog`, com `AlertDialogAction` e `AlertDialogCancel` no footer.
⚠ Só para destrutivo ou irreversível. Usar em pergunta comum treina o usuário a clicar sem ler.

#### Popover
Conteúdo ancorado a um gatilho, com foco.
Exporta: `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverHeader`, `PopoverTitle`, `PopoverDescription`
⚠ `DateTimePicker` e `TimePicker` ainda importam `Popover` de `@base-ui/react`. Código novo usa este.

#### Tooltip
Texto curto que explica um controle. Sem foco, sem ação dentro.
Exporta: `TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent`
⚠ `TooltipProvider` já está na raiz (`app/layout.tsx`). Não monte outro.
⚠ Tooltip não substitui `aria-label` — em touch ele não existe.

#### DropdownMenu
Ações secundárias agrupadas, inclusive o menu de reticências.
Exporta: `DropdownMenu`, `DropdownMenuPortal`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuGroup`, `DropdownMenuLabel`, `DropdownMenuItem`, `DropdownMenuSub`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, `DropdownMenuSeparator`, `DropdownMenuShortcut`
Composição: raiz → `DropdownMenuTrigger` + `DropdownMenuContent` → `DropdownMenuGroup` → `DropdownMenuLabel` + `DropdownMenuItem`. Submenu é `DropdownMenuSub` → `SubTrigger` + `SubContent`.
⚠ Escolha exclusiva dentro do menu é `DropdownMenuRadioGroup` — é assim que o `ThemeToggle` expõe sistema/claro/escuro.

### Conteúdo e dados

#### Card
Superfície que agrupa conteúdo relacionado.
Exporta: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter`
⚠ Cartão idêntico para conteúdos de hierarquias diferentes achata a tela. Se tudo é cartão, nada é.

#### Item
Linha de registro com mídia, título, descrição e ações.
Exporta: `ItemGroup`, `ItemSeparator`, `Item`, `ItemMedia`, `ItemContent`, `ItemTitle`, `ItemDescription`, `ItemActions`, `ItemHeader`, `ItemFooter`
`variant`: `default` · `outline` · `muted`
`size`: `default` · `sm` · `xs`
`variant` (media): `default` · `icon` · `image`
Composição: `ItemGroup` → `Item` → `ItemMedia` + `ItemContent` (`ItemTitle` + `ItemDescription`) + `ItemActions`.
⚠ Para lista de registros, `Item` custa menos que `Card` por linha e já traz o alinhamento.

#### Table
Dados tabulares com cabeçalho.
Exporta: `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`
⚠ Tabela larga rola dentro do próprio contêiner (`overflow-x-auto`). A página nunca rola na horizontal.

#### Chart
Gráficos sobre Recharts, com tooltip e legenda do tema.
Exporta: `ChartContainer`, `ChartTooltipContent`, `ChartLegendContent`
⚠ 372 linhas. A rampa `chart-1..5` é sequencial — para séries categóricas sem ordem, ela inventa hierarquia.
⚠ Antes de escolher a forma do gráfico, carregue a skill `dataviz`. Esta referência cobre o componente, não a escolha visual.

#### Avatar
Identidade em imagem, com fallback e agrupamento.
Exporta: `Avatar`, `AvatarImage`, `AvatarFallback`, `AvatarBadge`, `AvatarGroup`, `AvatarGroupCount`
⚠ `AvatarFallback` não é opcional — imagem quebrada sem ele deixa um buraco.

#### Separator
Divisão estrutural entre blocos.
Exporta: `Separator`
⚠ Separador é informação: ele diz que os dois lados são coisas diferentes. Entre itens da mesma lista, use espaço.

#### AspectRatio
Proporção fixa para mídia.
Exporta: `AspectRatio`

#### Empty
Estado vazio com ícone, título, descrição e ação.
Exporta: `Empty`, `EmptyHeader`, `EmptyMedia`, `EmptyTitle`, `EmptyDescription`, `EmptyContent`
`variant` (media): `default` · `icon`
Composição: `Empty` → `EmptyHeader` (`EmptyMedia` + `EmptyTitle` + `EmptyDescription`) + `EmptyContent` (ação).
⚠ Vazio é convite. "Sem dados" não é texto de `EmptyTitle`.

#### Marker
Marcador de item em lista ou linha do tempo.
Exporta: `Marker`, `MarkerIcon`, `MarkerContent`, `markerVariants`
`variant`: `default` · `separator` · `border`

### Conversas e anexos

#### Message
Mensagem numa conversa, com autor e horário.
Exporta: `MessageGroup`, `Message`, `MessageAvatar`, `MessageContent`, `MessageHeader`, `MessageFooter`

#### MessageScroller
Viewport de conversa que gruda no fim e avisa quando há mensagem nova.
Exporta: `MessageScrollerProvider`, `MessageScroller`, `MessageScrollerViewport`, `MessageScrollerContent`, `MessageScrollerItem`, `MessageScrollerButton`
Composição: `MessageScrollerProvider` → `MessageScroller` → `MessageScrollerViewport` → `MessageScrollerContent` → `MessageScrollerItem`; `MessageScrollerButton` fora do viewport.

#### Bubble
Balão de mensagem com reações.
Exporta: `BubbleGroup`, `Bubble`, `BubbleContent`, `BubbleReactions`
`variant`: `default` · `secondary` · `muted` · `tinted` · `outline` · `ghost` · `destructive`
`side` (reações): `top` · `bottom` (padrão) — `align`: `start` · `end` (padrão)
⚠ `tinted` deriva de `primary` por cor relativa (`oklch(from var(--primary) …)`). É legítimo e é a única forma permitida de `oklch()` fora de `globals.css`.

#### Attachment
Arquivo anexado, em ícone ou miniatura.
Exporta: `Attachment`, `AttachmentMedia`, `AttachmentContent`, `AttachmentTitle`, `AttachmentDescription`, `AttachmentActions`, `AttachmentAction`, `AttachmentTrigger`, `AttachmentGroup`
`size`: `default` · `sm` · `xs` — `orientation`: `horizontal` · `vertical` — `variant`: `icon` (padrão) · `image`
⚠ Upload continua sendo `<input type="file">` nativo. Ele é a implementação acessível correta; não o substitua.

## Wrappers de domínio — não recrie

Encapsulam regra de negócio e têm API pública estável.

| Wrapper | Regra que carrega |
|---|---|
| `DateTimePicker` | data e hora civil, sem fuso |
| `TimePicker` | hora civil |
| `BriefingChoiceCard` | `RadioGroup` com layout de cartão |
| `ThemeToggle` | sistema/claro/escuro por `DropdownMenuRadioGroup` |
| `Stepper` | progresso de fluxo longo |
| `NavTree` | hierarquia de navegação com colapso |
| `AuthPageShell` | moldura das telas de sessão |
