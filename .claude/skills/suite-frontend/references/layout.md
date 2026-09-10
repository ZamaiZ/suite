# Layout

## Hierarquia em sistema chapado

Sem sombra, profundidade se constrói em três degraus, nesta ordem:

1. **Superfície** — `background` → `card` → `popover`. Cada degrau é uma camada de leitura.
2. **Borda** — `border-border` delimita; `border-border/70` recua para separador discreto.
3. **Densidade de espaço** — o que respira mais lê como mais importante.

Sombra entra só no que flutua de verdade: popover, toast, dropdown, diálogo. Sombra em cartão estático é decoração.

Quando três degraus não bastam para hierarquizar a tela, o problema não é o sistema — é que a tela tem conteúdo demais no mesmo nível.

## Arquétipos

### Board
Referência: `components/custom/LeadBoard`

```
toolbar fixa                    busca, filtros, limpar
└─ colunas em scroll horizontal
   └─ cartão = um registro
```

Coluna é escopo, cartão é registro. A toolbar não rola com o conteúdo — filtro fora de vista é filtro esquecido. Busca é `InputGroup`; escopo, segmento e tag sem busca são `Select`; cidade e qualquer filtro pesquisável são `Combobox`; limpar é `Button variant="ghost"`.

### Painel de trabalho
Referência: `components/custom/LeadGbpPanel`

```
grid-rows-[auto_1fr]
├─ faixa de identidade        colapsável, estado em localStorage
├─ abas internas              com contagem por aba
└─ min-h-0 overflow-y-auto    só o corpo rola
```

O cabeçalho fica fora do scroll: o analista precisa do nome e dos números enquanto percorre as abas. **`min-h-0` no filho é obrigatório** — sem ele o grid estoura em vez de rolar, e o bug só aparece com conteúdo longo.

Colapso pelo truque de `grid-template-rows` (ver `motion.md`). O botão de dobrar mora na linha das abas: é a fronteira entre a faixa e o corpo, e não custa uma linha nova de altura.

### Formulário longo
Referência: `components/custom/ClientBriefingWorkspace`

```
Stepper                       onde estou, quanto falta
└─ seção por vez
   └─ Field por decisão
   └─ autosave silencioso
```

Uma decisão por vez, progresso sempre visível, autosave sem diálogo. Salvar não é evento comemorado — é o padrão. O usuário só é interrompido quando algo dá errado.

### Leitura e apresentação
Referência: `components/custom/ClientPortalShell`

```
cabeçalho de marca
└─ coluna de leitura, máx. 72ch
   └─ seções com respiro maior que o operacional
```

Densidade maior que a das telas de trabalho: aqui ninguém está executando tarefa, está lendo. Sem toolbar, sem filtro, sem ação flutuante. É a única família de tela onde a escala tipográfica sobe.

### Diálogo
Referência: `components/custom/LeadDetailDialog`

```
DialogHeader     título + descrição
└─ corpo         um objetivo só
└─ DialogFooter  ação primária à direita
```

Um objetivo por diálogo. Se aparecer um segundo, são dois diálogos ou é uma página. Ação destrutiva dentro do diálogo abre seu próprio `AlertDialog` — não vira botão vermelho no rodapé.

`DialogTitle` sempre existe, mesmo invisível: é o nome acessível da camada.

## Sobrancelha caixa-alta

`text-xs font-semibold tracking-widest uppercase` acima de um título é o tell mais comum de UI gerada. Aqui é permitido sob um critério: **o rótulo carrega informação que o título não carrega.**

Permitido — a categoria situa o item dentro de uma lista longa:

```tsx
<p className="text-xs font-semibold tracking-widest text-primary uppercase">Reputação</p>
<h2 className="text-sm font-semibold">Respostas em até 24h</h2>
```

Proibido — o rótulo só reembala o título:

```tsx
<p className="text-xs font-semibold tracking-widest text-primary uppercase">Sistema de interface</p>
<h1 className="text-3xl font-semibold">Showcase shadcn</h1>
```

Na dúvida, apague a sobrancelha e leia o que sobrou. Se não perdeu nada, ela era enfeite.

## Tells a evitar

- cartões idênticos para conteúdo de hierarquias diferentes
- gradiente como decoração, sem codificar nada
- meta em `A · B · C` — frase pronta não tem hierarquia para declarar, e o componente só consegue imprimi-la inteira, em cinza
- `→` colado no texto de link ou botão
- mono para rótulo de dado (`--font-mono` é para `code`, `kbd`, `pre`, `samp`)
- numeração `01 / 02 / 03` em conteúdo que não é sequência
- skeleton com a forma errada — ele promete o layout que vem
- `bg-white` e `#0B0B0B` fazendo o papel de `card` e `foreground`
