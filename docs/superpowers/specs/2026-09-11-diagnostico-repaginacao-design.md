# Diagnóstico — Repaginação para o Shell de Etapa — Design

## Objetivo

Levar a etapa de Diagnóstico para o **mesmo shell das outras cinco** —
cabeçalho fixo, identidade e big numbers colapsáveis, abas com contador, coluna
colapsável e bloco do analista — e, no mesmo movimento, **corrigir a única peça
do produto em que a tela e o PDF discordam sobre o mesmo dado**.

É a sexta e última etapa a entrar no shell.

## O que motivou

### A etapa nunca entrou no shell

Conferido em 2026-09-11:

| | GBP | Website | Presença | Visib. | IA | **Diagnóstico** |
|---|---|---|---|---|---|---|
| `fullBleed` | ✅ | ✅ | ✅ | ✅ | ❌ | **❌** |
| cabeçalho fixo | ✅ | ✅ | ✅ | ✅ | ✅ | **❌** |
| identidade + big numbers | ✅ | ✅ | ✅ | ✅ | ✅ | **❌** |
| abas com contador | ✅ | ✅ | ✅ | ✅ | ✅ | **❌** |
| coluna de oportunidades | ✅ | ✅ | ✅ | ✅ | ✅ | **❌** |
| bloco do analista | ✅ | ✅ | ✅ | ✅ | ✅ | **❌** |
| arquivos na pasta | 24 | 15 | 10 | 12 | 17 | **3** |

São **672 linhas num arquivo** — estado, quatro handlers assíncronos, dois
subcomponentes e a tela inteira — montando doze `StepCard` empilhados num
`flex flex-col gap-3 pb-20`. É o ponto de partida que a Visibilidade tinha antes
da repaginação dela.

No corpo: zero `StepMeter`, zero `Table`, zero `Tooltip`, zero linha ranqueada.

### A tela e o PDF discordam sobre a mesma célula

`DiagnosisPillarScore` tem o campo `measured`, e ele existe por um motivo
registrado em doze linhas de comentário: pilar sem coleta não pode pontuar.

Quem lê `measured`:

| arquivo | o que faz |
|---|---|
| `diagnosis-pdf.tsx:191` | `if (!cell.measured) return null` — o card some do documento |
| `diagnosis-templates.ts:29` | a prosa diz *"ainda não foi coletada nesta auditoria"* |
| `diagnosis-read.ts:169` | leitura tolerante, ausência lê como `true` |

Quem **não** lê: `LeadDiagnosisScorecard.tsx`. Ele renderiza `cell.score` com
`toneForScore(cell.score)`, sem condição.

`emptyPillarScore()` devolve `score: 0`. Então, num lead sem coleta de IA, **o
analista vê um `0` em `text-destructive`** — que lê como "medimos e está
péssimo" — enquanto o PDF omite o card e a prosa diz que ninguém coletou.

A tela quebra a lei do próprio produto — *ausência é `—`, nunca zero* — na peça
que vai para a conversa com o cliente.

### O scorecard não compara

Cinco cartões com um número solto cada. Comparar os cinco pilares é a função
daquela linha, e ela pede ao leitor que faça a conta de cabeça. Não há escala,
não há limiar desenhado, não há nada que diga que 55 e 80 são fronteiras.

### Três defeitos menores, do mesmo tipo

- **Acoplamento cruzado.** A etapa importa `LeadGbpOpportunitiesCard` da pasta do
  GBP — o acoplamento que a promoção do `StepCard` para o shell existiu para
  encerrar.
- **Métrica por pilar é frase pronta.** `<span>{metric.label}: {metric.value}</span>`
  em cinza, nas cinco. São as únicas métricas numéricas da tela, e o
  anti-padrão `A · B · C` de `layout.md` é exatamente isso.
- **Ação duplicada.** "Exportar PDF" aparece no cabeçalho **e** na faixa sticky do
  rodapé, com o mesmo handler.

### Um bug fora desta etapa, achado no caminho

`selectedStep === "geo"` **não está** na condição `fullBleed` de
`LeadGbpPanel.tsx:444` — a lista tem `google-profile`, `website`,
`digital-presence` e `visibility`. Mas `LeadGeoView` monta
`grid h-full min-h-0` com trilho absoluto e scroll interno.

A etapa de IA renderiza dentro de `overflow-y-auto px-3 py-3 sm:px-4 sm:py-4`:
padding em volta de um shell que espera encostar nas bordas, e dois scrolls
aninhados. Uma linha, e é a mesma que o Diagnóstico precisa mudar.

## Decisões aprovadas

- **Shell completo**, com dois papéis trocados: a coluna de oportunidades é o
  **roadmap**, e o bloco do analista é o **gancho comercial**.
- **Quatro abas:** Panorama · Pilares · Documento · Exportações.
- **A coluna filtra por pilar, não por aba.** Ver *Aba e tema não são o mesmo
  eixo aqui*.
- **Scorecard vira faixa comparativa** na mesma escala 0–100, com as zonas de 55
  e 80 como fundo e a nota como marcador. **Pilar não medido sai `—`.**
- **As métricas por pilar ganham duas camadas tipográficas**, não barra.
- **Aba Documento**: prévia do PDF na ordem do PDF, somente leitura, declarando o
  que não entra.
- **`fullBleed` ganha `geo` e `diagnosis`.**
- **A faixa sticky do rodapé sai.** "Salvar rascunho" sobe para a linha de ações
  do cabeçalho, que no shell está sempre visível.

## Fora de escopo

- **Autosave da prosa.** O resto do produto salva sozinho, e converter seria
  coerente — mas é mudança de comportamento sobre texto que vai para cliente, e
  merece decisão própria. O botão explícito continua, só muda de lugar.
- **Mudar o PDF.** `diagnosis-pdf.tsx` não é tocado. A aba Documento **lê** o que
  ele já produz; se as duas divergirem, quem está certo é o PDF.
- **Mudar a compilação.** Nenhuma regra de achado, nota, roadmap ou ponto forte
  muda. `scorePillarOpportunities` fica como está — inclusive os pesos 12 e 6.
- **Nota geral do lead.** Não existe, e a média dos cinco pilares seria número
  inventado: pilar não medido não tem nota para entrar na média, e descartá-lo
  faria a média subir quanto menos se mediu.
- **Barra nas métricas por pilar.** `DiagnosisKeyMetric.value` é `string`, sem
  denominador. Trilha sem escala mente pior que trilha ausente.
- **Repaginar as outras cinco etapas.** A correção do `fullBleed` da IA entra
  porque é uma linha no mesmo arquivo; nada além disso.

## Arquitetura

### Aba e tema não são o mesmo eixo aqui, e a spec diz por quê

Nas cinco etapas de coleta, aba e tema de oportunidade são o mesmo tipo — é o que
faz o contador da aba ser a contagem do grupo da coluna.

**No Diagnóstico não são, e forçar seria pior.** As abas aqui não são temas: são
**modos de trabalhar o mesmo documento** — ver, editar, conferir, exportar. As
oportunidades do roadmap não pertencem a nenhum desses modos; pertencem a
**pilares**. Agrupá-las por aba deixaria três das quatro com contador sempre
zero, que é exatamente o defeito que a spec da Visibilidade recusou ao não criar
uma quinta aba de SERP.

Então:

```ts
// lib/leads/diagnosis-step-tabs.ts
export type DiagnosisStepTabId =
  | "panorama"
  | "pilares"
  | "documento"
  | "exportacoes"
```

E a coluna recebe `tabs = DIAGNOSIS_PILLARS` — o eixo dela é o pilar.

`StepOpportunitiesRail` já é genérico em `Id`, então isso cabe sem fork. **Uma
mudança de contrato é necessária:** `activeTab` passa de `Id` para `Id | null`.
Ele só decide o realce do cabeçalho do grupo (`activeTab === item.id`), e no
Diagnóstico não existe pilar "ativo". Os quatro consumidores atuais seguem
passando o id deles e nada muda para eles.

### O que mora na coluna, e por quê

**Roadmap na coluna.** Ele já é lista priorizada e cross-pillar, e é o que o
analista lê em voz alta na reunião. `DiagnosisRoadmapItem` mapeia direto em
`StepOpportunity`:

```ts
{
  id: item.id,
  title: item.title,
  impact: item.impact,
  detail: `${DIAGNOSIS_PILLAR_LABELS[item.pillar]} · ${item.evidence}`,
}
```

**Gancho comercial no bloco do analista.** Curto (`DIAGNOSIS_HOOK_MAX`), sempre
relevante, escrito pelo analista: cabe nos 21,25rem da coluna e é a primeira
frase da reunião. `Ctrl/⌘ Shift E` leva o cursor até ele.

**Não reusa `StepNotesField`.** Aquele componente é feito para autosave —
`status`, `onDraftChange`, `onRetry` —, e a prosa aqui salva por botão. O slot
`analyst` é `ReactNode`, então o bloco é `Textarea` + o `ProseFooter` que já
existe, com o botão "Texto sugerido" preservado.

**O resumo executivo fica na Panorama, em largura inteira.** É a abertura do
documento; numa coluna de 340px viraria caixinha.

### O cabeçalho

```
cabeçalho fixo
├─ título + ações        Recompilar · Salvar rascunho · Exportar PDF · Abrir PDF
├─ identidade + 4 números   colapsável, chave `diagnosis:header-numbers`
├─ faixa de avisos       erro, compilando, exportando, rascunho desatualizado
└─ abas                  Panorama · Pilares · Documento · Exportações
```

Identidade: empresa, domínio, cidade, `generatedAt`, e badges para `sources` e
para o estado desatualizado.

| aba | célula | valor | trilha |
|---|---|---|---|
| `panorama` | PILARES MEDIDOS | `4` de 5 | sim — cheio é bom |
| `pilares` | ACHADOS ALTOS | contagem | **não** — não existe "de quantos seria possível" |
| `documento` | TEXTOS ESCRITOS | `5` de 7 | sim — gancho + resumo + cinco narrativas |
| `exportacoes` | ÚLTIMO PDF | `há 2 d` | **não** — data não tem escala |

A quarta é a mais útil da tela e hoje não existe em lugar nenhum: **o PDF que eu
mandaria agora está atualizado?** Tom `warning` quando
`draft.facts_fingerprint !== liveFingerprint`, com o aviso no `hint`.

### O scorecard comparativo

Cinco linhas, **uma escala só**. As zonas são o fundo, a nota é o marcador — o
padrão de `LeadVisibilityIndexAgeGauge`, e pelo mesmo motivo: os limiares são a
história, e uma barra de preenchimento os esconde.

Os cortes saem de `toneForScore`, que já existe e não muda: `< 55` ruim,
`55–79` a melhorar, `>= 80` bom.

```
Perfil no Google   ▓▓▓▓▓░░░░░░░░░░░░░░░  ●            82   0 altos · 2 médios
Website            ▓▓▓▓▓░░░░░░░●░░░░░░░              64   1 alto · 3 médios
Presença digital   ▓▓●▓▓░░░░░░░░░░░░░░░              41   3 altos · 1 médio
Visibilidade       ▓▓▓▓▓░░░░░░░░░░░░░●░              88   0 altos · 1 médio
Presença em IA     ────────────────────               —   não medido
```

**Pilar não medido não tem marcador, não tem nota e não tem tom.** Ele mostra
`—` e um chip neutro "não medido". É o que faz a tela concordar com o PDF e com
a prosa, e é o motivo desta spec existir.

A linha vira `LeadDiagnosisScoreBand.tsx`, e `LeadDiagnosisScorecard.tsx` é
substituído por ela.

### As métricas por pilar

`DiagnosisKeyMetric` é `{ id, label, value: string }` — **sem denominador**, e a
spec não inventa um. O que muda é a camada tipográfica, que é o que `layout.md`
prescreve quando o número importa e não há escala:

```
LINHA DE RÓTULO EM MICRO CAIXA-ALTA     ← text-[10px] tracking uppercase muted
  valor                                 ← text-foreground tabular-nums
```

Em vez de `label: value` inteiro em cinza, numa frase só.

Cada oportunidade do pilar ganha o chip de impacto de `StepOpportunityItem` —
hoje a lista tem só o ícone de lâmpada e o título, e o impacto some.

### A aba Documento

A prévia do PDF do cliente, **na ordem do PDF**, lida de `draft.document`:

1. Resumo executivo
2. Scorecard — **só os pilares medidos**, como `diagnosis-pdf.tsx:191` faz
3. Pontos fortes
4. Achados prioritários
5. Roadmap recomendado
6. Por pilar — narrativa e oportunidades
7. O que as IAs já dizem — `geoEvidence`
8. Limitações da coleta

Somente leitura, na densidade de leitura e não na operacional. **Declara o que
não vai**: onde o PDF omite uma seção, a prévia imprime uma linha dizendo por quê
— *"Presença em IA não entra: não foi medida"* —, porque no PDF a ausência é
silêncio e aqui ela precisa ser visível.

É a generalização de `GeoEvidencePreview`, cujo próprio comentário já dá a razão:
sem isso, o analista só descobre o conteúdo da seção abrindo o documento já
exportado.

**A prévia não reimplementa o PDF.** Ela lê os mesmos campos de
`DiagnosisDocument`; quando as duas divergirem, quem está certo é o PDF.

### A aba Exportações

A lista que hoje é o card "PDFs exportados", com `is_current`, data e abrir. Mais
o aviso de desatualizado, que hoje mora só no cabeçalho.

### As correções que vêm junto

- `fullBleed` em `LeadGbpPanel.tsx:444` ganha `selectedStep === "geo"` e
  `selectedStep === "diagnosis"`.
- `LeadGbpOpportunitiesCard` sai do Diagnóstico. O roadmap vira coluna.
- A faixa sticky do rodapé sai inteira.

## Arquivos previstos

**Criar**

| arquivo | responsabilidade |
|---|---|
| `lib/leads/diagnosis-step-tabs.ts` | `DiagnosisStepTabId`, `DIAGNOSIS_STEP_TABS` |
| `components/custom/LeadDiagnosisPanel/use-diagnosis-controller.ts` | todo o estado e as quatro ações |
| `LeadDiagnosisView.tsx` | grid `central \| coluna`, abas, atalhos |
| `LeadDiagnosisHeader.tsx` | cabeçalho fixo com colapso |
| `LeadDiagnosisIdentityCell.tsx` | empresa, domínio, fontes, estado |
| `LeadDiagnosisMetricCells.tsx` | os quatro big numbers |
| `LeadDiagnosisTabPanels.tsx` | o roteador das quatro abas |
| `LeadDiagnosisScoreBand.tsx` | a faixa comparativa de notas |
| `LeadDiagnosisPillarCard.tsx` | um pilar: métricas, narrativa, oportunidades |
| `LeadDiagnosisDocumentPreview.tsx` | a aba Documento |
| `LeadDiagnosisExports.tsx` | a aba Exportações |
| `LeadDiagnosisAnalystBlock.tsx` | o gancho comercial no pé da coluna |
| `LeadDiagnosisProseField.tsx` | `Textarea` + `ProseFooter`, hoje embutidos |

**Modificar**

| arquivo | mudança |
|---|---|
| `components/custom/LeadGbpPanel/LeadGbpPanel.tsx:444` | `fullBleed` ganha `geo` e `diagnosis` |
| `components/custom/LeadStepShell/StepOpportunitiesRail.tsx` | `activeTab: Id \| null` |
| `LeadDiagnosisPanel.tsx` | vira casca fina sobre o controller e a view |
| `LeadDiagnosisStepHeader.tsx` | ganha "Salvar rascunho", que vem da faixa sticky removida |
| `LeadDiagnosisScorecard.tsx` | **removido**, substituído pela faixa |
| `.claude/skills/suite-frontend/references/{components,layout}.md` | a faixa de notas em Formas de medida; o Diagnóstico no arquétipo; a ressalva de que aba e tema divergem aqui |

## Critérios de aceitação

1. A etapa monta o shell de tela cheia: cabeçalho fora do scroll, só o corpo
   rola, fundo `bg-accent/45`, sem padding do contêiner pai.
2. **A etapa de IA também** — `fullBleed` passa a cobri-la, e o shell dela encosta
   nas bordas.
3. Os quatro big numbers aparecem, colapsam com persistência em
   `diagnosis:header-numbers`, e clicar em cada um leva à aba correspondente.
4. A coluna abre e fecha com `Ctrl/⌘ B`, permanece montada com `inert` quando
   recolhida, e guarda a preferência em `diagnosis:opportunities-rail`.
5. `Ctrl/⌘ Shift E` abre o bloco do gancho e leva o cursor ao campo; de dentro,
   recolhe e devolve o foco ao painel.
6. O texto não salvo sobrevive à troca de aba e ao recolhimento da coluna.
7. **Pilar não medido mostra `—` e o chip "não medido", nunca `0` vermelho** — na
   faixa de notas, no big number e na prévia do documento.
8. A coluna filtra por pilar, e o cabeçalho de grupo não realça nenhum — porque
   não há pilar ativo.
9. A prévia do Documento mostra as oito seções na ordem do PDF e declara as que
   não entram.
10. Lead sem rascunho abre no estado "Pronto para compilar"; lead bloqueado, no
    estado "Etapa bloqueada". Os dois dentro do shell, não no lugar dele.
11. `pnpm test`, `pnpm lint` e `pnpm exec tsc --noEmit` limpos; os greps de
    `checks.md` no baseline de 2026-09-10.
12. Responsivo: abaixo de `xl` a coluna vira a última seção do scroll; nada rola
    na horizontal.

## Autocrítica

**O que foi cortado:** a nota geral do lead, o autosave da prosa, e uma quinta
aba que mostraria o histórico de mudanças entre compilações.

**Por quê:** a nota geral exigiria uma média sobre pilares que nem sempre foram
medidos, e descartar os não medidos faz a média **subir quanto menos se mediu** —
é o `dominance: 1` outra vez, com outro nome. O autosave é coerente com o resto
do produto e continua sendo a coisa certa, mas é mudança de comportamento sobre
texto que vai para cliente, e merece a própria aprovação em vez de carona numa
repaginação. O histórico entre compilações é a ideia mais interessante das três —
`facts_fingerprint` já existe e daria para dizer *o que* mudou desde o último
PDF —, e está fora porque hoje só se guarda o rascunho atual: não há série para
comparar, e construí-la é trabalho de dado, não de tela.
