# Redesign da etapa "Presença digital" — especificação

## Objetivo

Reorganizar a etapa **Presença digital** da aba Oportunidade do `LeadDetailDialog`. Hoje ela é uma pilha de quatro blocos dentro do slot genérico do `LeadGbpPanel`: cabeçalho, dois cards de checks, N cards de rede, card de identidade visual e, no fim, as oportunidades.

O redesign mantém exatamente os mesmos dados — `lead_digital_presence_audits.review` e os sinais do crawl em `lead_website_audits` — e troca a estrutura pelo shell que Perfil no Google e Website já usam: cabeçalho fixo com identidade e quatro big numbers, abas internas, coluna de oportunidades colapsável com o bloco do analista no pé, e modo reunião.

É a terceira e última etapa da trilha a entrar no shell nesta rodada. Visibilidade e Diagnóstico ficam de fora.

**Nenhuma migração de banco. Nenhum token de cor novo. Nenhum achado novo é criado.** O `review` é `jsonb`: o campo de notas entra por parser e validação, sem tocar no schema.

## Diagnóstico

Treze constatações, cada uma com o arquivo que a produz.

**A etapa não usa o shell.** `LeadDigitalPresencePanel.tsx:180` é um `flex flex-col gap-3`. Sem `StepTabs`, sem `StepOpportunitiesRail`, sem `StepStat`/`StepMeter`, sem `StepNotesField`. É a única etapa da trilha que não monta nenhum dos cinco.

**Ela não é tela cheia.** `LeadGbpPanel.tsx:427` — `fullBleed` cobre `google-profile` e `website`; presença cai no container com `overflow-y-auto px-3 py-3`. O cabeçalho rola junto com o conteúdo e o erro de salvamento fica no rodapé da pilha (`LeadDigitalPresencePanel.tsx:198`), fora de vista justamente quando importa.

**Não existe modo reunião.** `LeadDigitalPresencePanel.types.ts` não declara `readingMode` e o `LeadGbpPanel` não o passa. Nas outras duas etapas o modo esconde edição; aqui os inputs continuam vivos na frente do cliente.

**Dependência atravessada de outra etapa.** `LeadDigitalPresenceChecks.tsx:7`, `LeadDigitalPresenceIdentity.tsx:6` e `LeadDigitalPresenceNetworks.tsx:15` importam `LeadGbpCard` de `LeadGbpPanel/`; `LeadDigitalPresencePanel.tsx:11` importa `LeadGbpOpportunitiesCard`. Presença é a última etapa de auditoria ainda usando o card de oportunidades no corpo do scroll.

**`<Input type="date">` — o único do repositório inteiro.** `LeadDigitalPresenceNetworks.tsx:182`. Controle nativo dentro de um campo de 28px: ícone do navegador, máscara do navegador, sem tema escuro, sem "Hoje", sem limpar. E o `DateTimePicker` que existe **não serve**: ele exige horário e "última postagem" é data civil.

**Checkbox nativo com classe que não faz efeito.** `LeadDigitalPresenceNetworks.tsx:136` — `<input type="checkbox" className="size-4 rounded border-border text-primary">`. `text-primary` não pinta checkbox nativo; o que renderiza é o padrão do sistema operacional. `components/ui/checkbox.tsx` existe e não é usado aqui.

**Radiogroup escrito à mão.** `LeadDigitalPresenceIdentity.tsx:70` — `role="radiogroup"` com `<button role="radio">` e classes de estado próprias. É o papel do `ToggleGroup`.

**Estado codificado só em palavra cinza.** `LeadDigitalPresenceNetworks.tsx:196` imprime `socialPostingAgeLabel(...)` em `text-muted-foreground`. "Parado há mais de 90 dias" lê exatamente igual a "Publicou hoje": mesma cor, mesmo peso, mesma posição. Fere o piso de acessibilidade — estado sem texto de tom, sem ícone, sem forma.

**A etapa não tem número nenhum.** Nada declara quanto foi preenchido, quantas redes estão paradas, se o rastreamento está instalado, quantos seguidores somam. Para saber o estado da etapa é preciso ler os N cards. As outras duas etapas resolvem isso com identidade mais quatro big numbers fora do scroll.

**Cada rede aparece duas vezes.** "Instagram" existe no card de rede (seguidores, data) e de novo no card "Redes no site" (`digital-presence-presenters.ts:104`, alinhamento com o cadastro). Dois lugares, mesma entidade, nenhum dos dois completo.

**Cartões idênticos para hierarquias diferentes.** Com cinco redes cadastradas são oito `LeadGbpCard` visualmente iguais em `xl:grid-cols-2` — o tell que `layout.md` nomeia. Pior: `grid` faz a linha tomar a altura do card mais alto, e cards de rede têm alturas naturais diferentes.

**A ressalva mais importante é a última linha da página.** `LeadDigitalPresencePanel.tsx:206`: "A integração usa a coleta do Website quando disponível." Sem crawl, metade dos checks é `pending` e nenhum número de site existe. Isso é o primeiro fato da etapa, não uma nota de rodapé cinza.

**O componente de layout faz tudo.** `LeadDigitalPresencePanel.tsx` tem 218 linhas com estado do review, debounce, refs de valor recente, persistência, quatro derivações e a composição da tela. É o mesmo acúmulo que Website tinha antes do controller.

## Arquitetura

### Árvore de componentes

```
LeadGbpPanel                              ← 2 linhas mudam
└─ LeadDigitalPresencePanel               fino: vazios e composição
   └─ LeadDigitalPresenceView             grid, Tabs, painéis, rail
      ├─ LeadDigitalPresenceHeader        cabeçalho fixo, fora do scroll
      │  ├─ LeadDigitalPresenceStepHeader título, ações, chip de salvo
      │  ├─ LeadDigitalPresenceIdentityCell   constelação de redes
      │  ├─ LeadDigitalPresenceMetricCells    os quatro big numbers
      │  └─ StepTabs                      Redes · Site e marca
      ├─ corpo min-h-0 overflow-y-auto    bg-accent/45
      │  └─ LeadDigitalPresenceTabPanels
      │     ├─ aba Redes  → LeadDigitalPresenceNetworkCard (N)
      │     └─ aba Site e marca → LeadDigitalPresenceTrackingCard
      │                           LeadDigitalPresenceSiteLinksCard
      │                           LeadDigitalPresenceBrandCard
      └─ StepOpportunitiesRail            21.25rem ⇄ 3rem
         └─ LeadDigitalPresenceAnalystBlock
```

`LeadGbpPanel.tsx` muda em duas linhas: `fullBleed` passa a incluir `digital-presence`, e `readingMode` desce para o painel. Nenhuma outra etapa é tocada.

### `useDigitalPresenceController`

Sai de `LeadDigitalPresencePanel.tsx` para `use-digital-presence-controller.ts` tudo que não é layout. Devolve:

| Grupo | Campos |
| --- | --- |
| edição | `review`, `canEdit`, `handleReviewChange`, `handleNotesDraftChange`, `retrySave` |
| salvamento | `saveStatus`, `saveError` |
| contexto | `channels` (sociais, ordenadas), `today`, `websiteAudit`, `signals`, `hasCollect` |
| achados | `opportunities`, `grouped`, `counts` |
| leitura | `tally`, `networkStates`, `siteLinks` |

O debounce de 800ms, os `ref` de valor mais recente e o reset por chave no render continuam como estão — o padrão já está certo, só muda de arquivo.

### Estado novo

`DigitalPresenceReview` ganha um campo:

```ts
export type DigitalPresenceReview = {
  identity: DigitalPresenceIdentityAnswer
  networks: Record<string, DigitalPresenceNetworkAnswer>
  notes: string                                   // novo
}

export const DIGITAL_PRESENCE_NOTES_MAX = 2000    // igual a GBP e Website
```

Atravessa `readDigitalPresenceReview`, `emptyDigitalPresenceReview`, `digitalPresenceReviewDraft`, `serializeDigitalPresenceReviewDraft`, `stampDigitalPresenceReview` e `pruneDigitalPresenceNetworks`, mais um `refine` em `lib/validations/lead-digital-presence.ts`. A coluna é `jsonb`: **sem migração**.

**`notes` não entra em `isDigitalPresenceComplete`.** Ela é contexto do analista, não resposta obrigatória — e a completude da etapa é o portão de `compile-lead-diagnosis.ts:168`. Um campo livre em branco não pode travar o diagnóstico.

### Módulos novos e alterados em `lib`

| Arquivo | O que entra |
| --- | --- |
| `lib/leads/digital-presence-step-tabs.ts` (novo) | `DIGITAL_PRESENCE_STEP_TABS`, `DigitalPresenceStepTabId` |
| `lib/leads/digital-presence-opportunities.ts` | `digitalPresenceOpportunityTheme`, `digitalPresenceOpportunitiesByTheme` |
| `lib/leads/digital-presence-presenters.ts` | `digitalPresenceNetworkStates`, `digitalPresenceSiteLinks`, `digitalPresenceTally`; sai `digitalPresenceCheckSections` |
| `lib/leads/digital-presence.ts` | `socialPostingAge` devolvendo `{ label, tone, days }` |
| `lib/leads/digital-presence-review.ts` | `notes` |
| `lib/validations/lead-digital-presence.ts` | limite de `notes` |

`mergeDigitalPresenceOpportunities` **não muda de assinatura nem de saída** — `diagnosis-compile.ts:351` e `LeadGbpPanel.tsx:291` a consomem. O agrupamento por tema é função nova ao lado, por `reduce` sobre a lista recebida: a soma dos grupos é a lista, por construção, e nada some entre o contador da aba e a coluna.

`digitalPresenceCheckSections` sai porque só `LeadDigitalPresencePanel.tsx:115` a consome, e o novo desenho não tem "seções de check" — tem estado por rede e três blocos de site.

### `components/custom/DatePicker` (novo)

Data civil, sem horário. Composto de `components/ui/popover` e `components/ui/calendar`.

```ts
export type DatePickerProps = {
  id: string
  value?: string                 // "YYYY-MM-DD" ou ""
  onValueChange?: (value: string) => void
  label?: string
  placeholder?: string
  error?: string
  disabled?: boolean
  clearable?: boolean
  min?: string
  max?: string
  className?: string
  onBlur?: () => void
}
```

Contrato:

- Gatilho de 28px, com `RiCalendarLine` à esquerda e o valor em `formatDateOnly(value)`, `tabular-nums`. Vazio mostra o `placeholder` em `muted-foreground` — nunca uma máscara.
- Selecionar um dia **commita e fecha**. Não há segundo passo: o `DateTimePicker` tem dois chips porque tem duas grandezas; aqui há uma.
- Rodapé com "Hoje", desabilitado quando `today` cai fora de `min`/`max`.
- Limpar é um botão irmão do gatilho, posicionado em absoluto à direita — **não** um botão dentro do gatilho. É o que evita o `nativeButton={false} render={<div/>}` que o `DateTimePicker` precisou fazer para acomodar botão dentro de botão.
- Erro em `aria-describedby`, `aria-invalid` no gatilho.

**Nada de `@base-ui/react` direto.** O `DateTimePicker` importa `Popover` do pacote e é um dos dois itens do baseline de `checks.md`; o `DatePicker` usa o primitive local e não sobe esse número. O `DateTimePicker` fica como está — refatorá-lo é trabalho próprio, com aprovação própria.

## Abas e temas de oportunidade

Duas abas. `DigitalPresenceStepTabId = "redes" | "site"`.

| Aba | Rótulo | O que mora nela |
| --- | --- | --- |
| `redes` | Redes | um card por rede social cadastrada: seguidores, última postagem, acessibilidade e alinhamento com o site |
| `site` | Site e marca | rastreamento, redes encontradas no site, identidade visual |

O tema de cada achado segue uma regra só: **a oportunidade mora na aba onde o analista a vê.**

| Id do achado | Tema | Por quê |
| --- | --- | --- |
| `missing_google_tag` | `site` | é sobre o HTML do site |
| `pixel_not_in_html` | `site` | idem |
| `social_not_linked_on_site:*` | `redes` | o chip está no card daquela rede |
| `social_handle_mismatch:*` | `redes` | idem |
| `social_on_site_unregistered:*` | `site` | essa rede **não tem card** — só existe na lista do site |
| `stale_social_posts:*` | `redes` | vem da data que o analista digitou no card |
| `review:identity` | `site` | o veredito é editado no bloco de marca |

Os ids de gap são literais de template (`social_not_linked_on_site:${SocialChannelType}`), então `tsc` não consegue exigir exaustividade como faz no `Record` do Website. `digitalPresenceOpportunityTheme` casa por prefixo e tem um `default` que devolve `site` — id fora do mapa continua visível na coluna em vez de sumir do agrupamento.

## Cabeçalho fixo da etapa

Três faixas mais as abas, tudo fora do scroll.

### Célula de identidade

Primeira coluna da faixa, mesma altura das outras quatro. Carrega:

1. Nome da empresa.
2. A fonte que alimenta a etapa: `coleta do site há 3 dias` ou `sem coleta do site`.
3. **A constelação de redes** — a fileira dos glifos `react-icons/ri` das redes cadastradas, cada um num quadrado de 28px, com o estado na camada de cor:

| Estado | Superfície |
| --- | --- |
| alinhada | `bg-primary/10 text-primary` |
| sem link no site, ou handle divergente | `bg-warning/10 text-warning` |
| no site sem cadastro | `border border-dashed border-border text-muted-foreground` |
| inacessível | `bg-accent text-muted-foreground/60` |
| sem coleta do site | `bg-accent text-muted-foreground` |

Cada glifo é um `span` com `title` e nome acessível dizendo rede e estado — o estado nunca depende só da cor. Em um relance a célula é o retrato da presença; hoje esse retrato exige ler oito cards.

4. Badge do veredito de identidade visual quando julgado (`Ok` em `success`, `Problema` em `warning`).

### Os quatro big numbers

Cada um é a manchete de uma aba e leva até ela: `button` com `aria-label` nomeando o destino, porque o rótulo visível (`ATIVIDADE`) não diz que clicar leva a algum lugar.

| Rótulo | Valor | Unidade | Forma | Aba |
| --- | --- | --- | --- | --- |
| ATIVIDADE | redes medidas que não estão paradas | `de {medidas} redes medidas` | `StepMeter`, `stepShareTone` | Redes |
| SEGUIDORES | soma dos seguidores | `somados em {k} de {N} redes` | **sem trilha** | Redes |
| RASTREAMENTO | tags encontradas | `de 2 tags no HTML` | `StepMeter`, `stepShareTone` | Site e marca |
| ALINHAMENTO | redes batendo com o site | `de {N} redes cadastradas` | `StepMeter`, `stepShareTone` | Site e marca |

**Denominador de ATIVIDADE é "redes medidas", não "redes cadastradas".** Uma rede sem data não é uma rede parada — é uma rede que ninguém olhou. Contá-la no denominador faria a barra encolher por falta de trabalho do analista e ler como problema do lead.

**SEGUIDORES não ganha trilha.** Não existe denominador: sem mediana de mercado, trilha sem escala mente pior que a ausência dela.

**Três checagens de forma.** Nenhuma das quatro é métrica de limiar invertido — não cabe régua de banda aqui, diferente do Website com os Core Web Vitals. Nas três que têm trilha, "cheio é bom" vale: mais redes ativas, mais tags, mais alinhamento são todos melhores. E a quarta não tem trilha justamente porque não tem escala.

**Ausência, caso a caso:**

| Situação | O que a célula mostra |
| --- | --- |
| sem coleta do site | RASTREAMENTO e ALINHAMENTO em `—`, unidade `sem coleta do site`, tom neutro, **sem trilha** |
| nenhuma rede com data | ATIVIDADE em `—`, unidade `nenhuma rede medida`, sem trilha |
| nenhuma rede com seguidores | SEGUIDORES em `—`, unidade `nenhuma rede medida` |
| nenhuma rede cadastrada | ATIVIDADE, SEGUIDORES e ALINHAMENTO em `—` |

Nunca `0 de 2`: zero afirma que as tags não existem, e a verdade é que ninguém olhou.

A faixa inteira colapsa por `grid-template-rows: 1fr → 0fr`, com o botão na linha das abas e a preferência em `presence:header-numbers`.

### Faixa de avisos

Só ocupa altura quando há o que dizer: erro de salvamento (`role="alert"`) e, quando não há crawl, a linha que hoje mora no rodapé. Solta no meio do scroll, ela rolava para fora da tela junto com o conteúdo.

## Painéis das abas

### Redes

Um card por rede social cadastrada, em **duas colunas de fluxo** (`flex flex-col` lado a lado), não `grid-cols-2`: os chips de idade e de alinhamento entram e saem, as alturas naturais divergem, e o grid deixaria vão embaixo do card curto.

```
┌──────────────────────────────────────────────────┐
│ [glifo]  Instagram                   ★ Principal │
│          @rankupdigital  ↗                       │
│ ──────────────────────────────────────────────── │
│  SEGUIDORES            ÚLTIMA POSTAGEM           │
│  [ 12.480        ]     [ 12 fev 2026          ✕ ]│
│                        ● Há 27 dias              │
│ ──────────────────────────────────────────────── │
│  ⚠ Sem link no site      ☐ Perfil inacessível    │
└──────────────────────────────────────────────────┘
```

- **A superfície do card carrega o estado**, reusando o `SURFACE` do `StepStat` — cujos alfas já foram conferidos por cálculo para AA em claro e escuro. Rede parada em `warning`; inacessível em `bg-muted/40` com o conteúdo esmaecido; em dia em `card` limpo.
- **A idade da postagem é chip com tom e marcador**, vindo de `socialPostingAge`: `Publicou hoje` e `Há 27 dias` em `success`, a faixa intermediária em `warning`, `Parado há mais de 90 dias` em `danger`. Bolinha à esquerda: o estado não depende só de cor.
- **Seguidores** com separador de milhar na exibição e dígitos crus no estado, `tabular-nums`. Vazio mostra o placeholder `—`, nunca `0`.
- **Última postagem** é o `DatePicker`, com `max={today}` e `clearable`.
- **"Perfil inacessível"** é `Checkbox` do registry dentro de um rótulo clicável. Marcado, desabilita os dois campos e esmaece o card: a leitura é "esta rede não foi medida", não "esta rede tem zero".
- **O chip de alinhamento mora aqui**, vindo de `digitalPresenceNetworkStates`. É o fim da duplicação — Instagram deixa de existir em dois cards. Sem coleta do site o chip não aparece: o estado é desconhecido, e chip nenhum é mais honesto que um chip cinza afirmando o quê.

Sem rede cadastrada, a aba mostra um `Empty` que aponta para onde se resolve: o cadastro de canais do lead.

### Site e marca

Três blocos, em duas colunas de fluxo.

**Rastreamento.** Um `StepStat` por tag (Google Tag / GTM, Pixel do Facebook), com o tom do estado e o ícone junto. A ressalva do Pixel — *pode estar só dentro do GTM* — viaja no `aside` do `StepSectionLabel`, presa ao rótulo que ela qualifica, não num parágrafo cinza abaixo.

**Redes encontradas no site.** Linha ranqueada a partir dos sinais do crawl, com glifo, handle encontrado e estado: bate com o cadastro, diverge do cadastro, ou está no site sem cadastro. As últimas são as únicas redes sem card na outra aba, e é aqui que ganham ação.

**Identidade visual.** O veredito em `ToggleGroup` (`Ok` / `Problema`), com o `FieldReveal` que já existe abrindo a nota. A mesma nota é editável pelo bloco do analista — um dado, dois lugares onde faz sentido tocá-lo.

Sem coleta do site, os três blocos viram um `Empty` só: *A coleta do Website alimenta esta aba. Analise o site para preencher rastreamento e alinhamento.* É assim que a ressalva sai do rodapé da página e vira o conteúdo dela.

**Sem botão levando à etapa Website.** `setSelectedStep` mora no `LeadGbpPanel` e não desce para nenhum painel; passá-lo só para este vazio seria plumbing novo para um destino que a trilha à esquerda já oferece, a dois cliques de distância e sempre visível.

## Coluna de oportunidades

`StepOpportunitiesRail` sem alteração, com `id="presence-opportunities-rail"`, os dois filtros das abas mais "Todas", e `storageKey` própria: `presence:opportunities-rail`. Recolher aqui não recolhe no Website — a densidade das etapas é diferente.

O total do rail é `controller.opportunities.length`, a mesma lista que `LeadGbpPanel.tsx:291` usa para o badge da trilha. Os dois não podem divergir porque são a mesma função.

`emptyLabel` da etapa: *Nenhum problema identificado nesta etapa.*

## Bloco do analista — caminho de escrita

`LeadDigitalPresenceAnalystBlock`, no pé da coluna, com `Ctrl/⌘ E`, `BLOCK_ID = "presence-analyst-block"` e preferência em `presence:analyst-block`. Dois campos, ambos `StepNotesField`, **os dois montados o tempo todo** com `hidden` no inativo — desmontar devolveria o textarea ao valor do servidor e comeria o rascunho dentro do debounce.

| Campo | Grava em | Limite |
| --- | --- | --- |
| Notas da etapa | `review.notes` | 2000 |
| Achado de marca | `review.identity.note` | 400 |

Caminho de escrita, ponta a ponta: `StepNotesField` → `handleNotesDraftChange` → debounce de 800ms → `serializeDigitalPresenceReviewDraft` → `upsertLeadDigitalPresence` → `readDigitalPresenceReview` → estado local re-sincronizado pelo retorno da action. Idêntico ao que os campos existentes já fazem; só há um campo novo no JSON.

`syncKey` é o id do audit (ou o id do lead, quando ainda não há audit) — é o que re-sincroniza o valor local quando o registro editado muda, e só então.

## Colapso, atalho e modo reunião

| Preferência | Chave |
| --- | --- |
| coluna de oportunidades | `presence:opportunities-rail` |
| faixa de identidade e números | `presence:header-numbers` |
| bloco do analista | `presence:analyst-block` |

`Ctrl/⌘ B` recolhe a coluna; `Ctrl/⌘ E` faz a ida e volta do bloco do analista, com `allowInFields` para poder sair de dentro do textarea. Ambos por `useCaptureShortcut` em captura, que é o que impede o sidebar e o painel mobile de reagirem ao mesmo toque enquanto o diálogo está aberto.

`readingMode` esconde edição e nunca habilita nada: some o bloco do analista, os campos viram leitura, o `ToggleGroup` vira o rótulo do veredito. Os números e os achados continuam — é o modo de mostrar a etapa para o cliente.

## Acessibilidade

- Todo controle só com ícone tem `aria-label`: os dois botões da coluna, o botão de colapso da faixa, o limpar do `DatePicker`.
- Big number é `button` com `aria-label` nomeando a aba de destino.
- Estado nunca só por cor: chip de idade tem marcador e texto; glifo da constelação tem nome acessível; card de rede parada tem chip, não só borda.
- `aria-invalid` e `aria-describedby` no `DatePicker` com erro.
- `aria-expanded` e `aria-controls` em coluna, faixa e bloco do analista.
- A coluna recolhida continua montada com `inert` — preserva filtro, campo do analista e rascunho não salvo.
- `prefers-reduced-motion` respeitado em tudo que anima.

## Responsivo

Abaixo de `xl` a coluna de oportunidades não é coluna: vira a última seção do scroll, e o rail de 48px não aparece — ele é posicionado em absoluto e só faz sentido no layout de duas colunas.

A faixa de identidade e números vai de cinco colunas em `xl` para `grid-cols-2` no estreito. Os cards de rede caem para uma coluna de fluxo. A página nunca rola na horizontal.

## Loading

Enquanto `loading` do diálogo, a etapa mostra skeleton com a forma do que vem: a faixa de cinco células e dois cards de rede. Skeleton com a forma errada promete um layout que não chega.

## Cópia

Sentence case, sem filler, sem exclamação.

| Onde | Texto |
| --- | --- |
| título | Presença digital |
| descrição | Redes, rastreamento e identidade da marca. |
| aba 1 | Redes |
| aba 2 | Site e marca |
| big numbers | ATIVIDADE · SEGUIDORES · RASTREAMENTO · ALINHAMENTO |
| vazio de redes | Nenhuma rede cadastrada. Inclua Instagram, LinkedIn ou outras no cadastro do lead. |
| vazio de coleta | A coleta do Website alimenta esta aba. Analise o site para preencher rastreamento e alinhamento. |
| vazio da coluna | Nenhum problema identificado nesta etapa. |
| notas | Notas da etapa · *Contexto das redes, histórico com a agência, o que a coleta não vê* |
| achado | Achado de marca · *Logo, foto e cores das redes estão consistentes com a marca?* |
| inacessível | Perfil inacessível |
| erro de salvamento | Não foi possível salvar. Tente novamente. |

## Fora de escopo

- Refatorar o `DateTimePicker` para compor o `DatePicker`.
- Mover `LeadGbpCard` para `LeadStepShell` — Website, Visibilidade e Diagnóstico também o consomem; é refactor de outro assunto.
- As etapas Visibilidade e Diagnóstico.
- Coleta própria da presença. A etapa lê o crawl do Website; ela não coleta nada e não ganha botão de coletar.
- Os três débitos do baseline de `checks.md` (`NavTree`, base-ui direto nos dois pickers, `LeadGbpAuditStep` sem `useReducedMotion`).

## Verificação

```bash
cd "C:/Users/Eduardo Zamai/Documents/suite"
pnpm exec tsc --noEmit
pnpm lint
```

Mais os greps de `references/checks.md`, comparados ao baseline: cor cravada 5, base-ui direto 2, anima sem reduced 1, todos os outros 0. O `DatePicker` **não pode** subir o segundo para 3 — ele usa o primitive local.

Um grep próprio desta rodada, que precisa zerar:

```bash
grep -rnE 'type="(date|checkbox)"' --include=*.tsx components/custom app | wc -l
```

Hoje esse grep devolve 2, e as duas ocorrências são as das linhas 136 e 182 de `LeadDigitalPresenceNetworks.tsx`. Depois desta rodada ele devolve 0 — não há controle nativo desses dois tipos em nenhum outro lugar do produto.

**Verificação visual é do usuário.** Ele valida na sessão que já tem aberta; nenhuma tarefa deste plano pede login nem abre navegador.
