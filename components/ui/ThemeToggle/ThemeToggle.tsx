"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { AnimatePresence, LazyMotion, domAnimation, useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { RiComputerLine, RiSunLine, RiMoonLine } from "react-icons/ri"
import { cn } from "@/lib/cn"
import { nextTheme } from "@/lib/theme"
import type { ThemeValue } from "@/lib/theme"
import type { ThemeToggleProps } from "./ThemeToggle.types"

const THEME_META: Record<ThemeValue, { Icon: React.ComponentType<{ size: number; "aria-hidden": boolean }>; label: string; next: string }> = {
  system: { Icon: RiComputerLine, label: "Tema do sistema",  next: "claro"   },
  light:  { Icon: RiSunLine,      label: "Tema claro",       next: "escuro"  },
  dark:   { Icon: RiMoonLine,     label: "Tema escuro",      next: "sistema" },
}

/* ── Icon animation — crossfade with scale and directional blur ─────────── */
const ICON_VARIANTS = {
  enter: { opacity: 0, scale: 0.88, filter: "blur(2px)", rotate: -20 },
  center: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    rotate: 0,
    transition: { duration: 0.18, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] },
  },
  exit: {
    opacity: 0,
    scale: 0.88,
    filter: "blur(2px)",
    rotate: 20,
    transition: { duration: 0.12, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] },
  },
}

const ICON_VARIANTS_REDUCED = {
  enter:  { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.15 } },
  exit:   { opacity: 0, transition: { duration: 0.1  } },
}

const SPRING = { type: "spring", stiffness: 320, damping: 24 } as const

export function ThemeToggle({ className, label, "aria-describedby": ariaDescribedby }: ThemeToggleProps) {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const reduced = useReducedMotion()

  useEffect(() => { setMounted(true) }, [])

  const current = (mounted ? (theme as ThemeValue | undefined) ?? "system" : "system")
  const meta    = THEME_META[current]
  const hasLabel = Boolean(label)

  function cycle() {
    setTheme(nextTheme(current))
  }

  const iconVariants = reduced ? ICON_VARIANTS_REDUCED : ICON_VARIANTS

  return (
    <LazyMotion features={domAnimation} strict>
      <m.button
        type="button"
        onClick={mounted ? cycle : undefined}
        aria-label={mounted ? `${meta.label}. Alterar para ${meta.next}` : "Alternar tema"}
        aria-describedby={ariaDescribedby}
        whileHover={reduced || hasLabel ? undefined : { scale: 1.06 }}
        whileTap={reduced || hasLabel ? undefined : { scale: 0.94 }}
        transition={SPRING}
        className={cn(
          "relative inline-flex items-center cursor-pointer",
          "text-fg-muted",
          "[transition:color_150ms_cubic-bezier(0.23,1,0.32,1),background-color_150ms_cubic-bezier(0.23,1,0.32,1),box-shadow_150ms_cubic-bezier(0.23,1,0.32,1)]",
          "hover:bg-hover hover:text-fg",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          hasLabel
            ? "h-10 w-full justify-start gap-3 px-3 rounded-md active:scale-[0.97]"
            : "justify-center size-11 rounded-full hover:shadow-card",
          className,
        )}
      >
        {!hasLabel && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            style={{
              background: "radial-gradient(circle at center, var(--accent-subtle) 0%, transparent 75%)",
            }}
          />
        )}

        {/* Icon slot — fixed size prevents layout shift before mount */}
        <span className="relative inline-flex shrink-0 size-5 items-center justify-center">
          {mounted && (
            <AnimatePresence mode="wait" initial={false}>
              <m.span
                key={current}
                variants={iconVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="absolute inline-flex"
              >
                <meta.Icon size={20} aria-hidden />
              </m.span>
            </AnimatePresence>
          )}
        </span>

        {hasLabel && (
          <span className="font-sans text-body-sm leading-none">
            {label}
          </span>
        )}
      </m.button>
    </LazyMotion>
  )
}
