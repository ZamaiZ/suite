import {
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiTimeLine,
} from "react-icons/ri"
import { LeadGbpCard } from "@/components/custom/LeadGbpPanel/LeadGbpCard"
import { cn } from "@/lib/cn"
import type { WebsiteCheckSection } from "@/lib/leads/website-presenters"

const STATUS_ICON = {
  ok: RiCheckboxCircleLine,
  warn: RiErrorWarningLine,
  pending: RiTimeLine,
} as const

const STATUS_TONE = {
  ok: "text-success",
  warn: "text-warning",
  pending: "text-fg-muted",
} as const

export function LeadWebsiteChecks({
  sections,
}: {
  sections: WebsiteCheckSection[]
}) {
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
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
                    <p className="font-sans text-caption font-medium text-fg">
                      {item.label}
                    </p>
                    <p className="font-sans text-caption text-fg-muted">
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
