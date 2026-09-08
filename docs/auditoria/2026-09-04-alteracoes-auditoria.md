# Alterações da Auditoria — o que mudou e como se alinha à Fase 2

Registro do que foi implementado nas ondas 1 e 2 da auditoria, mapeado contra os pilares do documento de referência da Fase 2, com o que já existia antes e o que continua ausente.

## A diferença de escopo que precede o mapeamento

O documento de referência descreve a Fase 2 como diagnóstico **do cliente**, com entrada em `briefing/`, comando `/seo-audit {cliente}` e uso de deep-research.

O que existe hoje no `suite` é outra coisa: uma auditoria **do lead**, pré-venda, disparada manualmente pelo analista na interface, sem comando, sem deep-research, e que termina na conversão. Não há um único ponto do código onde a auditoria seja executada para um cliente já convertido.

Isso não invalida o mapeamento abaixo — os pilares descrevem *o que* auditar, e isso vale nos dois lados. Mas duas consequências precisam ficar explícitas:

- **A cobertura por pilar descrita aqui é da auditoria de lead.** Ler este documento como se fosse o estado da auditoria de cliente seria errado: a auditoria de cliente não existe.
- **A ponte entre as duas foi construída na onda 1**, e é só uma: `clients.baseline_at`. Ele marca, no momento da conversão, qual snapshot de cada dimensão vale como "antes". Nada além disso atravessa a fronteira.

O documento de referência também trata a Fase 2 como condicional — "sem site, vira baseline zero". A implementação atual já se comporta assim por acidente: sem canal de site cadastrado, a auditoria de site não roda; sem perfil vinculado, a de GBP não roda. Mas isso é consequência da modelagem, não uma regra explícita de gate.

---

## A mudança estrutural, que não pertence a nenhum pilar

O maior item das duas ondas não aparece na lista de pilares porque não é um domínio de auditoria — é a condição para que qualquer pilar sirva de diagnóstico comparável.

**Antes:** toda coleta sobrescrevia a anterior. `lead_website_audits` tinha índice único por canal, `lead_visibility_audits` por lead, `lead_gbp_rank_checks` por perfil+keyword, e os dados variáveis do GBP eram colunas mutáveis do perfil. Reanalisar apagava o passado. Não existia "antes" em lugar nenhum do sistema.

**Agora:** as quatro coletas são append-only. Os índices únicos viraram compostos ordenados por timestamp, os dados variáveis do GBP saíram para `lead_gbp_snapshots`, e a leitura da aplicação resolve sempre o mais recente comparando data — não a ordem da consulta.

Três decisões acompanharam isso:

- **Amostra estável.** As páginas internas auditadas eram "as oito primeiras que a home linkava", o que mudava quando o menu mudava — duas coletas comparavam sites diferentes. Agora a lista é fixada no primeiro crawl (`lead_digital_channels.audit_paths`) e reutilizada. Página que passa a responder erro entra no snapshot com o status, em vez de desaparecer da lista.
- **Julgamento do analista fora do snapshot.** A revisão do site saiu para `lead_website_reviews` por canal, e a leitura de reputação nasceu em `lead_gbp_profiles.reputation_note`. O julgamento é sobre o lead, não sobre a coleta: uma nova análise não o apaga nem o duplica por snapshot.
- **Âncora de baseline.** `clients.baseline_at` recebe o momento da conversão; o baseline de cada dimensão é o snapshot mais recente até aquela data, resolvido por consulta, sem cópia de dados.

---

## Mapeamento por pilar

### A. Técnica & Performance

| Item | Antes | Mudou | Continua faltando |
|---|---|---|---|
| HTTPS | ✅ | — | — |
| sitemap.xml / robots.txt | ✅ leitura | robots agora **interpretado** em grupos `User-agent`/`Allow`/`Disallow`, com texto bruto guardado | sitemap ainda limitado a 3 arquivos e amostra de 20 URLs |
| Redirects | parcial — seguidos, não registrados | — | cadeia, 301 vs 302, http→https, loops |
| Erros de rastreamento | ✅ status por página | páginas com erro agora **persistem** no snapshot | — |
| **Canonical** | ❌ inexistente | **6 regras novas** + 2 de convergência (www e barra final, por sondagem das variantes) | duplicidade em escala (exige mais que 9 páginas) |
| Performance | ✅ PSI mobile+desktop | — | só a home |
| Core Web Vitals | ✅ LCP/CLS · INP quase sempre nulo | **corrigido** o bug que lia CLS de campo 0,01 como 1,0 e gerava `poor_cwv` falso | INP de campo depende de CrUX; sem distinção entre "ok" e "sem dado" |
| Mobile | ✅ viewport | — | usabilidade real |
| **Segurança** | ✅ SSL e mixed content · ❌ headers | **6 headers coletados e gravados**, com um gap único listando os ausentes | COOP/COEP/CORP |
| Links quebrados / 404 | ❌ | páginas da amostra com erro passam a ser visíveis | links internos e externos, cadeia, soft 404 |

### B. SEO

| Item | Antes | Mudou | Continua faltando |
|---|---|---|---|
| On-page: titles, descriptions, alt | ✅ | — | — |
| **Headings** | ✅ só H1 e H2 | **H1–H6 em lista ordenada por documento**, com gap de hierarquia quebrada; H1/H2 seguem gravados como derivados | — |
| **Canonical (on-page)** | ❌ | **extraído e avaliado por página** | — |
| **Indexação** | ✅ só meta robots, só na home | **X-Robots-Tag** passa a pesar · `noindex` avaliado em **toda a amostra** · `robots.txt` bloqueando Googlebot vira gap | `site:dominio`, cobertura real, motivo de exclusão — dependem do Search Console |
| Dados estruturados / Schema | ✅ só nomes de `@type` de JSON-LD | — | validação, Rich Results, propriedades obrigatórias, microdata, JSON-LD bruto |
| Arquitetura de URL | ✅ 9 páginas, sem recursão | amostra passou a ser **estável entre coletas** | profundidade de clique, órfãs, grafo, anchor text |
| Rankings atuais | ✅ via provider | — | bloqueado pelo DataForSEO (ver documento de impedimentos) |

### C. Conteúdo

Sem alteração nas duas ondas. Continua com volume de palavras e detecção de conteúdo raso; sem duplicidade, frescor, cobertura de temas ou otimização de imagem além do alt.

### D. UX/UI & Conversão

| Item | Antes | Mudou | Continua faltando |
|---|---|---|---|
| UX/UI | ✅ revisão humana com 7 critérios, apoiada no screenshot do PSI | revisão **desacoplada do snapshot** — sobrevive a recoleta e ao poll do PageSpeed | medição automática |
| Conversão | ✅ tel/WhatsApp/mailto, contato só no rodapé | — | formulários, campos, validação, teste de envio, microconversões |
| Acessibilidade | ✅ score Lighthouse + contagem de contraste | — | elementos que falharam, teclado, ARIA, WCAG por critério |

### E. SEO Local

| Item | Antes | Mudou | Continua faltando |
|---|---|---|---|
| Google Business Profile | ✅ completo | agora **versionado** — existe histórico da ficha | — |
| NAP | ✅ parcial (site × GBP, só home) | — | o `else if` que impede conferir endereço quando há telefone |
| **Citations** | ❌ inexistente | — | diretórios, agregadores — zero cobertura |
| **Reviews / Reputação** | ✅ nota, volume, distribuição, taxa de resposta | **negativa sem resposta virou gap** (dado já era calculado e ignorado) · **campo de leitura humana** da reputação, que vira oportunidade de analista | velocidade, frequência, tempo de resposta, evolução — bloqueados por provider |
| **Q&A** | ✅ coletado e exibido | **passou a virar gap** e chegar ao roadmap e ao PDF | — |
| Local Pack | ✅ Maps por coordenada única | **malha geográfica** de 5×5, 7×7 ou 11×11 pontos, raio de 1 a 25 km, com ARP, ATRP e SoLV · histórico por keyword | Local Pack web, teto de 3 âncoras |

**A malha geográfica** é a mudança mais visível do pilar E. Antes, "aparece no Local Pack" era respondido num único ponto — a coordenada do próprio perfil. Agora o scan varre uma malha centrada nesse ponto e mostra a posição em cada célula, no formato da ferramenta de referência: marcador do perfil ao centro e marcadores numerados em volta, preenchendo enquanto a coleta avança.

Três decisões de projeto valem registro porque cada ponto é uma busca paga:

- A cota é conferida uma única vez, antes do primeiro ponto.
- Os pontos são gravados conforme chegam, então um retry retoma nos pendentes e uma falha no meio termina em `partial` preservando o que já foi coletado.
- Um índice único parcial no banco impede um segundo scan ativo para a mesma keyword — dois cliques simultâneos passariam pela validação da aplicação, mas não por ele.

E uma economia que sai de graça: numa malha ímpar o ponto central coincide com a coordenada do perfil, então o scan grava também um `lead_gbp_rank_checks` com aquele resultado. Rodar a malha atualiza o ranking avulso sem chamada adicional.

Os concorrentes do top 3 são guardados **por ponto**, mesmo sem tela que os exiba: a resposta já os traz, e descartá-los obrigaria a reescanear — que é justamente a parte cara. Diferente da checagem avulsa, eles são capturados mesmo onde o perfil não aparece, que é o ponto em que saber quem está lá mais interessa.

### F. Autoridade & Externa

Sem alteração. Backlinks continua com zero ocorrências no código. Concorrentes continua sendo apenas os até três negócios acima do cliente no Maps, e só quando ele aparece no Top 20.

### G. Mensuração

| Item | Antes | Mudou | Continua faltando |
|---|---|---|---|
| Analytics & rastreamento | ✅ 3 booleanos (GTM, gtag, pixel) | **IDs extraídos** — `G-`, `GTM-`, `AW-` e pixel da Meta. Separa "tinha analytics" de "era a propriedade da agência anterior" | GA4 e Search Console reais, eventos, microconversões |
| **Conformidade / LGPD** | ❌ | **nada** | banner, política de privacidade, termos, cookies antes do consentimento — permanece em zero |

O item de LGPD foi identificado como o de menor custo do mapa inteiro — os caminhos `/politica-de-privacidade` e `/termos` já são coletados em `internalPaths`, falta só a regra — e mesmo assim **não entrou em nenhuma das duas ondas**. Fica registrado como dívida consciente.

### H. Dados e conteúdo do cliente

Não existe. Não há deep-research, nem busca complementar ao briefing, nem qualquer coleta que vá além do domínio e do perfil cadastrados.

### Presença online (transversal)

Redes sociais mantêm o que já tinham: sete tipos, cadastro manual cruzado com o que o site linka, três regras de coerência e a camada humana de seguidores e última publicação. **Menções da marca continua em zero** — e segue valendo o achado de que, no caminho SerpAPI, o sistema roda uma busca pelo nome da empresa e descarta a SERP inteira exceto a posição do próprio domínio.

---

## Migração para o DataForSEO

O SerpAPI foi removido e o DataForSEO passou a ser o provider único de todas as coletas: perfil do Google, avaliações, posts, Q&A, ranking no Maps, malha geográfica e visibilidade orgânica. Saíram do projeto `lib/serpapi/`, `lib/gbp-vendor/`, `visibility-seeds.ts` e `visibility-organic-parse.ts` — os dois últimos existiam apenas para gerar e interpretar o conjunto sintético de keywords que o caminho SerpAPI exigia.

Isso muda a qualidade de duas dimensões, não só o fornecedor:

- **Visibilidade orgânica** deixa de ser medida contra keywords inventadas pelo sistema e passa a vir de `ranked_keywords`, com volume, dificuldade, intenção e tráfego estimado reais.
- **Reputação** passa a ter amostra cronológica e resposta do proprietário, o que destrava velocidade de avaliações, taxa de resposta e evolução de nota — cálculos que estavam bloqueados por limitação do provider anterior.

**A malha ficou híbrida por tamanho:** 5×5 no modo live, 7×7 e 11×11 na fila padrão, onde o `task_post` aceita 100 tarefas por requisição e uma malha de 121 pontos sai em duas chamadas.

**O custo deixou de ser estimativa.** O campo `cost` que a API devolve em toda resposta era descartado; agora é somado por scan em `cost_usd`. E a página de Ferramentas trocou o seletor de provider por três blocos — saldo, uso contra limites por seção, e uma calculadora cujos preços vêm da tabela da própria conta via `/v3/appendix/user_data`, que é gratuito. Nenhum preço fica gravado no código.

**O histórico foi preservado de propósito.** Os valores `serpapi_maps`, `serpapi_organic` e `serpapi` continuam nos tipos e nas constraints, e os guards que suprimem `few_photos` e `no_services` para dados vindos do SerpAPI seguem intactos — removê-los faria perfis antigos ganharem gaps falsos. Snapshots dos dois providers não são comparáveis entre si.

## Placar

**Gaps de site:** 25 → **37**. Doze novos, todos com rótulo, título de oportunidade e impacto: seis de canonical, dois de convergência de URL, headers de segurança, hierarquia de headings, noindex em páginas internas e robots bloqueando busca.

**Gaps de GBP:** 18 → **20**. Perguntas sem resposta e avaliação negativa sem resposta.

**Migrations:** 6. Três na onda 1 (versionamento, snapshots de GBP, revisão por canal), uma na onda 2 (nota de reputação), uma da malha geográfica e uma da migração (modo, custo e tarefas da malha).

**Módulos novos:** 11 — `website-canonical`, `website-headers`, `website-headings`, `website-audit/robots`, `gbp-snapshot`, `audit-baseline`, `gbp-grid`, `dataforseo/configured`, `dataforseo/user-data`, `dataforseo/operations`, `dataforseo/google-maps-grid`.

**Módulos removidos:** `lib/serpapi/` (4 arquivos), `lib/gbp-vendor/` (3), `visibility-seeds.ts`, `visibility-organic-parse.ts`, `validations/gbp-vendor.ts` e a action de troca de provider.

**Dado que já existia e passou a ser usado:** `unrepliedLowRating`, `qna.unansweredCount`, `indexable` das páginas internas, e os headers HTTP que a resposta já trazia. Nenhum desses exigiu coleta nova — só leitura.

**Nada foi verificado.** Sem build, typecheck, lint ou teste, por instrução do repositório. As migrations são arquivos e não foram aplicadas.
