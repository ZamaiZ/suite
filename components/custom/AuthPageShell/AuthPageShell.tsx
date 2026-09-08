"use client"

import { LazyMotion, domAnimation, useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { RiLockLine } from "react-icons/ri"
import { ThemeToggle } from "@/components/custom/ThemeToggle"
import { APP_NAME } from "@/lib/brand"
import type { AuthPageShellProps } from "./AuthPageShell.types"

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1]

const D = {
  glowA: 0.0,
  glowB: 0.06,
  brand: 0.1,
  toggle: 0.1,
  badge: 0.22,
  title: 0.32,
  desc: 0.42,
  card: 0.5,
}

type Cfg = { reduced: boolean }

function makeVariants({ reduced }: Cfg) {
  const skip = (v: object) => (reduced ? {} : v)
  const fade = (delay: number, duration = 0.28) => ({
    transition: {
      duration: reduced ? 0.15 : duration,
      ease: EASE,
      delay: reduced ? 0 : delay,
    },
  })

  return {
    glowA: {
      hidden: { opacity: 0, scale: 0.7 },
      visible: {
        ...skip({ opacity: 0.45, scale: 1 }),
        opacity: reduced ? 0.45 : undefined,
        ...fade(D.glowA, 0.9),
      },
    },
    glowB: {
      hidden: { opacity: 0, scale: 0.7 },
      visible: {
        ...skip({ opacity: 0.28, scale: 1 }),
        opacity: reduced ? 0.28 : undefined,
        ...fade(D.glowB, 0.9),
      },
    },
    brand: {
      hidden: { opacity: 0, x: reduced ? 0 : -14 },
      visible: { opacity: 1, x: 0, ...fade(D.brand, 0.26) },
    },
    toggle: {
      hidden: { opacity: 0, x: reduced ? 0 : 14 },
      visible: { opacity: 1, x: 0, ...fade(D.toggle, 0.26) },
    },
    badge: {
      hidden: { opacity: 0, y: reduced ? 0 : 10, scale: reduced ? 1 : 0.93 },
      visible: { opacity: 1, y: 0, scale: 1, ...fade(D.badge, 0.28) },
    },
    title: {
      hidden: {
        opacity: 0,
        y: reduced ? 0 : 16,
        filter: reduced ? "blur(0px)" : "blur(3px)",
      },
      visible: { opacity: 1, y: 0, filter: "blur(0px)", ...fade(D.title, 0.3) },
    },
    desc: {
      hidden: { opacity: 0, y: reduced ? 0 : 10 },
      visible: { opacity: 1, y: 0, ...fade(D.desc, 0.28) },
    },
    card: {
      hidden: { opacity: 0, y: reduced ? 0 : 24, scale: reduced ? 1 : 0.97 },
      visible: { opacity: 1, y: 0, scale: 1, ...fade(D.card, 0.34) },
    },
  }
}

export function AuthPageShell({
  title,
  description,
  children,
}: AuthPageShellProps) {
  const reduced = !!useReducedMotion()
  const V = makeVariants({ reduced })

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="relative min-h-dvh overflow-hidden bg-background">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 select-none"
        >
          <m.div
            variants={V.glowA}
            initial="hidden"
            animate="visible"
            className="absolute -top-40 -right-40 size-[560px] rounded-full"
            style={{
              background:
                "radial-gradient(circle at center, color-mix(in oklch, var(--primary) 12%, transparent) 0%, transparent 70%)",
            }}
          />
          <m.div
            variants={V.glowB}
            initial="hidden"
            animate="visible"
            className="absolute -bottom-56 -left-32 size-[480px] rounded-full"
            style={{
              background:
                "radial-gradient(circle at center, color-mix(in oklch, var(--primary) 12%, transparent) 0%, transparent 70%)",
            }}
          />
        </div>

        <header className="relative z-10 flex h-14 items-center justify-between px-[var(--page-padding-x)]">
          <m.span
            variants={V.brand}
            initial="hidden"
            animate="visible"
            className="font-heading text-xs/relaxed font-semibold tracking-widest text-muted-foreground uppercase select-none"
          >
            {APP_NAME}
          </m.span>
          <m.div variants={V.toggle} initial="hidden" animate="visible">
            <ThemeToggle />
          </m.div>
        </header>

        <main className="relative z-10 flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-[var(--page-padding-x)] py-10">
          <div className="w-full max-w-[26rem] flex flex-col gap-4">
            <m.div
              variants={V.badge}
              initial="hidden"
              animate="visible"
              className="flex items-center gap-2"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs/relaxed font-medium text-muted-foreground shadow-xs">
                <RiLockLine size={12} aria-hidden className="text-primary" />
                Acesso interno
              </span>
            </m.div>

            <m.h1
              variants={V.title}
              initial="hidden"
              animate="visible"
              className="font-heading text-2xl font-semibold tracking-tight leading-tight text-foreground"
            >
              {title}
            </m.h1>

            <m.p
              variants={V.desc}
              initial="hidden"
              animate="visible"
              className="text-sm text-muted-foreground leading-normal -mt-4"
            >
              {description}
            </m.p>

            <m.div variants={V.card} initial="hidden" animate="visible">
              <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-xs">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-px card-highlight"
                  style={{
                    background:
                      "linear-gradient(to right, transparent, color-mix(in oklch, var(--primary) 12%, transparent), transparent)",
                  }}
                />
                {children}
              </div>
            </m.div>
          </div>
        </main>
      </div>
    </LazyMotion>
  )
}
