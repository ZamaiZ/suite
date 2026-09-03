"use client"

import { useId } from "react"
import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { cn } from "@/lib/cn"
import type { BriefingChoiceCardProps } from "./BriefingChoiceCard.types"

export function BriefingChoiceCard({
  value,
  title,
  description,
  disabled,
  id,
  className,
}: BriefingChoiceCardProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <RadioPrimitive.Root
      id={inputId}
      value={value}
      disabled={disabled}
      className={cn(
        "group relative flex w-full items-start gap-3 rounded-xl border border-border bg-elevated p-3.5 text-left shadow-card",
        "transition-[background-color,border-color,box-shadow] duration-150 ease-out motion-reduce:transition-none",
        "hover:border-accent/40",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "data-checked:border-accent data-checked:bg-accent/10 data-checked:shadow-none",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        "cursor-pointer",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "relative mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-input-border bg-input",
          "transition-[background-color,border-color] duration-150 ease-out motion-reduce:transition-none",
          "group-data-[checked]:border-accent",
        )}
      >
        <RadioPrimitive.Indicator
          className={cn(
            "size-2 rounded-full bg-accent",
            "transition-opacity duration-150 ease-out motion-reduce:transition-none",
          )}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-sans text-body-sm font-medium text-fg">
          {title}
        </span>
        {description ? (
          <span className="mt-1 line-clamp-3 block font-sans text-caption leading-relaxed text-fg-secondary">
            {description}
          </span>
        ) : null}
      </span>
    </RadioPrimitive.Root>
  )
}
