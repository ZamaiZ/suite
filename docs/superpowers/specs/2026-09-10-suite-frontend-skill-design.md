# Skill de front-end do suite — especificação

## Objetivo

Criar `.claude/skills/suite-frontend/`: a autoridade de front-end deste produto. Ela substitui a skill genérica `frontend-design` para qualquer UI dentro do app, porque a premissa daquela skill — inventar uma identidade visual nova para cada cliente — é exatamente o erro aqui. O sistema visual já existe, está implementado e foi realinhado uma vez; obedecê-lo *é* o trabalho.

A skill entrega três coisas que hoje só existem espalhadas pelo código e por specs antigas: o contrato dos tokens, o mapa de decisão dos 48 módulos de `components/ui`, e a gramática de layout, hierarquia e movimento que faz uma tela parecer cara em vez de gerada.

## Contexto: o que já existe

| Eixo | Estado verificado |
|---|---|
| Registry | shadcn `base-mira` sobre `@base-ui/react`, `baseColor: mist`, `iconLibrary: remixicon` |
| Superfície | 48 arquivos em `components/ui`, 238 componentes, 17 blocos `cva`, 5.306 linhas |
| Cor | tokens OKLCH em `app/globals.css`, par claro/escuro completo, `primary` teal, `mist` em `accent`/`muted` |
| Tipografia | Inter única — `--font-sans` e `--font-heading` apontam para `--font-inter` |
| Densidade | baixa por padrão do registry: `Button` default `h-7`, `text-xs/relaxed` |
| Ícones | `react-icons/ri` em 137 arquivos, zero imports de `lucide-react` |
| Motion | `LazyMotion strict` na raiz, `motion/react-m`, easing `[0.23, 1, 0.32, 1]` em 23 pontos, durações 0.10–0.55s |
| Camadas | escala `--z-index-sticky\|nav\|scrim\|overlay\|toast` (20/30/40/50/60) |
| Página | `--page-padding-x\|y` responsivo em `styles/tokens/layout.css` |
| Utilitário | `cn` importado de `"cn"` em 129 arquivos; `lib/utils.ts` apenas reexporta |
| Precedente | `docs/superpowers/specs/2026-09-08-shadcn-ui-ux-realignment-design.md` fixou o contrato de tokens e a gramática de controles |

A skill não reinventa nada disso. Ela transcreve o que é lei, preenche o que ficou implícito e recusa o que já deu errado.

## Decisões tomadas

1. **Substitui a `frontend-design` genérica dentro do produto.** Herda dela apenas o rigor anti-slop e a autocrítica final; descarta a parte de propor paleta e tipografia inéditas.
2. **Norte visual: denso e chapado.** Linear/Vercel, não Stripe/Notion. Hierarquia vem de tipografia, peso e camada de cor — não de elevação.
3. **Motion expressivo, com orçamento.** Os quatro usos estão liberados: revelação de dados, stagger, transição de rota/aba e hover de card. A restrição migra de *onde* para *como*.
4. **Catálogo por decisão, não por props.** Cada primitive ganha quando usar, quando não usar, variantes reais e a armadilha específica. Assinatura de tipos fica no `.tsx`, que está ao lado e nunca desatualiza.
5. **Sobrancelha caixa-alta restrita.** Permitida só quando o rótulo carrega informação que o título não carrega.
6. **Versionada no repositório**, em PT-BR, batendo com os comentários do código e com `docs/superpowers/`.
7. **Verificação por grep + piso de acessibilidade + autocrítica escrita.** Screenshot obrigatório fica de fora.

## Estrutura do pacote

```
.claude/skills/suite-frontend/
├── SKILL.md
└── references/
    ├── tokens.md
    ├── components.md
    ├── motion.md
    ├── layout.md
    ├── writing.md
    └── checks.md
```

O SKILL.md carrega em toda invocação e por isso fica curto (alvo: 150–200 linhas). As referências são lidas sob demanda: uma correção de espaçamento não deve arrastar o catálogo inteiro para o contexto.

## SKILL.md

Frontmatter com `name: suite-frontend` e uma `description` que dispare em trabalho de UI deste app — deve citar shadcn, base-mira, tokens, componentes e layout, já que é assim que a tarefa costuma chegar.

Corpo, nesta ordem:

**Escopo e precedência.** Declara que substitui a `frontend-design` dentro do produto e diz o que sobrevive dela.

**Leis inegociáveis.** Tabela regra → motivo. Cada linha existe porque a violação já custou retrabalho ou quebra o dark:

- cor só por token semântico; nada de `oklch()`, hex ou `rgb()` cravado em componente
- `accent` é superfície Mist, nunca teal textual — `text-accent` legado vira `text-primary`
- ícone só de `react-icons/ri`
- empilhamento só por `--z-index-*`; `z-[N]` avulso não conversa com os overlays do registry
- altura de controle vem de `size`, nunca de `h-N` no consumidor
- `cn` importado de `"cn"`
- um primitive por papel: `Toggle` é filtro, `Button` é ação, `ToggleGroup` é escolha exclusiva, `DropdownMenu` é ação secundária agrupada — e como não há `context-menu` instalado, menu de reticências e clique direito caem os dois em `DropdownMenu`
- nada de `@base-ui/react` direto quando existe equivalente em `components/ui`

**Fluxo de trabalho.** Numerado, com um passo por item: ler `tokens.md` → escolher primitives pelo mapa em `components.md` → compor pelo arquétipo em `layout.md` → escrever a copy pela `writing.md` → rodar `checks.md` → entregar com a autocrítica.

**Mapa de ponteiros.** Uma linha por referência dizendo quando abrir cada uma.

## references/tokens.md

**Cor.** Uma tabela por token semântico com valor claro, valor escuro, papel e o antipadrão correspondente. Cobre `background`/`foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `success`, `warning`, `border`, `input`, `ring`, `chart-1..5` e a família `sidebar-*`. Registra explicitamente que `ring` é alias de `primary` e que `border`/`input` no dark são `oklch(1 0 0 / 10%)` e `/ 22%` — opacidade sobre a superfície, não cor sólida, o que muda como se compõe uma borda customizada.

**Camadas de conteúdo.** As três únicas ênfases de texto: `foreground` para conteúdo primário, `muted-foreground` para secundário, placeholder e ícone contextual, `border` para estrutura. Como "denso e chapado" tira a sombra da mesa, essas três camadas mais o peso da fonte são o mecanismo de hierarquia inteiro.

**Escala tipográfica de conteúdo.** O registry define densidade de *controle*, não de *página* — essa lacuna é o que fez cada tela improvisar. A escala codifica o uso que já predomina:

| Papel | Classe | Nota |
|---|---|---|
| H1 de página | `text-3xl font-semibold` | portal, overview |
| H1 de contexto | `text-2xl font-semibold` | dentro de fluxo já titulado |
| Título de seção | `text-sm font-semibold` | |
| Corpo | `text-sm` | máximo 72ch |
| Meta e rótulo | `text-xs text-muted-foreground` | |
| Controle | `text-xs/relaxed` | vem do registry; não sobrescrever |

Inter é família única: `font-heading` existe como token para permitir troca futura, mas hoje resolve para a mesma fonte — a skill avisa que trocar exige mexer no `@theme inline`, não numa classe.

**Raio.** `--radius: 0.625rem` e a escala derivada `sm|md|lg|xl|2xl|3xl|4xl|full`. Regra: raio comunica tamanho de superfície, então um card não usa o mesmo raio de um chip.

**Espaço.** `--page-padding-x|y` para gutter de página. Escala de gap interna preferida e o critério de quando um respiro vira separador.

**Camadas.** A escala `--z-index-*` com o papel de cada degrau e a instrução de sair sempre dela.

## references/components.md

Abre com o **mapa de decisão**: tabela "preciso de X → use Y", incluindo os casos que já deram errado neste código — menu de reticências (`DropdownMenu`), filtro pesquisável ou assíncrono (`Combobox`, não `Select`), filtro binário persistente (`Toggle`, não `Button`), escolha em cartão (`RadioGroup` com layout de card).

O mapa também nomeia o que **não** está instalado, para não ser inventado: não há `context-menu`, `sheet`, `sidebar`, `hover-card`, `navigation-menu`, `resizable`, `scroll-area` nem `carousel` em `components/ui`. Quando a tarefa pedir um desses, a saída é compor com o que existe ou instalar pelo CLI do shadcn — nunca escrever um primitive à mão. Vale notar que os tokens `--color-sidebar-*` existem em `globals.css` e são consumidos por `components/custom/Sidebar`, que é implementação de produto e não primitive de registry.

Depois, uma entrada por módulo, neste formato fixo:

```
### Nome
Para quê. Para o que NÃO é, nomeando o primitive correto.
Exporta: A, B, C
variant: … | size: …
⚠ armadilha específica
```

Variantes e tamanhos são transcritos do `cva` real, não presumidos. Exemplo do `Button`: `variant` default·outline·secondary·ghost·destructive·link, `size` default(28px)·xs(20)·sm(24)·lg(32)·icon·icon-xs·icon-sm·icon-lg, e a armadilha de que `destructive` é fundo `destructive/10` com texto vermelho, não botão vermelho sólido — exclusão de verdade é `AlertDialog` mais esse botão.

Os 13 módulos com `cva` — `alert`, `attachment`, `badge`, `bubble`, `button-group`, `button`, `empty`, `field`, `input-group`, `item`, `marker`, `tabs`, `toggle`, somando 17 blocos — recebem a lista completa de variantes. Os demais recebem decisão, exports e armadilha. Módulos compostos e grandes — `combobox` (15 componentes), `dropdown-menu` (15), `alert-dialog` e `toast` (12 cada), `field` e `item` (10 cada), `chart` (372 linhas) — ganham também a ordem de composição, que é onde se erra sem ler o arquivo.

Fecha com a lista dos wrappers de domínio que encapsulam regra de negócio e não devem ser recriados: `DateTimePicker`, `TimePicker`, `BriefingChoiceCard`, `ThemeToggle`, `Stepper`, `NavTree`.

## references/motion.md

**Vocabulário fechado.** Easing `[0.23, 1, 0.32, 1]` — em CSS, `ease-[cubic-bezier(0.23,1,0.32,1)]`. Quatro durações por papel: 120ms micro-estado, 180ms revelação curta, 280ms colapso e troca de superfície, 550ms crescimento de dado. Uma duração fora dessas exige comentário dizendo por quê.

**Orçamento de performance**, que é a condição para o motion expressivo:

- só `transform` e `opacity` em qualquer coisa que se repita; animar `width`/`height` em lista é jank
- a exceção documentada é `GbpMeter`, que anima `width` de propósito porque `scaleX` deforma a ponta arredondada — e é um elemento por linha, não uma lista
- stagger com teto: cascata só nos primeiros itens visíveis, com delay decrescente e um máximo absoluto; `index * delay` numa lista de 200 leads é uma espera, não um efeito
- nada de `layout` do motion em lista longa
- `will-change` só durante a animação

**Regras de uso.**

- `m.*` de `motion/react-m`, nunca `motion.*` — o `LazyMotion strict` da raiz reprova, e um `initial={{ opacity: 0 }}` sem provider deixa conteúdo invisível porém presente no DOM, selecionável
- `useReducedMotion` em todo componente que anima, no padrão já usado: `initial={reduced ? false : {...}}` e `transition={{ duration: reduced ? 0 : n }}`
- colapso por `grid-template-rows: 1fr → 0fr` com filho em `overflow-hidden` — anima altura real sem medir em JS nem cravar altura mágica; o padding de cima mora no filho
- hover e foco em CSS (`transition-colors duration-150`), não em JS

**Os quatro usos, com a forma certa de cada um**: revelação de dado, stagger de lista e board, transição de rota e aba, hover de card. Cada um com o que o torna caro e o que o torna slop.

## references/layout.md

**Regra de hierarquia** primeiro: em sistema chapado, profundidade se constrói por superfície (`background` → `card` → `popover`), por borda e por densidade de espaço — nessa ordem, e nunca por sombra decorativa.

**Cinco arquétipos**, cada um com esqueleto, tokens de espaço e a regra própria:

| Arquétipo | Referência no código | Regra central |
|---|---|---|
| Board | `LeadBoard` | coluna é escopo, cartão é registro; toolbar não rola com o conteúdo |
| Painel de trabalho | `LeadGbpPanel` | cabeçalho fixo fora do scroll, abas internas, coluna lateral colapsável |
| Formulário longo | `ClientBriefingWorkspace` | uma decisão por vez, progresso visível, autosave sem diálogo |
| Leitura e apresentação | `ClientPortalShell` | linha de 72ch, densidade maior que a operacional, sem toolbar |
| Diálogo | `LeadDetailDialog` | um objetivo por diálogo; ação destrutiva exige `AlertDialog` próprio |

**Sobrancelha caixa-alta.** O padrão `text-xs font-semibold tracking-widest uppercase` está no Showcase e é o mesmo que a skill genérica marca como tell de UI gerada. Critério: permitida quando o rótulo carrega informação que o título não carrega — categoria dentro de lista, seção em navegação longa. Proibida como enfeite acima de um título que já se explica. A skill traz um exemplo permitido e um proibido, lado a lado.

**Outros tells a evitar**, adaptados ao contexto deste app: cartões idênticos para conteúdo de hierarquias diferentes, gradiente como decoração, meta em `A · B · C`, `→` colado no texto de link, mono para rótulo de dado.

## references/writing.md

Voz PT-BR do produto, com exemplos tirados das telas reais. Rótulo pelo que o usuário entende, não pelo nome do campo no banco. CTA que diz o que acontece, mantendo o mesmo verbo do botão ao toast. Erro que explica o que houve e como sair, sem pedir desculpa e sem vaguidão. Estado vazio como convite à ação. Sentence case, sem filler.

## references/checks.md

**Greps que reprovam**, prontos para colar, cada um com o que significa a ocorrência:

- cor cravada: `oklch(`, `#` hexadecimal e `rgb(` em `components/` e `app/`, fora de `globals.css`
- `z-\[` avulso
- import de `lucide-react`
- `from "@/lib/utils"` no lugar de `from "cn"`
- `h-\d` ou `text-\[` em elemento que já tem `size` de registry
- `motion\.` em vez de `m\.`
- import direto de `@base-ui/react` em `components/custom`

**Piso de acessibilidade.** Foco visível em claro e escuro, inclusive sobre card, sidebar e toolbar. `aria-label` em todo controle só de ícone. `aria-invalid` e `aria-describedby` em campo com erro. `prefers-reduced-motion` respeitado. Status nunca comunicado só por cor. Contraste AA para texto e componente interativo.

**Autocrítica escrita.** Antes de entregar, registrar o que foi cortado e por quê — a regra de tirar um acessório antes de sair de casa.

## Manutenção

A skill é código de configuração e envelhece igual. Regra registrada no próprio SKILL.md: mudança em `app/globals.css`, em `styles/tokens/` ou em `components/ui/` atualiza a referência correspondente **no mesmo commit**. Uma skill que mente sobre os tokens é pior que skill nenhuma, porque é obedecida.

## Fora de escopo

- Não alterar nenhum componente, token ou tela. A entrega é documental.
- Não trocar o registry, a fonte, a paleta ou a biblioteca de ícones.
- Não substituir `docs/superpowers/specs/2026-09-08-shadcn-ui-ux-realignment-design.md`; a skill referencia essa spec como origem do contrato de tokens.
- Não documentar componente que não existe em `components/ui`.
- Não incluir passo de screenshot obrigatório.

## Critérios de aceite

- `.claude/skills/suite-frontend/SKILL.md` existe, tem frontmatter válido com `name` e `description`, e no máximo 200 linhas.
- As seis referências existem e cada uma é alcançável por um ponteiro no SKILL.md.
- Todo módulo de `components/ui` tem entrada em `components.md`; nenhuma entrada descreve módulo inexistente.
- Todo bloco `cva` do registry tem suas variantes transcritas — conferíveis contra o `.tsx`.
- Nenhum valor de cor, raio, duração ou z-index citado nas referências diverge de `app/globals.css` ou de `styles/tokens/layout.css`.
- `motion.md` traz o easing, as quatro durações, o orçamento de performance e a regra `m.*` + `useReducedMotion`.
- `layout.md` traz os cinco arquétipos com a referência de código de cada um e o critério da sobrancelha com exemplo permitido e proibido.
- `checks.md` traz greps executáveis; rodá-los na árvore atual não produz falso positivo em código que já está correto.
- A skill declara no topo que substitui a `frontend-design` dentro do produto.
- A regra de manutenção no mesmo commit está registrada no SKILL.md.
