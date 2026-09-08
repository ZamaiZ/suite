# Briefing Considerações finais — Design

## Objetivo

Último step `closing` após `accesses` para capturar informações extras opcionais, finalizar o briefing, exibir tela de obrigado e permitir edição pós-envio com badge de status na lista de clientes.

## Decisões

- Step id `closing`; label do stepper `Considerações`.
- Ordem: `company → brand → audience → history → finance → website → accesses → closing`.
- Pergunta 30: existe outra informação relevante? Sim/Não via `RadioGroup` horizontal.
- Se Sim → textarea obrigatória; se Não → sanitize limpa o texto.
- Completar este step finaliza o briefing (não há step seguinte).
- Finalização é evento no cliente: `clients.briefing_finalized_at` setado **uma vez**.
- Edições pós-finalize atualizam `clients.briefing_content_updated_at` (qualquer save de conteúdo).
- Portal: após finalize, estado padrão é tela de obrigado; “Editar respostas” reabre o wizard completo; “Voltar ao resumo” retorna sem re-finalizar.
- Lista de clientes: badge derivado (`in_progress` / `finalized` / `edited_after_submit`). Sem diff campo a campo.
- Sem viewer staff, e-mail, notificação ou “desfinalizar” no v1.

## Payload

```ts
{
  hasAdditionalInfo: "yes" | "no" | null
  additionalInfo: string
}
```

## Complete / Finalize

`isClosingReadyToComplete(payload)`:

1. `hasAdditionalInfo` ≠ `null`.
2. Se `yes` → `additionalInfo` trim não vazio.
3. Sanitize: se ≠ `yes`, zera `additionalInfo`.

`completeBriefingClosing`:

1. Valida e salva o step `closing` com `completed_at`.
2. Em `clients`: seta `briefing_finalized_at = now()` somente se ainda for null.
3. Não atualiza `briefing_content_updated_at` neste momento.

## Status na lista

| Status                | Regra                                                              |
| --------------------- | ------------------------------------------------------------------ |
| `in_progress`         | `briefing_finalized_at` nulo                                       |
| `finalized`           | finalize setado e (`content_updated_at` nulo ou `<= finalized_at`) |
| `edited_after_submit` | `content_updated_at > finalized_at`                                |

Labels: Em andamento / Briefing enviado / Editado após envio.

## UX do portal

Fases: `wizard` | `complete` | `editing`.

- Load com `finalizedAt` → `complete`.
- Finalize → animação → `complete`.
- Edit → `editing` (wizard completo + banner).
- Voltar ao resumo → `complete`.

## Persistência

- Linha em `client_briefing_steps` com `step = 'closing'`.
- Colunas em `clients`: `briefing_finalized_at`, `briefing_content_updated_at`.
- Helper `touchBriefingContentUpdatedAt` nos saves de conteúdo pós-finalize.

## Fora de escopo

Viewer staff, diff campo a campo, notificações, un-finalize, alterar schemas de steps anteriores.
