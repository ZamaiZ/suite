import type { IconType } from "react-icons"
import {
  RiBarChartBoxLine,
  RiFileList3Line,
  RiMapPin2Line,
  RiStarLine,
} from "react-icons/ri"
import type { GbpOpportunityTheme } from "@/lib/leads/gbp-opportunities"

/**
 * Aba e tema são o mesmo eixo: o contador da aba é a contagem do grupo da
 * coluna. Um tipo só evita a tradução no meio do caminho — que é por onde a
 * trilha e a lista da tela já divergiram uma vez.
 */
export type GbpProfileTabId = GbpOpportunityTheme

export const GBP_PROFILE_TABS: ReadonlyArray<{
  id: GbpProfileTabId
  label: string
  icon: IconType
}> = [
  { id: "perfil", label: "Perfil", icon: RiMapPin2Line },
  { id: "reputacao", label: "Reputação", icon: RiStarLine },
  { id: "ranking", label: "Ranking", icon: RiBarChartBoxLine },
  { id: "diretorios", label: "Diretórios", icon: RiFileList3Line },
]
