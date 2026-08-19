import type { ReactNode } from "react"
import { cn } from "@/lib/cn"

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
        "flex min-h-0 flex-col rounded-xl border border-border-subtle bg-surface p-3 shadow-card",
        className,
      )}
    >
      <h3 className="font-sans text-caption font-semibold text-fg">{title}</h3>
      <div className="mt-2 min-w-0 flex-1">{children}</div>
    </section>
  )
}
