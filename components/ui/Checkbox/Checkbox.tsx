"use client"

import { useId } from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { RiCheckLine, RiSubtractLine } from "react-icons/ri"
import { cn } from "@/lib/cn"
import type { CheckboxProps } from "./Checkbox.types"

export function Checkbox({
  id,
  name,
  value,
  checked,
  defaultChecked,
  onCheckedChange,
  indeterminate = false,
  disabled,
  required,
  error = false,
  label,
  className,
}: CheckboxProps) {
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

      <CheckboxPrimitive.Root
        id={inputId}
        name={name}
        value={value}
        checked={checked}
        defaultChecked={defaultChecked}
        indeterminate={indeterminate}
        disabled={disabled}
        required={required}
        aria-invalid={error || undefined}
        onCheckedChange={(next) => onCheckedChange?.(next)}
        className={cn(
          "inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-md border border-input-border bg-input",
          "transition-[background-color,border-color,opacity] duration-150 ease-out motion-reduce:transition-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          "data-checked:border-accent data-checked:bg-accent",
          "data-indeterminate:border-accent data-indeterminate:bg-accent",
          error &&
            "border-danger data-checked:border-danger data-checked:bg-danger data-indeterminate:border-danger data-indeterminate:bg-danger",
          disabled && "cursor-default",
        )}
      >
        <CheckboxPrimitive.Indicator className="flex items-center justify-center text-accent-fg">
          {indeterminate ? (
            <RiSubtractLine size={12} aria-hidden />
          ) : (
            <RiCheckLine size={12} aria-hidden />
          )}
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    </div>
  )
}
