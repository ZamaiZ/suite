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
Referência: `components/custom/LeadGbpPanel` (etapa Perfil no Google), `components/custom/LeadWebsitePanel` (etapa Website), `components/custom/LeadDigitalPresencePanel` (etapa Presença digital) e `components/custom/LeadVisibilityPanel` (etapa Visibilidade). As quatro montam a mesma coisa a partir de `components/custom/LeadStepShell`.

```
grid-cols-[minmax(0,1fr)_var(--rail-w)]
├─ coluna central             grid-rows-[auto_minmax(0,1fr)]
│  ├─ cabeçalho fixo          fora do scroll
│  │  ├─ título + ações da etapa
│  │  ├─ identidade + 4 big numbers   colapsável, estado em localStorage
│  │  ├─ faixa de avisos      só ocupa altura quando há o que dizer
│  │  └─ abas internas        com contagem por aba
│  └─ min-h-0 overflow-y-auto  só o corpo rola, fundo bg-accent/45
└─ coluna de oportunidades    21.25rem ⇄ 3rem, Ctrl/⌘ B
   └─ bloco do analista       no pé da coluna, Ctrl/⌘ Shift E
```

O cabeçalho fica fora do scroll: o analista precisa do nome e dos números enquanto percorre as abas. **`min-h-0` no filho é obrigatório** — sem ele o grid estoura em vez de rolar, e o bug só aparece com conteúdo longo.

Colapso pelo truque de `grid-template-rows` (ver `motion.md`). O botão de dobrar mora na linha das abas: é a fronteira entre a faixa e o corpo, e não custa uma linha nova de altura.

**Identidade mais quatro números, todos da mesma altura.** É o ponto do arquétipo: a linha lê como uma faixa, não como cinco cartões soltos. A célula de identidade carrega miniatura, nome, URL e badges de estado; se houver mais de um registro, o `Select` de troca mora nela — não solto acima da tela.

**Cada big number é a manchete de uma aba, e clicar nele leva até lá.** É o que transforma o cabeçalho de estatística solta em estado da etapa. Big number clicável é `button` com `aria-label` nomeando o destino: o rótulo visível (`PERFORMANCE`) não diz que clicar leva a algum lugar.

**A coluna recolhida continua montada**, com `inert` — é o que preserva o filtro escolhido, o campo do analista e o rascunho não salvo. Cada etapa passa a própria chave de `localStorage`; recolher numa não recolhe na outra.

**A faixa de avisos mora no cabeçalho fixo.** Erro de coleta, "coletando…", job falho: solto acima dos cards, isso rola para fora da tela junto com o conteúdo.

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

## Formas de medida

Medidor não é decoração de número: é uma afirmação sobre a escala. Escolher a forma errada faz a tela dizer o contrário do dado.

**Barra de fração só serve quando "cheio" é bom.** `StepMeter` mede `valor / todo` e lê como progresso: cheio é completo, vazio é nada feito. Serve para aprovados sobre total, critérios julgados, domínios contra a mediana do mercado.

**Onde menor é melhor, ou onde existe limiar, use régua de banda.** Uma barra de fração num Core Web Vital mente: um LCP de 828ms sobre um limiar de 2500ms enche 16% da trilha e lê como "quase vazio", quando é o melhor resultado possível. A régua inverte os papéis — as **zonas** (bom, a melhorar, ruim) são o fundo, e o **dado é o marcador**. O leitor vê em que faixa caiu e a que distância está da fronteira, e a fronteira entre as cores é o limiar, que numa barra de fração não aparece em lugar nenhum. Referência: `LeadWebsiteVitalGauge`.

**Duas leituras da mesma métrica são dois marcadores, não uma frase.** Laboratório sólido, campo vazado; embaixo, cada número com o mesmo pontinho ao lado, rótulo em micro caixa-alta e valor em `text-foreground font-semibold tabular-nums`. `"828ms lab · 1,1s campo"` em cinza não declara qual dos dois olhar primeiro.

**Distribuição é barra empilhada com legenda, nunca frase.** `"Links por TLD: .br 62% · .com 21%"` é proporção que o leitor tem que decorar em vez de comparar. Referência: `LeadWebsiteStackedBar`.

**Trilha sem escala mente pior que trilha ausente.** Se não há denominador — sem mediana de mercado, sem total conhecido —, não renderize a barra. Um `0%` desenhado onde não existe escala é pior que o número sozinho.

**Comparação entre itens é linha ranqueada com barra proporcional.** Lista de `nome · N` em cinza não é comparada, é lida item a item. A barra é o gancho que faz o maior saltar antes da leitura.

## Duas colunas de cards são duas colunas de fluxo

`grid grid-cols-2` faz a **linha** tomar a altura do card mais alto — o card curto deixa um buraco embaixo até a próxima linha começar. Quando os cards têm alturas naturais diferentes e a ordem entre colunas não importa, use dois `flex flex-col` lado a lado e distribua os cards entre eles. Empacota sem vão.

Grid continua certo quando as células **devem** ter a mesma altura — a faixa de identidade e big numbers do painel de trabalho é grid justamente por isso.

## O presenter não devolve frase quando o número importa

Corolário da regra contra `A · B · C`. Quando o detalhe carrega uma contagem, o presenter devolve as duas formas:

```ts
{
  detail: "3 de 12 páginas sem H1",           // para quem consome texto
  count: { value: 3, total: 12, noun: "de 12 páginas sem H1" },
}
```

`detail` continua obrigatório — o diagnóstico e a coluna de oportunidades leem texto. `count` é opcional e existe para a linha poder tirar o `3` da frase e emitir em `tabular-nums`, no tom do estado. Sem o contrato, ou a frase pronta volta, ou quem lê texto quebra.

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

**A ressalva viaja no `aside` da sobrancelha, não num parágrafo cinza.** `StepSectionLabel` aceita um `aside` à direita, e é ali que mora a qualificação que o rótulo sozinho não carrega: `conta links, não domínios`, `bom · a melhorar · ruim`, `abrir a página decide`. Solta abaixo da seção, essa frase vira mais uma linha cinza que ninguém lê; presa ao rótulo, ela é lida junto com aquilo que qualifica.

## Tells a evitar

- cartões idênticos para conteúdo de hierarquias diferentes
- gradiente como decoração, sem codificar nada
- meta em `A · B · C` — frase pronta não tem hierarquia para declarar, e o componente só consegue imprimi-la inteira, em cinza
- `→` colado no texto de link ou botão
- mono para rótulo de dado (`--font-mono` é para `code`, `kbd`, `pre`, `samp`)
- numeração `01 / 02 / 03` em conteúdo que não é sequência
- skeleton com a forma errada — ele promete o layout que vem
- `bg-white` e `#0B0B0B` fazendo o papel de `card` e `foreground`
