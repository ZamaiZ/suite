# Presença em IA — Repaginação e Matriz Prompt × LLM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar à etapa de Presença em IA o vocabulário visual das outras quatro e construir a matriz Prompt × LLM — onde a marca aparece na resposta de cada modelo, pergunta por pergunta.

**Architecture:** Duas trilhas. A **visual** não depende de dado novo: quebra o arquivo de 814 linhas em módulos, troca cinco listas cinza por linha ranqueada, acrescenta a sexta célula da faixa e a faixa de plataformas na aba Acesso. A **de dado** começa por um probe pago de US$ 0,08, porque a forma da lista ordenada que a matriz precisa ler **nunca foi medida** — as sete evidências de `llm_responses` no repo são todas do mesmo prompt da família `brand`, que devolve prosa. Só depois do dump em disco nascem `geo-answer-list.ts`, os dois campos novos no snapshot e a matriz.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind v4 com tokens em `app/globals.css`, shadcn base-mira sobre Base UI, `motion/react-m`, `node --test` com type-stripping do Node 22.

**Spec:** `docs/superpowers/specs/2026-09-11-presenca-em-ia-repaginacao-design.md`

**Precedentes obrigatórios:**
- `.claude/skills/suite-frontend/` — **invoque a skill antes de tocar em qualquer tela.** `layout.md` tem as Formas de medida que este plano obedece; `tokens.md` tem a cor; `checks.md` tem o baseline.
- `docs/superpowers/plans/2026-09-10-visibilidade-repaginacao.md` — a repaginação irmã, que criou `LeadVisibilityRankedList` e `StepCard`.
- `docs/superpowers/plans/2026-09-11-presenca-em-ia-ondas-2-3.md` — a onda que construiu a sondagem que esta lê.
- `docs/auditoria/evidencias/2026-09-10-presenca-em-ia/probe-pago-3.mjs` — o molde do probe da Task 1: teto de custo por argumento, dump em disco, `--offline`.

---

## Global Constraints

- **Leia `node_modules/next/dist/docs/` antes de escrever código de Next.** Esta versão tem breaking changes (`AGENTS.md` na raiz).
- **O `git` é do dono do repo.** Os `**Commit:**` marcam a fronteira de uma entrega revisável; **não execute `git commit`** — pare, avise, e deixe o commit para ele.
- **Verificação só no fim, uma vez.** **Não rode `pnpm test`, `pnpm lint` nem `pnpm exec tsc --noEmit` entre tarefas.** O `.test.mjs` da Task 6 é documentação do formato esperado, escrito junto com o módulo e executado uma vez só, na Task 9.
- **Nunca use `pnpm build`.** `tsc --noEmit` é o mesmo type-check sem o custo do build.
- **Nada de subagentes de busca neste repo.** Ler e buscar direto.
- **A árvore é compartilhada com outra sessão.** Antes de chamar um erro de seu, confira se o arquivo que falhou está entre os que você tocou.
- **Módulos de `lib/leads/` são puros e importam com extensão `.ts`.** **Não adicione `server-only` a nenhum deles** — as regras de gap rodam em componente de cliente.
- **O leitor tolera o passado, o escritor só produz o presente.**
- **`null` é "não coletado"; `[]` é "coletado e vazio".** Ausência na tela é `—`, nunca zero.
- **Copy de interface em pt-BR**, por `references/writing.md`.
- **`cn` importado de `"cn"`**, nunca de `@/lib/utils`. Ícone só de `react-icons/ri`. `m.*` de `motion/react-m`, nunca `motion.*`. Cor só por token semântico. Altura de controle vem de `size`.
- **Ambiente Git Bash no Windows:** `grep -P` não funciona; use `grep -E`. `bc` não existe.

### Constraints próprias deste plano

- **A forma do payload vem da evidência, nunca da documentação.** Esta etapa já errou duas vezes por ler pela doc — o caminho de `annotations` e o filtro de backlinks —, e as duas produziram **zero silencioso** em vez de erro. Quando doc e dump discordarem, o dump ganha, e o desvio vira comentário citando o arquivo.
- **A LLM é objeto de medição, nunca instrumento de análise.** O extrator é parsing determinístico. Nada aqui pergunta nada a modelo.
- **`position` não é `listRank`.** São dois números, com duas definições, e nenhum substitui o outro. Colapsá-los apaga a ressalva que a tela imprime hoje.
- **Execução que não rodou não é ausência.** `provider_unavailable` e `rejected` custam zero e ficam fora do denominador. A célula tem **três** estados, não dois.
- **Nenhuma regra de gap muda.** O catálogo de `geo-audit.ts` fica como está.

---

## File Structure

| arquivo | responsabilidade |
|---|---|
| `docs/auditoria/evidencias/2026-09-11-lista-ordenada/probe-lista.mjs` | **Criar** — o portão de medição, descartável |
| `lib/leads/geo-answer-list.ts` | **Criar** — puro, leitor determinístico da lista ordenada |
| `lib/leads/geo-answer-list.fixture.json` | **Criar** — recorte do payload medido |
| `lib/leads/geo-answer-list.test.mjs` | **Criar** — um caso por plataforma |
| `lib/leads/geo-audit.ts` | **Modificar** — `answerList` e `listRank` em `GeoPromptRun` |
| `lib/leads/geo-prompt-visibility.ts` | **Modificar** — `buildGeoPromptRun` preenche os dois |
| `components/custom/LeadGeoPanel/LeadGeoPromptMatrix.tsx` | **Criar** — a matriz |
| `components/custom/LeadGeoPanel/LeadGeoCrawlerStrip.tsx` | **Criar** — a faixa de quatro plataformas |
| `components/custom/LeadGeoPanel/LeadGeoAccessBoard.tsx` | **Criar** — aba Acesso |
| `components/custom/LeadGeoPanel/LeadGeoContentChecks.tsx` | **Criar** — aba Conteúdo |
| `components/custom/LeadGeoPanel/LeadGeoDemandCard.tsx` | **Criar** — demanda em IA |
| `components/custom/LeadGeoPanel/LeadGeoSourcesCard.tsx` | **Criar** — fontes e citações |
| `components/custom/LeadGeoPanel/LeadGeoBrandLeaderboard.tsx` | **Criar** — marcas citadas junto |
| `components/custom/LeadGeoPanel/LeadGeoTabPanels.tsx` | **Modificar** — de 814 linhas a roteador das quatro abas |
| `components/custom/LeadGeoPanel/use-geo-controller.ts` | **Modificar** — devolve `promptSet` |
| `components/custom/LeadGeoPanel/LeadGeoMetricCells.tsx` | **Modificar** — sexta célula |
| `components/custom/LeadGeoPanel/LeadGeoHeader.tsx` | **Modificar** — grid da faixa a 6 colunas em `xl` |
| `.claude/skills/suite-frontend/references/{components,layout}.md` | **Modificar** — no mesmo commit da tela |

---

# Trilha de dado

## Task 1: O portão de medição

**Não escreva uma linha do parser antes desta task voltar com dump em disco.**

- [ ] Criar `docs/auditoria/evidencias/2026-09-11-lista-ordenada/probe-lista.mjs`, no molde de `probe-pago-3.mjs`: lê `.env.local` do root, teto de custo por `process.argv`, dumps com `writeFileSync`, e `--offline` para re-derivar o veredito dos dumps sem pagar de novo.
- [ ] **Uma** pergunta da família `discovery`, nas quatro plataformas, com os mesmos modelos de `GEO_PROMPT_MODELS`. Teto `0.15`. Custo esperado ≈ US$ 0,08.
- [ ] Use um lead com segmento e cidade reais — prompt genérico mede o mercado, não o lead. `deriveGeoPromptSet` mostra a forma exata da frase.
- [ ] Salvar um arquivo por plataforma: `30-discovery-chat_gpt.json`, `-claude`, `-gemini`, `-perplexity`.
- [ ] Com os dumps em mão, responder as três perguntas **por escrito**, num `README.md` ao lado:
  1. A lista vem numerada (`1. Nome`), em bullet (`- **Nome**`), em negrito solto, ou em prosa corrida? Por plataforma.
  2. O bloco de raciocínio do ChatGPT é separável? Medido em 2026-09-11 em `20-llm_responses-chat_gpt.json`, ele **está** dentro do mesmo `sections[].text` que `readLlmText` concatena: `**Assessing trustworthiness**` seguido de cinco linhas. **Um parser ingênuo leria aquele título como nome de empresa.** Achar o separador é entregável desta task.
  3. As quatro concordam o bastante para um leitor só, ou são quatro leitores?
- [ ] Recortar os dumps em `lib/leads/geo-answer-list.fixture.json`, no molde de `geo-ai.fixture.json` — com o campo `_origem` apontando para a pasta de evidência.

**Commit:** `docs(auditoria): forma da lista ordenada nas quatro plataformas`

## Task 2: `geo-answer-list.ts`

Puro. Sem `server-only`. Importa com extensão `.ts`.

**↻ A Task 1 rodou. A forma está medida, e são quatro — não uma.** Leia
`docs/auditoria/evidencias/2026-09-11-lista-ordenada/README.md` antes de começar.

| plataforma | forma | onde está o nome | itens medidos |
|---|---|---|---|
| `chat_gpt` | bullet `- Nome — descrição ([host](url))` | antes do travessão ` — ` | 8 |
| `claude` | numerada `N. **Nome** - …`, sob heading `##` | dentro de `**…**` | 6 |
| `gemini` | bullet `*   **Nome:** …` | dentro de `**…**`, com `:` final | 11 |
| `perplexity` | prosa + **tabela markdown** | 1ª coluna da tabela | 6 |

Um leitor genérico acha 17 itens no ChatGPT e **zero** no Perplexity. São quatro
leitores atrás de uma superfície só — `readAnswerList` despacha por plataforma.

- [ ] Criar `lib/leads/geo-answer-list.ts` com exatamente esta superfície:

```ts
export type GeoAnswerEntry = { name: string; rank: number }

/**
 * A lista ordenada que o modelo escreveu. Determinístico.
 *
 * `rank` é **ordem de aparição**, nunca ranking de qualidade — o ChatGPT
 * declara a dele como alfabética, e as outras três não declaram nada.
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

- [ ] **`readAnswerList` recebe a plataforma** e despacha para o leitor dela. Sem o parâmetro não há como escolher entre quatro formas, e uma heurística que tentasse adivinhar erraria no Perplexity, que não tem lista.
- [ ] Percorre `items[].sections[].text` — **o mesmo caminho de `readLlmText`**, não o da documentação. O comentário de `readLlmAnnotations` explica o erro que isso já causou.
- [ ] **Filtrar `items[].type === "message"`.** Campo tipado, medido: o ChatGPT devolve 3 items, 2 de `reasoning` e 1 de `message`. Os *únicos dois* trechos em negrito da resposta inteira estão no raciocínio — um leitor por negrito devolveria `Searching for SEO companies` e `Compiling agency recommendations` como as empresas.
- [ ] **Cortar o rabo de "como escolher".** Três das quatro emendam conselho na mesma marcação. Sinais medidos: heading `##` (só o Claude separa), ausência do link de referência que os itens de empresa têm (ChatGPT), nome terminando em `:` seguido de frase imperativa (Gemini). Sem o corte, "Transparência e relatórios" entra como concorrente do lead.
- [ ] **Limpar marcador de citação do nome.** Perplexity sufixa `[1][2]` (medido em `20-llm_responses-perplexity.json`); ChatGPT sufixa `([host](url))`. Nome com marcador não casa com a marca do lead e produz falso negativo — que na tela vira "as IAs não reconhecem a marca".
- [ ] `rank` é 1-based e **é a ordem na lista escrita**, não a ordem entre marcas detectadas.
- [ ] `rankOfBrand` reusa a dobra de `geo-prompt-visibility.ts` — sem acento e sem caixa, que é o que faz "Agência Mestre" e "agencia mestre" serem a mesma. **Exporte `fold` de lá** em vez de duplicar a função; duas dobras divergem na primeira mudança.
- [ ] **Corrigir `readLlmText` no mesmo filtro.** Ele não filtra `type` hoje: dos 4.226 caracteres lidos do ChatGPT, **895 são raciocínio privado do modelo**, e entram no palheiro de `matchBrands`. Bug de produção, achado de raspão pela Task 1. Forward-only — snapshot já gravado mantém o valor. Comentário citando `evidencias/2026-09-11-lista-ordenada/README.md`, seção 5.
- [ ] Criar `lib/leads/geo-answer-list.test.mjs`, lendo de `geo-answer-list.fixture.json`, com no mínimo:
  - **um caso por plataforma**, conferindo o total e o primeiro nome. Os números medidos são `chat_gpt` 8, `claude` 6, `gemini` 11, `perplexity` 6 — e os primeiros nomes, `Agencia Green Digital`, `SinalizeWeb`, `Publinet Marketing Digital`, `Webclick`;
  - **o caso do raciocínio**: a lista do ChatGPT **não** contém `Searching for SEO companies` nem `Compiling agency recommendations`;
  - **o caso do conselho**: a lista do ChatGPT não contém `Transparência e relatórios`, e a do Gemini não contém `Experiência e Adaptabilidade`;
  - **o caso do marcador**: nenhum nome do Perplexity volta com `[3]` colado;
  - **o caso da tabela**: o Perplexity devolve 6 e não 0 — ele não tem bullet nem numeração;
  - `readAnswerList(null, "claude")` e `readAnswerList({}, "claude")` devolvem `[]`, nunca lançam;
  - `rankOfBrand([], ["X"])` devolve `null`;
  - `rankOfBrand` casa com acento diferente e caixa diferente.
- [ ] **Não rode o teste ainda.** Task 9.

## Task 3: Os dois campos no snapshot

- [ ] Em `lib/leads/geo-audit.ts`, acrescentar a `GeoPromptRun`:

```ts
/** `null` = sondagem anterior a este campo. Lista vazia seria afirmação. */
answerList: GeoAnswerEntry[] | null
/** Posição do lead na lista que o modelo escreveu. `null` = não detectado. */
listRank: number | null
```

- [ ] **Não toque em `position`.** Ele continua sendo "ordem entre as marcas detectadas", com o comentário que já está lá.
- [ ] Em `readGeoPromptVisibility`, ler os dois com tolerância: ausente vira `null`, array malformado vira `null`, entrada sem `name` ou sem `rank` numérico é descartada. **Snapshot v1 não pode quebrar.**
- [ ] Em `lib/leads/geo-prompt-visibility.ts`, `buildGeoPromptRun` passa a preencher os dois no ramo `status === "ok"`:

```ts
// `input.provider` já chega em `buildGeoPromptRun` — é o que escolhe o leitor.
const answerList = readAnswerList(input.result, input.provider)
// ...
answerList,
listRank: rankOfBrand(answerList, input.leadBrands),
```

- [ ] No ramo `status !== "ok"`, os dois saem `null` — a execução que não aconteceu não afirma nada. É a mesma razão pela qual `mentioned` já é `false` e `position` já é `null` ali.
- [ ] **Nenhuma métrica agregada muda.** `mentionRate`, `averagePosition`, `dominance`, `byProvider` e `competitors` continuam contando o que contavam. `listRank` é leitura de célula, não entra em média nesta entrega.
- [ ] Acrescentar ao `geo-ai.test.mjs` existente um caso de snapshot v1 (sem os campos) abrindo com os dois em `null`.

**Commit:** `feat(geo): lista ordenada da resposta no snapshot da sondagem`

---

# Trilha visual

## Task 4: A quebra do arquivo de 814 linhas

Refatoração de local, **sem uma única mudança de aparência**. Vai primeiro para que as tasks seguintes caiam em arquivos pequenos.

- [ ] `LeadGeoTabPanels.tsx` fica só com os quatro `export function LeadGeoTab*` e o `NoCollection`. Tudo que é card sai para arquivo próprio.
- [ ] Mover, sem editar o corpo: `GeoDemandCard` → `LeadGeoDemandCard.tsx`; `GeoMentionsCard` + `GeoPromptsCard` → `LeadGeoSourcesCard.tsx`; os dois `StepCard` da aba Acesso → `LeadGeoAccessBoard.tsx`; os dois da aba Conteúdo → `LeadGeoContentChecks.tsx`; o `StepCard` "Marcas citadas junto" da aba Sondagem → `LeadGeoBrandLeaderboard.tsx`.
- [ ] **"Marcas citadas junto" e "Quem a IA cita junto" são coisas diferentes e vão para arquivos diferentes.** A primeira lê `promptVisibility.metrics.competitors` — quem apareceu nas respostas da **sondagem**. A segunda lê `aiMentions.targets` — quem aparece no índice de menções, que é outra coleta e outro universo. Juntá-las num arquivo seria o primeiro passo para juntá-las numa tela.
- [ ] `CheckRow` e o tipo `CheckState` vão para `LeadGeoAccessBoard.tsx` e são exportados de lá — a aba Conteúdo os consome. **Não duplique**: as duas abas têm que concordar sobre o que `unknown` significa, e é a razão de o tipo existir.
- [ ] `PROVIDER_LABELS` e `pct` saem para o topo de `LeadGeoPromptMatrix.tsx` (Task 8) e são importados de lá pelas outras. Enquanto a matriz não existe, deixe-os em `LeadGeoTabPanels.tsx` e mova na Task 8 — mover duas vezes é pior que mover tarde.
- [ ] Conferir a olho que nenhuma classe mudou. Esta task é `git mv` de funções.

**Commit:** `refactor(geo): quebra o painel de abas em módulos`

## Task 5: As cinco listas ranqueadas

**Invoque a skill `suite-frontend` antes.** `LeadVisibilityRankedList` já existe, já respeita `useReducedMotion`, já normaliza pelo líder e já é o que `layout.md` manda usar aqui. **Nenhum componente novo.**

Importe de `@/components/custom/LeadVisibilityPanel/LeadVisibilityRankedList`. A forma da linha é `RankedRow = { id, label, title, value, note?, tone? }`.

- [ ] **Por plataforma** (`LeadGeoTabPanels.tsx:718`, hoje `ul/li`): `value` é `mentionRate`, `formatValue` é `pct`, `note` é a ordem média. O aviso do Gemini — *"sem recorte de cidade"* — continua na `label`, porque comparar a coluna dele com as outras sem dizer isso compara coisas diferentes.
- [ ] **Marcas citadas junto** (`:776`): `value` é `mentionRate`. O lead em `text-primary font-medium` na `label`, como `GeoMentionsCard` já faz. O rodapé de dominância **fica como está** — inclusive a frase do caso `null`.
- [ ] **Demanda em IA** (`LeadGeoDemandCard.tsx` após a Task 4): `value` é `aiSearchVolume`. **`0` é medida, não ausência**: a linha continua dizendo "sem busca em IA" e a barra fica vazia, não escondida. `null` continua `—` e **sem barra** — trilha sem escala mente pior que trilha ausente.
- [ ] **Fontes que a IA cita** (`:505`): `value` é `mentions`, `note` é "fonte que a IA prefere" quando `isAuthority`. O aviso de `truncated` fica.
- [ ] **Quem a IA cita junto** (`:570`): lead em `primary`, resto `neutral`. O universo continua no rodapé — *"Não é participação de mercado"* é a única coisa que separa este número de propaganda.
- [ ] Onde o denominador não existe, **não renderize barra.**

**Commit:** `feat(geo): comparação em linha ranqueada nas cinco listas`

## Task 6: A sexta célula e o grid da faixa

- [ ] Em `LeadGeoMetricCells.tsx`, acrescentar a célula que falta — hoje as cinco apontam para `acesso`, `citacoes`, `citacoes`, `conteudo`, `conteudo`, e **nenhuma para `sondagem`**, que é a coleta de US$ 0,65.
- [ ] O componente hoje só desestrutura `const { snapshot, progress } = controller`. Acrescente, ao lado das outras leituras locais:

```tsx
const probe = snapshot?.promptVisibility ?? null
const okRuns = probe?.runs.filter((run) => run.status === "ok").length ?? 0
```

```tsx
<Cell
  tab="sondagem"
  onSelectTab={onSelectTab}
  icon={RiRobot2Line}
  label="SONDAGEM EM IA"
  value={probe === null ? "—" : pct(probe.metrics.mentionRate)}
  unit={probe === null ? "não sondado" : `de ${okRuns} respostas lidas`}
  tone={probe === null ? "neutral" : stepShareTone(probe.metrics.mentionRate)}
  share={probe === null ? null : probe.metrics.mentionRate}
/>
```

- [ ] **O denominador é o das execuções que rodaram**, igual ao de `mentionRate` — usar `runs.length` contaria as recusadas como ausência e derrubaria a taxa por um motivo que não tem nada a ver com o lead. `stepShareTone` já é importado pelo arquivo. **`pct` não** — ele mora em `LeadGeoTabPanels.tsx:662`. Na Task 8 ele sobe para `LeadGeoPromptMatrix.tsx` junto com `PROVIDER_LABELS`; até lá, importe-o de onde está em vez de escrever a terceira cópia de `Math.round(value * 100)`.
- [ ] A trilha entra aqui porque **cheio é bom**: todas as respostas citando a marca é o melhor resultado possível. É a mesma justificativa da célula de robôs.
- [ ] Em `LeadGeoHeader.tsx`, o grid da faixa passa de `xl:grid-cols-[minmax(0,1.15fr)_repeat(4,minmax(0,1fr))]` para `repeat(5,...)`. Conferir os degraus de `md` e da base — seis células em duas colunas é três linhas, e a faixa não pode empurrar as abas para fora da tela.

## Task 7: A faixa de plataformas na aba Acesso

- [ ] Criar `LeadGeoCrawlerStrip.tsx`. Mapa fixo, dos doze agentes de `AI_USER_AGENTS` (`lib/website-audit/robots.ts:9`) para as quatro plataformas sondadas:

```ts
const AGENTS_BY_PLATFORM: Record<string, readonly string[]> = {
  chat_gpt: ["gptbot", "chatgpt-user", "oai-searchbot"],
  claude: ["claudebot", "claude-web"],
  gemini: ["google-extended"],
  perplexity: ["perplexitybot"],
}
```

- [ ] Os outros cinco — `ccbot`, `bytespider`, `applebot-extended`, `meta-externalagent`, `amazonbot` — num agrupamento "outros", com contagem.
- [ ] **Três estados por plataforma**, e o terceiro hoje não existe na tela:
  - **bloqueado** — algum agente da plataforma com `blocked: true`. Tom `warning`, ícone `RiCloseLine`.
  - **liberado** — declarado e nenhum bloqueado. Tom `success`, `RiCheckLine`.
  - **não declarado** — nenhum agente da plataforma em `aiCrawlers`. Tom `neutral`, `RiSubtractLine`. `aiAgentsFromGroups` só devolve agente **explicitamente declarado**, então isto é liberado por omissão — informação diferente de liberado por regra, e hoje as duas somem no mesmo silêncio.
- [ ] Sem `websiteCrawlExtended`, os quatro saem em `—` e a faixa diz que o crawl é anterior à coleta de robôs. **Nunca "liberado"** — o campo não foi medido.
- [ ] Mesmos rótulos e **mesma ordem** da matriz: ChatGPT · Claude · Gemini · Perplexity. É o que deixa o analista ler as duas telas como a mesma linguagem.
- [ ] Estado nunca só por cor: ícone e texto sempre juntos.
- [ ] **Não escreva a frase que liga robô bloqueado a não-citação.** Ninguém mediu. Dois fatos vizinhos; a seta entre eles não é desenhada.
- [ ] Montar em `LeadGeoAccessBoard.tsx`, acima dos dois cards existentes. A nuvem de `Badge` dos bloqueados sai — a faixa já diz tudo que ela dizia, com os três estados em vez de um.

**Commit:** `feat(geo): faixa de plataformas e manchete da sondagem`

## Task 8: A matriz

**Invoque a skill `suite-frontend` antes.** Depende das Tasks 2, 3 e 4.

- [ ] Em `use-geo-controller.ts`, acrescentar `promptSet` ao `return`. Ele já é montado na linha 329 para calcular `probeRuns` e **não sai**. Sem ele a matriz não tem o texto da pergunta.
- [ ] Criar `LeadGeoPromptMatrix.tsx`. Recebe `promptSet` e `promptVisibility`. Indexa os runs por `` `${promptId}:${provider}` `` — o par é a chave da célula.
- [ ] Estrutura: `Table` do registry dentro de um `div` com `overflow-x-auto`, `min-w-[52rem]`. Linhas = itens do `promptSet`, na ordem em que estão (é a ordem fixada, e é o que mantém a série comparável). Colunas = `GEO_PROMPT_PLATFORMS`, na ordem do constante, mais a coluna de fechamento.
- [ ] **Primeira coluna grudada** (`sticky left-0` com fundo de superfície opaco). A página nunca rola na horizontal.
- [ ] Cabeçalho de linha: o texto do prompt com `title` e `line-clamp-2`, e acima dele a sobrancelha de família, de `GEO_PROMPT_FAMILY_LABELS`. A sobrancelha passa o critério de `layout.md` — ela separa "a IA não te conhece" (família `brand`) de "a IA não te recomenda" (família `discovery`), que o texto do prompt sozinho não declara.
- [ ] **Três estados por célula, nunca dois:**

| estado | condição | o que aparece |
|---|---|---|
| citou | `status === "ok" && listRank !== null` | chip `Nª de M`, tom neutro |
| citou, fora da lista | `status === "ok" && mentioned && listRank === null` | chip `citada`, tom neutro |
| rodou e não citou | `status === "ok" && !mentioned` | `não citou`, `text-muted-foreground` |
| não rodou | `status !== "ok"` | `não rodou` + `statusMessage` no `Tooltip` |

- [ ] **↻ O chip NÃO usa `positionTone`.** A versão anterior deste plano mandava pintar top 3 de `success` e top 10 de `warning`. **A Task 1 desautorizou:** o ChatGPT declara no próprio texto que sua lista está em *"ordem alfabética"*, e é verdade; as outras três não declaram ordem nenhuma. Faixa de cor ali pintaria de verde quem tem nome começando com A.
- [ ] **O rótulo é "ordem de aparição na resposta", nunca "rank"**, e `M` — o tamanho da lista — vai no chip junto. `6ª` sozinho convida a leitura de ranking; `6ª de 8` declara a escala.
- [ ] A coluna do ChatGPT carrega nota permanente de **ordem alfabética**, do mesmo jeito que a do Gemini já carrega "sem recorte de cidade". Nota de coluna fixa, **não detectada no texto** — heurística de declaração seria frágil e a evidência é estável.
- [ ] **Não extraia `positionTone` para o shell.** Ela continua certa para SERP e Maps, onde a faixa é real; só não atravessa para cá. As duas cópias em `LeadGbpRankBlock` e `LeadGbpGridCompetitors` ficam como estão — consolidá-las é trabalho próprio, com aprovação própria.
- [ ] Marcador de `domainCited` no chip — o site apareceu entre as `annotations` daquela resposta. `RiLinkM` de `react-icons/ri`, com `aria-label`. É dado determinístico que o artefato de referência não tem.
- [ ] A lista ordenada abaixo do chip, de `answerList`: até 8 entradas, `rank` em `tabular-nums text-muted-foreground`, nome em `text-xs/relaxed`. **O lead em `text-primary font-medium`** — casado por `rankOfBrand`, não por índice.
- [ ] `answerList === null` (snapshot anterior ao campo): cair para `run.brands`, e o rodapé da matriz dizer que aquelas linhas são da leitura anterior e que **Sondar de novo** preenche a lista cheia. **Não invente lista vazia.**
- [ ] Coluna de fechamento: `StepMeter` com `citou em N de 4`, sobre as execuções `ok` daquela linha. Fração legítima — cheio é bom.
- [ ] `ToggleGroup` acima da tabela, **compacto ⇄ completo**: só os chips, ou chips mais a lista. `ToggleGroup` escolhe entre alternativas; é o papel certo do primitive. Preferência em `localStorage`, chave `geo:matrix-density`, no padrão das outras da etapa.
- [ ] Rodapé de procedência, sempre visível: a lista é o que o modelo escreveu **naquela execução**, e a mesma pergunta devolve resposta diferente entre execuções. A ressalva já existe na aba hoje — ela agora fica presa à peça que qualifica, em vez de solta num parágrafo cinza.
- [ ] Montar em `LeadGeoTabPanels.tsx`, na aba Sondagem, **acima** dos cards de resumo. Ela é a manchete da aba.
- [ ] `probe === null` continua no estado "Não sondado" que já existe, com a contagem de execuções e o aviso de custo.

**Commit:** `feat(geo): matriz prompt × LLM na aba Sondagem`

---

## Task 9: Verificação — a bateria única

A única task que roda ferramenta. Nada antes dela.

- [ ] `pnpm test` — inclui `geo-answer-list.test.mjs` sozinho, porque o script varre `lib/**/*.test.mjs`.
- [ ] `pnpm exec tsc --noEmit` — zero linhas.
- [ ] `pnpm lint` — zero **errors**; os warnings são débito antigo.
- [ ] Os greps de `references/checks.md`, comparados com o **baseline de 2026-09-10**: cor cravada 5, base-ui direto 2, anima sem reduced 1, todo o resto zero. Qualquer número acima é coisa nova.
- [ ] Visual, com o app rodando e login feito — **peça o login antes**, a tela exige sessão:
  1. lead **sem** sondagem: aba Sondagem no estado "Não sondado", sexta célula em `—`, sem trilha;
  2. lead **com** sondagem v1 (sem `answerList`): matriz abre, cai para `brands`, rodapé declara a procedência;
  3. lead com sondagem nova: os quatro estados de célula visíveis, incluindo ao menos um "não rodou" com `Tooltip`;
  4. claro e escuro, foco visível nos dois;
  5. largura estreita: a matriz rola no próprio contêiner e **a página não rola na horizontal**;
  6. `prefers-reduced-motion`: as barras não animam.
- [ ] Atualizar `references/components.md` e `references/layout.md` — a matriz em Formas de medida (**com a regra que a Task 1 produziu: ordem declarada pelo modelo não é escala, e não ganha faixa de cor**) e a etapa de IA na lista do arquétipo. **No mesmo commit da tela**, que é a regra de manutenção da skill.

**Commit:** `chore(geo): bateria de verificação e skill atualizada`

---

## O que este plano deliberadamente não faz

- **Não toca no PDF do cliente.** A matriz é tela de analista. `diagnosis-pdf.tsx` fica como está.
- **Não migra snapshot.** Sem `answerList`, a matriz cai para `brands` e declara. Quem quiser a lista cheia clica em **Sondar de novo** — US$ 0,65, botão que já existe.
- **Não muda coleta.** Prompt set, modelos, tetos, custo e catálogo de gaps ficam intactos. O único acréscimo é o campo no snapshot.
- **Não desenha tendência.** Um snapshot por coleta, sem cadência garantida. Gráfico sobre n=1 é decoração com cara de análise.
- **Não usa rampa `chart-*` nem faixa de estado na matriz.** A Task 1 mediu: a ordem da lista **não é ranking de qualidade** — uma das quatro plataformas declara que a dela é alfabética e as outras três não declaram nada. Qualquer cor por posição ali codificaria uma escala que não existe.
- **Não mostra custo por execução.** `costUsd` existe por run, e a conta que importa já aparece **antes do clique**, no rótulo do botão. Repeti-la linha a linha não muda nenhuma decisão e rouba espaço da peça que mais precisa.
- **Não corrige os três débitos do baseline.** Cor cravada no `NavTree`, base-ui direto no `DateTimePicker`, motion sem reduced no `LeadGbpAuditStep`. Cada um é trabalho próprio, com aprovação própria — não carona numa tarefa de UI.
