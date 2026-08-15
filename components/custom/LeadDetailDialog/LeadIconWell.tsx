import type { IconType } from "react-icons"
import { cn } from "@/lib/cn"

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
        "inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-hover text-accent",
        className,
      )}
    >
      <Icon size={14} />
    </span>
  )
}
