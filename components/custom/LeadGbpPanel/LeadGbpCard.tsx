import type { ReactNode } from "react"
import { cn } from "cn"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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
    <Card size="sm" render={<section />} className={cn("min-h-0", className)}>
      <CardHeader>
        <CardTitle render={<h3 />} className="font-semibold">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 flex-1">{children}</CardContent>
    </Card>
  )
}
