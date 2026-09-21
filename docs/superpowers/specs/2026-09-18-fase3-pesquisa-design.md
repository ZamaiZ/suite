# Fase 3 — Pesquisa — Design

## Objetivo

Construir a pesquisa de mercado e SERP que roda **depois do onboarding**, lê
`briefing/` + `auditoria/`, e devolve inteligência bruta + recomendações para a
Fase 4 (Estratégia) decidir.

O alvo é o mercado — concorrentes, palavras-chave, intenção, SERP, entidades,
gaps e tendências. Não é o cliente: isso foi a Fase 2.

**Enriquece, nunca altera.** A pesquisa não escreve no briefing. Referencia a
versão que a originou e grava ao lado. A única exceção é o pilar H1, que
preenche campos deixados `PENDENTE`.

## O que motivou

Nada da Fase 3 existe no código. A palavra "research" aparece em exatamente
cinco arquivos do repositório, todos `.md` — nenhum `.ts`, `.tsx` ou `.sql`.

E ela já está registrada como fora de escopo deliberado, não como esquecimento.
O não-escopo de `2026-09-09-report0-cobertura-design.md` nomeia os três itens
que sobram para cá:

> **Keyword research, regiões de atuação, estrutura de páginas.** É o que a
> referência promete "em 3–5 dias", e é fase de cliente.

O cruzamento dos oito pilares do documento de referência contra o que a
auditoria já grava mostra que **metade da Fase 3 já está paga**.

### Cobertura atual por pilar

| Pilar | Já gravado | Falta |
|---|---|---|
| **A** Mercado, tendências, sazonalidade | `aiDemand.monthlyTotals` (12m), volume por keyword no visibility | volume 12m das keywords-alvo, persona real |
| **B** Concorrentes e benchmark | local pack do Maps, marcas das `answerList` do GEO | **top 10 orgânico, `competitors_domain`, link gap** |
| **C** Keywords e intenção | keywords rankeadas com volume + `intent` + `adsCompetition`; `ranked-keywords.ts` e `search-intent.ts` prontos | expansão, clusters, query fan-out |
| **D** SERP e busca por IA | `serpFeatures` por keyword, prompt visibility em 4 provedores | composição da SERP, **PAA extraído** (temos a flag, não as perguntas), QDF |
| **E** Entidades e semântica | — | tudo |
| **F** Gaps e outlines | — | tudo |
| **G** Sinais locais | categorias GBP, rank checks, reviews, QnA | categorias dos concorrentes, páginas de cidade deles, citations |
| **H** Inteligência local por região | — | tudo |

Três coisas já pagas que a pesquisa consome sem recoletar: o **perfil de
backlinks** (spam score e clusters de anchor/IP já calculados), o **QnA do GBP**
(perguntas reais sem resposta, matéria-prima de FAQ com demanda demonstrada) e o
**vocabulário das reviews** (alimenta tom de voz e cobertura semântica).

### As classes de problema que o cruzamento expôs

Levantadas sobre um cliente de teste, mas são classes, não ocorrências.

1. **Briefing sem validação de entrada.** `targetCities: ["Todas"]` e
   `targetNeighborhoods: ["Todos"]` são valores aceitos pelo cadastro e que
   **não geram combo nenhum**. A pesquisa exige localidades enumeradas.
2. **Coleta com location errada.** O `visibility_audit` roda com
   `locationLabel: "Brazil"` — país inteiro. Para SEO local isso não serve: a
   SERP de uma keyword com cidade consultada do país é outra SERP. Medido na
   sondagem, a mesma busca com `location_code` de cidade devolveu **local pack
   de 3 itens**; do país, ele não aparece. O mecanismo certo já existe no
   projeto: `gbp_rank_checks` usa `uule` com coordenada.

   > **Correção:** uma versão anterior desta linha citava o `languageMismatch`
   > como sintoma do mesmo problema. **Não é.** A sondagem da Task 4 mediu:
   > `keyword_properties` traz `detected_language: "eu"` (basco) e
   > `is_another_language: true` para `suvinil tintas`. É falso positivo do
   > detector de idioma da própria API, independente da localidade consultada,
   > e não deve ser lido como sinal de coleta mal configurada.
3. **Concorrente sem lista canônica.** Existem quatro fontes — os citados pelo
   cliente em `brand.competitors`, os do `competitors_domain`, os do local pack
   e as marcas que as IAs citam — e elas quase nunca coincidem.
4. **Extração de concorrente das IAs não agrega.** `geo_audits.metrics.competitors`
   traz só a própria marca, apesar de as `answerList` carregarem mais de dez
   concorrentes. O dado está cru no snapshot; o processamento não fecha.
5. **Backlinks sem link gap.** `backlink_audits.snapshot.competitors` sai `[]`.
   É o único item do pilar B que a auditoria tentou e não entregou.

## Contrato de entrada

O briefing é a **fonte de verdade**. O profissional o edita depois da reunião —
adiciona, corrige, remove — e é a versão editada que vale.

| Campo | Regra |
|---|---|
| `audience.keywords` | até **50**, teto imposto no cadastro. São **seeds**. |
| `audience.primaryKeyword` | 1, define a location do clustering |
| cidades | enumeradas. Quase sempre presentes — é a essência do SEO local. |
| bairros | enumerados, **opcionais**. Raros, mas o eixo existe sempre no modelo. |

O versionamento já existe: `client_briefing_exports` tem `content_fingerprint`
e `is_current`. A pesquisa grava o fingerprint que a originou. Briefing editado
depois ⇒ pesquisa marcada como defasada, sem apagar nada.

## Arquitetura

### As quatro decisões, e o porquê — que é o que se perde

**1. As 50 são seeds, não o conjunto final.** Se fossem o conjunto final, a
pesquisa viraria validação das 50 e o `domain_intersection` não entraria. É ele
que devolve o que os concorrentes rankeiam e o cliente não — exatamente as
keywords que nunca vão estar no briefing, porque o cliente não sabe que existem.
É o maior ganho de volume da fase inteira.

**2. Localidade é dimensão ortogonal, e o tema é clusterizado uma vez.**
`{tema} em {cidade A}` e `{tema} em {cidade B}` têm estrutura idêntica com
resultados diferentes; clusterizar as duas paga duas vezes pela mesma resposta.
Cluster temático é o *quê*, calculado uma vez sem cidade. Localidade é o *onde*.
A matriz tema × local é o mapa de páginas que a Fase 4 recebe.

**3. Bairro por sonda, e só se definido.** A matriz completa de bairros passa de
mil combos num cliente com poucas cidades. A sonda — 3 a 5 bairros por cidade —
prova se bairro é eixo próprio por uma fração do custo. Se a SERP do bairro
convergir com a da cidade, os bairros herdam o cluster e não se paga por eles.
O eixo existe sempre no modelo; o custo só aparece quando há dado.

**4. Veredito por keyword na saída.** A pesquisa vai encontrar keywords
cadastradas com volume zero ou com SERP impossível de ganhar — dominada por
marketplace, fabricante nacional ou grande varejo. Ela não corrige o briefing:
devolve `viável` / `sem volume` / `SERP incompatível` / `canibalizada`, com
substitutas sugeridas. O profissional edita se concordar, gerando fingerprint
novo, e a pesquisa revalida. O loop fecha sem violar "enriquece, nunca altera".

### Clustering por sobreposição de SERP

O agrupamento **não** é por semelhança de texto. Para cada candidata se coleta o
top 10 orgânico; duas keywords entram no mesmo cluster se compartilham **3 ou
mais URLs**. A relação é transitiva, então os componentes conexos do grafo são
os clusters.

O motivo: o Google já decidiu. Se duas keywords devolvem os mesmos resultados,
uma página atende as duas; se devolvem resultados diferentes, precisam de
páginas separadas — por mais parecidas que soem. O clustering por SERP responde
"quantas páginas eu preciso e quais", que é o insumo da arquitetura do site, não
um agrupamento decorativo.

Esse mesmo mecanismo resolve sozinho a dúvida de eixo: se `{tema}` vier dominado
por marketplace nacional e `{tema} + cidade` por local pack, são intenções
diferentes e páginas diferentes, sem ninguém opinar.

### Fonte dos concorrentes

> Corrigido pela sondagem (Task 1). A versão anterior desta seção mandava tirar
> o gap do `competitors_domain`, e isso **não funciona** para cliente com
> footprint pequeno — ver `docs/auditoria/evidencias/2026-09-18-fase3-pesquisa/README.md`.

A fonte primária é a **SERP das keywords-alvo**: quem ocupa o top 10 orgânico
das keywords que o cliente quer disputar. Isso é de graça, porque a SERP já é
coletada de qualquer forma.

O `competitors_domain` é **segunda fonte**, com dois filtros obrigatórios: o
próprio domínio e suas variações fora, e plataforma genérica fora (rede social,
diretório, agregador de CNPJ). Medido no cliente de sondagem, ele devolveu
`instagram.com`, `facebook.com`, `cnpj.biz` e **o próprio domínio do cliente**
entre os dez "concorrentes" — nenhuma loja do ramo. A causa é estrutural: ele
parte do perfil orgânico do alvo, e alvo que rankeia quase só para termo de
marca tem por vizinhos rede social e base de CNPJ.

Os citados pelo cliente entram como validação: se alguém que o cliente considera
concorrente não aparece em nenhuma das duas fontes, isso é achado para o
relatório — concorrente offline, ou mira errada — não entrada de pipeline.

### Location: SERP e Labs não têm a mesma granularidade

Medido na sondagem, e é restrição dura:

| API | Granularidade |
|---|---|
| `serp/google/organic` | **cidade** — `1031728` = Itu/SP foi aceito |
| `dataforseo_labs/*` | **só país** — o Labs tem 94 localidades no mundo e **uma** para o Brasil |

Pedir cidade ao Labs devolve `40501 Invalid Field: 'location_code'`.

Consequência: o clustering usa SERP e **roda na cidade principal**; a expansão e
o gap usam Labs e são **nacionais**. Keyword vinda do gap não pode ser assumida
como disputada na cidade — ela precisa passar pela SERP local antes de virar
cluster. Ignorar a diferença é o problema 2 da lista acima.

### A conta, em chamadas

Preço não vive no código: sai de `GET /v3/appendix/user_data`, que é gratuito e
devolve a tabela da própria conta. Os valores abaixo foram **medidos** na
sondagem e valem como ordem de grandeza, não como tabela.

| Bloco | Chamadas | Custo medido |
|---|---|---|
| `keywords_for_keywords` — teto de **20 seeds por chamada**, medido | 3 para 50 seeds | **US$ 0,09 cada** |
| `keyword_ideas` — 72% de candidatas inéditas, medido | 1–3 | US$ 0,036 cada |
| `competitors_domain` | 1 | US$ 0,0132 |
| `domain_intersection`, por concorrente (par a par) | N (3–5) | US$ 0,0132 cada |
| Search intent das candidatas | ~10 lotes de 20 | US$ 0,0144 cada |
| **SERP das candidatas (teto 200)** | **até 200** | **US$ 0,004 cada** |
| Prova do eixo cidade (1–2 clusters × cidades) | ~5–10 | US$ 0,004 cada |
| Sonda de bairro, quando houver | 3–5 por cidade | US$ 0,004 cada |

Total ≈ **US$ 1,40** por pesquisa completa.

> **Correção da versão anterior:** aqui estava escrito que "todo o resto é lote e
> some no arredondamento". É falso — `keywords_for_keywords` custa **22× uma
> SERP**, e a expansão é cerca de um terço do custo da fase.

Duas regras que seguem do medido:

- **Não há chamada separada de volume.** `keywords_for_keywords` devolveu 4.831
  candidatas a partir de 3 seeds **já com** `search_volume` e `monthly_searches`.
  Pedir `search_volume` depois é pagar US$ 0,09 pelo dado que já está na mão.
- O teto de candidatas que vão para SERP continua sendo o número que mais
  governa o custo — filtro por volume mínimo e relevância acontece **antes** da
  SERP, nunca depois.

A matriz completa cluster × cidade (o "quais combos são mais disputados vs. mais
fáceis" do pilar H2) fica em **onda separada**: é proporcional a clusters ×
cidades e só faz sentido depois que a Fase 4 escolheu quais clusters viram
página. Rodar antes é comprar priorização de combo que ninguém vai atacar.

### O que vem de graça

Sazonalidade (pilar A) sai do volume histórico de 12 meses que já vem no mesmo
payload do keyword data. Não custa chamada extra — é só ler o que já veio.

## Onde a pesquisa lê e grava

A ponte cliente → auditoria **já existe** e não precisa de spec nova:

- `clients.lead_id` liga o cliente ao lead de origem.
- `clients.baseline_at` âncora a conversão, e
  `resolveAuditBaseline()` (`lib/leads/audit-baseline.ts`) devolve os cinco
  snapshots — website, visibility, geo, backlinks e perfil GBP — resolvidos por
  consulta, sem cópia de dados. `app/actions/clients/get-client.ts:118` já faz
  exatamente isso.
- O briefing é do cliente e já é acessível por `client_briefing_steps` e
  `client_briefing_exports`.

A escrita vai em tabelas **novas** `client_research_*`, com `client_id`,
seguindo o padrão da casa: snapshot append-only para a coleta, tabela de review
separada para o julgamento do analista. Nada existente é alterado, então não há
conflito com leitores atuais.

A separação de lifecycle registrada como "vira spec própria" em
`2026-09-09-report0-cobertura-design.md` trata de **re-auditar o cliente ao
longo do projeto** — ciclo recorrente, congelamento do Report 0, julgamento por
ciclo. É assunto vizinho e **não bloqueia a Fase 3**.

## Decisões pendentes

1. **Se "deep-research" exige integração nova.** O handoff afirma que o projeto
   não tem integração de LLM, mas `lib/dataforseo/ai-optimization.ts` já executa
   quatro provedores com `costUsd` por chamada. Confirmar se esse caminho cobre
   os pilares E, F e H1 muda bastante o custo.
3. **Reexecução por delta.** As tabelas são append-only (regra da casa, não
   negociável). Refazer a pesquisa inteira a cada edição de briefing é caro, mas
   otimizar por delta é provavelmente prematuro para MVP.

## Não-escopo

- **Decidir a âncora.** A pesquisa testa as candidatas e recomenda; escolher é
  Fase 4. Quando o briefing pedir um eixo e o ativo orgânico estiver em outro, a
  pesquisa **reporta os dois com número** e não arbitra.
- **Alterar o briefing.** Nem para corrigir keyword sem volume. Devolve veredito.
- **Matriz completa de combos por bairro.** Sonda, não varredura.
- **Priorização de combo cidade × cluster.** Onda separada, pós-Fase 4.
