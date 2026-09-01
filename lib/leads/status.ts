export const LEAD_STATUSES = [
  "new",
  "contacting",
  "follow_up",
  "denied",
  "interested",
  "converted",
] as const

export type LeadStatus = (typeof LEAD_STATUSES)[number]

export const LEAD_SDR_ACTIVITY_TYPES = [
  "no_contact",
  "call_later",
  "denied",
  "interested",
] as const

export type LeadSdrActivityType = (typeof LEAD_SDR_ACTIVITY_TYPES)[number]

export const LEAD_CLOSING_ACTIVITY_TYPES = [
  "meeting_rescheduled",
  "meeting_no_show",
  "closing_standby",
  "closing_lost",
  "closing_won",
] as const

export type LeadClosingActivityType =
  (typeof LEAD_CLOSING_ACTIVITY_TYPES)[number]

export const LEAD_ACTIVITY_TYPES = [
  ...LEAD_SDR_ACTIVITY_TYPES,
  ...LEAD_CLOSING_ACTIVITY_TYPES,
] as const

export type LeadActivityType = (typeof LEAD_ACTIVITY_TYPES)[number]

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Novo",
  contacting: "Em contato",
  follow_up: "Retorno",
  denied: "Negado",
  interested: "Oportunidade",
  converted: "Cliente",
}

export const LEAD_ACTIVITY_TYPE_LABELS: Record<LeadActivityType, string> = {
  no_contact: "Sem contato",
  call_later: "Ligar depois",
  denied: "Negado",
  interested: "Tem interesse",
  meeting_rescheduled: "Reunião reagendada",
  meeting_no_show: "No-show",
  closing_standby: "Stand-by",
  closing_lost: "Perda no fechamento",
  closing_won: "Acordo",
}

export function isLeadStatus(value: unknown): value is LeadStatus {
  return (
    typeof value === "string" &&
    (LEAD_STATUSES as readonly string[]).includes(value)
  )
}

export function isLeadSdrActivityType(
  value: unknown,
): value is LeadSdrActivityType {
  return (
    typeof value === "string" &&
    (LEAD_SDR_ACTIVITY_TYPES as readonly string[]).includes(value)
  )
}

export function isLeadActivityType(value: unknown): value is LeadActivityType {
  return (
    typeof value === "string" &&
    (LEAD_ACTIVITY_TYPES as readonly string[]).includes(value)
  )
}

export function deriveLeadStatus(
  type: LeadSdrActivityType,
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
