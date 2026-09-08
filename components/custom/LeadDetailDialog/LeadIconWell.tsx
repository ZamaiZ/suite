import type { IconType } from "react-icons"
import { cn } from "cn"

export function LeadIconWell({
  icon: Icon,
  className,
}: {
  icon: IconType
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-primary",
        className,
      )}
    >
      <Icon size={14} />
    </span>
  )
}
