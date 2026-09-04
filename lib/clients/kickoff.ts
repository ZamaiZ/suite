import type { AppRole } from "@/lib/auth/roles"
import { canManageClientPortal } from "@/lib/clients/access"
import type { ClientKickoffStage } from "@/lib/clients/types"

export const CLIENT_KICKOFF_STAGES = ["none", "scheduled", "no_show", "completed"] as const
export const CLIENT_KICKOFF_STAGE_LABELS: Record<ClientKickoffStage, string> = { none: "", scheduled: "Reunião", no_show: "No-show", completed: "Kickoff feito" }
export const CLIENT_KICKOFF_ACTIVITY_TYPES = ["kickoff_scheduled", "kickoff_rescheduled", "kickoff_no_show", "kickoff_completed", "kickoff_note"] as const
export type ClientKickoffActivityType = (typeof CLIENT_KICKOFF_ACTIVITY_TYPES)[number]
export const CLIENT_KICKOFF_ACTIVITY_LABELS: Record<ClientKickoffActivityType, string> = { kickoff_scheduled: "Kickoff agendado", kickoff_rescheduled: "Kickoff reagendado", kickoff_no_show: "No-show", kickoff_completed: "Kickoff realizado", kickoff_note: "Observação" }

export function isClientKickoffStage(value: unknown): value is ClientKickoffStage { return typeof value === "string" && (CLIENT_KICKOFF_STAGES as readonly string[]).includes(value) }
export function isClientKickoffActivityType(value: unknown): value is ClientKickoffActivityType { return typeof value === "string" && (CLIENT_KICKOFF_ACTIVITY_TYPES as readonly string[]).includes(value) }
export function canLogKickoff(input: { roles: readonly AppRole[]; userId: string; closerId: string | null; finalizedAt: string | null }) { return Boolean(input.finalizedAt) && canManageClientPortal(input.roles, input.userId, input.closerId) }
export function isKickoffEventAllowed(stage: ClientKickoffStage, type: ClientKickoffActivityType) {
  if (stage === "completed") return false
  if (type === "kickoff_note") return true
  if (stage === "none") return type === "kickoff_scheduled"
  if (stage === "scheduled") return type === "kickoff_rescheduled" || type === "kickoff_no_show" || type === "kickoff_completed"
  return type === "kickoff_rescheduled" || type === "kickoff_completed"
}
