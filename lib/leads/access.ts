import { hasAnyRole, type AppRole } from "@/lib/auth/roles"

export const LEAD_TEAM_VIEW_ROLES = [
  "admin",
  "commercial_manager",
  "analyst",
  "customer_success",
] as const satisfies readonly AppRole[]

export type LeadReadSubject = {
  status: string
  assigned_sdr_id: string | null
  assigned_closer_id: string | null
}

export function canViewTeamLeads(roles: readonly AppRole[]): boolean {
  return hasAnyRole(roles, LEAD_TEAM_VIEW_ROLES)
}

export function canViewLead(
  lead: LeadReadSubject,
  userId: string,
  roles: readonly AppRole[],
): boolean {
  if (canViewTeamLeads(roles)) return true
  if (lead.status === "new" && !lead.assigned_sdr_id) return true
  return (
    lead.assigned_sdr_id === userId || lead.assigned_closer_id === userId
  )
}

export function leadPortfolioScope(
  userId: string,
): string {
  return [
    "and(status.eq.new,assigned_sdr_id.is.null)",
    `and(assigned_sdr_id.eq.${userId})`,
    `and(assigned_closer_id.eq.${userId})`,
  ].join(",")
}
