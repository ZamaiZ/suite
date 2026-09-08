import {
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiErrorWarningLine,
  RiTimeLine,
} from "react-icons/ri"
import { LeadGbpCard } from "@/components/custom/LeadGbpPanel/LeadGbpCard"
import { cn } from "cn"
import type { DigitalPresenceCheckSection } from "@/lib/leads/digital-presence-presenters"

const STATUS_ICON = {
  ok: RiCheckboxCircleLine,
  warn: RiErrorWarningLine,
  pending: RiTimeLine,
  error: RiCloseCircleLine,
} as const

const STATUS_TONE = {
  ok: "text-success",
  warn: "text-warning",
  pending: "text-muted-foreground",
  error: "text-destructive",
} as const

export function LeadDigitalPresenceChecks({
  sections,
}: {
  sections: DigitalPresenceCheckSection[]
}) {
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {sections.map((section) => (
        <LeadGbpCard key={section.id} title={section.title}>
          <ul className="flex flex-col gap-2">
            {section.items.map((item) => {
              const Icon = STATUS_ICON[item.status]
              return (
                <li key={item.id} className="flex items-start gap-2">
                  <Icon
                    size={14}
                    aria-hidden
                    className={cn("mt-0.5 shrink-0", STATUS_TONE[item.status])}
                  />
                  <div className="min-w-0">
                    <p className="text-xs/relaxed font-medium text-foreground">
                      {item.label}
                    </p>
                    <p className="text-xs/relaxed text-muted-foreground">
                      {item.detail}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </LeadGbpCard>
      ))}
    </div>
  )
}
