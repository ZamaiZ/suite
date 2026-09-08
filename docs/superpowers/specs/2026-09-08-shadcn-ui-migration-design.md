# Migração dos controles de UI para shadcn

**Status:** aprovado para planejamento

## Decisão

Os componentes autorais em diretórios PascalCase dentro de `components/ui` deixam de ser a API de interface. Cada consumidor passa a importar diretamente os primitives shadcn em minúsculas que já estão instalados no mesmo diretório. Não haverá adaptadores de compatibilidade, reexports PascalCase ou componentes substitutos com a antiga API.

O shadcn Mira/Mist é a referência para cor, foco, raio, superfícies, estados e animação. `primary` é o teal para ações e seleção; `accent` continua sendo a superfície neutra Mist. `react-icons` substitui Lucide nos arquivos shadcn efetivamente envolvidos nesta migração.

## Objetivos

- Eliminar `Button`, `Checkbox`, `DatePicker`, `Dialog`, `Input`, `InputOTP`, `RadioGroup`, `Select`, `Slider`, `Switch`, `Textarea` e `Tooltip` PascalCase, seus arquivos de tipo e seus `index.ts`.
- Migrar todos os consumidores para primitives shadcn de `components/ui` em minúsculas.
- Preservar comportamento de produto: campos controlados, validação, máscaras, seleção múltipla, busca, data civil, acessibilidade, foco, portais e atalhos de teclado.
- Remover Lucide somente dos primitives envolvidos e usar os equivalentes de `react-icons/ri`.
- Usar tokens canônicos shadcn. Nenhum consumidor novo pode usar `bg-accent` para ação primária, `border-accent` para foco, nem os aliases legados `fg-*`, `bg-*`, `danger`, `success` ou `warning`.

## Fora de escopo

- Não alterar componentes shadcn que não participem deste conjunto.
- Não trocar `DateTimePicker`, `TimePicker`, `Stepper` ou `ThemeToggle`: não há primitive shadcn equivalente direto. Em etapa posterior, eles podem passar a compor os primitives migrados.
- Não trocar a biblioteca de ícones da aplicação inteira. A regra de `react-icons` cobre os arquivos shadcn e consumidores modificados por esta migração.
- Não mudar regras de negócio, schemas, ações de servidor, rotas ou dados persistidos.

## Princípios de implementação

### Importação e composição

Todo consumidor importa o primitive pelo caminho minúsculo. Exemplos: `@/components/ui/button`, `@/components/ui/dialog`, `@/components/ui/field`, `@/components/ui/combobox` e `@/components/ui/calendar`.

O JSX deve expressar a composição do shadcn no ponto de uso. Um botão com ícone usa o ícone Remix diretamente como filho; `leadingIcon` e `trailingIcon` deixam de existir. Labels, descrição, erro e mensagens de validação usam `Field`, `FieldLabel`, `FieldDescription` e os atributos `aria-invalid`/`aria-describedby`, sem serem embutidos no primitive de entrada.

### Tokens e estados

- Ação principal e controles selecionados: `primary` e `primary-foreground`.
- Superfícies de hover, seleção contextual e itens de lista: `accent` e `accent-foreground`.
- Foco: `ring` com `focus-visible:ring-*`; nunca `border-accent`.
- Erro: `destructive`; os níveis de “sucesso” e “aviso” não ganham variantes próprias de botão. Ações não destrutivas usam `default`, `secondary`, `outline`, `ghost` ou `link`.
- Alturas e espaçamento dos primitives seguem os recipes shadcn. Onde o fluxo exige área de toque maior, o consumidor usa `size` ou uma classe local justificada, sem recriar uma escala paralela.

### Ícones

Os primitives alterados usam apenas `react-icons/ri`:

- Checkbox: `RiCheckLine`.
- Calendar: `RiArrowLeftSLine`, `RiArrowRightSLine` e `RiMoreLine` quando aplicável.
- Dialog: `RiCloseLine`.
- Input OTP: `RiSubtractLine`.
- Select e Combobox: `RiArrowDownSLine`, `RiArrowUpSLine`, `RiCheckLine` e `RiCloseLine`.

Todo ícone decorativo recebe `aria-hidden`. Botões somente com ícone continuam obrigados a ter `aria-label` ou texto visualmente oculto.

## Mapeamento por componente

### Button

Substituir `@/components/ui/Button` por `@/components/ui/button`.

- `primary` vira `variant="default"`.
- `secondary`, `outline` e `ghost` mantêm o mesmo nome.
- `danger` vira `destructive`.
- `soft` vira `secondary` para ações de painel e `ghost` para ações de navegação; não há `soft` no primitive.
- `success` e `warning` viram `default` ou `secondary` conforme a ação; cor de status não define semântica de botão.
- `leadingIcon`/`trailingIcon` viram filhos antes/depois do texto. Para botões somente de ícone, usar `size="icon"` (ou variante de tamanho correspondente) e `aria-label`.

### Checkbox, RadioGroup e Switch

Substituir os wrappers por `checkbox.tsx`, `radio-group.tsx` e `switch.tsx`, envolvendo-os em `Field` quando houver label, erro, required ou descrição. O checked/unchecked é responsabilidade do primitive; a marcação selecionada deve aparecer em `primary`, não em `accent`.

### Input, Textarea e InputOTP

`input.tsx`, `textarea.tsx` e `input-otp.tsx` viram os controles base. `Field` padroniza label/erro. `InputGroup` é usado para ícone inicial, revelação de senha, botão de limpar e estados internos.

Máscaras de CPF, CNPJ, CEP, telefone e moeda deixam de ser uma prop `variant` visual: o consumidor aplica o formatter existente no `onChange`, preservando `value`, `inputMode`, `autoComplete` e `aria-invalid`. A senha usa `type="password"` e um `InputGroupButton` de ícone para revelar/ocultar. OTP preserva `pattern`, `pasteTransformer`, `onComplete`, `autoComplete="one-time-code"` e os slots shadcn.

### Slider

Substituir por `slider.tsx`. O consumidor fornece um array para os dois thumbs e um único valor para um thumb. Label e valor exibido compõem um `Field`; o formato `n – n` continua no consumidor quando necessário.

### Select e Combobox

`select.tsx` é usado exclusivamente para uma escolha simples, sem pesquisa, sem chips, sem carregamento e sem limpeza.

`combobox.tsx` é usado para qualquer campo com pesquisa, lista dinâmica, múltipla seleção, chips, descrição, ícone, limpeza ou carregamento. O consumidor fornece objetos de item e mantém a conversão entre objeto de option e o valor persistido (`string` ou `string[]`). Nenhuma tela perde múltipla seleção ou busca ao trocar a API.

### Calendar, Popover e data civil

Não haverá um novo `DatePicker` wrapper. Cada ponto que precisa de data compõe `Popover`, `PopoverTrigger`, `PopoverContent` e `Calendar`.

O domínio continua armazenando data como `YYYY-MM-DD`. Serão adicionadas a `lib/date-time.ts` duas funções puras: `civilDateToCalendarDate(value: string): Date | undefined` e `calendarDateToCivilDate(value: Date | undefined): string`. A primeira cria um `Date` local ao meio-dia; a segunda lê `getFullYear`, `getMonth` e `getDate`. Isso evita deslocamento de dia por UTC ou mudança de horário. Min/max são convertidos pelo mesmo caminho e o botão “Hoje” usa `todayCivilDate()`.

Durante a implementação foi identificada uma dependência interna do `DateTimePicker` no calendário do `DatePicker` legado. Para permitir a remoção completa do diretório PascalCase sem alterar a API pública do `DateTimePicker`, apenas a etapa de data desse componente passa a compor o `Calendar` shadcn com as mesmas funções de conversão civil. O seletor de horário continua fora do escopo desta migração.

### Dialog e Tooltip

Dialogs passam a usar `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` e `DialogClose`. O estado controlado continua com `open`/`onOpenChange` no root. Encerramento, Escape, clique no overlay, focus trap e restauração de foco pertencem ao primitive.

Tooltips passam a usar `TooltipProvider`, `Tooltip`, `TooltipTrigger` e `TooltipContent`. O conteúdo é portaled, recebe `side`, `sideOffset` e `align` nativos e não usa `cloneElement` nem posicionamento absoluto manual. O tooltip padrão usa `foreground`/`background` do shadcn; tons semânticos customizados são removidos.

## Dependências e ordem

1. Corrigir ícones e recipes dos primitives shadcn envolvidos.
2. Migrar controles simples e seus consumidores.
3. Migrar Input, Textarea e OTP com `Field` e `InputGroup`.
4. Classificar e migrar Select/Combobox sem reduzir capacidade.
5. Migrar data civil usando Calendar/Popover.
6. Migrar Dialog e Tooltip depois dos campos compostos, validando popovers/comboboxes dentro de modais.
7. Apagar os diretórios PascalCase somente após a busca não encontrar imports remanescentes.

## Critérios de aceite

- Não existe import de `@/components/ui/<NomePascalCase>` para os componentes substituídos.
- Os diretórios PascalCase e seus tipos/indexes correspondentes foram removidos.
- Não há import `lucide-react` nos primitives modificados nem nos consumidores migrados.
- Botões principais, checkbox, rádio, switch, slider e datas selecionadas usam `primary`; foco usa `ring`; erro usa `destructive`.
- Todo campo com erro expõe `aria-invalid` e texto de erro associado.
- Comboboxes conservam pesquisa, carregamento, chips e seleção múltipla onde já existiam.
- Datas persistidas continuam no formato `YYYY-MM-DD` sem mudança de dia em `America/Sao_Paulo`.
- Um Select/Combobox aberto dentro de Dialog permanece interativo, visível e navegável por teclado.
