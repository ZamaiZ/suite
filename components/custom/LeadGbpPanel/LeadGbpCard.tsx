import type { ReactNode } from "react"
import { cn } from "cn"

export function LeadGbpCard({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col rounded-xl border border-border/70 bg-card p-3 shadow-xs",
        className,
      )}
    >
      <h3 className="font-heading text-sm font-semibold text-foreground">
        {title}
      </h3>
      <div className="mt-2 min-w-0 flex-1">{children}</div>
    </section>
  )
}
