"use client"

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import { cn } from "@/lib/cn"
import {
  fromHour12,
  isCivilTime,
  joinCivilTime,
  splitCivilTime,
  toHour12,
  type DayPeriod,
} from "@/lib/date-time"
import { TimePickerClock } from "./TimePickerClock"
import type { HourCycle } from "./TimePicker.types"

export const CLOCK_MIN_HEIGHT_PX = 320

export type TimePickerView = "clock" | "input"
export type TimeSegment = "hour" | "minute"

const SEGMENT_BOX = cn(
  "flex h-14 w-full items-center justify-center rounded-md text-center",
  "font-sans text-title font-semibold tabular-nums text-fg",
  "transition-[background-color,color,transform] duration-150 ease-out",
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
)

const PERIOD_BUTTON = cn(
  "flex flex-1 items-center justify-center font-sans text-caption font-semibold",
  "transition-[background-color,color,transform] duration-150 ease-out",
  "active:scale-[0.97]",
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
)

export function prefersClock(): boolean {
  if (typeof window === "undefined") return false
  return window.matchMedia("(pointer: coarse)").matches
}

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

export type TimePickerPanelProps = {
  id: string
  value: string
  hourCycle: HourCycle
  clockAllowed: boolean
  view: TimePickerView
  reduced: boolean
  active: boolean
  onValueChange: (value: string) => void
  onCommit: (value: string) => void
}

export function TimePickerPanel({
  id,
  value,
  hourCycle,
  clockAllowed,
  view,
  reduced,
  active,
  onValueChange,
  onCommit,
}: TimePickerPanelProps) {
  const hourButtonRef = useRef<HTMLButtonElement>(null)
  const minuteButtonRef = useRef<HTMLButtonElement>(null)
  const hourInputRef = useRef<HTMLInputElement>(null)
  const minuteInputRef = useRef<HTMLInputElement>(null)
  const valueRef = useRef(value)
  valueRef.current = value

  const [segment, setSegment] = useState<TimeSegment>("hour")
  const [hourText, setHourText] = useState("00")
  const [minuteText, setMinuteText] = useState("00")

  const { hour: hour23, minute } = splitCivilTime(value)
  const hour12 = toHour12(hour23)
  const displayHour = hourCycle === "h12" ? hour12.hour : hour23
  const hourActive = segment === "hour"
  const minuteActive = segment === "minute"
  const showClock = view === "clock" && clockAllowed

  function syncTexts(next: string) {
    const parts = splitCivilTime(next)
    const shown = hourCycle === "h12" ? toHour12(parts.hour).hour : parts.hour
    setHourText(pad2(shown))
    setMinuteText(pad2(parts.minute))
  }

  function setTime(next: string) {
    if (!isCivilTime(next)) return
    valueRef.current = next
    onValueChange(next)
    syncTexts(next)
  }

  useEffect(() => {
    if (!active) return
    setSegment("hour")
    syncTexts(valueRef.current)
  }, [active])

  useEffect(() => {
    if (!active) return
    syncTexts(value)
  }, [value, hourCycle, active])

  useEffect(() => {
    if (!active) return
    if (view === "input") {
      const node = segment === "minute" ? minuteInputRef.current : hourInputRef.current
      node?.focus()
      node?.select()
      return
    }
    const node = segment === "minute" ? minuteButtonRef.current : hourButtonRef.current
    node?.focus()
  }, [active, view, segment])

  function applyDisplayHour(raw: number) {
    if (!Number.isFinite(raw)) return
    const n = Math.trunc(raw)
    const current = splitCivilTime(valueRef.current)
    if (hourCycle === "h12") {
      const clamped = Math.min(12, Math.max(1, n))
      const { period } = toHour12(current.hour)
      setTime(joinCivilTime(fromHour12(clamped, period), current.minute))
      return
    }
    setTime(joinCivilTime(Math.min(23, Math.max(0, n)), current.minute))
  }

  function applyMinute(raw: number) {
    if (!Number.isFinite(raw)) return
    const n = Math.trunc(raw)
    const { hour } = splitCivilTime(valueRef.current)
    setTime(joinCivilTime(hour, Math.min(59, Math.max(0, n))))
  }

  function nudgeHour(delta: number) {
    const current = splitCivilTime(valueRef.current)
    if (hourCycle === "h12") {
      const converted = toHour12(current.hour)
      let next = converted.hour + delta
      if (next > 12) next = 1
      if (next < 1) next = 12
      setTime(joinCivilTime(fromHour12(next, converted.period), current.minute))
      return
    }
    setTime(joinCivilTime((current.hour + delta + 24) % 24, current.minute))
  }

  function nudgeMinute(delta: number) {
    const current = splitCivilTime(valueRef.current)
    applyMinute((current.minute + delta + 60) % 60)
  }

  function handleHourKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case "ArrowUp":
        event.preventDefault()
        nudgeHour(1)
        return
      case "ArrowDown":
        event.preventDefault()
        nudgeHour(-1)
        return
      case "Home":
        event.preventDefault()
        applyDisplayHour(hourCycle === "h12" ? 1 : 0)
        return
      case "End":
        event.preventDefault()
        applyDisplayHour(hourCycle === "h12" ? 12 : 23)
        return
      case "Enter":
        event.preventDefault()
        onCommit(valueRef.current)
        return
      default:
        return
    }
  }

  function handleMinuteKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case "ArrowUp":
        event.preventDefault()
        nudgeMinute(1)
        return
      case "ArrowDown":
        event.preventDefault()
        nudgeMinute(-1)
        return
      case "Home":
        event.preventDefault()
        applyMinute(0)
        return
      case "End":
        event.preventDefault()
        applyMinute(59)
        return
      case "Enter":
        event.preventDefault()
        onCommit(valueRef.current)
        return
      default:
        return
    }
  }

  function handleHourInput(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 2)
    setHourText(digits)
    if (digits.length === 2) {
      applyDisplayHour(Number(digits))
      setSegment("minute")
    }
  }

  function handleMinuteInput(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 2)
    setMinuteText(digits)
    if (digits.length === 2) applyMinute(Number(digits))
  }

  function handleHourBlur() {
    if (hourText.length === 0) {
      setHourText(pad2(displayHour))
      return
    }
    applyDisplayHour(Number(hourText))
  }

  function handleMinuteBlur() {
    if (minuteText.length === 0) {
      setMinuteText(pad2(minute))
      return
    }
    applyMinute(Number(minuteText))
  }

  function setPeriod(period: DayPeriod) {
    const current = splitCivilTime(valueRef.current)
    const { hour } = toHour12(current.hour)
    setTime(joinCivilTime(fromHour12(hour, period), current.minute))
  }

  return (
    <>
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {showClock ? (
            <button
              ref={hourButtonRef}
              type="button"
              role="spinbutton"
              aria-label="Hora"
              aria-valuemin={hourCycle === "h12" ? 1 : 0}
              aria-valuemax={hourCycle === "h12" ? 12 : 23}
              aria-valuenow={displayHour}
              aria-valuetext={pad2(displayHour)}
              onClick={() => setSegment("hour")}
              onKeyDown={handleHourKeyDown}
              className={cn(
                SEGMENT_BOX,
                "cursor-pointer active:scale-[0.97]",
                hourActive ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
              )}
            >
              {pad2(displayHour)}
            </button>
          ) : (
            <input
              ref={hourInputRef}
              id={`${id}-hour`}
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              aria-label="Hora"
              role="spinbutton"
              aria-valuemin={hourCycle === "h12" ? 1 : 0}
              aria-valuemax={hourCycle === "h12" ? 12 : 23}
              aria-valuenow={displayHour}
              value={hourText}
              onChange={(event) => handleHourInput(event.target.value)}
              onFocus={() => setSegment("hour")}
              onBlur={handleHourBlur}
              onKeyDown={handleHourKeyDown}
              className={cn(
                SEGMENT_BOX,
                "min-w-0 border-0 p-0 outline-none",
                hourActive ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
              )}
            />
          )}
          {showClock ? null : (
            <span className="font-sans text-caption text-fg-muted">Hora</span>
          )}
        </div>

        <span
          aria-hidden
          className="flex h-14 items-center font-sans text-title font-semibold text-fg"
        >
          :
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {showClock ? (
            <button
              ref={minuteButtonRef}
              type="button"
              role="spinbutton"
              aria-label="Minuto"
              aria-valuemin={0}
              aria-valuemax={59}
              aria-valuenow={minute}
              aria-valuetext={pad2(minute)}
              onClick={() => setSegment("minute")}
              onKeyDown={handleMinuteKeyDown}
              className={cn(
                SEGMENT_BOX,
                "cursor-pointer active:scale-[0.97]",
                minuteActive ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
              )}
            >
              {pad2(minute)}
            </button>
          ) : (
            <input
              ref={minuteInputRef}
              id={`${id}-minute`}
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              aria-label="Minuto"
              role="spinbutton"
              aria-valuemin={0}
              aria-valuemax={59}
              aria-valuenow={minute}
              value={minuteText}
              onChange={(event) => handleMinuteInput(event.target.value)}
              onFocus={() => setSegment("minute")}
              onBlur={handleMinuteBlur}
              onKeyDown={handleMinuteKeyDown}
              className={cn(
                SEGMENT_BOX,
                "min-w-0 border-0 p-0 outline-none",
                minuteActive ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
              )}
            />
          )}
          {showClock ? null : (
            <span className="font-sans text-caption text-fg-muted">Minuto</span>
          )}
        </div>

        {hourCycle === "h12" ? (
          <div className="flex h-14 w-11 shrink-0 flex-col overflow-hidden rounded-md border border-border">
            <button
              type="button"
              aria-pressed={hour12.period === "am"}
              aria-label="AM"
              onClick={() => setPeriod("am")}
              className={cn(
                PERIOD_BUTTON,
                hour12.period === "am"
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-fg-muted",
              )}
            >
              AM
            </button>
            <button
              type="button"
              aria-pressed={hour12.period === "pm"}
              aria-label="PM"
              onClick={() => setPeriod("pm")}
              className={cn(
                PERIOD_BUTTON,
                hour12.period === "pm"
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-fg-muted",
              )}
            >
              PM
            </button>
          </div>
        ) : null}
      </div>

      {showClock ? (
        <div className="mt-3">
          <TimePickerClock
            hourCycle={hourCycle}
            segment={segment}
            hour23={hour23}
            minute={minute}
            reduced={reduced}
            onHourChange={(next) => {
              const { minute: currentMinute } = splitCivilTime(valueRef.current)
              setTime(joinCivilTime(next, currentMinute))
            }}
            onHourCommit={(next) => {
              const { minute: currentMinute } = splitCivilTime(valueRef.current)
              setTime(joinCivilTime(next, currentMinute))
              setSegment("minute")
            }}
            onMinuteChange={(next) => {
              const { hour } = splitCivilTime(valueRef.current)
              setTime(joinCivilTime(hour, next))
            }}
            onMinuteCommit={(next) => {
              const { hour } = splitCivilTime(valueRef.current)
              onCommit(joinCivilTime(hour, next))
            }}
          />
        </div>
      ) : null}
    </>
  )
}
