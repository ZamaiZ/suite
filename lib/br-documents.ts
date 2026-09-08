export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "")
}

function checksumDigit(base: string, factors: number[]): number {
  const sum = base.split("").reduce((total, digit, index) => {
    return total + Number(digit) * (factors[index] ?? 0)
  }, 0)
  const rest = sum % 11
  return rest < 2 ? 0 : 11 - rest
}

export function isValidCnpj(value: string): boolean {
  const digits = digitsOnly(value)
  if (digits.length !== 14) return false
  if (/^(\d)\1{13}$/.test(digits)) return false
  const first = checksumDigit(
    digits.slice(0, 12),
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  )
  const second = checksumDigit(
    `${digits.slice(0, 12)}${first}`,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  )
  return digits.endsWith(`${first}${second}`)
}

export function isValidCpf(value: string): boolean {
  const digits = digitsOnly(value)
  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false
  const first = checksumDigit(digits.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2])
  const second = checksumDigit(
    `${digits.slice(0, 9)}${first}`,
    [11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
  )
  return digits.endsWith(`${first}${second}`)
}

export function formatCnpj(value: string): string {
  const digits = digitsOnly(value).slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  }
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

export function formatCpf(value: string): string {
  const digits = digitsOnly(value).slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

export function formatPostalCode(value: string): string {
  const digits = digitsOnly(value).slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export const BRAZIL_CALLING_CODE = "55"

function nationalPhoneDigits(value: string): string {
  const digits = digitsOnly(value)
  if (
    digits.startsWith(BRAZIL_CALLING_CODE) &&
    (digits.length === 12 || digits.length === 13)
  ) {
    return digits.slice(BRAZIL_CALLING_CODE.length)
  }
  return digits
}

export function toNationalPhoneDigits(value: string): string {
  return nationalPhoneDigits(value).slice(0, 11)
}

export function formatPhone(value: string): string {
  const digits = toNationalPhoneDigits(value)
  if (digits.length === 0) return ""
  if (digits.length < 2) return `(${digits}`
  const area = digits.slice(0, 2)
  const local = digits.slice(2)
  if (local.length === 0) return `(${area})`
  if (digits.length <= 6) return `(${area}) ${local}`
  if (digits.length <= 10) {
    return `(${area}) ${local.slice(0, 4)}-${local.slice(4)}`
  }
  return `(${area}) ${local.slice(0, 5)}-${local.slice(5)}`
}

export function isValidBrPhone(value: string): boolean {
  const national = nationalPhoneDigits(value)
  return national.length === 10 || national.length === 11
}

export function toStoredPhone(value: string): string | null {
  if (digitsOnly(value).length === 0) return null
  if (!isValidBrPhone(value)) return null
  return `${BRAZIL_CALLING_CODE}${nationalPhoneDigits(value)}`
}

export function toTelHref(value: string): string | null {
  const stored = toStoredPhone(value)
  if (!stored) return null
  return `tel:+${stored}`
}
