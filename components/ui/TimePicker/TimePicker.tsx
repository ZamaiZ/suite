"use client"

import { useLayoutEffect, useRef, useState, type MouseEvent } from "react"
import { Popover } from "@base-ui/react/popover"
import { useReducedMotion } from "motion/react"
import { RiCloseLine, RiKeyboardLine, RiTimeLine } from "react-icons/ri"
import { cn } from "@/lib/cn"
import { formatCivilTime, isCivilTime, nowCivilTime } from "@/lib/date-time"
import {
  CLOCK_MIN_HEIGHT_PX,
  prefersClock,
  TimePickerPanel,
  type TimePickerView,
} from "./TimePickerPanel"
import type { TimePickerProps } from "./TimePicker.types"

const FOOTER_BUTTON = cn(
  "h-8 rounded-md font-sans text-body-sm font-medium text-primary",
  "scale-100 transition-[background-color,transform,opacity,scale] duration-150 ease-out",
  "active:scale-[0.97]",
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
  "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-hover",
)

export function TimePicker({
  id,
  value,
  onValueChange,
  label,
  placeholder,
  error,
  disabled,
  clearable = false,
  hourCycle = "h23",
  className,
  onBlur,
}: TimePickerProps) {
  const reduced = !!useReducedMotion()
  const popupRef = useRef<HTMLDivElement>(null)
  const draftRef = useRef(value && isCivilTime(value) ? value : nowCivilTime())
  const dirtyRef = useRef(false)

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(draftRef.current)
  const [view, setView] = useState<TimePickerView>("input")
  const [clockAllowed, setClockAllowed] = useState(true)

  const errorId = `${id}-error`
  const titleId = `${id}-title`
  const hasValue = Boolean(value && isCivilTime(value))
  const displayValue = hasValue && value ? formatCivilTime(value, hourCycle) : ""
  const showClock = view === "clock" && clockAllowed

  function setDraftTime(next: string) {
    if (!isCivilTime(next)) return
    dirtyRef.current = true
    draftRef.current = next
    setDraft(next)
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      const initial = value && isCivilTime(value) ? value : nowCivilTime()
      dirtyRef.current = false
      draftRef.current = initial
      setDraft(initial)
      setClockAllowed(true)
      setView(prefersClock() ? "clock" : "input")
      setOpen(true)
      return
    }
    if (dirtyRef.current && isCivilTime(draftRef.current)) {
      onValueChange?.(draftRef.current)
    }
    dirtyRef.current = false
    setOpen(false)
  }

  function closeWith(next: string) {
    if (!isCivilTime(next)) return
    draftRef.current = next
    setDraft(next)
    dirtyRef.current = false
    onValueChange?.(next)
    setOpen(false)
  }

  useLayoutEffect(() => {
    if (!open) return
    const node = popupRef.current
    const positioner = node?.parentElement
    if (!positioner) return

    function measure() {
      const raw = getComputedStyle(positioner).getPropertyValue("--available-height")
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
  }, [open])

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
              "font-sans text-body-sm font-medium text-fg-secondary",
              disabled ? "opacity-50" : "cursor-pointer",
              error && "text-danger",
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
          aria-label={displayValue || placeholder || "Selecionar horário"}
          onBlur={onBlur}
          className={cn(
            "group flex h-[var(--control-height)] w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-0 shadow-xs",
            "font-sans text-body-sm text-fg outline-none",
            "transition-[background-color,border-color,color,opacity,transform,scale] duration-150 ease-out",
            "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
            "data-popup-open:border-ring data-popup-open:ring-2 data-popup-open:ring-ring/30",
            "scale-100 active:scale-[0.97] data-pressed:scale-[0.97]",
            "disabled:pointer-events-none disabled:opacity-50",
            "cursor-pointer",
            error &&
              "border-danger focus-visible:border-danger data-popup-open:border-danger",
            className,
          )}
        >
          <span aria-hidden className="inline-flex shrink-0 text-fg-muted">
            <RiTimeLine size={16} />
          </span>
          <span className="flex min-w-0 flex-1 items-center overflow-hidden">
            {hasValue ? (
              <span className="truncate tabular-nums">{displayValue}</span>
            ) : (
              <span className="truncate text-fg-muted">{placeholder ?? ""}</span>
            )}
          </span>
          {clearable && hasValue && !disabled ? (
            <button
              type="button"
              aria-label="Limpar horário"
              onPointerDown={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onClick={handleClear}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
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
            <Popover.Popup
              ref={popupRef}
              className={cn(
                "pointer-events-auto w-[18.5rem] max-w-[var(--available-width)] p-2.5",
                "origin-[var(--transform-origin)] rounded-md border border-popover-border bg-popover shadow-raised",
                "transition-[transform,opacity] duration-[180ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
                "data-starting-style:opacity-0 data-starting-style:scale-[0.96]",
                "data-ending-style:opacity-0 data-ending-style:scale-[0.96] data-ending-style:duration-[140ms]",
                "motion-reduce:transition-opacity motion-reduce:duration-150",
                "motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
              )}
            >
              <Popover.Title
                id={titleId}
                className="mb-2 font-sans text-caption font-medium text-fg-muted"
              >
                {showClock ? "Selecionar horário" : "Digitar horário"}
              </Popover.Title>

              <TimePickerPanel
                id={id}
                value={draft}
                hourCycle={hourCycle}
                clockAllowed={clockAllowed}
                view={view}
                reduced={reduced}
                active={open}
                onValueChange={setDraftTime}
                onCommit={closeWith}
              />

              <div className="mt-2 flex items-center gap-1 border-t border-border-subtle pt-2">
                {clockAllowed ? (
                  <button
                    type="button"
                    aria-label={
                      showClock ? "Digitar horário" : "Selecionar no relógio"
                    }
                    onClick={() => setView(showClock ? "input" : "clock")}
                    className={cn(
                      "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fg-muted",
                      "scale-100 transition-[background-color,color,transform,scale] duration-150 ease-out",
                      "active:scale-[0.97]",
                      "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
                      "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-hover [@media(hover:hover)_and_(pointer:fine)]:hover:text-fg",
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
                  onClick={() => closeWith(nowCivilTime())}
                  className={cn(FOOTER_BUTTON, "min-w-0 flex-1")}
                >
                  Agora
                </button>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="font-sans text-body-sm text-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}
