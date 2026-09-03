"use client"

import { useId } from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "@/lib/cn"
import type { SwitchProps } from "./Switch.types"

export function Switch({
  id,
  name,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  required,
  error = false,
  label,
  className,
}: SwitchProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      {label ? (
        <label
          htmlFor={inputId}
          className={cn(
            "font-sans text-body-sm font-medium text-fg-secondary",
            disabled ? "cursor-default" : "cursor-pointer",
            error && "text-danger",
          )}
        >
          {label}
        </label>
      ) : null}

      <SwitchPrimitive.Root
        id={inputId}
        name={name}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        required={required}
        aria-invalid={error || undefined}
        onCheckedChange={(next) => onCheckedChange?.(next)}
        className={cn(
          "inline-flex h-5 w-9 shrink-0 items-center cursor-pointer rounded-full border border-input-border bg-input p-0.5",
          "transition-[background-color,border-color,opacity] duration-150 ease-out motion-reduce:transition-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          "data-checked:border-accent data-checked:bg-accent",
          error && "border-danger data-checked:border-danger data-checked:bg-danger",
          disabled && "cursor-default",
        )}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            "block size-4 rounded-full bg-fg-muted",
            "transition-[translate,background-color] duration-150 ease-out motion-reduce:transition-none",
            "data-checked:translate-x-3.5 data-checked:bg-accent-fg",
          )}
        />
      </SwitchPrimitive.Root>
    </div>
  )
}
