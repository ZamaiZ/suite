"use client"

import { useCallback, useEffect, useState } from "react"

const STORAGE_KEY = "gbp:opportunities-rail"
const WIDE = "(min-width: 80rem)"

/**
 * `Ctrl/⌘ + Shift + B`. O `Ctrl + B` puro já tem dois donos neste app —
 * `Sidebar.tsx` e `MobileNavigation.tsx` — e nenhum dos dois testa `shiftKey`,
 * então eles disparariam também no atalho com Shift. Os dois escutam `window`
 * em bubble; capturar aqui e parar a propagação é o que impede o sidebar e o
 * painel mobile de reagirem ao mesmo toque enquanto o dialog está aberto.
 */
export function useCollapsibleRail({ enabled }: { enabled: boolean }) {
  // Inicializador preguiçoso: `localStorage` e `matchMedia` nunca no render.
  // A preferência gravada vence sempre que existe; sem ela, aberta em `xl`.
  const [railOpen, setRailOpen] = useState(() => {
    if (typeof window === "undefined") return true
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === "open") return true
    if (stored === "closed") return false
    return window.matchMedia(WIDE).matches
  })

  const set = useCallback((next: boolean) => {
    setRailOpen(next)
    window.localStorage.setItem(STORAGE_KEY, next ? "open" : "closed")
  }, [])

  const toggle = useCallback(() => {
    setRailOpen((current) => {
      const next = !current
      window.localStorage.setItem(STORAGE_KEY, next ? "open" : "closed")
      return next
    })
  }, [])

  useEffect(() => {
    if (!enabled) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) return
      // `e.code`, não `e.key`: é exatamente o que os dois handlers do app
      // testam, e com Shift o `e.key` vira "B" em alguns layouts e não em
      // outros. Casar pelo código físico deixa os três de acordo.
      if (e.code !== "KeyB") return
      if (!e.shiftKey || !(e.ctrlKey || e.metaKey)) return
      const target = e.target as Element | null
      const tag = target?.tagName.toLowerCase() ?? ""
      if (["input", "textarea", "select"].includes(tag)) return
      // Sem o `target &&`, `target?.getAttribute(...)` devolve `undefined`,
      // `undefined !== null` é verdadeiro, e o atalho morreria calado.
      if (target && target.getAttribute("contenteditable") !== null) return
      e.preventDefault()
      e.stopPropagation()
      toggle()
    }
    window.addEventListener("keydown", onKeyDown, { capture: true })
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true })
  }, [enabled, toggle])

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
