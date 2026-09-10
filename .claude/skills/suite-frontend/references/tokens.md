# Tokens

Fonte de verdade: `app/globals.css` e `styles/tokens/layout.css`. Se algum valor aqui divergir de lá, lá está certo e este arquivo está desatualizado — conserte-o no mesmo commit.

## Cor

Superfícies e conteúdo:

| Token | Claro | Escuro | Papel | Nunca |
|---|---|---|---|---|
| `background` | `oklch(1 0 0)` | `oklch(0.148 0.004 228.8)` | fundo da página | como fundo de cartão sobre a própria página |
| `foreground` | `oklch(0.148 0.004 228.8)` | `oklch(0.987 0.002 197.1)` | conteúdo primário | em texto secundário |
| `card` / `card-foreground` | `oklch(1 0 0)` / `oklch(0.148 0.004 228.8)` | `oklch(0.218 0.008 223.9)` / `oklch(0.987 0.002 197.1)` | superfície de agrupamento | em algo que flutua — isso é `popover` |
| `popover` / `popover-foreground` | iguais a `card` | iguais a `card` | superfície flutuante | em conteúdo fixo na página |
| `primary` | `oklch(0.508 0.118 165.612)` | `oklch(0.696 0.17 162.48)` | ação principal, seleção, foco, progresso | como fundo de área grande |
| `primary-foreground` | `oklch(0.979 0.021 166.113)` | `oklch(0.262 0.051 172.552)` | texto sobre `primary` | sobre qualquer outra superfície |
| `secondary` / `secondary-foreground` | `oklch(0.967 0.001 286.375)` / `oklch(0.21 0.006 285.885)` | `oklch(0.274 0.006 286.033)` / `oklch(0.985 0 0)` | ação secundária | como superfície de leitura |
| `muted` / `muted-foreground` | `oklch(0.963 0.002 197.1)` / `oklch(0.56 0.021 213.5)` | `oklch(0.275 0.011 216.9)` / `oklch(0.723 0.014 214.4)` | fundo recuado; texto secundário, placeholder, ícone contextual | `muted-foreground` como cor de conteúdo primário |
| `accent` / `accent-foreground` | `oklch(0.963 0.002 197.1)` / `oklch(0.218 0.008 223.9)` | `oklch(0.275 0.011 216.9)` / `oklch(0.987 0.002 197.1)` | hover, item focado, superfície sutil | **como cor de texto teal** |

Estados:

| Token | Claro | Escuro | Papel |
|---|---|---|---|
| `destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | erro e exclusão |
| `success` / `success-foreground` | `oklch(0.52 0.14 152)` / `oklch(0.985 0.01 152)` | `oklch(0.75 0.16 152)` / `oklch(0.2 0.04 152)` | conclusão, resultado positivo |
| `warning` / `warning-foreground` | `oklch(0.55 0.13 62)` / `oklch(0.985 0.01 62)` | `oklch(0.8 0.14 72)` / `oklch(0.22 0.05 62)` | atenção que ainda não é erro |

Estrutura:

| Token | Claro | Escuro | Papel |
|---|---|---|---|
| `border` | `oklch(0.925 0.005 214.3)` | `oklch(1 0 0 / 10%)` | contorno de cartão, separador |
| `input` | `oklch(0.87 0.006 214.3)` | `oklch(1 0 0 / 22%)` | contorno de campo — mais forte que `border` |
| `ring` | `var(--primary)` | `var(--primary)` | anel de foco |

Gráficos — `chart-1` a `chart-5`, idênticos nos dois temas:

`oklch(0.871 0.15 154.449)` · `oklch(0.723 0.219 149.579)` · `oklch(0.627 0.194 149.214)` · `oklch(0.527 0.154 150.069)` · `oklch(0.448 0.119 151.328)`

Sidebar — `sidebar`, `sidebar-foreground`, `sidebar-primary`, `sidebar-primary-foreground`, `sidebar-accent`, `sidebar-accent-foreground`, `sidebar-border`, `sidebar-ring`. Consumidos por `components/custom/Sidebar` e `NavTree`. Não há primitive `sidebar` no registry.

### Cinco coisas que mudam o que você escreve

**`accent` e `muted` são a mesma cor.** Nos dois temas, valor idêntico. O que os separa é o *foreground*: `accent-foreground` tem ênfase de conteúdo primário, `muted-foreground` é secundário. Escolha pelo texto que vai por cima, não pelo fundo.

**`accent` não é teal.** É superfície Mist — quase branca no claro, quase preta no escuro. `text-accent` some nos dois temas. Foi esse o bug que custou o realinhamento inteiro de setembro. Teal textual é `text-primary`.

**`ring` é alias de `primary`.** Mexer no foco é mexer na marca.

**No escuro, `border` e `input` são branco com opacidade**, não cor sólida. Uma borda customizada com valor sólido não acompanha a superfície embaixo e aparece como risco. Se precisar de filete próprio, derive: `border-foreground/10`.

**`destructive` não tem par `-foreground`.** Por isso o `Button` destrutivo é fundo `destructive/10` com texto `destructive`, e não bloco vermelho com texto branco. Siga o padrão — inventar um foreground quebra no escuro.

**A rampa `chart-*` é sequencial, não categórica.** Verde claro a verde escuro, codificando intensidade. Para séries categóricas sem ordem, ela mente: o leitor lê hierarquia onde não existe.

## Camadas de conteúdo

Sistema chapado não tem sombra para hierarquizar. Sobram três camadas, e só elas:

1. `text-foreground` — conteúdo primário
2. `text-muted-foreground` — secundário, placeholder, ícone contextual, meta
3. `border-border` — estrutura

Peso de fonte é o quarto eixo. Não existe quinto: se a tela precisa de mais um nível, ela precisa de menos conteúdo.

## Tipografia

Inter é família única. `--font-sans` e `--font-heading` resolvem os dois para `--font-inter`; o token de heading existe para permitir troca futura, e trocar exige editar o `@theme inline` de `app/globals.css`, nunca uma classe no componente.

O registry define densidade de **controle**. Densidade de **página** é esta:

| Papel | Classe | Nota |
|---|---|---|
| H1 de página | `text-3xl font-semibold` | portal, overview |
| H1 de contexto | `text-2xl font-semibold` | dentro de fluxo já titulado |
| Título de seção | `text-sm font-semibold` | |
| Corpo | `text-sm` | máximo 72ch |
| Meta e rótulo | `text-xs text-muted-foreground` | |
| Controle | `text-xs/relaxed` | vem do registry — não sobrescreva |

`--font-mono` é `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`, aplicado por `@layer base` em `code`, `pre`, `kbd` e `samp`. Não use mono para rótulo de dado.

## Raio

`--radius: 0.625rem` (10px). A escala deriva dele:

| Token | Valor | Use em |
|---|---|---|
| `rounded-sm` | `radius - 4px` | chip, badge, controle `xs` |
| `rounded-md` | `radius - 2px` | botão, campo, item de menu |
| `rounded-lg` | `radius` | cartão, popover |
| `rounded-xl` | `radius + 4px` | painel, diálogo |
| `rounded-2xl` | `radius + 8px` | superfície de destaque |
| `rounded-3xl` / `4xl` | `radius × 2.2` / `× 2.6` | superfície grande e rara |
| `rounded-full` | `9999px` | avatar, ponto de status, trilha de medidor |

Raio comunica tamanho de superfície. Chip e cartão não compartilham raio — quando compartilham, a tela perde a noção de escala.

## Espaço

Gutter de página, em `styles/tokens/layout.css`:

| Token | Base | ≥768px | ≥1024px |
|---|---|---|---|
| `--page-padding-x` | `1rem` | `1.5rem` | `2rem` |
| `--page-padding-y` | `1rem` | `1.5rem` | — |

Sempre por `px-[var(--page-padding-x)]`, nunca `px-4 md:px-6 lg:px-8` à mão — a segunda forma desalinha da próxima tela.

Dentro da página, `gap` em múltiplos de `0.25rem` da escala Tailwind. Regra de corte: quando um respiro precisa de mais que `gap-8` para separar duas coisas, o que falta não é espaço, é um `Separator`.

## Camadas de empilhamento

| Token | Valor | Papel |
|---|---|---|
| `--z-index-sticky` | 20 | cabeçalho e toolbar que grudam |
| `--z-index-nav` | 30 | navegação, sidebar |
| `--z-index-scrim` | 40 | véu atrás de camada modal |
| `--z-index-overlay` | 50 | diálogo, popover, dropdown — é o degrau que o registry usa |
| `--z-index-toast` | 60 | feedback transitório, acima de tudo |

Qualquer coisa que precise empilhar sai daqui. `z-[60]` avulso não conversa com o `z-50` dos overlays do registry, e o conflito só aparece quando os dois estão abertos ao mesmo tempo — ou seja, em produção.
