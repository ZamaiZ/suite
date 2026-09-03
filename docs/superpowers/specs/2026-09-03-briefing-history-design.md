# Briefing Histórico e metas — Design

## Objetivo

Novo step `history` após `audience` e antes de `finance` para capturar experiências anteriores com marketing/prestadores e expectativas do projeto (objetivos + critério de NPS 10) — UI em seções, autosave/complete no padrão dos steps existentes.

## Decisões

- Step id `history`; label do stepper `Histórico e metas`.
- Ordem: `company → brand → audience → history → finance → website`.
- Um step com duas seções: Experiências anteriores + Expectativas.
- Q26 (investimento em marketing): Sim/Não; se Sim → dois textareas (`marketingChannels`, `marketingResults`).
- Q27 (insatisfação com prestador): só se Q26 = Sim; se Sim → textarea de detalhe.
- Complete = tudo visível obrigatório.
- Sim/Não via `RadioGroup` horizontal (padrão Marca).
- Sanitize zera campos ocultos no parse/save.
- Sem Storage; sem leitura cruzada de brand/finance; sem alterar perguntas de Marca.
- Fora de escopo: admin/export/PDF; numeração externa do questionário; emojis na UI.

## Payload

```ts
{
  hasMarketingInvestment: "yes" | "no" | null
  marketingChannels: string
  marketingResults: string
  hasProviderDissatisfaction: "yes" | "no" | null
  providerDissatisfactionNotes: string
  projectGoals: string
  npsTenCriteria: string
}
```

## Complete

`isHistoryReadyToComplete(payload)`:

1. `hasMarketingInvestment` preenchido.
2. Se `yes`: `marketingChannels` e `marketingResults` não vazios; `hasProviderDissatisfaction` preenchido.
3. Se insatisfação `yes`: `providerDissatisfactionNotes` não vazio.
4. `projectGoals` e `npsTenCriteria` sempre obrigatórios.
5. Sanitize: investimento ≠ `yes` zera canais, resultados, insatisfação e notas; insatisfação ≠ `yes` zera notas.

## Persistência

Linha em `client_briefing_steps` com `step = 'history'`. Complete valida só o payload do próprio step.
