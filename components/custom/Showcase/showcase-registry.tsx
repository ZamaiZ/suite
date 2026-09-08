import {
  RiChat3Line,
  RiFileList3Line,
  RiLayoutGridLine,
  RiMouseLine,
  RiRouteLine,
  RiSparklingLine,
} from "react-icons/ri"
import type { ShowcaseCategory, ShowcaseCategoryId } from "./Showcase.types"

export const SHOWCASE_CATEGORIES = [
  { id: "actions", label: "Ações e feedback", description: "Comandos, confirmação e feedback transitório.", href: "/showcase/actions", componentCount: 9, icon: RiSparklingLine },
  { id: "forms", label: "Formulários", description: "Entradas, escolhas, validação e datas.", href: "/showcase/forms", componentCount: 14, icon: RiFileList3Line },
  { id: "navigation", label: "Navegação", description: "Hierarquia, atalhos e mudança de contexto.", href: "/showcase/navigation", componentCount: 8, icon: RiRouteLine },
  { id: "overlays", label: "Camadas", description: "Revelação progressiva e superfícies flutuantes.", href: "/showcase/overlays", componentCount: 10, icon: RiMouseLine },
  { id: "content", label: "Conteúdo e dados", description: "Dados, mídia, estruturas e carregamento.", href: "/showcase/content", componentCount: 14, icon: RiLayoutGridLine },
  { id: "messaging", label: "Conversas e anexos", description: "Mensagens, reações e arquivos.", href: "/showcase/messaging", componentCount: 4, icon: RiChat3Line },
] as const satisfies readonly ShowcaseCategory[]

export function isShowcaseCategory(value: string): value is ShowcaseCategoryId {
  return SHOWCASE_CATEGORIES.some((category) => category.id === value)
}

export const SHOWCASE_COMPONENT_TOTAL = SHOWCASE_CATEGORIES.reduce(
  (total, category) => total + category.componentCount,
  0,
)
