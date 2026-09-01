import { hasAnyRole, type AppRole } from "@/lib/auth/roles"
import {
  LEAD_CLOSING_ACTIVITY_TYPES,
  type LeadClosingActivityType,
} from "@/lib/leads/status"

export const CLOSING_STAGES = [
  "open",
  "no_show",
  "standby",
  "won_pending",
] as const

export type ClosingStage = (typeof CLOSING_STAGES)[number]

export const CLOSING_STAGE_LABELS: Record<ClosingStage, string> = {
  open: "Reunião",
  no_show: "No-show",
  standby: "Stand-by",
  won_pending: "Acordo",
}

export const CLOSING_MANAGER_ROLES = [
  "admin",
  "commercial_manager",
] as const satisfies readonly AppRole[]

export { LEAD_CLOSING_ACTIVITY_TYPES, type LeadClosingActivityType }

const RESCHEDULE_STAGES = new Set<ClosingStage>(["open", "no_show", "standby"])

const OUTCOME_TYPES_BY_STAGE: Record<
  ClosingStage,
  readonly LeadClosingActivityType[]
> = {
  open: [
    "meeting_rescheduled",
    "meeting_no_show",
    "closing_standby",
    "closing_lost",
    "closing_won",
  ],
  no_show: ["meeting_rescheduled", "closing_lost"],
  standby: [
    "meeting_rescheduled",
    "closing_standby",
    "closing_lost",
    "closing_won",
  ],
  won_pending: [],
}

export function isClosingStage(value: unknown): value is ClosingStage {
  return (
    typeof value === "string" &&
    (CLOSING_STAGES as readonly string[]).includes(value)
  )
}

export function isLeadClosingActivityType(
  value: unknown,
): value is LeadClosingActivityType {
  return (
    typeof value === "string" &&
    (LEAD_CLOSING_ACTIVITY_TYPES as readonly string[]).includes(value)
  )
}

export function isClosingEventAllowed(
  stage: ClosingStage,
  type: LeadClosingActivityType,
): boolean {
  return OUTCOME_TYPES_BY_STAGE[stage].includes(type)
}

type ClosingActor = {
  status: string
  assigned_sdr_id: string | null
  assigned_closer_id: string | null
  closing_stage: ClosingStage | null
}

function isManager(roles: readonly AppRole[]): boolean {
  return hasAnyRole(roles, CLOSING_MANAGER_ROLES)
}

export function canRescheduleClosing(
  lead: ClosingActor,
  userId: string,
  roles: readonly AppRole[],
): boolean {
  if (lead.status !== "interested") return false
  if (!lead.closing_stage || !RESCHEDULE_STAGES.has(lead.closing_stage)) {
    return false
  }
  if (lead.assigned_sdr_id === userId) return true
  if (lead.assigned_closer_id === userId) return true
  return isManager(roles)
}

export function canRecordClosingOutcome(
  lead: ClosingActor,
  userId: string,
  roles: readonly AppRole[],
): boolean {
  if (lead.status !== "interested") return false
  if (!lead.closing_stage || lead.closing_stage === "won_pending") return false
  if (lead.assigned_closer_id === userId) return true
  return isManager(roles)
}

export function canEditClosingChecklist(
  lead: ClosingActor,
  userId: string,
  roles: readonly AppRole[],
): boolean {
  if (lead.status !== "interested") return false
  if (lead.closing_stage !== "won_pending") return false
  if (lead.assigned_closer_id === userId) return true
  return isManager(roles)
}

export function canConvertClosing(
  lead: ClosingActor,
  userId: string,
  roles: readonly AppRole[],
): boolean {
  return canEditClosingChecklist(lead, userId, roles)
}

export const CLEARED_CLOSING_FIELDS = {
  assigned_closer_id: null,
  closing_meeting_at: null,
  closing_stage: null,
  legal_name: null,
  tax_id: null,
  signer_name: null,
  contract_ref: null,
  invoice_ref: null,
  contract_sent_at: null,
  contract_signed_at: null,
  invoice_sent_at: null,
  paid_at: null,
} as const

export const RESET_CHECKLIST_FIELDS = {
  legal_name: null,
  tax_id: null,
  signer_name: null,
  contract_ref: null,
  invoice_ref: null,
  contract_sent_at: null,
  contract_signed_at: null,
  invoice_sent_at: null,
  paid_at: null,
} as const
