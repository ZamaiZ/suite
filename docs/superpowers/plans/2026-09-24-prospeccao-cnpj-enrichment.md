# Enriquecimento de CNPJ na prospecção — Plano de implementação

> **Para execução agentic:** use `superpowers:executing-plans` para implementar este plano tarefa por tarefa. As tarefas compartilham a mesma migração, modelo de candidato e contrato de importação; não dividir entre agentes sem autorização explícita. Cada etapa usa caixas de seleção.

**Objetivo:** pesquisar CNPJs para candidatos de prospecção por meio de fontes gratuitas aprovadas, registrar evidências e confirmação humana, e levar o CNPJ confirmado ao lead na importação.

**Arquitetura:** um gate documental aprova pelo menos um provedor que faça busca por nome sem CNPJ prévio e permita uso comercial automatizado dentro de uma cota grátis. Depois do gate, uma fila serial e retomável cria tentativas auditáveis por candidato, normaliza correspondências, exige confirmação humana e transfere apenas o CNPJ confirmado. O CNPJ do lead é uma coluna própria, separada do `tax_id` usado no fechamento.

**Stack:** Next.js App Router e Server Actions, React, TypeScript, Zod, Supabase/PostgreSQL com RLS e RPC, componentes existentes do Suite.

**Spec:** `docs/superpowers/specs/2026-09-24-prospeccao-cnpj-enrichment-design.md`

## Restrições globais

- Não executar `git`, `typecheck`, `build`, `lint` ou `test`.
- Não criar testes nem trabalhar com testes; usar inspeção manual de código e revisão dos fluxos.
- Não ativar fonte antes de confirmar busca por nome, uso comercial automatizado, cota gratuita, política de retenção e informação suficiente para associar o estabelecimento.
- OpenCNPJ/BigQuery foi aprovado pelo usuário para implementação condicional; manter desabilitado sem credenciais/projeto, dry run aceitável e revisão dos termos/licença dos dados.
- Não fazer scraping de Google, LinkedIn, CAPTCHA nem de página sem autorização documentada.
- Não fazer chamada externa em carregamento, digitação, seleção, abertura de diálogo ou mudança de filtro.
- Processar candidatos e provedores sequencialmente; nunca depender de `Promise.all` para avançar fila.
- Manter tentativas, resultados e evidências normalizados; não persistir payload bruto integral nem dados de sócios.
- Guardar CNPJ como string de 14 posições e aplicar regras atuais da Receita, sem assumir formato exclusivamente numérico.
- Correspondência só vira confirmada por ação explícita de integrante comercial.
- Copiar para `leads.cnpj` somente um CNPJ confirmado; não reutilizar `leads.tax_id`, que é condicionado às etapas de fechamento.
- Revalidar autenticação, escopo de execução/candidato, Zod e autorização em toda Server Action e RPC mutável.
- Antes de escrever código Next.js, ler em `node_modules/next/dist/docs/` os guias atuais relevantes para Server Actions, mutações e formulários; antes de UI, ler `.agents/skills/suite-frontend/SKILL.md`.
- Filtros gerais da prospecção, integrações pagas, fluxo de planilha e enriquecimento de pessoas ficam fora do escopo.

## Mapa de arquivos

### Gate e evidências do provedor

- Criar `docs/auditoria/evidencias/2026-09-24-prospeccao-cnpj/README.md` — matriz com endpoint, pesquisa por nome, autenticação, cota, rate limit, termos de uso comercial, campos devolvidos, retenção permitida e decisão por fonte.

### Domínio e provedores

- Criar `lib/prospecting/cnpj.ts` — normalização textual, validação de formato/dígitos e tipos de estado do CNPJ.
- Criar `lib/prospecting/cnpj-matching.ts` — comparação do estabelecimento retornado com nome, cidade/UF, endereço, telefone e domínio do candidato.
- Criar `lib/prospecting/cnpj-provider.ts` — interfaces neutras de consulta e resultado normalizado.
- Criar `lib/prospecting/cnpj-provider-adapter.ts` — adaptador da fonte que passou pela Tarefa 1; não criar adaptador antes do gate.
- Modificar `lib/prospecting/reads.ts` — tipos/DTOs do status CNPJ e do lote na fronteira de leitura.

### Persistência e Server Actions

- Criar `supabase/migrations/20261007000000_prospecting_cnpj_enrichment.sql` — coluna de CNPJ confirmado em candidatos e leads, lotes/tentativas/resultados, constraints, índices, RLS e RPCs idempotentes de claim, conclusão e confirmação.
- Criar `app/actions/prospecting/cnpj.ts` — iniciar/avançar lote, listar matches de um candidato e confirmar resultado.
- Modificar `app/actions/prospecting/read.ts` — incluir CNPJ confirmado/status no DTO de candidatos.
- Modificar `app/actions/prospecting/index.ts` — exportar actions/types CNPJ.
- Modificar `app/actions/prospecting/import.ts` e a RPC `import_prospecting_candidate` na nova migração — ler CNPJ confirmado do candidato e gravar em `leads.cnpj` dentro da transação atual.

### Interface de prospecção e lead

- Modificar `components/custom/Prospecting/ProspectingCandidateTable.tsx` — coluna CNPJ/status e ponto de revisão por linha.
- Modificar `components/custom/Prospecting/ProspectingRunPage.tsx` — ação sobre seleção, progresso retomável e abertura da revisão.
- Criar `components/custom/Prospecting/ProspectingCnpjReviewDialog.tsx` — revisão de correspondência com fonte/evidência.
- Modificar `components/custom/LeadForm/LeadForm.tsx` e `components/custom/LeadForm/LeadForm.types.ts` — campo opcional de CNPJ seguindo os padrões de validação do Suite.
- Modificar `lib/validations/lead.ts` e `lib/leads/types.ts` — CNPJ em payload/registro de lead, separado de `tax_id`.
- Modificar `app/actions/leads/create-lead.ts` e `app/actions/leads/update-lead.ts` — aceitar/gravar a coluna nova sem alterar fluxo de fechamento.
- Modificar `components/custom/LeadDetailDialog/LeadRecordPanel.tsx` — exibir CNPJ salvo.

## Foco da revisão

1. **Fonte que só consulta número conhecido ou cuja cota/termos não autorizam automação comercial:** pertence à Tarefa 1; não há mudança de produto se o gate falhar.
2. **CNPJ alfanumérico ou com dígitos verificadores inválidos:** pertence à Tarefa 2; preservar texto original normalizado e rejeitar confirmação estrutural inválida.
3. **Mesmo nome em outra cidade, matriz/filial ou vários estabelecimentos:** pertence às Tarefas 2 e 7; apresentar candidatos e exigir escolha humana.
4. **429, cota esgotada, timeout e resposta sem resultados:** pertencem às Tarefas 4 e 5; estados permanecem distintos e o cursor não avança como `not_found` em falha.
5. **Duas abas avançam o mesmo lote ou nova pesquisa conflita com CNPJ já confirmado:** pertence às Tarefas 3 e 5; lease/idempotência impede duplicação e preserva confirmação existente para revisão.

---

### Tarefa 1: Validar uma fonte gratuita antes de habilitar código

**Arquivos:**

- Criar: `docs/auditoria/evidencias/2026-09-24-prospeccao-cnpj/README.md`

**Interfaces:**

- Consome: fontes candidatas citadas na spec (APICNPJ, Aventity e documentação pública de outras opções que aceitem busca empresarial).
- Produz: decisão verificável `approved` ou `rejected` por provedor e contrato mínimo para o adaptador.

- [x] **Passo 1: montar tabela de elegibilidade por fonte**

Para cada candidato, registrar URLs da documentação e termos, campo de busca aceito, se requer CNPJ prévio, autenticação, franquia grátis e período, limite por minuto, permissão de uso comercial automatizado, campos de estabelecimento, situação cadastral, URL de evidência e regras de armazenamento.

- [x] **Passo 2: rejeitar lookup-only e interface sem autorização de automação**

Não aprovar APIs que recebem apenas CNPJ conhecido. Não tratar botão, página `/busca` ou endpoint descoberto em DevTools como autorização de automação. Não enviar dados reais de candidatos para sondagem antes de confirmar termos.

- [x] **Passo 3: registrar decisão e parar se a fonte não passar**

Só marcar `approved` quando todos os critérios da spec estiverem comprovados. Se nenhuma passar, completar o README com as evidências negativas, não criar os arquivos de produto das Tarefas 2–8 e apresentar ao usuário as opções de prosseguimento.

Critério de liberação: pelo menos um provedor aprovado permite continuar. **Resultado atualizado:** usuário aprovou OpenCNPJ/BigQuery para implementação com dry run e teto de bytes. Isso não valida licença separada dos registros nem habilita consultas; o código fica desabilitado até configurar projeto/credenciais, e a implantação comercial deve revisar os termos pendentes.

### Tarefa 2: Criar validação CNPJ e contrato neutro de provedor

**Arquivos:**

- Criar: `lib/prospecting/cnpj.ts`
- Criar: `lib/prospecting/cnpj-matching.ts`
- Criar: `lib/prospecting/cnpj-provider.ts`
- Criar: `lib/prospecting/cnpj-provider-adapter.ts`

**Interfaces:**

~~~ts
export type CnpjSearchQuery = {
  companyName: string
  city: string
  stateCode: string
  address: string | null
  phone: string | null
  websiteDomain: string | null
}

export type CnpjProviderMatch = {
  cnpj: string
  legalName: string | null
  tradeName: string | null
  registrationStatus: string | null
  city: string | null
  stateCode: string | null
  address: string | null
  phone: string | null
  websiteDomain: string | null
  sourceUrl: string
  observedAt: string
}

export type CnpjProviderSearch = {
  search(query: CnpjSearchQuery): Promise<CnpjProviderMatch[]>
}

export type CnpjMatchAssessment = "invalid" | "suggestion" | "needs_review"
~~~

- Produz `normalizeCnpj(value): string | null`, `validateCnpj(value): { normalized: string; valid: boolean }`, e `compareCnpjMatch(candidate, match): CnpjMatchAssessment`.
- Produz `lib/prospecting/cnpj-provider-adapter.ts` com o ID, limites documentados e função `search(query)` do contrato acima.

- [ ] **Passo 1: codificar formato sem converter para number**

Normalizar apenas máscara e espaços, preservar letras e zeros à esquerda, exigir as 14 posições estabelecidas e aplicar os dígitos verificadores das regras oficiais vigentes. Valores vazios retornam `null`; formato/checksum inválido não pode virar resultado confirmável.

- [ ] **Passo 2: definir avaliações de correspondência determinísticas**

Comparar nome fantasia/razão social normalizados, UF/cidade, endereço, telefone e domínio. Retornar `suggestion` somente quando houver um único CNPJ estruturalmente válido, UF/cidade coincidirem, o nome compartilhar tokens informativos com o candidato e ao menos um sinal independente (telefone, domínio ou endereço normalizado) coincidir. Retornar `needs_review` quando a localização divergir ou estiver ausente, houver vários CNPJs plausíveis, não houver sinal secundário ou o nome não bater. Retornar `invalid` se o checksum falhar. Este módulo nunca retorna `confirmed`; confirmação é ação humana.

- [ ] **Passo 3: implementar o adaptador aprovado usando só campos documentados**

Validar resposta HTTP com Zod, timeout, tratamento de 429/`Retry-After` e limite por requisição. Não persistir a resposta bruta nem retornar credenciais ao chamador. Não adicionar fallback para scraping.

- [ ] **Passo 4: revisar contratos e saídas por inspeção**

Inspecionar os casos de CNPJ inválido, 14 caracteres com zeros à esquerda, formato alfanumérico oficial, resposta múltipla, ausência de dados de contato e divergência de cidade. Não criar nem executar testes.

### Tarefa 3: Persistir lotes, tentativas e confirmação

**Arquivos:**

- Criar: `supabase/migrations/20261007000000_prospecting_cnpj_enrichment.sql`

**Interfaces:**

- Consome: candidato `prospecting_candidates.id`, seleção escopada por `prospecting_run_candidates.run_id` e resultado normalizado da Tarefa 2.
- Produz: `prospecting_cnpj_batches`, `prospecting_cnpj_batch_candidates`, `prospecting_cnpj_attempts`, `prospecting_cnpj_matches`, estado confirmado em `prospecting_candidates` e `leads.cnpj`.

- [ ] **Passo 1: conferir ordenação do arquivo de migração**

Usar `rg --files supabase/migrations` para confirmar que `20261006000000_prospecting_candidate_variable_resolution.sql` ainda é a migração mais recente. Se uma migração posterior já existir, escolher timestamp seguinte sem renomear arquivos existentes.

- [ ] **Passo 2: adicionar coluna própria `cnpj`**

Adicionar `prospecting_candidates.cnpj`, `cnpj_confirmed_at`, `cnpj_confirmed_by` e `leads.cnpj`. Não reaproveitar `leads.tax_id`: a migration `20260904000000_lead_closing.sql` condiciona esse campo às etapas de fechamento. Armazenar texto normalizado, nunca número.

- [ ] **Passo 3: criar lote serial e recibo por candidato**

Criar tabela de lotes por run com autor, status, contadores e timestamps; tabela `prospecting_cnpj_batch_candidates` com uma linha ordenada e estado/lease por candidato; tabela de tentativas com um recibo por batch-candidate/provedor/tentativa; tabela de resultados normalizados por tentativa. Cada tabela registra status permitido por constraint, erro sanitizado, `source_id`, URL, data observada e campos cadastrais permitidos. Não guardar payload bruto nem QSA.

- [ ] **Passo 4: adicionar lease e RPCs**

Criar RPCs `claim_prospecting_cnpj_candidate`, `record_prospecting_cnpj_provider_attempt`, `complete_prospecting_cnpj_candidate` e `confirm_prospecting_candidate_cnpj`. Conferir `auth.uid()`, integrante comercial, propriedade/run/candidate, lote ativo e lease; impedir dois workers de solicitar o mesmo batch-candidate. Confirmação exige match pertencente ao candidato e CNPJ estruturalmente válido.

- [ ] **Passo 5: configurar RLS, índices e privilégios**

Habilitar RLS para lote, tentativas e matches; restringir leitura a integrante comercial e mutações às RPCs. Criar índices para run/status, batch/posição, candidate/timestamp e match/attempt. Revogar execução pública e conceder somente aos papéis já usados pelas RPCs de prospecção.

- [ ] **Passo 6: ajustar importação transacional existente**

Na definição de `import_prospecting_candidate` reproduzida na migration nova, buscar `prospecting_candidates.cnpj` confirmado sob lock e incluir `leads.cnpj` no `INSERT`. CNPJ sugerido não pode ser aceito como argumento livre da Server Action. Preservar atual revalidação Google Business Info, deduplicação, lead `new` e idempotência existentes.

### Tarefa 4: Implementar serviço server-side e sequência retomável

**Arquivos:**

- Criar: `lib/prospecting/cnpj-enrichment.ts`
- Modificar: `lib/prospecting/reads.ts`

**Interfaces:**

~~~ts
export type ProspectingCnpjBatchStatus =
  | "queued" | "processing" | "paused" | "completed" | "source_limited" | "source_unavailable"

export async function createProspectingCnpjBatch(input: {
  runId: string
  candidateIds: string[]
  actorId: string
}): Promise<{ batchId: string; status: ProspectingCnpjBatchStatus }>

export async function advanceProspectingCnpjBatch(input: {
  batchId: string
  actorId: string
}): Promise<ProspectingCnpjBatchProgress>

export type ProspectingCnpjBatchProgress = {
  status: ProspectingCnpjBatchStatus
  processedCount: number
  totalCount: number
  currentCandidateId: string | null
  nextCandidateId: string | null
}
~~~

- [ ] **Passo 1: validar seleção antes de criar o lote**

Rejeitar lista vazia, mais de 50 IDs por lote, UUID inválido, candidato já importado/ignorado, candidato fora do `runId`, duplicatas no input e lote de outro integrante. Usar schemas Zod no limite público e RPC como autoridade final.

- [ ] **Passo 2: avançar uma pessoa jurídica por chamada**

Fazer claim transacional do próximo candidato não concluído; montar consulta com nome/cidade e, quando disponível, telefone/site/endereço; chamar apenas provedores aprovados; normalizar todos os matches; salvar recibo antes de devolver progresso. Cada chamada externa termina antes de avançar o cursor do lote.

- [ ] **Passo 3: mapear estados sem ambiguidade**

Resposta vazia de todos os provedores aprovados vira `not_found`; 429 ou quota vira `source_limited`; falha/time-out vira `source_unavailable`; ausência de provedor vira `source_not_configured`. Nunca transformar falha em ausência de resultado.

- [ ] **Passo 4: garantir retomada e concorrência**

Usar lease no banco e uma chave idempotente por batch/candidate/provider. Uma segunda aba lê o estado ou recebe `already_claimed`, sem chamar a fonte novamente. Retry só ocorre por ação explícita após cooldown documentado.

- [ ] **Passo 5: criar leitor paginado dos resultados**

Expor DTO com empresa original, estado, número de tentativas e matches normalizados; nunca expor lease, tokens, cabeçalhos ou corpo bruto. Validar todas as colunas antes de montar DTO.

### Tarefa 5: Expor actions com autorização e leitura

**Arquivos:**

- Criar: `app/actions/prospecting/cnpj.ts`
- Modificar: `app/actions/prospecting/read.ts`
- Modificar: `app/actions/prospecting/index.ts`

**Interfaces:**

~~~ts
export async function startProspectingCnpjBatchAction(input: {
  runId: string
  candidateIds: string[]
}): Promise<ProspectingCnpjActionState>

export async function advanceProspectingCnpjBatchAction(input: {
  batchId: string
}): Promise<ProspectingCnpjActionState>

export async function listProspectingCnpjMatchesAction(input: {
  runId: string
  candidateId: string
}): Promise<ProspectingCnpjMatchesState>

export async function confirmProspectingCandidateCnpjAction(input: {
  runId: string
  candidateId: string
  matchId: string
}): Promise<ProspectingCnpjActionState>

export type ProspectingCnpjMatchesState =
  | { status: "success"; candidateId: string; matches: CnpjProviderMatch[] }
  | { status: "error"; message: string }

export type ProspectingCnpjActionState =
  | { status: "success"; batchId?: string; progress?: ProspectingCnpjBatchProgress }
  | { status: "source_not_configured" | "source_limited" | "source_unavailable" | "error"; message: string }
~~~

- [ ] **Passo 1: espelhar o limite de Server Action atual**

Ler os guias Next.js atuais em `node_modules/next/dist/docs/` antes de codificar. Em cada action chamar `requireCommercialMember`, parsear input com Zod, validar escopo e autorização, converter erros internos em mensagens sanitizadas e `revalidatePath` da execução/lead afetado.

- [ ] **Passo 2: adicionar schemas estritos e limite por action**

`candidateIds` tem entre 1 e 50 IDs distintos; `runId`, `batchId`, `candidateId` e `matchId` são UUID; confirmation só aceita `matchId` devolvido para aquele par candidato/run. A action não aceita string de CNPJ livre para confirmar.

- [ ] **Passo 3: implementar start/advance/confirm**

Start persiste lote e seleção. Advance delega a um candidato do serviço e devolve progresso. Confirm grava ator/data via RPC. Exportar as actions pelo `index.ts` e ampliar a leitura do candidato com cnpj, status, última tentativa e estado de confirmação.

- [ ] **Passo 4: inspecionar autorização e payloads**

Ler todos os ramos de sucesso/erro e confirmar por inspeção que nenhuma resposta contém segredo, payload bruto, dados de outra execução, CNPJ livre não validado ou lease.

### Tarefa 6: Adicionar busca e revisão à tabela de candidatos

**Arquivos:**

- Modificar: `components/custom/Prospecting/ProspectingRunPage.tsx`
- Modificar: `components/custom/Prospecting/ProspectingCandidateTable.tsx`
- Criar: `components/custom/Prospecting/ProspectingCnpjReviewDialog.tsx`
- Modificar: `components/custom/Prospecting/index.ts`

**Interfaces:**

- Consome: seleção existente em `selectedIds`, DTOs/actions da Tarefa 5, inclusive `listProspectingCnpjMatchesAction`.
- Produz: fluxo explícito de lote serial, resultado e confirmação humana por `matchId`.

- [x] **Passo 1: ler `.agents/skills/suite-frontend/SKILL.md` e padrões de Dialog/Table/Badge do Suite**

Aplicar tokens, componentes e espaçamento existentes. Não introduzir dependência visual ou estilo paralelo.

- [x] **Passo 2: exibir status CNPJ sem alterar os filtros atuais**

Adicionar coluna `CNPJ` mostrando `—`, encontrado/aguardando confirmação, confirmado, não encontrado, limite ou falha. `tax_id` não entra nesta tela.

- [x] **Passo 3: iniciar lote somente pela ação explícita**

Adicionar botão Pesquisar CNPJ à toolbar quando houver seleção válida. Ao abrir a revisão não fazer fetch de provedor; a ação de início chama `startProspectingCnpjBatchAction`. Esvaziar ou mudar seleção não cria nem apaga tentativas.

- [x] **Passo 4: avançar sequência sem sobreposição**

Enquanto lote estiver em `queued`/`processing`, chamar advance serialmente, aguardando conclusão antes de agendar próximo avanço; cancelar timer em unmount/estado terminal. Não chamar `Promise.all`. Recarregar a página deve continuar do recibo do servidor.

- [x] **Passo 5: permitir revisão consciente de cada match**

Mostrar nome comercial do candidato junto a razão social, nome fantasia, situação informada, cidade/UF, endereço, telefone, domínio, fonte, data e link. Se houver matches múltiplos, todos continuam selecionáveis; default nenhum. Botão Confirmar CNPJ só chama action com `matchId` escolhido e status estrutural válido.

- [x] **Passo 6: representar ausência e falha corretamente**

Vazio responde “Não encontrado”; rate limit/quota pausa lote; timeout/falha mostra nova tentativa explícita; nenhuma fonte habilitada explica que o gate documental não foi concluído. Não apresentar badge “validado pela Receita” sem fonte oficial consultada.

### Tarefa 7: Propagar CNPJ confirmado ao lead

**Arquivos:**

- Modificar: `lib/leads/types.ts`
- Modificar: `lib/validations/lead.ts`
- Modificar: `components/custom/LeadForm/LeadForm.types.ts`
- Modificar: `components/custom/LeadForm/LeadForm.tsx`
- Modificar: `app/actions/leads/create-lead.ts`
- Modificar: `app/actions/leads/update-lead.ts`
- Modificar: `components/custom/LeadDetailDialog/LeadRecordPanel.tsx`
- Modificar: `app/actions/prospecting/import.ts`
- Modificar: SQL `import_prospecting_candidate` na migration da Tarefa 3

**Interfaces:**

- `LeadRecord.cnpj: string | null` e `LeadWritePayload.cnpj: string | null`.
- Importação passa somente candidato/match confirmado; SQL obtém o CNPJ salvo no candidato e o insere no lead na transação atual.

- [x] **Passo 1: manter `cnpj` separado de `tax_id`**

Adicionar `cnpj` aos tipos e selects `*` do lead. Não alterar `lib/validations/lead-closing.ts`, `tax_id`, nem a constraint `leads_opportunity_fields_chk`.

- [x] **Passo 2: validar e editar CNPJ no cadastro do lead**

Adicionar campo opcional ao schema/form com `normalizeCnpj` e regra oficial de dígito verificador; permitir vazio e preservar representação textual. Incluir o valor em create/update; ajustes no cartão só se forem necessários para seguir o padrão existente.

- [x] **Passo 3: mostrar o CNPJ no detalhe**

Exibir `lead.cnpj` em seção de dados da empresa, com `—` quando vazio. Mostrar `tax_id` somente na área de fechamento já existente.

- [x] **Passo 4: importar apenas a fonte de verdade do candidato**

Remover qualquer possibilidade de o cliente decidir CNPJ no payload de importação. A RPC busca `prospecting_candidates.cnpj` confirmado e grava com `company_name`, telefone/site e demais dados já transacionados.

- [x] **Passo 5: preservar importação em planilha e fechamento**

Inspecionar `app/actions/leads/spreadsheet.ts`, formulário de fechamento e constraints: manter a planilha sem campo CNPJ, preencher `cnpj: null` no payload compartilhado se o tipo exigir a chave, e não alterar o fluxo nem o `tax_id` de fechamento.

### Tarefa 8: Registrar evidências e fazer revisão manual final

**Arquivos:**

- Modificar: `docs/auditoria/evidencias/2026-09-24-prospeccao-cnpj/README.md`
- Criar: `docs/auditoria/evidencias/2026-09-24-prospeccao-cnpj/manual-verification.md`

- [ ] **Passo 1: registrar contrato aprovado e amostra redigida**

Anotar endpoint, termos, franquia grátis, limite, consulta de nome sintética/autorizada, campos recebidos, status de CNPJ, timestamp e divergências. Remover credenciais, dados pessoais e payload fora do escopo.

- [x] **Passo 2: revisar estados ponta a ponta por leitura de código**

Percorrer manualmente os fluxos de fonte não configurada, resultado vazio, CNPJ inválido, dois matches, filial ambígua, confirmação, troca divergente, quota esgotada, timeout, retry explícito, duas abas e importação. Registrar arquivo/fluxo inspecionado e resultado; não executar suites ou ferramentas proibidas.

- [x] **Passo 3: revisar segurança e ausência de regressão no fechamento**

Inspecionar RPC/RLS, payloads das actions, tabela `leads.cnpj` separada de `tax_id`, validação do lead e importação de planilha; documentar que nenhuma rotina compartilha segredos nem persiste resposta bruta.

## Ordem e gates

1. **Gate de fonte — Tarefa 1:** sem provedor elegível, parar sem alterar código.
2. **Domínio — Tarefa 2:** validação textual e adapter contract antes de persistência.
3. **Persistência e importação atômica — Tarefa 3:** RLS/lease/confirm antes de expor mutations.
4. **Orquestração e ações — Tarefas 4 e 5:** idempotência e autorização antes de UI.
5. **Interface — Tarefa 6:** depende dos DTOs/actions finais.
6. **Lead — Tarefa 7:** `cnpj` opcional separado dos campos de fechamento.
7. **Evidência e revisão — Tarefa 8:** inspeção manual sem testes.

## Critérios de conclusão

- A fonte ativa passou pelo gate e o contrato foi anotado com evidência pública.
- A pessoa pode iniciar, acompanhar, retomar e rever um lote sem chamada paralela ou automática por interação incidental.
- Ausência de resultado, limite, erro e falta de configuração permanecem distintos.
- CNPJ estruturalmente válido não confirma sozinho a identidade.
- A confirmação registra ator/data e CNPJ permanece texto.
- Apenas CNPJ confirmado chega a `leads.cnpj`; `leads.tax_id` e fechamento continuam intactos.
- Tentativas e fontes ficam rastreáveis sem armazenar payload bruto/sócios.
- A revisão foi feita por inspeção manual; nenhum comando proibido ou teste foi executado.

## Proposta de revisão após a pesquisa do OpenCNPJ

Substituir o bloqueio absoluto da Tarefa 1 por um gate de implementação condicional para `opencnpj-bigquery.public.receita`: a documentação do OpenCNPJ recomenda a tabela pública para prospecção/enriquecimento batch e uso comercial; o BigQuery Sandbox documenta 1 TiB/mês grátis sem conta de faturamento. Antes de ativar a integração, exigir projeto Google dedicado ao Suite, service account server-side, dry run real com bytes estimados abaixo do teto configurado por lote e confirmação de que o projeto não está vinculado a faturamento.

A consulta deve ser parametrizada, serial e limitada a 50 candidatos por chamada; executar um dry run antes de cada batch; impor `maximumBytesBilled`; salvar apenas resultados normalizados e recibo; exigir confirmação humana; distinguir quota/limite, fonte sem configuração, falha e vazio. Sem credencial/projeto, manter a função desabilitada e não executar pesquisa.

Status atual (2026-09-24): desenho aprovado pelo usuário e implementação adicionada. Provedor permanece inativo enquanto projeto/credenciais não forem configurados. Migration ainda não aplicada; dry run real, medição de bytes e revisão específica da licença dos registros OpenCNPJ continuam pendentes.
