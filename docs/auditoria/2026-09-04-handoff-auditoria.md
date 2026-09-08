# Handoff — Auditoria de lead e migração DataForSEO

> Ponto de entrada para retomar esta linha de trabalho numa sessão nova. Os
> outros três documentos desta pasta são o detalhe; este é o mapa.

## Context

Este trabalho começou como um levantamento de cobertura: mapear, ponta a ponta, o que a auditoria de lead realmente coleta e avalia contra os pilares da Fase 2 (A técnica, B SEO, C conteúdo, D UX, E local, F autoridade, G mensuração, H dados do cliente). O levantamento virou uma sequência de entregas, e depois numa migração de provider.

O registro durável está em três documentos no repositório, que devem ser lidos antes de qualquer coisa:

- `docs/auditoria/2026-09-04-alteracoes-auditoria.md` — mapeamento pilar a pilar, antes / o que mudou / o que falta
- `docs/auditoria/2026-09-04-impedimentos-dataforseo.md` — o que estava bloqueado, o que a migração resolveu, o que sobrou
- `docs/auditoria/2026-09-04-plano-dataforseo.md` — as etapas de consolidação e o que ainda falta delas

E os specs/planos em `docs/superpowers/specs/` e `docs/superpowers/plans/` (`2026-09-04-lead-audit-snapshot-*`, `2026-09-04-gbp-geo-grid-*`).

## Uma distinção que precisa ficar clara

O documento de referência da Fase 2 descreve auditoria **do cliente**, com entrada em `briefing/`, comando `/seo-audit {cliente}` e deep-research. O que existe no código é auditoria **do lead**, pré-venda, manual, pela interface, que termina na conversão. Os pilares valem como taxonomia nos dois lados, mas **a auditoria de cliente não existe**. A única ponte construída é `clients.baseline_at`.

Ficou pendente decidir se o documento de referência é o alvo a alcançar ou um sistema paralelo. Isso muda o que vem depois.

## Decisões travadas (e o porquê, que é o que se perde)

- **Snapshots append-only.** Nenhuma coleta sobrescreve a anterior. Sem isso não existe "antes" e a auditoria não serve de baseline. Reusa os timestamps que já existiam (`fetched_at`, `checked_at`) em vez de criar coluna nova.
- **Julgamento de analista fora do snapshot.** Revisão do site em `lead_website_reviews` por canal; leitura de reputação em `lead_gbp_profiles.reputation_note`. O julgamento é sobre o lead, não sobre a coleta — recoletar não pode apagá-lo nem duplicá-lo.
- **Amostra de páginas fixada** no primeiro crawl (`lead_digital_channels.audit_paths`). Sem isso duas coletas comparam páginas diferentes quando o menu muda.
- **Baseline ancorado na conversão** (`clients.baseline_at`), resolvido por consulta, sem cópia de dados.
- **DataForSEO como provider único.** SerpAPI removido inteiro. Motivo não é preferência: o SerpAPI não tem backlinks, devolve reviews por relevância (inviabilizando velocidade, taxa de resposta e evolução de nota), não expõe resposta do proprietário e cobra uma busca de plano por ponto de malha.
- **Preço nunca gravado no código.** `GET /v3/appendix/user_data` é gratuito e devolve a tabela de preços da própria conta. Preço fixo envelhece e varia por plano.
- **Malha híbrida por tamanho.** 3×3 e 5×5 em live; 7×7 e 11×11 na fila. O 3×3 existe para exercitar o caminho de fila por centavos.
- **Sentimento de review é campo humano**, não LLM. O projeto não tem integração de LLM e adicionar uma é decisão de arquitetura, não um cálculo.

## As armadilhas — cada uma já custou

Esta seção é a mais importante do documento. São classes de erro, não ocorrências.

**Histórico não pode sumir na leitura.** As tabelas são append-only e os tipos carregam os valores antigos. `serpapi_maps`, `serpapi_organic`, `serpapi` e o rótulo `"SerpAPI"` **continuam legíveis mesmo deixando de ser produzidos**. E os guards `enrichment.source !== "serpapi"` em `lib/leads/gbp.ts` (linhas ~287 e ~297) **não podem ser removidos**: eles suprimem `few_photos` e `no_services` para dados que o SerpAPI genuinamente não trazia. Removê-los faria perfis antigos ganharem gaps falsos.

**Fronteira `server-only`.** Um módulo com `import "server-only"` alcançado por componente de cliente quebra o build. Já aconteceu duas vezes e gerou dois splits: `usage.ts` (puro) separado de `user-data.ts` (server-only), e `envelope.ts` (puro) separado de `client.ts`. A verificação correta é **transitiva** — checar só imports diretos passa e não prova nada.

**Migrations precisam ser reexecutáveis.** Duas falhas reais: `create policy` sem `drop policy if exists` antes (o padrão certo já existia em `20260825000000_gbp_vendor_settings.sql`), e migrations que **leem colunas que elas próprias derrubam** — o parser resolve os nomes antes de executar, então `if exists` estático não salva; precisa de `do $$ ... execute $backfill$ ... $backfill$` guardado por `information_schema`.

**O incidente da malha.** O `tag` estava sendo lido no nível errado do envelope. Resultado: 121 tarefas foram criadas e pagas, os identificadores foram descartados, e cada passada seguinte do poll comprava a grade inteira de novo — cobrou cerca de treze vezes o mesmo trabalho. Disso nasceram `envelope.ts` com teste (`envelope.test.mjs`), o `readyGoogleMapsGridTasks` para readotar tarefas órfãs (ficam em `tasks_ready` por três dias com o `tag`), e `GBP_GRID_MAX_ATTEMPTS = 2`.

**Trava otimista que compara o status contra ele mesmo não trava nada.** Dois polls simultâneos em `running` passavam os dois, enfileiravam em dobro e perdiam escrita. Virou lease por `polling_at` com `GBP_GRID_LEASE_MS`, num único `UPDATE ... WHERE` atômico.

**`failed` e `done` com `position` nula são coisas diferentes.** Confundir os dois fez uma malha inteiramente falha parecer diagnóstico de que o cliente não rankeia em lugar nenhum. Daí os quatro estados: `pending`, `queued`, `done`, `failed`.

**Métodos divergentes na mesma série temporal.** A malha usava zoom 15 e a checagem avulsa 17, e o ponto central da malha alimenta o histórico de ranking. Virou `lib/dataforseo/maps-task.ts`, construtor único.

## Estado atual por área

**Versionamento** — pronto. Migrations `20260917`–`20260919`. Leituras resolvem a mais recente comparando timestamp, não ordem de consulta.

**Coleta de site ampliada** — pronto. Canonical (6 regras + 2 de convergência por sondagem), 6 headers de segurança, headings H1–H6 ordenados, robots interpretado com agentes de IA, `llms.txt`, noindex em toda a amostra, IDs de medição. Gaps de site: 25 → 37.

**Reputação** — parcial. Gaps de Q&A sem resposta e negativa sem resposta, mais o campo humano. Gaps de GBP: 18 → 20. **A matemática cronológica não foi escrita** — ver pendências.

**NAP** — corrigido. Telefone e endereço avaliados de forma independente (o `else if` impedia checar endereço quando havia telefone), com três estados por componente: `absent`, `match`, `mismatch`.

**Malha geográfica** — implementada e endurecida. Tamanhos 3/5/7/11, raio 1–25 km, modos live e fila, lease, readoção de tarefas órfãs, teto de tentativas, custo real acumulado. Migrations `20260921`–`20260923`.

**Migração DataForSEO** — feita. `lib/serpapi/` e `lib/gbp-vendor/` removidos, cinco actions sem ramo de provider, página de Ferramentas com saldo, uso e calculadora alimentados por `user_data`.

## Pendências, em ordem de dependência

1. **Validar os mapeadores contra payload real.** Nenhum jamais executou até a assinatura entrar. `dataForSeoTimeToIso`, `mapDataForSeoReviews`, `mapRankedKeywordsLiveResult`, `google-info`, `google-qna`, `google-updates`. **Bloqueia tudo que vier depois.** Duas perguntas a responder na mesma sessão: reviews trazem timestamp da resposta do proprietário (destrava tempo médio de resposta sem OAuth)? Items do Maps trazem `url`/`domain` (destrava domínio do concorrente de graça)?
2. **Matemática de reputação.** Média histórica por subtração da distribuição (`(S − S₅₀) / (N − 50)`), velocidade, frequência, taxa de resposta. Três guardas obrigatórias: bloquear quando `sortBy !== "newest"`; não calcular se `S₅₀ > S` ou `N ≤ 50` (a distribuição e a amostra vêm de chamadas diferentes); ignorar reviews sem nota. E toda métrica de janela declara a janela que mediu.
3. **Evolução no tempo** — nota, volume, reviews removidas. Nasce escura até cada lead ser coletado uma segunda vez.
4. **Decisão de pilar.** Backlinks e concorrentes não têm slot nos quatro pilares (`google`, `website`, `presence`, `visibility`). Quinto pilar de autoridade ou dentro de visibilidade. **Sem isso a etapa de autoridade não tem spec.**
5. **Backlinks** (`/backlinks/summary/live`) e **concorrentes** (Maps até 5 sem exigir que o cliente apareça; parar de descartar a SERP orgânica; tabela nova para concorrente orgânico).
6. **LGPD** — continua em zero, e é o item mais barato do mapa: os caminhos `/politica-de-privacidade` e `/termos` já estão em `internalPaths`, falta a regra.
7. **Âncoras 5–6** — teto de 3 travado em quatro lugares.

## Regras de trabalho desta linha

- **Sem build, typecheck, lint, teste ou Git.** Regra do repositório, registrada nas Global Constraints dos planos. A verificação é manual e por leitura.
- **Sem subagentes.** Foram recusados explicitamente.
- Specs e planos seguem o formato da casa em `docs/superpowers/`. Documentos de referência em `docs/auditoria/`.
- Comentário explica **por quê**, não o quê.

## Verificação

1. Ler os três documentos de `docs/auditoria/` — são o estado declarado.
2. `git status --porcelain` — a árvore tem ~60 arquivos pendentes e **nada foi commitado**.
3. Conferir que as migrations `20260917`–`20260923` foram aplicadas no banco.
4. Rodar uma coleta completa num lead de teste e conferir campo a campo contra o payload cru — é a pendência 1, e é o primeiro passo real.
5. Malha 3×3 na fila: confirmar que enfileira uma vez, grava os identificadores, coleta e fecha sem recobrar. É o teste barato do caminho que já falhou.
6. Abrir um lead com dados SerpAPI antigos: histórico legível, gaps inalterados, `few_photos`/`no_services` ainda suprimidos.
