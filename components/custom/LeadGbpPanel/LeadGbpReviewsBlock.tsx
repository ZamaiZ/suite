"use client"

import { useState } from "react"
import { RiStarFill } from "react-icons/ri"
import { LeadGbpCard } from "./LeadGbpCard"
import { cn } from "@/lib/cn"
import { formatDateTimeShort, todayCivilDate } from "@/lib/date-time"
import type { GbpReviewSummary } from "@/lib/leads/gbp-audit"
import {
  formatGbpCount,
  formatGbpRating,
  gbpReplyRateLabel,
  gbpReputationBlockLabel,
  gbpReputationSpanLabel,
  gbpReputationWindowLabel,
} from "@/lib/leads/gbp-presenters"
import type { GbpRatingDistribution } from "@/lib/leads/gbp-enrichment"
import { gbpReputation } from "@/lib/leads/gbp-reputation"

const FEATURED_PREVIEW = 2
const STARS = ["5", "4", "3", "2", "1"] as const

const BAR_TONE: Record<(typeof STARS)[number], string> = {
  "5": "bg-success",
  "4": "bg-warning",
  "3": "bg-warning/70",
  "2": "bg-fg-muted/40",
  "1": "bg-danger/80",
}

function RatingBars({
  distribution,
}: {
  distribution: GbpRatingDistribution
}) {
  const total = STARS.reduce((sum, star) => sum + distribution[star], 0)
  return (
    <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
      {STARS.map((star) => {
        const count = distribution[star]
        const ratio = total > 0 ? count / total : 0
        return (
          <li key={star} className="flex items-center gap-2">
            <span className="w-8 shrink-0 font-sans text-caption tabular-nums text-fg-muted">
              {star}★
            </span>
            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-hover">
              <span
                className={cn("block h-full rounded-full", BAR_TONE[star])}
                style={{ width: `${Math.max(ratio * 100, count > 0 ? 2 : 0)}%` }}
              />
            </span>
            <span className="w-8 shrink-0 text-right font-sans text-caption tabular-nums text-fg-muted">
              {count.toLocaleString("pt-BR")}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export function LeadGbpReviewsBlock({
  reviews,
  rating,
  ratingCount,
  distribution,
}: {
  reviews: GbpReviewSummary | null
  rating: number | null
  ratingCount: number | null
  distribution: GbpRatingDistribution | null
}) {
  const [expanded, setExpanded] = useState(false)
  const items = reviews?.items ?? []
  const visible = expanded ? items : items.slice(0, FEATURED_PREVIEW)
  const hiddenCount = Math.max(0, items.length - FEATURED_PREVIEW)
  const ratingLabel = formatGbpRating(rating)
  const countLabel = formatGbpCount(ratingCount)
  const reputation = gbpReputation({
    reviews,
    distribution,
    today: todayCivilDate(),
  })
  const spanLabel = gbpReputationSpanLabel(
    reputation?.sample.spanDays ?? null,
  )
  const replyLabel = gbpReplyRateLabel(reputation?.sample.replyRate ?? null)

  return (
    <LeadGbpCard title="Reputação">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="shrink-0">
          <p className="font-sans text-body-lg font-semibold text-fg">
            {ratingLabel ?? "—"}
          </p>
          <p className="font-sans text-caption text-fg-muted">de 5</p>
          <p className="mt-1 font-sans text-caption text-fg-secondary">
            {countLabel
              ? `${countLabel} avaliações`
              : "Sem avaliações"}
          </p>
        </div>
        {distribution ? <RatingBars distribution={distribution} /> : null}
      </div>

      {reputation ? (
        <div className="mt-4 flex flex-col gap-1 rounded-lg border border-border-subtle bg-canvas px-3 py-2">
          <p className="font-sans text-caption text-fg">
            {reputation.history.status === "ok"
              ? `Nas ${formatGbpCount(reputation.history.recentCount)} mais recentes a média é ${formatGbpRating(reputation.history.recentAverage)}; nas ${formatGbpCount(reputation.history.priorCount)} anteriores era ${formatGbpRating(reputation.history.priorAverage)}.`
              : gbpReputationBlockLabel(reputation.history.reason)}
          </p>
          <p className="font-sans text-caption text-fg-secondary">
            {reputation.sample.windows.map(gbpReputationWindowLabel).join(" · ")}
          </p>
          <p className="font-sans text-caption text-fg-muted">
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
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="mt-4 font-sans text-caption text-fg-muted">
          Nenhuma avaliação em destaque.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {visible.map((item, index) => (
            <li
              key={`${item.publishedAt ?? ""}:${index}`}
              className="rounded-lg border border-border-subtle bg-canvas px-3 py-2"
            >
              <p className="flex items-center gap-1 font-sans text-caption text-fg-muted">
                {item.rating !== null ? (
                  <span className="inline-flex items-center gap-0.5 text-fg">
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
                <p className="mt-1 line-clamp-4 whitespace-pre-wrap font-sans text-caption text-fg">
                  {item.text}
                </p>
              ) : null}
              {item.ownerAnswer ? (
                <p className="mt-1 font-sans text-caption text-fg-secondary">
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
          className="mt-2 cursor-pointer font-sans text-caption font-medium text-accent"
        >
          {expanded
            ? "Ver menos"
            : `Ver todas as ${items.length.toLocaleString("pt-BR")} avaliações em destaque`}
        </button>
      ) : null}
    </LeadGbpCard>
  )
}
