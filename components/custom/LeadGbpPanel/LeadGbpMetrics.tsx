"use client"

import type { ReactNode } from "react"
import type { IconType } from "react-icons"
import { useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { cn } from "cn"

/**
 * Primitivos de leitura numérica da etapa. Existem porque os presenters
 * entregavam frases (`parts.join(" · ")`) e frase pronta não tem hierarquia
 * para declarar — o componente só podia imprimi-la inteira, em cinza.
 */

export type GbpTone = "neutral" | "primary" | "success" | "warning" | "danger"

const FILL: Record<GbpTone, string> = {
  neutral: "bg-muted-foreground/40",
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
}

const TEXT: Record<GbpTone, string> = {
  neutral: "text-muted-foreground",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
}

/**
 * Alfas conferidos por cálculo, não por olho — texto do tom sobre a própria
 * superfície tingida, WCAG AA (4,5:1), em light e dark:
 *
 * | tom         | /0    | /0.05 |
 * | ----------- | ----- | ----- |
 * | warning     | 5,04  | 4,71  |
 * | success     | 5,14  | 4,80  |
 * | primary     | 5,37  | 5,01  |
 * | destructive | 4,76  | 4,36  |
 *
 * (light; o dark folga em todos). `destructive` é o único que **reprova com
 * qualquer lavagem**: a tinta escurece o branco justamente na faixa em que o
 * token já está no limite. Por isso ele fica sem fundo e ganha borda mais
 * firme — a regra é usar o token cheio, nunca uma versão com alfa que passe
 * raspando.
 */
const SURFACE: Record<GbpTone, string> = {
  neutral: "border-border/70 bg-card",
  primary: "border-primary/25 bg-primary/[0.05]",
  success: "border-success/25 bg-success/[0.05]",
  warning: "border-warning/25 bg-warning/[0.05]",
  danger: "border-destructive/40 bg-card",
}

function pct(share: number): string {
  return `${Math.max(0, Math.min(1, share)) * 100}%`
}

/**
 * Barra de fração. A trilha aparece mesmo com valor zero: ela é o que declara
 * que existe uma escala ali — sem ela, `0%` vira um rótulo solto e o leitor não
 * sabe contra o quê.
 */
export function GbpMeter({
  share,
  tone = "primary",
  className,
  trackClassName,
}: {
  /** 0 a 1. */
  share: number
  tone?: GbpTone
  className?: string
  trackClassName?: string
}) {
  const reduced = !!useReducedMotion()
  const width = pct(share)
  return (
    <span
      className={cn(
        "block h-1.5 overflow-hidden rounded-full bg-accent",
        trackClassName,
      )}
    >
      <m.span
        // Cresce da esquerda ao montar. `width`, e não `scaleX`, porque escala
        // deforma o raio da ponta arredondada.
        initial={reduced ? false : { width: 0 }}
        animate={{ width }}
        transition={{ duration: reduced ? 0 : 0.55, ease: [0.23, 1, 0.32, 1] }}
        className={cn(
          "block h-full rounded-full",
          // Fração diminuta ainda tem que ser vista; zero não inventa pixel.
          share > 0 && "min-w-1",
          FILL[tone],
          className,
        )}
      />
    </span>
  )
}

/** Medidor com rótulo à esquerda e valor à direita, alinhado por baseline. */
export function GbpMeterRow({
  label,
  value,
  share,
  tone = "primary",
}: {
  label: string
  value: string
  share: number
  tone?: GbpTone
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[11px] text-muted-foreground">
          {label}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-foreground">
          {value}
        </span>
      </div>
      <GbpMeter share={share} tone={tone} className="mt-1" trackClassName="h-1" />
    </div>
  )
}

/**
 * Tile de achado: o número é o elemento, o tom carrega o estado e o ícone
 * garante que o estado não dependa só de cor.
 */
export function GbpStat({
  icon: Icon,
  label,
  value,
  unit,
  hint,
  tone = "neutral",
  children,
}: {
  icon?: IconType
  label: string
  value: string
  /** Fica ao lado do número, na linha de base. */
  unit?: string
  hint?: string
  tone?: GbpTone
  children?: ReactNode
}) {
  const emphasis = tone === "neutral" ? "text-foreground" : TEXT[tone]
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-lg border px-3 py-2.5",
        SURFACE[tone],
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 text-[11px]",
          tone === "neutral" ? "text-muted-foreground" : TEXT[tone],
        )}
      >
        {Icon ? <Icon size={13} aria-hidden className="shrink-0" /> : null}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-0.5 flex items-baseline gap-1.5">
        <span
          className={cn(
            "text-[22px] leading-[1.15] font-semibold tracking-[-0.02em] tabular-nums",
            emphasis,
          )}
        >
          {value}
        </span>
        {unit ? (
          <span
            className={cn(
              "min-w-0 truncate text-[11px]",
              tone === "neutral" ? "text-muted-foreground" : TEXT[tone],
            )}
          >
            {unit}
          </span>
        ) : null}
      </p>
      {children}
      {hint ? (
        <p
          className={cn(
            "mt-1.5 text-[10px]/[1.45]",
            tone === "neutral" ? "text-muted-foreground" : TEXT[tone],
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** Rótulo de seção dentro de um card. */
export function GbpSectionLabel({
  children,
  aside,
}: {
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <span className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        {children}
      </span>
      {aside ? (
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {aside}
        </span>
      ) : null}
    </div>
  )
}

/** Célula de contagem — para janelas cumulativas, onde barra mentiria. */
export function GbpCountCell({
  value,
  label,
  dim,
}: {
  value: string
  label: string
  dim?: boolean
}) {
  return (
    <div className="rounded-lg border border-border/70 px-2 py-1.5">
      <p
        className={cn(
          "text-[17px] leading-[1.2] font-semibold tabular-nums",
          dim ? "text-muted-foreground/70" : "text-foreground",
        )}
      >
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}
