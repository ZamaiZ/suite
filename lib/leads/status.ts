export const LEAD_STATUSES = [
  "new",
  "contacting",
  "follow_up",
  "denied",
  "interested",
] as const

export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const LEAD_ACTIVITY_TYPES = [
  "no_contact",
  "call_later",
  "denied",
  "interested",
] as const

export type LeadActivityType = (typeof LEAD_ACTIVITY_TYPES)[number]

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Novo",
  contacting: "Em contato",
  follow_up: "Retorno",
  denied: "Negado",
  interested: "Com interesse",
}

export const LEAD_ACTIVITY_TYPE_LABELS: Record<LeadActivityType, string> = {
  no_contact: "Sem contato",
  call_later: "Ligar depois",
  denied: "Negado",
  interested: "Tem interesse",
}

export function isLeadStatus(value: unknown): value is LeadStatus {
  return (
    typeof value === "string" &&
    (LEAD_STATUSES as readonly string[]).includes(value)
  )
}

export function isLeadActivityType(value: unknown): value is LeadActivityType {
  return (
    typeof value === "string" &&
    (LEAD_ACTIVITY_TYPES as readonly string[]).includes(value)
  )
}

export function deriveLeadStatus(
  type: LeadActivityType,
  followUpAt: string | null,
): { status: LeadStatus; nextFollowUpAt: string | null } {
  switch (type) {
    case "no_contact":
      return { status: "contacting", nextFollowUpAt: null }
    case "call_later":
      return { status: "follow_up", nextFollowUpAt: followUpAt }
    case "denied":
      return followUpAt
        ? { status: "follow_up", nextFollowUpAt: followUpAt }
        : { status: "denied", nextFollowUpAt: null }
    case "interested":
      return { status: "interested", nextFollowUpAt: null }
  }
}
