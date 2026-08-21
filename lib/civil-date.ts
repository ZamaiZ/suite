const CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function isCivilDate(value: string): boolean {
  if (typeof value !== "string") return false
  const match = CIVIL_DATE_PATTERN.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function utcCivil(value: string): number {
  const match = CIVIL_DATE_PATTERN.exec(value)
  if (!match) {
    throw new Error(`[civil-date] invalid civil date: ${value}`)
  }
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

export function civilDateDiffDays(from: string, to: string): number {
  return Math.round((utcCivil(to) - utcCivil(from)) / 86_400_000)
}

export function shiftCivilDate(civilDate: string, days: number): string {
  const match = CIVIL_DATE_PATTERN.exec(civilDate)
  if (!match) {
    throw new Error(`[civil-date] invalid civil date: ${civilDate}`)
  }
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  )
  date.setUTCDate(date.getUTCDate() + days)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function formatCivilDate(value: string): string {
  const match = CIVIL_DATE_PATTERN.exec(value)
  if (!match) return value
  return `${match[3]}/${match[2]}/${match[1]}`
}
