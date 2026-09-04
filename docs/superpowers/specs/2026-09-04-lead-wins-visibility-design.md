# Wins no Kanban de Leads — Design

## Objetivo

Exibir leads convertidos como wins na página de Leads, mantendo a origem comercial acessível e fornecendo um atalho ao cliente quando o papel puder consultá-lo. O fluxo ativo permanece operacional; wins são registros finais, somente leitura no kanban.

## Decisões aprovadas

- Admin, Gestor Comercial, Analista e Customer Success veem todos os wins e podem abrir o cliente.
- SDR vê os wins cuja atribuição de SDR é própria; não recebe atalho ao cliente.
- Closer vê os wins cuja atribuição de closer é própria e pode abrir o cliente.
- Analista abre o cliente em modo leitura. Customer Success, Admin, Gestor Comercial e o próprio Closer preservam as permissões atuais de gestão.
- A coluna final se chama `Clientes`, representa `leads.status = converted`, não aceita drag-and-drop e não oferece ações de venda.
- Busca, segmento, cidade, estado e tag também encontram wins autorizados.
- `Ligar hoje` e `Atividade pendente` são filtros operacionais: quando ativos, não exibem wins.

## Fora de escopo

- Alterar a conversão, contrato, pagamento ou criação do cliente.
- Alterar permissões de escrita, de portal ou de kickoff.
- Criar um novo cliente ou uma nova rota.
- Reestruturar as políticas RLS de todas as tabelas ligadas a lead/cliente. A revisão observou que as políticas atuais são amplas para membros comerciais; a presente entrega aplica escopo consistente nas actions e páginas usadas pela aplicação, mas não constitui uma revisão completa de segurança de acesso direto ao banco.

## Arquitetura

### Escopo de leads

`lib/leads/access.ts` concentra a política de leitura. Em `Minha carteira`, todos os papéis veem leads novos livres, leads atribuídos como SDR a si e leads atribuídos como Closer a si. Papéis com visão de equipe (`admin`, `commercial_manager`, `analyst`, `customer_success`) ampliam para toda a carteira somente pelo parâmetro `team=1`.

A página de Leads usa o filtro PostgREST derivado dessa política. `getLeadDetail` reaplica a mesma regra após carregar o registro, assim um UUID direto não contorna o escopo da tela.

`updateLead` também reaplica a política e recusa registros convertidos. Assim, a condição de somente leitura do win não depende apenas dos controles visuais do kanban.

### Coluna de clientes

O item do board passa a carregar `client_id`, `converted_at` e `can_view_client` da relação um-para-um `clients.lead_id`. O status `converted` entra em `BOARD_COLUMNS` como a última coluna, ordenado por `converted_at` decrescente. A ação de conversão devolve esses campos no patch otimista; o card não desaparece ao converter.

### Acesso ao cliente

`canViewClient` é separado de `canManageClientPortal` em `lib/clients/access.ts`. Somente quem tem papel `closer` pode herdar a visualização do cliente próprio; um SDR não a recebe por atribuição acidental. A lista e o detalhe de clientes usam a capacidade de visualização; o portal continua sendo gerido apenas pelos papéis atuais. O diálogo de briefing recebe `readOnly`; no modo leitura não exibe exportação, edição ou escrita de kickoff, mas preserva a consulta das informações do cliente.

## Arquivos previstos

- Criar `lib/leads/access.ts`.
- Modificar `app/(protected)/leads/page.tsx`, `app/actions/leads/get-lead.ts`, `app/actions/leads/update-lead.ts`, `lib/leads/board-item.ts`, `lib/leads/board.ts`, `lib/leads/daily-activity.ts` e componentes `LeadBoard`.
- Modificar `app/actions/clients/convert-lead.ts`, `lib/clients/access.ts`, `lib/clients/staff.ts`, `app/actions/clients/get-client.ts`, `app/actions/clients/list-clients.ts` e o fluxo de `ClientsList`/`ClientBriefingReviewDialog`.

## Critérios de aceitação

- Um win aparece em `Clientes` apenas para o papel autorizado.
- O SDR e o Closer não recebem visão de equipe pelo parâmetro `team=1`.
- O win continua pesquisável pelos filtros de catálogo, mas não aparece em filtros operacionais.
- Um Analista abre o cliente em leitura e não vê comandos de edição, exportação ou portal.
- Após converter, o card permanece no board, entra em `Clientes` e, quando autorizado, oferece atalho ao cliente.
- Um deep-link para lead ou cliente respeita a mesma capacidade de leitura da lista.
