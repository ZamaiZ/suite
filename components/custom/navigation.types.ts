import type React from "react"

export type NavLeaf = {
  kind: "leaf"
  label: string
  href: string
  icon?: React.ElementType
  description?: string
  disabled?: boolean
  /**
   * Esconde a folha da paleta de comandos, sem tirá-la da sidebar.
   *
   * Para página que é conteúdo de consulta, não destino de navegação rápida:
   * ela infla a lista e empurra para baixo o que se busca de verdade.
   */
  hiddenInPalette?: boolean
}

export type NavGroup = {
  kind: "group"
  id: string
  label: string
  icon: React.ElementType
  description?: string
  children: NavLeaf[]
}

export type NavItem = NavLeaf | NavGroup
