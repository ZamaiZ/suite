# Skill de front-end do suite — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar `.claude/skills/suite-frontend/` — SKILL.md enxuto mais seis referências carregadas sob demanda, que passam a ser a autoridade de front-end deste produto.

**Architecture:** Entrega puramente documental. Nenhum componente, token ou tela muda. Cada arquivo é escrito a partir de extração da fonte de verdade no repositório (`app/globals.css`, `styles/tokens/layout.css`, `components/ui/*.tsx`) e conferido contra ela antes do commit — nada é escrito de memória. O SKILL.md é escrito por último, para que seus ponteiros apontem para seções que já existem.

**Tech Stack:** Markdown com frontmatter YAML. Verificação por `grep`/`sed` em Git Bash no Windows. Sem build, sem dependência nova.

**Spec:** `docs/superpowers/specs/2026-09-10-suite-frontend-skill-design.md`

## Global Constraints

- **Idioma:** PT-BR em todos os arquivos, incluindo a `description` do frontmatter.
- **Nada de código de produção muda.** Só se cria arquivo dentro de `.claude/skills/suite-frontend/`. Qualquer débito encontrado vira linha de baseline em `checks.md`, nunca um patch.
- **Nenhum valor citado pode ser escrito de memória.** Cor, raio, duração, z-index, variante e tamanho saem de `grep`/`sed` sobre o arquivo fonte, no mesmo passo em que são escritos.
- **SKILL.md tem no máximo 200 linhas.** É o único arquivo que carrega em toda invocação.
- **Nenhuma referência descreve componente ausente.** Não existem em `components/ui`: `context-menu`, `sheet`, `sidebar`, `hover-card`, `navigation-menu`, `resizable`, `scroll-area`, `carousel`.
- **Ambiente:** Git Bash no Windows. `grep -P` **não funciona** ("grep: -P supports only unibyte and UTF-8 locales") e `bc` **não existe**. Use `grep -E` mais `grep -v` para exclusão, e `wc -l` para contagem.
- **Valores canônicos** (conferidos em 2026-09-10): 48 arquivos em `components/ui`, 238 componentes, 17 blocos `cva` em 13 arquivos, 5.306 linhas. `--radius: 0.625rem`. Escala `--z-index-*` = sticky 20, nav 30, scrim 40, overlay 50, toast 60. Easing `[0.23, 1, 0.32, 1]`.
- **Commits:** um por task, mensagem em PT-BR, terminando com `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 1: `references/tokens.md`

Fundação. Todas as outras referências citam nomes de token definidos aqui.

**Files:**
- Create: `.claude/skills/suite-frontend/references/tokens.md`
- Read (fonte de verdade): `app/globals.css`, `styles/tokens/layout.css`, `app/layout.tsx`

**Interfaces:**
- Produces: os títulos `## Cor`, `## Camadas de conteúdo`, `## Tipografia`, `## Raio`, `## Espaço`, `## Camadas de empilhamento`. `SKILL.md` (Task 8), `components.md` (Tasks 2–3) e `layout.md` (Task 5) apontam para esses títulos por nome.

- [ ] **Step 1: Extrair os valores claros e escuros**

```bash
cd "C:/Users/Eduardo Zamai/Documents/suite"
sed -n '/^:root {/,/^}/p' app/globals.css
sed -n '/^\.dark {/,/^}/p' app/globals.css
```

Copie a saída para um arquivo de rascunho. Cada linha da tabela de cor sai daqui — não de memória.

- [ ] **Step 2: Escrever a seção `## Cor`**

Uma linha por token, nesta forma. Os quatro exemplos abaixo já estão corretos; complete com os demais a partir do Step 1.

```markdown
| Token | Claro | Escuro | Papel | Nunca |
|---|---|---|---|---|
| `primary` | `oklch(0.508 0.118 165.612)` | `oklch(0.696 0.17 162.48)` | ação principal, seleção, foco, progresso | como superfície de fundo grande |
| `accent` | `oklch(0.963 0.002 197.1)` | `oklch(0.275 0.011 216.9)` | hover, item focado, superfície sutil | como cor de texto teal — esse era o bug do realinhamento |
| `border` | `oklch(0.925 0.005 214.3)` | `oklch(1 0 0 / 10%)` | contorno estrutural | borda customizada com cor sólida no dark |
| `input` | `oklch(0.87 0.006 214.3)` | `oklch(1 0 0 / 22%)` | contorno de campo | confundir com fundo de campo |
```

Cobrir: `background`, `foreground`, `card`, `card-foreground`, `popover`, `popover-foreground`, `primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `muted`, `muted-foreground`, `accent`, `accent-foreground`, `destructive`, `success`, `success-foreground`, `warning`, `warning-foreground`, `border`, `input`, `ring`, `chart-1` a `chart-5`, e a família `sidebar-*`.

Registrar as duas observações que mudam como se escreve CSS:

```markdown
`ring` é alias de `primary` nos dois temas — mudar o foco significa mudar a marca.

No escuro, `border` e `input` são branco com opacidade (`oklch(1 0 0 / 10%)` e `/ 22%`), não cor sólida. Uma borda customizada com valor sólido não acompanha a superfície embaixo e aparece como risco.

`chart-1` a `chart-5` são uma rampa verde de claro para escuro, idêntica nos dois temas. Ela codifica intensidade, não categoria — para séries categóricas sem ordem, ela mente.
```

- [ ] **Step 3: Escrever `## Camadas de conteúdo`**

```markdown
Sistema chapado não tem sombra para hierarquizar. Sobram três camadas de ênfase, e só elas:

1. `text-foreground` — conteúdo primário
2. `text-muted-foreground` — secundário, placeholder, ícone contextual, meta
3. `border-border` — estrutura

Peso de fonte é o quarto eixo. Não existe quinto: se a tela precisa de mais um nível, ela precisa de menos conteúdo.
```

- [ ] **Step 4: Escrever `## Tipografia`**

Confirme antes que Inter é família única:

```bash
grep -n "font-sans\|font-heading\|font-mono" app/globals.css | head
grep -n "Inter" app/layout.tsx
```

Escreva a tabela da escala exatamente como na spec (H1 de página `text-3xl font-semibold`, H1 de contexto `text-2xl font-semibold`, título de seção `text-sm font-semibold`, corpo `text-sm` com máximo 72ch, meta `text-xs text-muted-foreground`, controle `text-xs/relaxed` não sobrescrevível), mais:

```markdown
`--font-heading` e `--font-sans` resolvem os dois para Inter. O token existe para permitir troca futura; trocar exige editar o `@theme inline` de `app/globals.css`, nunca uma classe no componente.
```

- [ ] **Step 5: Escrever `## Raio`, `## Espaço` e `## Camadas de empilhamento`**

```bash
grep -n "radius" app/globals.css
cat styles/tokens/layout.css
grep -n "z-index" app/globals.css
```

Raio: `--radius: 0.625rem` e a escala derivada, com a regra de que raio comunica tamanho de superfície — chip e card não compartilham raio.

Espaço: `--page-padding-x` (1rem → 1.5rem em 768px → 2rem em 1024px) e `--page-padding-y` (1rem → 1.5rem em 768px), sempre via `px-[var(--page-padding-x)]`.

Empilhamento: a escala nomeada com o papel de cada degrau, e a instrução de sair sempre dela.

- [ ] **Step 6: Conferir que nenhum valor divergiu**

Para cada valor de cor escrito, confirme que existe no fonte:

```bash
for v in $(grep -oE "oklch\([^)]*\)" .claude/skills/suite-frontend/references/tokens.md | sort -u); do
  grep -qF "$v" app/globals.css || echo "DIVERGE: $v"
done
```

Esperado: nenhuma linha `DIVERGE`.

- [ ] **Step 7: Commit**

```bash
git add .claude/skills/suite-frontend/references/tokens.md
git commit -m "docs(skill): referência de tokens do suite

Cor, camadas de conteúdo, escala tipográfica de página, raio, espaço e
empilhamento — extraídos de globals.css e layout.css, não de memória.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `references/components.md` — mapa de decisão e os 13 módulos com `cva`

**Files:**
- Create: `.claude/skills/suite-frontend/references/components.md`
- Read: `components/ui/{alert,attachment,badge,bubble,button-group,button,empty,field,input-group,item,marker,tabs,toggle}.tsx`

**Interfaces:**
- Consumes: nomes de token de `tokens.md` (Task 1).
- Produces: os títulos `## Mapa de decisão`, `## O que não está instalado` e `## Módulos`. Task 3 acrescenta entradas sob `## Módulos` sem alterar os dois primeiros.

- [ ] **Step 1: Escrever `## Mapa de decisão`**

```markdown
| Preciso de | Use | Não use |
|---|---|---|
| ação que muda estado ou navega | `Button` | `Toggle` |
| filtro binário que persiste | `Toggle` | `Button` com variante manual |
| opções mutuamente exclusivas | `ToggleGroup` | vários `Toggle` |
| menu de reticências | `DropdownMenu` | — |
| escolha em lista curta e fixa | `Select` | `Combobox` |
| escolha pesquisável ou assíncrona | `Combobox` | `Select` |
| escolha única visível | `RadioGroup` | `Select` |
| escolha em cartão | `RadioGroup` com layout de card | cartão clicável à mão |
| confirmação destrutiva | `AlertDialog` | `Dialog` |
| feedback transitório | `Toast` | `Alert` |
| aviso persistente na página | `Alert` | `Toast` |
| rótulo de estado | `Badge` | `Button` `size="xs"` |
| campo com rótulo, erro e ajuda | `Field` | `Label` mais `Input` soltos |
| paleta de comandos | `Command` | `Combobox` |
```

- [ ] **Step 2: Escrever `## O que não está instalado`**

```markdown
Não existem em `components/ui`: `context-menu`, `sheet`, `sidebar`, `hover-card`, `navigation-menu`, `resizable`, `scroll-area`, `carousel`.

Quando a tarefa pedir um deles: componha com o que existe, ou instale pelo CLI do shadcn. Nunca escreva um primitive à mão — ele nasce fora do contrato de tokens e do vocabulário de foco.

Os tokens `--color-sidebar-*` existem em `globals.css`, mas quem os consome é `components/custom/Sidebar`, que é implementação de produto e não primitive de registry.
```

- [ ] **Step 3: Extrair as variantes reais dos 13 módulos**

```bash
for f in alert attachment badge bubble button-group button empty field input-group item marker tabs toggle; do
  echo "===== $f ====="
  sed -n '/Variants = cva(/,/^)/p' "components/ui/$f.tsx"
done
```

- [ ] **Step 4: Abrir `## Módulos` e escrever uma entrada por módulo**

Crie o título `## Módulos` — Task 3 acrescenta as outras 35 entradas sob ele. Dentro, uma entrada por módulo no formato fixo. O `Button` abaixo já está conferido e serve de gabarito para os outros doze:

```markdown
### Button
Ação que muda estado ou navega. Não é filtro (`Toggle`), não é escolha exclusiva (`ToggleGroup`), não é rótulo (`Badge`).
Exporta: `Button`, `buttonVariants`
`variant`: `default` · `outline` · `secondary` · `ghost` · `destructive` · `link`
`size`: `default` (28px) · `xs` (20) · `sm` (24) · `lg` (32) · `icon` (28) · `icon-xs` (20) · `icon-sm` (24) · `icon-lg` (32)
⚠ `destructive` é fundo `destructive/10` com texto vermelho, não botão vermelho sólido. Exclusão de verdade é `AlertDialog` mais este botão no confirmar.
⚠ O ícone dimensiona sozinho por `size` — `[&_svg:not([class*='size-'])]`. Passar `size={14}` no ícone anula isso e desalinha a linha.
```

- [ ] **Step 5: Conferir que toda variante escrita existe no `cva`**

```bash
for f in alert attachment badge bubble button-group button empty field input-group item marker tabs toggle; do
  echo "--- $f ---"
  sed -n '/Variants = cva(/,/^)/p' "components/ui/$f.tsx" | grep -oE '^\s+"?[a-z0-9-]+"?:' | tr -d ' ":'
done
```

Compare com o que você escreveu. Qualquer nome no `.md` que não apareça aqui é invenção — apague.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/suite-frontend/references/components.md
git commit -m "docs(skill): mapa de decisão e os 13 módulos com cva

Variantes e tamanhos transcritos do cva real de cada arquivo. Inclui a
lista do que não está instalado, para não ser inventado.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `references/components.md` — os 35 módulos restantes e os wrappers de domínio

**Files:**
- Modify: `.claude/skills/suite-frontend/references/components.md` (acrescenta sob `## Módulos`)
- Read: os 35 `.tsx` de `components/ui` sem `cva`

**Interfaces:**
- Consumes: `## Módulos` de Task 2.
- Produces: o título `## Wrappers de domínio — não recrie`.

- [ ] **Step 1: Listar o que falta**

```bash
comm -23 \
  <(ls components/ui/*.tsx | xargs -n1 basename | sed 's/\.tsx//' | sort) \
  <(printf '%s\n' alert attachment badge bubble button-group button empty field input-group item marker tabs toggle | sort)
```

Esperado: 35 nomes.

- [ ] **Step 2: Extrair exports e ordem de composição**

```bash
for f in $(comm -23 <(ls components/ui/*.tsx | xargs -n1 basename | sed 's/\.tsx//' | sort) <(printf '%s\n' alert attachment badge bubble button-group button empty field input-group item marker tabs toggle | sort)); do
  echo "===== $f ====="
  grep -oE "^function [A-Z][A-Za-z]*" "components/ui/$f.tsx" | sed 's/function //'
done
```

- [ ] **Step 3: Escrever as 35 entradas**

Mesmo formato da Task 2, sem as linhas `variant`/`size`. Gabarito conferido:

```markdown
### Combobox
Escolha pesquisável ou assíncrona, com ou sem seleção múltipla. Para lista curta e fixa, é `Select`.
Exporta: `Combobox`, `ComboboxInput`, `ComboboxTrigger`, `ComboboxContent`, `ComboboxList`, `ComboboxItem`, `ComboboxEmpty`, `ComboboxChips`, `ComboboxChip` e mais 6 — leia o arquivo antes de compor.
Composição: `Combobox` → `ComboboxTrigger`/`ComboboxInput` → `ComboboxContent` → `ComboboxList` → `ComboboxItem`. `ComboboxEmpty` mora dentro de `ComboboxList`.
⚠ 15 componentes em 324 linhas. Compor de memória erra a ordem — abra `components/ui/combobox.tsx`.
```

Os sete módulos compostos e grandes — `combobox` (15), `dropdown-menu` (15), `alert-dialog` (12), `toast` (12), `field` (10), `item` (10), `dialog` (10) — recebem obrigatoriamente a linha `Composição:`. `chart` (372 linhas) recebe aviso de que a rampa `chart-*` é sequencial, e ponteiro para a skill `dataviz` quando a tarefa for escolher forma de gráfico.

- [ ] **Step 4: Escrever `## Wrappers de domínio — não recrie`**

```markdown
Encapsulam regra de negócio e têm API pública estável. Use, não reimplemente:

| Wrapper | Regra que carrega |
|---|---|
| `DateTimePicker` | data e hora civil, sem fuso |
| `TimePicker` | hora civil |
| `BriefingChoiceCard` | `RadioGroup` com layout de cartão |
| `ThemeToggle` | sistema/claro/escuro por `DropdownMenuRadioGroup` |
| `Stepper` | progresso de fluxo longo |
| `NavTree` | hierarquia de navegação com colapso |
```

- [ ] **Step 5: Conferir cobertura total**

O título de cada entrada é o nome do arquivo em PascalCase — `### DropdownMenu` para `dropdown-menu.tsx` — então o grep tem que remover o hífen antes de comparar:

```bash
for f in $(ls components/ui/*.tsx | xargs -n1 basename | sed 's/\.tsx//'); do
  grep -qi "^### $(echo $f | tr -d '-')" .claude/skills/suite-frontend/references/components.md || echo "FALTA: $f"
done
```

Esperado: nenhuma linha `FALTA` — os 48 módulos cobertos.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/suite-frontend/references/components.md
git commit -m "docs(skill): completar o catálogo com os 35 módulos restantes

Todos os 48 módulos de components/ui têm entrada. Os sete compostos
grandes ganham ordem de composição, que é onde se erra sem ler o arquivo.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `references/motion.md`

**Files:**
- Create: `.claude/skills/suite-frontend/references/motion.md`
- Read: `components/providers/motion-provider.tsx`, `components/custom/LeadGbpPanel/LeadGbpMetrics.tsx`, `components/custom/LeadGbpPanel/LeadGbpProfileHeader.tsx`

**Interfaces:**
- Produces: os títulos `## Vocabulário`, `## Orçamento de performance`, `## Regras de uso`, `## Os quatro usos`.

- [ ] **Step 1: Conferir o vocabulário contra o código**

```bash
grep -rhoE "cubic-bezier\([^)]*\)|ease: ?\[[^]]*\]" --include=*.tsx --include=*.css app components styles | sort | uniq -c | sort -rn
```

Esperado: `cubic-bezier(0.23,1,0.32,1)` dominante.

- [ ] **Step 2: Escrever `## Vocabulário`**

```markdown
Easing único: `[0.23, 1, 0.32, 1]`. Em CSS, `ease-[cubic-bezier(0.23,1,0.32,1)]`.

| Duração | Papel |
|---|---|
| 120ms | micro-estado — hover, foco, pressionar |
| 180ms | revelação curta — tooltip, popover, chip |
| 280ms | colapso e troca de superfície — acordeão, aba, painel |
| 550ms | crescimento de dado — barra, medidor, big number |

Sair dessas quatro exige um comentário na linha dizendo por quê.
```

- [ ] **Step 3: Escrever `## Orçamento de performance`**

```markdown
Motion expressivo só se sustenta com orçamento. Estas são as condições:

- Em qualquer coisa que se repita, anime só `transform` e `opacity`. `width`, `height`, `top` e `left` disparam layout a cada quadro.
- A exceção documentada é `GbpMeter` (`LeadGbpMetrics.tsx`), que anima `width` de propósito: `scaleX` deforma a ponta arredondada. É um elemento por linha, não uma lista.
- Stagger tem teto: cascata só nos primeiros itens visíveis, delay decrescente, máximo absoluto de ~400ms para o último. `index * delay` numa lista de 200 leads é espera, não efeito.
- Nada de `layout` do motion em lista longa — ele mede todos os filhos a cada mudança.
- `will-change` só durante a animação, nunca fixo no CSS.
- Transição de rota não pode segurar o conteúdo novo: anime a saída em paralelo com a entrada, não em sequência.
```

- [ ] **Step 4: Escrever `## Regras de uso`**

```markdown
**`m.*` de `motion/react-m`, nunca `motion.*`.** A raiz monta `LazyMotion features={domAnimation} strict` (`components/providers/motion-provider.tsx`). Sem provider, um `initial={{ opacity: 0 }}` vira opacidade zero permanente: o conteúdo fica no DOM, selecionável, invisível.

**`useReducedMotion` em todo componente que anima**, no padrão da casa:

    const reduced = !!useReducedMotion()
    <m.div
      initial={reduced ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.18, ease: [0.23, 1, 0.32, 1] }}
    />

`initial={reduced ? false : {...}}` — `false`, não `undefined`: monta no estado final sem transição.

**Colapso por grid.** Altura real, sem medir em JS e sem altura mágica:

    <div className="grid transition-[grid-template-rows] duration-[280ms] ease-[cubic-bezier(0.23,1,0.32,1)]"
         style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
      <div className="overflow-hidden">{children}</div>
    </div>

O padding de cima mora no filho — no pai, sobra um respiro depois de fechado.

**Hover e foco em CSS** (`transition-colors duration-150`), não em JS. Estado de ponteiro não merece re-render.
```

- [ ] **Step 5: Escrever `## Os quatro usos`**

Um bloco por uso — revelação de dado, stagger de lista e board, transição de rota e aba, hover de card — cada um dizendo o que o torna caro e o que o torna slop. Exemplo conferido:

```markdown
### Hover de card
Caro: a ação secundária aparece porque ficou alcançável, e a borda sobe um degrau de contraste.
Slop: card inteiro subindo com sombra crescente, em todos os cards, sempre. É o tell mais reconhecível de UI gerada.
Sempre com equivalente por teclado — `group-focus-within`, não só `group-hover`.
```

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/suite-frontend/references/motion.md
git commit -m "docs(skill): vocabulário e orçamento de motion

Easing e quatro durações extraídos dos 23 usos existentes. O orçamento
de performance é a condição para o motion expressivo.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `references/layout.md`

**Files:**
- Create: `.claude/skills/suite-frontend/references/layout.md`
- Read: `components/custom/{LeadBoard,LeadGbpPanel,ClientBriefingWorkspace,ClientPortalShell,LeadDetailDialog}/`

**Interfaces:**
- Consumes: `## Camadas de conteúdo` e `## Espaço` de `tokens.md` (Task 1).
- Produces: os títulos `## Hierarquia em sistema chapado`, `## Arquétipos`, `## Sobrancelha caixa-alta`, `## Tells a evitar`.

- [ ] **Step 1: Escrever `## Hierarquia em sistema chapado`**

```markdown
Sem sombra, profundidade se constrói em três degraus, nesta ordem:

1. **Superfície** — `background` → `card` → `popover`. Cada degrau é uma camada de leitura.
2. **Borda** — `border` delimita; `border-border/70` recua para separador.
3. **Densidade de espaço** — o que respira mais lê como mais importante.

Sombra entra só em coisa que flutua de verdade: popover, toast, dropdown. Sombra em card estático é decoração.
```

- [ ] **Step 2: Ler os cinco arquétipos no código**

```bash
for d in LeadBoard LeadGbpPanel ClientBriefingWorkspace ClientPortalShell LeadDetailDialog; do
  echo "===== $d ====="; ls "components/custom/$d"
done
```

- [ ] **Step 3: Escrever `## Arquétipos`**

Um bloco por arquétipo, com esqueleto de classes e a regra central. Gabarito conferido:

```markdown
### Painel de trabalho
Referência: `components/custom/LeadGbpPanel`

    grid-rows-[auto_1fr]           cabeçalho fora do scroll
      ├─ faixa de identidade       colapsável, estado em localStorage
      ├─ abas internas             contagem por aba
      └─ min-h-0 overflow-y-auto   só o corpo rola

O cabeçalho não rola: o analista precisa do nome e dos números enquanto percorre as abas. `min-h-0` no filho é obrigatório — sem ele, o grid estoura em vez de rolar.
```

Os outros quatro: **Board** (`LeadBoard`) — coluna é escopo, cartão é registro, toolbar fixa. **Formulário longo** (`ClientBriefingWorkspace`) — uma decisão por vez, progresso visível, autosave sem diálogo. **Leitura e apresentação** (`ClientPortalShell`) — linha de 72ch, densidade maior que a operacional, sem toolbar. **Diálogo** (`LeadDetailDialog`) — um objetivo por diálogo, destrutivo exige `AlertDialog` próprio.

- [ ] **Step 4: Escrever `## Sobrancelha caixa-alta`**

```markdown
`text-xs font-semibold tracking-widest uppercase` acima de um título é o tell mais comum de UI gerada. Aqui ele é permitido sob um critério: **o rótulo carrega informação que o título não carrega**.

Permitido — a categoria situa o item numa lista longa:

    <p className="text-xs font-semibold tracking-widest text-primary uppercase">Reputação</p>
    <h2 className="text-sm font-semibold">Respostas em até 24h</h2>

Proibido — o rótulo só repete o que o título já diz:

    <p className="text-xs font-semibold tracking-widest text-primary uppercase">Sistema de interface</p>
    <h1 className="text-3xl font-semibold">Showcase shadcn</h1>
```

- [ ] **Step 5: Escrever `## Tells a evitar`**

```markdown
- cartões idênticos para conteúdo de hierarquias diferentes
- gradiente como decoração, sem codificar nada
- meta em `A · B · C` — vira frase pronta, e frase pronta não tem hierarquia para declarar
- `→` colado no texto de link ou botão
- mono para rótulo de dado (`--font-mono` é para código, `kbd` e `pre`)
- numeração `01 / 02 / 03` em conteúdo que não é sequência
- skeleton com a forma errada — ele promete o layout que vem
```

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/suite-frontend/references/layout.md
git commit -m "docs(skill): arquétipos de tela e hierarquia chapada

Cinco arquétipos ancorados em telas reais. A sobrancelha caixa-alta
ganha critério com exemplo permitido e proibido lado a lado.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: `references/writing.md`

**Files:**
- Create: `.claude/skills/suite-frontend/references/writing.md`

**Interfaces:**
- Produces: o título `## Escrita de interface`.

- [ ] **Step 1: Colher copy real das telas, para os exemplos não serem inventados**

```bash
grep -rhoE '"[A-ZÀ-Ú][^"]{8,60}"' --include=*.tsx components/custom | sort -u | head -60
```

- [ ] **Step 2: Escrever o arquivo**

Seis regras, cada uma com um par ruim/bom tirado do passo anterior:

```markdown
**Nomeie pelo que o usuário entende.** "Perfil do Google", não "GBP profile". "Quem indicou", não "referral_source".

**O CTA diz o que acontece.** "Salvar alterações", não "Enviar". O verbo do botão é o verbo do toast: `Publicar` → `Publicado`.

**O erro explica o que houve e como sair.** Não pede desculpa, não é vago.
Ruim: "Ocorreu um erro ao processar sua solicitação."
Bom: "Não foi possível coletar o perfil: o Google não respondeu. Tente de novo em alguns minutos."

**Vazio é convite.** "Nenhum lead ainda. Importe uma planilha ou crie o primeiro." — não "Sem dados".

**Sentence case.** Só a primeira letra e nomes próprios. Vale para botão, rótulo, título de diálogo e item de menu.

**Sem filler.** "Aqui você pode gerenciar seus leads" não sobrevive ao corte. O título já disse.
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/suite-frontend/references/writing.md
git commit -m "docs(skill): voz de interface em PT-BR

Seis regras com par ruim/bom tirado das telas reais.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: `references/checks.md`

O único arquivo com teste de verdade: os greps têm que rodar limpo na árvore atual.

**Files:**
- Create: `.claude/skills/suite-frontend/references/checks.md`

**Interfaces:**
- Produces: os títulos `## Greps de reprovação`, `## Baseline conhecido`, `## Piso de acessibilidade`, `## Autocrítica`.

- [ ] **Step 1: Rodar os sete greps e anotar a contagem atual**

Todos já foram validados em 2026-09-10. Confirme que ainda batem:

```bash
cd "C:/Users/Eduardo Zamai/Documents/suite"
echo -n "cor cravada: "; grep -rnE "oklch\(|#[0-9a-fA-F]{3,8}|rgba?\(" --include=*.tsx components/custom app | grep -v "oklch(from " | wc -l
echo -n "z-[N]: ";       grep -rnE "z-\[" --include=*.tsx components/custom app | wc -l
echo -n "lucide: ";      grep -rn "lucide-react" --include=*.tsx --include=*.ts components app lib hooks | wc -l
echo -n "cn errado: ";   grep -rn 'cn.*from "@/lib/utils"' --include=*.tsx components app | wc -l
echo -n "motion.*: ";    grep -rnE "<motion\." --include=*.tsx components app | wc -l
echo -n "base-ui: ";     grep -rn "@base-ui/react" --include=*.tsx components/custom app | wc -l
echo -n "altura magica: "; grep -rnoE "<(Button|Input|Textarea|SelectTrigger|Toggle)[^>]*className=\"[^\"]*\bh-[0-9]" --include=*.tsx components/custom app | wc -l
echo -n "anima sem reduced: "; for f in $(grep -rlE "<m\." --include=*.tsx components/custom app); do grep -q "useReducedMotion" "$f" || echo "$f"; done | wc -l
```

Esperado em 2026-09-10: `5, 0, 0, 0, 0, 2, 0, 1`.

- [ ] **Step 2: Escrever `## Greps de reprovação`**

Cada grep com o comando exato do Step 1, mais uma linha dizendo o que significa a ocorrência. Registre as duas armadilhas de ambiente:

```markdown
Git Bash no Windows: `grep -P` não funciona e `bc` não existe. Exclusão é `grep -E` mais `grep -v`; contagem é `wc -l`.

`components/ui` fica fora do escopo dos checks: é código gerado pelo registry. `oklch(from var(--token) …)` é cor relativa derivada de token — legítima, e por isso excluída do check de cor cravada.
```

- [ ] **Step 3: Escrever `## Baseline conhecido`**

```markdown
Estas ocorrências existem hoje e são débito conhecido, não regressão. Se a contagem subir, o que entrou é novo — investigue.

| Check | Hoje | Onde | O que é |
|---|---|---|---|
| cor cravada | 5 | `components/custom/NavTree/NavTree.tsx` | `dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]` repetido — filete branco no escuro que deveria sair de `--border` (que já é `oklch(1 0 0 / 10%)`) |
| base-ui direto | 2 | `DateTimePicker`, `TimePicker` | importam `Popover` de `@base-ui/react` em vez do local; a spec de realinhamento previa a troca e ela não aconteceu |
| anima sem reduced | 1 | `components/custom/LeadGbpPanel/LeadGbpAuditStep.tsx` | único dos 35 arquivos que animam sem `useReducedMotion` |

Corrigir qualquer um deles é trabalho próprio, com sua própria aprovação — não carona numa tarefa de UI.
```

- [ ] **Step 4: Escrever `## Piso de acessibilidade` e `## Autocrítica`**

```markdown
## Piso de acessibilidade

- foco visível em claro e escuro, inclusive sobre card, sidebar e toolbar
- `aria-label` em todo controle que só tem ícone
- `aria-invalid` e `aria-describedby` em campo com erro
- `prefers-reduced-motion` respeitado em tudo que anima
- status nunca só por cor — sempre com texto ou forma junto
- contraste AA para texto normal e componente interativo

## Autocrítica

Antes de entregar, escreva duas linhas: o que você cortou e por quê. Se não cortou nada, você não terminou — olhe de novo e tire um acessório.
```

- [ ] **Step 5: Rodar os greps de novo, agora como o consumidor rodaria**

Copie cada bloco do `checks.md` recém-escrito e execute. Esperado: as mesmas contagens do Step 1, e nenhum erro de sintaxe do shell.

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/suite-frontend/references/checks.md
git commit -m "docs(skill): greps de verificação com baseline

Sete checks validados na árvore atual. O baseline registra os três
débitos conhecidos — NavTree, os dois pickers e LeadGbpAuditStep — para
que qualquer aumento de contagem seja regressão.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: `SKILL.md` e coerência final

Escrito por último: os ponteiros apontam para seções que já existem.

**Files:**
- Create: `.claude/skills/suite-frontend/SKILL.md`

**Interfaces:**
- Consumes: os títulos produzidos pelas Tasks 1–7.

- [ ] **Step 1: Escrever o frontmatter**

```markdown
---
name: suite-frontend
description: Use ao construir ou alterar qualquer UI do app suite — telas, componentes, layout, cor, tipografia, espaçamento, motion ou copy de interface. Traz o contrato de tokens shadcn base-mira, o catálogo dos 48 primitives de components/ui, os arquétipos de tela e os checks de verificação. Substitui a orientação genérica de design de front-end dentro deste produto.
---
```

- [ ] **Step 2: Escrever `## Escopo e precedência`**

```markdown
Esta skill é a autoridade de front-end deste produto e **substitui a `frontend-design` genérica** dentro dele.

A genérica parte de inventar uma identidade visual nova a cada projeto. Aqui isso é o erro: o sistema existe, está implementado e já foi realinhado uma vez. Obedecê-lo é o trabalho.

O que sobrevive da genérica: o rigor contra padrão de UI gerada, e a autocrítica antes de entregar.

Fora do produto — peça de marketing, landing, apresentação — a genérica volta a valer.
```

- [ ] **Step 3: Escrever `## Leis`**

```markdown
| Lei | Motivo |
|---|---|
| cor só por token semântico | valor cravado não acompanha o dark |
| `accent` é superfície Mist, nunca teal textual | `text-accent` legado vira `text-primary`; foi o bug que custou o realinhamento |
| ícone só de `react-icons/ri` | 137 arquivos, zero Lucide — não estrague o placar |
| empilhamento só por `--z-index-*` | `z-[60]` avulso não conversa com os overlays do registry |
| altura de controle vem de `size` | `h-10` num controle que é `h-7` desalinha a linha inteira |
| `cn` importado de `"cn"` | 129 arquivos; `@/lib/utils` só reexporta |
| um primitive por papel | `Toggle` filtra, `Button` age, `ToggleGroup` escolhe, `DropdownMenu` agrupa ação secundária |
| nada de `@base-ui/react` direto | quando existe equivalente em `components/ui`, use o equivalente |
| não escreva primitive à mão | o que falta se instala pelo CLI do shadcn |
```

- [ ] **Step 4: Escrever `## Fluxo` e `## Referências`**

```markdown
## Fluxo

1. Leia `references/tokens.md` — nomeie cada cor e tamanho antes de escrever classe.
2. Escolha os primitives pelo mapa em `references/components.md`. Se o módulo for composto, abra o `.tsx`.
3. Componha pelo arquétipo em `references/layout.md`.
4. Se houver movimento, siga `references/motion.md` — vocabulário fechado e orçamento de performance.
5. Escreva a copy por `references/writing.md`.
6. Rode `references/checks.md` e compare com o baseline.
7. Entregue com a autocrítica: o que foi cortado e por quê.

## Referências

| Arquivo | Abra quando |
|---|---|
| `references/tokens.md` | escolher cor, tamanho de texto, raio, espaço ou camada |
| `references/components.md` | decidir qual primitive usar, ou compor um módulo grande |
| `references/motion.md` | qualquer coisa que se mexa |
| `references/layout.md` | montar tela nova ou reorganizar uma existente |
| `references/writing.md` | escrever rótulo, botão, erro ou estado vazio |
| `references/checks.md` | antes de dizer que terminou |
```

- [ ] **Step 5: Escrever `## Manutenção`**

```markdown
Esta skill envelhece como código. Mudança em `app/globals.css`, `styles/tokens/` ou `components/ui/` atualiza a referência correspondente **no mesmo commit**.

Skill que mente sobre os tokens é pior que skill nenhuma — ela é obedecida.
```

- [ ] **Step 6: Verificar tamanho e ponteiros**

```bash
wc -l .claude/skills/suite-frontend/SKILL.md
for r in tokens components motion layout writing checks; do
  test -f ".claude/skills/suite-frontend/references/$r.md" || echo "FALTA: $r.md"
  grep -q "references/$r.md" .claude/skills/suite-frontend/SKILL.md || echo "SEM PONTEIRO: $r.md"
done
```

Esperado: `wc -l` ≤ 200, nenhuma linha `FALTA` ou `SEM PONTEIRO`.

- [ ] **Step 7: Verificar os critérios de aceite da spec**

```bash
grep -c "^| " .claude/skills/suite-frontend/references/tokens.md
for f in $(ls components/ui/*.tsx | xargs -n1 basename | sed 's/\.tsx//'); do
  grep -qi "$(echo $f | tr -d '-')" .claude/skills/suite-frontend/references/components.md || echo "FALTA MÓDULO: $f"
done
grep -q "0.23, 1, 0.32, 1" .claude/skills/suite-frontend/references/motion.md || echo "FALTA easing"
grep -q "useReducedMotion" .claude/skills/suite-frontend/references/motion.md || echo "FALTA reduced motion"
grep -q "substitui" .claude/skills/suite-frontend/SKILL.md || echo "FALTA declaração de precedência"
grep -q "mesmo commit" .claude/skills/suite-frontend/SKILL.md || echo "FALTA regra de manutenção"
```

Esperado: nenhuma linha de falta.

- [ ] **Step 8: Commit**

```bash
git add .claude/skills/suite-frontend/SKILL.md
git commit -m "docs(skill): SKILL.md do suite-frontend

Escopo, precedência sobre a frontend-design genérica, nove leis, fluxo
de sete passos e ponteiros para as seis referências. Fecha com a regra
de manutenção no mesmo commit.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Cobertura da spec

| Requisito da spec | Task |
|---|---|
| Estrutura do pacote | 1–8 |
| SKILL.md com escopo, leis, fluxo, ponteiros | 8 |
| `tokens.md` — cor, camadas, tipografia, raio, espaço, empilhamento | 1 |
| `components.md` — mapa de decisão, ausentes, 48 módulos, wrappers | 2, 3 |
| `motion.md` — vocabulário, orçamento, regras, quatro usos | 4 |
| `layout.md` — hierarquia, cinco arquétipos, sobrancelha, tells | 5 |
| `writing.md` — voz PT-BR | 6 |
| `checks.md` — greps, a11y, autocrítica | 7 |
| Baseline de débito conhecido | 7 |
| Regra de manutenção no mesmo commit | 8 |
| Critérios de aceite verificados | 8, Step 7 |
