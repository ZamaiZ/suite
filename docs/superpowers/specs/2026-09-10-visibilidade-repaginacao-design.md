# Visibilidade — Repaginação para o Shell de Etapa — Design

## Objetivo

Levar a etapa de Visibilidade para o **mesmo shell** das outras três etapas
operacionais — cabeçalho fixo com identidade e big numbers colapsáveis, abas com
contador, coluna de oportunidades colapsável e bloco do analista — e, no mesmo
movimento, **tornar visível o dado que a correção de confiabilidade passou a
coletar** e que hoje não aparece em lugar nenhum.

Não é maquiagem. É a última das quatro etapas operacionais a entrar no shell.

## O que motivou

### A etapa é a única que nunca foi para o shell

| | GBP | Website | Presença | **Visibilidade** |
|---|---|---|---|---|
| `fullBleed` | ✅ | ✅ | ✅ | ❌ |
| cabeçalho fixo | ✅ | ✅ | ✅ | ❌ |
| identidade + 4 big numbers | ✅ | ✅ | ✅ | ❌ |
| abas com contador | ✅ | ✅ | ✅ | ❌ |
| coluna colapsável | ✅ | ✅ | ✅ | ❌ (card inline) |
| bloco do analista | ✅ | ✅ | ✅ | ❌ |
| `readingMode` | ✅ | ✅ | ✅ | ❌ |
| controller extraído | ✅ | ✅ | ✅ | ❌ |
| tema de oportunidade = aba | ✅ | ✅ | ✅ | ❌ |

São 413 linhas em 6 arquivos montando quatro cards empilhados dentro do
`overflow-y-auto px-3 py-3` do contêiner pai.

### O dado corrigido está invisível

`2026-09-10-visibilidade-confiabilidade-design.md` acrescentou ao snapshot
`hosts[]`, `coverage`, `indexAge`, `costUsd`, `droppedRows`, `localPack`,
`aiOverview`, e por linha `position.previous`, `difficulty.adsCompetition`,
`difficulty.topTenReferringDomains`, `serpFeatures[]`, `languageMismatch` e
`intent.probability`. **Nada disso é renderizado.** O achado mais forte da
medição — 77 das 110 keywords num subdomínio de homologação — só existe hoje
como um gap na lista.

### A tabela cresceu 10×

`RANKED_KEYWORDS_LIMIT` foi de 100 para 1.000. `LeadVisibilityKeywordsTable`
renderiza todas as linhas, sem filtro, sem ordenação e sem teto.

## Decisões aprovadas

- **Shell completo.** `fullBleed`, cabeçalho fixo, quatro big numbers
  colapsáveis, abas, coluna de oportunidades e bloco do analista, com
  `readingMode` e os atalhos `Ctrl/⌘ B` e `Ctrl/⌘ Shift E`.
- **Quatro abas:** Panorama · Keywords · Páginas · Validação. Aba e tema de
  oportunidade são o **mesmo tipo**.
- **Área do analista com notas e veredito por critério**, em tabela nova
  `lead_visibility_reviews`, por lead. Espelha `lead_website_reviews`.
- **Tabela com filtros, ordenação e teto com "ver mais"** — sem virtualização e
  sem dependência nova.
- **`LeadGbpCard` é promovido para `LeadStepShell/StepCard`**, com os 8
  consumidores fora do GBP atualizados. O acoplamento cruzado entre as quatro
  etapas acaba aqui.
- **Intenção é linha ranqueada, não barra empilhada** — ver Formas de medida.

## Fora de escopo

- **Gráfico de evolução de posição.** `position.previous` dá uma seta por linha,
  não uma série temporal: a tabela é append-only mas não tem cadência garantida.
  Seta na linha, sim; gráfico, não.
- **Mapa de calor keyword × posição.** Ilegível a 1.000 linhas e não responde
  nenhuma pergunta de venda.
- **Repaginar o Diagnóstico.** É a quinta etapa e tem shell próprio a decidir.
- **Mudar qualquer coisa da coleta.** Nenhum endpoint, limite, mapeamento ou
  regra de gap muda aqui. Esta spec é de leitura.
- **Paleta categórica nova.** O sistema tem uma rampa sequencial (`chart-*`) e
  três tokens de estado. Inventar quatro matizes para intenção violaria "cor só
  por token semântico".

## Arquitetura

### Aba e tema são o mesmo tipo

```ts
// lib/leads/visibility-step-tabs.ts
export type VisibilityStepTabId =
  | "panorama"
  | "keywords"
  | "paginas"
  | "validacao"

export const VISIBILITY_STEP_TABS: ReadonlyArray<{
  id: VisibilityStepTabId
  label: string
}> = [
  { id: "panorama", label: "Panorama" },
  { id: "keywords", label: "Keywords" },
  { id: "paginas", label: "Páginas" },
  { id: "validacao", label: "Validação" },
]
```

Os sete gaps de máquina mais os do analista se distribuem assim:

| tema | gaps |
|---|---|
| `panorama` | `not_ranking`, `thin_keyword_footprint`, `low_organic_traffic` |
| `keywords` | `brand_only_visibility`, `no_local_top20` |
| `paginas` | `homepage_only`, `non_canonical_host_traffic` |
| `validacao` | os `review:*` do analista |

`visibilityOpportunitiesByTheme` devolve `Record<VisibilityStepTabId, Item[]>`.
O `Record` sobre a união inteira é o que faz o `tsc` reprovar gap novo sem tema
— é o portão descrito em `checks.md`.

### A revisão do analista sai do snapshot

`lead_visibility_audits` é **append-only** desde `20260917000000`. Julgamento
humano gravado ali seria versionado junto com a coleta e duplicado a cada
análise — exatamente o argumento escrito na migração de
`lead_website_reviews`.

```sql
create table if not exists public.lead_visibility_reviews (
  id          uuid        primary key default gen_random_uuid(),
  lead_id     uuid        not null references public.leads(id) on delete cascade,
  review      jsonb       not null default '{}'::jsonb,
  notes       text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid        references public.users(id),
  constraint lead_visibility_reviews_notes_len_chk
    check (notes is null or char_length(trim(notes)) between 1 and 2000)
);

create unique index if not exists lead_visibility_reviews_lead_id_uidx
  on public.lead_visibility_reviews (lead_id);
```

Mais as quatro políticas RLS no padrão `<tabela>_<acao>_commercial`, como as
tabelas irmãs. Migração reexecutável: `if not exists` e `drop policy if exists`
antes de cada `create policy`.

### Os critérios: o que só um humano julga

Cada um existe porque a máquina **erra de um jeito conhecido** naquele ponto.

| id | rótulo | por que é humano | `allowsNa` |
|---|---|---|---|
| `host_intent` | Subdomínio fora do principal | `aprov.` é homologação, ambiente de cliente ou produto real? A máquina vê o host, não a intenção | sim — sem host secundário, não se aplica |
| `brand_terms` | Termos de marca | `isBrandKeyword` casa por token do nome. "Busca Orgânica" **é** um termo genérico; a heurística não distingue marca de categoria | não |
| `cannibalization` | Canibalização entre páginas | `ranked_keywords` devolve uma linha por keyword. Duas páginas disputando o mesmo termo é padrão entre linhas | não |
| `local_fit` | Aderência local | `isLocalKeyword` casa `\bem\b` e o nome da cidade. Grosseiro por construção | sim — negócio sem recorte local |
| `other` | Outro achado | como no Website: sem veredito, só nota | — |

`visibilityReviewProgress` conta os quatro primeiros — `other` fica de fora,
como `WEBSITE_REVIEW_CHIP_IDS` já faz. É esse `4` que vira denominador do big
number de Validação.

**A máquina não escreve em `review`.** Campo em branco do analista não gera gap,
e nenhuma coleta toca a linha.

### O cabeçalho

```
LeadVisibilityStepHeader     título · fonte · custo da coleta · Analisar
identidade + 4 big numbers   colapsável, `visibility:header-numbers`
faixa de avisos              erro · coletando · intenção não coletada · linhas descartadas
abas + botão de dobrar
```

**Célula de identidade:** domínio com link para `https://<domain>`, o
`main_domain` abaixo, e três badges — `Brasil · pt`, `DataForSEO · índice`, e
**`índice de ~59 dias`**. A terceira é a que mais muda a conversa com o cliente,
e hoje não existe em lugar nenhum da tela.

**Os quatro big numbers**, cada um a manchete de uma aba e clicável até ela:

| | valor | `unit` | `hint` | trilha | tom |
|---|---|---|---|---|---|
| **TRÁFEGO** | `estimatedTraffic` | `cliques/mês` | `≈ US$ N/mês em mídia` | **nenhuma** — não há escala | limiar `VISIBILITY_LOW_TRAFFIC` |
| **TOP 10** | `top3 + pos4to10` | `de N no índice` | — | fração sobre `keywordCount` | `stepShareTone` |
| **PÁGINAS** | páginas distintas | `em N hosts` | — | fração do tráfego no host canônico | `stepShareTone` dessa fração |
| **VALIDAÇÃO** | critérios julgados | `de 4 critérios` | — | progresso | `primary` |

**Cada `unit` carrega uma coisa só.** `"cliques/mês · ≈ US$ 731 em mídia"` é o
tell `A · B · C` que `layout.md` proíbe: frase pronta não tem hierarquia para
declarar, e o componente só consegue imprimi-la inteira, em cinza. O segundo
número vai para o `hint`, que o `StepStat` já tem e renderiza num degrau abaixo.

**O aviso de host não-canônico viaja no tom e na trilha, não numa frase.** Em
PÁGINAS, a fração do tráfego que está no host principal é a trilha, e
`stepShareTone` a pinta — com dois hosts dividindo 74/26, o card fica `warning`
sem precisar dizer "77 fora do principal" na unidade.

Sem coleta, os quatro são `—` e nenhuma trilha é renderizada. Trilha sem escala
mente pior que trilha ausente.

### Formas de medida

Escolhidas com a skill `dataviz` carregada, como a SKILL manda.

**Distribuição de posições → barra empilhada.** Top 3 · 4–10 · 11–20 · 21–50 ·
51–100 são **ordenadas**, então a rampa sequencial `chart-1..5` é legítima — é a
mesma ressalva já escrita em `LeadWebsiteStackedBar`. Reaproveita o componente.

**Hosts → linha ranqueada com barra proporcional.** É o achado do `aprov.`
virando leitura: cada host com sua fatia de tráfego e de keywords, o
não-canônico marcado com tom `warning` e rótulo, nunca só cor.

**Páginas → linha ranqueada com barra proporcional.** Agrupa por `url.full`,
ordena por tráfego. Responde "quais páginas sustentam o domínio".

**Intenção → linha ranqueada, NÃO barra empilhada.** Intenção é **categórica sem
ordem natural**, e a `dataviz` é dura: rampa sequencial em eixo sem ordem faz
ler hierarquia onde não existe. Este sistema não tem paleta categórica validada
— só `chart-*`, que é sequencial, e `success`/`warning`/`destructive`, que são
reservados para estado. Linha ranqueada resolve sem paleta nova. As keywords
abaixo do limiar de probabilidade entram como **"sem classificação confiável"**,
uma linha própria — não somem da conta.

**Idade do índice → régua de banda, não barra de fração.** Menor é melhor e
existe limiar (`VISIBILITY_STALE_SERP_DAYS = 90`). É o caso literal descrito em
`layout.md`. Mesma forma do `LeadWebsiteVitalGauge`; um marcador sólido para a
mediana e um vazado para o máximo — duas leituras, dois marcadores, nunca uma
frase.

**Dificuldade → sem medidor.** Com 98 de 110 em `—`, uma trilha desenharia
escala onde há buraco. Na linha: o índice quando existe, e o chip de disputa do
Google Ads ao lado.

### A tabela de keywords

Uma linha de filtros acima, no padrão da toolbar do board:

| controle | primitive | valores |
|---|---|---|
| busca | `InputGroup` | texto livre na keyword |
| intenção | `Select` | todas · as quatro · sem classificação |
| posição | `ToggleGroup` | todas · top 3 · top 10 · 11–20 · 21+ |
| host | `Select` | só quando `hosts.length > 1` |

Ordenação por clique no cabeçalho (`position`, `traffic`, `volume`,
`difficulty`), e **teto de 50 linhas com "Ver mais 50"**. O contador acima da
tabela declara `mostrando N de M · ordenadas por tráfego`.

Sem virtualização: exigiria biblioteca nova ou janela escrita à mão, e a lei é
não escrever primitive à mão.

### O `StepCard`

`LeadGbpCard` é consumido por **8 arquivos fora do GBP** — Website (4),
Presença digital (1), Diagnóstico (1) e Visibilidade (2). Ele é, de fato, um
primitive do shell morando na pasta errada.

Move para `components/custom/LeadStepShell/StepCard.tsx` com a **mesma API**
(`title`, `children`, `className`), sai do `index.ts` do shell, e
`LeadGbpPanel/LeadGbpCard.tsx` passa a reexportar — os imports antigos continuam
válidos e migram por arquivo, sem big bang.

## Arquivos previstos

**Criar**

| arquivo | responsabilidade |
|---|---|
| `supabase/migrations/20260926000000_lead_visibility_reviews.sql` | tabela e RLS |
| `lib/leads/visibility-review.ts` | critérios, catálogo, veredito, progresso |
| `lib/leads/visibility-step-tabs.ts` | `VisibilityStepTabId`, `VISIBILITY_STEP_TABS` |
| `lib/leads/visibility-pages.ts` | agregação por página e por host |
| `lib/validations/lead-visibility-review.ts` | zod da action |
| `app/actions/leads/upsert-visibility-review.ts` | upsert com autosave |
| `components/custom/LeadStepShell/StepCard.tsx` | o card promovido |
| `components/custom/LeadVisibilityPanel/use-visibility-controller.ts` | todo o estado e as ações da etapa |
| `LeadVisibilityView.tsx` | grid `central \| coluna`, abas, atalhos |
| `LeadVisibilityHeader.tsx` | cabeçalho fixo com colapso |
| `LeadVisibilityIdentityCell.tsx` | domínio, badges, idade do índice |
| `LeadVisibilityMetricCells.tsx` | os quatro big numbers |
| `LeadVisibilityTabPanels.tsx` | os quatro painéis |
| `LeadVisibilityRankedList.tsx` | linha ranqueada com barra — hosts, páginas, intenção |
| `LeadVisibilityIndexAgeGauge.tsx` | régua de banda da idade |
| `LeadVisibilityAnalystBlock.tsx` | notas + critérios |
| `LeadVisibilityReview.tsx` | a aba Validação |

**Modificar**

| arquivo | mudança |
|---|---|
| `LeadGbpPanel.tsx:427` | `fullBleed` passa a incluir `visibility`; `readingMode` chega ao painel |
| `lib/leads/visibility-opportunities.ts` | tema por gap, `byTheme`, oportunidades do analista |
| `LeadVisibilityKeywordsTable.tsx` | filtros, ordenação, teto |
| `LeadVisibilityPanel.tsx` | vira casca fina sobre o controller e a view |
| `LeadGbpPanel/LeadGbpCard.tsx` | reexporta do shell |
| os 8 consumidores de `LeadGbpCard` | passam a importar do shell |
| `lib/leads/diagnosis-compile.ts` | lê o review da Visibilidade, como já lê o do Website |
| `.claude/skills/suite-frontend/references/components.md` e `layout.md` | `StepCard` no shell e a Visibilidade na lista do arquétipo |

## Critérios de aceitação

1. A etapa monta o shell de tela cheia: cabeçalho fora do scroll, só o corpo
   rola, fundo `bg-accent/45`.
2. Os quatro big numbers aparecem, colapsam com persistência em
   `visibility:header-numbers`, e clicar em cada um leva à aba correspondente.
3. A coluna de oportunidades abre e fecha com `Ctrl/⌘ B`, permanece **montada**
   com `inert` quando recolhida, e guarda a preferência em
   `visibility:opportunities-rail`.
4. `Ctrl/⌘ Shift E` abre o bloco do analista e leva o cursor ao campo; de dentro,
   recolhe e devolve o foco ao painel.
5. O texto do analista sobrevive à troca de aba e ao recolhimento — `hidden`,
   nunca desmontar.
6. Um lead com host não-canônico mostra a quebra por host na aba Páginas **e** o
   big number de PÁGINAS em tom `warning`.
7. Sem coleta, os quatro big numbers são `—` e nenhuma trilha é renderizada.
8. Um snapshot **v1** abre sem quebrar, com as leituras novas em `—`.
9. A tabela com 1.000 linhas renderiza 50, filtra, ordena e cresce sob demanda
   sem travar.
10. `pnpm test`, `pnpm lint` e `pnpm exec tsc --noEmit` limpos; os greps de
    `checks.md` no baseline.
11. Responsivo: abaixo de `xl` a coluna vira a última seção do scroll; a tabela
    rola no próprio contêiner e a página nunca rola na horizontal.

## Autocrítica

**O que foi cortado:** o gráfico de evolução de posição, o mapa de calor, e a
quinta aba de SERP que exporia `serpFeatures` e a presença de AI Overview.

**Por quê:** os dois primeiros não respondem pergunta de venda. O terceiro tem
dado real e interessante — `ai_overview` em 49 de 110 SERPs medidas — mas
**nenhum gap aponta para lá ainda**. Aba sem oportunidade quebra a regra de que
aba e tema são o mesmo eixo, e viraria a única aba com contador sempre zero.
`serpFeatures` entra como chip na linha da tabela, onde qualifica a keyword que
o analista está olhando; quando existir uma regra que leia AI Overview como
lacuna, a aba nasce com ela.
