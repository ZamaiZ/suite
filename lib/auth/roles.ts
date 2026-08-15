export const APP_ROLES = [
  "admin",
  "commercial_manager",
  "sdr",
  "closer",
  "analyst",
  "customer_success",
] as const

export type AppRole = (typeof APP_ROLES)[number]

export const ROLE_MANAGEMENT_ROLES = [
  "admin",
] as const satisfies readonly AppRole[]

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  commercial_manager: "Gestor comercial",
  sdr: "SDR",
  closer: "Closer",
  analyst: "Analista",
  customer_success: "Customer Success",
}

export function isAppRole(value: unknown): value is AppRole {
  return (
    typeof value === "string" &&
    (APP_ROLES as readonly string[]).includes(value)
  )
}

export function hasRole(roles: readonly AppRole[], role: AppRole): boolean {
  return roles.includes(role)
}

export function hasAnyRole(
  roles: readonly AppRole[],
  requiredRoles: readonly AppRole[],
): boolean {
  return requiredRoles.some((role) => roles.includes(role))
}

export function isCommercialMember(roles: readonly AppRole[]): boolean {
  return roles.length > 0
}

export function sortAppRoles(roles: readonly AppRole[]): AppRole[] {
  return APP_ROLES.filter((role) => roles.includes(role))
}
