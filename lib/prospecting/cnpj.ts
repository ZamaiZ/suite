const CNPJ_PATTERN = /^[A-Z0-9]{12}\d{2}$/

export function normalizeCnpj(value: unknown): string | null {
  if (typeof value !== "string") return null
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "")
  return CNPJ_PATTERN.test(normalized) ? normalized : null
}

function calculateCheckDigit(value: string): string {
  let sum = 0
  let weight = 2
  for (let index = value.length - 1; index >= 0; index -= 1) {
    const numericValue = value.charCodeAt(index) - 48
    sum += numericValue * weight
    weight = weight === 9 ? 2 : weight + 1
  }
  const remainder = sum % 11
  return String(remainder < 2 ? 0 : 11 - remainder)
}

export function isValidCnpj(value: unknown): value is string {
  const cnpj = normalizeCnpj(value)
  if (!cnpj) return false
  if (/^(\w)\1{13}$/.test(cnpj)) return false
  const firstDigit = calculateCheckDigit(cnpj.slice(0, 12))
  const secondDigit = calculateCheckDigit(`${cnpj.slice(0, 12)}${firstDigit}`)
  return cnpj.endsWith(`${firstDigit}${secondDigit}`)
}

export function formatCnpj(value: string | null | undefined): string {
  if (!value) return "—"
  const cnpj = normalizeCnpj(value)
  if (!cnpj) return value
  if (!/^\d{14}$/.test(cnpj)) return cnpj
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`
}
