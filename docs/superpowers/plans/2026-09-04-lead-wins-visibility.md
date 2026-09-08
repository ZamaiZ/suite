# Lead Wins Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar wins convertidos no kanban de Leads com escopo por papel e atalho seguro ao cliente.

**Architecture:** Uma política de leitura de lead define a carteira que a página, o detalhe e o deep-link podem expor. O board inclui `converted` como coluna de leitura e recebe a relação de cliente; o módulo de clientes separa leitura de gestão para que Analista consulte sem herdar controles administrativos.

**Tech Stack:** Next.js 16.3.1 App Router, React 19.2.8, TypeScript, Supabase e Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-09-04-lead-wins-visibility-design.md`

## Global Constraints

- Não executar comandos de Git, testes, build, lint ou typecheck; regras do repositório proíbem todos eles.
- Não alterar migrations nem políticas RLS nesta entrega; a mudança precisa permanecer consistente em todas as tabelas filhas antes de endurecer acesso de banco.
- Preservar a conversão atual, permissões de portal, de briefing e de kickoff.
- `Clientes` é somente leitura e nunca pode ser um alvo/origem de drag-and-drop.
- Filtros operacionais removem wins; filtros de descoberta mantêm wins dentro do escopo autorizado.

---

## File Structure

- Criar `lib/leads/access.ts` — política de leitura, visão de equipe e filtro PostgREST de carteira.
- Modificar `app/(protected)/leads/page.tsx` — aplicar escopo, incluir clientes e excluir wins apenas dos filtros operacionais.
- Modificar `app/actions/leads/get-lead.ts` — negar detalhe sem capacidade de leitura e expor o cliente relacionado.
- Modificar `app/actions/leads/update-lead.ts` — recusar alteração de um win consolidado.
- Modificar `lib/leads/board-item.ts`, `lib/leads/board.ts`, `lib/leads/daily-activity.ts` — contrato, coluna, ordenação e filtros locais.
- Modificar `components/custom/LeadBoard/*` — renderizar coluna, impedir drag, manter o card convertido e oferecer atalho.
- Modificar `lib/clients/access.ts`, `lib/clients/staff.ts`, actions e componentes de clientes — separar consulta de gestão e apresentar briefing em leitura.
- Modificar `app/actions/clients/convert-lead.ts` — devolver os campos do cliente no patch otimista.

### Task 1: Centralizar capacidades de leitura

**Files:**

- Create: `lib/leads/access.ts`
- Modify: `lib/clients/access.ts`
- Modify: `lib/clients/staff.ts`

**Interfaces:**

```ts
export function canViewTeamLeads(roles: readonly AppRole[]): boolean
export function canViewLead(
  lead: LeadReadSubject,
  userId: string,
  roles: readonly AppRole[],
): boolean
export function leadPortfolioScope(userId: string): string
export function canViewClient(
  roles: readonly AppRole[],
  userId: string,
  closerId: string | null,
): boolean
```

- [x] Definir os quatro papéis com visão de equipe e a regra individual de SDR/Closer.
- [x] Aplicar ausência de escopo para equipe e uma expressão PostgREST para carteira individual na página.
- [x] Separar visualização de cliente da gestão de portal; manter `canManageClientPortal` inalterada.
- [x] Criar `denyUnlessCanView` para actions de leitura de cliente.
- [x] Revisar as assinaturas e imports afetados manualmente.

### Task 2: Expor wins no loader e no board

**Files:**

- Modify: `app/(protected)/leads/page.tsx`
- Modify: `lib/leads/board-item.ts`
- Modify: `lib/leads/board.ts`
- Modify: `lib/leads/daily-activity.ts`
- Modify: `components/custom/LeadBoard/LeadBoard.tsx`
- Modify: `components/custom/LeadBoard/LeadBoardColumn.tsx`
- Modify: `components/custom/LeadBoard/LeadBoardCard.tsx`
- Modify: `components/custom/LeadBoard/LeadBoardCardFace.tsx`

- [x] Aplicar a política ao parâmetro `team` e à consulta sem busca e com busca.
- [x] Incluir `clients(id, converted_at)` na leitura do board e normalizar o embed.
- [x] Acrescentar `client_id`, `converted_at` e `can_view_client` ao item de board.
- [x] Adicionar `converted` como coluna final e ordenar pela data de conversão.
- [x] Desabilitar drag e ações comerciais em `Clientes`; manter o card após conversão.
- [x] Renderizar o atalho ao cliente quando `can_view_client` for verdadeiro.
- [x] Fazer `pending` e `today` excluírem wins sem afetar os filtros de descoberta.

### Task 3: Proteger detalhe e conversão otimista

**Files:**

- Modify: `app/actions/leads/get-lead.ts`
- Modify: `app/actions/leads/update-lead.ts`
- Modify: `app/actions/clients/convert-lead.ts`
- Modify: `components/custom/LeadDetailDialog/LeadDetailDialog.tsx`
- Modify: `components/custom/LeadDetailDialog/LeadDetailHeader.tsx`

- [x] Reaplicar `canViewLead` no detalhe e responder como não encontrado quando for negado.
- [x] Recusar atualização de cadastro para win, inclusive por chamada direta à action.
- [x] Incluir o cliente relacionado e a capacidade de abertura no contrato do detalhe.
- [x] Exibir atalho no cabeçalho de um lead convertido autorizado.
- [x] Retornar `client_id`, `converted_at` e `can_view_client` após conversão para mover o card sem recarregar.

### Task 4: Abrir cliente em leitura quando necessário

**Files:**

- Modify: `app/actions/clients/get-client.ts`
- Modify: `app/actions/clients/list-clients.ts`
- Modify: `app/actions/clients/load-client-kickoff.ts`
- Modify: `app/actions/briefing/load-staff-briefing-overview.ts`
- Modify: `app/actions/briefing/load-staff-briefing-step.ts`
- Modify: `components/custom/ClientsList/ClientsList.tsx`
- Modify: `components/custom/ClientsList/ClientListRow.tsx`
- Modify: `components/custom/ClientBriefingReviewDialog/ClientBriefingReviewDialog.tsx`
- Modify: `components/custom/ClientBriefingReviewDialog/ClientBriefingReviewDialog.types.ts`

- [x] Filtrar a lista de clientes pela capacidade de visualização.
- [x] Trocar os loaders de leitura para `denyUnlessCanView`; preservar os writers em `denyUnlessCanManage`.
- [x] Adicionar `canViewClient` ao item de lista e abrir o diálogo para leitores autorizados.
- [x] Passar `readOnly` ao diálogo quando a gestão de portal não for permitida.
- [x] Ocultar edição e exportação no modo leitura; o painel de kickoff apenas exibe dados quando `canLog` for falso.

### Task 5: Revisão estrutural sem execução automatizada

**Files:**

- Review: todos os arquivos alterados nesta entrega

- [x] Conferir que contratos de `LeadBoardItem`, `LeadDetail`, `ClientListItem` e `ConvertLeadState` carregam os mesmos nomes de campos.
- [x] Conferir que o atalho a `/clients?client=<uuid>` só é renderizado para `can_view_client`.
- [x] Conferir as matrizes Admin/Gestor/Analista/CS, SDR e Closer nos ramos de lista e deep-link.
- [x] Conferir que nenhuma action de escrita passou a usar `denyUnlessCanView`.
- [x] Registrar que não foram executados testes, build, lint, typecheck ou Git por instrução do repositório.
