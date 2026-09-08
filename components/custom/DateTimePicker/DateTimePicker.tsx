"use client"

import { useLayoutEffect, useRef, useState, type MouseEvent } from "react"
import { Popover } from "@base-ui/react/popover"
import { useReducedMotion } from "motion/react"
import {
  RiCalendarLine,
  RiCloseLine,
  RiKeyboardLine,
  RiTimeLine,
} from "react-icons/ri"
import { cn } from "cn"
import { Calendar } from "@/components/ui/calendar"
import {
  CLOCK_MIN_HEIGHT_PX,
  prefersClock,
  TimePickerPanel,
  type TimePickerView,
} from "@/components/custom/TimePicker/TimePickerPanel"
import {
  formatCivilTime,
  formatDateOnly,
  formatDatetimeLocal,
  calendarDateToCivilDate,
  civilDateToCalendarDate,
  isCivilDate,
  isCivilTime,
  isDatetimeLocal,
  joinDatetimeLocal,
  datetimeLocalToCivilDate,
  datetimeLocalToCivilTime,
  nowCivilTime,
  todayCivilDate,
} from "@/lib/date-time"
import type { DateTimePickerProps } from "./DateTimePicker.types"

type Step = "date" | "time"

const FOOTER_BUTTON = cn(
  "h-8 rounded-md text-xs/relaxed font-medium text-primary",
  "scale-100 transition-[background-color,transform,opacity,scale] duration-150 ease-out",
  "active:scale-[0.97]",
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
  "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent",
)

const CHIP = cn(
  "flex h-8 min-w-0 flex-1 items-center justify-center rounded-md px-2",
  "text-xs/relaxed font-medium tabular-nums",
  "transition-[background-color,color,transform] duration-150 ease-out",
  "active:scale-[0.97] cursor-pointer",
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
)

const POPUP_CLASS = cn(
  "pointer-events-auto w-[18.5rem] max-w-[var(--available-width)] p-2.5",
  "origin-[var(--transform-origin)] rounded-md border border-border bg-popover shadow-md",
  "transition-[transform,opacity] duration-[180ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
  "data-starting-style:opacity-0 data-starting-style:scale-[0.96]",
  "data-ending-style:opacity-0 data-ending-style:scale-[0.96] data-ending-style:duration-[140ms]",
  "motion-reduce:transition-opacity motion-reduce:duration-150",
  "motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
)

export function DateTimePicker({
  id,
  value,
  onValueChange,
  label,
  placeholder,
  error,
  disabled,
  clearable = false,
  min,
  max,
  hourCycle = "h23",
  className,
  onBlur,
}: DateTimePickerProps) {
  const reduced = !!useReducedMotion()
  const popupRef = useRef<HTMLDivElement>(null)
  const dateRef = useRef("")
  const timeRef = useRef(nowCivilTime())
  const dirtyRef = useRef(false)

  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("date")
  const [draftDate, setDraftDate] = useState("")
  const [draftTime, setDraftTime] = useState(timeRef.current)
  const [view, setView] = useState<TimePickerView>("input")
  const [clockAllowed, setClockAllowed] = useState(true)

  const errorId = `${id}-error`
  const titleId = `${id}-title`
  const hasValue = Boolean(value && isDatetimeLocal(value))
  const displayValue =
    hasValue && value ? formatDatetimeLocal(value, hourCycle) : ""
  const today = todayCivilDate()
  const todayDisabled = Boolean((min && today < min) || (max && today > max))
  const showClock = view === "clock" && clockAllowed
  const dateLabel = isCivilDate(draftDate) ? formatDateOnly(draftDate) : "Data"
  const timeLabel = isCivilTime(draftTime)
    ? formatCivilTime(draftTime, hourCycle)
    : "—:—"

  function setDate(next: string) {
    if (!isCivilDate(next)) return
    dirtyRef.current = true
    dateRef.current = next
    setDraftDate(next)
  }

  function setTime(next: string) {
    if (!isCivilTime(next)) return
    dirtyRef.current = true
    timeRef.current = next
    setDraftTime(next)
  }

  function commit(date: string, time: string) {
    const next = joinDatetimeLocal(date, time)
    if (!next) return
    dirtyRef.current = false
    onValueChange?.(next)
    setOpen(false)
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      const complete = value && isDatetimeLocal(value)
      const date = complete ? datetimeLocalToCivilDate(value) : ""
      const time = complete ? datetimeLocalToCivilTime(value) : nowCivilTime()
      dirtyRef.current = false
      dateRef.current = date
      timeRef.current = time
      setDraftDate(date)
      setDraftTime(time)
      setStep("date")
      setClockAllowed(true)
      setView(prefersClock() ? "clock" : "input")
      setOpen(true)
      return
    }
    const joined = joinDatetimeLocal(dateRef.current, timeRef.current)
    if (dirtyRef.current && joined) onValueChange?.(joined)
    dirtyRef.current = false
    setOpen(false)
  }

  useLayoutEffect(() => {
    if (!open) return
    const node = popupRef.current
    const positioner = node?.parentElement
    if (!positioner) return

    const measure = () => {
      const raw =
        getComputedStyle(positioner).getPropertyValue("--available-height")
      const trimmed = raw.trim()
      if (!trimmed.endsWith("px")) return
      const px = parseFloat(trimmed)
      if (!Number.isFinite(px)) return
      const allowed = px >= CLOCK_MIN_HEIGHT_PX
      setClockAllowed(allowed)
      if (!allowed) setView("input")
    }

    measure()
    const frame = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(frame)
  }, [open, step])

  function selectDate(civilDate: string) {
    if ((min && civilDate < min) || (max && civilDate > max)) return
    setDate(civilDate)
    setStep("time")
  }

  function handleClear(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    onValueChange?.("")
  }

  return (
    <div className="flex w-full flex-col gap-1.5">
      <Popover.Root open={open} onOpenChange={handleOpenChange} modal={false}>
        {label ? (
          <label
            htmlFor={id}
            className={cn(
              "text-xs/relaxed font-medium text-muted-foreground",
              disabled ? "opacity-50" : "cursor-pointer",
              error && "text-destructive",
            )}
            onClick={() => {
              if (!disabled) handleOpenChange(true)
            }}
          >
            {label}
          </label>
        ) : null}

        <Popover.Trigger
          id={id}
          disabled={disabled}
          nativeButton={false}
          render={<div />}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          aria-label={
            displayValue || placeholder || "Selecionar data e horário"
          }
          onBlur={onBlur}
          className={cn(
            "group flex h-7 w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-0 shadow-xs",
            "text-xs/relaxed text-foreground outline-none",
            "transition-[background-color,border-color,color,opacity,transform,scale] duration-150 ease-out",
            "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
            "data-popup-open:border-ring data-popup-open:ring-2 data-popup-open:ring-ring/30",
            "scale-100 active:scale-[0.97] data-pressed:scale-[0.97]",
            "disabled:pointer-events-none disabled:opacity-50",
            "cursor-pointer",
            error &&
              "border-destructive focus-visible:border-destructive data-popup-open:border-destructive",
            className,
          )}
        >
          <span
            aria-hidden
            className="inline-flex shrink-0 text-muted-foreground"
          >
            <RiCalendarLine size={16} />
          </span>
          <span className="flex min-w-0 flex-1 items-center overflow-hidden">
            {hasValue ? (
              <span className="truncate tabular-nums">{displayValue}</span>
            ) : (
              <span className="truncate text-muted-foreground">
                {placeholder ?? ""}
              </span>
            )}
          </span>
          {clearable && hasValue && !disabled ? (
            <button
              type="button"
              aria-label="Limpar data e horário"
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClick={handleClear}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
            >
              <RiCloseLine size={16} aria-hidden />
            </button>
          ) : null}
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Positioner
            className="z-50 outline-none"
            sideOffset={4}
            align="start"
          >
            <Popover.Popup ref={popupRef} className={POPUP_CLASS}>
              <div className="mb-2 flex gap-1">
                <button
                  type="button"
                  aria-pressed={step === "date"}
                  onClick={() => setStep("date")}
                  className={cn(
                    CHIP,
                    step === "date"
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-accent-foreground",
                  )}
                >
                  {dateLabel}
                </button>
                <button
                  type="button"
                  aria-pressed={step === "time"}
                  onClick={() => setStep("time")}
                  className={cn(
                    CHIP,
                    step === "time"
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-accent-foreground",
                  )}
                >
                  {timeLabel}
                </button>
              </div>

              {step === "date" ? (
                <Calendar
                  mode="single"
                  selected={civilDateToCalendarDate(draftDate)}
                  onSelect={(date) => {
                    const civilDate = calendarDateToCivilDate(date)
                    if (civilDate) selectDate(civilDate)
                  }}
                  disabled={(date) => {
                    const civilDate = calendarDateToCivilDate(date)
                    return Boolean(
                      (min && civilDate < min) || (max && civilDate > max),
                    )
                  }}
                  autoFocus
                />
              ) : (
                <>
                  <Popover.Title id={titleId} className="sr-only">
                    Selecionar horário
                  </Popover.Title>
                  <TimePickerPanel
                    id={id}
                    value={draftTime}
                    hourCycle={hourCycle}
                    clockAllowed={clockAllowed}
                    view={view}
                    reduced={reduced}
                    active={open && step === "time"}
                    onValueChange={setTime}
                    onCommit={(time) => {
                      setTime(time)
                      if (!isCivilDate(dateRef.current)) {
                        setStep("date")
                        return
                      }
                      commit(dateRef.current, time)
                    }}
                  />
                </>
              )}

              <div className="mt-2 flex items-center gap-1 border-t border-border/70 pt-2">
                {step === "date" ? (
                  <button
                    type="button"
                    disabled={todayDisabled}
                    onClick={() => selectDate(today)}
                    className={cn(
                      FOOTER_BUTTON,
                      "w-full disabled:pointer-events-none disabled:opacity-50",
                    )}
                  >
                    Hoje
                  </button>
                ) : (
                  <>
                    {clockAllowed ? (
                      <button
                        type="button"
                        aria-label={
                          showClock
                            ? "Digitar horário"
                            : "Selecionar no relógio"
                        }
                        onClick={() => setView(showClock ? "input" : "clock")}
                        className={cn(
                          "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground",
                          "scale-100 transition-[background-color,color,transform,scale] duration-150 ease-out",
                          "active:scale-[0.97]",
                          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                          "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground",
                        )}
                      >
                        {showClock ? (
                          <RiKeyboardLine size={18} aria-hidden />
                        ) : (
                          <RiTimeLine size={18} aria-hidden />
                        )}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        commit(dateRef.current || today, nowCivilTime())
                      }
                      className={cn(FOOTER_BUTTON, "min-w-0 flex-1")}
                    >
                      Agora
                    </button>
                  </>
                )}
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-xs/relaxed text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
