# Diagnóstico — Repaginação para o Shell de Etapa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar a sexta e última etapa para o shell compartilhado e corrigir a única peça do produto em que a tela e o PDF discordam sobre o mesmo dado.

**Architecture:** A ordem é deliberada: o shell entra **antes** do conteúdo premium. As Tasks 1 a 5 põem a etapa dentro do arquétipo com os cards que já existem, redistribuídos nas quatro abas — a partir daí tudo é visível na tela. As Tasks 6 a 9 trocam um card por vez pela versão boa, e cada uma se confere sozinha. A etapa não é de coleta, é de composição e entrega: por isso a coluna de oportunidades carrega o **roadmap** e o bloco do analista carrega o **gancho comercial**.

**Tech Stack:** Next.js 16 (App Router, Server Actions), TypeScript, Tailwind v4 com tokens em `app/globals.css`, shadcn base-mira sobre Base UI, `motion/react-m`, `@react-pdf/renderer` (só leitura nesta entrega).

**Spec:** `docs/superpowers/specs/2026-09-11-diagnostico-repaginacao-design.md`

**Precedentes obrigatórios:**
- `.claude/skills/suite-frontend/` — **invoque a skill antes de tocar em qualquer tela.** `layout.md` tem o arquétipo do painel de trabalho e as Formas de medida; `checks.md` tem o baseline.
- `docs/superpowers/plans/2026-09-10-visibilidade-repaginacao.md` — a repaginação que criou este arquétipo. O desenho de controller, view, header e células veio de lá.
- `docs/superpowers/plans/2026-09-11-presenca-em-ia-repaginacao.md` — a repaginação irmã, da mesma semana.
- `components/custom/LeadGeoPanel/LeadGeoView.tsx` — a montagem mais recente do shell, com os dois atalhos e o colapso. É o molde da Task 4.

---

## Global Constraints

- **Leia `node_modules/next/dist/docs/` antes de escrever código de Next.** Esta versão tem breaking changes (`AGENTS.md` na raiz).
- **O `git` é do dono do repo.** Os `**Commit:**` marcam a fronteira de uma entrega revisável; **não execute `git commit`** — pare, avise, e deixe o commit para ele.
- **Verificação só no fim, uma vez.** **Não rode `pnpm test`, `pnpm lint` nem `pnpm exec tsc --noEmit` entre tarefas.**
- **Nunca use `pnpm build`.** `tsc --noEmit` é o mesmo type-check sem o custo do build.
- **Nada de subagentes de busca neste repo.** Ler e buscar direto.
- **A árvore é compartilhada com outra sessão.** Ela mexeu em `diagnosis-compile.ts`, `diagnosis-document.ts`, `diagnosis-read.ts` e `LeadDiagnosisPanel.tsx` nas últimas horas. **Releia o arquivo antes de cada edição** e, antes de chamar um erro de seu, confira se o arquivo que falhou está entre os que você tocou.
- **Módulos de `lib/leads/` são puros e importam com extensão `.ts`.** Não adicione `server-only` a nenhum deles.
- **O leitor tolera o passado, o escritor só produz o presente.**
- **`null` é "não coletado"; `[]` é "coletado e vazio".** Ausência na tela é `—`, nunca zero.
- **Copy de interface em pt-BR**, por `references/writing.md`.
- **`cn` importado de `"cn"`**, nunca de `@/lib/utils`. Ícone só de `react-icons/ri`. `m.*` de `motion/react-m`. Cor só por token semântico. Altura de controle vem de `size`.
- **Ambiente Git Bash no Windows:** `grep -P` não funciona; use `grep -E`. `bc` não existe.

### Constraints próprias deste plano

- **Esta spec é de leitura.** Nenhuma regra de achado, nota, roadmap ou ponto forte muda. `scorePillarOpportunities` não é tocada, inclusive os pesos 12 e 6.
- **O PDF é a verdade.** `diagnosis-pdf.tsx` não é modificado. A aba Documento **lê** o que ele já produz; quando as duas divergirem, quem está certo é o PDF.
- **`measured: false` nunca vira número.** Nem `0`, nem `100`, nem média. Em toda peça nova, pilar não medido sai `—` com chip próprio.
- **A prosa continua salvando por botão.** Autosave é trabalho próprio, fora deste plano.
- **`fullBleed` do diagnóstico entra junto com o shell, nunca antes.** Ligá-lo com o painel plano tira o padding e o scroll do contêiner de uma tela que depende dos dois.

---

## File Structure

| arquivo | responsabilidade |
|---|---|
| `lib/leads/diagnosis-step-tabs.ts` | **Criar** — `DiagnosisStepTabId`, `DIAGNOSIS_STEP_TABS` |
| `components/custom/LeadStepShell/StepOpportunitiesRail.tsx` | **Modificar** — `activeTab: Id \| null` |
| `components/custom/LeadGbpPanel/LeadGbpPanel.tsx` | **Modificar** — `fullBleed` ganha `geo` (Task 1) e `diagnosis` (Task 5) |
| `LeadDiagnosisPanel/use-diagnosis-controller.ts` | **Criar** — todo o estado e as quatro ações |
| `LeadDiagnosisPanel/LeadDiagnosisView.tsx` | **Criar** — grid `central \| coluna`, abas, atalhos |
| `LeadDiagnosisPanel/LeadDiagnosisHeader.tsx` | **Criar** — cabeçalho fixo com colapso |
| `LeadDiagnosisPanel/LeadDiagnosisIdentityCell.tsx` | **Criar** — empresa, domínio, fontes, estado |
| `LeadDiagnosisPanel/LeadDiagnosisMetricCells.tsx` | **Criar** — os quatro big numbers |
| `LeadDiagnosisPanel/LeadDiagnosisTabPanels.tsx` | **Criar** — o roteador das quatro abas |
| `LeadDiagnosisPanel/LeadDiagnosisAnalystBlock.tsx` | **Criar** — o gancho comercial no pé da coluna |
| `LeadDiagnosisPanel/LeadDiagnosisProseField.tsx` | **Criar** — `Textarea` + `ProseFooter`, hoje embutidos |
| `LeadDiagnosisPanel/LeadDiagnosisScoreBand.tsx` | **Criar** — a faixa comparativa de notas |
| `LeadDiagnosisPanel/LeadDiagnosisPillarCard.tsx` | **Criar** — métricas, narrativa, oportunidades |
| `LeadDiagnosisPanel/LeadDiagnosisDocumentPreview.tsx` | **Criar** — a aba Documento |
| `LeadDiagnosisPanel/LeadDiagnosisExports.tsx` | **Criar** — a aba Exportações |
| `LeadDiagnosisPanel/LeadDiagnosisPanel.tsx` | **Modificar** — vira casca fina |
| `LeadDiagnosisPanel/LeadDiagnosisStepHeader.tsx` | **Modificar** — ganha "Salvar rascunho" |
| `LeadDiagnosisPanel/LeadDiagnosisScorecard.tsx` | **Remover** — substituído pela faixa |
| `.claude/skills/suite-frontend/references/{components,layout}.md` | **Modificar** — no mesmo commit da tela |

---

## Task 1: `fullBleed` da etapa de IA

Uma linha, e ela conserta uma etapa que já está em produção. Vai primeiro porque não depende de nada e fecha a repaginação anterior.

- [ ] Em `LeadGbpPanel.tsx`, na condição `fullBleed` (hoje por volta da linha 444), acrescentar `selectedStep === "geo"`.
- [ ] **Não acrescente `diagnosis` ainda.** O painel de diagnóstico ainda é plano e depende do `overflow-y-auto px-3 py-3` do contêiner; ligar agora tira o scroll de uma tela que não tem o próprio. Ele entra na Task 5.
- [ ] Atualizar o comentário acima da condição: hoje diz "as três etapas" e depois "as outras quatro etapas seguem como estavam". Os dois números estão errados desde que a Visibilidade entrou.
- [ ] Conferir na tela: a faixa do cabeçalho da etapa de IA encosta nas bordas, o corpo `bg-accent/45` vai de ponta a ponta, e o trilho de 48px recolhido cola na direita sem folga.

**Commit:** `fix(geo): a etapa de IA monta o shell em tela cheia`

---

## Task 2: O eixo das abas e o contrato do trilho

- [ ] Criar `lib/leads/diagnosis-step-tabs.ts`:

```ts
/**
 * Aba e tema de oportunidade **não** são o mesmo eixo aqui, e isso é decisão.
 *
 * Nas cinco etapas de coleta eles são, e é o que faz o contador da aba bater
 * com o grupo da coluna. No Diagnóstico as abas não são temas: são modos de
 * trabalhar o mesmo documento — ver, editar, conferir, exportar. As ações do
 * roadmap não pertencem a nenhum desses modos; pertencem a pilares.
 *
 * Agrupá-las por aba deixaria três das quatro com contador sempre zero, que é
 * o defeito que a spec da Visibilidade recusou ao não criar a aba de SERP.
 * Por isso a coluna recebe `DIAGNOSIS_PILLARS` como eixo, e não estas abas.
 */
export type DiagnosisStepTabId =
  | "panorama"
  | "pilares"
  | "documento"
  | "exportacoes"

export const DIAGNOSIS_STEP_TABS: ReadonlyArray<{
  id: DiagnosisStepTabId
  label: string
}> = [
  { id: "panorama", label: "Panorama" },
  { id: "pilares", label: "Pilares" },
  { id: "documento", label: "Documento" },
  { id: "exportacoes", label: "Exportações" },
]
```

- [ ] Em `components/custom/LeadStepShell/StepOpportunitiesRail.tsx`, trocar `activeTab: Id` por `activeTab: Id | null`, com comentário dizendo por quê:

```ts
  /**
   * Qual grupo realçar no cabeçalho da seção. `null` quando a etapa não tem
   * um "ativo" — o Diagnóstico filtra por pilar, e nenhuma aba dele é pilar.
   */
  activeTab: Id | null
```

- [ ] O uso é só `activeTab === item.id` para estilo; com `null` nenhum grupo realça, que é o comportamento certo. **Nenhum dos quatro consumidores atuais muda** — todos seguem passando o id deles.

---

## Task 3: O controller

Extração de estado, **sem uma única mudança de aparência**. O painel continua renderizando o que renderiza hoje; só o lugar do estado muda.

- [ ] Criar `use-diagnosis-controller.ts` recebendo `LeadDiagnosisPanelProps` e devolvendo, no molde de `use-geo-controller.ts`:

```ts
return {
  leadId, companyName, domain, canEdit, unlocked,
  draft, document, exports, currentExport, stale,
  executiveSummary, commercialHook, narratives, dirty,
  setExecutiveSummary, setCommercialHook, setNarrative,
  resetExecutiveSummary, resetCommercialHook, resetNarrative,
  compiling, saving, exporting, opening, error, savedFlash,
  handleCompile, handleSave, handleExport, handleOpenPdf,
}
```

- [ ] `setNarrative(pillar, value)` e `resetNarrative(pillar)` substituem o `setNarratives` com spread espalhado pela tela.
- [ ] **O reset ligado à troca de rascunho continua no render, não em efeito** — é o padrão da casa e já está certo no arquivo atual. Copie como está.
- [ ] `LeadDiagnosisPanel.tsx` vira casca fina: monta o controller e delega, igual a `LeadGeoPanel.tsx`.

**Commit:** `refactor(diagnosis): estado da etapa sai da tela para o controller`

---

## Task 4: O shell

**Invoque a skill `suite-frontend` antes.** O molde é `LeadGeoView.tsx` — copie a estrutura, troque o conteúdo.

- [ ] `LeadDiagnosisView.tsx`: `Tabs` na raiz, grid `grid-cols-1 xl:grid-cols-[minmax(0,1fr)_var(--rail-w)]`, `--rail-w` de `21.25rem` ⇄ `3rem`, transição de 320ms em `[0.23,1,0.32,1]` com `useReducedMotion`.
- [ ] Chaves de `localStorage` próprias: `diagnosis:opportunities-rail`, `diagnosis:analyst-block`, `diagnosis:header-numbers`. Recolher numa etapa não recolhe na outra.
- [ ] `useCaptureShortcut` com `KeyE` e `allowInFields: true` para o bloco do analista, e `useCollapsibleRail` para a coluna — os dois do shell, exatamente como no Geo, inclusive a ida e volta do foco.
- [ ] `LeadDiagnosisHeader.tsx`: cabeçalho fixo com `LeadDiagnosisStepHeader`, a faixa colapsável de identidade e números pelo truque de `grid-template-rows: 1fr → 0fr`, a faixa de avisos, e `StepTabs` com `layoutId="diagnosis-step-tab-underline"`.
- [ ] `LeadDiagnosisIdentityCell.tsx`: ícone em poço `primary/10`, `meta.companyName`, `meta.domain`, `meta.city`, e badges — `meta.sources` e, quando `stale`, `variant="warning"` com "Coletas mudaram: recompile".
- [ ] `LeadDiagnosisMetricCells.tsx`: quatro células no molde de `LeadGeoMetricCells`, cada uma `button` com `aria-label` nomeando a aba de destino.

| aba | rótulo | valor | unidade | trilha |
|---|---|---|---|---|
| `panorama` | PILARES MEDIDOS | medidos | `de 5 pilares` | `medidos / 5` |
| `pilares` | ACHADOS ALTOS | soma de `highCount` dos medidos | `pontos de alto impacto` | **`null`** |
| `documento` | TEXTOS ESCRITOS | preenchidos | `de 7 textos` | `preenchidos / 7` |
| `exportacoes` | ÚLTIMO PDF | `formatRelativeShort` ou `—` | `desde a exportação` | **`null`** |

- [ ] Os sete textos são `commercialHook`, `executiveSummary` e as cinco narrativas. Conta `trim().length > 0`.
- [ ] **ACHADOS ALTOS soma só os pilares medidos.** Somar os não medidos acrescentaria zeros que não são medida.
- [ ] **ÚLTIMO PDF fica `warning` quando `stale`**, com `hint` "as coletas mudaram depois desta exportação". É a célula que responde se o PDF que o analista mandaria agora está certo.
- [ ] `LeadDiagnosisTabPanels.tsx`: quatro `TabsContent` com `keepMounted` — é o que preserva o texto não salvo ao trocar de aba. Nesta task cada aba recebe os cards que **já existem**, redistribuídos:
  - `panorama` — `LeadDiagnosisScorecard` (ainda o antigo), resumo executivo, pontos fortes, achados
  - `pilares` — os cinco `StepCard` do loop de pilares, como estão
  - `documento` — por ora, o card de limitações
  - `exportacoes` — o card "PDFs exportados", como está
- [ ] Os dois estados vazios — bloqueado e "pronto para compilar" — passam a morar **dentro** do shell, no corpo que rola, não no lugar dele. O cabeçalho e a faixa continuam montados: é ali que estão o aviso e o botão que resolvem a falta.

---

## Task 5: A coluna, o gancho, e o `fullBleed` do diagnóstico

- [ ] `StepOpportunitiesRail` com `tabs={DIAGNOSIS_PILLARS.map(...)}` — rótulos de `DIAGNOSIS_PILLAR_LABELS` — e `activeTab={null}`.
- [ ] `groups` é o roadmap agrupado por pilar:

```ts
const grouped = Object.fromEntries(
  DIAGNOSIS_PILLARS.map((pillar) => [
    pillar,
    roadmap
      .filter((item) => item.pillar === pillar)
      .map((item) => ({
        id: item.id,
        title: item.title,
        impact: item.impact,
        detail: item.evidence,
      })),
  ]),
) as Record<DiagnosisPillar, StepOpportunity[]>
```

- [ ] `detail` é só a evidência: o pilar já é o cabeçalho do grupo, e repeti-lo em toda linha é o ruído que `layout.md` chama de frase pronta.
- [ ] `title="Roadmap"` no trilho, e `emptyLabel="Nada priorizado nesta compilação."`
- [ ] `LeadDiagnosisProseField.tsx`: extrai `Textarea` + `ProseFooter` do painel atual, com `label`, `value`, `maxLength`, `rows`, `seed`, `disabled`, `onChange`, `onReset`. **Copie o `ProseFooter` como está** — a lógica de "texto sugerido" e o comentário de dez linhas que a explica vão junto.
- [ ] `LeadDiagnosisAnalystBlock.tsx`: o gancho comercial em `LeadDiagnosisProseField`, no slot `analyst` do trilho, com `id="diagnosis-analyst-block"` e o mesmo colapso do Geo. **Não reusa `StepNotesField`** — aquele é feito para autosave, e a prosa aqui salva por botão.
- [ ] O card "Gancho comercial" **sai** da Panorama: ele agora mora na coluna.
- [ ] **`LeadGbpOpportunitiesCard` sai do Diagnóstico**, e com ele o import de `@/components/custom/LeadGbpPanel/`. O roadmap virou coluna; era o último acoplamento cruzado da etapa, e é o que a promoção do `StepCard` para o shell existiu para encerrar. Confira com `grep -rn "LeadGbpPanel" components/custom/LeadDiagnosisPanel/` — tem que voltar vazio.
- [ ] `LeadDiagnosisStepHeader` ganha "Salvar rascunho", `variant="secondary"`, desabilitado quando `!dirty || saving || compiling || exporting`, com o `savedFlash` ao lado.
- [ ] **A faixa sticky do rodapé sai inteira.** "Exportar PDF" estava duplicado nela e no cabeçalho.
- [ ] Em `LeadGbpPanel.tsx`, `fullBleed` ganha `selectedStep === "diagnosis"`. **Agora, e não antes:** a etapa passa a ter cabeçalho fixo e scroll próprio nesta task.
- [ ] Conferir na tela: `Ctrl/⌘ B` recolhe a coluna e ela continua montada com `inert`; `Ctrl/⌘ Shift E` leva o cursor ao gancho e de dentro devolve o foco ao painel; o texto não salvo sobrevive a trocar de aba e recolher a coluna.

**Commit:** `feat(diagnosis): a etapa entra no shell, com o roadmap na coluna`

---

## Task 6: A faixa de notas

É a task que corrige a discordância entre a tela e o PDF. Vale sozinha.

- [ ] Criar `LeadDiagnosisScoreBand.tsx`. Cinco linhas, **uma escala só**: as zonas são o fundo, a nota é o marcador — o padrão de `LeadVisibilityIndexAgeGauge`, e pelo mesmo motivo: o limiar é a história e uma barra de preenchimento o esconde.
- [ ] Os cortes saem de `toneForScore`, que hoje mora em `LeadDiagnosisScorecard.tsx` e **não muda de valor**: `< 55` ruim, `55–79` a melhorar, `>= 80` bom. Mova a função para o arquivo novo e devolva `StepTone`, não string de classe:

```ts
/** Mesmos cortes de sempre; o tipo é que passa a ser o do shell. */
function scoreTone(score: number): StepTone {
  if (score >= 80) return "success"
  if (score >= 55) return "warning"
  return "danger"
}
```

- [ ] Zonas como fundo, em alfa baixo, no molde de `ZONE_FILL` do gauge da Visibilidade: `bg-destructive/25` até 55, `bg-warning/30` de 55 a 80, `bg-success/25` de 80 a 100.
- [ ] Marcador sólido no tom da faixa em que a nota caiu, com `border-2 border-card`, `useReducedMotion` respeitado.
- [ ] **Pilar não medido não tem marcador, não tem nota e não tem tom.** A trilha sai lisa em `bg-accent`, o valor é `—`, e um chip neutro diz "não medido". É o motivo desta spec existir: hoje a tela pinta `0` em `text-destructive` sobre um pilar que ninguém coletou, enquanto `diagnosis-pdf.tsx:191` omite o card e `diagnosis-templates.ts:29` escreve "ainda não foi coletada".
- [ ] À direita de cada linha, o que já existe: `Sem alertas` ou `N altos · M médios`.
- [ ] Trocar `LeadDiagnosisScorecard` pela faixa na aba Panorama e **apagar o arquivo antigo**.

**Commit:** `fix(diagnosis): pilar não medido para de pontuar na tela`

---

## Task 7: O card de pilar

- [ ] Criar `LeadDiagnosisPillarCard.tsx` com `pillar`, `facts`, `score`, a narrativa e os handlers.
- [ ] As métricas deixam de ser `<span>{label}: {value}</span>` em cinza. **Sem barra** — `DiagnosisKeyMetric.value` é `string` e não tem denominador, e trilha sem escala mente pior que trilha ausente. O que muda é a camada tipográfica:

```tsx
<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
  {facts.keyMetrics.map((metric) => (
    <div key={metric.id} className="min-w-0 rounded-lg border border-border/70 px-2 py-1.5">
      <p className="truncate text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
        {metric.label}
      </p>
      <p className="truncate text-xs font-semibold tabular-nums text-foreground">
        {metric.value}
      </p>
    </div>
  ))}
</div>
```

- [ ] A narrativa vira `LeadDiagnosisProseField`.
- [ ] As oportunidades do pilar passam a usar `StepOpportunityItem` do shell — **ganham o chip de impacto**, que hoje some: a lista atual tem só o ícone de lâmpada e o título.
- [ ] `GeoEvidencePreview` **sai daqui**. Ele vira parte da aba Documento na Task 8, onde a prévia do PDF mora inteira.
- [ ] O card mostra a nota do pilar no cabeçalho, no mesmo tom da faixa — e `—` quando não medido.

---

## Task 8: A aba Documento

- [ ] Criar `LeadDiagnosisDocumentPreview.tsx`, lendo `draft.document`, na **ordem do PDF** e na densidade de leitura, não na operacional:

| # | seção | fonte |
|---|---|---|
| 1 | Resumo executivo | `prose.executiveSummary` |
| 2 | Scorecard | `facts.scorecard`, **só os medidos** |
| 3 | Pontos fortes | `facts.strengths` |
| 4 | Achados prioritários | `facts.findings` |
| 5 | Roadmap recomendado | `facts.roadmap` |
| 6 | Por pilar | `prose.pillarNarratives` + `facts.pillars[].opportunities` |
| 7 | O que as IAs já dizem | `facts.geoEvidence` |
| 8 | Limitações da coleta | `limitations` |

- [ ] **Somente leitura.** Nenhum `Textarea` aqui: quem edita são as abas Panorama e Pilares.
- [ ] **Declara o que não entra.** Onde o PDF omite, a prévia imprime a razão — *"Presença em IA não entra no scorecard: não foi medida"*, *"A seção de evidências em IA some: não há coleta"*. No PDF a ausência é silêncio; aqui ela precisa ser visível, senão o analista não sabe o que está faltando.
- [ ] Espelhar as condições de omissão do PDF **lendo os mesmos campos**, nunca reimplementando a regra: `!cell.measured` para o scorecard (`diagnosis-pdf.tsx:191`), `geoEvidence` ausente ou com as duas listas vazias para a seção de IA (`diagnosis-pdf.tsx:259`).
- [ ] Uma linha no topo dizendo que é prévia do que sai no PDF, e que o PDF é a verdade quando os dois divergirem.

---

## Task 9: A aba Exportações

- [ ] Criar `LeadDiagnosisExports.tsx` com a lista que hoje é o card "PDFs exportados": nome do arquivo, `is_current` como badge `success`, data em `formatDateTimeShort`, e botão "Abrir".
- [ ] O aviso de rascunho desatualizado aparece **aqui também**, não só no cabeçalho: é nesta aba que alguém decide reabrir um PDF antigo, e é aqui que precisa saber que ele não reflete a coleta atual.
- [ ] Estado vazio: "Nenhum PDF exportado ainda." — nunca uma tabela vazia.

**Commit:** `feat(diagnosis): faixa de notas, cards de pilar, prévia do documento e exportações`

---

## Task 10: Verificação — a bateria única

A única task que roda ferramenta. Nada antes dela.

- [ ] `pnpm test` — zero falhas.
- [ ] `pnpm exec tsc --noEmit` — zero linhas.
- [ ] `pnpm lint` — zero **errors**.
- [ ] Os greps de `references/checks.md`, comparados com o **baseline de 2026-09-10**: cor cravada 5, base-ui direto 2, anima sem reduced 1, todo o resto zero.
- [ ] Visual, com o app rodando e login feito — **peça o login antes**, a tela exige sessão:
  1. lead **bloqueado**: o shell monta, o corpo diz o que falta;
  2. lead **destravado sem rascunho**: estado "pronto para compilar", quatro células em `—`;
  3. lead **com rascunho e um pilar não medido**: a faixa mostra `—` e "não medido", **nunca `0` vermelho**, e a prévia do Documento declara a omissão;
  4. lead **com rascunho desatualizado**: a célula ÚLTIMO PDF em `warning`, e o aviso nas Exportações;
  5. `Ctrl/⌘ B` e `Ctrl/⌘ Shift E` nos dois sentidos; texto não salvo sobrevive;
  6. **a etapa de IA** encosta nas bordas (Task 1);
  7. claro e escuro, foco visível nos dois;
  8. largura estreita: a coluna vira a última seção do scroll e nada rola na horizontal;
  9. `prefers-reduced-motion`: marcador e colapso não animam.
- [ ] Atualizar `references/components.md` e `references/layout.md` — a faixa de notas em Formas de medida, o Diagnóstico na lista do arquétipo, e a ressalva de que aba e tema divergem nesta etapa e por quê. **No mesmo commit da tela.**

**Commit:** `chore(diagnosis): bateria de verificação e skill atualizada`

---

## O que este plano deliberadamente não faz

- **Não muda o PDF.** `diagnosis-pdf.tsx` fica intocado. A prévia lê; não reimplementa.
- **Não muda a compilação.** Nenhuma regra de achado, nota, roadmap ou ponto forte. Os pesos 12 e 6 ficam.
- **Não converte a prosa para autosave.** É o padrão do resto do produto e continua sendo a coisa certa — mas é mudança de comportamento sobre texto que vai para cliente, e merece aprovação própria.
- **Não inventa nota geral do lead.** Média sobre pilares nem sempre medidos **sobe quanto menos se mediu**. É o `dominance: 1` com outro nome.
- **Não põe barra nas métricas por pilar.** `value` é `string`, sem denominador.
- **Não constrói histórico entre compilações.** `facts_fingerprint` já existe e diria o que mudou desde o último PDF — mas só se guarda o rascunho atual, e não há série para comparar. É trabalho de dado, não de tela.
- **Não corrige os três débitos do baseline.** Cada um é trabalho próprio, com aprovação própria.
