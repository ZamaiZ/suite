"use client"

import { useSyncExternalStore } from "react"

/**
 * Estado da paleta num store de módulo, e não num provider.
 *
 * O gatilho mora na `Sidebar` e o diálogo mora no layout protegido: duas
 * subárvores irmãs. O padrão da casa para isso é o store de módulo com
 * `useSyncExternalStore` — ver `sidebarStore` em `Sidebar.tsx`.
 *
 * `pendingHref` vive aqui junto com `open` de propósito: assim o efeito que
 * fecha a paleta quando a rota chega mexe só no store, sem `setState` dentro
 * de `useEffect`.
 */
export type CommandPaletteState = {
  open: boolean
  /** Rota escolhida cuja navegação ainda não chegou — é onde vai o spinner. */
  pendingHref: string | null
}

const CLOSED: CommandPaletteState = { open: false, pendingHref: null }

// `useSyncExternalStore` exige snapshot estável: o objeto só é trocado quando
// algo de fato muda, senão o React entra em laço de re-render.
let state: CommandPaletteState = CLOSED
const listeners = new Set<() => void>()

function commit(next: CommandPaletteState) {
  if (next.open === state.open && next.pendingHref === state.pendingHref) return
  state = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return state
}

function getServerSnapshot() {
  return CLOSED
}

export function openCommandPalette() {
  commit({ open: true, pendingHref: null })
}

export function closeCommandPalette() {
  commit(CLOSED)
}

export function toggleCommandPalette() {
  if (state.open) closeCommandPalette()
  else openCommandPalette()
}

export function setCommandPaletteOpen(next: boolean) {
  if (next) openCommandPalette()
  else closeCommandPalette()
}

/** Marca a rota escolhida sem fechar: a paleta segura o spinner até chegar. */
export function startCommandPaletteNavigation(href: string) {
  commit({ open: true, pendingHref: href })
}

export function useCommandPaletteState() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
