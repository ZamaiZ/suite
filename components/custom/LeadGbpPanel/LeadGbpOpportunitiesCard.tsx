import { RiLightbulbLine } from "react-icons/ri"
import { LeadGbpCard } from "./LeadGbpCard"
import { cn } from "cn"
import {
  GBP_IMPACT_LABEL,
  type GbpOpportunityItem,
} from "@/lib/leads/gbp-opportunities"

/**
 * Linha da coluna de oportunidades da etapa Perfil no Google. As outras quatro
 * etapas continuam usando `LeadGbpOpportunitiesCard` abaixo — elas ainda são um
 * scroll de cards, e só esta etapa ganhou coluna própria.
 */
export function LeadGbpOpportunityItem({ item }: { item: GbpOpportunityItem }) {
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
        {GBP_IMPACT_LABEL[item.impact]}
      </span>
    </li>
  )
}

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
