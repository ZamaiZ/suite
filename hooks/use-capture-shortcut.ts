"use client"

import { useEffect } from "react"

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
 * A paleta de comandos depende da mesma fase por outro motivo: o `cmdk` liga
 * `vimBindings` por padrão e trata `Ctrl+K` como "subir na lista". A captura
 * roda antes, então `Ctrl+K` com a paleta aberta fecha a paleta em vez de
 * mover o cursor.
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
