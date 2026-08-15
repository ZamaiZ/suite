import type { NavItem } from "@/components/custom/navigation.types"

export type NavTreeDensity = "sidebar" | "sheet"

export type NavTreeProps = {
  items: NavItem[]
  pathname: string
  density: NavTreeDensity
  collapsed?: boolean
  animate?: boolean
}
