# Migração para DataForSEO — Lighthouse e Limpeza — Plano de Implementação

> **Para executores agênticos:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar task a task. Os passos usam checkbox (`- [ ]`).

**Goal:** Trocar o PageSpeed Insights pelo Lighthouse do DataForSEO, declarar na tela a perda do dado de campo, e apagar tudo que restou do Google.

**Architecture:** O PSI devolve duas fontes — `lighthouseResult`, que é laboratório, e `loadingExperience`, que é campo do Chrome UX Report. O Lighthouse do DataForSEO entrega a primeira e **não existe fonte para a segunda fora do Google**. O extrator passa a ler só laboratório, os três campos de campo viram `null` em coletas novas, a regra de Core Web Vitals continua com a mesma assinatura e a tela ganha o aviso. Depois disso, `lib/places/` e `lib/google-maps/` ficam sem chamador e são apagados.

**Tech Stack:** Next.js (App Router, Server Actions), TypeScript, DataForSEO OnPage Lighthouse, `node --test` sobre `.mjs`.

**Spec:** `../specs/2026-09-15-migracao-dataforseo-design.md`

**A onda 0 já mediu este endpoint.** `on_page/lighthouse/live/json` custou
US$ 0,005, roda o **Lighthouse 13.4.0**, devolve `audits` e `categories` **na
raiz** (sem o invólucro `lighthouseResult` do PSI), e trouxe `is-on-https`,
`is-crawlable`, `color-contrast` e `final-screenshot`. Faltaram dois:
`interaction-to-next-paint`, que confirma o sumiço do INP, e `viewport`, que
**virou `meta-viewport`**. Evidências em
`../../auditoria/evidencias/2026-09-15-migracao-dataforseo/README.md`, P6.

**Cobre a onda 5 da spec — é a última.** As Tasks 1 a 4 são independentes; a
Task 5 **exige** que `2026-09-15-migracao-dataforseo-pipeline.md` e
`2026-09-15-migracao-dataforseo-briefing-mapa.md` já tenham rodado, porque é ela
que apaga o que os dois esvaziaram.

## Global Constraints

- **Módulo testável não usa alias nem `server-only`.** Import relativo com
  extensão. `lib/leads/website-pagespeed.ts` já é assim e já roda no `node --test`.
- **Nenhuma task commita.** Escreva os arquivos e pare.
- **Verificação uma vez, no fim** (Task 6). Os testes `.mjs` da própria task, sim.
- **Ausência aparece como ausência.** Nenhum campo perdido pode virar zero, e
  nenhum medidor vazio pode parecer aprovado. É a regra que a fronteira do
  SerpAPI já estabeleceu no produto.
- **Idioma:** interface, comentário e mensagem de erro em português do Brasil.
- **Roda um teste só assim:**
  `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/caminho/arquivo.test.mjs`

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `lib/dataforseo/client.ts` | timeout por chamada | 1 |
| `lib/dataforseo/lighthouse.ts` | Lighthouse por estratégia | 2 |
| `lib/leads/website-pagespeed.ts` | extrator só de laboratório | 3 |
| `lib/leads/website-pagespeed.test.mjs` | trava do extrator | 3 |
| `app/actions/leads/poll-website-jobs.ts` | troca do import | 2 |
| `components/custom/LeadWebsitePanel/LeadWebsitePagespeedCard.tsx` | aviso de dado ausente | 4 |

**Deletados:** `lib/pagespeed/` (Task 2), `lib/places/` (Task 5),
`lib/google-maps/` (Task 5).

---

## Task 1: Timeout por chamada no cliente do DataForSEO

Sem isto toda chamada de Lighthouse aborta. O `postDataForSeo` fixa 20s; uma
execução de Lighthouse leva mais, e o `PSI_FETCH_TIMEOUT_MS` do próprio produto
já reconhece isso em 55s.

**Files:**
- Modify: `lib/dataforseo/client.ts:118-149`

**Interfaces:**
- Produces: `postDataForSeo<T>(path: string, task: Record<string, unknown>, timeoutMs?: number)`

- [ ] **Step 1: Aceitar o timeout**

Em `lib/dataforseo/client.ts`, troque a assinatura e a chamada interna de
`postDataForSeo`:

```ts
/**
 * Endpoint `live`: a resposta já traz o resultado. Tem o mesmo formato de um
 * `task_get` pronto, então usa o mesmo leitor — resultado ausente vira `null`,
 * como antes.
 *
 * `timeoutMs` existe porque nem todo `live` leva o mesmo tempo: uma busca no
 * Maps volta em segundos e uma execução de Lighthouse não. Sem o parâmetro, o
 * teto de 20s abortaria a segunda **sempre**, e o erro chegaria como falha de
 * rede — indistinguível de instabilidade do fornecedor.
 */
export async function postDataForSeo<T>(
  path: string,
  task: Record<string, unknown>,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<DataForSeoResult<T | null>> {
  const fetched = await timedFetch(
    `${DATAFORSEO_BASE}${path}`,
    { method: "POST", body: JSON.stringify([task]) },
    DATAFORSEO_VENDOR_ERROR,
    timeoutMs,
  )
```

O resto do corpo não muda. Todos os chamadores atuais omitem o argumento e
continuam com 20s.

---

## Task 2: Lighthouse do DataForSEO

**Files:**
- Create: `lib/dataforseo/lighthouse.ts`
- Delete: `lib/pagespeed/client.ts`
- Modify: `app/actions/leads/poll-website-jobs.ts:13`

**Interfaces:**
- Consumes: `postDataForSeo` com timeout (Task 1); `extractWebsitePsiStrategy`, `PSI_FETCH_TIMEOUT_MS`, `WebsitePsiStrategyId` de `website-pagespeed.ts`.
- Produces:
  - `type LighthouseFetchResult = { status: "ok"; strategy: WebsitePsiStrategy } | { status: "error"; message: string }`
  - `fetchPagespeedStrategy(url: string, strategy: WebsitePsiStrategyId): Promise<LighthouseFetchResult>`

O nome `fetchPagespeedStrategy` **fica**. É o seam que `poll-website-jobs.ts`
conhece, e o que mudou foi o fornecedor, não a pergunta.

- [ ] **Step 1: Criar o cliente**

Crie `lib/dataforseo/lighthouse.ts`:

```ts
import "server-only"

import { postDataForSeo } from "@/lib/dataforseo/client"
import {
  extractWebsitePsiStrategy,
  PSI_FETCH_TIMEOUT_MS,
  type WebsitePsiStrategy,
  type WebsitePsiStrategyId,
} from "@/lib/leads/website-pagespeed"

/**
 * Lighthouse pelo DataForSEO, no lugar do PageSpeed Insights.
 *
 * **O que se perde está declarado:** o PSI anexava `loadingExperience`, que é
 * campo do Chrome UX Report. O Lighthouse não produz isso — nem o do DataForSEO
 * nem nenhum outro —, então `fieldLcpMs`, `fieldInpMs` e `fieldCls` passam a
 * ser sempre nulos, e o INP some dos dois eixos, porque o Lighthouse padrão
 * também não emite o de laboratório. A tela diz isso; o silêncio se pareceria
 * com aprovação.
 */

export const PAGESPEED_FAILED =
  "Não foi possível obter o PageSpeed. Tente novamente."

export type LighthouseFetchResult =
  | { status: "ok"; strategy: WebsitePsiStrategy }
  | { status: "error"; message: string }

export async function fetchPagespeedStrategy(
  url: string,
  strategy: WebsitePsiStrategyId,
): Promise<LighthouseFetchResult> {
  const posted = await postDataForSeo<Record<string, unknown>>(
    "/on_page/lighthouse/live/json",
    {
      url,
      for_mobile: strategy === "mobile",
      categories: ["performance", "accessibility", "best_practices", "seo"],
      language_code: "pt",
    },
    PSI_FETCH_TIMEOUT_MS,
  )
  if (posted.status === "error") {
    return { status: "error", message: PAGESPEED_FAILED }
  }

  const extracted = extractWebsitePsiStrategy(posted.data)
  if (!extracted) {
    return { status: "error", message: PAGESPEED_FAILED }
  }
  return { status: "ok", strategy: extracted }
}
```

- [ ] **Step 2: Trocar o import do único chamador**

Em `app/actions/leads/poll-website-jobs.ts`, linha 13:

```ts
import { fetchPagespeedStrategy } from "@/lib/dataforseo/lighthouse"
```

O corpo da action não muda: a assinatura e os três estados de retorno são os
mesmos.

- [ ] **Step 3: Apagar o cliente antigo**

```bash
rm -r lib/pagespeed
```

- [ ] **Step 4: Conferir que ninguém mais aponta para lá**

```bash
grep -rn "lib/pagespeed\|pagespeedonline\|PAGESPEED_API_KEY" app components lib .env.example
```

Esperado: nenhum resultado. Se `PAGESPEED_UNCONFIGURED` ou
`PAGESPEED_FORBIDDEN` aparecerem em algum lugar, eram exports do arquivo
apagado — troque por `PAGESPEED_FAILED`, que é o único estado que sobrou: a
credencial agora é a do DataForSEO, e a falta dela já tem mensagem própria.

---

## Task 3: O extrator, só com laboratório

**Files:**
- Modify: `lib/leads/website-pagespeed.ts:294-344,373-378`
- Create: `lib/leads/website-pagespeed.test.mjs`

**Interfaces:**
- Produces: `extractWebsitePsiStrategy(payload: unknown): WebsitePsiStrategy | null` — mesma assinatura, agora aceitando **as duas formas de envelope**.

- [ ] **Step 1: Escrever o teste que falha**

Crie `lib/leads/website-pagespeed.test.mjs`:

```js
import assert from "node:assert/strict"
import { test } from "node:test"

import {
  extractWebsitePsiStrategy,
  websiteMinPerformance,
} from "./website-pagespeed.ts"

/**
 * Forma do resultado do `on_page/lighthouse/live/json`: o JSON do Lighthouse na
 * raiz, sem o `lighthouseResult` que o PSI envolvia em volta e sem o
 * `loadingExperience` que só o Google anexa.
 */
const LIGHTHOUSE = {
  categories: {
    performance: { score: 0.72 },
    accessibility: { score: 0.91 },
  },
  audits: {
    "largest-contentful-paint": { numericValue: 3200 },
    "cumulative-layout-shift": { numericValue: 0.08 },
    "meta-viewport": { score: 1 },
    "is-on-https": { score: 1 },
    "is-crawlable": { score: 1 },
    "color-contrast": { score: 0, details: { items: [{}, {}, {}] } },
  },
}

test("lê o Lighthouse cru, sem envelope do PSI", () => {
  const strategy = extractWebsitePsiStrategy(LIGHTHOUSE)
  assert.equal(strategy.performance, 72)
  assert.equal(strategy.accessibility, 91)
  assert.equal(strategy.lcpMs, 3200)
  assert.equal(strategy.cls, 0.08)
  assert.equal(strategy.contrastFails, 3)
})

test("lê o viewport pelo nome novo do audit", () => {
  // O `viewport` virou `meta-viewport` no Lighthouse 13.4.0, que é o que o
  // DataForSEO roda. Lido pelo nome antigo, `auditScoreOne` devolveria `true`
  // por ausência e o check passaria sempre, sem medir nada.
  assert.equal(
    extractWebsitePsiStrategy({
      ...LIGHTHOUSE,
      audits: { ...LIGHTHOUSE.audits, "meta-viewport": { score: 0 } },
    }).viewportOk,
    false,
  )
})

test("ainda lê o nome antigo, para payload gravado antes da virada", () => {
  const { "meta-viewport": _, ...semNovo } = LIGHTHOUSE.audits
  assert.equal(
    extractWebsitePsiStrategy({
      ...LIGHTHOUSE,
      audits: { ...semNovo, viewport: { score: 0 } },
    }).viewportOk,
    false,
  )
})

test("continua lendo o envelope antigo do PSI", () => {
  // Payload gravado antes da virada ainda precisa abrir.
  const strategy = extractWebsitePsiStrategy({ lighthouseResult: LIGHTHOUSE })
  assert.equal(strategy.performance, 72)
})

test("os três campos de campo saem nulos, nunca zero", () => {
  const strategy = extractWebsitePsiStrategy(LIGHTHOUSE)
  assert.equal(strategy.fieldLcpMs, null)
  assert.equal(strategy.fieldInpMs, null)
  assert.equal(strategy.fieldCls, null)
})

test("o INP ausente é nulo, e não um zero que passaria no limiar", () => {
  const strategy = extractWebsitePsiStrategy(LIGHTHOUSE)
  assert.equal(strategy.inpMs, null)
})

test("execução com erro não vira estratégia", () => {
  assert.equal(
    extractWebsitePsiStrategy({ ...LIGHTHOUSE, runtimeError: { code: "x" } }),
    null,
  )
  assert.equal(extractWebsitePsiStrategy(null), null)
  assert.equal(extractWebsitePsiStrategy({ audits: {} }), null)
})

test("a pior das duas estratégias é a que vale", () => {
  const strategy = extractWebsitePsiStrategy(LIGHTHOUSE)
  assert.equal(
    websiteMinPerformance({ url: "x", mobile: strategy, desktop: null }),
    72,
  )
})
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/leads/website-pagespeed.test.mjs
```

Esperado: FAIL em "lê o Lighthouse cru" — o extrator atual exige
`root.lighthouseResult` e devolve `null` sem ele.

- [ ] **Step 3: Reescrever o extrator**

Em `lib/leads/website-pagespeed.ts`, substitua `extractWebsitePsiStrategy`
inteira:

```ts
/**
 * Resposta de Lighthouse → estratégia.
 *
 * Aceita as duas formas: o Lighthouse cru, que é o que o DataForSEO devolve, e
 * o `lighthouseResult` que o PSI envolvia — payload gravado antes da virada
 * ainda precisa abrir.
 *
 * **`loadingExperience` deixou de ser lido em 2026-09-15.** Era campo do Chrome
 * UX Report, e não há fonte para ele fora do Google. Os três campos continuam
 * no tipo, sempre nulos em coleta nova, porque linhas antigas os têm e apagar o
 * leitor apagaria dado gravado.
 */
export function extractWebsitePsiStrategy(
  payload: unknown,
): WebsitePsiStrategy | null {
  const root = objectRecord(payload)
  if (!root) return null
  const lighthouse = objectRecord(root.lighthouseResult) ?? root
  if (objectRecord(lighthouse.runtimeError)) return null
  const categories = objectRecord(lighthouse.categories)
  const audits = objectRecord(lighthouse.audits)
  const performance = categoryScore(categories, "performance")
  const accessibility = categoryScore(categories, "accessibility")
  if (performance === null || accessibility === null) return null
  return {
    performance,
    accessibility,
    lcpMs: auditNumeric(audits, "largest-contentful-paint"),
    // O Lighthouse padrão não emite INP: é métrica de campo por natureza. Fica
    // a tentativa do audit experimental, que raramente vem — e `null` quando
    // não vier, porque zero passaria em qualquer limiar.
    inpMs:
      auditNumeric(audits, "interaction-to-next-paint") ??
      auditNumeric(audits, "experimental-interaction-to-next-paint"),
    cls: auditNumeric(audits, "cumulative-layout-shift"),
    fieldLcpMs: null,
    fieldInpMs: null,
    fieldCls: null,
    // `meta-viewport` primeiro: o audit foi renomeado, e no Lighthouse 13.4.0
    // que o DataForSEO roda o nome antigo não existe. Como `auditScoreOne`
    // devolve `true` para audit ausente, ler só o antigo faria `viewportOk`
    // passar sempre — medido em 2026-09-15, P6 das evidências da onda 0.
    viewportOk:
      "meta-viewport" in (audits ?? {})
        ? auditScoreOne(audits, "meta-viewport")
        : auditScoreOne(audits, "viewport"),
    contrastFails: contrastFailCount(audits),
    httpsOk: auditScoreOne(audits, "is-on-https"),
    indexable: auditScoreOne(audits, "is-crawlable"),
    screenshot: screenshotData(audits),
  }
}
```

Apague as funções `fieldPercentile` e `fieldCls` — ficam sem chamador. **Não
apague** `asNullableMetric`: `readWebsitePsiStrategy` (linhas 183-185) continua
usando as três para ler linhas gravadas.

- [ ] **Step 4: Rodar e ver passar**

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/leads/website-pagespeed.test.mjs
```

Esperado: `# pass 8`.

- [ ] **Step 5: Conferir que a regra de CWV não precisou mudar**

```bash
grep -n "metricNeedsImprovement" -A 8 lib/leads/website-pagespeed.ts
```

`strategyCwvNeedsImprovement` **não muda**: ela chama
`metricNeedsImprovement(lab, field, limiar)`, e essa função já trata `null` como
"não sei" em qualquer um dos dois. Com o campo sempre nulo, a regra passa a ser
só de laboratório sem uma linha alterada — que é o desenho, não um acidente.
`PSI_INP_NEEDS_MS` e `PSI_INP_POOR_MS` **ficam definidos**, para as linhas
antigas e para o dia em que houver fonte de campo de novo.

---

## Task 4: A tela diz o que deixou de medir

**Files:**
- Modify: `components/custom/LeadWebsitePanel/LeadWebsitePagespeedCard.tsx:105-135`
- Modify: `lib/leads/website-presenters.ts:117-122`

- [ ] **Step 1: Avisar no card**

Em `LeadWebsitePagespeedCard.tsx`, logo depois do `StepSectionLabel` de Core Web
Vitals e antes dos três medidores, acrescente:

```tsx
        {strategy &&
        strategy.fieldLcpMs === null &&
        strategy.fieldInpMs === null &&
        strategy.fieldCls === null ? (
          <p className="mb-2 text-[11px]/relaxed text-muted-foreground">
            Sem dado de campo: a coleta passou a usar o Lighthouse em
            2026-09-15, e medida de usuário real só existe no Google. Os
            números abaixo são de laboratório.
          </p>
        ) : null}
```

A condição testa os três, e não a data: um snapshot antigo tem os valores e não
deve levar o aviso; um novo não tem nenhum e deve. Assim o card fala a verdade
sobre a linha que está exibindo, sem precisar saber quando ela foi colhida.

- [ ] **Step 2: Não deixar o INP vazio parecer aprovado**

Ainda em `LeadWebsitePagespeedCard.tsx`, o medidor de INP passa a receber uma
legenda quando os dois eixos estão vazios. Confira como o
`LeadWebsiteVitalGauge` trata `lab={null} field={null}` hoje:

```bash
grep -rn "lab\b" -A 10 components/custom/LeadWebsitePanel/LeadWebsiteVitalGauge.tsx | head -30
```

Se ele já renderiza um estado neutro de "sem medida", nada a fazer. Se renderiza
barra vazia sem rótulo — que parece nota zero ou nota ótima, dependendo da
escala —, acrescente o texto "sem medida" no lugar do valor formatado.

- [ ] **Step 3: Tirar a linha morta do presenter**

Em `lib/leads/website-presenters.ts`, linhas 117-122, o trecho que escreve
`campo LCP …` só quando `fieldLcpMs !== null` nunca mais vai escrever em coleta
nova. Deixe a condição — ela continua certa para linhas antigas — e confira que
o texto vizinho não promete dado de campo em nenhum lugar:

```bash
grep -rn "campo" lib/leads/website-presenters.ts components/custom/LeadWebsitePanel
```

---

## Task 5: Apagar o Google

**Pré-requisito:** os planos `2026-09-15-migracao-dataforseo-pipeline.md` e
`2026-09-15-migracao-dataforseo-briefing-mapa.md` já rodaram. Esta task só
apaga o que eles esvaziaram.

**Files:**
- Delete: `lib/places/`
- Delete: `lib/google-maps/`
- Modify: `package.json`
- Modify: `.env.example`, `.env.local`

- [ ] **Step 1: Provar que não há chamador antes de apagar**

```bash
grep -rn "@/lib/places\|@/lib/google-maps\|lib/places/\|lib/google-maps/" app components lib
```

**Esperado: nenhum resultado.** Se houver, **pare** — o plano correspondente não
terminou, e apagar agora quebra a árvore. Relate qual arquivo ainda aponta.

- [ ] **Step 2: Apagar**

```bash
rm -r lib/places lib/google-maps
```

- [ ] **Step 3: Remover a dependência**

```bash
pnpm remove @googlemaps/js-api-loader
```

Se o plano de briefing e mapa já a removeu, o comando é inofensivo.

- [ ] **Step 4: Limpar as variáveis**

Em `.env.example`, confirme que `GOOGLE_PLACES_API_KEY`,
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` e a seção `── PageSpeed Insights ──` inteira
com o `PAGESPEED_API_KEY` já saíram. Se alguma restar, remova.

Em `.env.local` — que é versionado de propósito neste repositório — remova as
mesmas três linhas.

- [ ] **Step 5: Conferir que não sobrou menção nenhuma**

```bash
grep -rn "GOOGLE_PLACES_API_KEY\|NEXT_PUBLIC_GOOGLE_MAPS_API_KEY\|PAGESPEED_API_KEY\|googleapis" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.example" --include="*.local" app components lib .env.example .env.local
```

Esperado: nenhum resultado. Menções em `docs/` **ficam** — são registro
histórico, e apagá-las apagaria a memória de por que a migração aconteceu.

- [ ] **Step 6: Avisar o dono do repositório para revogar as chaves**

As chaves continuam válidas no Google Cloud Console depois de saírem do código.
Diga, com todas as letras, que elas precisam ser revogadas lá — o plano não faz
isso e não deve.

---

## Task 6: Bateria de verificação

- [ ] **Step 1: Tipos, lint, testes, formatação**

```bash
npx tsc --noEmit
```

```bash
npm run lint
```

```bash
npm test
```

```bash
npm run format:check
```

Erro em arquivo que não está na tabela de estrutura deste plano não é
necessariamente seu — a árvore é compartilhada com outras sessões. Confira
`git status` e atribua antes de tocar.

- [ ] **Step 2: A prova final**

```bash
grep -rln "googleapis\|@googlemaps\|GOOGLE_PLACES\|NEXT_PUBLIC_GOOGLE_MAPS" app components lib package.json .env.example .env.local
```

Esperado: **nenhum arquivo.** É este comando que diz que a migração acabou.

- [ ] **Step 3: Verificação visual**

O app exige sessão. Peça o login ao dono do repositório antes de abrir a tela.

Num lead com site cadastrado, dispare a auditoria de Website e confira:

1. as notas de performance e acessibilidade chegam nas duas estratégias;
2. o screenshot aparece — se não aparecer, o `final-screenshot` não veio, e é a
   pergunta 6 da onda 0 dando sua resposta;
3. o aviso de "sem dado de campo" aparece **uma vez**, acima dos medidores;
4. num lead auditado **antes** da virada, o aviso **não** aparece e os valores
   de campo antigos continuam na tela.

O item 4 é o que prova que dado gravado não foi apagado.
