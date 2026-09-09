"use client"

import { useState, useEffect, useCallback, type ReactNode } from "react"
import { useFormStatus } from "react-dom"
import { usePathname } from "next/navigation"
import { LazyMotion, domAnimation, useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { RiArrowLeftSLine, RiLogoutBoxLine } from "react-icons/ri"
import { cn } from "cn"
import { APP_MONOGRAM, APP_NAME } from "@/lib/brand"
import { logout } from "@/app/actions/logout"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/custom/ThemeToggle"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { NAV_ITEMS } from "@/components/custom/navigation"
import { NavTree } from "@/components/custom/NavTree"

const EXPANDED_W = 260
const COLLAPSED_W = 64
const STORAGE_KEY = "rankup-suite.sidebar.expanded"

const EASE = [0.23, 1, 0.32, 1] as const
const INSTANT = { duration: 0 }
const SIDEBAR_T = { duration: 0.22, ease: EASE }
const LABEL_T = (delay = 0) => ({ duration: 0.18, ease: EASE, delay })
const ICON_T = { duration: 0.22, ease: EASE }

function FormPendingSurface({ children }: { children?: ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <>
      {children}
      {pending ? (
        <span
          aria-busy
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[inherit]"
        >
          <span className="absolute inset-0 rounded-[inherit] bg-background/25 backdrop-blur-[2px] motion-reduce:backdrop-blur-none" />
          <Spinner aria-hidden className="size-4 relative text-foreground" />
        </span>
      ) : null}
    </>
  )
}

export function Sidebar() {
  const [expanded, setExpanded] = useState(true)
  const [live, setLive] = useState(false)
  const pathname = usePathname()
  const reduced = useReducedMotion()

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) setExpanded(stored === "true")

    let raf1: number, raf2: number
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setLive(true))
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [])

  const toggle = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) return
      if (!e.ctrlKey || e.code !== "KeyB") return
      if (!window.matchMedia("(min-width: 768px)").matches) return
      const target = e.target as Element
      const tag = target.tagName.toLowerCase()
      if (["input", "textarea", "select"].includes(tag)) return
      if (target.getAttribute("contenteditable") !== null) return
      e.preventDefault()
      toggle()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [toggle])

  const animate = live && !reduced

  const labelT = (delay = 0) => (animate ? LABEL_T(delay) : INSTANT)

  return (
    <LazyMotion features={domAnimation} strict>
      <m.aside
        aria-label="Navegação principal"
        className="relative z-nav h-dvh shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border"
        style={{ width: EXPANDED_W }}
        animate={{ width: expanded ? EXPANDED_W : COLLAPSED_W }}
        transition={animate ? SIDEBAR_T : INSTANT}
      >
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          onClick={toggle}
          aria-label={
            expanded ? "Recolher menu lateral" : "Expandir menu lateral"
          }
          title={expanded ? "Recolher (Ctrl+B)" : "Expandir (Ctrl+B)"}
          className={cn(
            "absolute top-3 right-0 translate-x-1/2 z-20",
            "rounded-full border-2 border-dashed border-sidebar-border bg-sidebar text-muted-foreground",
            "[transition:color_150ms_cubic-bezier(0.23,1,0.32,1),border-color_150ms_cubic-bezier(0.23,1,0.32,1),transform_100ms_ease-out]",
            "hover:border-primary hover:bg-sidebar-accent hover:text-foreground active:scale-95",
          )}
        >
          <m.span
            className="inline-flex"
            animate={{ rotate: expanded ? 0 : 180 }}
            transition={animate ? ICON_T : INSTANT}
          >
            <RiArrowLeftSLine size={16} aria-hidden />
          </m.span>
        </Button>

        <div
          role="img"
          aria-label={APP_NAME}
          className="relative flex h-14 shrink-0 items-center overflow-hidden border-b border-sidebar-border px-3"
        >
          <m.span
            aria-hidden
            className="overflow-hidden whitespace-nowrap font-heading text-xs/relaxed font-semibold tracking-widest text-muted-foreground uppercase select-none leading-none"
            animate={{
              maxWidth: expanded ? 220 : 0,
              opacity: expanded ? 1 : 0,
            }}
            transition={labelT()}
          >
            {APP_NAME}
          </m.span>
          <m.span
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center font-heading text-xs/relaxed font-semibold tracking-widest text-muted-foreground uppercase select-none leading-none"
            animate={{ opacity: expanded ? 0 : 1 }}
            transition={labelT()}
          >
            {APP_MONOGRAM}
          </m.span>
        </div>

        <nav className="flex-1 overflow-visible px-2 py-3">
          <NavTree
            items={NAV_ITEMS}
            pathname={pathname}
            density="sidebar"
            collapsed={!expanded}
            animate={animate}
          />
        </nav>

        <div className="shrink-0 border-t border-sidebar-border px-2 py-3 flex flex-col gap-1">
          {!expanded ? (
            <Tooltip>
              <TooltipTrigger render={<span className="block w-full" />}>
                <ThemeToggle className="h-10 w-full rounded-md" />
              </TooltipTrigger>
              <TooltipContent side="right">Tema</TooltipContent>
            </Tooltip>
          ) : (
            <ThemeToggle label="Tema" />
          )}

          <form action={logout} className="w-full">
            {!expanded ? (
              <Tooltip>
                <TooltipTrigger render={<span className="block w-full" />}>
                  <Button
                    type="submit"
                    variant="destructive"
                    size="lg"
                    aria-label="Sair"
                    className="relative h-10 w-full justify-center px-0"
                  >
                    <RiLogoutBoxLine size={18} aria-hidden />
                    <FormPendingSurface />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sair</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                type="submit"
                variant="destructive"
                size="lg"
                className="relative h-10 w-full justify-start gap-3 px-3"
              >
                <RiLogoutBoxLine size={18} aria-hidden />
                <FormPendingSurface>
                  <m.span
                    className="overflow-hidden whitespace-nowrap leading-none"
                    animate={{
                      maxWidth: expanded ? 200 : 0,
                      opacity: expanded ? 1 : 0,
                    }}
                    transition={labelT()}
                  >
                    Sair
                  </m.span>
                </FormPendingSurface>
              </Button>
            )}
          </form>
        </div>
      </m.aside>
    </LazyMotion>
  )
}
