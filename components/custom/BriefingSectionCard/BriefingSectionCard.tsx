import { cn } from "cn"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
    <Card render={<section />} className={cn("relative", className)}>
      <div
        aria-hidden
        className="card-highlight pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(to right, transparent, color-mix(in oklch, var(--primary) 12%, transparent), transparent)",
        }}
      />
      <CardHeader className="grid-cols-[auto_1fr] items-start gap-x-3">
        <span className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
          {typeof index === "number" ? (
            <span className="absolute -top-1.5 -right-1.5 inline-flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {index}
            </span>
          ) : null}
        </span>
        <div className="min-w-0">
          <CardTitle render={<h2 />} className="font-semibold">
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  )
}
