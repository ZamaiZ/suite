"use client"

import { useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "cn"

export type StepTabDef<Id extends string> = {
  id: Id
  label: string
}

/**
 * Mesma composição das abas do dialog (`LeadDetailHeader`): o sublinhado do
 * registry sai (`after:hidden`) e quem anima é o `m.span` com `layoutId`.
 *
 * Sem ícone: a aba já é rótulo curto com contador, e duas barras de etapa que
 * diferem custam mais do que o ícone entrega.
 */
export function StepTabs<Id extends string>({
  tabs,
  counts,
  value,
  layoutId,
  ariaLabel = "Seções da etapa",
}: {
  tabs: ReadonlyArray<StepTabDef<Id>>
  counts: Record<Id, number>
  value: Id
  /** Único por etapa — dois `layoutId` iguais fariam os sublinhados brigarem. */
  layoutId: string
  ariaLabel?: string
}) {
  const reduced = !!useReducedMotion()

  return (
    <TabsList
      variant="line"
      aria-label={ariaLabel}
      className="mt-3.5 h-auto items-stretch gap-6 p-0"
    >
      {tabs.map((item) => {
        const active = value === item.id
        const count = counts[item.id]
        return (
          <TabsTrigger
            key={item.id}
            value={item.id}
            className={cn(
              "relative h-auto flex-none cursor-pointer gap-1.5 rounded-none border-0 px-0 pt-0 pb-2.5 text-[13px] after:hidden",
              active
                ? "font-semibold data-active:text-foreground"
                : "font-medium text-muted-foreground",
            )}
          >
            {item.label}
            {count > 0 ? (
              <span
                className={cn(
                  "inline-flex h-[18px] items-center rounded-md px-1.5 text-[10px] font-semibold tabular-nums",
                  active
                    ? "bg-warning/[0.12] text-warning"
                    : "bg-accent text-muted-foreground",
                )}
              >
                {count}
              </span>
            ) : null}
            {active ? (
              <m.span
                layoutId={reduced ? undefined : layoutId}
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary"
                transition={{
                  duration: reduced ? 0.12 : 0.18,
                  ease: [0.23, 1, 0.32, 1],
                }}
              />
            ) : null}
          </TabsTrigger>
        )
      })}
    </TabsList>
  )
}
