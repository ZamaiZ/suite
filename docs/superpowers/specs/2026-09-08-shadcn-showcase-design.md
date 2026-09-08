# Showcase de Componentes shadcn — Design

## Objetivo

Criar uma área protegida de referência visual e funcional para os componentes shadcn instalados no projeto. O showcase deve permitir que a equipe avalie composições, variantes, tamanhos, estados, interações, ícones, cores e requisitos de acessibilidade antes de adotar um componente no produto.

## Escopo fechado

- Cobrir somente os 59 módulos shadcn em arquivos minúsculos de `components/ui`.
- Manter os tokens shadcn já gerados em `app/globals.css`; o showcase é uma referência do tema shadcn existente, não uma migração para os tokens semânticos do produto.
- Criar a rota dentro de `app/(protected)`, herdando `requireCommercialMember` do layout protegido.
- Adicionar um grupo `Showcase` à navegação principal, com uma visão geral e seis subitens de categoria.
- Usar dados determinísticos locais. Nenhuma página do showcase consulta Supabase, chama Server Actions ou altera dados de negócio.
- Demonstrar Data Table como composição de `Table` com `@tanstack/react-table` v9 já instalado.
- Demonstrar Date Picker como composição de `Popover` e `Calendar`.

## Fora de escopo

- Não instalar, exibir ou importar `native-select` e `direction`.
- Não exibir, importar ou comparar wrappers PascalCase existentes em `components/ui/*/`.
- Não criar uma tabela de dados genérica reutilizável para o produto.
- Não alterar tokens, componentes shadcn existentes, `components.json`, dependências, autenticação ou regras de acesso.
- Não adicionar Typeset/Typography como componente de catálogo.

## Inventário de referência

O catálogo contém 59 módulos-base: accordion, alert, alert-dialog, aspect-ratio, attachment, avatar, badge, breadcrumb, bubble, button, button-group, calendar, card, carousel, chart, checkbox, collapsible, combobox, command, context-menu, dialog, drawer, dropdown-menu, empty, field, hover-card, input, input-group, input-otp, item, kbd, label, marker, menubar, message, message-scroller, navigation-menu, pagination, popover, progress, questionnaire, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, spinner, switch, table, tabs, textarea, toast, toggle, toggle-group e tooltip.

Todos os exemplos importam exclusivamente desses caminhos minúsculos. Props específicas de cada componente shadcn são apresentadas no catálogo; props que são encaminhadas ao Base UI permanecem descritas como API do primitive, com link externo, evitando copiar uma API transitiva ampla e instável.

## Informação e rotas

`/showcase` é a visão geral. Ela mostra o escopo, a contagem de 59 componentes e cartões de atalho para as categorias.

As categorias são rotas estáveis sob `/showcase/[category]`:

- `actions`: Ações e feedback — Alert, Alert Dialog, Button, Button Group, Progress, Spinner, Toast, Toggle e Toggle Group.
- `forms`: Formulários — Calendar, Checkbox, Combobox, Field, Input, Input Group, Input OTP, Label, Questionnaire, Radio Group, Select, Slider, Switch e Textarea; inclui Date Picker composto.
- `navigation`: Navegação e comandos — Breadcrumb, Command, Kbd, Menubar, Navigation Menu, Pagination, Sidebar e Tabs.
- `overlays`: Camadas e revelação — Accordion, Collapsible, Context Menu, Dialog, Drawer, Dropdown Menu, Hover Card, Popover, Sheet e Tooltip.
- `content`: Conteúdo e dados — Aspect Ratio, Avatar, Badge, Card, Carousel, Chart, Empty, Item, Marker, Resizable, Scroll Area, Separator, Skeleton e Table; inclui Data Table composta.
- `messaging`: Conversas e anexos — Attachment, Bubble, Message e Message Scroller.

`components/custom/navigation.ts` recebe o grupo `Showcase` com um leaf de visão geral e os seis subitens. A estrutura de `NavItem` atual suporta exatamente esse nível de agrupamento e é reutilizada pelo menu desktop e mobile.

## Arquitetura de renderização

As páginas de rota permanecem server components: validam `category`, chamam `notFound()` para slug inválido e renderizam a casca do catálogo. A interatividade fica em componentes client em `components/custom/Showcase`.

Um registro tipado define `ShowcaseCategoryId`, rótulo, descrição, ícone, rota e quantidade de componentes. Esse registro é a única fonte para os links da overview, a validação da rota dinâmica e a navegação. Cada categoria possui um arquivo client dedicado; não haverá um arquivo monolítico com todos os exemplos.

O shell client monta exatamente um `Toaster` local ao showcase. Toasts de demonstração não interferem no restante da aplicação. Demos que abrem dialog, sheet, drawer, popover, command palette, context menu ou hover card mantêm estado local e um botão de reset quando o estado persistir.

## Contrato visual de uma demonstração

Cada componente é exibido em uma seção com:

1. Título, finalidade e link para a documentação oficial do componente.
2. Preview ao vivo, usando somente o componente minúsculo correspondente.
3. Composição: subcomponentes usados e a ordem em que devem aparecer.
4. Controles de cobertura para as props próprias relevantes: variantes, tamanhos, orientação, lado/alinhamento, valor e seleção.
5. Estados relevantes: padrão, hover/focus por interação real, disabled, invalid/error, loading, selected/checked, open/closed, vazio e responsivo quando o componente os suportar.
6. Nota de ícones: Lucide como biblioteca configurada; ícones decorativos recebem `aria-hidden`, e botões apenas com ícone recebem nome acessível.
7. Nota de cor: classes `primary`, `secondary`, `muted`, `destructive`, `popover`, `card`, `background`, `foreground`, `ring` e seus estados são lidas dos tokens shadcn existentes. Nenhum valor hexadecimal é introduzido nas demos.
8. Nota de acessibilidade e antiuso. Exemplos de ação destrutiva sempre usam confirmação, e tooltip não é usado como substituto de label.

O catálogo testa visualmente os estados em claro e escuro por meio do ThemeToggle existente no aplicativo. Não haverá duplicação de uma segunda camada de tokens nem um seletor de tema exclusivo.

## Cobertura funcional por categoria

### Ações e feedback

Button cobre seis variantes (`default`, `outline`, `secondary`, `ghost`, `destructive`, `link`), todos os tamanhos, ícone no início/fim, somente ícone, invalid e disabled. Toggle e Toggle Group cobrem pressão individual, seleção única/múltipla, desabilitado e tamanhos. Alert cobre default/destructive, título, descrição e ação. Alert Dialog cobre cancelamento e confirmação. Progress cobre 0, parcial, concluído e rótulo/valor. Spinner cobre contexto de botão e conteúdo. Toast cobre default, success, info, warning, error, loading, ação, fechar e ciclo de promise.

### Formulários

Field demonstra label, description, erro, required, orientação e agrupamento. Inputs cobrem tipos relevantes, placeholder, disabled, invalid e grupo com addon/botão. Checkbox, Radio Group, Switch, Slider e Select cobrem controlado, selection/checked, disabled e erro. Combobox cobre busca, limpar, seleção e estado vazio. Calendar cobre single, range, mês inicial, datas indisponíveis e navegação. Date Picker cobre single e range via Popover + Calendar. Input OTP cobre preenchido, vazio e invalidez. Questionnaire cobre radio, checkbox, texto livre, requerido, skip, progresso e erro.

### Navegação e comandos

Breadcrumb cobre item atual, separador e colapso. Command cobre dialog, busca, grupos, atalho Kbd, seleção e vazio. Menubar, Navigation Menu e Tabs cobrem trigger, conteúdo e estado ativo. Pagination cobre atual, anterior/próximo e ellipsis. Sidebar é demonstrada em área confinada, incluindo provider, trigger, grupos e estados de colapso, sem disputar a sidebar global do aplicativo.

### Camadas e revelação

Accordion e Collapsible cobrem expandido/recolhido e disabled. Context Menu e Dropdown Menu cobrem item, checkbox, radio, submenu, label, separator e ação destrutiva. Dialog, Sheet e Drawer cobrem trigger, título, descrição, fechamento e os tamanhos/lados disponíveis. Popover, Hover Card e Tooltip cobrem lado, alinhamento, offset e conteúdo com Kbd quando aplicável. A demonstração preserva foco e fecha por Escape/backdrop de acordo com o primitive.

### Conteúdo e dados

Aspect Ratio cobre formatos de mídia. Avatar cobre imagem, fallback, badge e grupos. Badge, Marker e Empty cobrem todas as variantes locais. Card cobre tamanho, header, action, content e footer. Carousel cobre orientação, controles, limites e navegação por teclado. Chart cobre configuração, tooltip, legenda e paleta acessível. Item cobre media, action, header, footer, link, variantes e tamanhos. Resizable, Scroll Area, Separator e Skeleton cobrem as configurações relevantes. Table cobre caption, header, body, footer, linha selecionada e overflow horizontal. A Data Table local cobre busca, ordenação, seleção, visibilidade de coluna e paginação sobre dados mockados.

### Conversas e anexos

Attachment cobre tamanho, orientação e estados `idle`, `uploading`, `processing`, `error` e `done`. Bubble cobre as variantes, alinhamento e reações. Message e Message Scroller cobrem autor, conteúdo, agrupamento, auto-scroll, conteúdo longo e retorno ao final da conversa.

## Critérios de aceite manual

- Todas as sete rotas são acessíveis após autenticação comercial e inexistentes fora do layout protegido.
- Os sete links de Showcase funcionam nos menus desktop e mobile e marcam o subitem ativo.
- A overview informa 59 componentes e as seis categorias somam exatamente esse total.
- Todo preview usa import de módulo shadcn minúsculo; nenhum wrapper PascalCase é importado pelo diretório Showcase.
- Cada componente tem preview, composição, estados aplicáveis, variante/prop própria aplicável, nota de ícone/cor/acessibilidade e link de documentação.
- Os controles funcionam com mouse, teclado e foco visível; em telas estreitas não há scroll horizontal fora de tabelas, carousel ou regiões de scroll explicitamente demonstradas.
- Toast aparece apenas enquanto a área Showcase está montada e não duplica viewport/provider.
- Data Table e Date Picker aparecem como composições, sem criar arquivos `data-table.tsx` ou `date-picker.tsx` na pasta base.

## Verificação

O repositório proíbe executar testes, lint, typecheck e build. A implementação será verificada por inspeção de imports, navegação manual, teclado, temas claro/escuro e inspeção responsiva no navegador. Não há comandos automatizados de validação neste escopo.
