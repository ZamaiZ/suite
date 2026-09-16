# Presença em IA — Repaginação e Matriz Prompt × LLM — Design

## Objetivo

Dar à etapa de Presença em IA o **vocabulário visual que as outras quatro já
têm**, e construir a peça que hoje não existe em lugar nenhum do produto: a
**matriz Prompt × LLM** — onde a marca aparece na resposta de cada modelo,
pergunta por pergunta.

A etapa já coleta o dado mais caro do pipeline (US$ 0,65 por lead, 32 respostas
de quatro plataformas). Ela o apresenta em lista cinza.

Esta spec é de **leitura mais um campo novo no snapshot**. Nenhum endpoint, teto,
prompt ou regra de gap muda.

## O que motivou

### A etapa é a única sem forma visual

Conferido em 2026-09-11, contando só o corpo das abas:

| | GBP | Website | Visibilidade | Presença digital | **IA** |
|---|---|---|---|---|---|
| componentes visuais dedicados | 3 | 4 | 3 | 1 | **0** |
| `StepMeter` no corpo | 3 | 6 | 1 | 1 | **0** |
| `Table` no corpo | 2 | — | 1 | — | **0** |
| `Tooltip` | 1 | 1 | 1 | — | **0** |
| motion (`<m.`) | ✅ | ✅ | ✅ | — | **0** |
| `StepCard` no corpo | — | — | — | — | **15** |
| listas `ul/li` cinza | — | — | — | — | **9** |

As outras quatro extraíram cada leitura difícil para arquivo próprio —
`LeadWebsiteVitalGauge`, `LeadWebsiteStackedBar`, `LeadVisibilityIndexAgeGauge`,
`LeadVisibilityKeywordsTable`, `LeadVisibilityRankedList`, `LeadGbpGridMap`,
`LeadGbpGridCompetitors`. A etapa de IA tem **814 linhas em um arquivo**
(`LeadGeoTabPanels.tsx`) com quatro abas e oito sub-cards dentro.

O efeito é que **o corpo inteiro da etapa vive na terceira camada de conteúdo**
(`text-muted-foreground`), sem nenhum gancho acima dela.

### Cinco listas que a lei do produto proíbe

`layout.md`: *"Comparação entre itens é linha ranqueada com barra proporcional.
Lista de `nome · N` em cinza não é comparada, é lida item a item."*

| lista | onde | itens |
|---|---|---|
| Por plataforma | `LeadGeoTabPanels.tsx:718` | 4 |
| Marcas citadas junto | `:776` | até 14 |
| Demanda de busca em IA | `:380` | até 12 |
| Fontes que a IA cita | `:505` | n |
| Quem a IA cita junto | `:570` | até 6 |

Nenhuma tem barra.

### A aba mais cara não tem manchete

`layout.md`: *"Cada big number é a manchete de uma aba, e clicar nele leva até
lá."* As cinco células de `LeadGeoMetricCells.tsx` apontam para `acesso`,
`citacoes`, `citacoes`, `conteudo`, `conteudo`. **Nenhuma aponta para
`sondagem`** — a coleta de US$ 0,65, com botão próprio, é a única aba sem
manchete no cabeçalho.

### A matriz do artefato de referência não é construível hoje

O que a sondagem guarda por execução é `brands: Array<{name, position}>`, e
`brands` só contém nomes que estavam na **lista de casamento**:
`brandVariants(empresa)` mais os concorrentes lidos de
`lead_gbp_rank_checks.competitors` (`probe-geo-prompts.ts:126`) — ou seja, da
checagem de posição no Maps, que é de **outra etapa**. Lead que nunca rodou
aquela checagem tem `competitorBrands` vazio; o próprio módulo documenta o bug
que isso causou (`dominance: 1`, participação de 100% sobre um universo de uma
marca).

O texto cru da resposta é lido por `readLlmText` e **descartado** em
`buildGeoPromptRun`.

Consequência: no caso comum, uma célula da matriz teria **um nome — o do próprio
lead**. E o `#6` do artefato de referência é posição em lista numerada, enquanto
o nosso `position` é, com todas as letras na documentação do campo, *"ordem de
ocorrência entre as marcas detectadas — não é posição em lista numerada"*.

### Não existe medição do formato que o extrator precisa ler

As sete evidências de `llm_responses` em
`docs/auditoria/evidencias/2026-09-10-presenca-em-ia/` são **todas do mesmo
prompt da família `brand`** — *"A agência X é confiável?"* —, que devolve prosa.
Nenhuma é de `discovery` ou `comparison`, que é a família que produz a lista
ranqueada.

Escrever o parser sem medir seria supor a forma do payload. É a decisão que já
custou duas vezes nesta etapa — o caminho de `annotations` e o filtro de
backlinks —, e as duas estão registradas em comentário no código como coisa a
não repetir.

## Decisões aprovadas

- **Portão de medição antes de qualquer código.** Um probe descartável, uma
  pergunta de `discovery` × 4 plataformas, ≈ US$ 0,08.
- **`lib/leads/geo-answer-list.ts`** — leitor determinístico da lista ordenada.
  Parsing puro; **nada é perguntado a modelo**.
- **Dois campos novos em `GeoPromptRun`**, porque são dois números diferentes:
  `answerList` e `listRank`. O `position` atual **não muda e não é
  reaproveitado**.
- **Matriz é tabela cujas células são mini-leaderboards** — não heatmap.
- **Três estados por célula**, nunca dois: citou `Nª de M` · rodou e não citou ·
  não rodou.
- **↻ medido 2026-09-11 — o chip é ordem de aparição, em tom neutro.** Não é
  rank e não ganha faixa de cor. Ver `docs/auditoria/evidencias/2026-09-11-lista-ordenada/README.md`.
- **As cinco listas viram `LeadVisibilityRankedList`.**
- **Sexta célula na faixa: Sondagem.**
- **Faixa de quatro plataformas na aba Acesso**, com três estados.
- **Quebra do arquivo de 814 linhas** no desenho das outras quatro etapas.

## Fora de escopo

- **O PDF do cliente.** A matriz é tela de analista. `diagnosis-pdf.tsx` não é
  tocado.
- **Migração forçada de snapshot.** Snapshot sem `answerList` continua abrindo; a
  célula cai para `brands` e a tela declara isso. Quem quiser a lista cheia clica
  em **Sondar de novo**, que já existe.
- **Qualquer mudança de coleta.** Prompt set, modelos, tetos, custo e catálogo de
  gaps ficam como estão. O único acréscimo é o campo no snapshot.
- **Tendência e sparkline.** Um snapshot por coleta; série de n=1 é decoração.
- **Rampa `chart-*` na matriz.** Rank tem limiar, não gradiente — sequencial
  inventaria precisão que o dado não tem.
- **Paleta categórica nova para as quatro plataformas.** Cor só por token
  semântico; plataforma é identidade de coluna, e coluna já é identidade.
- **Afirmar causa entre robô bloqueado e não-citação.** Ninguém mediu isso. Dois
  fatos vizinhos, nunca uma seta entre eles.

## Arquitetura

### O portão de medição

`docs/auditoria/evidencias/2026-09-11-lista-ordenada/probe-lista.mjs`, no padrão
dos `probe-pago-*.mjs` que já estão lá: teto de custo por argumento, dumps em
disco, e `--offline` para re-derivar o veredito sem pagar de novo.

Três perguntas, e o código só nasce depois das respostas:

1. A lista vem numerada (`1. Nome`), em bullet, em negrito, ou em prosa corrida?
2. O bloco de raciocínio do ChatGPT é separável do corpo da resposta? Medido em
   2026-09-11, ele **está** dentro do mesmo `sections[].text` que `readLlmText`
   concatena — `**Assessing trustworthiness**` seguido de cinco linhas de
   raciocínio. Um parser ingênuo leria aquele título como empresa.
3. As quatro plataformas concordam o bastante para um leitor só, ou são quatro?

O dump vira fixture em `lib/leads/geo-answer-list.fixture.json`, como
`geo-ai.fixture.json` já faz.

### `geo-answer-list.ts`

```ts
export type GeoAnswerEntry = { name: string; rank: number }

/**
 * A lista ordenada que o modelo escreveu. Determinístico.
 *
 * `rank` é **ordem de aparição**, nunca ranking de qualidade. A plataforma é
 * parâmetro porque são quatro formas, não uma — ver a tabela abaixo.
 */
export function readAnswerList(
  result: unknown,
  platform: string,
): GeoAnswerEntry[]

/** Onde o lead caiu nela. `null` = não está na lista. */
export function rankOfBrand(
  list: readonly GeoAnswerEntry[],
  brands: readonly string[],
): number | null
```

O casamento de nome reusa `fold` de `geo-prompt-visibility.ts` — sem acento e sem
caixa, que é o que faz "Agência Mestre" e "agencia mestre" serem a mesma.

**↻ medido 2026-09-11 — são quatro leitores, não um.** A spec supunha uma forma
com variações. São quatro formas distintas, e uma delas não é lista:

| plataforma | forma | onde está o nome | itens medidos |
|---|---|---|---|
| `chat_gpt` | bullet `- Nome — descrição ([host](url))` | antes do travessão | 8 |
| `claude` | numerada `N. **Nome** - …`, sob heading `##` | dentro de `**…**` | 6 |
| `gemini` | bullet `*   **Nome:** …` | dentro de `**…**`, com `:` | 11 |
| `perplexity` | prosa + **tabela markdown** | 1ª coluna da tabela | 6 |

Um leitor genérico acha 17 itens no ChatGPT e **zero** no Perplexity. Cada
plataforma ganha seu leitor, atrás de uma superfície só.

**O corte do raciocínio é campo tipado.** `items[].type` é `"reasoning"` ou
`"message"` — não é casamento de texto. E `readLlmText` **não filtra hoje**: 895
dos 4.226 caracteres lidos do ChatGPT são raciocínio privado do modelo, que
entra no palheiro de `matchBrands`. Bug de produção achado por este probe, e
**corrigido junto** nesta entrega, no mesmo filtro que o parser novo precisa.

**Três das quatro emendam "como escolher" na mesma marcação.** O rabo de
conselho é cortado por heading (Claude), por ausência do link de referência que
os itens de empresa têm (ChatGPT), e por frase imperativa (Gemini).

### Os dois números, e por que são dois

| campo | o que é | de onde vem |
|---|---|---|
| `position` | ordem entre as **marcas detectadas** na lista de casamento | já existe, não muda |
| `listRank` | posição do lead **na lista que o modelo escreveu** | novo |

São leituras diferentes do mesmo texto, e `layout.md` é explícito: *"Duas
leituras da mesma métrica são dois marcadores, não uma frase."* Colapsá-las num
número só apagaria justamente a ressalva que a tela hoje imprime embaixo do big
number.

`GeoPromptRun` ganha:

```ts
/** `null` = sondagem anterior a este campo. Lista vazia seria afirmação. */
answerList: GeoAnswerEntry[] | null
/** `null` = não detectado na lista, ou lista não lida. */
listRank: number | null
```

`readGeoPromptVisibility` normaliza ausência para `null`, como já faz com o
resto. Nenhum snapshot existente quebra.

### A matriz

8 prompts × 4 plataformas, mais uma coluna de fechamento.

```
                           CHATGPT     CLAUDE      GEMINI      PERPLEX.
PERGUNTA                   alfabetica                                      4 IAs
---------------------------------------------------------------------------------
[Descoberta]               6a de 8 (*) 5a de 6     4a de 11    3a de 6      4 / 4
Melhores empresas de ...   1 Green D.  1 Sinalize  1 Publinet  1 Webclick   ####
                           2 Buscalo.  2 4UP       2 Leggoo    2 RTAG
---------------------------------------------------------------------------------
[Marca]                    nao citou   1a de 3     nao rodou   2a de 5      2 / 4
O que voce sabe sobre ...                                                   ##..

(*) o site aparece entre as fontes da resposta
"alfabetica" e nota permanente da coluna: o ChatGPT declara essa ordem no texto
```

**Três estados, e o terceiro é o motivo da etapa existir.** `status !== "ok"` é
"não rodou", com o `statusMessage` no `Tooltip` — nunca ausência. O artefato de
referência colapsa "não citou" e "não rodou" no mesmo ✗ vermelho; nós não
podemos, porque `provider_unavailable` e `rejected` estão fora do denominador de
propósito e custam zero, então o erro não apareceria nem na conta.

**↻ medido 2026-09-11 — o chip é ordem de aparição, em tom neutro.**

A versão anterior desta spec mandava usar `positionTone` — top 3 `success`, top
10 `warning`. **A medição desautorizou.** O ChatGPT declara no próprio texto que
sua lista está em *"ordem alfabética"*, e é verdade; as outras três não declaram
ordem nenhuma. **Nenhuma das quatro afirma ordenar por qualidade.**

Faixa de cor sobre esse número pintaria de `success` quem tem nome começando com
A. O chip mostra `6ª de 8`, em tom neutro, e o rótulo diz **ordem de aparição na
resposta** — nunca "rank". A coluna do ChatGPT carrega a nota de ordem
alfabética, do mesmo jeito que a do Gemini já carrega "sem recorte de cidade".

É a terceira vez que esta etapa recusa um número lisonjeiro por não ter universo
que o sustente — as outras duas são o comentário de `position` e o `dominance:
null`.

`positionTone` **continua** valendo para posição em SERP e no Maps, onde a faixa
é real. Ela só não atravessa para cá.

**Marcador próprio para `domainCited`** — o site apareceu entre as `annotations`
daquela resposta. Determinístico, e é dado que o artefato de referência não tem.

**Sobrancelha de família por linha** — Descoberta · Problema · Comparação ·
Marca, de `GEO_PROMPT_FAMILY_LABELS`. Passa o critério da sobrancelha em
`layout.md`: a família carrega informação que o texto do prompt não carrega —
separa "a IA não te conhece" (família `brand`) de "a IA não te recomenda"
(família `discovery`).

**Coluna de fechamento** com `StepMeter`: citou em N de 4. Fração legítima —
cheio é bom.

**`ToggleGroup` compacto ⇄ completo** — só os chips, ou chips mais a lista. Quem
apresenta quer a grade; quem audita quer os nomes. `Toggle` filtra e
`ToggleGroup` escolhe, que é o papel certo de cada primitive.

**Primeira coluna grudada, `overflow-x-auto` no contêiner.** A página nunca rola
na horizontal.

**Rodapé de procedência**, sempre visível: a lista é o que o modelo escreveu
naquela execução, e a mesma pergunta devolve resposta diferente entre execuções.
A ressalva que a tela já imprime hoje continua, agora presa à peça que ela
qualifica.

### O controller precisa entregar o `promptSet`

`use-geo-controller.ts:329` já monta `promptSet` para calcular `probeRuns`, mas
**não o devolve**. Sem ele a matriz não tem o texto da pergunta. Uma linha no
`return`.

### A faixa de plataformas na aba Acesso

Os doze agentes de `AI_USER_AGENTS` (`lib/website-audit/robots.ts:9`) mapeiam nas
quatro plataformas sondadas:

| plataforma | agentes |
|---|---|
| ChatGPT | `gptbot`, `chatgpt-user`, `oai-searchbot` |
| Claude | `claudebot`, `claude-web` |
| Gemini | `google-extended` |
| Perplexity | `perplexitybot` |

Os outros cinco — `ccbot`, `bytespider`, `applebot-extended`,
`meta-externalagent`, `amazonbot` — ficam num agrupamento "outros".

**Três estados, e o terceiro hoje não existe na tela:** liberado · bloqueado ·
**não declarado**. `aiAgentsFromGroups` só devolve agente explicitamente
declarado no robots, então "não declarado" é liberado por omissão — informação
diferente de "liberado por regra". Hoje a aba mostra só os bloqueados como
`Badge`, e os outros dois estados somem no mesmo silêncio.

A faixa usa os mesmos quatro rótulos e a mesma ordem da matriz. Dois fatos
vizinhos; a seta entre eles não é desenhada.

### As cinco listas ranqueadas

`LeadVisibilityRankedList` já existe, já respeita `useReducedMotion` e já
normaliza pelo líder — que é a base certa quando a pergunta é "quem domina".
Nenhum componente novo:

| lista | tom | nota |
|---|---|---|
| Por plataforma | `primary` | taxa de menção; o aviso do Gemini sem recorte de cidade vira `note` da linha |
| Marcas citadas junto | `primary`, lead em destaque | como `LeadGbpGridCompetitors` faz |
| Demanda em IA | `primary` | `0` é medida, não ausência — a linha continua dizendo "sem busca em IA" |
| Fontes que a IA cita | `primary` | `isAuthority` vira `note` |
| Quem a IA cita junto | lead em `primary`, resto `neutral` | o universo continua no rodapé |

## Arquivos previstos

**Criar**

| arquivo | responsabilidade |
|---|---|
| `docs/auditoria/evidencias/2026-09-11-lista-ordenada/probe-lista.mjs` | o portão de medição, descartável |
| `lib/leads/geo-answer-list.ts` | leitor determinístico da lista ordenada |
| `lib/leads/geo-answer-list.fixture.json` | recorte do payload medido |
| `lib/leads/geo-answer-list.test.mjs` | casos do fixture, um por plataforma |
| `components/custom/LeadGeoPanel/LeadGeoPromptMatrix.tsx` | a matriz |
| `components/custom/LeadGeoPanel/LeadGeoCrawlerStrip.tsx` | a faixa de quatro plataformas |
| `components/custom/LeadGeoPanel/LeadGeoAccessBoard.tsx` | aba Acesso |
| `components/custom/LeadGeoPanel/LeadGeoContentChecks.tsx` | aba Conteúdo |
| `components/custom/LeadGeoPanel/LeadGeoDemandCard.tsx` | demanda em IA |
| `components/custom/LeadGeoPanel/LeadGeoSourcesCard.tsx` | fontes e citações |
| `components/custom/LeadGeoPanel/LeadGeoBrandLeaderboard.tsx` | marcas citadas junto |

**Modificar**

| arquivo | mudança |
|---|---|
| `lib/leads/geo-audit.ts` | `answerList` e `listRank` em `GeoPromptRun`; leitura tolerante |
| `lib/leads/geo-prompt-visibility.ts` | `buildGeoPromptRun` preenche os dois campos |
| `components/custom/LeadGeoPanel/use-geo-controller.ts` | devolve `promptSet` |
| `components/custom/LeadGeoPanel/LeadGeoMetricCells.tsx` | sexta célula, Sondagem |
| `components/custom/LeadGeoPanel/LeadGeoHeader.tsx` | grid da faixa passa a 6 colunas em `xl` |
| `components/custom/LeadGeoPanel/LeadGeoTabPanels.tsx` | vira o roteador das quatro abas |
| `.claude/skills/suite-frontend/references/components.md` e `layout.md` | a matriz entra em Formas de medida; a etapa entra na lista do arquétipo |

## Critérios de aceitação

1. O probe rodou, o dump está em `docs/auditoria/evidencias/`, e o fixture do
   parser é recorte dele — não texto inventado.
2. O parser lê as quatro plataformas do fixture e **não** confunde o bloco de
   raciocínio do ChatGPT com nome de empresa.
3. A matriz mostra os três estados por célula, e "não rodou" traz o
   `statusMessage` no `Tooltip`.
4. Um snapshot **sem** `answerList` abre sem quebrar, cai para `brands` e a tela
   declara a procedência da leitura.
5. Lead sem concorrente na lista de casamento continua **sem** afirmar
   dominância — a regra do `dominance: null` não é contornada pela matriz.
6. A sexta célula da faixa aparece, e clicar nela leva à aba Sondagem.
7. A faixa de plataformas distingue liberado, bloqueado e não declarado; crawl
   antigo mantém os três em `—`.
8. As cinco listas têm barra, e nenhuma barra é renderizada onde não há
   denominador.
9. A matriz rola no próprio contêiner com a primeira coluna grudada; a página
   nunca rola na horizontal.
10. `pnpm test`, `pnpm lint` e `pnpm exec tsc --noEmit` limpos; os greps de
    `checks.md` no baseline de 2026-09-10. O `test` já varre `lib/**/*.test.mjs`,
    então o teste do parser entra sozinho.
11. Foco visível, `aria-label` em todo controle só de ícone, estado nunca só por
    cor, `prefers-reduced-motion` respeitado.

## Autocrítica

**O que foi cortado:** o gráfico de evolução da taxa de menção entre sondagens, o
mapa de calor com rampa sequencial na matriz, e a coluna de custo por execução
(`costUsd` existe por run e não é renderizado).

**Por quê:** a série temporal não existe — há um snapshot por coleta e nenhuma
cadência garantida; um gráfico sobre n=1 é decoração com cara de análise. A rampa
sequencial mentiria sobre um rank que tem limiar, e o produto já fixou a paleta
de estado para exatamente essa pergunta. O custo por execução é real e
interessante, mas a conta que importa já aparece **antes do clique**, no rótulo
do botão — repeti-la depois, linha a linha, não muda nenhuma decisão do analista
e acrescenta uma coluna à peça que mais precisa de espaço.
