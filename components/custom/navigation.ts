import {
  RiBriefcaseLine,
  RiChat3Line,
  RiFileList3Line,
  RiGroupLine,
  RiHomeLine,
  RiLayoutGridLine,
  RiMouseLine,
  RiRouteLine,
  RiSearchEyeLine,
  RiSettings3Line,
  RiShapesLine,
  RiSparklingLine,
  RiStackLine,
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
        label: "Prospecção",
        href: "/prospecting",
        icon: RiSearchEyeLine,
        description: "Pesquisa por segmento e cidade",
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
  {
    kind: "group",
    id: "showcase",
    label: "Showcase",
    icon: RiShapesLine,
    description: "Catálogo de componentes",
    // Os ícones de categoria são os mesmos de `SHOWCASE_CATEGORIES`, repetidos
    // aqui de propósito: este arquivo é a fonte da navegação e não deve
    // depender da pasta de um módulo de tela.
    //
    // Na paleta entra só a visão geral: as categorias são catálogo para
    // consultar, e sete linhas delas afogariam Leads, Clientes e Equipe.
    children: [
      {
        kind: "leaf",
        label: "Visão geral",
        href: "/showcase",
        icon: RiStackLine,
        description: "Inventário shadcn",
      },
      {
        kind: "leaf",
        label: "Ações e feedback",
        href: "/showcase/actions",
        icon: RiSparklingLine,
        hiddenInPalette: true,
      },
      {
        kind: "leaf",
        label: "Formulários",
        href: "/showcase/forms",
        icon: RiFileList3Line,
        hiddenInPalette: true,
      },
      {
        kind: "leaf",
        label: "Navegação",
        href: "/showcase/navigation",
        icon: RiRouteLine,
        hiddenInPalette: true,
      },
      {
        kind: "leaf",
        label: "Camadas",
        href: "/showcase/overlays",
        icon: RiMouseLine,
        hiddenInPalette: true,
      },
      {
        kind: "leaf",
        label: "Conteúdo e dados",
        href: "/showcase/content",
        icon: RiLayoutGridLine,
        hiddenInPalette: true,
      },
      {
        kind: "leaf",
        label: "Conversas",
        href: "/showcase/messaging",
        icon: RiChat3Line,
        hiddenInPalette: true,
      },
    ],
  },
]
