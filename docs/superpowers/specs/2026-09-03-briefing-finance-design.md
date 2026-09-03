# Briefing Financeiro — Design

## Objetivo

Novo step `finance` após `audience` para capturar faturamento, pico, sazonalidade, itens de maior lucro (catálogo brand) e ticket médio — UI em cards clicáveis, autosave/complete no padrão dos steps existentes.

## Decisões

- Sem estrela / principal no catálogo brand.
- Até 1 produto e até 1 serviço de maior lucro; complete exige só os `kind` presentes no catálogo.
- Ticket médio usa a mesma escala de ranges do faturamento/pico.
- Sazonalidade: `predictable` | `seasonal` | `unstable`; notes obrigatórias se ≠ `predictable`.
- Pico: range + motivo ambos obrigatórios.
- Não validar ordem ordinal pico ≥ médio.
- Fora de escopo: escala separada de ticket; chips de mês; estrela no catálogo.

## Payload

```ts
{
  monthlyRevenueRange: RevenueRangeId | null
  peakRevenueRange: RevenueRangeId | null
  peakRevenueReason: string
  seasonalityProfile: "predictable" | "seasonal" | "unstable" | null
  seasonalityNotes: string
  highestProfitProductId: string | null
  highestProfitServiceId: string | null
  averageTicketRange: RevenueRangeId | null
}
```

Ranges: `up_to_10k` | `10k_30k` | `30k_50k` | `50k_100k` | `100k_300k` | `300k_1m` | `above_1m`.

## Complete

`isFinanceReadyToComplete(payload, catalog)`:

1. Três ranges válidos.
2. Motivo do pico não vazio.
3. Perfil de sazonalidade preenchido; notes se ≠ previsível.
4. Catálogo elegível = `isProductOrServiceComplete`.
5. Exigir ID por `kind` presente; catálogo vazio = incompleto.
6. IDs órfãos limpos no sanitize com catálogo; `predictable` zera notes.

## Persistência

Linha em `client_briefing_steps` com `step = 'finance'`. Complete no server recarrega brand e valida IDs cruzados.
