# Citações em Diretórios por SERP — Design

## Objetivo

Responder, por diretório, se existe página publicada sobre o negócio — com o
link para o analista abrir e confirmar.

A resposta da máquina nunca fecha o estado. Ela reduz o trabalho manual de vinte
conferências para duas ou três, e o julgamento de NAP continua humano.

## O que motivou

A checagem de citações por backlinks devolveu `citations: []` num perfil que
comprovadamente tem fichas publicadas. A investigação achou três coisas, e só
duas são defeito:

1. **O filtro é inválido.** `domain_from` não aceita o operador `in` — só `=`,
   `<>`, `like`, `not_like`, `ilike`, `not_ilike`, `match`, `not_match`.
2. **O vazio é ambíguo.** `postDataForSeo` devolve `data: null` quando a resposta
   vem sem resultado, o mapeador transforma isso em `[]` e a action grava `[]`.
   "A chamada não trouxe resultado" virou "checado, e nenhum diretório linka" — a
   regra "ausente não é zero" violada no próprio código que a invocava.
3. **Facebook e Instagram nunca estiveram no catálogo.** Foram excluídos de
   propósito, porque o passo de Presença digital já os cobre. Para eles, `[]`
   estava correto.

O achado maior, porém, é estratégico: **backlinks responde a pergunta errada.**
Ele diz *quem linka para o site*; citação é *quem publica uma página sobre o
negócio*. As duas coisas só se sobrepõem em parte — Facebook, Instagram, Bing e
Waze publicam a ficha e não geram link rastreável, e a citação local clássica é
NAP num diretório sem link nenhum.

A consulta `"<nome>" site:<domínio>` responde a pergunta certa.

## Decisões aprovadas

- **SERP na fila é o método primário.** Uma consulta por diretório, US$ 0,0006
  cada, ordem de US$ 0,012 por lead.
- **A busca é pelo nome da empresa**, entre aspas.
- **Backlinks vira corroborador**, na chamada que já existe: onde houver link, é
  prova adicional e traz a URL do cadastro; onde não houver, **cala**.
- **O SERP marca "encontrado", nunca "cadastrado".** `site:` acha a página, não a
  ficha — um artigo que cite o nome é resultado legítimo, e para nome comum o
  falso positivo é provável. Quem fecha o estado é o analista.

## Fora de escopo

- **Telefone como chave de busca**, que provaria presença e NAP de uma vez. Fica
  para depois: muitos diretórios renderizam o telefone por JS ou o ofuscam, e o
  falso negativo seria frequente.
- **Regras de caminho por diretório** para separar ficha de artigo — seriam vinte
  padrões para envelhecer, e a confirmação humana já resolve.
- **Apple Maps, Bing Places e assistentes de voz.** Não publicam página
  indexável; nenhum método de busca ou de backlink os alcança. Seguem manuais.
- **Facebook e Instagram no checklist de diretórios.** O passo de Presença
  digital é o dono deles. Entram aqui só como fonte de citação.

## Arquitetura

### Cada consulta é paga

Vinte tarefas por scan. O padrão é o que a malha geográfica estabeleceu depois de
o incidente das 121 tarefas custar treze vezes o trabalho: envio em lote com
`tag` de correlação, identificadores gravados **antes** de qualquer outra coisa,
readoção de tarefa órfã por `tasks_ready`, teto de tentativas e lease de poll.

Nada aqui é invenção nova. É `lib/leads/gbp-grid.ts` aplicado a outro domínio.

### Modelo

`lead_gbp_citation_scans`, no formato de `lead_gbp_grid_scans`: append-only por
`captured_at`, configuração e progresso na linha, itens em jsonb.

Cada item guarda `directoryId`, `status`, `found`, `url`, `title`, `taskId`,
`attempts` e `error`.

Os quatro estados — `pending`, `queued`, `done`, `failed` — existem pelo mesmo
motivo que existem na malha: confundir falha com ausência já transformou uma
coleta inteiramente falha em diagnóstico de que o cliente não aparecia em lugar
nenhum.

E `found` é `boolean | null`, com `null` significando **não coletado** e `false`
significando **coletado e não achou**. São afirmações diferentes, e só a segunda
é um achado.

### Catálogo com dois canais

Cada diretório declara como pode ser verificado:

- `serpDomain: string | null` — busca `site:`; `null` quando não há página
  indexável.
- `linkDomains: string[]` — corroboração por backlink; vazio quando a plataforma
  não gera link rastreável.

"Manual" deixa de ser um rótulo que alguém escolheu e passa a ser **o que sobra**
quando os dois estão ausentes. Apple e Bing Places caem nisso por serem o que
são, não por decisão de produto.

### Correlação

O `tag` de cada tarefa é o id do diretório, lido de `tasks[i].data.tag` — **não**
do nível da tarefa, que é exatamente onde a leitura errada custou 121 buscas
pagas. A posição na resposta é a correlação de reserva.

### Interface

O card de diretórios ganha, por linha: o achado do SERP com link para a página, o
selo de corroboração quando o backlink também apontar, e o `Select` do analista.

O cabeçalho diz o que cada sinal significa — encontrado não é cadastrado, e
ausência de link não é ausência de cadastro. Item `pending` ou `failed` aparece
como **não verificado**, nunca como não encontrado.

## Arquivos previstos

- `supabase/migrations/20260926000000_lead_gbp_citation_scans.sql`
- `lib/leads/gbp-citations.ts` — tipos, estados, leitura tolerante, transições
- `lib/dataforseo/google-citations.ts` — `task_post` em lote, `task_get`, ready
- `lib/validations/lead-gbp-citations.ts`
- `app/actions/leads/start-gbp-citation-scan.ts`
- `app/actions/leads/poll-gbp-citation-scan.ts`

Alterados: `lib/leads/gbp-analyst-review.ts`, `app/actions/leads/gbp-access.ts`,
`lib/leads/gbp.ts`, `lib/dataforseo/usage.ts`, os componentes do painel de GBP, e
os dois defeitos em `lib/dataforseo/backlinks.ts` e `lib/leads/backlinks-map.ts`.

## Critérios de aceitação

- Nenhum diretório é marcado ausente pela máquina.
- `found: null` nunca aparece como "não encontrado" na tela.
- Uma tarefa paga nunca é recomprada: reabrir a tela retoma nos pendentes.
- Falha num item deixa aquele item em `failed`, e os demais concluem.
- Resposta do analista já gravada sobrevive a qualquer recoleta.
- O custo mostrado na tela de Ferramentas bate com o número de diretórios
  consultados, derivado do catálogo e não digitado.
