"use client"

import { useId } from "react"
import { RadioGroup } from "@/components/ui/radio-group"
import { cn } from "cn"
import type { BriefingChoiceCardGroupProps } from "./BriefingChoiceCard.types"

export function BriefingChoiceCardGroup({
  value,
  onValueChange,
  name,
  disabled = false,
  label,
  className,
  contentClassName,
  children,
}: BriefingChoiceCardGroupProps) {
  const groupId = useId()

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      {label ? (
        <span
          id={groupId}
          className="text-xs/relaxed font-medium text-muted-foreground"
        >
          {label}
        </span>
      ) : null}

      <RadioGroup
        value={value}
        onValueChange={(next) => onValueChange?.(String(next))}
        name={name}
        disabled={disabled}
        aria-labelledby={label ? groupId : undefined}
        className={cn("grid gap-2", contentClassName)}
      >
        {children}
      </RadioGroup>
    </div>
  )
}
