import { cn } from "cn"

export type StepOpportunity = {
  id: string
  title: string
  impact: "high" | "medium"
  source?: "machine" | "analyst"
  detail?: string
}

export const STEP_IMPACT_LABEL: Record<StepOpportunity["impact"], string> = {
  high: "Alto",
  medium: "Médio",
}

/** Linha da coluna de oportunidades de uma etapa. */
export function StepOpportunityItem({ item }: { item: StepOpportunity }) {
  return (
    <li className="flex items-start gap-2 rounded-lg bg-card px-2.5 py-2 ring-1 ring-foreground/[0.08]">
      <span
        aria-hidden
        className={cn(
          "mt-1.5 inline-block size-1.5 shrink-0 rounded-full",
          item.impact === "high" ? "bg-warning" : "bg-border",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs/[1.5] text-foreground">{item.title}</p>
        {item.detail ? (
          <p className="line-clamp-2 text-[11px] text-muted-foreground">
            {item.source === "analyst" ? "Analista · " : null}
            {item.detail}
          </p>
        ) : null}
      </div>
      <span
        className={cn(
          "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
          item.impact === "high"
            ? "bg-warning/10 text-warning"
            : "bg-accent text-muted-foreground",
        )}
      >
        {STEP_IMPACT_LABEL[item.impact]}
      </span>
    </li>
  )
}
