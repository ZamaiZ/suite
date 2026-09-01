import {
  RiBriefcaseLine,
  RiGroupLine,
  RiHomeLine,
  RiSettings3Line,
  RiStore2Line,
  RiToolsLine,
  RiUserSearchLine,
} from "react-icons/ri"
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
    kind: "group",
    id: "crm",
    label: "CRM",
    icon: RiBriefcaseLine,
    description: "Leads e clientes",
    children: [
      {
        kind: "leaf",
        label: "Leads",
        href: "/leads",
        icon: RiUserSearchLine,
        description: "Cadastro, fila e primeiro contato",
      },
      {
        kind: "leaf",
        label: "Clientes",
        href: "/clients",
        icon: RiStore2Line,
        description: "Contas convertidas",
      },
    ],
  },
  {
    kind: "group",
    id: "settings",
    label: "Configuração",
    icon: RiSettings3Line,
    description: "Equipe e ferramentas",
    children: [
      {
        kind: "leaf",
        label: "Equipe",
        href: "/settings/team",
        icon: RiGroupLine,
        description: "Papéis e acesso",
      },
      {
        kind: "leaf",
        label: "Ferramentas",
        href: "/settings/tools",
        icon: RiToolsLine,
        description: "Fontes de dados da análise",
      },
    ],
  },
]
