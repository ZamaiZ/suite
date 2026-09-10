"use client"

import { useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { cn } from "cn"

export type VitalBand = "good" | "needs" | "poor"

const BAND_LABEL: Record<VitalBand, string> = {
  good: "Bom",
  needs: "A melhorar",
  poor: "Ruim",
}

const BAND_CHIP: Record<VitalBand, string> = {
  good: "bg-success/10 text-success",
  needs: "bg-warning/10 text-warning",
  poor: "bg-destructive/10 text-destructive",
}

const BAND_DOT: Record<VitalBand, string> = {
  good: "bg-success",
  needs: "bg-warning",
  poor: "bg-destructive",
}

/** Zonas da régua. Alfa baixo: elas são fundo, o marcador é o dado. */
const ZONE_FILL: Record<VitalBand, string> = {
  good: "bg-success/25",
  needs: "bg-warning/30",
  poor: "bg-destructive/25",
}

function bandFor(value: number, good: number, poor: number): VitalBand {
  if (value <= good) return "good"
  if (value <= poor) return "needs"
  return "poor"
}

function worstBand(bands: VitalBand[]): VitalBand {
  if (bands.includes("poor")) return "poor"
  if (bands.includes("needs")) return "needs"
  return "good"
}

function Marker({
  share,
  band,
  filled,
  label,
}: {
  share: number
  band: VitalBand
  /** Laboratório é sólido; campo é anel — dois dados, dois pesos. */
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
        filled ? BAND_DOT[band] : cn("bg-card ring-2 ring-inset", {
          "ring-success": band === "good",
          "ring-warning": band === "needs",
          "ring-destructive": band === "poor",
        }),
      )}
    />
  )
}

function Reading({
  label,
  value,
  band,
  filled,
}: {
  label: string
  value: string | null
  band: VitalBand | null
  filled: boolean
}) {
  return (
    <span className="inline-flex min-w-0 items-baseline gap-1.5">
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 translate-y-[-1px] rounded-full",
          band === null
            ? "bg-border"
            : filled
              ? BAND_DOT[band]
              : cn("bg-transparent ring-2 ring-inset", {
                  "ring-success": band === "good",
                  "ring-warning": band === "needs",
                  "ring-destructive": band === "poor",
                }),
        )}
      />
      <span className="text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase">
        {label}
      </span>
      <span
        className={cn(
          "text-xs font-semibold tabular-nums",
          value === null ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {value ?? "—"}
      </span>
    </span>
  )
}

/**
 * Régua de banda de um Core Web Vital.
 *
 * Uma barra de fração mentia aqui: nestas métricas menor é melhor, então um LCP
 * ótimo enchia 16% da trilha e lia como "quase vazio". A régua troca a fração
 * pelas três faixas do Google — bom, a melhorar, ruim —, e o dado vira o
 * marcador: dá para ver em que zona a métrica caiu e a que distância está da
 * fronteira. As zonas são o fundo; o marcador é a informação.
 *
 * Laboratório e campo entram como marcadores diferentes — sólido e anel — em vez
 * de virarem a frase `"828ms lab · 1,1s campo"`, que não tinha hierarquia para
 * declarar qual dos dois o leitor deveria olhar primeiro.
 */
export function LeadWebsiteVitalGauge({
  label,
  lab,
  field,
  good,
  poor,
  max,
  format,
}: {
  label: string
  lab: number | null
  field: number | null
  /** Teto da faixa boa. */
  good: number
  /** Teto da faixa "a melhorar". */
  poor: number
  /** Fim da régua. Acima do limiar ruim para a terceira zona ter largura. */
  max: number
  format: (value: number) => string
}) {
  const labBand = lab === null ? null : bandFor(lab, good, poor)
  const fieldBand = field === null ? null : bandFor(field, good, poor)
  const bands = [labBand, fieldBand].filter(
    (item): item is VitalBand => item !== null,
  )
  const verdict = bands.length > 0 ? worstBand(bands) : null

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          {label}
        </span>
        <span
          className={cn(
            "inline-flex h-[18px] shrink-0 items-center rounded-md px-1.5 text-[10px] font-semibold",
            verdict === null
              ? "bg-accent text-muted-foreground"
              : BAND_CHIP[verdict],
          )}
        >
          {verdict === null ? "Sem coleta" : BAND_LABEL[verdict]}
        </span>
      </div>

      <div className="relative mt-2">
        <div className="flex h-2 overflow-hidden rounded-full">
          <span
            className={cn("block h-full", ZONE_FILL.good)}
            style={{ width: `${(good / max) * 100}%` }}
          />
          <span
            className={cn("block h-full", ZONE_FILL.needs)}
            style={{ width: `${((poor - good) / max) * 100}%` }}
          />
          <span
            className={cn("block h-full flex-1", ZONE_FILL.poor)}
          />
        </div>
        {lab !== null && labBand ? (
          <Marker
            share={lab / max}
            band={labBand}
            filled
            label={`Laboratório ${format(lab)}`}
          />
        ) : null}
        {field !== null && fieldBand ? (
          <Marker
            share={field / max}
            band={fieldBand}
            filled={false}
            label={`Campo ${format(field)}`}
          />
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <Reading
          label="Lab"
          value={lab === null ? null : format(lab)}
          band={labBand}
          filled
        />
        <Reading
          label="Campo"
          value={field === null ? null : format(field)}
          band={fieldBand}
          filled={false}
        />
      </div>
    </div>
  )
}
