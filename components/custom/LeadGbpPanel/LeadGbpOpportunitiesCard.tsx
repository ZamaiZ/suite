import { RiLightbulbLine } from "react-icons/ri"
import { LeadGbpCard } from "./LeadGbpCard"
import { cn } from "cn"
import { GBP_IMPACT_LABEL } from "@/lib/leads/gbp-opportunities"

export function LeadGbpOpportunitiesCard({
  items,
  title = "Oportunidades encontradas",
}: {
  items: Array<{
    id: string
    title: string
    impact: "high" | "medium"
    source?: "machine" | "analyst"
    detail?: string
  }>
  title?: string
}) {
  return (
    <LeadGbpCard title={title}>
      {items.length === 0 ? (
        <p className="text-xs/relaxed text-muted-foreground">
          Nenhum problema identificado nesta coleta.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-2.5 rounded-lg px-1 py-1"
            >
              <span
                aria-hidden
                className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning"
              >
                <RiLightbulbLine size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs/relaxed text-foreground">{item.title}</p>
                {item.detail ? (
                  <p className="line-clamp-2 text-xs/relaxed text-muted-foreground">
                    {item.detail}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {item.source === "analyst" ? (
                  <span className="text-xs/relaxed text-muted-foreground">
                    Analista
                  </span>
                ) : null}
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-xs/relaxed font-medium",
                    item.impact === "high"
                      ? "bg-warning/10 text-warning"
                      : "bg-accent text-muted-foreground",
                  )}
                >
                  {GBP_IMPACT_LABEL[item.impact]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </LeadGbpCard>
  )
}
