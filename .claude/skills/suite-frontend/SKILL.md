---
name: suite-frontend
description: Use ao construir ou alterar qualquer UI do app suite — telas, componentes, layout, cor, tipografia, espaçamento, motion ou copy de interface. Traz o contrato de tokens do shadcn base-mira, o catálogo dos 48 primitives de components/ui, os arquétipos de tela e os checks de verificação. Substitui a orientação genérica de design de front-end dentro deste produto.
---

# Front-end do suite

## Escopo e precedência

Esta skill é a autoridade de front-end deste produto e **substitui a `frontend-design` genérica** dentro dele.

A genérica parte de inventar uma identidade visual nova a cada projeto. Aqui isso é o erro: o sistema existe, está implementado e já foi realinhado uma vez. Obedecê-lo é o trabalho.

O que sobrevive da genérica: o rigor contra padrão de UI gerada, e a autocrítica antes de entregar.

Fora do produto — peça de marketing, landing, apresentação — a genérica volta a valer.

## O sistema, em cinco linhas

- shadcn **base-mira** sobre Base UI, baseColor **mist**, 48 primitives em `components/ui`
- **denso e chapado**: `Button` padrão tem 28px de altura e `text-xs/relaxed`; hierarquia vem de tipografia, peso e camada de cor, não de sombra
- **Inter** única, claro e escuro completos, `primary` teal
- ícones **`react-icons/ri`**, sem exceção
- motion **expressivo com orçamento**: easing `[0.23, 1, 0.32, 1]`, quatro durações, só `transform` e `opacity` no que se repete

## Leis

| Lei | Motivo |
|---|---|
| cor só por token semântico | valor cravado não acompanha o dark |
| `accent` é superfície Mist, nunca teal textual | `text-accent` legado vira `text-primary` — foi o bug que custou o realinhamento inteiro |
| ícone só de `react-icons/ri` | 137 arquivos, zero Lucide; não estrague o placar |
| empilhamento só por `--z-index-*` | `z-[60]` avulso não conversa com o `z-50` dos overlays do registry |
| altura de controle vem de `size` | `h-10` num controle que é `h-7` desalinha a linha inteira |
| `cn` importado de `"cn"` | 129 arquivos; `@/lib/utils` só reexporta |
| um primitive por papel | `Toggle` filtra, `Button` age, `ToggleGroup` escolhe, `DropdownMenu` agrupa ação secundária |
| nada de `@base-ui/react` direto | quando existe equivalente em `components/ui`, use o equivalente |
| não escreva primitive à mão | o que falta se instala pelo CLI do shadcn |
| `m.*` de `motion/react-m`, nunca `motion.*` | o `LazyMotion strict` da raiz deixa o conteúdo invisível no DOM |

## Fluxo

1. Leia `references/tokens.md`. Nomeie cada cor e tamanho antes de escrever a primeira classe.
2. Escolha os primitives pelo mapa em `references/components.md`. Se o módulo for composto, abra o `.tsx`.
3. Componha pelo arquétipo em `references/layout.md`.
4. Se houver movimento, siga `references/motion.md` — vocabulário fechado e orçamento de performance.
5. Escreva a copy por `references/writing.md`.
6. Rode `references/checks.md` e compare com o baseline.
7. Entregue com a autocrítica: o que você cortou e por quê.

## Referências

| Arquivo | Abra quando |
|---|---|
| `references/tokens.md` | escolher cor, tamanho de texto, raio, espaço ou camada |
| `references/components.md` | decidir qual primitive usar, ou compor um módulo grande |
| `references/motion.md` | qualquer coisa que se mexa |
| `references/layout.md` | montar tela nova ou reorganizar uma existente |
| `references/writing.md` | escrever rótulo, botão, erro ou estado vazio |
| `references/checks.md` | antes de dizer que terminou |

Para escolher a **forma** de um gráfico — não o componente — carregue também a skill `dataviz`.

## Manutenção

Esta skill envelhece como código. Mudança em `app/globals.css`, `styles/tokens/` ou `components/ui/` atualiza a referência correspondente **no mesmo commit**.

Skill que mente sobre os tokens é pior que skill nenhuma: ela é obedecida.
