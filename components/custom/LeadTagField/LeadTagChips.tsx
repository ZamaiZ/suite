import { cn } from "@/lib/cn"
import type { LeadTagChipsProps } from "./LeadTagField.types"

export function LeadTagChips({ tags, max, compact = false }: LeadTagChipsProps) {
  if (tags.length === 0) return null
  const visible = max === undefined ? tags : tags.slice(0, max)
  const hidden = max === undefined ? 0 : Math.max(0, tags.length - max)

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {visible.map((tag) => (
        <span
          key={tag.id ?? tag.name}
          className={cn(
            "inline-flex max-w-full truncate rounded-md bg-hover text-fg-secondary",
            "font-sans text-caption",
            compact ? "px-1 py-px font-normal" : "px-1.5 py-0.5 font-medium",
          )}
        >
          {tag.name}
        </span>
      ))}
      {hidden > 0 ? (
        <span
          className={cn(
            "shrink-0 font-sans text-caption text-fg-muted",
            compact ? "font-normal" : "font-medium",
          )}
        >
          +{hidden}
        </span>
      ) : null}
    </span>
  )
}
