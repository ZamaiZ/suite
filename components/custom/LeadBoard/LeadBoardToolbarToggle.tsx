import type { ReactNode } from "react"
import { cn } from "@/lib/cn"

const ACTIVE_TONE_CLASSES = {
  warning: "border-warning/40 bg-warning/10 text-warning",
  accent: "border-accent/40 bg-accent/10 text-accent",
} as const

export function LeadBoardToolbarToggle({
  pressed,
  onClick,
  icon,
  label,
  ariaLabel,
  badgeCount = 0,
  activeTone,
}: {
  pressed: boolean
  onClick: () => void
  icon: ReactNode
  label: string
  ariaLabel: string
  badgeCount?: number
  activeTone: keyof typeof ACTIVE_TONE_CLASSES
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "relative h-[var(--control-height)] rounded-md border px-3",
        "inline-flex items-center gap-1.5 font-sans text-body-sm font-medium",
        "transition-[background-color,border-color,color,transform] duration-150 ease-out",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "active:scale-[0.97]",
        pressed
          ? ACTIVE_TONE_CLASSES[activeTone]
          : "border-transparent text-fg-secondary hover:bg-hover hover:text-fg",
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
    </button>
  )
}
