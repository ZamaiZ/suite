"use client"

import { AnimatePresence, useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { RiCheckLine } from "react-icons/ri"
import { cn } from "cn"
import type { StepperProps } from "./Stepper.types"

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1]

export function Stepper({
  steps,
  currentIndex,
  highestReachedIndex,
  onStepSelect,
  orientation = "horizontal",
  className,
}: StepperProps) {
  const reduced = !!useReducedMotion()
  const count = Math.max(steps.length, 1)
  const progress = (currentIndex + 0.5) / count
  const fillTransition = reduced
    ? { duration: 0.12, ease: EASE }
    : { duration: 0.48, ease: EASE }
  const isVertical = orientation === "vertical"

  return (
    <nav aria-label="Etapas" className={cn("w-full", className)}>
      <ol
        className={cn(
          "relative",
          isVertical ? "flex flex-col gap-4" : "flex items-start",
        )}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute rounded-full bg-border",
            isVertical
              ? "top-0 bottom-0 left-4 w-1"
              : "top-4 right-0 left-0 h-1",
          )}
        />
        <m.div
          aria-hidden
          className={cn(
            "pointer-events-none absolute rounded-full bg-primary",
            isVertical
              ? "top-0 left-4 w-1 origin-top"
              : "top-4 left-0 h-1 origin-left",
          )}
          style={isVertical ? { height: "100%" } : { width: "100%" }}
          initial={isVertical ? { scaleY: 0 } : { scaleX: 0 }}
          animate={isVertical ? { scaleY: progress } : { scaleX: progress }}
          transition={fillTransition}
        />

        {steps.map((step, index) => {
          const isCurrent = index === currentIndex
          const isComplete = index < currentIndex
          const isFilled = isCurrent || isComplete
          const isReachable = index <= highestReachedIndex
          const isUpcoming = !isReachable

          return (
            <li
              key={step.id}
              className={cn(
                "relative z-10 flex gap-3",
                isVertical
                  ? "items-center"
                  : "flex-1 flex-col items-center gap-2",
              )}
            >
              <button
                type="button"
                disabled={isUpcoming}
                aria-current={isCurrent ? "step" : undefined}
                aria-disabled={isUpcoming || undefined}
                onClick={() => {
                  if (isReachable) onStepSelect(index)
                }}
                className={cn(
                  "relative flex size-9 shrink-0 items-center justify-center rounded-full text-xs/relaxed font-semibold",
                  "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  isFilled && "text-primary-foreground",
                  isCurrent && "ring-2 ring-primary/25 shadow-xs",
                  isComplete && "hover:brightness-95",
                  !isFilled &&
                    isReachable &&
                    "border border-border bg-card text-muted-foreground hover:bg-accent",
                  isUpcoming &&
                    "cursor-not-allowed border border-border bg-card text-muted-foreground",
                  isReachable &&
                    !isUpcoming &&
                    "cursor-pointer active:scale-[0.96]",
                )}
              >
                {isFilled ? (
                  <m.span
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-primary"
                    initial={
                      reduced ? { opacity: 1 } : { opacity: 0, scale: 0.92 }
                    }
                    animate={{ opacity: 1, scale: 1 }}
                    transition={fillTransition}
                  />
                ) : null}
                <span className="relative z-10 flex items-center justify-center">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {isComplete ? (
                      <m.span
                        key="check"
                        initial={
                          reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92 }
                        }
                        animate={{ opacity: 1, scale: 1 }}
                        exit={
                          reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92 }
                        }
                        transition={{
                          duration: reduced ? 0.12 : 0.2,
                          ease: EASE,
                        }}
                        className="flex"
                      >
                        <RiCheckLine size={16} aria-hidden />
                      </m.span>
                    ) : (
                      <m.span
                        key="number"
                        initial={
                          reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92 }
                        }
                        animate={{ opacity: 1, scale: 1 }}
                        exit={
                          reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92 }
                        }
                        transition={{
                          duration: reduced ? 0.12 : 0.2,
                          ease: EASE,
                        }}
                      >
                        {index + 1}
                      </m.span>
                    )}
                  </AnimatePresence>
                </span>
              </button>
              <button
                type="button"
                disabled={isUpcoming}
                onClick={() => {
                  if (isReachable) onStepSelect(index)
                }}
                className={cn(
                  "border-0 bg-transparent p-0 text-xs/relaxed leading-tight",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  isVertical
                    ? "text-left"
                    : "max-w-[5.5rem] text-center sm:max-w-none",
                  isCurrent
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground",
                  isUpcoming && "cursor-not-allowed opacity-60",
                  isReachable && !isUpcoming && "cursor-pointer",
                  !isVertical && !isCurrent && "hidden sm:block",
                )}
              >
                {step.label}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
