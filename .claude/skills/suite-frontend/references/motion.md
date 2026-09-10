# Motion

Movimento aqui é expressivo, não decorativo. Os quatro usos abaixo estão liberados — a disciplina não é *onde* animar, é *como*, e o orçamento de performance é a condição.

## Vocabulário

Easing único: `[0.23, 1, 0.32, 1]`. Em CSS, `ease-[cubic-bezier(0.23,1,0.32,1)]`.

| Duração | Papel |
|---|---|
| 120ms | micro-estado — hover, foco, pressionar |
| 180ms | revelação curta — tooltip, popover, chip |
| 280ms | colapso e troca de superfície — acordeão, aba, painel |
| 550ms | crescimento de dado — barra, medidor, big number |

Sair dessas quatro exige um comentário na linha dizendo por quê.

## Orçamento de performance

- **Em qualquer coisa que se repita, anime só `transform` e `opacity`.** `width`, `height`, `top` e `left` disparam layout a cada quadro.
- **A exceção documentada é `StepMeter`** (`components/custom/LeadStepShell/StepMetrics.tsx`), que anima `width` de propósito: `scaleX` deforma a ponta arredondada. É um elemento por linha, não uma lista.
- **Antes de abrir uma segunda exceção, veja de quem é o raio.** Numa barra empilhada o raio mora no contêiner (`rounded-full overflow-hidden`), não nas fatias — então `scaleX` no contêiner não deforma ponta nenhuma, anima um elemento só e dispensa a exceção. `LeadWebsiteStackedBar` é assim de propósito.
- **Stagger tem teto.** Cascata só nos itens visíveis, delay decrescente, e o último item entra em no máximo ~400ms. `index * delay` numa lista de 200 leads é espera, não efeito.
- **Nada de `layout` do motion em lista longa** — ele mede todos os filhos a cada mudança.
- **`will-change` só durante a animação**, nunca fixo no CSS.
- **Transição de rota não segura o conteúdo novo.** Saída e entrada em paralelo, não em sequência: o usuário clicou para chegar, não para assistir.

## Regras de uso

**`m.*` de `motion/react-m`, nunca `motion.*`.** A raiz monta `LazyMotion features={domAnimation} strict` em `components/providers/motion-provider.tsx`. Sem provider, um `initial={{ opacity: 0 }}` vira opacidade zero permanente: o conteúdo fica no DOM, selecionável, invisível.

**`useReducedMotion` em todo componente que anima**, no padrão da casa:

```tsx
const reduced = !!useReducedMotion()

<m.div
  initial={reduced ? false : { opacity: 0, y: 4 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: reduced ? 0 : 0.18, ease: [0.23, 1, 0.32, 1] }}
/>
```

`initial={reduced ? false : {...}}` — `false`, não `undefined`. `false` monta direto no estado final; `undefined` volta ao padrão e anima assim mesmo.

**Colapso por grid.** Altura real, sem medir em JS e sem altura mágica no CSS:

```tsx
<div
  className="grid transition-[grid-template-rows,opacity] duration-[280ms] ease-[cubic-bezier(0.23,1,0.32,1)]"
  style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
>
  <div className="overflow-hidden">{children}</div>
</div>
```

O padding de cima mora no filho. No pai, sobra um respiro depois de fechado.

**`layoutId` é namespace global.** Duas instâncias montadas ao mesmo tempo com o mesmo `layoutId` disputam o mesmo elemento compartilhado, e o sublinhado salta de uma para a outra. Por isso `StepTabs` recebe o id por prop (`"gbp-step-tab-underline"`, `"website-step-tab-underline"`) em vez de ter um literal dentro. Componente reutilizável que anima com `layoutId` **sempre** recebe o id de fora.

**Hover e foco em CSS** (`transition-colors duration-150`), não em JS. Estado de ponteiro não merece re-render.

**Todo hover tem equivalente por teclado.** `group-focus-within`, não só `group-hover` — senão a ação secundária não existe para quem navega por tab.

## Os quatro usos

### Revelação de dado
**Caro:** a barra cresce da esquerda em 550ms e o número conta junto, então a magnitude é sentida antes de ser lida. A trilha aparece mesmo em zero — é ela que declara que existe uma escala.
**Slop:** número que gira sem parar, ou barra que anima toda vez que a lista re-renderiza.
Anime na montagem, uma vez. Fração diminuta ainda precisa de pixel visível (`min-w-1`); zero não inventa nenhum.

### Stagger de lista e board
**Caro:** as primeiras linhas entram em cascata curta, dando a sensação de que a lista se montou em vez de piscar.
**Slop:** cascata na lista inteira, em toda re-renderização, com o último item chegando dois segundos depois.
Teto de itens, delay decrescente, e nada de stagger em lista que já estava na tela.

### Transição de rota e aba
**Caro:** o conteúdo antigo sai enquanto o novo entra, com deslocamento pequeno na direção da navegação. O leitor entende que mudou de lugar.
**Slop:** crossfade de página inteira que atrasa o conteúdo, ou slide longo que vira espera.
Máximo 280ms, saída e entrada em paralelo. Aba interna anima só o painel, nunca o cabeçalho.

### Hover de card
**Caro:** a ação secundária aparece porque ficou alcançável, e a borda sobe um degrau de contraste.
**Slop:** card inteiro subindo com sombra crescente, em todos os cards, sempre. É o tell mais reconhecível de UI gerada.
Em sistema chapado, hover muda superfície e borda — não elevação.
