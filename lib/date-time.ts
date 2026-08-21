import dayjs, { type ConfigType } from "dayjs"
import customParseFormat from "dayjs/plugin/customParseFormat"
import timezone from "dayjs/plugin/timezone"
import utc from "dayjs/plugin/utc"
import "dayjs/locale/pt-br"

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(customParseFormat)
dayjs.locale("pt-br")

export const APP_TIME_ZONE = "America/Sao_Paulo"

const DATE_FORMAT = "DD/MM/YYYY"
const TIME_FORMAT = "HH:mm:ss"
const TIME_SHORT_FORMAT = "HH:mm"
const DATE_TIME_FORMAT = "DD/MM/YYYY - HH:mm:ss"
const DATE_TIME_SHORT_FORMAT = "DD/MM/YYYY · HH:mm"

export type DateTimeInput = Exclude<ConfigType, null | undefined>

function assertValidInput(value: ConfigType): asserts value is DateTimeInput {
  if (value === null || value === undefined) {
    throw new Error(`[date-time] received ${String(value)}. Use a valid date string, number, or Date.`)
  }
  if (!dayjs(value).isValid()) {
    throw new Error(`[date-time] invalid date value: ${String(value)}`)
  }
}

export function toAppDateTime(value: DateTimeInput): dayjs.Dayjs {
  assertValidInput(value)
  return dayjs.utc(value).tz(APP_TIME_ZONE)
}

export function formatDate(value: DateTimeInput): string {
  return toAppDateTime(value).format(DATE_FORMAT)
}

export function formatDateTime(value: DateTimeInput): string {
  return toAppDateTime(value).format(DATE_TIME_FORMAT)
}

export function formatDateTimeShort(value: DateTimeInput): string {
  return toAppDateTime(value).format(DATE_TIME_SHORT_FORMAT)
}

export function formatTime(value: DateTimeInput): string {
  return toAppDateTime(value).format(TIME_FORMAT)
}

export function formatTimeShort(value: DateTimeInput): string {
  return toAppDateTime(value).format(TIME_SHORT_FORMAT)
}

function parseCivilDate(value: string): dayjs.Dayjs {
  if (value === null || value === undefined) {
    throw new Error(`[date-time] received ${String(value)}. Use a YYYY-MM-DD string.`)
  }
  const parsed = dayjs(value, "YYYY-MM-DD", true)
  if (!parsed.isValid()) {
    throw new Error(`[date-time] invalid civil date: ${String(value)}. Expected YYYY-MM-DD.`)
  }
  return parsed
}

function parseYearMonth(value: string): dayjs.Dayjs {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) {
    throw new Error(`[date-time] invalid year-month: ${String(value)}. Expected YYYY-MM.`)
  }
  const parsed = dayjs(`${value}-01`, "YYYY-MM-DD", true)
  if (!parsed.isValid()) {
    throw new Error(`[date-time] invalid year-month: ${String(value)}. Expected YYYY-MM.`)
  }
  return parsed
}

export function formatDateOnly(value: string): string {
  return parseCivilDate(value).format(DATE_FORMAT)
}

export function isCivilDate(value: string): boolean {
  return typeof value === "string" && dayjs(value, "YYYY-MM-DD", true).isValid()
}

export type CivilHourCycle = "h23" | "h12"
export type DayPeriod = "am" | "pm"

const CIVIL_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

export function isCivilTime(value: string): boolean {
  return typeof value === "string" && CIVIL_TIME_PATTERN.test(value)
}

function parseCivilTime(value: string): { hour: number; minute: number } {
  if (!isCivilTime(value)) {
    throw new Error(`[date-time] invalid civil time: ${String(value)}. Expected HH:mm.`)
  }
  return {
    hour: Number(value.slice(0, 2)),
    minute: Number(value.slice(3, 5)),
  }
}

export function splitCivilTime(value: string): { hour: number; minute: number } {
  return parseCivilTime(value)
}

export function joinCivilTime(hour: number, minute: number): string {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error(`[date-time] invalid hour: ${hour}. Expected 0-23.`)
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error(`[date-time] invalid minute: ${minute}. Expected 0-59.`)
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

export function nowCivilTime(): string {
  return dayjs().tz(APP_TIME_ZONE).format("HH:mm")
}

export function toHour12(hour23: number): { hour: number; period: DayPeriod } {
  if (!Number.isInteger(hour23) || hour23 < 0 || hour23 > 23) {
    throw new Error(`[date-time] invalid hour: ${hour23}. Expected 0-23.`)
  }
  const period: DayPeriod = hour23 >= 12 ? "pm" : "am"
  const hour = hour23 % 12 === 0 ? 12 : hour23 % 12
  return { hour, period }
}

export function fromHour12(hour12: number, period: DayPeriod): number {
  if (!Number.isInteger(hour12) || hour12 < 1 || hour12 > 12) {
    throw new Error(`[date-time] invalid hour: ${hour12}. Expected 1-12.`)
  }
  if (hour12 === 12) return period === "am" ? 0 : 12
  return period === "pm" ? hour12 + 12 : hour12
}

export function formatCivilTime(
  value: string,
  hourCycle: CivilHourCycle = "h23",
): string {
  const { hour, minute } = parseCivilTime(value)
  const mm = String(minute).padStart(2, "0")
  if (hourCycle === "h23") {
    return `${String(hour).padStart(2, "0")}:${mm}`
  }
  const { hour: hour12, period } = toHour12(hour)
  return `${String(hour12).padStart(2, "0")}:${mm} ${period.toUpperCase()}`
}

export function todayCivilDate(): string {
  return dayjs().tz(APP_TIME_ZONE).format("YYYY-MM-DD")
}

export function toCivilDate(value: DateTimeInput): string {
  return toAppDateTime(value).format("YYYY-MM-DD")
}

export function endOfTodayIso(): string {
  return dayjs().tz(APP_TIME_ZONE).endOf("day").utc().toISOString()
}

export function toYearMonth(civilDate: string): string {
  return parseCivilDate(civilDate).format("YYYY-MM")
}

export function shiftYearMonth(yearMonth: string, months: number): string {
  return parseYearMonth(yearMonth).add(months, "month").format("YYYY-MM")
}

export function shiftCivilDate(civilDate: string, days: number): string {
  return parseCivilDate(civilDate).add(days, "day").format("YYYY-MM-DD")
}

export function civilDateDiffDays(from: string, to: string): number {
  return parseCivilDate(to).diff(parseCivilDate(from), "day")
}

export function getMonthGrid(yearMonth: string): string[] {
  const start = parseYearMonth(yearMonth)
  const offset = (start.day() + 6) % 7
  const gridStart = start.subtract(offset, "day")
  return Array.from({ length: 42 }, (_, index) =>
    gridStart.add(index, "day").format("YYYY-MM-DD"),
  )
}

export function formatMonthYear(yearMonth: string): string {
  const formatted = parseYearMonth(yearMonth).format("MMMM YYYY")
  return formatted.charAt(0).toLocaleUpperCase("pt-BR") + formatted.slice(1)
}

export function getYearWindow(year: number): number[] {
  const start = Math.floor(year / 12) * 12
  return Array.from({ length: 12 }, (_, index) => start + index)
}

export function isYearMonthOutOfRange(
  yearMonth: string,
  min?: string,
  max?: string,
): boolean {
  const start = parseYearMonth(yearMonth)
  const first = start.format("YYYY-MM-DD")
  const last = start.endOf("month").format("YYYY-MM-DD")
  if (min && isCivilDate(min) && last < min) return true
  if (max && isCivilDate(max) && first > max) return true
  return false
}

export type TimestampUrgency = "overdue" | "soon" | "later"

export function getTimestampUrgency(value: DateTimeInput): TimestampUrgency {
  const target = toAppDateTime(value)
  const now = dayjs().tz(APP_TIME_ZONE)
  if (target.isBefore(now)) return "overdue"
  if (target.diff(now, "hour", true) <= 24) return "soon"
  return "later"
}

export type CivilFollowUpKind = "overdue" | "today" | "later"

export function getCivilFollowUpKind(value: DateTimeInput): CivilFollowUpKind {
  const target = toAppDateTime(value)
  const now = dayjs().tz(APP_TIME_ZONE)
  if (target.isBefore(now)) return "overdue"
  if (target.format("YYYY-MM-DD") === todayCivilDate()) return "today"
  return "later"
}

export function datetimeLocalToIso(value: string | null): string | null {
  if (!value) return null
  const normalized = value.length === 16 ? `${value}:00` : value
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})$/.exec(normalized)
  if (!match) return null
  const parsed = dayjs.tz(
    `${match[1]} ${match[2]}`,
    "YYYY-MM-DD HH:mm:ss",
    APP_TIME_ZONE,
  )
  if (!parsed.isValid()) return null
  return parsed.utc().toISOString()
}

export function toDatetimeLocalInput(value: DateTimeInput): string {
  return toAppDateTime(value).format("YYYY-MM-DDTHH:mm")
}

export function datetimeLocalToCivilDate(value: string): string {
  if (!value) return ""
  const date = value.slice(0, 10)
  return isCivilDate(date) ? date : ""
}

export function datetimeLocalToCivilTime(value: string): string {
  if (!value) return ""
  const match = /T(\d{2}:\d{2})/.exec(value)
  const time = match?.[1] ?? ""
  return isCivilTime(time) ? time : ""
}

export function isDatetimeLocal(value: string): boolean {
  if (typeof value !== "string" || value.length < 16) return false
  return (
    isCivilDate(datetimeLocalToCivilDate(value)) &&
    isCivilTime(datetimeLocalToCivilTime(value))
  )
}

export function joinDatetimeLocal(civilDate: string, civilTime: string): string {
  if (!isCivilDate(civilDate) || !isCivilTime(civilTime)) return ""
  return `${civilDate}T${civilTime}`
}

export function formatDatetimeLocal(
  value: string,
  hourCycle: CivilHourCycle = "h23",
): string {
  const date = datetimeLocalToCivilDate(value)
  const time = datetimeLocalToCivilTime(value)
  if (!date || !time) {
    throw new Error(
      `[date-time] invalid datetime-local: ${String(value)}. Expected YYYY-MM-DDTHH:mm.`,
    )
  }
  return `${formatDateOnly(date)} · ${formatCivilTime(time, hourCycle)}`
}

export function setDatetimeLocalDate(current: string, civilDate: string): string {
  if (!civilDate) return ""
  if (!isCivilDate(civilDate)) return current
  const match = /T(\d{2}:\d{2})/.exec(current)
  const time = match?.[1] ?? dayjs().tz(APP_TIME_ZONE).format("HH:mm")
  return `${civilDate}T${time}`
}

export function suggestNextActionDueAt(from?: string): string {
  const base = from ? toAppDateTime(from) : dayjs().tz(APP_TIME_ZONE)
  return base.add(1, "day").utc().toISOString()
}

export function formatRelativeShort(value: DateTimeInput): string {
  const target = toAppDateTime(value)
  const now = dayjs().tz(APP_TIME_ZONE)
  const diffMs = now.diff(target)
  if (diffMs < 0) return formatDateTimeShort(value)
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return "agora"
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return "há 1 dia"
  if (days < 30) return `há ${days} dias`
  return formatDateTimeShort(value)
}

export function formatStorageTimestamp(value?: DateTimeInput): string {
  const stamp = value === undefined ? dayjs.utc() : dayjs.utc(value)
  if (!stamp.isValid()) {
    throw new Error(
      `[date-time] invalid date value: ${String(value)}`,
    )
  }
  return stamp.format("YYYYMMDD[T]HHmmss[Z]")
}
