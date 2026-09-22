import type { CampaignView, ProspectView } from "@/app/actions/prospect"
import type { pipelineProgress } from "@/lib/prospect/pipeline"

export type PipelineProgress = ReturnType<typeof pipelineProgress>

export type ProspectWorkspaceProps = {
  view: CampaignView
}

export type ProspectRow = ProspectView

/** Faixas de filtro da tabela. Régua de banda, não limiar solto. */
export const PROSPECT_FILTERS = [
  { id: "todas", label: "Todas" },
  { id: "quentes", label: "Quentes" },
  { id: "sem_site", label: "Sem site" },
  { id: "nao_reivindicado", label: "Sem perfil" },
  { id: "com_cnpj", label: "Com CNPJ" },
  { id: "com_contato", label: "Com contato" },
  { id: "promovidas", label: "Promovidas" },
] as const

export type ProspectFilterId = (typeof PROSPECT_FILTERS)[number]["id"]

export type ProspectSortKey = "score" | "rating" | "votes" | "title"
