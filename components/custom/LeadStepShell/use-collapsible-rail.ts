"use client"

import { useCallback, useEffect, useState } from "react"

const WIDE = "(min-width: 80rem)"

/**
 * `Ctrl/⌘ + B` recolhe e abre a coluna de oportunidades.
 *
 * O atalho é o mesmo do sidebar do app (`Sidebar.tsx:104`) e do painel mobile
 * (`MobileNavigation.tsx:191`), que escutam `window` em bubble. Enquanto o
 * dialog está aberto, quem manda é a coluna — ver `useCaptureShortcut`.
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

/**
 * Atalho `Ctrl/⌘ + <code>` capturado em `window`.
 *
 * Captura, e não bubble, porque `Sidebar.tsx` e `MobileNavigation.tsx` também
 * escutam `KeyB` em `window`, na fase de bubble. A captura roda antes de
 * qualquer bubble, então `preventDefault` + `stopPropagation` aqui é o que
 * impede o sidebar e o painel mobile de reagirem ao mesmo toque enquanto o
 * dialog está aberto. Fechado o dialog, nada é registrado e o atalho volta a
 * ser deles.
 *
 * `Shift` é recusado de propósito: `Ctrl + Shift + B` continua chegando inteiro
 * no sidebar, que não testa `shiftKey`.
 */
export function useCaptureShortcut({
  enabled,
  code,
  onMatch,
  allowInFields = false,
}: {
  enabled: boolean
  /** Código físico da tecla, ex. `"KeyB"`. */
  code: string
  onMatch: () => void
  /**
   * `true` para o atalho continuar valendo com o cursor num campo de texto —
   * o que um atalho de "sair daqui" precisa, e um de "abrir aquilo" não.
   */
  allowInFields?: boolean
}) {
  useEffect(() => {
    if (!enabled) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) return
      // `e.code`, não `e.key`: é o que os dois handlers do app testam, e casar
      // pelo código físico deixa os três de acordo em qualquer layout.
      if (e.code !== code) return
      if (e.shiftKey || e.altKey || !(e.ctrlKey || e.metaKey)) return
      if (!allowInFields) {
        const target = e.target as Element | null
        const tag = target?.tagName.toLowerCase() ?? ""
        if (["input", "textarea", "select"].includes(tag)) return
        // Sem o `target &&`, `target?.getAttribute(...)` devolve `undefined`,
        // `undefined !== null` é verdadeiro, e o atalho morreria calado.
        if (target && target.getAttribute("contenteditable") !== null) return
      }
      e.preventDefault()
      e.stopPropagation()
      onMatch()
    }
    window.addEventListener("keydown", onKeyDown, { capture: true })
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true })
  }, [enabled, code, onMatch, allowInFields])
}
