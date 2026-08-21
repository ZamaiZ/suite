import { RiLightbulbLine } from "react-icons/ri"
import { LeadGbpCard } from "./LeadGbpCard"
import { cn } from "@/lib/cn"
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
        <p className="font-sans text-caption text-fg-muted">
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
                <p className="font-sans text-caption text-fg">{item.title}</p>
                {item.detail ? (
                  <p className="line-clamp-2 font-sans text-caption text-fg-muted">
                    {item.detail}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {item.source === "analyst" ? (
                  <span className="font-sans text-caption text-fg-muted">
                    Analista
                  </span>
                ) : null}
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 font-sans text-caption font-medium",
                    item.impact === "high"
                      ? "bg-warning/10 text-warning"
                      : "bg-hover text-fg-secondary",
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
