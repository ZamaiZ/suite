"use client"

import { useState } from "react"
import { RiStarFill } from "react-icons/ri"
import { LeadGbpCard } from "./LeadGbpCard"
import { cn } from "cn"
import { formatDateTimeShort } from "@/lib/date-time"
import type { GbpReviewSummary } from "@/lib/leads/gbp-audit"
import {
  formatGbpCount,
  formatGbpRating,
  gbpReplyRateLabel,
  gbpReputationBlockLabel,
  gbpReputationSpanLabel,
  gbpReputationWindowLabel,
  gbpAuthorsLabel,
  gbpBurstLabel,
  gbpFrequencyLabel,
  gbpReplyByBandLabel,
  gbpReviewsDeltaLabel,
} from "@/lib/leads/gbp-presenters"
import type { GbpRatingDistribution } from "@/lib/leads/gbp-enrichment"
import type { GbpReputation } from "@/lib/leads/gbp-reputation"
import type { GbpReputationDelta } from "@/lib/leads/gbp-reputation-compare"
import {
  GBP_REPLY_TIME_BANDS,
  GBP_REPLY_TIME_LABELS,
  type GbpReplyTimeBand,
} from "@/lib/leads/gbp-analyst-review"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const FEATURED_PREVIEW = 2
const STARS = ["5", "4", "3", "2", "1"] as const

const BAR_TONE: Record<(typeof STARS)[number], string> = {
  "5": "bg-success",
  "4": "bg-warning",
  "3": "bg-warning/70",
  "2": "bg-muted-foreground/40",
  "1": "bg-destructive/80",
}

function RatingBars({ distribution }: { distribution: GbpRatingDistribution }) {
  const total = STARS.reduce((sum, star) => sum + distribution[star], 0)
  return (
    <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
      {STARS.map((star) => {
        const count = distribution[star]
        const ratio = total > 0 ? count / total : 0
        return (
          <li key={star} className="flex items-center gap-2">
            <span className="w-8 shrink-0 text-xs/relaxed tabular-nums text-muted-foreground">
              {star}★
            </span>
            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-accent">
              <span
                className={cn("block h-full rounded-full", BAR_TONE[star])}
                style={{
                  width: `${Math.max(ratio * 100, count > 0 ? 2 : 0)}%`,
                }}
              />
            </span>
            <span className="w-8 shrink-0 text-right text-xs/relaxed tabular-nums text-muted-foreground">
              {count.toLocaleString("pt-BR")}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

const REPLY_TIME_UNSET = "unset"

const REPLY_TIME_ITEMS = [
  { value: REPLY_TIME_UNSET, label: "Não informado" },
  ...GBP_REPLY_TIME_BANDS.map((band) => ({
    value: band,
    label: GBP_REPLY_TIME_LABELS[band],
  })),
]

export function LeadGbpReviewsBlock({
  reviews,
  rating,
  ratingCount,
  distribution,
  replyTimeBand,
  canEdit,
  savingReplyTime,
  onReplyTimeChange,
  reputation,
  reviewsDelta,
}: {
  reviews: GbpReviewSummary | null
  rating: number | null
  ratingCount: number | null
  distribution: GbpRatingDistribution | null
  /**
   * Observado pelo analista, não medido: a resposta do proprietário não traz
   * data no corpo, só a data de quem avaliou.
   */
  replyTimeBand: GbpReplyTimeBand | null
  canEdit: boolean
  savingReplyTime: boolean
  onReplyTimeChange: (band: GbpReplyTimeBand | null) => void
  /** Calculada uma vez pelo cartão e reusada aqui, em vez de recomputada. */
  reputation: GbpReputation | null
  reviewsDelta: GbpReputationDelta
}) {
  const [expanded, setExpanded] = useState(false)
  const items = reviews?.items ?? []
  const visible = expanded ? items : items.slice(0, FEATURED_PREVIEW)
  const hiddenCount = Math.max(0, items.length - FEATURED_PREVIEW)
  const ratingLabel = formatGbpRating(rating)
  const countLabel = formatGbpCount(ratingCount)
  const spanLabel = gbpReputationSpanLabel(reputation?.sample.spanDays ?? null)
  const replyLabel = gbpReplyRateLabel(reputation?.sample.replyRate ?? null)
  const sample = reputation?.sample ?? null
  const burstLabel = sample ? gbpBurstLabel(sample) : null
  const frequencyLabel = sample ? gbpFrequencyLabel(sample) : null
  const bandLabel = sample ? gbpReplyByBandLabel(sample) : null
  const authorsLabel = sample ? gbpAuthorsLabel(sample) : null
  const measuredReplyDays = sample?.replyMedianDays ?? null

  return (
    <LeadGbpCard title="Reputação">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="shrink-0">
          <p className="text-base font-semibold text-foreground">
            {ratingLabel ?? "—"}
          </p>
          <p className="text-xs/relaxed text-muted-foreground">de 5</p>
          <p className="mt-1 text-xs/relaxed text-muted-foreground">
            {countLabel ? `${countLabel} avaliações` : "Sem avaliações"}
          </p>
        </div>
        {distribution ? <RatingBars distribution={distribution} /> : null}
      </div>

      {reputation ? (
        <div className="mt-4 flex flex-col gap-1 rounded-lg border border-border/70 bg-background px-3 py-2">
          <p className="text-xs/relaxed text-foreground">
            {reputation.history.status === "ok"
              ? `Nas ${formatGbpCount(reputation.history.recentCount)} mais recentes a média é ${formatGbpRating(reputation.history.recentAverage)}; nas ${formatGbpCount(reputation.history.priorCount)} anteriores era ${formatGbpRating(reputation.history.priorAverage)}.`
              : gbpReputationBlockLabel(reputation.history.reason)}
          </p>
          <p className="text-xs/relaxed text-muted-foreground">
            {reputation.sample.windows
              .map(gbpReputationWindowLabel)
              .join(" · ")}
          </p>
          <p className="text-xs/relaxed text-muted-foreground">
            {[
              `Amostra de ${formatGbpCount(reputation.sample.size)}`,
              spanLabel ? `cobrindo ${spanLabel}` : null,
              replyLabel
                ? `${formatGbpCount(reputation.sample.repliedCount)} respondidas (${replyLabel})`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {/* Rajada em destaque: é achado, não estatística de rodapé. */}
          {burstLabel ? (
            <p className="text-xs/relaxed text-foreground">
              Concentração: {burstLabel}
            </p>
          ) : null}
          {frequencyLabel ? (
            <p className="text-xs/relaxed text-muted-foreground">
              Ritmo: {frequencyLabel}
            </p>
          ) : null}
          {bandLabel ? (
            <p className="text-xs/relaxed text-muted-foreground">
              Resposta por nota: {bandLabel}
            </p>
          ) : null}
          {authorsLabel ? (
            <p className="text-xs/relaxed text-muted-foreground">
              Autores: {authorsLabel}
            </p>
          ) : null}
          <p className="text-xs/relaxed text-muted-foreground">
            {gbpReviewsDeltaLabel(reviewsDelta)}
          </p>
        </div>
      ) : null}

      {/*
        Fica junto das métricas calculadas, e separado por rótulo: o tempo de
        resposta é observado, não medido, e misturar as duas naturezas sem dizer
        qual é qual seria o mesmo erro das janelas sem período declarado.
      */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs/relaxed text-muted-foreground">
          Tempo de resposta{" "}
          {measuredReplyDays !== null ? (
            <span className="text-foreground">
              · mediana de {Math.round(measuredReplyDays).toLocaleString("pt-BR")}{" "}
              dias
            </span>
          ) : (
            <span className="text-muted-foreground/70">· informado</span>
          )}
        </span>
        <Select
          items={REPLY_TIME_ITEMS}
          value={replyTimeBand ?? REPLY_TIME_UNSET}
          onValueChange={(value) =>
            onReplyTimeChange(
              String(value) === REPLY_TIME_UNSET
                ? null
                : (String(value) as GbpReplyTimeBand),
            )
          }
          disabled={!canEdit || savingReplyTime}
        >
          <SelectTrigger size="sm" aria-label="Tempo médio de resposta">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {REPLY_TIME_ITEMS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-xs/relaxed text-muted-foreground">
          Nenhuma avaliação em destaque.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {visible.map((item, index) => (
            <li
              key={`${item.publishedAt ?? ""}:${index}`}
              className="rounded-lg border border-border/70 bg-background px-3 py-2"
            >
              <p className="flex items-center gap-1 text-xs/relaxed text-muted-foreground">
                {item.rating !== null ? (
                  <span className="inline-flex items-center gap-0.5 text-foreground">
                    {Array.from({ length: 5 }, (_, star) => (
                      <RiStarFill
                        key={star}
                        size={12}
                        aria-hidden
                        className={
                          star < Math.round(item.rating ?? 0)
                            ? "text-warning"
                            : "text-border"
                        }
                      />
                    ))}
                  </span>
                ) : (
                  "Sem nota"
                )}
                {item.publishedAt
                  ? ` · ${formatDateTimeShort(item.publishedAt)}`
                  : ""}
              </p>
              {item.text ? (
                <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs/relaxed text-foreground">
                  {item.text}
                </p>
              ) : null}
              {item.ownerAnswer ? (
                <p className="mt-1 text-xs/relaxed text-muted-foreground">
                  Resposta do dono
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {hiddenCount > 0 || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="mt-2 cursor-pointer text-xs/relaxed font-medium text-primary"
        >
          {expanded
            ? "Ver menos"
            : `Ver todas as ${items.length.toLocaleString("pt-BR")} avaliações em destaque`}
        </button>
      ) : null}
    </LeadGbpCard>
  )
}
