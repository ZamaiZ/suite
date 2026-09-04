# Client Briefing Review Dialog — Presentation Design

## Objetivo

Elevar o dialog interno aberto pela lista de clientes ao mesmo nível de orientação, hierarquia visual e acabamento do detalhe de leads, preservando seus fluxos atuais de briefing e kickoff.

O resultado é um workspace único para o cliente, com duas áreas de primeiro nível: **Briefing** e **Contato e kickoff**.

## Decisões aprovadas

- As duas áreas permanecem no mesmo dialog.
- Navegação desktop usa rail lateral persistente, sempre expandida, com 224 px.
- As oito etapas aparecem na rail apenas quando **Briefing** está ativo.
- Em telas menores que desktop, a rail migra para uma navegação horizontal organizada; não é substituída por ícones sem rótulo.
- A mudança é de composição e apresentação. Dados, permissões, cache, autosave e server actions existentes não mudam.

## Arquitetura de interface

### Shell do dialog

`ClientBriefingReviewDialog` continua sendo o orquestrador de carregamento, cache, edição e fechamento. Seu conteúdo passa a ser composto por:

1. `ClientBriefingDialogHeader`: identifica empresa, estado global, progresso e ação de fechar.
2. `ClientBriefingNavigationRail`: exibe identidade resumida, áreas de primeiro nível e, em Briefing, as etapas.
3. `ClientBriefingContentHeader`: breadcrumb, título da área ou etapa, metadados e ações contextuais.
4. `ClientBriefingContent`: área rolável que apresenta overview, detalhe de etapa ou kickoff.

O header e a rail são estruturas persistentes. Apenas o conteúdo principal é trocado entre estados.

### Navegação

Na rail:

- O bloco superior mostra iniciais, nome da empresa e `N/8` etapas concluídas.
- **Briefing** e **Contato e kickoff** formam o grupo de áreas.
- Quando Briefing está ativo, o segundo grupo apresenta as oito etapas com ícone, nome e estado textual (`Não iniciado`, `Em andamento`, `Concluído`).
- A etapa ativa recebe superfície selecionada, ícone com tom semântico e `aria-current="page"`.
- A seleção de uma etapa abre seu detalhe diretamente e preserva o estado selecionado na rail.

O botão de retorno no detalhe leva ao overview de Briefing; não é usado para recuperar o contexto de navegação. A troca de área não exige retorno ao overview.

### Conteúdo

#### Briefing overview

- Cabeçalho contextual com título, estado e progresso.
- Exportação continua no overview.
- Grid de etapas preserva clique direto e passa a mostrar ícone, estado, última atualização e indicador de entrada.

#### Detalhe de etapa

- Breadcrumb `Briefing / <etapa>` e ação de retorno ao overview.
- Coluna central com largura máxima de leitura.
- Rótulos discretos; valores, chips, listas e ativos em blocos próprios.
- Ação `Editar` fica no header de conteúdo e só aparece quando a permissão e o estado atual permitem edição.
- Estados vazios, carregamento e erro ficam locais à etapa atual.

#### Contato e kickoff

- Cabeçalho `Contato e kickoff` com estado do kickoff.
- Card de próxima reunião com responsável e ações elegíveis.
- Linha do tempo de contatos abaixo.
- O formulário de registro só é revelado após o usuário selecionar uma ação.

## Estados, dados e erros

- As ações `loadStaffBriefingOverview`, `loadStaffBriefingStep`, edição existente, `ClientBriefingExport` e `ClientKickoffPanel` são preservadas.
- Cache em memória por etapa continua válido durante a abertura do dialog.
- Skeletons preservam as dimensões do estado final: rail, cabeçalho e conteúdo não saltam.
- Erros de overview, etapa e kickoff aparecem no painel afetado, com nova tentativa quando já existe essa capacidade.
- O fechamento continua bloqueado enquanto há finalização de edição pendente.

## Movimento

- Troca de área: opacidade e deslocamento horizontal de 12–16 px.
- Troca de etapa: deslocamento direcional de 20–24 px conforme o sentido de navegação.
- Rail e header não se movem; funcionam como âncoras espaciais.
- Duração normal entre 180–280 ms, com curva já adotada no produto.
- Com `prefers-reduced-motion`, apenas fade curto (100–120 ms).

## Acessibilidade e responsividade

- Todos os controles têm rótulos, foco visível e área de interação confortável.
- Cor nunca é a única representação de status; texto e ícone acompanham cada estado.
- Rail usa semântica de navegação, áreas e etapas possuem nomes acessíveis e a etapa atual usa `aria-current`.
- A área principal mantém rolagem independente, sem criar rolagem horizontal.
- Em viewport estreito, a navegação vira faixa horizontal com texto integral e o conteúdo ocupa a largura disponível.

## Arquivos previstos

- `components/custom/ClientBriefingReviewDialog/ClientBriefingReviewDialog.tsx` — substitui a composição atual pelo shell persistente.
- `components/custom/ClientBriefingReviewDialog/ClientBriefingDialogHeader.tsx` — novo header de identidade e estado.
- `components/custom/ClientBriefingReviewDialog/ClientBriefingNavigationRail.tsx` — nova navegação de áreas e etapas.
- `components/custom/ClientBriefingReviewDialog/ClientBriefingContentHeader.tsx` — breadcrumb e ações de contexto.
- `components/custom/BriefingReviewOverview/BriefingReviewOverview.tsx` — refinamento visual dos cards, mantendo sua API pública.
- `components/custom/ClientKickoffPanel/ClientKickoffPanel.tsx` — somente reorganização visual para ocupar a nova área.

## Fora de escopo

- Novas server actions, migrations ou alterações de permissão.
- Regras de briefing, status ou kickoff.
- Realtime, refresh manual e mudanças de URL para cada etapa.
- Alterar conteúdo dos formulários ou sua validação.
- Reestilização global de `Dialog` ou dos dialogs de leads.

## Verificação planejada

- Inspeção manual dos estados overview, detalhe, edição, kickoff, loading, erro e vazio.
- Navegação por teclado entre áreas, etapas, ações e fechamento.
- Conferência visual nos breakpoints desktop e estreito, incluindo preferência de movimento reduzido.
