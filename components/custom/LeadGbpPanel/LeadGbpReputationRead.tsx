"use client"

import {
  RiDatabase2Line,
  RiInformationLine,
  RiPauseCircleLine,
  RiChatDeleteLine,
  RiStackLine,
} from "react-icons/ri"
import {
  GbpCountCell,
  GbpMeter,
  GbpMeterRow,
  GbpSectionLabel,
  GbpStat,
} from "./LeadGbpMetrics"
import {
  GBP_REPUTATION_DORMANT_DAYS,
  type GbpReputation,
} from "@/lib/leads/gbp-reputation"
import type { GbpReputationDelta } from "@/lib/leads/gbp-reputation-compare"
import {
  formatGbpCount,
  formatGbpRating,
  gbpReputationBlockLabel,
  gbpReputationSpanLabel,
  gbpReviewsDeltaLabel,
} from "@/lib/leads/gbp-presenters"

function share(value: number | null): number {
  return value === null ? 0 : value
}

function pctLabel(value: number | null): string | null {
  if (value === null) return null
  return `${Math.round(value * 100)}%`
}

function num(value: number, digits = 0): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: digits })
}

/**
 * A leitura da amostra, lida da estrutura de `GbpReputationSample`.
 *
 * Os presenters de `gbp-presenters.ts` juntavam esses mesmos números com
 * `" · "` e devolviam uma frase; frase pronta não tem hierarquia para
 * declarar. Aqui cada número volta a ser um número, e a forma sai do trabalho
 * que ele faz: fração vira medidor, achado vira tile, janela cumulativa vira
 * célula — barra comparativa mentiria, porque a janela de 365 contém a de 30.
 *
 * Continuam vindo dos presenters as frases que são de fato explicação de
 * estado, não dado: os motivos de bloqueio do histórico e da comparação.
 */
export function LeadGbpReputationRead({
  reputation,
  reviewsDelta,
}: {
  reputation: GbpReputation
  reviewsDelta: GbpReputationDelta
}) {
  const { sample, history } = reputation
  const high = sample.replyByBand.find((band) => band.band === "high")
  const low = sample.replyByBand.find((band) => band.band === "low")
  const burst = sample.burst
  const dormant =
    sample.daysSinceLast !== null &&
    sample.daysSinceLast >= GBP_REPUTATION_DORMANT_DAYS
  const spanLabel = gbpReputationSpanLabel(sample.spanDays)
  const authors: Array<[string, number | null]> = [
    ["Com foto", sample.authors.withPhotosShare],
    ["Autores novos", sample.authors.lowActivityShare],
    ["Sem texto", sample.authors.withoutTextShare],
    ["Local guides", sample.authors.localGuideShare],
  ]
  const measuredAuthors = authors.filter(([, value]) => value !== null)

  const findings = [
    // Resposta por nota primeiro: a taxa geral esconde exatamente o caso em
    // que se responde todo elogio e nenhuma crítica, e é o que o closer usa.
    low?.replyRate != null && high?.replyRate != null ? (
      <GbpStat
        key="bands"
        icon={RiChatDeleteLine}
        label="Críticas sem resposta"
        value={pctLabel(low.replyRate) ?? "—"}
        unit="respondidas"
        tone={low.replyRate < 0.5 ? "danger" : "neutral"}
      >
        <div className="mt-2 flex flex-col gap-1.5">
          <GbpMeterRow
            label={`Notas altas · ${num(high.count)}`}
            value={pctLabel(high.replyRate) ?? "—"}
            share={share(high.replyRate)}
            tone="success"
          />
          <GbpMeterRow
            label={`Notas baixas · ${num(low.count)}`}
            value={pctLabel(low.replyRate) ?? "—"}
            share={share(low.replyRate)}
            tone="danger"
          />
        </div>
      </GbpStat>
    ) : null,

    burst ? (
      <GbpStat
        key="burst"
        icon={RiStackLine}
        label="Concentração"
        value={pctLabel(burst.share) ?? "—"}
        unit={`em ${burst.days.length} ${burst.days.length === 1 ? "dia" : "dias"}`}
        tone="warning"
        hint={`${num(burst.count)} de ${num(sample.size)} avaliações da amostra`}
      >
        <GbpMeter share={burst.share} tone="warning" trackClassName="mt-2" />
      </GbpStat>
    ) : null,

    sample.daysSinceLast !== null ? (
      <GbpStat
        key="pace"
        icon={RiPauseCircleLine}
        label="Ritmo"
        value={num(sample.daysSinceLast)}
        unit="dias sem avaliação"
        tone={dormant ? "warning" : "neutral"}
        hint={
          [
            sample.perMonth !== null ? `${num(sample.perMonth, 1)} por mês` : null,
            sample.trend
              ? `${num(sample.trend.recent)} nos últimos ${num(sample.trend.days)} dias contra ${num(sample.trend.previous)} nos ${num(sample.trend.days)} anteriores`
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
      />
    ) : null,
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-4">
      {findings.length > 0 ? (
        <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {findings}
        </div>
      ) : null}

      {/*
        Os autores vêm logo abaixo dos achados de propósito: concentração alta,
        "com foto" no teto e muito autor novo, lidos juntos, são um padrão. Em
        linhas separadas por outras duas, ninguém liga uma coisa à outra.
      */}
      {measuredAuthors.length > 0 ? (
        <section>
          <GbpSectionLabel aside={`amostra de ${num(sample.size)}`}>
            Perfil dos autores
          </GbpSectionLabel>
          <div className="grid grid-cols-2 gap-x-5 gap-y-2.5 xl:grid-cols-4">
            {measuredAuthors.map(([label, value]) => (
              <GbpMeterRow
                key={label}
                label={label}
                value={pctLabel(value) ?? "—"}
                share={share(value)}
                tone="primary"
              />
            ))}
          </div>
        </section>
      ) : null}

      {sample.windows.length > 0 ? (
        <section>
          <GbpSectionLabel aside="acumulado">
            Avaliações por janela
          </GbpSectionLabel>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {sample.windows.map((window) => (
              <GbpCountCell
                key={window.days}
                // Janela truncada é piso, não total: a amostra tem teto, e um
                // número absoluto afirmaria algo que ninguém mediu.
                value={
                  window.complete
                    ? num(window.count)
                    : `${num(window.count)}+`
                }
                label={`${window.days} dias`}
                dim={window.count === 0}
              />
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-col gap-1.5 border-t border-border/70 pt-2.5">
        <p className="flex items-start gap-1.5 text-[10px]/[1.5] text-muted-foreground">
          <RiDatabase2Line size={12} aria-hidden className="mt-px shrink-0" />
          <span>
            {[
              `Amostra de ${formatGbpCount(sample.size)}`,
              spanLabel ? `cobre ${spanLabel}` : null,
              sample.replyRate !== null
                ? `${formatGbpCount(sample.repliedCount)} respondidas (${pctLabel(sample.replyRate)})`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </p>
        <p className="flex items-start gap-1.5 text-[10px]/[1.5] text-muted-foreground">
          <RiInformationLine size={12} aria-hidden className="mt-px shrink-0" />
          <span>
            {history.status === "ok"
              ? `Nas ${formatGbpCount(history.recentCount)} mais recentes a média é ${formatGbpRating(history.recentAverage)}; nas ${formatGbpCount(history.priorCount)} anteriores era ${formatGbpRating(history.priorAverage)}.`
              : gbpReputationBlockLabel(history.reason)}{" "}
            {gbpReviewsDeltaLabel(reviewsDelta)}
          </span>
        </p>
      </div>
    </div>
  )
}
