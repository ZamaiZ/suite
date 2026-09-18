"use client"

import { useCallback, useEffect, useState } from "react"
import { useCaptureShortcut } from "@/hooks/use-capture-shortcut"

const WIDE = "(min-width: 80rem)"

/**
 * `Ctrl/⌘ + B` recolhe e abre a coluna de oportunidades.
 *
 * O atalho é o mesmo do sidebar do app (`Sidebar.tsx:104`) e do painel mobile
 * (`MobileNavigation.tsx:191`), que escutam `window` em bubble. Enquanto o
 * dialog está aberto, quem manda é a coluna — ver `@/hooks/use-capture-shortcut`.
 */
export function useCollapsibleRail({
  enabled,
  storageKey,
}: {
  enabled: boolean
  /** Chave de `localStorage` da etapa. Cada etapa tem a sua: recolher a coluna
   *  no GBP não deve recolher no Website — a densidade das duas é diferente. */
  storageKey: string
}) {
  // Inicializador preguiçoso: `localStorage` e `matchMedia` nunca no render.
  // A preferência gravada vence sempre que existe; sem ela, aberta em `xl`.
  const [railOpen, setRailOpen] = useState(() => {
    if (typeof window === "undefined") return true
    const stored = window.localStorage.getItem(storageKey)
    if (stored === "open") return true
    if (stored === "closed") return false
    return window.matchMedia(WIDE).matches
  })

  const set = useCallback(
    (next: boolean) => {
      setRailOpen(next)
      window.localStorage.setItem(storageKey, next ? "open" : "closed")
    },
    [storageKey],
  )

  const toggle = useCallback(() => {
    setRailOpen((current) => {
      const next = !current
      window.localStorage.setItem(storageKey, next ? "open" : "closed")
      return next
    })
  }, [storageKey])

  useCaptureShortcut({ enabled, code: "KeyB", onMatch: toggle })

  return {
    railOpen,
    toggle,
    open: useCallback(() => set(true), [set]),
    close: useCallback(() => set(false), [set]),
  }
}

/** `true` quando a viewport comporta a coluna como coluna. */
export function useWideViewport() {
  const [wide, setWide] = useState(() => {
    if (typeof window === "undefined") return true
    return window.matchMedia(WIDE).matches
  })
  useEffect(() => {
    const query = window.matchMedia(WIDE)
    const onChange = (event: MediaQueryListEvent) => setWide(event.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])
  return wide
}
