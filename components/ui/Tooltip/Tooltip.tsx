"use client"

import React, { useEffect, useId, useRef, useState } from "react"
import { AnimatePresence, LazyMotion, domAnimation, useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { cn } from "@/lib/cn"
import type { TooltipProps, TooltipSide, TooltipTone } from "./Tooltip.types"

const WRAPPER_POSITION: Record<TooltipSide, string> = {
  top:    "bottom-full left-1/2 -translate-x-1/2 flex-col-reverse items-center",
  right:  "left-full top-1/2 -translate-y-1/2 flex-row items-center",
  bottom: "top-full left-1/2 -translate-x-1/2 flex-col items-center",
  left:   "right-full top-1/2 -translate-y-1/2 flex-row-reverse items-center",
}

const TRANSFORM_ORIGIN: Record<TooltipSide, string> = {
  top:    "bottom center",
  right:  "left center",
  bottom: "top center",
  left:   "right center",
}

const TONE_CSS_VAR: Record<TooltipTone, string> = {
  accent:  "color-mix(in oklch, var(--accent) 25%, transparent)",
  danger:  "color-mix(in oklch, var(--danger) 25%, transparent)",
  success: "color-mix(in oklch, var(--success) 25%, transparent)",
  warning: "color-mix(in oklch, var(--warning) 25%, transparent)",
}

const TONE_BORDER_CLASS: Record<TooltipTone, string> = {
  accent:  "border-accent/25",
  danger:  "border-danger/25",
  success: "border-success/25",
  warning: "border-warning/25",
}

function arrowStyle(side: TooltipSide, color: string): React.CSSProperties {
  const base = { width: 0, height: 0, borderStyle: "solid" as const }
  switch (side) {
    case "top":    return { ...base, borderWidth: "5px 5px 0",     borderColor: `${color} transparent transparent transparent` }
    case "right":  return { ...base, borderWidth: "5px 5px 5px 0", borderColor: `transparent ${color} transparent transparent` }
    case "bottom": return { ...base, borderWidth: "0 5px 5px",     borderColor: `transparent transparent ${color} transparent` }
    case "left":   return { ...base, borderWidth: "5px 0 5px 5px", borderColor: `transparent transparent transparent ${color}` }
  }
}

const EASE = [0.23, 1, 0.32, 1] as const
const OPEN_DELAY = 250

const VARIANTS = {
  enter:   { opacity: 0, scale: 0.96, filter: "blur(1px)" },
  visible: {
    opacity: 1, scale: 1, filter: "blur(0px)",
    transition: { duration: 0.18, ease: EASE },
  },
  exit: {
    opacity: 0, scale: 0.97, filter: "blur(1px)",
    transition: { duration: 0.14, ease: EASE },
  },
}

const VARIANTS_REDUCED = {
  enter:   { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit:    { opacity: 0, transition: { duration: 0.12 } },
}

export function Tooltip({
  content,
  side = "top",
  arrow = true,
  tone = "accent",
  wrapperClassName,
  className,
  children,
}: TooltipProps) {
  const [open, setOpen] = useState(false)
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reduced = useReducedMotion()
  const id = useId()

  function clearOpenTimer() {
    if (openTimer.current === null) return
    clearTimeout(openTimer.current)
    openTimer.current = null
  }

  function show() {
    clearOpenTimer()
    openTimer.current = setTimeout(() => {
      setOpen(true)
      openTimer.current = null
    }, OPEN_DELAY)
  }

  function hide() {
    clearOpenTimer()
    setOpen(false)
  }

  useEffect(() => clearOpenTimer, [])

  const augmented = React.cloneElement(
    children as React.ReactElement<{ "aria-describedby"?: string }>,
    { "aria-describedby": open ? id : undefined },
  )

  return (
    <LazyMotion features={domAnimation} strict>
      <span
        className={cn("relative inline-flex", wrapperClassName)}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocusCapture={show}
        onBlurCapture={hide}
      >
        {augmented}
        <AnimatePresence>
          {open && (
            <m.span
              id={id}
              role="tooltip"
              className={cn(
                "pointer-events-none absolute z-50 flex",
                WRAPPER_POSITION[side],
              )}
              variants={reduced ? VARIANTS_REDUCED : VARIANTS}
              initial="enter"
              animate="visible"
              exit="exit"
              style={{ transformOrigin: TRANSFORM_ORIGIN[side] }}
            >
              {arrow && <span aria-hidden style={arrowStyle(side, TONE_CSS_VAR[tone])} />}
              <span
                className={cn(
                  "whitespace-nowrap rounded-md border bg-elevated",
                  TONE_BORDER_CLASS[tone],
                  "px-2.5 py-1 font-sans text-body-sm text-fg shadow-raised",
                  className,
                )}
              >
                {content}
              </span>
            </m.span>
          )}
        </AnimatePresence>
      </span>
    </LazyMotion>
  )
}
