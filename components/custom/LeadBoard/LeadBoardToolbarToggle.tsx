import type { ReactNode } from "react"
import { Toggle } from "@/components/ui/toggle"
import { cn } from "@/lib/cn"

export function LeadBoardToolbarToggle({
  pressed,
  onClick,
  icon,
  label,
  ariaLabel,
  badgeCount = 0,
}: {
  pressed: boolean
  onClick: () => void
  icon: ReactNode
  label: string
  ariaLabel: string
  badgeCount?: number
}) {
  return (
    <Toggle
      pressed={pressed}
      onPressedChange={() => onClick()}
      aria-label={ariaLabel}
      variant="outline"
      size="lg"
      className={cn(
        "relative h-[var(--control-height)] gap-1.5 px-3 font-sans text-body-sm",
        pressed
          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
          : "text-fg-secondary hover:bg-accent hover:text-fg",
      )}
    >
      {icon}
      {label}
      {badgeCount > 0 ? (
        <span
          aria-hidden
          className="absolute top-1 right-1 size-1.5 rounded-full bg-danger"
        />
      ) : null}
    </Toggle>
  )
}
