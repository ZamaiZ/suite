"use client"

import { Field, FieldLabel } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { TimePicker } from "@/components/custom/TimePicker"
import {
  parseHoursLines,
  toHoursLines,
  WEEKDAYS,
  type DayHours,
} from "@/lib/briefing/hours"
import { cn } from "cn"
import { RiTimeLine } from "react-icons/ri"
import type { BriefingHoursEditorProps } from "./BriefingHoursEditor.types"

export function BriefingHoursEditor({
  id,
  value,
  onChange,
  disabled,
}: BriefingHoursEditorProps) {
  const days = parseHoursLines(value)

  function updateDay(index: number, partial: Partial<DayHours>) {
    const next = days.map((day, i) =>
      i === index ? { ...day, ...partial } : day,
    )
    onChange(toHoursLines(next))
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="inline-flex items-center gap-1.5 text-xs/relaxed font-medium text-muted-foreground">
        <RiTimeLine size={14} aria-hidden className="text-primary" />
        Horário de funcionamento
      </p>
      <div className="grid gap-2">
        {days.map((day, index) => {
          const label =
            WEEKDAYS.find((item) => item.id === day.weekday)?.label ??
            day.weekday
          const timesDisabled = disabled || day.closed
          return (
            <div
              key={day.weekday}
              className={cn(
                "rounded-lg border border-border bg-popover px-3 py-2.5",
                day.closed && "opacity-80",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs/relaxed font-medium text-foreground">
                  {label}
                </span>
                <Field orientation="horizontal" className="w-auto">
                  <FieldLabel htmlFor={`${id}-${day.weekday}-open`}>
                    {day.closed ? "Fechado" : "Aberto"}
                  </FieldLabel>
                  <Switch
                    id={`${id}-${day.weekday}-open`}
                    checked={!day.closed}
                    disabled={disabled}
                    onCheckedChange={(checked) =>
                      updateDay(index, { closed: !checked })
                    }
                  />
                </Field>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <TimePicker
                  id={`${id}-${day.weekday}-start`}
                  label="Abre"
                  value={day.open}
                  disabled={timesDisabled}
                  onValueChange={(open) => updateDay(index, { open })}
                />
                <TimePicker
                  id={`${id}-${day.weekday}-end`}
                  label="Fecha"
                  value={day.close}
                  disabled={timesDisabled}
                  onValueChange={(close) => updateDay(index, { close })}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
