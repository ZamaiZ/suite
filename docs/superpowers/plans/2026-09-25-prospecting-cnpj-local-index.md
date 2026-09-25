# SUBSTITUÍDO — não executar

Este plano de índice SQLite foi substituído por [2026-09-25-cnpj-local-csv-streaming.md](2026-09-25-cnpj-local-csv-streaming.md), aprovado para execução nativa. Consulte o plano novo.

# Índice local de CNPJ — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pesquisar CNPJs de candidatos da prospecção usando um índice local construído dos arquivos da Receita que o usuário já baixou.

**Architecture:** Um processo Node local valida e indexa os arquivos por streaming em um banco embutido persistido fora do repositório; DuckDB é a primeira opção e será confirmado no piloto. O Suite, rodando na mesma máquina, inicia/acompanha o trabalho e consulta o índice pelo servidor; os resultados entram como sugestões revisáveis no fluxo CNPJ existente.

**Tech Stack:** Next.js 16.3.1, Server Actions, Node.js, banco analítico local embutido (DuckDB candidato), Supabase para persistir apenas resultados e estados de revisão.

**Spec:** `docs/superpowers/specs/2026-09-25-prospecting-cnpj-local-index-design.md`

## Global Constraints

- Preservar intactos os arquivos `Empresas0..9` e `Estabelecimentos0..9`.
- Processar os CSVs em fluxo; não carregar a base inteira na RAM.
- Executar o servidor e o processo local na mesma máquina que contém a base.
- Não usar Google Colab, BigQuery, chaves de API, Docker, hospedagem ou armazenamento da base no Supabase.
- Medir o piloto de uma partição antes de criar o índice completo; não prometer tamanho ou duração antecipadamente.
- Nunca preencher um CNPJ automaticamente no candidato; persistir sugestões para a confirmação manual já existente.
- Não adicionar nem executar testes. Não executar `git`, `typecheck`, `build` ou `lint`; essas proibições do usuário prevalecem sobre o fluxo genérico da skill.
- Para verificação, usar inspeção de arquivos e uma conferência operacional manual do piloto, sem comandos de teste.

## Review Focus

1. **Arquivos ausentes, layouts divergentes ou competências misturadas:** a preparação deve recusar ativar índice incompleto e identificar a partição inválida.
2. **Base maior que o espaço disponível:** a interface deve interromper antes de iniciar a construção integral e preservar a versão ativa.
3. **Nomes homônimos ou telefone/CEP/endereço conflitantes:** o resultado deve ficar ambíguo, sem sugerir uma unidade arbitrária.
4. **Execução interrompida durante construção ou pesquisa:** o estado deve indicar interrupção; índice incompleto não pode aparecer como pronto nem produzir `not_found` conclusivo.
5. **Suite executado em outro computador ou sem acesso à pasta local:** a funcionalidade deve ficar indisponível com instrução explícita, sem tentar enviar os CSVs ao Supabase.

## File Map

- Create `lib/prospecting/local-cnpj-index/contracts.ts` — tipos compartilhados para configuração, inspeção, progresso e resultados.
- Create `lib/prospecting/local-cnpj-index/config.ts` — resolver e validar as pastas locais de origem e índice.
- Create `scripts/prospecting-cnpj-local-worker.mjs` — processo Node isolado para inspecionar arquivos, executar piloto, construir índice e pesquisar sem prender uma requisição HTTP longa.
- Create `lib/prospecting/local-cnpj-index/worker-client.ts` — iniciar o processo sem shell, enviar entradas estruturadas e ler progresso/resumo com limites de tamanho.
- Create `lib/prospecting/local-cnpj-index/matching.ts` — normalização e regras de pontuação/evidência quando não forem parte da consulta DuckDB.
- Create `app/actions/prospecting/cnpj-local-index.ts` — autorizar usuário, iniciar/preparar/pesquisar, persistir progresso local e gravar resultados no fluxo CNPJ existente.
- Modify `app/actions/prospecting/index.ts` — exportar as novas ações e estados tipados.
- Create `components/custom/Prospecting/ProspectingCnpjLocalTools.tsx` — estado da base, preparo e ação de pesquisa local.
- Modify `components/custom/Prospecting/ProspectingRunPage.tsx` — posicionar o painel local no fluxo atual de prospecção.
- Modify `components/custom/Prospecting/ProspectingCnpjFileTools.tsx` — manter importação CSV e remover copy/ação primária de pesquisa web externa.
- Modify `app/api/prospecting/[runId]/cnpj-research/route.ts` e `lib/prospecting/cnpj-files.ts` — retirar a exportação Markdown para modelo externo caso a revisão de referências confirme que não há outro consumidor; manter parser e importador CSV.
- Create `supabase/migrations/20261009000000_prospecting_cnpj_local_index.sql` — adicionar origem `receita_local_index` ao commit atômico da importação de arquivo sem reinterpretar linhas históricas `ai_research`/`opencnpj_bigquery`.
- Modify `.env.example` — documentar `PROSPECTING_CNPJ_DATA_DIR` e `PROSPECTING_CNPJ_INDEX_DIR`, sem valores de máquina ou caminhos pessoais.
- Modify `.gitignore` only if the chosen default index path falls inside the repository; prefer a path under the user profile so the index never enters the workspace.
- Modify `package.json` and `pnpm-lock.yaml` only for the embedded database package selected after reading its compatibility guidance for the installed Node/Windows version.
- Create `docs/prospecting/cnpj-local-index.md` — configurar a pasta, preparar índice, entender espaço e resolver falhas locais.

## Implementation Tasks

### Task 1: Confirmar layout local e criar o preflight/piloto

**Files:**
- Create: `lib/prospecting/local-cnpj-index/contracts.ts`
- Create: `lib/prospecting/local-cnpj-index/config.ts`
- Create: `scripts/prospecting-cnpj-local-worker.mjs`
- Modify: `.env.example`
- Modify: `package.json` and `pnpm-lock.yaml` only if DuckDB is selected after compatibility review

**Interfaces:**
- `inspectCnpjSource(dataDir: string): Promise<CnpjSourceInspection>` returns a competência observada, caminhos relativos, bytes por arquivo, colunas detectadas e erros de layout.
- `runCnpjIndexPilot(options, onProgress): Promise<CnpjPilotSummary>` reads one configured establishment partition and only the related records needed to validate joins; writes a disposable small index in `indexDir/pilot`.
- CLI modes: `inspect`, `pilot`, `build`, `status`, and `search`; each writes progress as newline-delimited JSON to stdout and a final summary as one JSON object.
- `CnpjSourceInspection` contains `snapshotKey`, `files[{group, part, relativePath, bytes, fieldCount}]`, `missingFiles[]`, `layoutErrors[]`, and `ready`.
- `CnpjPilotSummary` contains `snapshotKey`, `establishmentRowsRead`, `companyRowsRead`, `elapsedMs`, `indexBytes`, `freeBytesAfter`, and `estimatedFullIndexBytes`.

- [ ] Ler as orientações relevantes da versão instalada de Next e do cliente DuckDB antes de adicionar dependências ou usar APIs de processo.
- [ ] Definir os 7 campos de `Empresas` e os 30 campos de `Estabelecimentos` a partir da competência observada e validar encoding/delimitador/aspas com leitura em fluxo.
- [ ] Implementar `inspect` para validar presença das 20 partições, mesmo `D...`/competência quando aplicável, tamanho, primeira linha e contagem de campos sem imprimir dados cadastrais.
- [ ] Implementar `pilot` em arquivo separado do índice ativo, limitar a leitura a uma partição de estabelecimentos, medir duração/linhas/bytes e permitir descartar apenas o índice de piloto.
- [ ] Exibir no resumo do piloto o crescimento em disco e o espaço livre consultado; não iniciar `build` por consequência automática do piloto.
- [ ] Conferir manualmente a saída `inspect`/`pilot` em uma única partição e interromper para decisão se o custo projetado da indexação integral exceder o espaço livre.

### Task 2: Construir e ativar índice persistente com segurança

**Files:**
- Modify: `scripts/prospecting-cnpj-local-worker.mjs`
- Modify: `lib/prospecting/local-cnpj-index/contracts.ts`
- Modify: `lib/prospecting/local-cnpj-index/config.ts`

**Interfaces:**
- `buildCnpjIndex(options, onProgress): Promise<CnpjIndexManifest>` processes the 20 source partitions in fixed order and creates a staged database plus manifest.
- `readCnpjIndexStatus(indexDir): Promise<CnpjIndexStatus>` reports `missing | building | ready | failed`, active competência, finished partitions, bytes and last error code.
- `CnpjIndexManifest` contains `schemaVersion`, `snapshotKey`, `builtAt`, `recordCounts`, `completedFiles`, `databaseRelativePath`, `databaseBytes`, and `matcherVersion`.
- The staged index becomes active only after every required partition and lookup table has been validated.

- [ ] Materializar apenas as colunas necessárias: CNPJ básico/ordem/DV, razão social, nome fantasia, situação, UF/município, endereço, CEP, telefones e CNAE principal/secundário.
- [ ] Juntar razões sociais e estabelecimentos por CNPJ básico dentro do motor sem criar arrays de linhas em memória no Node.
- [ ] Armazenar colunas normalizadas de busca separadas dos valores originais; manter matriz e filial em linhas distintas.
- [ ] Salvar progresso por partição e competência em manifesto local, sem valores de empresa/telefone/endereço nos logs.
- [ ] Construir em arquivo temporário de nova versão, conferir integridade e só depois trocar o manifesto ativo; se falhar, manter o índice ativo anterior.
- [ ] Detectar disco insuficiente antes do build e falhas de leitura por partição; a limpeza deve tocar apenas arquivos temporários criados pelo processo.
- [ ] Executar uma indexação integral somente após revisar o resumo do piloto e confirmar espaço livre suficiente; conferir manualmente manifesto, contagem e bytes finais.

### Task 3: Implementar busca e classificação conservadora

**Files:**
- Create: `lib/prospecting/local-cnpj-index/matching.ts`
- Modify: `scripts/prospecting-cnpj-local-worker.mjs`
- Modify: `lib/prospecting/local-cnpj-index/contracts.ts`

**Interfaces:**
- `searchCnpjIndex(candidates: CnpjSearchCandidate[]): Promise<CnpjSearchResult[]>` accepts at most one prospecting run and returns exactly one result per candidate, preserving both IDs.
- `CnpjSearchCandidate` contains `run_id`, `candidate_id`, `company_name`, `primary_category`, `address`, `phone`, `website`, `website_domain`, `city`, `state_code`, and `existing_cnpj`.
- `CnpjSearchResult` contains `candidate_id`, `research_status`, nullable CNPJ/legal/trade/status/city/UF/CNAE fields, `source_url`, `source_checked_at`, `match_signals[]`, and the active index manifest ID; only `found` results can carry a CNPJ and evidence URL/date.

- [ ] Normalizar acentos, pontuação, espaços, telefones e CEP em campos auxiliares de comparação.
- [ ] Gerar candidatos por nome fantasia/razão social, telefone e CEP/UF/endereço; não usar o território geral da prospecção como município do estabelecimento.
- [ ] Pontuar sinais independentes e separar coincidência de marca, matriz, filial e SPE; nome semelhante sozinho sempre retorna `ambiguous`.
- [ ] Retornar vários candidatos como `ambiguous` quando houver empate ou conflito; retornar `not_found` somente após consulta concluída no índice `ready`.
- [ ] Validar o CNPJ completo por dígitos verificadores e traduzir códigos de situação/município/CNAE apenas com tabelas oficiais disponíveis; se um descritor faltar, retornar o código rotulado.
- [ ] Fazer uma conferência manual com amostra dos quatro CNPJs do relatório anterior e de candidatos ambíguos, sem sobrescrever a base de origem.

### Task 4: Gravar resultados como sugestões sem perder a origem

**Files:**
- Create: `supabase/migrations/20261009000000_prospecting_cnpj_local_index.sql`
- Modify: `app/actions/prospecting/cnpj-local-index.ts`
- Modify: `app/actions/prospecting/cnpj.ts`
- Modify: `supabase/migrations/` RPC de importação CNPJ, copiando a definição atual antes de substituí-la

**Interfaces:**
- `inspectLocalCnpjIndexAction(): Promise<LocalCnpjIndexState>` returns local config/status without exposing host paths to Supabase or browser logs.
- `startLocalCnpjIndexAction(): Promise<LocalCnpjIndexState>` requires a commercial member and starts one process only.
- `searchLocalCnpjRunAction({runId}): Promise<LocalCnpjSearchState>` loads only candidates belonging to the authorized run, queries the ready local index, and stages/commits results using 50-row chunks.
- `LocalCnpjIndexState` contains `enabled`, `sourceReady`, `status`, `snapshotKey`, `completedFiles`, `totalFiles`, `databaseBytes`, and a safe user-facing error message; it never includes absolute local paths.
- `LocalCnpjSearchState` contains `processed`, `suggestions`, `ambiguous`, `notFound`, `skipped`, and `failed` counts plus the final status.

- [ ] Extend the atomic CSV import path with an explicit, server-validated `source` value so generated results persist as `receita_local_index`; keep `ai_research` as the default for existing imports.
- [ ] Preserve user/run/candidate checks, context equality, idempotency, and no-partial-commit behavior in the existing SQL import flow.
- [ ] Use the official Receita data URL and dataset competência as evidence metadata; do not fabricate a company-specific URL or consultation date.
- [ ] Preserve historical match sources in readers and confirmation actions; add `receita_local_index` to the accepted source set.
- [ ] Skip already-confirmed candidates; never replace a confirmed CNPJ through an index result.
- [ ] Persist only candidate match results and statuses in Supabase, never raw source rows or local file paths.

### Task 5: Integrar estado e ações na tela de prospecção

**Files:**
- Create: `components/custom/Prospecting/ProspectingCnpjLocalTools.tsx`
- Modify: `components/custom/Prospecting/ProspectingRunPage.tsx`
- Modify: `components/custom/Prospecting/ProspectingCnpjFileTools.tsx`
- Read before UI changes: `.agents/skills/suite-frontend/references/tokens.md`, `components.md`, `writing.md`, and `state.md`

**Interfaces:**
- The panel shows `not configured | source ready | pilot complete | building | index ready | failed`, active competência, bytes and completed partitions.
- Search state shows processed candidates and final counts for suggestions, ambiguous, not found, skipped and failed.

- [ ] Replace the primary “modelo externo” instruction with the local-base status, preparation and search actions.
- [ ] Disable search until the full index status is `ready`; disable duplicate build/search actions while a local process is active.
- [ ] Poll only the small local manifest/status endpoint and stop polling on terminal states or component unmount.
- [ ] Explain in plain language when the configured folder is missing/inaccessible and that the app server must run on the same computer.
- [ ] Keep CSV import available as fallback/history, but remove the `.md` external web research download from the primary flow.
- [ ] Preserve table refresh and candidate review behavior after local matches are committed.

### Task 6: Remove obsolete BigQuery runtime references and document setup

**Files:**
- Modify: `lib/prospecting/cnpj-files.ts`
- Modify: `app/api/prospecting/[runId]/cnpj-research/route.ts`
- Modify: `app/actions/prospecting/cnpj.ts`
- Modify: `components/custom/Prospecting/ProspectingCnpjReviewDialog.tsx`
- Modify: `supabase/migrations/` with a forward-only cleanup/update when needed
- Create: `docs/prospecting/cnpj-local-index.md`

- [ ] Search for remaining active BigQuery environment variables, source labels and runtime provider branches; remove unused provider configuration while leaving historic DB rows readable.
- [ ] Remove Markdown-generator code/route only after confirming no caller remains; retain CSV parsing/import paths needed by existing history and manual review.
- [ ] Document `.env.local` values for the source root and separate index directory without embedding the user's personal path in tracked files.
- [ ] Document the pilot, full indexing, restart after failure, storage expectations, source snapshot and same-machine limitation.
- [ ] Manually inspect the code paths and documentation for regressions without running prohibited commands.

## Completion Checks

- All 20 input partitions validated; index manifest shows one consistent competência and status `ready`.
- Pilot and full build report actual disk growth and elapsed time; original CSV timestamps and sizes are unchanged.
- One run returns exactly one status per candidate and persists suggestions through the existing atomic import contract.
- No source/base files or machine paths are sent to Supabase; no BigQuery runtime configuration remains active.
- Review manually the four previously found candidates, ambiguous cases, a not-found case, a confirmed candidate, missing folder, mixed competence and simulated worker interruption through code-path inspection only.
- Do not run tests, build, lint, typecheck or git commands.
