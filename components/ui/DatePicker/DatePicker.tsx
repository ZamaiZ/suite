"use client"

import { useRef, useState, type MouseEvent } from "react"
import { Popover } from "@base-ui/react/popover"
import { RiCalendarLine, RiCloseLine } from "react-icons/ri"
import { cn } from "@/lib/cn"
import { useDialogPortalContainer } from "@/components/ui/Dialog"
import { formatDateOnly, isCivilDate, todayCivilDate } from "@/lib/date-time"
import {
  DatePickerCalendar,
  isCivilDateOutOfRange,
} from "./DatePickerCalendar"
import type { DatePickerProps } from "./DatePicker.types"

export function DatePicker({
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
  className,
  onBlur,
}: DatePickerProps) {
  const portalContainer = useDialogPortalContainer()
  const focusedCellRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  const errorId = `${id}-error`
  const titleId = `${id}-month`
  const hasValue = Boolean(value && isCivilDate(value))
  const today = todayCivilDate()
  const todayDisabled = isCivilDateOutOfRange(today, min, max)
  const displayValue = hasValue && value ? formatDateOnly(value) : ""

  function handleOpenChange(next: boolean) {
    setOpen(next)
  }

  function selectDate(civilDate: string) {
    if (isCivilDateOutOfRange(civilDate, min, max)) return
    onValueChange?.(civilDate)
    setOpen(false)
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
              "font-sans text-body-sm font-medium text-fg-secondary",
              disabled ? "opacity-50" : "cursor-pointer",
              error && "text-danger",
            )}
            onClick={() => {
              if (!disabled) setOpen(true)
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
          aria-label={displayValue || placeholder || "Selecionar data"}
          onBlur={onBlur}
          className={cn(
            "group flex h-[var(--control-height)] w-full items-center gap-2 rounded-md border border-input-border bg-input px-3 py-0",
            "font-sans text-body-sm text-fg outline-none",
            "transition-[background-color,border-color,color,opacity,transform,scale] duration-150 ease-out",
            "focus-visible:border-accent",
            "data-popup-open:border-accent",
            "scale-100 active:scale-[0.97] data-pressed:scale-[0.97]",
            "disabled:pointer-events-none disabled:opacity-50",
            "cursor-pointer",
            error &&
              "border-danger focus-visible:border-danger data-popup-open:border-danger",
            className,
          )}
        >
          <span aria-hidden className="inline-flex shrink-0 text-fg-muted">
            <RiCalendarLine size={16} />
          </span>
          <span className="flex min-w-0 flex-1 items-center overflow-hidden">
            {hasValue ? (
              <span className="truncate">{displayValue}</span>
            ) : (
              <span className="truncate text-fg-muted">{placeholder ?? ""}</span>
            )}
          </span>
          {clearable && hasValue && !disabled ? (
            <button
              type="button"
              aria-label="Limpar data"
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

        <Popover.Portal container={portalContainer ?? undefined}>
          <Popover.Positioner
            className="z-50 outline-none"
            sideOffset={4}
            align="start"
          >
            <Popover.Popup
              initialFocus={() => focusedCellRef.current}
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
              <DatePickerCalendar
                value={value}
                min={min}
                max={max}
                onSelectDate={selectDate}
                titleId={titleId}
                focusedCellRef={focusedCellRef}
                active={open}
              />

              <div className="mt-2 border-t border-border-subtle pt-2">
                <button
                  type="button"
                  disabled={todayDisabled}
                  onClick={() => selectDate(today)}
                  className={cn(
                    "h-8 w-full rounded-md font-sans text-body-sm font-medium text-accent",
                    "scale-100 transition-[background-color,transform,opacity,scale] duration-150 ease-out",
                    "active:scale-[0.97]",
                    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
                    "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-hover",
                    "disabled:pointer-events-none disabled:opacity-50",
                  )}
                >
                  Hoje
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
