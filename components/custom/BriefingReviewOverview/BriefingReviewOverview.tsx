"use client"

import type { ComponentType } from "react"
import { LazyMotion, domAnimation, useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import {
  RiArrowRightSLine,
  RiBuilding2Line,
  RiCheckLine,
  RiGlobalLine,
  RiHistoryLine,
  RiKey2Line,
  RiMapPinUserLine,
  RiMoneyDollarCircleLine,
  RiPaletteLine,
  RiQuillPenLine,
} from "react-icons/ri"
import type { BriefingStepId } from "@/lib/briefing/steps"
import { cn } from "cn"
import { formatDateTimeShort } from "@/lib/date-time"
import type { BriefingReviewOverviewProps } from "./BriefingReviewOverview.types"

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1]

const STEP_ICONS: Record<
  BriefingStepId,
  ComponentType<{ size?: number; className?: string }>
> = {
  company: RiBuilding2Line,
  brand: RiPaletteLine,
  audience: RiMapPinUserLine,
  history: RiHistoryLine,
  finance: RiMoneyDollarCircleLine,
  website: RiGlobalLine,
  accesses: RiKey2Line,
  closing: RiQuillPenLine,
}

const STATE_LABEL: Record<string, string> = {
  empty: "Não iniciado",
  in_progress: "Em andamento",
  completed: "Concluído",
}

export function BriefingReviewOverview({
  steps,
  completedCount,
  onSelectStep,
  loading = false,
}: BriefingReviewOverviewProps) {
  const reduced = !!useReducedMotion()

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="h-[7.5rem] animate-pulse rounded-2xl bg-accent"
          />
        ))}
      </div>
    )
  }

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs/relaxed font-semibold text-foreground">
              Etapas do briefing
            </p>
            <p className="mt-1 text-xs/relaxed text-muted-foreground">
              {steps.every((step) => step.state === "empty")
                ? "O cliente ainda não começou o briefing."
                : "Abra uma etapa para consultar respostas e materiais."}
            </p>
          </div>
          <span className="rounded-md bg-background px-2 py-1 text-xs/relaxed font-medium tabular-nums text-muted-foreground">
            {completedCount}/8 concluídas
          </span>
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = STEP_ICONS[step.id]
            return (
              <m.li
                key={step.id}
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: reduced ? 0.12 : 0.28,
                  delay: reduced ? 0 : index * 0.035,
                  ease: EASE,
                }}
              >
                <button
                  type="button"
                  onClick={() => onSelectStep(step.id)}
                  className={cn(
                    "group flex h-full w-full flex-col gap-3 rounded-2xl border px-4 py-3.5 text-left",
                    "transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    "[@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-0.5",
                    "[@media(hover:hover)_and_(pointer:fine)]:hover:shadow-xs",
                    "active:scale-[0.98]",
                    step.state === "completed" &&
                      "border-success/25 bg-success/5",
                    step.state === "in_progress" &&
                      "border-warning/30 bg-warning/5",
                    step.state === "empty" && "border-border/70 bg-card/70",
                  )}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        "inline-flex size-9 items-center justify-center rounded-xl",
                        step.state === "completed" &&
                          "bg-success/15 text-success",
                        step.state === "in_progress" &&
                          "bg-warning/15 text-warning",
                        step.state === "empty" &&
                          "bg-background text-muted-foreground",
                      )}
                    >
                      {step.state === "completed" ? (
                        <RiCheckLine size={18} aria-hidden />
                      ) : (
                        <Icon size={18} aria-hidden />
                      )}
                    </span>
                    <RiArrowRightSLine
                      size={18}
                      aria-hidden
                      className="text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5"
                    />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-xs/relaxed font-semibold text-foreground">
                      {step.label}
                    </span>
                    <span
                      className={cn(
                        "text-xs/relaxed",
                        step.state === "completed" && "text-success",
                        step.state === "in_progress" && "text-warning",
                        step.state === "empty" && "text-muted-foreground",
                      )}
                    >
                      {STATE_LABEL[step.state]}
                    </span>
                    <span className="text-xs/relaxed text-muted-foreground">
                      {step.updatedAt
                        ? formatDateTimeShort(step.updatedAt)
                        : "Sem atividade"}
                    </span>
                  </span>
                </button>
              </m.li>
            )
          })}
        </ul>
      </div>
    </LazyMotion>
  )
}
