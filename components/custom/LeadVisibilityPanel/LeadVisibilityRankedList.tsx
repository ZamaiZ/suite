"use client"

import type { ReactNode } from "react"
import { useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import {
  STEP_TONE_FILL,
  type StepTone,
} from "@/components/custom/LeadStepShell"
import { cn } from "cn"

export type RankedRow = {
  id: string
  /** O que aparece na linha. Pode ser texto ou um nó com host destacado. */
  label: ReactNode
  /** Texto puro para `title` e leitores de tela. */
  title: string
  value: number
  /** Segunda leitura, à direita do valor. Opcional. */
  note?: string
  tone?: StepTone
}

/**
 * Comparação entre itens é linha ranqueada com barra proporcional.
 *
 * Uma lista de `nome · N` em cinza não é comparada, é lida item a item — e o
 * leitor tem que decorar os números para achar o maior. A barra é o gancho que
 * faz isso acontecer antes da leitura.
 *
 * A barra é proporcional ao **maior item**, não ao total: aqui a pergunta é
 * "quem domina", e normalizar pelo topo é o que dá resolução às linhas de
 * baixo. Quando a pergunta for "que fatia do todo", a forma certa é a barra
 * empilhada.
 *
 * Anima o contêiner com `scaleX`, não a largura de cada linha: o raio mora no
 * contêiner (`rounded-full overflow-hidden`), então escalar não deforma ponta
 * arredondada nenhuma e a lei de animar só `transform` e `opacity` fica de pé.
 */
export function LeadVisibilityRankedList({
  rows,
  formatValue,
  emptyLabel,
}: {
  rows: ReadonlyArray<RankedRow>
  formatValue: (value: number) => string
  emptyLabel: string
}) {
  const reduced = !!useReducedMotion()
  if (rows.length === 0) {
    return <p className="text-xs/relaxed text-muted-foreground">{emptyLabel}</p>
  }
  const top = Math.max(...rows.map((row) => row.value), 0)

  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => {
        const share = top > 0 ? row.value / top : 0
        return (
          <li key={row.id} className="min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span
                title={row.title}
                className="min-w-0 truncate text-[11px] text-muted-foreground"
              >
                {row.label}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-foreground">
                {formatValue(row.value)}
                {row.note ? (
                  <span className="ml-1.5 text-muted-foreground">
                    {row.note}
                  </span>
                ) : null}
              </span>
            </div>
            <m.span
              initial={reduced ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{
                duration: reduced ? 0 : 0.55,
                ease: [0.23, 1, 0.32, 1],
              }}
              className="mt-1 block h-1 origin-left overflow-hidden rounded-full bg-accent"
            >
              <span
                className={cn(
                  "block h-full rounded-full",
                  // Fração diminuta ainda tem que ser vista; zero não inventa pixel.
                  row.value > 0 && "min-w-1",
                  STEP_TONE_FILL[row.tone ?? "primary"],
                )}
                style={{ width: `${share * 100}%` }}
              />
            </m.span>
          </li>
        )
      })}
    </ul>
  )
}
