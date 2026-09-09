"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import Link, { useLinkStatus } from "next/link"
import { useFormStatus } from "react-dom"
import { usePathname } from "next/navigation"
import { AnimatePresence, useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import {
  RiHomeLine,
  RiMenuLine,
  RiUser3Line,
  RiLogoutBoxLine,
} from "react-icons/ri"
import { cn } from "cn"
import { logout } from "@/app/actions/logout"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/custom/ThemeToggle"
import { NAV_ITEMS } from "@/components/custom/navigation"
import { NavTree } from "@/components/custom/NavTree"
import type { MobilePanel } from "./MobileNavigation.types"

const EASE = [0.23, 1, 0.32, 1] as const

const SHEET_VARIANTS = {
  hidden: { opacity: 0, y: "100%" },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE } },
  exit: { opacity: 0, y: "100%", transition: { duration: 0.16, ease: EASE } },
}

const SHEET_REDUCED = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
}

const POPOVER_VARIANTS = {
  hidden: { opacity: 0, scale: 0.96, y: 6 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.18, ease: EASE },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 6,
    transition: { duration: 0.13, ease: EASE },
  },
}

const POPOVER_REDUCED = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.12 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
}

const SCRIM_VARIANTS = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
}

const PROFILE_PANEL_ID = "mobile-profile-panel"
const PAGES_PANEL_ID = "mobile-pages-panel"

const DOCK_BOTTOM = "calc(0.75rem + env(safe-area-inset-bottom))"
const PANEL_BOTTOM = "calc(5.5rem + env(safe-area-inset-bottom))"

function HomePendingSurface({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus()
  return (
    <>
      {children}
      {pending ? (
        <span
          aria-busy
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[inherit]"
        >
          <span className="absolute inset-0 rounded-[inherit] bg-background/25 backdrop-blur-[2px] motion-reduce:backdrop-blur-none" />
          <Spinner aria-hidden className="size-5 relative text-foreground" />
        </span>
      ) : null}
    </>
  )
}

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

function usePanelFocusTrap(
  panelRef: React.RefObject<HTMLElement | null>,
  active: boolean,
) {
  useEffect(() => {
    if (!active || !panelRef.current) return
    const el = panelRef.current

    const getFocusable = () =>
      [
        ...el.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((n) => !n.closest('[aria-disabled="true"]'))

    getFocusable()[0]?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return
      const focusable = getFocusable()
      if (!focusable.length) {
        e.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    el.addEventListener("keydown", onKeyDown)
    return () => el.removeEventListener("keydown", onKeyDown)
  }, [active, panelRef])
}

export function MobileNavigation() {
  const [panel, setPanel] = useState<MobilePanel>("none")
  const pathname = usePathname()
  const reduced = useReducedMotion()

  const profileBtnRef = useRef<HTMLButtonElement>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const profilePanelRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  const close = useCallback((restoreFocus = true) => {
    setPanel((prev) => {
      if (restoreFocus) {
        const trigger =
          prev === "profile"
            ? profileBtnRef.current
            : prev === "pages"
              ? menuBtnRef.current
              : null
        if (trigger) requestAnimationFrame(() => trigger.focus())
      }
      return "none"
    })
  }, [])

  const togglePanel = useCallback((p: Exclude<MobilePanel, "none">) => {
    setPanel((prev) => (prev === p ? "none" : p))
  }, [])

  // Ajuste de estado quando a prop muda: no render, não em efeito.
  const [syncedPathname, setSyncedPathname] = useState(pathname)
  if (syncedPathname !== pathname) {
    setSyncedPathname(pathname)
    setPanel("none")
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) return
      if (e.ctrlKey && e.code === "KeyB") {
        const target = e.target as Element
        const tag = target.tagName.toLowerCase()
        if (["input", "textarea", "select"].includes(tag)) return
        if (target.getAttribute("contenteditable") !== null) return
        e.preventDefault()
        togglePanel("pages")
        return
      }
      if (e.key === "Escape" && panel !== "none") close(true)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [panel, close, togglePanel])

  useEffect(() => {
    if (panel !== "pages") return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [panel])

  usePanelFocusTrap(profilePanelRef, panel === "profile")
  usePanelFocusTrap(sheetRef, panel === "pages")

  const isHome = pathname === "/"
  const sheetVars = reduced ? SHEET_REDUCED : SHEET_VARIANTS
  const popoverVars = reduced ? POPOVER_REDUCED : POPOVER_VARIANTS

  return (
    <>
      <AnimatePresence>
        {panel === "pages" && (
          <m.div
            key="scrim"
            variants={SCRIM_VARIANTS}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-scrim bg-foreground/45"
            aria-hidden
            onClick={() => close(true)}
          />
        )}
      </AnimatePresence>

      {panel === "profile" && (
        <div
          className="fixed inset-0 z-scrim"
          aria-hidden
          onClick={() => close(true)}
        />
      )}

      <AnimatePresence>
        {panel === "profile" && (
          <m.div
            ref={profilePanelRef}
            key="profile-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Conta"
            id={PROFILE_PANEL_ID}
            variants={popoverVars}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              "fixed left-3 z-overlay w-56",
              "bg-popover/90 backdrop-blur-xl",
              "border border-border",
              "rounded-2xl shadow-md",
              "p-1.5",
            )}
            style={{
              bottom: PANEL_BOTTOM,
              transformOrigin: "bottom left",
            }}
          >
            <div className="px-3 py-2.5 select-none">
              <p className="text-xs/relaxed font-semibold text-foreground leading-none">
                Conta
              </p>
              <p className="text-xs/relaxed text-muted-foreground mt-1 leading-none">
                Preferências da sessão
              </p>
            </div>

            <div className="mx-1.5 my-1 h-px bg-border/70" />

            <ThemeToggle label="Alternar tema" className="rounded-xl" />

            <form action={logout}>
              <Button
                type="submit"
                variant="ghost"
                size="lg"
                className={cn(
                  "relative w-full flex items-center gap-3 h-11 px-3 rounded-xl",
                  "text-xs/relaxed font-medium text-destructive",
                  "hover:bg-destructive/10",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  "[transition:background-color_150ms_ease-out,transform_100ms_ease-out]",
                  "active:scale-[0.97]",
                )}
              >
                <FormPendingSurface>
                  <RiLogoutBoxLine size={17} aria-hidden className="shrink-0" />
                  Sair
                </FormPendingSurface>
              </Button>
            </form>
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {panel === "pages" && (
          <m.div
            ref={sheetRef}
            key="pages-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Navegação"
            id={PAGES_PANEL_ID}
            variants={sheetVars}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              "fixed left-3 right-3 z-overlay",
              "bg-popover/90 backdrop-blur-xl",
              "border border-border",
              "rounded-2xl shadow-md",
              "overflow-hidden flex flex-col",
            )}
            style={{
              bottom: PANEL_BOTTOM,
              maxHeight:
                "min(calc(100dvh - 9rem - env(safe-area-inset-top) - env(safe-area-inset-bottom)), 520px)",
            }}
          >
            <div className="flex justify-center pt-3 pb-0.5 pointer-events-none select-none shrink-0">
              <div className="w-9 h-1 rounded-full bg-border" />
            </div>

            <div className="px-5 pt-2.5 pb-4 select-none shrink-0">
              <p className="font-heading text-xl font-semibold text-foreground tracking-tight">
                Navegação
              </p>
              <p className="text-xs/relaxed text-muted-foreground mt-0.5">
                Acesse as áreas da suite
              </p>
            </div>

            <div className="min-h-0 overflow-y-auto overscroll-contain px-3 pb-4">
              <NavTree items={NAV_ITEMS} pathname={pathname} density="sheet" />
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <nav
        aria-label="Navegação móvel"
        className="fixed left-3 right-3 z-50"
        style={{ bottom: DOCK_BOTTOM }}
      >
        <div
          className={cn(
            "relative grid grid-cols-3 items-center h-[68px]",
            "bg-sidebar/80 backdrop-blur-xl",
            "border border-sidebar-border rounded-2xl shadow-md",
            "px-3",
          )}
        >
          <div className="flex justify-start">
            <Button
              ref={profileBtnRef}
              type="button"
              variant="ghost"
              size="icon-lg"
              onClick={() => togglePanel("profile")}
              aria-label={
                panel === "profile" ? "Fechar perfil" : "Abrir perfil"
              }
              aria-expanded={panel === "profile"}
              aria-controls={PROFILE_PANEL_ID}
              className={cn(
                "size-11 rounded-xl flex items-center justify-center",
                "[transition:background-color_150ms_cubic-bezier(0.23,1,0.32,1),color_150ms_cubic-bezier(0.23,1,0.32,1),transform_100ms_ease-out]",
                "hover:bg-accent hover:text-foreground active:scale-[0.93]",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                panel === "profile"
                  ? "bg-sidebar-accent text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <RiUser3Line size={21} aria-hidden />
            </Button>
          </div>

          <div className="flex justify-center">
            <Link
              href="/"
              aria-label="Ir para o início"
              aria-current={isHome ? "page" : undefined}
              className={cn(
                "relative flex items-center justify-center",
                "size-[58px] rounded-[18px]",
                "-translate-y-[14px]",
                "shadow-md",
                "[transition:background-color_160ms_cubic-bezier(0.23,1,0.32,1),color_160ms_cubic-bezier(0.23,1,0.32,1),transform_110ms_ease-out]",
                "active:scale-[0.92]",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                isHome
                  ? "bg-primary text-primary-foreground"
                  : "bg-popover border border-border text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <HomePendingSurface>
                <RiHomeLine size={23} aria-hidden />
              </HomePendingSurface>
            </Link>
          </div>

          <div className="flex justify-end">
            <Button
              ref={menuBtnRef}
              type="button"
              variant="ghost"
              size="icon-lg"
              onClick={() => togglePanel("pages")}
              aria-label={
                panel === "pages" ? "Fechar navegação" : "Abrir navegação"
              }
              aria-expanded={panel === "pages"}
              aria-controls={PAGES_PANEL_ID}
              className={cn(
                "size-11 rounded-xl flex items-center justify-center",
                "[transition:background-color_150ms_cubic-bezier(0.23,1,0.32,1),color_150ms_cubic-bezier(0.23,1,0.32,1),transform_100ms_ease-out]",
                "hover:bg-accent hover:text-foreground active:scale-[0.93]",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                panel === "pages"
                  ? "bg-sidebar-accent text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <RiMenuLine size={21} aria-hidden />
            </Button>
          </div>
        </div>
      </nav>
    </>
  )
}
