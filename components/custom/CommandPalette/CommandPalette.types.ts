import type { NavLeaf } from "@/components/custom/navigation.types"

export type PaletteRow = {
  leaf: NavLeaf
  /** Tudo que casa na busca: rótulo, descrição, grupo e a própria rota. */
  keywords: string[]
}

export type PaletteSection = {
  id: string
  /** Ausente no grupo das folhas de topo, que não tem título. */
  heading?: string
  rows: PaletteRow[]
}

export type CommandPaletteTriggerProps = {
  collapsed?: boolean
  className?: string
}
