"use client"

import { useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import {
  STEP_TONE_FILL,
  STEP_TONE_RING,
  type StepTone,
} from "@/components/custom/LeadStepShell"
import { cn } from "cn"
import { VISIBILITY_STALE_SERP_DAYS } from "@/lib/leads/visibility-audit"

/** Fronteira da primeira zona. Abaixo disto o índice é retrato, não histórico. */
const FRESH_DAYS = 30

type AgeBand = "fresh" | "aging" | "stale"

const BAND_TONE: Record<AgeBand, StepTone> = {
  fresh: "success",
  aging: "warning",
  stale: "danger",
}

/** Zonas da régua. Alfa baixo: elas são fundo, o marcador é o dado. */
const ZONE_FILL: Record<AgeBand, string> = {
  fresh: "bg-success/25",
  aging: "bg-warning/30",
  stale: "bg-destructive/25",
}

function bandFor(days: number): AgeBand {
  if (days <= FRESH_DAYS) return "fresh"
  if (days <= VISIBILITY_STALE_SERP_DAYS) return "aging"
  return "stale"
}

function Marker({
  share,
  band,
  filled,
  label,
}: {
  share: number
  band: AgeBand
  /** Mediana é sólida; máximo é anel — dois dados, dois pesos. */
  filled: boolean
  label: string
}) {
  const reduced = !!useReducedMotion()
  return (
    <m.span
      aria-hidden
      title={label}
      initial={reduced ? false : { opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduced ? 0 : 0.28, ease: [0.23, 1, 0.32, 1] }}
      style={{ left: `${Math.max(0, Math.min(1, share)) * 100}%` }}
      className={cn(
        "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card",
        filled
          ? STEP_TONE_FILL[BAND_TONE[band]]
          : cn("bg-card ring-2 ring-inset", STEP_TONE_RING[BAND_TONE[band]]),
      )}
    />
  )
}

function Reading({
  label,
  days,
  filled,
}: {
  label: string
  days: number | null
  filled: boolean
}) {
  const band = days === null ? null : bandFor(days)
  return (
    <span className="inline-flex min-w-0 items-baseline gap-1.5">
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 translate-y-[-1px] rounded-full",
          band === null
            ? "bg-border"
            : filled
              ? STEP_TONE_FILL[BAND_TONE[band]]
              : cn(
                  "bg-transparent ring-2 ring-inset",
                  STEP_TONE_RING[BAND_TONE[band]],
                ),
        )}
      />
      <span className="text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
        {label}
      </span>
      <span
        className={cn(
          "text-xs font-semibold tabular-nums",
          days === null ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {days === null ? "—" : `${days.toLocaleString("pt-BR")} d`}
      </span>
    </span>
  )
}

/**
 * Régua de banda da idade do índice.
 *
 * Uma barra de fração mentiria aqui: menor é melhor e existe limiar. Uma
 * mediana de 59 dias sobre um corte de 90 encheria 65% da trilha e leria como
 * "quase cheio", que é o contrário do dado. A régua troca a fração pelas três
 * zonas — recente, envelhecendo, velho —, e o dado vira o marcador: dá para ver
 * em que faixa caiu e a que distância está da fronteira.
 *
 * Mediana e máximo entram como marcadores diferentes — sólido e anel — em vez
 * de virarem `"59d mediana · 109d máximo"`, que não declara qual dos dois o
 * leitor deve olhar primeiro.
 */
export function LeadVisibilityIndexAgeGauge({
  medianDays,
  maxDays,
}: {
  medianDays: number
  maxDays: number
}) {
  // A escala vai até o maior entre o limiar com folga e o pior caso medido:
  // um domínio com SERP de 200 dias não pode estourar a régua.
  const scale = Math.max(120, maxDays)
  const zones: Array<{ band: AgeBand; width: number }> = [
    { band: "fresh", width: FRESH_DAYS / scale },
    { band: "aging", width: (VISIBILITY_STALE_SERP_DAYS - FRESH_DAYS) / scale },
    { band: "stale", width: (scale - VISIBILITY_STALE_SERP_DAYS) / scale },
  ]

  return (
    <div className="min-w-0">
      <div className="relative h-3">
        <span className="absolute inset-0 flex overflow-hidden rounded-full">
          {zones.map((zone) => (
            <span
              key={zone.band}
              className={cn("block h-full", ZONE_FILL[zone.band])}
              style={{ width: `${zone.width * 100}%` }}
            />
          ))}
        </span>
        <Marker
          share={medianDays / scale}
          band={bandFor(medianDays)}
          filled
          label={`Mediana: ${medianDays} dias`}
        />
        <Marker
          share={maxDays / scale}
          band={bandFor(maxDays)}
          filled={false}
          label={`Mais antiga: ${maxDays} dias`}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <Reading label="Mediana" days={medianDays} filled />
        <Reading label="Mais antiga" days={maxDays} filled={false} />
      </div>
    </div>
  )
}
