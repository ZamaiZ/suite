export const PORTAL_CODE_LENGTH = 6

export const PORTAL_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

export function normalizePortalCode(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
}

export function isPortalCode(value: string): boolean {
  if (value.length !== PORTAL_CODE_LENGTH) return false
  for (const char of value) {
    if (!PORTAL_CODE_ALPHABET.includes(char)) return false
  }
  return true
}
