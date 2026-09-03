"use client"

import { cn } from "@/lib/cn"
import type { TextareaProps } from "./Textarea.types"

export function Textarea({
  id,
  label,
  error,
  className,
  disabled,
  rows = 4,
  ...props
}: TextareaProps) {
  const errorId = `${id}-error`

  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      {label ? (
        <label
          htmlFor={id}
          className={cn(
            "font-sans text-body-sm font-medium text-fg-secondary",
            disabled ? "opacity-50" : "cursor-text",
            error && "text-danger",
          )}
        >
          {label}
        </label>
      ) : null}

      <textarea
        {...props}
        id={id}
        rows={rows}
        disabled={disabled}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "min-h-28 w-full resize-y rounded-md border border-input-border bg-input px-3 py-2.5",
          "font-sans text-body-sm text-fg outline-none",
          "placeholder:text-fg-muted",
          "transition-[background-color,border-color,color,opacity] duration-150 ease-out",
          "focus-visible:border-accent",
          "disabled:pointer-events-none disabled:opacity-50",
          error && "border-danger focus-visible:border-danger",
        )}
      />

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
