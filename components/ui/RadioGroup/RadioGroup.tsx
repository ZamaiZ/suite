"use client"

import { createContext, useContext, useId } from "react"
import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { cn } from "@/lib/cn"
import type { RadioGroupProps, RadioProps } from "./RadioGroup.types"

type RadioGroupUiContextValue = {
  error: boolean
  disabled: boolean
}

const RadioGroupUiContext = createContext<RadioGroupUiContextValue>({
  error: false,
  disabled: false,
})

export function RadioGroup({
  value,
  defaultValue,
  onValueChange,
  name,
  disabled = false,
  required,
  error = false,
  label,
  orientation = "vertical",
  className,
  children,
}: RadioGroupProps) {
  const groupId = useId()

  return (
    <RadioGroupUiContext.Provider value={{ error, disabled }}>
      <div
        className={cn(
          "flex flex-col gap-1.5",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
      >
        {label ? (
          <span
            id={groupId}
            className={cn(
              "font-sans text-body-sm font-medium text-fg-secondary",
              error && "text-danger",
            )}
          >
            {label}
          </span>
        ) : null}

        <RadioGroupPrimitive
          value={value}
          defaultValue={defaultValue}
          onValueChange={(next) => onValueChange?.(String(next))}
          name={name}
          disabled={disabled}
          required={required}
          aria-labelledby={label ? groupId : undefined}
          aria-invalid={error || undefined}
          className={cn(
            "flex",
            orientation === "horizontal"
              ? "flex-row flex-wrap items-center gap-3"
              : "flex-col gap-2",
          )}
        >
          {children}
        </RadioGroupPrimitive>
      </div>
    </RadioGroupUiContext.Provider>
  )
}

export function Radio({
  value,
  disabled,
  label,
  id,
  className,
}: RadioProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const { error, disabled: groupDisabled } = useContext(RadioGroupUiContext)
  const isDisabled = disabled || groupDisabled

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
            isDisabled ? "cursor-default" : "cursor-pointer",
            error && "text-danger",
          )}
        >
          {label}
        </label>
      ) : null}

      <RadioPrimitive.Root
        id={inputId}
        value={value}
        disabled={disabled}
        aria-invalid={error || undefined}
        className={cn(
          "relative inline-block size-4 shrink-0 aspect-square self-center cursor-pointer rounded-full border border-input-border bg-input",
          "transition-[background-color,border-color,opacity] duration-150 ease-out motion-reduce:transition-none",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          "data-checked:border-accent",
          error && "border-danger data-checked:border-danger",
          isDisabled && "cursor-default",
        )}
      >
        <RadioPrimitive.Indicator
          className={cn(
            "absolute top-1/2 left-1/2 size-2 aspect-square -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent",
            "transition-opacity duration-150 ease-out motion-reduce:transition-none",
            error && "bg-danger",
          )}
        />
      </RadioPrimitive.Root>
    </div>
  )
}
