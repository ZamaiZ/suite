"use client"

import { useId } from "react"
import { RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "cn"
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
    <RadioGroupItem
      id={inputId}
      value={value}
      disabled={disabled}
      className={cn(
        "group relative flex h-auto w-full aspect-auto items-start gap-3 rounded-xl border border-border bg-popover p-3.5 text-left shadow-xs [&>[data-slot=radio-group-indicator]]:hidden",
        "transition-[background-color,border-color,box-shadow] duration-150 ease-out motion-reduce:transition-none",
        "hover:border-primary/40",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "data-checked:border-primary data-checked:bg-primary/10 data-checked:shadow-none",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        "cursor-pointer",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "relative mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-input bg-background",
          "transition-[background-color,border-color] duration-150 ease-out motion-reduce:transition-none",
          "group-data-[checked]:border-primary group-data-[checked]:bg-primary",
        )}
      >
        <span className="size-2 rounded-full bg-primary-foreground opacity-0 transition-opacity group-data-[checked]:opacity-100" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs/relaxed font-medium text-foreground">
          {title}
        </span>
        {description ? (
          <span className="mt-1 line-clamp-3 block text-xs/relaxed leading-relaxed text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </RadioGroupItem>
  )
}
