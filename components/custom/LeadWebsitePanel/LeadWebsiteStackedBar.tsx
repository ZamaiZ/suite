"use client"

import { useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { cn } from "cn"

const FILL = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
] as const

export type StackedItem = { label: string; count: number }

/**
 * Distribuição como barra, não como frase. `"Links por TLD: .br 62% · .com 21%"`
 * é uma linha cinza sem hierarquia — o componente só conseguia imprimi-la
 * inteira, e proporção lida em texto não é comparada, é decorada.
 *
 * A rampa `chart-*` é **sequencial**, não categórica. Aqui isso é legítimo
 * porque as fatias são ordenadas por participação e a legenda declara a ordem;
 * num eixo sem ordem natural ela mentiria.
 *
 * Anima o **contêiner** com `scaleX`, não a largura das fatias: o raio mora no
 * contêiner (`rounded-full overflow-hidden`), então escalar não deforma ponta
 * arredondada nenhuma e a lei de animar só `transform` e `opacity` continua de
 * pé — sem abrir uma segunda exceção ao lado do `StepMeter`.
 */
export function LeadWebsiteStackedBar({
  items,
  total,
}: {
  items: StackedItem[]
  /** Denominador declarado. Sem ele, a soma das fatias vira o todo. */
  total?: number
}) {
  const reduced = !!useReducedMotion()
  const shown = items.slice(0, FILL.length)
  const sum = shown.reduce((acc, item) => acc + item.count, 0)
  const base = total && total > 0 ? total : sum
  if (base <= 0 || shown.length === 0) return null

  const rest = base - sum

  return (
    <div className="min-w-0">
      <m.span
        initial={reduced ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: reduced ? 0 : 0.55, ease: [0.23, 1, 0.32, 1] }}
        className="flex h-2 origin-left overflow-hidden rounded-full bg-accent"
      >
        {shown.map((item, index) => (
          <span
            key={item.label}
            className={cn(
              "block h-full",
              // Fatia diminuta ainda tem que ser vista; zero não inventa pixel.
              item.count > 0 && "min-w-1",
              FILL[index % FILL.length],
            )}
            style={{ width: `${(item.count / base) * 100}%` }}
          />
        ))}
      </m.span>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
        {shown.map((item, index) => (
          <div
            key={item.label}
            className="flex min-w-0 items-baseline justify-between gap-2 text-[11px]"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden
                className={cn(
                  "inline-block size-2 shrink-0 rounded-full",
                  FILL[index % FILL.length],
                )}
              />
              <span className="truncate text-muted-foreground">
                {item.label}
              </span>
            </span>
            <span className="shrink-0 tabular-nums text-foreground">
              {Math.round((item.count / base) * 100)}%
            </span>
          </div>
        ))}
        {rest > 0 ? (
          <div className="flex min-w-0 items-baseline justify-between gap-2 text-[11px]">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block size-2 shrink-0 rounded-full bg-accent ring-1 ring-border"
              />
              <span className="truncate text-muted-foreground">Restante</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {Math.round((rest / base) * 100)}%
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}
