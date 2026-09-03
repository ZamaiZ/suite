# Staff Briefing Review — Design

## Objetivo

Permitir que o time interno (quem gerencia o portal do cliente) acompanhe o preenchimento do briefing em somente leitura, a partir da lista de clientes, sem reutilizar o wizard do portal.

## Decisões

- Produto = cockpit de progresso (overview), não espelho do wizard.
- Dialog `Dialog` `size="xl"`; URL `?client=<uuid>` (padrão LeadBoard `pushState`/`popstate`). Sem `?step=` no v1.
- Overview com 8 tiles; clique → detalhe lazy do step (viewers read-only novos).
- Snapshot ao abrir / ao entrar no step; cache em memória enquanto o dialog estiver aberto; sem realtime / sem botão Atualizar.
- Segredos: load devolve só `secretFlags`; plaintext via `revealStaffBriefingSecret` (auditoria persistida depois).
- Somente `canManageClientPortal`: card clicável + menu `⋯`; demais veem card estático.
- Menu `⋯`: Gerar acesso / Copiar link / Rotacionar código (confirmação em dois passos). Remove `ClientDetailDialog` da lista.
- Auth staff: `loadStaffClient` + `denyUnlessCanManage`.
- Não reutilizar `ClientBriefingWorkspace` nem `ClientBriefing*Form`.

## Step state

| Estado | Regra |
|--------|--------|
| `empty` | Sem row em `client_briefing_steps` |
| `in_progress` | Row sem `completed_at` |
| `completed` | Row com `completed_at` |

Status da lista permanece `deriveBriefingListStatus(finalizedAt, contentUpdatedAt)`.

## Actions staff

- `loadStaffBriefingOverview(clientId)`
- `loadStaffBriefingStep(clientId, stepId)` (+ `secretFlags` em accesses)
- `revealStaffBriefingSecret(clientId, kind)`
- `signStaffBriefingWebsiteAsset(clientId, path)`

## UX

- Overview: header (empresa, badge, `N/8`), grid de tiles, skeleton no load.
- Detalhe: voltar, meta do step, seções label/valor, assets com signed URL, secret field máscara → revelar.
- Deep-link sem permissão / inexistente: limpa `?client=`, dialog não fica aberto.

## Fora de escopo

Realtime, refresh, `?step=`, edição interna, tabela de auditoria de reveal, manter ficha `ClientDetailDialog`.
