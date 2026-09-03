"use client"

import { Switch } from "@/components/ui/Switch"
import { TimePicker } from "@/components/ui/TimePicker"
import {
  parseHoursLines,
  toHoursLines,
  WEEKDAYS,
  type DayHours,
} from "@/lib/briefing/hours"
import { cn } from "@/lib/cn"
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
      <p className="inline-flex items-center gap-1.5 font-sans text-body-sm font-medium text-fg-secondary">
        <RiTimeLine size={14} aria-hidden className="text-accent" />
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
                "rounded-lg border border-border bg-elevated px-3 py-2.5",
                day.closed && "opacity-80",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-sans text-body-sm font-medium text-fg">
                  {label}
                </span>
                <Switch
                  id={`${id}-${day.weekday}-open`}
                  checked={!day.closed}
                  label={day.closed ? "Fechado" : "Aberto"}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    updateDay(index, { closed: !checked })
                  }
                />
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
