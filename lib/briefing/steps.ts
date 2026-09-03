export const BRIEFING_STEPS = [
  { id: "company", label: "Empresa" },
  { id: "brand", label: "Marca e serviços" },
  { id: "audience", label: "Persona e Localização" },
  { id: "history", label: "Histórico e metas" },
  { id: "finance", label: "Financeiro" },
  { id: "website", label: "Website" },
  { id: "accesses", label: "Acessos" },
  { id: "closing", label: "Considerações" },
] as const

export type BriefingStepId = (typeof BRIEFING_STEPS)[number]["id"]

export const BRIEFING_STEP_COMPANY: BriefingStepId = "company"
export const BRIEFING_STEP_BRAND: BriefingStepId = "brand"
export const BRIEFING_STEP_AUDIENCE: BriefingStepId = "audience"
export const BRIEFING_STEP_HISTORY: BriefingStepId = "history"
export const BRIEFING_STEP_FINANCE: BriefingStepId = "finance"
export const BRIEFING_STEP_WEBSITE: BriefingStepId = "website"
export const BRIEFING_STEP_ACCESSES: BriefingStepId = "accesses"
export const BRIEFING_STEP_CLOSING: BriefingStepId = "closing"
