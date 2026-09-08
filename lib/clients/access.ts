import {
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto"
import { hasAnyRole, type AppRole } from "@/lib/auth/roles"
import {
  PORTAL_CODE_ALPHABET,
  PORTAL_CODE_LENGTH,
  normalizePortalCode,
} from "@/lib/clients/portal-code"

export {
  PORTAL_CODE_ALPHABET,
  PORTAL_CODE_LENGTH,
  isPortalCode,
  normalizePortalCode,
} from "@/lib/clients/portal-code"

export const CLIENT_PORTAL_MANAGER_ROLES = [
  "admin",
  "commercial_manager",
  "customer_success",
] as const satisfies readonly AppRole[]

export const CLIENT_VIEW_ALL_ROLES = [
  "admin",
  "commercial_manager",
  "analyst",
  "customer_success",
] as const satisfies readonly AppRole[]

const HASH_ENCODING = "hex" as const

export function canViewAllClients(roles: readonly AppRole[]): boolean {
  return hasAnyRole(roles, CLIENT_VIEW_ALL_ROLES)
}

export function canViewOwnClients(roles: readonly AppRole[]): boolean {
  return roles.includes("closer")
}

export function canViewClient(
  roles: readonly AppRole[],
  userId: string,
  closerId: string | null,
): boolean {
  return (
    canViewAllClients(roles) ||
    (canViewOwnClients(roles) && closerId === userId)
  )
}

export function canManageClientPortal(
  roles: readonly AppRole[],
  userId: string,
  closerId: string | null,
): boolean {
  if (hasAnyRole(roles, CLIENT_PORTAL_MANAGER_ROLES)) return true
  if (roles.includes("closer") && closerId === userId) return true
  return false
}

export function generatePortalCode(): string {
  let code = ""
  for (let index = 0; index < PORTAL_CODE_LENGTH; index += 1) {
    code += PORTAL_CODE_ALPHABET[randomInt(PORTAL_CODE_ALPHABET.length)]
  }
  return code
}

export function generatePortalSlug(): string {
  return randomBytes(16).toString("base64url")
}

function portalPepper(): string {
  const pepper = process.env.CLIENT_PORTAL_PEPPER
  if (!pepper || pepper.trim().length === 0) {
    throw new Error("CLIENT_PORTAL_PEPPER is not set.")
  }
  return pepper
}

export function hashPortalCode(code: string): string {
  const normalized = normalizePortalCode(code)
  return createHash("sha256")
    .update(`${portalPepper()}:${normalized}`)
    .digest(HASH_ENCODING)
}

export function portalCodeMatches(code: string, storedHash: string): boolean {
  const computed = Buffer.from(hashPortalCode(code), HASH_ENCODING)
  const stored = Buffer.from(storedHash, HASH_ENCODING)
  if (computed.length !== stored.length) return false
  return timingSafeEqual(computed, stored)
}

export function createPortalAccess(): {
  slug: string
  code: string
  hash: string
} {
  const code = generatePortalCode()
  return {
    slug: generatePortalSlug(),
    code,
    hash: hashPortalCode(code),
  }
}

export const PORTAL_AUTH_MAX_FAILURES = 5
export const PORTAL_AUTH_LOCKOUT_MS = 15 * 60 * 1000
