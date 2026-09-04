# Auditoria de Lead — Snapshot Versionado e Coleta Ampliada — Design

## Objetivo

Transformar a auditoria de lead em um registro versionado e comparável, e completar a coleta do site com os campos que hoje faltam, antes que o primeiro baseline seja gravado. A auditoria deixa de ser uma fotografia sobrescrita a cada execução e passa a ser uma série de snapshots, com um deles marcado como baseline no momento da conversão.

A regra que organiza o recorte: tudo que muda a **forma** do snapshot precisa entrar junto e antes da primeira coleta versionada. Um campo que nasce no segundo snapshot e não existe no primeiro perde a comparação para sempre, porque o baseline não se refaz.

## Decisões aprovadas

- Os snapshots passam a ser append-only. Nenhuma coleta sobrescreve a anterior; a leitura padrão da aplicação é a mais recente.
- Não há coluna nova de timestamp: `lead_website_audits.fetched_at`, `lead_visibility_audits.fetched_at` e `lead_gbp_rank_checks.checked_at` já existem e passam a ser a chave de ordenação.
- Os dados variáveis do perfil do Google (`enrichment`, `reviews`, `posts`, `qna`) saem de `lead_gbp_profiles` para uma tabela de snapshots própria. Sem isso, "evolução de nota", "evolução de total de avaliações" e "reviews removidas" continuam impossíveis.
- A revisão do analista sai do snapshot e passa a viver por canal, seguindo o padrão já existente em `lead_digital_presence_audits`. O julgamento é sobre o lead, não sobre a coleta.
- A amostra de páginas é fixada no primeiro snapshot do canal e reutilizada nas coletas seguintes. Uma página da amostra que passa a responder erro é gravada com o status, não descartada.
- A conversão marca o baseline. `clients.baseline_at` recebe o momento da conversão; o baseline de cada dimensão é o snapshot mais recente igual ou anterior a essa data.
- Headings passam a ser coletados de H1 a H6 em lista única, na ordem do documento. `h1` e `h2` continuam sendo gravados como derivados, para que snapshots antigos e novos permaneçam comparáveis.
- Canonical é extraído e avaliado por página.
- Headers de resposta selecionados passam a ser gravados: `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` e `X-Robots-Tag`.
- `noindex` passa a ser avaliado em todas as páginas da amostra e a considerar `X-Robots-Tag`, não apenas a meta tag da home.
- O `robots.txt` passa a ser gravado e interpretado em grupos de `User-agent` com `Allow`/`Disallow`. A presença de `llms.txt` é verificada. O bloqueio a agentes de IA é registrado como fato, não como defeito.
- Os identificadores das tags de medição (`G-`, `GTM-`, `AW-` e pixel da Meta) passam a ser extraídos, além do booleano que já existe.
- Screenshots do PageSpeed continuam em base64 dentro do payload.
- A resolução de provider **não** é separada. O SerpAPI sai inteiro quando a assinatura do DataForSEO entrar, na onda 3; dividir o resolver agora seria trabalho descartado.

## Fora de escopo

- Backlinks, snapshot competitivo, padronização do DataForSEO e remoção do SerpAPI. São a onda 3, bloqueada na assinatura.
- Cálculos derivados sobre o que já está gravado: matemática de nota, velocidade e frequência de review, sentimento, temas, `unrepliedLowRating` virando gap, Q&A virando gap. São a onda 2 e não afetam a forma do snapshot, então podem entrar depois sem prejudicar comparabilidade.
- Métricas proprietárias do Google Business Profile. Exigem OAuth do titular e aprovação prévia do Google, e só existem depois da venda.
- Recorrência ou agendamento de coleta. A auditoria continua manual, sob demanda do analista.
- Crawl recursivo e ampliação da amostra além de nove páginas. O escopo é refinamento, não pesquisa profunda.
- Captura de tela do perfil do Google e do Analytics.
- Propagação do diagnóstico para o cliente além da marcação de baseline.
- INP permanece como está. Os falsos positivos já conhecidos em `no_internal_links` (home que só linka para a raiz) e o ramo morto de query string em `unfriendly_urls` também ficam fora, registrados aqui para não se perderem.

Uma correção entra por exceção: `fieldCls` em `lib/leads/website-pagespeed.ts` divide por cem apenas quando o valor é maior que um, então um CLS real de 0,01 chega do CrUX como `1` e é lido como 1,0, gerando `poor_cwv` falso. Como o valor entra no snapshot, o erro contaminaria todo baseline.

## Arquitetura

### Snapshot versionado

Os três índices únicos que hoje forçam sobrescrita são substituídos por índices compostos de leitura: `lead_website_audits (channel_id, fetched_at desc)`, `lead_visibility_audits (lead_id, fetched_at desc)` e `lead_gbp_rank_checks (profile_id, keyword, checked_at desc)`.

`analyzeLeadWebsite` deixa de consultar a linha existente para decidir entre `update` e `insert`, e passa a sempre inserir. `analyzeLeadVisibility` e `checkGbpRanking` seguem a mesma mudança. As funções de leitura em `website-access.ts`, `visibility-access.ts` e `gbp-access.ts` passam a selecionar a linha mais recente por chave.

Os jobs de PageSpeed não mudam: `pollLeadWebsiteJobs` já opera por `audit_id` e portanto se prende ao snapshot correto sem alteração.

### Snapshot do perfil do Google

`lead_gbp_profiles` permanece como registro de identidade e vínculo: `place_id`, `is_primary`, `matched_website_key`, `rank_keywords`, `notes`, `cid` e `payload`. As colunas variáveis de auditoria passam para `lead_gbp_snapshots`, append-only, com `profile_id`, `captured_at`, `payload`, `enrichment`, `reviews`, `posts` e `qna`.

`payload` fica nos dois lugares de propósito: no perfil como estado corrente, porque `lib/briefing/prefill.ts` o lê diretamente para preencher endereço, horários e telefone do briefing; e no snapshot como cópia histórica, para que o comparativo tenha a ficha como ela era.

A carga inicial move a linha atual de cada perfil para um primeiro snapshot, preservando `enrichment_at`, `reviews_at` e `posts_at` como `captured_at` quando existirem. As colunas antigas são removidas depois do backfill.

### Amostra estável

`lead_digital_channels` ganha `audit_paths text[] not null default '{}'`. No primeiro crawl do canal, `crawlTargetsFromHome` deriva a lista como hoje e ela é persistida. Nas coletas seguintes, `crawlWebsite` recebe a lista fixa e a usa no lugar do que a home linka no momento, de modo que duas coletas comparem as mesmas URLs mesmo que o menu tenha mudado.

`fetchPage` deixa de retornar `null` em falha. Uma página da amostra que responde erro passa a gerar um `WebsitePageSnapshot` mínimo, com `url`, `status` e os demais campos zerados, para que o desaparecimento de uma página seja um dado do comparativo e não uma ausência silenciosa.

Limpar `audit_paths` para reconstruir a amostra é ação manual e fica fora desta entrega; a coluna vazia já faz o comportamento voltar ao atual.

### Revisão do analista por canal

Nova tabela `lead_website_reviews`, com `channel_id` único, `lead_id`, `review jsonb`, `notes text`, `updated_at` e `updated_by`. O conteúdo de `lead_website_audits.review` e `.notes` da linha atual de cada canal é copiado para lá, e as duas colunas são removidas em seguida.

O fallback legado de `readWebsiteReview`, que converte `notes` antigo em `review.other`, precisa ser executado durante a cópia, porque depois dela não haverá mais `notes` no snapshot.

`LeadWebsiteAudit` deixa de carregar `review` e `notes`. As actions que montam o painel do site passam a compor snapshot mais recente e revisão do canal em duas leituras.

### Baseline na conversão

`clients` ganha `baseline_at timestamptz`. `convertLeadToClient` o preenche com o mesmo `generatedAt` já usado para `converted_at`.

O baseline de cada dimensão é resolvido por consulta: o snapshot mais recente cujo timestamp seja igual ou anterior a `baseline_at`. Não há cópia de dados. Se não existir snapshot anterior à conversão, a dimensão simplesmente não tem baseline, e a interface informa isso em vez de exibir um comparativo falso.

### Coleta ampliada do site

`parseHtmlPage` passa a produzir, além do que já produz:

- `canonical: string | null`, resolvido para URL absoluta a partir de `link[rel="canonical"]`.
- `headings: { level: number; text: string }[]`, de H1 a H6, na ordem do documento. `h1` e `h2` continuam sendo gravados, derivados desta lista.
- `headers: Record<string, string>` com as seis chaves selecionadas, em minúsculas, propagadas de `safeFetch`, que hoje já recebe a resposta e descarta tudo além de `location` e `content-type`.
- `indexable` passa a considerar `X-Robots-Tag` além das metas `robots` e `googlebot`.

`WebsiteRobotsSnapshot` passa a carregar `content` (texto bruto, com teto), `groups` (pares de user-agent com suas regras `Allow`/`Disallow`) e `aiAgents`, a lista dos agentes de IA encontrados com a decisão de cada um. O crawl também verifica `llms.txt` e grava presença e status.

`extractHtmlSignals` passa a devolver, junto dos booleanos atuais, `measurementIds` com os identificadores encontrados para GA4, GTM, Google Ads e pixel da Meta.

### Regras derivadas

Gaps novos, todos avaliados por página da amostra:

- `canonical_missing` — página sem canonical.
- `canonical_points_elsewhere` — canonical aponta para outra URL do mesmo domínio.
- `canonical_external` — canonical aponta para outro domínio.
- `canonical_insecure` — página em HTTPS com canonical em HTTP.
- `canonical_vs_noindex` — página com canonical e `noindex` ao mesmo tempo.
- `canonical_non_indexable` — canonical aponta para uma página da amostra que não é indexável.
- `host_canonicalization` e `slash_canonicalization` — resolvidos por sondagem: a home é buscada nas variantes com e sem `www` e com e sem barra final, e as URLs finais e os canonicals são comparados. São quatro requisições adicionais por auditoria.
- `weak_security_headers` — um único gap, com detalhe listando quais dos seis headers faltam. Seis gaps separados poluiriam o roadmap sem ganho de leitura; os valores brutos ficam no snapshot para o comparativo.
- `heading_hierarchy` — a página pula um nível de heading ou começa abaixo de H1.
- `noindex_internal_pages` — páginas da amostra fora da home marcadas como não indexáveis.
- `robots_blocks_search` — o `robots.txt` bloqueia Googlebot ou atinge alguma página da amostra.

O bloqueio a agentes de IA **não** gera gap. É registrado no snapshot e exibido como fato, porque bloquear é decisão legítima do negócio.

Gaps existentes que precisam ser reescritos para ler de `headings` em vez de `page.h1`: `missing_h1` e `duplicate_h1`. O gap `noindex` mantém o significado atual, restrito à home, e passa a conviver com `noindex_internal_pages`.

## Arquivos previstos

- Criar `supabase/migrations/*_lead_audit_snapshots.sql`, `supabase/migrations/*_lead_gbp_snapshots.sql`, `supabase/migrations/*_lead_website_reviews.sql` e `supabase/migrations/*_client_baseline.sql`.
- Criar `lib/leads/website-headings.ts`, `lib/leads/website-canonical.ts`, `lib/leads/website-headers.ts`, `lib/website-audit/robots.ts` e `lib/leads/gbp-snapshot.ts`.
- Modificar `lib/website-audit/fetch.ts`, `lib/website-audit/crawl.ts`, `lib/website-audit/parse.ts`, `lib/website-audit/sitemap.ts`.
- Modificar `lib/leads/website-audit.ts`, `lib/leads/website-opportunities.ts`, `lib/leads/website-review.ts`, `lib/leads/website-pagespeed.ts`, `lib/leads/gbp.ts`, `lib/leads/gbp-audit.ts`, `lib/leads/digital-channels.ts`.
- Modificar `app/actions/leads/analyze-website.ts`, `app/actions/leads/website-access.ts`, `app/actions/leads/update-website-audit.ts`, `app/actions/leads/analyze-visibility.ts`, `app/actions/leads/visibility-access.ts`, `app/actions/leads/check-gbp-ranking.ts`, `app/actions/leads/gbp-access.ts`, `app/actions/leads/poll-gbp-jobs.ts`, `app/actions/leads/get-lead.ts`.
- Modificar `app/actions/clients/convert-lead.ts`.
- Modificar os componentes de `LeadWebsitePanel` e `LeadGbpPanel` que exibem revisão, headings e gaps.

## Critérios de aceitação

- Executar a análise de site duas vezes no mesmo canal produz duas linhas em `lead_website_audits`, e o painel exibe a mais recente.
- Executar a checagem de ranking duas vezes para a mesma keyword preserva o resultado anterior.
- Atualizar o perfil do Google preserva o `enrichment` e as `reviews` anteriores em `lead_gbp_snapshots`.
- A revisão do analista sobrevive a uma nova coleta e não aparece duplicada entre snapshots.
- A segunda coleta de um canal busca exatamente as mesmas URLs da primeira, mesmo que o menu da home tenha mudado.
- Uma página da amostra que passou a responder 404 aparece no snapshot com `status` 404, em vez de desaparecer da lista.
- Converter um lead grava `baseline_at`, e a resolução do baseline devolve o snapshot imediatamente anterior à conversão.
- Um lead convertido sem nenhuma auditoria anterior não exibe comparativo, e a interface diz que não há baseline.
- Uma página sem `link[rel="canonical"]` gera `canonical_missing`; uma com canonical para outro domínio gera `canonical_external`.
- Um site sem os seis headers gera um único `weak_security_headers`, com o detalhe listando os seis.
- Um `robots.txt` com `Disallow` para `GPTBot` aparece no snapshot como fato e não gera gap.
- Um `robots.txt` que bloqueia Googlebot gera `robots_blocks_search`.
- Uma página que vai de H1 para H3 gera `heading_hierarchy`.
- Um CLS de campo igual a `1` no CrUX é lido como 0,01 e não gera `poor_cwv`.
