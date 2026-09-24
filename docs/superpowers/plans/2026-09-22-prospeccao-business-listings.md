# Canal de prospecção por segmento e cidade — Plano de implementação

> **Para execução agentic:** SUB-SKILL OBRIGATÓRIO: use superpowers:executing-plans para executar este plano tarefa por tarefa. O modo com subagentes só pode ser usado se o usuário o autorizar explicitamente. Os passos usam caixas de seleção para acompanhamento.

**Objetivo:** entregar um canal persistente de prospecção que encontre candidatos do DataForSEO Business Listings por segmento e município, valide território, categoria, atualidade e duplicidade, e converta apenas candidatos elegíveis em leads.

**Arquitetura:** Business Listings faz a descoberta paginada; a malha oficial do IBGE transforma o círculo de consulta em classificação municipal; candidatos globais por place_id ficam separados das ocorrências de cada pesquisa. A coleta avança uma página por vez sob lease e orçamento, e a importação revalida cada candidato com Google Business Info antes de uma escrita transacional.

**Stack:** Next.js 16.3.1 App Router, React 19, TypeScript, Zod 4, Supabase/PostgreSQL com RLS e RPC, DataForSEO Business Data, APIs oficiais do IBGE, componentes shadcn/Base UI existentes e react-icons/ri.

**Spec:** docs/superpowers/specs/2026-09-22-prospeccao-business-listings-design.md

## Restrições globais

- Não executar git, typecheck, build, lint ou test.
- Não criar nem executar testes automatizados; verificar por inspeção, sondagens autorizadas e fluxos manuais documentados.
- Ler os guias relevantes em node_modules/next/dist/docs antes de escrever código Next.js; para este plano já foram consultados Server Actions, Mutating Data, Forms, Route Handlers e revalidatePath.
- Toda Server Action é um endpoint POST não confiável: repetir autenticação, autorização, validação Zod e checagem de propriedade/escopo dentro da action.
- Server Actions são despachadas sequencialmente por cliente; a interface nunca deve depender de Promise.all para avançar páginas.
- Nunca fazer chamada paga em typeahead, abertura de diálogo ou alteração de campo.
- Business Listings descobre; google/my_business_info/live confirma somente os candidatos escolhidos para importação.
- Categorias, área, page_limit e cursor da pesquisa tornam-se imutáveis após a primeira chamada paga.
- O teto de resultados e o teto em USD governam simultaneamente; o primeiro limite alcançado pausa ou conclui a execução.
- place_id é a única identidade global do candidato; item sem place_id vira rejeição missing_identity e não é persistido como candidato.
- Não persistir payload bruto do fornecedor nem popular_times, people_also_search, serviços, atributos, Q&A, reviews ou posts.
- Leads podem ficar sem website somente quando têm telefone; a importação de planilha continua exigindo website.
- Antes de alterar UI, ler e aplicar .agents/skills/suite-frontend/SKILL.md.

## Foco da revisão

1. **Resposta paga sem envelope:** a página deve terminar como unknown, sem inventar custo nem avançar o cursor; pertence à Tarefa 6 e ao roteiro manual 14.4.
2. **Município com ilhas, buracos ou MultiPolygon:** point-in-polygon deve respeitar anéis internos e todos os polígonos; pertence à Tarefa 3 e ao roteiro manual 14.2.
3. **Dois navegadores avançando a mesma pesquisa:** somente um lease chama o fornecedor e o mesmo cursor produz um único recibo; pertence às Tarefas 4 e 6 e ao roteiro manual 14.5.
4. **Candidato sem site, mas com telefone válido:** deve importar e continuar utilizável no board; pertence às Tarefas 8 e 9 e ao roteiro manual 14.7.
5. **Conflito criado depois da seleção:** a importação deve repetir a deduplicação dentro da escrita e vincular o lead existente, sem criar duplicata; pertence à Tarefa 9 e ao roteiro manual 14.8.

---

## Mapa de arquivos

### Novos módulos de domínio e fornecedores

- Criar lib/dataforseo/business-listings.ts — contrato HTTP e paginação do endpoint search/live.
- Criar lib/dataforseo/business-listings-catalog.ts — catálogo de categorias e leitura da versão publicada.
- Criar lib/prospecting/types.ts — tipos compartilhados de execução, página, candidato e importação.
- Criar lib/prospecting/cost.ts — cálculo puro da tarifa por chamada e por item.
- Criar lib/prospecting/geometry.ts — envelope, círculo de cobertura e point-in-polygon para Polygon/MultiPolygon.
- Criar lib/prospecting/ibge.ts — resolução de município e download do GeoJSON oficial.
- Criar lib/prospecting/candidates.ts — normalização, classificação territorial/categórica e elegibilidade.
- Criar lib/prospecting/conflicts.ts — ordem única de conflitos por place_id, domínio e telefone/empresa/cidade.
- Criar lib/prospecting/reads.ts — mapeadores das consultas Supabase para DTOs da interface.

### Persistência e actions

- Criar supabase/migrations/20260925000000_prospecting_business_listings.sql — catálogo, limites municipais, execuções, recibos, candidatos, relações, RLS e RPCs de lease/página/importação.
- Criar supabase/migrations/20260925000001_leads_optional_website.sql — website/domínio anuláveis e constraint de contato.
- Criar app/actions/prospecting/catalog.ts — refresh e busca do catálogo/mapeamentos.
- Criar app/actions/prospecting/runs.ts — preparar, iniciar, pausar, retomar, cancelar e avançar pesquisa.
- Criar app/actions/prospecting/read.ts — listar execuções, detalhe, candidatos e contadores.
- Criar app/actions/prospecting/review.ts — selecionar e ignorar ocorrências.
- Criar app/actions/prospecting/import.ts — revalidar e importar candidatos isoladamente.
- Criar app/actions/prospecting/index.ts — superfície pública das actions.

### Leads existentes

- Modificar lib/leads/types.ts, lib/leads/board-item.ts e lib/validations/lead.ts — website/domínio anuláveis e regra site-ou-telefone.
- Modificar app/actions/leads/create-lead.ts e app/actions/leads/update-lead.ts — conflito de website somente quando existe.
- Modificar app/actions/leads/spreadsheet.ts — preservar explicitamente website obrigatório e correlação por domínio.
- Modificar app/(protected)/leads/page.tsx — busca e select tolerantes a domínio nulo.
- Modificar componentes/custom/LeadForm/LeadForm.tsx, componentes/custom/LeadBoard/LeadBoardCardFace.tsx, componentes/custom/LeadDetailDialog/LeadDetailDialog.types.ts, componentes/custom/LeadDetailDialog/LeadDetailDialog.tsx, componentes/custom/LeadDetailDialog/LeadDetailHeader.tsx e componentes/custom/LeadDetailDialog/LeadRecordPanel.tsx — renderização e edição sem URL inventada.
- Revisar guards em app/actions/leads/analyze-website.ts, analyze-visibility.ts, analyze-geo.ts e analyze-backlinks.ts — devolver estado indisponível quando não houver canal website.

### Interface de prospecção

- Criar app/(protected)/prospecting/page.tsx e loading.tsx — lista paginada de pesquisas.
- Criar app/(protected)/prospecting/[id]/page.tsx e loading.tsx — detalhe retomável.
- Criar components/custom/Prospecting/ProspectingRunsPage.tsx — shell da lista.
- Criar components/custom/Prospecting/ProspectingRunTable.tsx — tabela e paginação.
- Criar components/custom/Prospecting/ProspectingCreateDialog.tsx — configuração e confirmação de custo.
- Criar components/custom/Prospecting/ProspectingRunPage.tsx — cabeçalho, polling e comandos.
- Criar components/custom/Prospecting/ProspectingCandidateTable.tsx — filtros, seleção e estados.
- Criar components/custom/Prospecting/ProspectingImportDialog.tsx — progresso individual da importação.
- Criar components/custom/Prospecting/index.ts — exports do módulo.
- Modificar components/custom/navigation.ts e components/custom/LeadBoard/LeadBoardToolbar.tsx — entradas para /prospecting.

### Evidência operacional

- Criar docs/auditoria/evidencias/2026-09-22-prospeccao-business-listings/probe-business-listings.mjs.
- Criar docs/auditoria/evidencias/2026-09-22-prospeccao-business-listings/README.md.
- Criar docs/auditoria/evidencias/2026-09-22-prospeccao-business-listings/*.redacted.json somente para amostras sem credenciais nem payload pessoal desnecessário.

---

### Tarefa 1: Sondar o contrato real do Business Listings

**Arquivos:**

- Criar: docs/auditoria/evidencias/2026-09-22-prospeccao-business-listings/probe-business-listings.mjs
- Criar: docs/auditoria/evidencias/2026-09-22-prospeccao-business-listings/README.md
- Criar: docs/auditoria/evidencias/2026-09-22-prospeccao-business-listings/01-categories.redacted.json
- Criar: docs/auditoria/evidencias/2026-09-22-prospeccao-business-listings/02-demolition-sp-first-page.redacted.json
- Criar: docs/auditoria/evidencias/2026-09-22-prospeccao-business-listings/03-demolition-sp-next-page.redacted.json

**Interfaces:**

- Consome: DATAFORSEO_LOGIN e DATAFORSEO_PASSWORD do ambiente local.
- Produz: um contrato medido para nomes de campos, forma de category_ids, cursor, total_count, custo e status de estabelecimento.

- [ ] **Passo 1: criar um probe que recuse rodar sem credenciais e nunca as imprima**

O script deve fazer GET de /v3/business_data/business_listings/categories e duas chamadas POST de /v3/business_data/business_listings/search/live. Use limit 2 na primeira e reutilize exatamente offset_token ou offset retornado na segunda. O corpo inicial deve ser:

~~~js
{
  categories: ["demolition_contractor"],
  language_code: "pt",
  location_coordinate: "-23.55052,-46.633308,45",
  limit: 2
}
~~~

- [ ] **Passo 2: redigir a resposta antes de gravar evidência**

Manter somente envelope de status/custo, paginação e dois items com place_id, cid, title, category, category_ids, address, address_info, phone, url, latitude, longitude, rating, work_time.current_status, check_url e last_updated_time. Remover headers, credenciais e campos fora do escopo.

- [ ] **Passo 3: executar a sondagem paga uma única vez**

Executar:

~~~powershell
node docs/auditoria/evidencias/2026-09-22-prospeccao-business-listings/probe-business-listings.mjs
~~~

Critério: as duas páginas usam cursores diferentes; nenhuma repete o primeiro place_id; README registra timestamp, corpos enviados, custo confirmado e quaisquer diferenças em relação à documentação.

- [ ] **Passo 4: criar um portão de decisão**

Se place_id, paginação ou custo não vierem na forma prevista, parar a execução do plano e corrigir a spec/plano antes de escrever mapeadores. Não adaptar silenciosamente tipos a uma amostra divergente.

### Tarefa 2: Implementar catálogo de categorias e preço da conta

**Arquivos:**

- Criar: lib/dataforseo/business-listings-catalog.ts
- Criar: lib/prospecting/cost.ts
- Modificar: lib/dataforseo/usage.ts
- Criar: app/actions/prospecting/catalog.ts

**Interfaces:**

- Produz: fetchBusinessListingCategories(): Promise<BusinessListingCategoryCatalogResult>.
- Produz: businessListingsRate(prices): { perRequest: number; perResult: number } | null.
- Produz: estimateBusinessListingsPageCost(rate, itemLimit): number.
- Produz: searchProspectingCategoriesAction({ query, limit }): Promise<CategorySearchState>.

- [ ] **Passo 1: definir o leitor estrito do catálogo**

O tipo público deve ser:

~~~ts
export type BusinessListingCategory = {
  name: string
  title: string | null
  businessCount: number | null
  catalogDate: string | null
}
~~~

Descartar linhas sem name; aceitar ausência de title, business_count ou data sem fabricar valores.

- [ ] **Passo 2: adicionar a operação de preço sem fixar centavos no código**

Usar findDataForSeoPrice(prices, "business_data", "business_listings/search/live") e exigir simultaneamente as parcelas per_request e per_result. estimateBusinessListingsPageCost deve somá-las para o limite pedido e arredondar somente na apresentação.

- [ ] **Passo 3: implementar refresh transacional do catálogo**

A action exige requireCommercialMember, chama o endpoint gratuito, valida as linhas e envia o conjunto para a RPC replace_prospecting_category_catalog. A RPC substitui a visão corrente numa transação; falha não pode apagar o catálogo anterior.

- [ ] **Passo 4: implementar busca sem acento e mapeamento de segmento**

A busca lê o catálogo persistido, normaliza query com NFD sem marcas e limita a 50 opções. O salvamento recebe segmentId, de uma a dez category_name distintas e exatamente um primaryCategory; rejeita categoria ausente no catálogo.

- [ ] **Passo 5: verificar sem chamada paga**

Abrir a action pelo fluxo local, pesquisar “demolicao” e confirmar demolition_contractor; inspecionar no banco que o refresh tem catalog_date/fetched_at e que o mapeamento impede 0, 11 e duas categorias primárias.

### Tarefa 3: Resolver município e classificar geometria do IBGE

**Arquivos:**

- Criar: lib/prospecting/geometry.ts
- Criar: lib/prospecting/ibge.ts
- Modificar: app/actions/prospecting/runs.ts

**Interfaces:**

- Produz: resolveIbgeMunicipality(city, stateCode): Promise<IbgeMunicipalityResult>.
- Produz: coverageCircle(geometry): { latitude: number; longitude: number; radiusKm: number }.
- Produz: pointInMunicipality(geometry, point): boolean.
- Produz: loadProspectingBoundary(city, stateCode): Promise<ProspectingBoundaryResult>.

- [ ] **Passo 1: definir validação GeoJSON sem dependência nova**

Aceitar somente Feature/FeatureCollection cujo conteúdo final seja Polygon ou MultiPolygon com coordenadas finitas, longitude entre -180 e 180 e latitude entre -90 e 90. Rejeitar coleção vazia, anel com menos de quatro pontos ou primeiro/último vértice diferentes.

- [ ] **Passo 2: implementar point-in-polygon com regra de borda**

Usar ray casting por anel. Ponto sobre segmento conta como dentro. O primeiro anel inclui; anéis seguintes são buracos e excluem. MultiPolygon retorna dentro se algum polígono incluir o ponto sem cair em buraco.

- [ ] **Passo 3: implementar círculo de cobertura**

Calcular o centro do envelope min/max do conjunto completo, medir Haversine até todo vértice e multiplicar o maior raio por 1,02. Persistir latitude/longitude com sete casas e radius_km suficiente para cobrir o vértice mais distante; não usar cityCenter() de LocationIQ.

- [ ] **Passo 4: implementar cliente IBGE**

Resolver cidade canônica na lista GET /api/v1/localidades/estados/{UF}/municipios e baixar GET /api/v3/malhas/municipios/{codigo}?formato=application/vnd.geo+json&qualidade=minima. Usar timeout, cache: no-store na primeira leitura e mensagens sanitizadas. Persistir cache válido por ibge_code e city+state_code.

- [ ] **Passo 5: impedir custo quando a fronteira falha**

prepareProspectingRunAction deve resolver boundary antes de consultar preço ou criar draft. Qualquer cidade ambígua, código ausente, timeout ou GeoJSON inválido retorna erro e não chama Business Listings.

- [ ] **Passo 6: verificar as cinco classes geométricas**

Usar um pequeno script Node descartável fora da árvore de produto para inspecionar: ponto interno, externo, na borda, dentro de buraco e dentro do segundo polígono de um MultiPolygon. Registrar os valores e resultados no README da evidência, sem criar arquivo de teste.

### Tarefa 4: Criar schema, RLS e RPCs de prospecção

**Arquivos:**

- Criar: supabase/migrations/20260925000000_prospecting_business_listings.sql

**Interfaces:**

- Produz tabelas: prospecting_category_catalog, prospecting_segment_categories, prospecting_city_boundaries, prospecting_runs, prospecting_run_pages, prospecting_candidates e prospecting_run_candidates.
- Produz RPCs: replace_prospecting_category_catalog, claim_prospecting_page, complete_prospecting_page, fail_prospecting_page e import_prospecting_candidate.

- [ ] **Passo 1: criar enums e tabelas com checks fechados**

Usar enums ou checks para run status draft/collecting/paused/completed/failed/cancelled; pause reason user/budget/vendor_price_change; page status claimed/completed/failed/unknown; territorial inside/outside/ambiguous; category exact/related/mismatch; review available/selected/ignored/duplicate/imported/stale/outside_city/ambiguous_location/category_mismatch. budget_usd e actual_cost_usd não negativos; page_limit = 1000; result_limit positivo.

- [ ] **Passo 2: fixar identidades e índices**

Criar unique(category_name), unique(segment_id, category_name), unique(state_code, city), unique(ibge_code), unique(place_id), unique(run_id, cursor_key) e unique(run_id, candidate_id). Índices de lista: runs(created_by, created_at desc), runs(status, updated_at), run_candidates(run_id, review_state, discovery_position), candidates(imported_lead_id), candidates(website_domain) where not null.

- [ ] **Passo 3: armazenar snapshots e não payloads brutos**

prospecting_runs recebe category_names text[], ibge_code, center/radius, budget, result_limit, preço estimado por request/result, total e cursores. prospecting_candidates usa somente colunas normalizadas da spec. prospecting_run_pages guarda cursor de entrada/saída, contagens, custo, lease e erro sanitizado.

- [ ] **Passo 4: implementar lease atômica**

claim_prospecting_page(p_run_id, p_actor_id, p_lease_seconds) bloqueia a run FOR UPDATE, valida ownership comercial, status collecting, orçamento e limite, reaproveita lease vencida, cria/retorna um único recibo claimed por cursor_key e grava lease_owner/lease_expires_at. Se outro lease estiver válido, retorna outcome busy sem mutar cursor.

- [ ] **Passo 5: implementar conclusão atômica da página**

complete_prospecting_page recebe p_page_id, p_actor_id, p_response jsonb normalizado e p_cost. Dentro de uma transação: valida lease; faz upsert de candidato por place_id; upsert da relação; grava rejeições missing_identity; atualiza contadores/custo/cursor; conclui ou pausa conforme limite/orçamento; marca página completed; libera lease. Uma repetição do mesmo page_id devolve o resultado anterior.

- [ ] **Passo 6: implementar falhas distintas**

fail_prospecting_page recebe known_envelope boolean. Quando falso, marca unknown e não avança cursor nem soma custo; quando verdadeiro e o fornecedor rejeitou antes de produzir resultados, marca failed com custo confirmado do envelope, libera lease e põe run em failed com mensagem pública.

- [ ] **Passo 7: aplicar RLS**

Integrantes comerciais podem ler catálogo/limites e as execuções/candidatos a que o produto dá acesso. Inserts e updates diretos de runs/pages/candidates ficam bloqueados para clientes; mutações passam pelas RPCs SECURITY DEFINER que validam auth.uid(), papel e ownership. Revogar execute de anon e conceder somente authenticated.

- [ ] **Passo 8: inspecionar a migração**

Confirmar por leitura que todas as tabelas têm RLS habilitada, timestamps, FKs com política de delete explícita, checks de estado e que nenhuma função SECURITY DEFINER depende de search_path implícito.

### Tarefa 5: Implementar cliente Business Listings e mapeador de candidato

**Arquivos:**

- Criar: lib/dataforseo/business-listings.ts
- Criar: lib/prospecting/types.ts
- Criar: lib/prospecting/candidates.ts
- Modificar: lib/dataforseo/client.ts

**Interfaces:**

- Produz: fetchBusinessListingsPage(input): Promise<BusinessListingsPageResult>.
- Produz: normalizeBusinessListing(item, observedAt): NormalizedCandidate | MissingIdentity.
- Produz: classifyCandidate(candidate, requestedCategories, geometry): CandidateClassification.

- [ ] **Passo 1: representar o envelope medido**

~~~ts
export type BusinessListingsPage = {
  totalCount: number | null
  count: number
  offset: number
  offsetToken: string | null
  nextOffset: number | null
  nextOffsetToken: string | null
  items: Record<string, unknown>[]
  cost: number
}
~~~

O resultado de erro distingue rejected (envelope conhecido), unknown (timeout/rede após envio) e invalid_response. Não devolver mensagem crua do fornecedor à UI.

- [ ] **Passo 2: montar a requisição imutável**

Enviar categories de 1 a 10, language_code pt, location_coordinate lat,lon,radius_km, limit 1000 e exatamente um cursor de entrada. Nunca enviar texto livre do segmento. O raio vem da run persistida, não é recalculado ao retomar.

- [ ] **Passo 3: mapear somente os campos aprovados**

Normalizar place_id, cid, feature_id, title, description, category/category_ids, additional_categories, address/address_info, phone, url/domain, latitude/longitude, rating.value/votes_count, is_claimed, work_time.current_status, logo, main_image, total_photos, check_url e last_updated_time. Ausência vira null; rating ausente não vira zero.

- [ ] **Passo 4: classificar categoria e território**

Categoria principal solicitada = exact; apenas categoria adicional solicitada = related; nenhuma = mismatch. Coordenada finita dentro da malha = inside; fora = outside; ausente/inválida = ambiguous. closed_forever/CLOSED_PERMANENTLY permanece persistido, mas inelegível.

- [ ] **Passo 5: tornar final de paginação explícito**

Há próxima página somente se o envelope fornecer cursor utilizável ou se offset + count for menor que total_count e count > 0. Uma página vazia encerra; cursor igual ao de entrada falha como invalid_response para evitar loop pago.

- [ ] **Passo 6: verificar com as evidências da Tarefa 1**

Executar um script Node de leitura dos JSON redigidos e imprimir total, cursor, nomes normalizados, missing_identity e classificações. Comparar manualmente cada saída com o JSON; não transformar o script em teste automatizado.

### Tarefa 6: Orquestrar draft, coleta, pausa, retomada e orçamento

**Arquivos:**

- Criar: app/actions/prospecting/runs.ts
- Criar: app/actions/prospecting/index.ts
- Criar: lib/prospecting/reads.ts

**Interfaces:**

- Produz: prepareProspectingRunAction(input): Promise<PrepareRunState>.
- Produz: startProspectingRunAction(runId): Promise<RunCommandState>.
- Produz: advanceProspectingRunAction(runId): Promise<AdvanceRunState>.
- Produz: pauseProspectingRunAction, resumeProspectingRunAction e cancelProspectingRunAction.

- [ ] **Passo 1: criar schemas Zod de entrada**

prepare aceita segmentId UUID, city, stateCode, categoryNames 1..10, primaryCategory, resultLimit 1..100000 e budgetUsd positivo com no máximo seis casas. Os comandos aceitam somente runId UUID. Nunca confiar em created_by, cursor, custo ou contadores enviados pelo cliente.

- [ ] **Passo 2: preparar sem pagar**

Autenticar; validar segmento/categorias; resolver boundary; ler preço da conta; calcular maxItemsFirstPage = min(1000, resultLimit); exigir orçamento >= custo máximo da primeira página; gravar draft com snapshots e retornar confirmação. Revalidar /prospecting após a escrita.

- [ ] **Passo 3: iniciar somente por confirmação explícita**

start muda draft para collecting, congela snapshots e chama advance uma vez. Se o usuário fechar a página depois disso, a execução permanece retomável; não esconder que o avanço depende de um cliente ativo nesta entrega.

- [ ] **Passo 4: avançar uma página sob lease**

advance autentica, chama claim_prospecting_page e trata outcomes busy, paused, terminal ou claimed. Apenas claimed chama fetchBusinessListingsPage. Resultado ok vai para complete_prospecting_page; rejected/invalid para falha conhecida; timeout/rede sem envelope vai para unknown. A action retorna DTO atualizado, nunca linhas internas da RPC.

- [ ] **Passo 5: recalcular autorização antes de cada página**

Usar o preço snapshot para estimar a próxima página e reler a tarifa atual da conta. Se a tarifa mudou para cima, pausar como vendor_price_change antes da chamada. Se o saldo do budget não comporta o máximo da próxima página, pausar budget. Nunca confiar em custo médio passado.

- [ ] **Passo 6: implementar transições legais**

pause somente collecting -> paused/user; resume somente paused user/budget/vendor_price_change -> collecting após validar preço e orçamento; cancel draft/collecting/paused -> cancelled; estados completed/failed/cancelled são terminais. Nenhuma transição apaga páginas ou candidatos.

- [ ] **Passo 7: verificar refresh, dois clientes e cursor repetido**

No navegador, iniciar uma run de limite pequeno, recarregar durante collecting e abrir a mesma URL em outra janela. Inspecionar que há um recibo por cursor, uma chamada paga por página e contadores monotônicos. Forçar cursor repetido com evidência controlada deve falhar sem terceira chamada.

### Tarefa 7: Detectar duplicidade e expor candidatos revisáveis

**Arquivos:**

- Criar: lib/prospecting/conflicts.ts
- Criar: app/actions/prospecting/read.ts
- Criar: app/actions/prospecting/review.ts
- Modificar: lib/prospecting/reads.ts

**Interfaces:**

- Produz: findProspectingConflict(supabase, candidate): Promise<ProspectingConflict>.
- Produz: listProspectingCandidatesAction(input): Promise<CandidatePageState>.
- Produz: setProspectingCandidateReviewAction(input): Promise<ReviewState>.

- [ ] **Passo 1: codificar a ordem de conflito uma vez**

Retornar primeiro: imported_lead_id/place_id do canal; lead_gbp_profiles.place_id; domínio em leads/lead_digital_channels; telefone normalizado + empresa normalizada + cidade; telefone compartilhado isolado como warning. O tipo contém kind, severity block|warning e relatedLeadId.

- [ ] **Passo 2: atualizar conflitos após cada página**

Depois do upsert de candidatos, classificar a ocorrência da run. place_id/domínio bloqueiam e põem review_state duplicate; telefone+empresa+cidade pede decisão humana; telefone isolado não bloqueia. outside/mismatch/closed têm precedência de inelegibilidade visual, sem apagar o conflito detectado.

- [ ] **Passo 3: implementar leitura paginada no banco**

Entrada: runId, query sanitizada, status, page de base 1 e pageSize máximo 100. Saída: items, page, pageSize, total e contadores agregados. Buscar somente colunas do DTO; não enviar geometry, leases, mensagens internas ou payloads de fornecedor.

- [ ] **Passo 4: implementar seleção/ignorar por IDs visíveis**

Receber candidateIds UUID distintos até 100. Recarregar as relações por run e ownership. selected somente para linhas potencialmente elegíveis ou ambiguous revalidável; ignored preserva conflito/classificações; imported não volta para selected. Seleção em massa opera nos IDs enviados pela tabela atual, nunca em “todos do filtro” implícito.

- [ ] **Passo 5: verificar casos de duplicidade**

Criar dados manuais controlados para domínio igual, place_id igual, telefone+nome+cidade e telefone compartilhado. Inspecionar severidade e relatedLeadId e remover somente os registros controlados ao final pelo mecanismo administrativo já adotado no ambiente.

### Tarefa 8: Permitir lead sem website sem quebrar os fluxos existentes

**Arquivos:**

- Criar: supabase/migrations/20260925000001_leads_optional_website.sql
- Modificar: lib/leads/types.ts
- Modificar: lib/leads/board-item.ts
- Modificar: lib/validations/lead.ts
- Modificar: app/actions/leads/create-lead.ts
- Modificar: app/actions/leads/update-lead.ts
- Modificar: app/actions/leads/spreadsheet.ts
- Modificar: app/(protected)/leads/page.tsx
- Modificar: components/custom/LeadForm/LeadForm.tsx
- Modificar: components/custom/LeadBoard/LeadBoardCardFace.tsx
- Modificar: components/custom/LeadDetailDialog/LeadDetailDialog.types.ts
- Modificar: components/custom/LeadDetailDialog/LeadDetailDialog.tsx
- Modificar: components/custom/LeadDetailDialog/LeadDetailHeader.tsx
- Modificar: components/custom/LeadDetailDialog/LeadRecordPanel.tsx
- Revisar: app/actions/leads/analyze-website.ts
- Revisar: app/actions/leads/analyze-visibility.ts
- Revisar: app/actions/leads/analyze-geo.ts
- Revisar: app/actions/leads/analyze-backlinks.ts

**Interfaces:**

- Altera LeadRecord, LeadWritePayload, LeadBoardItem e LeadBoardRow para website: string | null e website_domain: string | null.
- Mantém o payload específico da planilha com website e website_domain obrigatórios.

- [ ] **Passo 1: migrar o contrato SQL**

Remover NOT NULL de leads.website e leads.website_domain. Manter a unicidade de domínio como índice parcial WHERE website_domain IS NOT NULL. Adicionar check website_domain IS NOT NULL OR phone IS NOT NULL. Não converter string vazia em identidade: limpar valores vazios existentes para null antes do check.

- [ ] **Passo 2: separar a validação compartilhada da planilha**

leadFieldsSchema exige ao menos primaryWebsiteChannel(channels) ou phone normalizado. toLeadWritePayload retorna null para website/domain ausente. app/actions/leads/spreadsheet.ts preserva seu schema website min(1), seus tipos string e a correlação idByDomain.

- [ ] **Passo 3: proteger conflito e busca com domínio opcional**

create/update só executam consulta website_domain quando payload.website_domain não é null. A busca do board mantém company_name e canais; website_domain.ilike entra apenas como coluna anulável válida, sem interpolar “null”.

- [ ] **Passo 4: corrigir presenters**

Cards e detalhe exibem “—” para website ausente; não chamam canonicalWebsiteUrl, URL(), Link href ou clipboard com null. O placeholder de busca passa a “Empresa, site ou telefone” se a busca já consultar os canais de telefone.

- [ ] **Passo 5: impedir auditorias sem site**

As quatro actions recarregam o canal website no servidor e retornam mensagem pública “Este lead não possui site para esta análise.” antes de criar jobs, auditorias ou chamadas pagas. A UI mostra indisponível, não erro genérico nem botão ativo.

- [ ] **Passo 6: verificar manual, edição e planilha**

Criar lead manual com telefone e sem site; abrir/editar no board; confirmar ausência de link inventado. Tentar lead sem site e sem telefone e confirmar rejeição. Importar uma planilha sem website e confirmar que ela continua rejeitada pela regra específica.

### Tarefa 9: Revalidar e importar candidatos individualmente

**Arquivos:**

- Criar: app/actions/prospecting/import.ts
- Modificar: lib/prospecting/candidates.ts
- Modificar: lib/prospecting/conflicts.ts
- Modificar: supabase/migrations/20260925000000_prospecting_business_listings.sql
- Reusar: lib/dataforseo/google-info.ts
- Reusar: lib/leads/gbp-business-info-map.ts

**Interfaces:**

- Produz: importProspectingCandidateAction({ runId, candidateId }): Promise<ImportCandidateState>.
- Produz: importProspectingCandidatesAction({ runId, candidateIds }): Promise<ImportBatchState>.
- RPC import_prospecting_candidate recebe somente dados revalidados e referências; não chama fornecedor.

- [ ] **Passo 1: revalidar ownership e elegibilidade antes de pagar**

Carregar run/relação/candidato no servidor. Rejeitar outside, mismatch, closed, imported e candidate sem place_id. ambiguous pode seguir porque a chamada live pode fornecer coordenada; duplicate bloqueado não chama live até o usuário resolver o conflito permitido.

- [ ] **Passo 2: chamar Google Business Info uma vez por candidato**

Usar fetchGoogleBusinessInfo com placeId e coordenadas conhecidas. Mapear not_found para stale, encerrado para closed, ausência de site+telefone para no_contact. Atualizar candidato com os campos confirmados e last_verified_at; não iniciar coleta completa de GBP.

- [ ] **Passo 3: repetir geofence e categoria sobre o resultado live**

Reclassificar coordenada e categories do item live com o snapshot da run. outside e mismatch bloqueiam a importação. ambiguous só se torna elegível se a resposta trouxer coordenada interna.

- [ ] **Passo 4: repetir conflitos no momento da escrita**

Antes da RPC, recarregar conflitos; dentro da RPC, bloquear novamente place_id já importado, lead_gbp_profiles.place_id e domínio existente sob lock/índice. Se surgir conflito, não inserir lead e devolver relatedLeadId.

- [ ] **Passo 5: inserir lead e vínculo na mesma transação**

A RPC cria lead status new, assigned_sdr_id null, segment_id/cidade/UF da run, website/domínio opcionais, phone opcional e created_by actor. Cria canal website somente se houver site; preserva telefone no lead; grava imported_lead_id e review_state imported. Se alguma escrita falhar, nenhuma parte fica órfã.

- [ ] **Passo 6: processar lote sem transação global**

importProspectingCandidatesAction aceita até 50 IDs e processa sequencialmente para respeitar Server Actions e custo. Retorna um resultado por candidateId: imported, conflict, stale, closed, no_contact, outside, mismatch ou error. Falha de um não desfaz anteriores.

- [ ] **Passo 7: verificar corrida e retry**

Selecionar um candidato, criar manualmente um lead conflitante antes de importar e confirmar que a RPC devolve o lead existente. Repetir a importação do mesmo candidateId e confirmar idempotência no mesmo imported_lead_id.

### Tarefa 10: Construir actions de leitura para as rotas

**Arquivos:**

- Criar: app/actions/prospecting/read.ts
- Modificar: lib/prospecting/reads.ts
- Modificar: app/actions/prospecting/index.ts

**Interfaces:**

- Produz: listProspectingRuns(input): Promise<ProspectingRunPage>.
- Produz: getProspectingRun(runId): Promise<ProspectingRunDetail | null>.
- Produz: listProspectingCandidatesAction(input): Promise<CandidatePageState>.

- [ ] **Passo 1: definir DTOs completos e serializáveis**

Datas saem como ISO string; custos como number|null; totalCount null continua null. Run detail inclui status, pauseReason, contadores, cursor/progresso público, hasUnknownCost, comandos permitidos e categorias snapshot. Candidate DTO inclui os campos das colunas, eligibility e conflict; não inclui GeoJSON.

- [ ] **Passo 2: implementar lista com filtros no banco**

Aceitar q, status, page e pageSize máximo 50. Sanitizar q e pesquisar segmento/cidade sem montar filtros PostgREST com caracteres de controle. Ordenar por created_at desc e devolver count exato.

- [ ] **Passo 3: implementar detalhe com autorização**

requireCommercialMember e RLS devem concordar. ID malformado retorna null/not_found; erro de banco gera mensagem interna com cause, sem expor SQL. Calcular canPause/canResume/canCancel no servidor a partir do status.

- [ ] **Passo 4: manter leitura separada de mutação**

As páginas Server Components chamam readers diretamente. Client Components usam actions apenas para polling/comandos. Após mutação, revalidatePath('/prospecting') e revalidatePath('/prospecting/[id]', 'page') conforme o guia local do Next.js.

- [ ] **Passo 5: inspecionar payloads no navegador**

No painel de rede, confirmar que nenhuma resposta contém geometry, raw item, lease_owner, stack, credencial ou mensagem crua do fornecedor.

### Tarefa 11: Criar a lista de pesquisas e o diálogo de criação

**Arquivos:**

- Criar: app/(protected)/prospecting/page.tsx
- Criar: app/(protected)/prospecting/loading.tsx
- Criar: components/custom/Prospecting/ProspectingRunsPage.tsx
- Criar: components/custom/Prospecting/ProspectingRunTable.tsx
- Criar: components/custom/Prospecting/ProspectingCreateDialog.tsx
- Criar: components/custom/Prospecting/index.ts

**Interfaces:**

- Consome listProspectingRuns, prepareProspectingRunAction, startProspectingRunAction, busca de segmentos/cidades/categorias.
- Produz navegação para /prospecting/{runId}.

- [ ] **Passo 1: aplicar o skill visual antes de editar JSX**

Ler .agents/skills/suite-frontend/SKILL.md e seguir tokens, spacing, componentes do registry, estados e comportamento de Dialog do Suite. Não introduzir biblioteca visual nova.

- [ ] **Passo 2: criar Server Component da rota**

Usar PageProps<'/prospecting'>, await searchParams, requireCommercialMember e readers. A página controla q/status/page pela URL e usa o gutter compartilhado. loading.tsx reproduz a estrutura da tabela para evitar salto.

- [ ] **Passo 3: criar tabela operacional**

Colunas: segmento, cidade/UF, progresso, custo, status e data. Custo mostra actual/budget; progresso mostra fetched/total quando total existe e fetched/— antes. Estado vazio usa exatamente “Nenhuma pesquisa ainda. Crie uma pesquisa por segmento e cidade.”

- [ ] **Passo 4: criar diálogo em duas etapas**

Etapa configuração: segmento, categorias 1..10 com uma principal, cidade, resultLimit e budgetUsd. Etapa confirmação: tarifa por request/item, custo máximo da primeira página, círculo/município e aviso de total desconhecido. Somente “Iniciar pesquisa” chama start.

- [ ] **Passo 5: tratar mapeamento já existente**

Ao escolher segmento, preencher categorias persistidas e deixá-las editáveis. Segmento sem mapping exige seleção. Trocar campo nunca chama Business Listings; apenas catálogo, IBGE/preparação no submit e user_data gratuito.

- [ ] **Passo 6: verificar responsividade e teclado**

Confirmar foco inicial, labels, mensagens aria-live, submit desabilitado durante pending, Escape fecha somente antes de iniciar e tabela não cria scroll horizontal na página nos breakpoints suportados.

### Tarefa 12: Criar detalhe, polling e tabela de candidatos

**Arquivos:**

- Criar: app/(protected)/prospecting/[id]/page.tsx
- Criar: app/(protected)/prospecting/[id]/loading.tsx
- Criar: components/custom/Prospecting/ProspectingRunPage.tsx
- Criar: components/custom/Prospecting/ProspectingCandidateTable.tsx

**Interfaces:**

- Consome getProspectingRun, listProspectingCandidatesAction e comandos da Tarefa 6.
- Produz seleção local por candidateId e navegação paginada/filtros por URL.

- [ ] **Passo 1: montar cabeçalho fora do scroll**

Mostrar segmento/cidade, badge de estado, fetched/total, accepted/ambiguous/duplicate, actual/budget e Pausar/Retomar/Cancelar conforme flags do DTO. total null aparece “—”; antes do total usar Spinner, depois usar Progress.

- [ ] **Passo 2: implementar polling sem sobreposição**

Enquanto status collecting, agendar advanceProspectingRunAction somente depois que a chamada anterior terminar. Usar timer entre ciclos, cancelar no unmount e ao mudar para terminal/paused. busy apenas agenda nova leitura; não mostra erro. O efeito nunca usa Promise.all de actions.

- [ ] **Passo 3: criar tabela comparável por colunas**

Colunas exatas da spec: seleção, empresa, categoria, endereço/cidade, telefone, site, nota/avaliações, atualização, território e conflito/importação. Site ausente e nota ausente mostram “—”. check_url abre em nova aba com rel seguro.

- [ ] **Passo 4: implementar filtros e paginação**

Filtros: disponíveis, ambíguos, duplicados, importados e ignorados. Query/status/page ficam na URL. Seleção é limpa ao trocar run; ao trocar página/filtro, remover IDs não visíveis para impedir importação escondida.

- [ ] **Passo 5: distinguir todos os estados explícitos**

Mostrar paused user, budget e vendor_price_change com mensagens diferentes; failed separado de unknown cost; empty results separado de erro; outside, mismatch, closed e missing contact com razões próprias.

- [ ] **Passo 6: verificar retomada**

Iniciar, pausar, recarregar, retomar e cancelar uma run. Confirmar que refresh não reinicia cursor e que estado terminal interrompe todo polling.

### Tarefa 13: Criar importação na UI e pontos de entrada

**Arquivos:**

- Criar: components/custom/Prospecting/ProspectingImportDialog.tsx
- Modificar: components/custom/Prospecting/ProspectingRunPage.tsx
- Modificar: components/custom/Prospecting/ProspectingCandidateTable.tsx
- Modificar: components/custom/navigation.ts
- Modificar: components/custom/LeadBoard/LeadBoardToolbar.tsx

**Interfaces:**

- Consome importProspectingCandidateAction ou importProspectingCandidatesAction.
- Produz links de navegação para /leads?lead={id} após sucesso.

- [ ] **Passo 1: adicionar Prospecção ao grupo CRM**

Inserir item perto de Leads com href /prospecting, RiSearchEyeLine ou outro ícone existente de react-icons/ri e descrição “Pesquisa por segmento e cidade”. Confirmar isHrefActive para a rota de detalhe.

- [ ] **Passo 2: adicionar ação secundária ao toolbar de Leads**

Botão “Prospectar” navega para /prospecting; não abre o fluxo longo dentro do board. Manter LeadImport no mesmo toolbar e respeitar wrap existente.

- [ ] **Passo 3: montar resumo antes de importar**

O Dialog separa elegíveis, bloqueados e avisos. Não usar AlertDialog. O CTA informa quantidade realmente elegível; bloqueados continuam listados com motivo.

- [ ] **Passo 4: mostrar progresso individual**

Processar sequencialmente e atualizar cada linha para aguardando, revalidando, importado, conflito, desatualizado ou falha. Manter retry apenas nas falhas recuperáveis; importado ganha link para o lead.

- [ ] **Passo 5: sincronizar a tabela depois de cada resultado**

Atualizar a linha local e revalidar o detalhe ao fim do lote. Não limpar falhas; limpar da seleção apenas imported e bloqueios definitivos. Nenhum sucesso deve disparar GBP completo, Q&A, reviews ou posts.

- [ ] **Passo 6: verificar acessibilidade e estados de fechamento**

Impedir duplo submit; manter o diálogo aberto durante lote; anunciar progresso por aria-live sem repetir mensagens a cada render; permitir fechar depois que nenhuma chamada estiver em voo.

### Tarefa 14: Auditoria manual, evidência e operação

**Arquivos:**

- Modificar: docs/auditoria/evidencias/2026-09-22-prospeccao-business-listings/README.md
- Criar: docs/auditoria/evidencias/2026-09-22-prospeccao-business-listings/manual-verification.md

**Interfaces:**

- Consome a aplicação completa e uma conta DataForSEO configurada.
- Produz evidência reproduzível sem dados sensíveis e um checklist de liberação.

- [ ] **Passo 1: inspeção estática permitida**

Usar rg para confirmar que rotas/actions existem, que nenhum novo arquivo persiste raw_payload e que website/domain nulos têm guards antes de URL, Link e conflito. Não executar typecheck, build, lint ou test.

- [ ] **Passo 2: roteiro geográfico**

Pesquisar Demolição em São Paulo/SP com limite pequeno. Registrar ibge_code, centro, raio, um inside, um outside quando existir e um ambiguous quando a amostra permitir. Conferir no mapa oficial ou coordenadas que a classificação é plausível.

- [ ] **Passo 3: roteiro de categoria e custo**

Confirmar demolition_contractor como principal, total_count separado de aceitos, custo real igual à soma dos envelopes e budget impedindo nova página. Alterar a tarifa simulada/localmente antes da próxima página e confirmar pausa vendor_price_change sem chamada paga.

- [ ] **Passo 4: roteiro de envelope desconhecido**

Interromper a conexão durante uma chamada controlada. Confirmar página unknown, custo desconhecido visível, cursor não avançado e ausência de retry automático que possa duplicar cobrança.

- [ ] **Passo 5: roteiro de concorrência**

Abrir a mesma run em dois navegadores, deixar ambos em polling e conferir no banco um único receipt por cursor_key e contadores sem duplicação.

- [ ] **Passo 6: roteiro de pausa e retomada**

Pausar durante intervalo entre páginas, recarregar, retomar e concluir. Confirmar snapshots imutáveis e que uma lease vencida pode ser retomada sem recriar uma página completed.

- [ ] **Passo 7: roteiro de lead sem site**

Importar candidato confirmado com telefone e sem site. Abrir board/detalhe, editar e tentar auditorias dependentes de site. Confirmar “—”, telefone utilizável e auditorias indisponíveis sem custo.

- [ ] **Passo 8: roteiro de conflito tardio e idempotência**

Selecionar candidato, criar conflito antes da importação, importar e confirmar bloqueio com relatedLeadId. Repetir candidato já importado e confirmar o mesmo lead sem nova linha.

- [ ] **Passo 9: roteiro de segurança**

Tentar chamar actions com UUID de outra execução e inputs adulterados de created_by, custo, cursor e categorias. Confirmar not_found/forbidden sanitizado e nenhuma mutação. Inspecionar responses para ausência de credenciais, GeoJSON, lease e payload cru.

- [ ] **Passo 10: fechar a documentação operacional**

README deve registrar data, ambiente, IDs redigidos, custos confirmados, divergências e limitações: cobertura é a base DataForSEO, total_count é do círculo antes do geofence, coleta avança com cliente ativo e unknown exige decisão humana antes de retry.

---

## Ordem de entrega e portões

1. **Onda 0 — contrato:** Tarefa 1. Não seguir se place_id, paginação ou custo divergirem.
2. **Onda 1 — fontes gratuitas:** Tarefas 2 e 3. Não pagar busca se catálogo, preço ou malha falharem.
3. **Onda 2 — persistência e coleta:** Tarefas 4, 5 e 6. Não construir importação antes de lease/cursor/custo serem auditáveis.
4. **Onda 3 — qualidade do conjunto:** Tarefa 7.
5. **Onda 4 — contrato de lead:** Tarefa 8. Verificar planilha antes de liberar importação.
6. **Onda 5 — conversão:** Tarefas 9 e 10.
7. **Onda 6 — produto:** Tarefas 11, 12 e 13, aplicando suite-frontend.
8. **Onda 7 — liberação:** Tarefa 14. Nenhuma alegação de completude sem evidência manual registrada.

## Condições de conclusão

- Uma pesquisa válida não paga nada antes da confirmação explícita.
- Todas as páginas cobradas têm recibo completed, failed ou unknown e custo confirmado quando o envelope existe.
- Atualização/reabertura da tela não repete cursor concluído.
- A lista distingue dentro, fora, ambíguo, categoria exata/relacionada/incompatível e conflitos.
- Candidato sem place_id não é persistido; é contado como missing_identity.
- Importação sempre revalida ao vivo e repete conflitos no momento da escrita.
- Lead com telefone e sem site funciona no cadastro manual e no canal de prospecção; planilha continua exigindo site.
- Nenhuma importação dispara auditoria GBP completa, Q&A, reviews ou posts.
- Nenhuma resposta ao navegador contém segredo, payload cru, GeoJSON ou lease interno.
- O roteiro manual da Tarefa 14 está preenchido com evidências redigidas.
