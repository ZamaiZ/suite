import { cn } from "cn"
import type { LeadTagChipsProps } from "./LeadTagField.types"

export function LeadTagChips({
  tags,
  max,
  compact = false,
}: LeadTagChipsProps) {
  if (tags.length === 0) return null
  const visible = max === undefined ? tags : tags.slice(0, max)
  const hidden = max === undefined ? 0 : Math.max(0, tags.length - max)

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {visible.map((tag) => (
        <span
          key={tag.id ?? tag.name}
          className={cn(
            "inline-flex max-w-full truncate rounded-md bg-accent text-muted-foreground",
            "text-xs/relaxed",
            compact ? "px-1 py-px font-normal" : "px-1.5 py-0.5 font-medium",
          )}
        >
          {tag.name}
        </span>
      ))}
      {hidden > 0 ? (
        <span
          className={cn(
            "shrink-0 text-xs/relaxed text-muted-foreground",
            compact ? "font-normal" : "font-medium",
          )}
        >
          +{hidden}
        </span>
      ) : null}
    </span>
  )
}
