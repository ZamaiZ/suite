"use client"

import { useId, useRef } from "react"
import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { cn } from "@/lib/cn"
import type { SliderProps, SliderValue } from "./Slider.types"

type SliderMode = "single" | "range"

function isRange(value: SliderValue | undefined): boolean {
  return Array.isArray(value) && value.length >= 2
}

function toArray(value: SliderValue): number[] {
  return Array.isArray(value) ? [...value] : [value]
}

function fromArray(values: readonly number[], mode: SliderMode): SliderValue {
  if (mode === "range") {
    return [values[0] ?? 0, values[1] ?? values[0] ?? 0]
  }
  return values[0] ?? 0
}

function formatDisplay(values: readonly number[], mode: SliderMode): string {
  if (mode === "range") {
    return `${values[0] ?? 0} – ${values[1] ?? 0}`
  }
  return String(values[0] ?? 0)
}

export function Slider({
  id,
  name,
  value,
  defaultValue,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  error = false,
  label,
  showValue = false,
  className,
}: SliderProps) {
  const generatedId = useId()
  const rootId = id ?? generatedId
  const labelId = `${rootId}-label`

  const modeRef = useRef<SliderMode | null>(null)
  if (modeRef.current === null) {
    modeRef.current = isRange(value ?? defaultValue) ? "range" : "single"
  }
  const mode = modeRef.current
  const thumbCount = mode === "range" ? 2 : 1

  const controlled = value !== undefined

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-1.5",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <SliderPrimitive.Root
        id={rootId}
        name={name}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-labelledby={label ? labelId : undefined}
        aria-invalid={error || undefined}
        {...(controlled
          ? { value: toArray(value) }
          : defaultValue !== undefined
            ? { defaultValue: toArray(defaultValue) }
            : {})}
        onValueChange={(next) => {
          const values = Array.isArray(next) ? next : [next]
          onValueChange?.(fromArray(values, mode))
        }}
        className="flex w-full flex-col gap-1.5"
      >
        {label || showValue ? (
          <div className="flex items-center justify-between gap-2">
            {label ? (
              <span
                id={labelId}
                className={cn(
                  "font-sans text-body-sm font-medium text-fg-secondary",
                  error && "text-danger",
                )}
              >
                {label}
              </span>
            ) : (
              <span />
            )}
            {showValue ? (
              <SliderPrimitive.Value
                className="font-sans text-body-sm tabular-nums text-fg-muted"
              >
                {(_formatted, values) => formatDisplay(values, mode)}
              </SliderPrimitive.Value>
            ) : null}
          </div>
        ) : null}

        <SliderPrimitive.Control className="flex w-full touch-none items-center py-2 select-none">
          <SliderPrimitive.Track className="relative h-1.5 w-full grow rounded-full bg-border">
            <SliderPrimitive.Indicator
              className={cn(
                "absolute h-full rounded-full bg-accent",
                "transition-[background-color] duration-150 ease-out motion-reduce:transition-none",
                error && "bg-danger",
              )}
            />
            {Array.from({ length: thumbCount }, (_, index) => (
              <SliderPrimitive.Thumb
                key={index}
                index={index}
                className={cn(
                  "absolute block size-4 shrink-0 aspect-square rounded-full border border-accent bg-surface shadow-card",
                  "transition-[border-color,background-color] duration-150 ease-out motion-reduce:transition-none",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  error && "border-danger",
                  disabled && "cursor-default",
                  !disabled && "cursor-pointer",
                )}
              />
            ))}
          </SliderPrimitive.Track>
        </SliderPrimitive.Control>
      </SliderPrimitive.Root>
    </div>
  )
}
