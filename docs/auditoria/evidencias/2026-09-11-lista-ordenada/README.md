# Forma da lista ordenada nas quatro plataformas

Medido em 2026-09-11. **US$ 0,08318**, teto de US$ 0,15, as quatro responderam
`20000`. Prompt único, família `discovery`, no template de `deriveGeoPromptSet`:

> Quais são as melhores empresas de SEO em Guarulhos?

Dumps: `30-discovery-*.json`. Sinais contados: `31-summary-forma.json`. Texto
cru: `32-amostras.txt`. Reproduza com `probe-lista.mjs --offline`.

---

## 1. Não há uma forma. Há quatro.

| plataforma | forma | onde está o nome | itens |
|---|---|---|---|
| `chat_gpt` | bullet `- Nome — descrição ([host](url))` | antes do travessão ` — ` | 8 |
| `claude` | numerada `N. **Nome** - descrição`, sob heading `##` | dentro de `**…**` | 6 |
| `gemini` | bullet `*   **Nome:** descrição` | dentro de `**…**`, com `:` final | 11 |
| `perplexity` | prosa + **tabela markdown** | dentro de `**…**`, 1ª coluna da tabela | 6 |

**Um leitor só não serve.** `chat_gpt` não tem uma única linha numerada e usa
negrito **apenas** no bloco de raciocínio; `perplexity` não tem bullet nem
numeração — a lista dele é uma tabela. Um parser de "todos os bullets" acha 17
itens no ChatGPT e **zero** no Perplexity.

## 2. O bloco de raciocínio do ChatGPT: confirmado, e pior que o previsto

Os **únicos dois** trechos em negrito da resposta inteira do ChatGPT são:

```
**Searching for SEO companies**
**Compiling agency recommendations**
```

São títulos de chain-of-thought. Um parser baseado em negrito — que é o que
funciona para `claude`, `gemini` e `perplexity` — devolveria **exatamente esses
dois** como as empresas do ChatGPT, e nada mais. Zero silencioso outra vez, com
cara de resultado.

O separador existe e é confiável: o raciocínio vem **antes** da primeira linha
de corpo, e as duas seções são `sections[]` distintas no payload. Cortar pelo
índice da seção é mais firme que casar o texto.

## 3. A lista vem contaminada com o "como escolher"

Três das quatro emendam uma seção de conselho logo depois das empresas, na mesma
marcação:

- `chat_gpt` — 8 empresas, depois 4 bullets: *"Resultados comprovados:"*,
  *"Serviços incluídos:"*, *"Transparência e relatórios:"*, *"Contrato, prazos e
  metas:"*.
- `gemini` — 11 empresas, depois *"Experiência e Adaptabilidade:"*.
- `claude` — 6 empresas sob `## Empresas de SEO em Guarulhos:`, depois 4 bullets
  sob `## Como escolher:`. **Só o Claude separa por heading.**

Um parser ingênuo entrega "Transparência e relatórios" como concorrente do lead.

## 4. O achado que muda o desenho: a ordem não é ranking

O ChatGPT **declara a própria ordem**, no texto:

> Agências / consultorias encontradas em Guarulhos (**ordem alfabética**, com
> link de referência)

E é verdade — Agencia Green Digital, Buscalocal Pro, DIVIA, Hammer Web,
Marketing Central, Maxi Results, PUBLIMARK, Zuiqe. Alfabética, conferida.

As outras três **não declaram ordem nenhuma**:

- `claude` — *"Aqui estão algumas das principais"*
- `gemini` — *"Algumas das empresas … incluem"*
- `perplexity` — *"Algumas das melhores opções … que aparecem nos resultados"*

**Nenhuma das quatro afirma ordenar por qualidade.** Uma afirma explicitamente
que **não** ordena por qualidade.

Consequência direta: chamar a posição na lista de `#6` — como faz o artefato de
referência que motivou esta peça — **atribui ao número um significado que o
modelo não deu**. No ChatGPT, `#6` significaria "sexto em ordem alfabética".

É o mesmo defeito que a etapa já documenta em dois lugares: `position` tem
comentário dizendo que **não** é posição em lista numerada, e `dominance` vira
`null` em vez de afirmar 100% sobre um universo não medido.

## 5. Achado fora do escopo: `readLlmText` engole o raciocínio hoje

O separador da seção 2 é **campo tipado**, não texto: `items[].type` é
`"reasoning"` ou `"message"`. No dump do ChatGPT são 3 items — 2 de raciocínio,
1 de resposta.

`readLlmText`, em `geo-prompt-visibility.ts`, **não filtra por `type`**. Medido
neste dump:

```
readLlmText hoje (todos os items): 4.226 chars
só items type=message:             3.331 chars
diferença (texto de raciocínio):     895 chars
```

Esses 895 caracteres entram hoje no palheiro de `matchBrands`. Ou seja:
`mentioned`, `position` e `brands` **podem ser decididos pelo raciocínio privado
do modelo, não pela resposta que ele deu**.

Não disparou nas amostras que temos — o raciocínio medido não cita marca. Mas o
caminho é estrutural, e a família `brand` é onde ele morde: ali o prompt **é** o
nome da empresa, e raciocínio que repete o enunciado viraria `mentioned: true`
sobre uma resposta que nunca citou ninguém.

É bug de código já em produção, achado de raspão por este probe. Não é desta
spec — mas a correção é de uma linha, e o parser novo já vai precisar do filtro.

## 6. O que isto obriga

1. **Quatro leitores, um por plataforma**, atrás de uma superfície só. Não um
   leitor genérico com heurística.
2. **Filtrar `items[].type === "message"`** antes de qualquer casamento. Campo
   tipado, não heurística de texto.
3. **Cortar o rabo de conselho.** Sinais disponíveis: heading `##` (só Claude),
   item sem link de referência onde os outros têm (ChatGPT), item cujo nome
   termina em `:` e cuja frase é imperativa.
4. **A tela não pode chamar a posição de rank.** Ela é *ordem em que a marca
   apareceu na resposta*, e para o ChatGPT é ordem alfabética declarada.
5. **`perplexity` precisa de leitor de tabela markdown**, não de lista.
