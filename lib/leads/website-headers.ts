/**
 * Headers de resposta que a auditoria guarda.
 *
 * O crawler ja recebia todos eles e usava apenas `location` para seguir
 * redirect. Guardar estes seis custa uma leitura do objeto de resposta e
 * fecha a lacuna de seguranca do snapshot; `x-robots-tag` entra aqui porque
 * tambem decide indexabilidade.
 */
export const SECURITY_HEADER_KEYS = [
  "strict-transport-security",
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "x-robots-tag",
] as const

export type SecurityHeaderKey = (typeof SECURITY_HEADER_KEYS)[number]

export const SECURITY_HEADER_LABELS: Record<SecurityHeaderKey, string> = {
  "strict-transport-security": "HSTS",
  "content-security-policy": "Content-Security-Policy",
  "x-frame-options": "X-Frame-Options",
  "x-content-type-options": "X-Content-Type-Options",
  "referrer-policy": "Referrer-Policy",
  "x-robots-tag": "X-Robots-Tag",
}

const HEADER_VALUE_MAX = 500

export function pickSecurityHeaders(headers: Headers): Record<string, string> {
  const picked: Record<string, string> = {}
  for (const key of SECURITY_HEADER_KEYS) {
    const value = headers.get(key)
    if (!value) continue
    const trimmed = value.trim()
    if (!trimmed) continue
    picked[key] = trimmed.slice(0, HEADER_VALUE_MAX)
  }
  return picked
}

export function readSecurityHeaders(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const row = value as Record<string, unknown>
  const headers: Record<string, string> = {}
  for (const key of SECURITY_HEADER_KEYS) {
    const item = row[key]
    if (typeof item !== "string") continue
    const trimmed = item.trim()
    if (trimmed) headers[key] = trimmed.slice(0, HEADER_VALUE_MAX)
  }
  return headers
}

/**
 * `x-robots-tag` fica de fora: ele nao e um header de protecao, e sua ausencia
 * e o estado normal de uma pagina indexavel.
 */
export function missingSecurityHeaders(
  headers: Record<string, string>,
): SecurityHeaderKey[] {
  return SECURITY_HEADER_KEYS.filter(
    (key) => key !== "x-robots-tag" && !headers[key],
  )
}

export function headerBlocksIndexing(headers: Record<string, string>): boolean {
  const value = headers["x-robots-tag"]
  return Boolean(value && /noindex/i.test(value))
}
