"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react"
import { Popover } from "@base-ui/react/popover"
import { LazyMotion, domAnimation, useReducedMotion } from "motion/react"
import * as m from "motion/react-m"
import { RiArrowLeftSLine, RiArrowRightSLine } from "react-icons/ri"
import { cn } from "@/lib/cn"
import {
  formatDateOnly,
  formatMonthYear,
  getMonthGrid,
  getYearWindow,
  isCivilDate,
  isYearMonthOutOfRange,
  shiftCivilDate,
  shiftYearMonth,
  todayCivilDate,
  toYearMonth,
} from "@/lib/date-time"

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const
const MONTHS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const
const EASE = [0.23, 1, 0.32, 1] as const
const BODY_HEIGHT = "h-[14.875rem]"

type CalendarView = "days" | "months" | "years"
type ViewMotion = "up" | "down" | "lateral"

const NAV_BUTTON_CLASS = cn(
  "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fg-muted",
  "scale-100 transition-[background-color,color,transform,scale] duration-150 ease-out",
  "active:scale-[0.97]",
  "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-hover [@media(hover:hover)_and_(pointer:fine)]:hover:text-fg",
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
)

const HEADER_LABEL_CLASS = cn(
  "m-0 min-w-0 flex-1 text-center font-sans text-body-sm font-medium text-fg",
)

const HEADER_BUTTON_CLASS = cn(
  HEADER_LABEL_CLASS,
  "cursor-pointer rounded-md",
  "scale-100 transition-[background-color,color,scale] duration-150 ease-out",
  "active:scale-[0.97]",
  "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-hover",
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
)

export function isCivilDateOutOfRange(
  civilDate: string,
  min?: string,
  max?: string,
): boolean {
  if (min && isCivilDate(min) && civilDate < min) return true
  if (max && isCivilDate(max) && civilDate > max) return true
  return false
}

function isYearOutOfRange(year: number, min?: string, max?: string): boolean {
  return MONTHS.every((_, index) =>
    isYearMonthOutOfRange(yearMonthFromParts(year, index), min, max),
  )
}

function yearMonthFromParts(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`
}

function monthFromValue(value?: string): string {
  if (value && isCivilDate(value)) return toYearMonth(value)
  return toYearMonth(todayCivilDate())
}

function sameDayInMonth(civilDate: string, yearMonth: string): string {
  const candidate = `${yearMonth}-${civilDate.slice(8)}`
  if (isCivilDate(candidate)) return candidate
  const inMonth = getMonthGrid(yearMonth).filter((item) => item.startsWith(yearMonth))
  return inMonth[inMonth.length - 1] ?? candidate
}

function resolveFocusedDate(value?: string, min?: string, max?: string): string {
  if (value && isCivilDate(value) && !isCivilDateOutOfRange(value, min, max)) {
    return value
  }
  const today = todayCivilDate()
  if (!isCivilDateOutOfRange(today, min, max)) return today
  const grid = getMonthGrid(toYearMonth(today))
  return grid.find((item) => !isCivilDateOutOfRange(item, min, max)) ?? today
}

function cellClassName(options: {
  selected: boolean
  today: boolean
  disabled: boolean
  outside?: boolean
}) {
  return cn(
    "flex size-full items-center justify-center rounded-md",
    "font-sans text-body-sm outline-none",
    "scale-100 transition-[background-color,color,transform,box-shadow,scale] duration-150 ease-out",
    "active:scale-[0.97]",
    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
    options.outside && !options.selected && "text-fg-muted",
    options.today && !options.selected && "ring-1 ring-accent/40",
    options.selected && "bg-accent text-accent-fg",
    !options.selected &&
      !options.disabled &&
      "cursor-pointer [@media(hover:hover)_and_(pointer:fine)]:hover:bg-hover",
    options.disabled && "cursor-not-allowed opacity-50",
  )
}

export type DatePickerCalendarProps = {
  value?: string
  min?: string
  max?: string
  onSelectDate: (civilDate: string) => void
  titleId: string
  focusedCellRef: RefObject<HTMLButtonElement | null>
  active: boolean
}

export function DatePickerCalendar({
  value,
  min,
  max,
  onSelectDate,
  titleId,
  focusedCellRef,
  active,
}: DatePickerCalendarProps) {
  const reduced = !!useReducedMotion()
  const [view, setView] = useState<CalendarView>("days")
  const [viewMotion, setViewMotion] = useState<ViewMotion>("lateral")
  const [visibleMonth, setVisibleMonth] = useState(() => monthFromValue(value))
  const [monthDirection, setMonthDirection] = useState(1)
  const [focusedDate, setFocusedDate] = useState(() =>
    resolveFocusedDate(value, min, max),
  )

  const hasValue = Boolean(value && isCivilDate(value))
  const today = todayCivilDate()
  const visibleYear = Number(visibleMonth.slice(0, 4))
  const yearWindow = useMemo(() => getYearWindow(visibleYear), [visibleYear])

  const weeks = useMemo(() => {
    const cells = getMonthGrid(visibleMonth)
    const rows: string[][] = []
    for (let index = 0; index < cells.length; index += 7) {
      rows.push(cells.slice(index, index + 7))
    }
    return rows
  }, [visibleMonth])

  const motionKey =
    view === "days"
      ? `days-${visibleMonth}`
      : view === "months"
        ? `months-${visibleYear}`
        : `years-${yearWindow[0]}`

  const wasActive = useRef(false)

  useEffect(() => {
    if (active && !wasActive.current) {
      setVisibleMonth(monthFromValue(value))
      setFocusedDate(resolveFocusedDate(value, min, max))
      setView("days")
      setViewMotion("lateral")
      setMonthDirection(1)
    }
    wasActive.current = active
  }, [active, value, min, max])

  useEffect(() => {
    if (!active) return
    focusedCellRef.current?.focus()
  }, [focusedDate, visibleMonth, view, active, focusedCellRef])

  function selectDate(civilDate: string) {
    if (isCivilDateOutOfRange(civilDate, min, max)) return
    onSelectDate(civilDate)
  }

  function goLateral(delta: number) {
    const months =
      view === "days" ? delta : view === "months" ? delta * 12 : delta * 144
    const nextMonth = shiftYearMonth(visibleMonth, months)
    setViewMotion("lateral")
    setMonthDirection(delta)
    setVisibleMonth(nextMonth)
    setFocusedDate(sameDayInMonth(focusedDate, nextMonth))
  }

  function drillUp() {
    if (view === "days") {
      setViewMotion("up")
      setView("months")
      return
    }
    if (view === "months") {
      setViewMotion("up")
      setView("years")
    }
  }

  function selectMonth(yearMonth: string) {
    if (isYearMonthOutOfRange(yearMonth, min, max)) return
    setVisibleMonth(yearMonth)
    setFocusedDate(sameDayInMonth(focusedDate, yearMonth))
    setViewMotion("down")
    setView("days")
  }

  function selectYear(year: number) {
    if (isYearOutOfRange(year, min, max)) return
    const next = yearMonthFromParts(year, Number(visibleMonth.slice(5, 7)) - 1)
    setVisibleMonth(next)
    setFocusedDate(sameDayInMonth(focusedDate, next))
    setViewMotion("down")
    setView("months")
  }

  function moveFocus(next: string) {
    const nextMonth = toYearMonth(next)
    if (nextMonth !== visibleMonth) {
      setViewMotion("lateral")
      setMonthDirection(nextMonth > visibleMonth ? 1 : -1)
      setVisibleMonth(nextMonth)
    }
    setFocusedDate(next)
  }

  function moveFocusedMonth(delta: number) {
    const next = shiftYearMonth(toYearMonth(focusedDate), delta)
    setFocusedDate(sameDayInMonth(focusedDate, next))
    if (next.slice(0, 4) !== visibleMonth.slice(0, 4)) {
      setViewMotion("lateral")
      setMonthDirection(delta > 0 ? 1 : -1)
      setVisibleMonth(next)
    }
  }

  function moveFocusedYear(delta: number) {
    const year = Number(focusedDate.slice(0, 4)) + delta
    const next = yearMonthFromParts(year, Number(focusedDate.slice(5, 7)) - 1)
    setFocusedDate(sameDayInMonth(focusedDate, next))
    if (year < yearWindow[0] || year > yearWindow[yearWindow.length - 1]) {
      setViewMotion("lateral")
      setMonthDirection(delta > 0 ? 1 : -1)
      setVisibleMonth(next)
    }
  }

  function handleGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (view === "months") {
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault()
          moveFocusedMonth(-1)
          return
        case "ArrowRight":
          event.preventDefault()
          moveFocusedMonth(1)
          return
        case "ArrowUp":
          event.preventDefault()
          moveFocusedMonth(-3)
          return
        case "ArrowDown":
          event.preventDefault()
          moveFocusedMonth(3)
          return
        case "Home":
          event.preventDefault()
          moveFocusedMonth(-(Number(focusedDate.slice(5, 7)) - 1))
          return
        case "End":
          event.preventDefault()
          moveFocusedMonth(12 - Number(focusedDate.slice(5, 7)))
          return
        case "PageUp":
          event.preventDefault()
          goLateral(-1)
          return
        case "PageDown":
          event.preventDefault()
          goLateral(1)
          return
        default:
          return
      }
    }

    if (view === "years") {
      const year = Number(focusedDate.slice(0, 4))
      const index = yearWindow.indexOf(year)
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault()
          moveFocusedYear(-1)
          return
        case "ArrowRight":
          event.preventDefault()
          moveFocusedYear(1)
          return
        case "ArrowUp":
          event.preventDefault()
          moveFocusedYear(-3)
          return
        case "ArrowDown":
          event.preventDefault()
          moveFocusedYear(3)
          return
        case "Home":
          event.preventDefault()
          if (index >= 0) moveFocusedYear(-index)
          return
        case "End":
          event.preventDefault()
          if (index >= 0) moveFocusedYear(yearWindow.length - 1 - index)
          return
        case "PageUp":
          event.preventDefault()
          goLateral(-1)
          return
        case "PageDown":
          event.preventDefault()
          goLateral(1)
          return
        default:
          return
      }
    }

    let next: string | undefined
    switch (event.key) {
      case "ArrowLeft":
        next = shiftCivilDate(focusedDate, -1)
        break
      case "ArrowRight":
        next = shiftCivilDate(focusedDate, 1)
        break
      case "ArrowUp":
        next = shiftCivilDate(focusedDate, -7)
        break
      case "ArrowDown":
        next = shiftCivilDate(focusedDate, 7)
        break
      case "Home": {
        const grid = getMonthGrid(toYearMonth(focusedDate))
        const index = grid.indexOf(focusedDate)
        if (index >= 0) next = grid[index - (index % 7)]
        break
      }
      case "End": {
        const grid = getMonthGrid(toYearMonth(focusedDate))
        const index = grid.indexOf(focusedDate)
        if (index >= 0) next = grid[index - (index % 7) + 6]
        break
      }
      case "PageUp":
        next = sameDayInMonth(
          focusedDate,
          shiftYearMonth(toYearMonth(focusedDate), -1),
        )
        break
      case "PageDown":
        next = sameDayInMonth(
          focusedDate,
          shiftYearMonth(toYearMonth(focusedDate), 1),
        )
        break
      default:
        return
    }
    event.preventDefault()
    if (next) moveFocus(next)
  }

  const motionInitial = reduced
    ? { opacity: 0 }
    : viewMotion === "up"
      ? { opacity: 0, scale: 1.04, filter: "blur(2px)" }
      : viewMotion === "down"
        ? { opacity: 0, scale: 0.96, filter: "blur(2px)" }
        : { opacity: 0, x: monthDirection * 8, filter: "blur(2px)" }

  const motionAnimate = reduced
    ? { opacity: 1 }
    : { opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }

  const prevLabel =
    view === "days"
      ? "Mês anterior"
      : view === "months"
        ? "Ano anterior"
        : "Anos anteriores"
  const nextLabel =
    view === "days"
      ? "Próximo mês"
      : view === "months"
        ? "Próximo ano"
        : "Próximos anos"

  const headerTitle =
    view === "days"
      ? formatMonthYear(visibleMonth)
      : view === "months"
        ? String(visibleYear)
        : `${yearWindow[0]} – ${yearWindow[yearWindow.length - 1]}`

  return (
    <>
      <div className="mb-2 flex items-center gap-1">
        <button
          type="button"
          aria-label={prevLabel}
          onClick={() => goLateral(-1)}
          className={NAV_BUTTON_CLASS}
        >
          <RiArrowLeftSLine size={18} aria-hidden />
        </button>
        {view === "years" ? (
          <Popover.Title id={titleId} className={HEADER_LABEL_CLASS}>
            {headerTitle}
          </Popover.Title>
        ) : (
          <Popover.Title
            id={titleId}
            render={<button type="button" />}
            aria-label={view === "days" ? "Escolher mês" : "Escolher ano"}
            onClick={drillUp}
            className={HEADER_BUTTON_CLASS}
          >
            {headerTitle}
          </Popover.Title>
        )}
        <button
          type="button"
          aria-label={nextLabel}
          onClick={() => goLateral(1)}
          className={NAV_BUTTON_CLASS}
        >
          <RiArrowRightSLine size={18} aria-hidden />
        </button>
      </div>

      <div
        role="grid"
        aria-labelledby={titleId}
        onKeyDown={handleGridKeyDown}
        className={cn(BODY_HEIGHT, "overflow-hidden")}
      >
        <LazyMotion features={domAnimation} strict>
          <m.div
            key={motionKey}
            initial={motionInitial}
            animate={motionAnimate}
            transition={{ duration: 0.18, ease: EASE }}
            className="h-full"
          >
            {view === "days" ? (
              <div className="flex h-full flex-col">
                <div role="row" className="mb-1 grid grid-cols-7">
                  {WEEKDAYS.map((weekday) => (
                    <div
                      key={weekday}
                      role="columnheader"
                      aria-label={weekday}
                      className="flex h-8 items-center justify-center font-sans text-caption font-medium text-fg-muted"
                    >
                      {weekday}
                    </div>
                  ))}
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-0.5">
                  {weeks.map((week) => (
                    <div
                      key={week[0]}
                      role="row"
                      className="grid min-h-0 flex-1 grid-cols-7 gap-0.5"
                    >
                      {week.map((civilDate) => {
                        const isSelected = hasValue && value === civilDate
                        const isToday = civilDate === today
                        const isOutside = !civilDate.startsWith(visibleMonth)
                        const isDisabled = isCivilDateOutOfRange(
                          civilDate,
                          min,
                          max,
                        )
                        const isFocused = civilDate === focusedDate
                        const dayNumber = Number(civilDate.slice(8))

                        return (
                          <div
                            key={civilDate}
                            role="gridcell"
                            aria-selected={isSelected}
                            aria-disabled={isDisabled || undefined}
                            className="min-h-0"
                          >
                            <button
                              ref={isFocused ? focusedCellRef : undefined}
                              type="button"
                              tabIndex={isFocused ? 0 : -1}
                              aria-disabled={isDisabled || undefined}
                              aria-label={formatDateOnly(civilDate)}
                              aria-current={isToday ? "date" : undefined}
                              aria-selected={isSelected}
                              onClick={() => selectDate(civilDate)}
                              onFocus={() => setFocusedDate(civilDate)}
                              className={cellClassName({
                                selected: isSelected,
                                today: isToday,
                                disabled: isDisabled,
                                outside: isOutside,
                              })}
                            >
                              {dayNumber}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {view === "months" ? (
              <div className="grid h-full grid-cols-3 grid-rows-4 gap-0.5">
                {Array.from({ length: 4 }, (_, rowIndex) => (
                  <div key={rowIndex} role="row" className="contents">
                    {MONTHS.slice(rowIndex * 3, rowIndex * 3 + 3).map(
                      (monthLabel, columnIndex) => {
                        const index = rowIndex * 3 + columnIndex
                        const yearMonth = yearMonthFromParts(visibleYear, index)
                        const isSelected = hasValue && value?.startsWith(yearMonth)
                        const isToday = today.startsWith(yearMonth)
                        const isDisabled = isYearMonthOutOfRange(
                          yearMonth,
                          min,
                          max,
                        )
                        const isFocused = toYearMonth(focusedDate) === yearMonth

                        return (
                          <div
                            key={yearMonth}
                            role="gridcell"
                            aria-selected={isSelected}
                            aria-disabled={isDisabled || undefined}
                          >
                            <button
                              ref={isFocused ? focusedCellRef : undefined}
                              type="button"
                              tabIndex={isFocused ? 0 : -1}
                              aria-disabled={isDisabled || undefined}
                              aria-label={`${monthLabel} ${visibleYear}`}
                              aria-current={isToday ? "date" : undefined}
                              aria-selected={isSelected}
                              onClick={() => selectMonth(yearMonth)}
                              onFocus={() =>
                                setFocusedDate(
                                  sameDayInMonth(focusedDate, yearMonth),
                                )
                              }
                              className={cellClassName({
                                selected: Boolean(isSelected),
                                today: isToday,
                                disabled: isDisabled,
                              })}
                            >
                              {monthLabel}
                            </button>
                          </div>
                        )
                      },
                    )}
                  </div>
                ))}
              </div>
            ) : null}

            {view === "years" ? (
              <div className="grid h-full grid-cols-3 grid-rows-4 gap-0.5">
                {Array.from({ length: 4 }, (_, rowIndex) => (
                  <div key={rowIndex} role="row" className="contents">
                    {yearWindow
                      .slice(rowIndex * 3, rowIndex * 3 + 3)
                      .map((year) => {
                        const isSelected = hasValue && value?.startsWith(`${year}-`)
                        const isToday = today.startsWith(`${year}-`)
                        const isDisabled = isYearOutOfRange(year, min, max)
                        const isFocused = Number(focusedDate.slice(0, 4)) === year

                        return (
                          <div
                            key={year}
                            role="gridcell"
                            aria-selected={isSelected}
                            aria-disabled={isDisabled || undefined}
                          >
                            <button
                              ref={isFocused ? focusedCellRef : undefined}
                              type="button"
                              tabIndex={isFocused ? 0 : -1}
                              aria-disabled={isDisabled || undefined}
                              aria-label={String(year)}
                              aria-current={isToday ? "date" : undefined}
                              aria-selected={isSelected}
                              onClick={() => selectYear(year)}
                              onFocus={() =>
                                setFocusedDate(
                                  sameDayInMonth(
                                    focusedDate,
                                    yearMonthFromParts(
                                      year,
                                      Number(focusedDate.slice(5, 7)) - 1,
                                    ),
                                  ),
                                )
                              }
                              className={cellClassName({
                                selected: Boolean(isSelected),
                                today: isToday,
                                disabled: isDisabled,
                              })}
                            >
                              {year}
                            </button>
                          </div>
                        )
                      })}
                  </div>
                ))}
              </div>
            ) : null}
          </m.div>
        </LazyMotion>
      </div>
    </>
  )
}
