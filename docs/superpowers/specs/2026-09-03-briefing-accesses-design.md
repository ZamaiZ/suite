# Briefing Acessos — Design

## Objetivo

Novo step `accesses` após `website` para capturar disponibilidade e dados de acesso (WordPress, Search Console, Analytics, GBP, hospedagem/domínio, outras ferramentas) — metadados no jsonb do briefing; senhas em tabela separada criptografada.

## Decisões

- Step id `accesses`; label do stepper `Acessos`.
- Ordem: `company → brand → audience → history → finance → website → accesses`.
- Híbrido por tipo:
  - WordPress / Hospedagem e Domínio: status + URL + usuário + senha (senha fora do jsonb).
  - Search Console / Analytics / GBP: status + e-mail de convite.
  - Outras ferramentas: status; se sim → lista de nomes (chips) + username/senha opcionais por item.
- Hospedagem e Domínio = um único bloco (um par de credenciais).
- Complete = todos os 6 status; se `yes`, campos daquele tipo obrigatórios; senha ok se nova **ou** secret já persistido (`hasSecret`).
- Sim/Não via `RadioGroup` horizontal.
- Sanitize zera campos ocultos e remove secrets órfãos.
- Load nunca devolve plaintext; só `secretFlags`.
- Sem reveal interno, export/PDF, prefill do site da Empresa, Vault/pgsodium no v1.

## Payload (metadados)

```ts
{
  wordpress: { status: "yes" | "no" | null, loginUrl: string, username: string }
  searchConsole: { status: "yes" | "no" | null, inviteEmail: string }
  analytics: { status: "yes" | "no" | null, inviteEmail: string }
  gbp: { status: "yes" | "no" | null, inviteEmail: string }
  hostingDomain: { status: "yes" | "no" | null, panelUrl: string, username: string }
  otherTools: {
    status: "yes" | "no" | null
    items: { id: string, name: string, username: string }[]
  }
}
```

## Segredos

Tabela `client_briefing_secrets`: `(client_id, kind, ciphertext, iv, updated_at)`, unique `(client_id, kind)`.

Kinds: `wordpress` | `hosting_domain` | `other:<itemId>`.

Criptografia AES-256-GCM na app com `BRIEFING_SECRETS_KEY` (env). RLS on; revoke anon/authenticated.

## Complete

`isAccessesReadyToComplete(payload, secretFlags)`:

1. Seis status ≠ `null`.
2. WordPress `yes` → `loginUrl`, `username`, e (`secretFlags.wordpress` ou senha nova no fluxo de UI).
3. SC / Analytics / GBP `yes` → e-mail válido.
4. Hosting `yes` → `panelUrl`, `username`, e secret presente (ou senha nova).
5. Outras `yes` → ≥1 item com `name`; credenciais por item opcionais.
6. Sanitize: status ≠ `yes` zera bloco; outras ≠ `yes` zera `items`.

## Persistência

- Linha em `client_briefing_steps` com `step = 'accesses'`.
- Autosave só metadados; upsert/delete de secret em actions dedicadas.
- Complete valida metadados + flags de secret no servidor.
