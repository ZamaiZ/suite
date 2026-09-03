export const WEEKDAYS = [
  { id: "monday", label: "Segunda-feira" },
  { id: "tuesday", label: "Terça-feira" },
  { id: "wednesday", label: "Quarta-feira" },
  { id: "thursday", label: "Quinta-feira" },
  { id: "friday", label: "Sexta-feira" },
  { id: "saturday", label: "Sábado" },
  { id: "sunday", label: "Domingo" },
] as const

export type WeekdayId = (typeof WEEKDAYS)[number]["id"]

export type DayHours = {
  weekday: WeekdayId
  closed: boolean
  open: string
  close: string
}

const DEFAULT_OPEN = "09:00"
const DEFAULT_CLOSE = "18:00"
const TIME_RANGE = /(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/
const CLOSED_PATTERN = /\b(fechado|closed)\b/i

const WEEKDAY_ALIASES: Record<WeekdayId, readonly string[]> = {
  monday: ["segunda", "monday", "seg"],
  tuesday: ["terca", "tuesday", "ter"],
  wednesday: ["quarta", "wednesday", "qua"],
  thursday: ["quinta", "thursday", "qui"],
  friday: ["sexta", "friday", "sex"],
  saturday: ["sabado", "saturday", "sab"],
  sunday: ["domingo", "sunday", "dom"],
}

export function emptyDayHours(): DayHours[] {
  return WEEKDAYS.map((day) => ({
    weekday: day.id,
    closed: true,
    open: DEFAULT_OPEN,
    close: DEFAULT_CLOSE,
  }))
}

export function parseHoursLines(lines: string[]): DayHours[] {
  const days = emptyDayHours()
  if (!Array.isArray(lines)) return days

  for (const raw of lines) {
    if (typeof raw !== "string") continue
    const line = normalizeHoursLine(raw)
    if (!line) continue
    const weekday = matchWeekday(line)
    if (!weekday) continue
    const day = days.find((item) => item.weekday === weekday)
    if (!day) continue
    if (CLOSED_PATTERN.test(line)) {
      day.closed = true
      continue
    }
    const range = line.match(TIME_RANGE)
    if (!range?.[1] || !range[2] || !range[3] || !range[4]) continue
    const open = toCivilTime(range[1], range[2])
    const close = toCivilTime(range[3], range[4])
    if (!open || !close) continue
    day.closed = false
    day.open = open
    day.close = close
  }

  return days
}

export function toHoursLines(days: DayHours[]): string[] {
  return days.map((day) => {
    const label =
      WEEKDAYS.find((item) => item.id === day.weekday)?.label ?? day.weekday
    if (day.closed) return `${label}: Fechado`
    return `${label}: ${day.open}–${day.close}`
  })
}

function normalizeHoursLine(value: string): string {
  return value
    .replace(/[\u00a0\u2007\u202f\u2009]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
}

function matchWeekday(line: string): WeekdayId | null {
  const folded = foldText(line)
  for (const day of WEEKDAYS) {
    for (const alias of WEEKDAY_ALIASES[day.id]) {
      if (folded.startsWith(alias)) return day.id
    }
  }
  return null
}

function toCivilTime(hour: string, minute: string): string | null {
  const h = Number(hour)
  const m = Number(minute)
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}
