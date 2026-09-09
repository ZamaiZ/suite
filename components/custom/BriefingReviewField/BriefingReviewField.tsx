import { cn } from "cn"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type {
  BriefingReviewChipsProps,
  BriefingReviewFieldProps,
  BriefingReviewSectionProps,
} from "./BriefingReviewField.types"

export function BriefingReviewSection({
  title,
  children,
}: BriefingReviewSectionProps) {
  return (
    <Card size="sm" render={<section />} className="bg-card/60">
      <CardHeader>
        <CardTitle render={<h3 />} className="font-semibold">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  )
}

export function BriefingReviewField({
  label,
  value,
  children,
}: BriefingReviewFieldProps) {
  const display =
    children ?? (value && value.trim().length > 0 ? value.trim() : "—")
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs/relaxed font-medium text-muted-foreground">
        {label}
      </p>
      {typeof display === "string" ? (
        <p className="whitespace-pre-wrap text-xs/relaxed text-foreground">
          {display}
        </p>
      ) : (
        display
      )}
    </div>
  )
}

export function BriefingReviewChips({
  label,
  items,
}: BriefingReviewChipsProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs/relaxed font-medium text-muted-foreground">
        {label}
      </p>
      {items.length === 0 ? (
        <p className="text-xs/relaxed text-foreground">—</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <li
              key={item}
              className={cn(
                "inline-flex rounded-md bg-background px-2 py-0.5",
                "text-xs/relaxed font-medium text-foreground",
              )}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function formatYesNo(value: "yes" | "no" | null | undefined): string {
  if (value === "yes") return "Sim"
  if (value === "no") return "Não"
  return "—"
}
