"use client"

import { useState, type MouseEvent } from "react"
import { RiCalendarLine, RiCloseLine } from "react-icons/ri"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "cn"
import {
  calendarDateToCivilDate,
  civilDateToCalendarDate,
  formatDateOnly,
  isCivilDate,
  todayCivilDate,
} from "@/lib/date-time"
import type { DatePickerProps } from "./DatePicker.types"

/**
 * Data civil, sem horário. O `DateTimePicker` não serve onde a grandeza é uma
 * só: ele obriga a inventar um horário que ninguém sabe, e paga por isso com
 * dois chips e uma máquina de dois passos.
 *
 * Compõe o `Popover` de `components/ui`, e não o do pacote Base UI direto — o
 * `DateTimePicker` importa do pacote e é um dos dois itens do baseline de
 * `checks.md`; este aqui não sobe esse número.
 *
 * O nome do pacote não aparece escrito aqui de propósito: o check é um `grep`
 * textual, e um comentário que cite a string faz a contagem acusar um import
 * que não existe.
 */
export function DatePicker({
  id,
  value,
  onValueChange,
  label,
  ariaLabel,
  placeholder,
  error,
  disabled,
  clearable = false,
  min,
  max,
  className,
  onBlur,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)

  const errorId = `${id}-error`
  const hasValue = Boolean(value && isCivilDate(value))
  const displayValue = hasValue && value ? formatDateOnly(value) : ""
  const today = todayCivilDate()
  const todayDisabled = Boolean((min && today < min) || (max && today > max))

  function outOfRange(civilDate: string): boolean {
    if (!civilDate) return true
    return Boolean((min && civilDate < min) || (max && civilDate > max))
  }

  /** Escolher o dia é a decisão inteira: commita e fecha. */
  function select(civilDate: string) {
    if (!isCivilDate(civilDate) || outOfRange(civilDate)) return
    onValueChange?.(civilDate)
    setOpen(false)
  }

  function handleClear(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    onValueChange?.("")
  }

  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      {label ? (
        <label
          htmlFor={id}
          className={cn(
            "text-xs/relaxed font-medium text-muted-foreground",
            disabled ? "opacity-50" : "cursor-pointer",
            error && "text-destructive",
          )}
        >
          {label}
        </label>
      ) : null}

      {/*
        O limpar é irmão do gatilho, não filho: botão dentro de botão é HTML
        inválido, e foi por isso que o `DateTimePicker` precisou de
        `nativeButton={false} render={<div />}`. Com o irmão em absoluto, o
        gatilho continua sendo um `button` de verdade — e o `htmlFor` do rótulo
        volta a funcionar sozinho.
      */}
      <div className="relative">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            id={id}
            disabled={disabled}
            onBlur={onBlur}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            // `||`, não `??`: `displayValue` é `""` quando não há data, e o
            // vazio precisa cair para o próximo.
            aria-label={
              label
                ? undefined
                : ariaLabel || displayValue || placeholder || "Selecionar data"
            }
            className={cn(
              "flex h-7 w-full cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 shadow-xs",
              "text-xs/relaxed text-foreground outline-none",
              "transition-[background-color,border-color,color,opacity,scale] duration-150 ease-out",
              "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
              "data-popup-open:border-ring data-popup-open:ring-2 data-popup-open:ring-ring/30",
              "scale-100 active:scale-[0.97] data-pressed:scale-[0.97]",
              "disabled:pointer-events-none disabled:opacity-50",
              clearable && hasValue && !disabled && "pr-8",
              error &&
                "border-destructive focus-visible:border-destructive data-popup-open:border-destructive",
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
          </PopoverTrigger>

          <PopoverContent
            align="start"
            className="w-[18.5rem] max-w-[var(--available-width)] gap-0"
          >
            <Calendar
              mode="single"
              selected={civilDateToCalendarDate(value ?? "")}
              onSelect={(date) => {
                const civilDate = calendarDateToCivilDate(date)
                if (civilDate) select(civilDate)
              }}
              disabled={(date) => outOfRange(calendarDateToCivilDate(date))}
              autoFocus
            />
            <div className="mt-2 border-t border-border/70 pt-2">
              <button
                type="button"
                disabled={todayDisabled}
                onClick={() => select(today)}
                className={cn(
                  "h-8 w-full cursor-pointer rounded-md text-xs/relaxed font-medium text-primary",
                  "scale-100 transition-[background-color,transform,opacity,scale] duration-150 ease-out",
                  "active:scale-[0.97]",
                  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                  "disabled:pointer-events-none disabled:opacity-50",
                  "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent",
                )}
              >
                Hoje
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {clearable && hasValue && !disabled ? (
          <button
            type="button"
            aria-label="Limpar data"
            onClick={handleClear}
            className="absolute inset-y-0 right-1.5 inline-flex size-7 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          >
            <RiCloseLine size={16} aria-hidden />
          </button>
        ) : null}
      </div>

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
