# Realinhamento visual shadcn — especificação

## Objetivo

Restaurar contraste, hierarquia visual, bordas e estados de interação em light e dark, consolidando a interface sobre os primitives lower-case do shadcn com teal como `primary` e Mist como `accent` de superfície.

## Diagnóstico confirmado

O problema não é uma ausência isolada de CSS. A migração anterior deixou dois vocabulários de token ativos ao mesmo tempo:

- O shadcn Mira/Mist define `primary` como teal e `accent` como Mist.
- Muitos consumidores antigos ainda usam `text-accent`, `text-accent-fg` e `bg-accent-muted` como se `accent` fosse teal.
- Em light, `accent` é uma superfície Mist muito clara; em dark, é uma superfície Mist muito escura. Assim, `text-accent` perde contraste nos dois temas.
- `text-accent-fg` é ainda mais crítico: ele é o antigo foreground de teal aplicado sobre a superfície Mist em pontos como navegação e horários.
- Os controles lower-case têm classes de borda, mas elas são anuladas visualmente por superfícies de baixo contraste, por alturas/cores manuais nos consumidores e por controles de domínio que ainda implementam o primitive diretamente.

Os prints do Lead Board evidenciam o efeito: rótulos, ícones e ações usam intensidade semelhante apesar de terem papéis diferentes; o filtro ativo não comunica seleção; e a borda dos campos não delimita a área interativa com segurança.

## Contrato de tokens

### Fonte de verdade

`app/globals.css` continua sendo a origem dos tokens Mira/Mist. `styles/tokens/semantic.css` pode conter apenas aliases semânticos derivados desses tokens; não pode introduzir hexadecimal de produto, uma segunda paleta ou reutilizar nomes canônicos com outro significado.

### Semântica obrigatória

- `primary` / `primary-foreground`: teal e texto sobre teal. Usar em ação principal, escolha selecionada, foco e progresso.
- `accent` / `accent-foreground`: Mist. Usar em hover, item focado e superfícies sutis; nunca como cor textual teal.
- `foreground`: conteúdo de maior ênfase. O valor visual será suavizado por token derivado de Mira/Mist para não aparentar preto ou branco absolutos em texto corrente.
- `muted-foreground`: conteúdo secundário, placeholder e ícone contextual.
- `border` e `input`: contorno estrutural de cards e campos. Os primitives devem ter contraste perceptível em ambos os temas.
- `destructive`, `chart-2`/success e `chart-3`/warning: apenas estado e status; não representam seleção de filtro ou navegação ativa.

### Migração de aliases antigos

Não haverá alias de utilitário que preserve o significado antigo de `accent`, pois isso corromperia o primitive shadcn. Cada consumidor será convertido segundo a intenção:

- `text-accent` teal legado → `text-primary`.
- `bg-accent-muted text-fg` de item selecionado → `bg-primary text-primary-foreground`.
- `bg-accent text-accent-fg` de superfície → `bg-accent text-accent-foreground`.
- `bg-hover` e `bg-active-bg` → `bg-muted` ou `bg-accent`, conforme estado de hover ou seleção passiva.
- `text-fg`, `text-fg-secondary` e `text-fg-muted` → as camadas canônicas de conteúdo definidas nesta especificação.

As substituições serão deliberadas por contexto; uma troca global de strings seria incorreta.

## Especificação de controles

Os componentes lower-case em `components/ui` são a única camada de primitive interativo. Devem expor estados normal, hover, focus-visible, selected/checked, invalid, disabled e loading com a mesma gramática visual.

### Campos textuais

`Input`, `InputGroup`, `Textarea`, `Select`, `Combobox` e `InputOTP` usam fundo `background`/`card`, borda `input` perceptível, texto de conteúdo, placeholder `muted-foreground` e anel `ring` teal. O foco não depende apenas de mudar uma borda de baixa visibilidade.

O tamanho de campo deve ser consistente nos contextos de formulário e toolbar. Uma variante/receita de densidade do primitive substitui os atuais `h-10`, `border-input-border` e `bg-input` repetidos nos consumidores.

### Escolhas discretas

`Checkbox`, `RadioGroupItem` e `Switch` exibem contorno no estado desligado e teal apenas no estado ligado. `Slider` usa thumb com `background` e contorno/ring coerentes com o tema; não usa `bg-white` fixo.

### Ações e filtros

`Button` representa ações. `Toggle` representa filtros binários persistentes. `ToggleGroup` representa opções mutuamente exclusivas. `DropdownMenu` representa ações secundárias agrupadas. `ContextMenu` é reservado a clique direito, nunca ao botão de reticências.

## Lead Board

`LeadBoardToolbarToggle` é semanticamente um filtro persistente e passa a compor `Toggle` shadcn. O estado ligado usa `primary`; o ponto de pendência permanece um badge de status separado. `warning` não será usado para indicar que “Ligar hoje” está selecionado.

Na toolbar:

- Busca usa `InputGroup`.
- Escopo, segmento e tag sem pesquisa usam `Select`.
- Cidade e qualquer filtro pesquisável/assíncrono usam `Combobox`.
- Limpar filtros usa `Button` `ghost`.
- Cartões, colunas, chips e ícones passam a usar tokens canônicos por papel, sem aliases legados de teal.

## Primitives de domínio e substituições

Componentes de produto não serão removidos quando encapsulam regra de negócio. Eles deixam de possuir primitive visual paralelo:

- `DateTimePicker` e `TimePicker` mantêm a API pública e a regra de data/hora civil, mas internamente usam `Popover`, `Calendar`, `Button`, `InputGroup` e `Field` lower-case.
- `BriefingChoiceCard` e seu grupo usam `RadioGroup`/`RadioGroupItem`/`Field` shadcn, preservando o layout de card.
- `ThemeToggle` deixa de ciclar estados opacos e usa `DropdownMenuRadioGroup` para explicitar sistema, claro e escuro.
- A navegação preserva dados, animações e comportamento de colapso, mas deve ser composta com `Sidebar`, `SidebarMenu`, `Collapsible`, `Sheet`, `Tooltip` e `Button` onde houver equivalência.

Há doze módulos de domínio que importam `@base-ui/react` diretamente para Menu, Combobox ou Radio. Eles serão migrados para os módulos lower-case locais:

- Menus: `ClientCardMenu`, `LeadClaimActions`, `LeadImportFileCard`, `LeadDigitalChannels` e `LeadGbpProfileCard`.
- Comboboxes: `BriefingAddressSearch`, `LeadCityFilter`, `LeadSegmentField`, `LeadTagField` e `LeadGbpPlacePicker`.
- Rádio em card: `BriefingChoiceCard` e `BriefingChoiceCardGroup`.

## Ícones

O código usa exclusivamente `react-icons/ri`. Não haverá novo import de Lucide. Como o gerador shadcn não oferece `react-icons` como biblioteca nativa, qualquer ícone adicionado por geração deve ser trocado manualmente para o equivalente `react-icons/ri` no mesmo change set. `components.json` não deve induzir novos imports de Lucide.

## Acessibilidade e UX

- Todo controle de ícone recebe `aria-label` quando não tiver texto visível.
- Mensagens de erro permanecem associadas por `aria-describedby` e `aria-invalid`.
- Menus, comboboxes, popovers e diálogos mantêm foco, Escape e navegação por teclado dos primitives shadcn.
- Focus-visible deve ser observável em light e dark, inclusive sobre card, sidebar e toolbar.
- O contraste alvo é WCAG AA para texto normal e componentes interativos; status não pode ser comunicado somente por cor.

## Fora de escopo

- Não alterar regra de negócio, persistência, payloads de formulário, máscaras, busca assíncrona, seleção múltipla ou data civil.
- Não substituir elementos nativos que são a implementação acessível correta para upload de arquivo.
- Não remover componentes de domínio apenas porque seu nome contém UI; o critério é se duplicam um primitive shadcn.

## Critérios de aceite

- Light e dark possuem texto e ícones hierárquicos, sem preto/branco absolutos no conteúdo corrente e sem teal/Mist invertidos.
- Inputs, textareas, OTP, selects, comboboxes, radios, checkboxes, switches e sliders têm superfície e borda reconhecíveis em todos os estados.
- `LeadBoardToolbarToggle` usa `Toggle`, teal como estado ativo e status separado.
- Não há import de `lucide-react` em código de aplicação.
- Os doze módulos de domínio não importam primitives diretamente de `@base-ui/react` quando há equivalente em `components/ui`.
- Menus de reticências usam `DropdownMenu`; navegação e escolhas usam primitives semânticos corretos.
- Nenhuma tela perde busca, carregamento, chips, múltipla seleção, atalhos ou comportamento de portal.
