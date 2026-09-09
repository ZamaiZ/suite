import { cn } from "cn"
import type { BriefingSectionCardProps } from "./BriefingSectionCard.types"

export function BriefingSectionCard({
  icon,
  title,
  description,
  children,
  index,
  className,
}: BriefingSectionCardProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-xs",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px card-highlight"
        style={{
          background:
            "linear-gradient(to right, transparent, var(--accent-subtle), transparent)",
        }}
      />
      <div className="mb-4 flex items-start gap-3">
        <span className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
          {typeof index === "number" ? (
            <span className="absolute -top-1.5 -right-1.5 inline-flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {index}
            </span>
          ) : null}
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-semibold text-foreground">
            {title}
          </h2>
          <p className="mt-0.5 text-xs/relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}
