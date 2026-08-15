import { RiHomeLine, RiSettings3Line, RiUserSearchLine } from "react-icons/ri"
import type { NavGroup, NavItem } from "./navigation.types"

export function isHrefActive(pathname: string, href: string) {
  if (!href) return false
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function isGroupActive(pathname: string, group: NavGroup) {
  return group.children.some(
    (child) => !child.disabled && isHrefActive(pathname, child.href),
  )
}

export const NAV_ITEMS: NavItem[] = [
  {
    kind: "leaf",
    label: "Home",
    href: "/",
    icon: RiHomeLine,
    description: "Visão geral e atividade recente",
  },
  {
    kind: "leaf",
    label: "Leads",
    href: "/leads",
    icon: RiUserSearchLine,
    description: "Cadastro, fila e primeiro contato",
  },
  {
    kind: "leaf",
    label: "Equipe",
    href: "/settings/team",
    icon: RiSettings3Line,
    description: "Papéis e acesso",
  },
]
