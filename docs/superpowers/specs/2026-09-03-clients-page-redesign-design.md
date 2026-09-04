# Clients Page — Design

## Objetivo

Transformar a página de Clientes em uma área operacional ampla, pesquisável e escalável, combinando o comportamento server-side da página de Leads com a densidade e a apresentação em lista da página de Usuários.

O resultado deve substituir a atual coluna estreita de cards por uma lista única de largura útil, com identidade visual forte, filtros, métricas, skeletons, estados vazios e movimento consistente com a aplicação.

## Referências adotadas

- `components/custom/LeadBoard/LeadBoardToolbar.tsx`: debounce, `router.replace`, filtros em URL, loading durante transições e limpeza de filtros.
- `app/(protected)/leads/page.tsx`: sanitização de busca, validação de parâmetros e consulta server-side.
- `components/custom/TeamRoleManager/TeamRoleManager.tsx`: `max-w-6xl`, cabeçalho editorial, superfície de lista, linhas responsivas e stagger.
- Print fornecido: evidencia o problema atual de baixa ocupação horizontal, ausência de descoberta e hierarquia operacional insuficiente.

## Decisões

- A exibição principal será uma lista única de linhas largas, não uma grade de cards.
- Busca e filtros serão refletidos na URL e aplicados no servidor, como em Leads.
- A busca aceitará nome da empresa e domínio do site relacionado ao lead convertido.
- Filtros de briefing, kickoff e closer serão controlados por parâmetros validados.
- O dialog `ClientBriefingReviewDialog` continuará sendo aberto por `?client=<uuid>` e permanecerá compatível com a lista filtrada.
- Não haverá alteração nas actions do dialog, nas permissões do portal ou nas regras de status existentes.

## Parâmetros de lista

```ts
export type ClientsListParams = {
  q: string
  briefing: "in_progress" | "finalized" | "edited_after_submit" | null
  kickoff: "none" | "scheduled" | "no_show" | "completed" | null
  closer: string | null
}
```

`clientsListHref` deve preservar também o parâmetro `client` para deep-link do dialog. Valores inválidos são descartados antes de montar a URL.

## Dados server-side

`ClientsPage` deve:

1. chamar `requireCommercialMember()`;
2. ler `searchParams` com `firstSearchParam`;
3. sanitizar `q` removendo caracteres de filtro PostgREST (`%`, `*`, `,`, `(`, `)`, `\\`) e espaços redundantes;
4. validar `briefing`, `kickoff`, `closer` e `client`;
5. carregar clientes filtrados, opções de closer e contagens de resumo em paralelo quando possível;
6. renderizar `ClientsList` com resultados, parâmetros ativos e catálogos.

`listClients(params)` deve manter o retorno de `ClientListItem` e acrescentar dados suficientes para a linha: domínio relacionado do lead, status derivado do briefing, status do kickoff, closer e data de conversão.

### Busca

- Busca direta em `clients.company_name`.
- Para domínio, consultar IDs em `leads` por `company_name` ou `website_domain` e usar esses IDs em `clients.lead_id`.
- Quando nenhum lead corresponde ao domínio e o nome também não corresponde, retornar lista vazia sem erro.

### Filtros

- `closer`: `.eq("closer_id", closer)`.
- `kickoff`: `.eq("kickoff_stage", kickoff)`.
- `briefing`: derivar com `deriveBriefingListStatus`; como o status de “editado após envio” depende da comparação entre duas colunas, aplicar a derivação no loader server-side após a query base e filtrar o resultado antes de retornar ao cliente.
- Ordenação padrão: `converted_at` descendente.

## Layout

### Cabeçalho

Seguir `TeamRoleManager`:

- container `mx-auto max-w-6xl`;
- eyebrow `CRM`;
- título `Clientes` com contagem à direita;
- descrição curta: contas convertidas após assinatura e pagamento;
- entrada com fade-up discreto.

### Resumo

Quatro indicadores compactos, calculados sobre o conjunto atualmente retornado:

- Total encontrados;
- Briefing em andamento;
- Briefing enviado;
- Kickoff pendente/agendado.

Os indicadores devem ser informativos e compactos, sem criar um painel de dashboard separado.

### Toolbar

`ClientsListToolbar` será um componente client-side:

- busca com `Input`, `RiSearchLine`, estado `loading` durante `useTransition`;
- debounce de 300 ms;
- `Select` de briefing;
- `Select` de kickoff;
- `Select` de closer;
- chips/resumo textual dos filtros ativos;
- botão `Limpar filtros` apenas quando houver filtro de catálogo;
- todos os updates usam `router.replace(clientsListHref(...), { scroll: false })`.

O campo de busca deve permanecer controlado localmente e sincronizar com `params.q` quando a URL mudar, como no Leads Board.

### Lista

`ClientListRow` seguirá a superfície de `TeamRoleManager`:

- lista única `divide-y divide-border-subtle overflow-hidden rounded-xl border border-border bg-surface shadow-card`;
- identidade com iniciais, nome e domínio;
- briefing e kickoff como badges textuais com ícones semânticos;
- closer e conversão em metadata;
- próxima reunião com marcador temporal;
- menu de portal à direita;
- hover, focus e active consistentes com Leads;
- linha inteira clicável apenas quando `canManagePortal`.

Em telas estreitas, a linha passa para duas áreas empilhadas sem esconder status, domínio ou ação principal.

## Estados e movimento

- `ClientsListSkeleton` deve reproduzir header, resumo, toolbar e cinco linhas finais.
- Empty state distingue lista sem clientes de busca/filtros sem resultado.
- Erro deve aparecer em bloco explícito e não deixar o canvas vazio.
- Linhas entram com `opacity + translateY(8px)`, stagger máximo de 400 ms, seguindo Usuários.
- Troca de resultado após busca/filtro usa fade curto; não animar larguras ou alturas.
- `prefers-reduced-motion` reduz entrada e atualização a opacidade entre 100–150 ms.

## Acessibilidade

- Campo de busca e cada filtro têm labels/aria-labels claros.
- Estados de briefing/kickoff usam texto e ícone além de cor.
- Linha clicável usa link semântico; menu de portal permanece botão separado.
- Foco visível em busca, selects, limpar filtros, linha e menu.
- Nenhum controle essencial depende de hover.
- A lista não cria rolagem horizontal.

## Componentes e arquivos

- `app/(protected)/clients/page.tsx` — parse e validação dos parâmetros, carregamento de opções e renderização.
- `app/(protected)/clients/loading.tsx` — skeleton alinhado ao layout final.
- `app/actions/clients/list-clients.ts` — query filtrada, busca por lead relacionado, derivação de status e contagens.
- `lib/clients/href.ts` — tipo de parâmetros e serialização da URL.
- `components/custom/ClientsList/ClientsList.tsx` — estado do deep-link, composição da página e sincronização do dialog.
- `components/custom/ClientsList/ClientsListToolbar.tsx` — busca debounce e filtros.
- `components/custom/ClientsList/ClientsSummary.tsx` — indicadores resumidos.
- `components/custom/ClientsList/ClientListRow.tsx` — linha operacional do cliente.
- `components/custom/ClientsList/ClientsListSkeleton.tsx` — skeleton reutilizável entre loading e transições.
- `components/custom/ClientsList/ClientsList.types.ts` — contratos de props.

## Fora de escopo

- Alterar o schema ou criar migrations.
- Criar novas regras de permissão.
- Alterar conteúdo ou comportamento interno do dialog de briefing.
- Paginação, realtime ou edição inline de clientes.
- Grade de cards ou visão kanban.

## Critérios de aceitação

- URL reproduz busca, filtros e cliente aberto.
- Digitação dispara apenas uma atualização após 300 ms sem atividade.
- Filtros alteram dados vindos do servidor e não apenas o array em memória.
- Lista ocupa a largura útil e mantém densidade semelhante à página de Usuários.
- Busca por nome e domínio funciona.
- Status e próxima reunião permanecem legíveis em desktop e telas estreitas.
- Loading, vazio, erro, foco e movimento reduzido têm tratamento explícito.
