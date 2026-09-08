"use client"

import {
  RiBuilding4Line,
  RiCalendarEventLine,
  RiChat3Line,
  RiUserLine,
} from "react-icons/ri"
import { cn } from "cn"
import { formatDateTimeShort } from "@/lib/date-time"
import { LeadIconWell } from "./LeadIconWell"

export type LeadRecordSection = "all" | "company" | "contact" | "notes"

const ITEMS: {
  id: Exclude<LeadRecordSection, "all">
  label: string
  hint: string
  icon: typeof RiBuilding4Line
}[] = [
  {
    id: "company",
    label: "Empresa",
    hint: "Informações principais",
    icon: RiBuilding4Line,
  },
  {
    id: "contact",
    label: "Contato",
    hint: "Informações do contato",
    icon: RiUserLine,
  },
  {
    id: "notes",
    label: "Observações",
    hint: "Notas internas",
    icon: RiChat3Line,
  },
]

export function LeadRecordRail({
  section,
  createdAt,
  onSectionChange,
}: {
  section: LeadRecordSection
  createdAt: string
  onSectionChange: (section: LeadRecordSection) => void
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 px-4 py-5 sm:px-5">
      <nav aria-label="Seções do cadastro" className="flex flex-col gap-1">
        {ITEMS.map((item) => {
          const selected = section === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSectionChange(selected ? "all" : item.id)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left",
                "transition-colors duration-150 ease-out",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                selected ? "bg-primary/10" : "hover:bg-accent",
              )}
            >
              <LeadIconWell icon={item.icon} />
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-xs/relaxed",
                    selected
                      ? "font-semibold text-foreground"
                      : "font-medium text-foreground",
                  )}
                >
                  {item.label}
                </span>
                <span className="block truncate text-xs/relaxed text-muted-foreground">
                  {item.hint}
                </span>
              </span>
            </button>
          )
        })}
      </nav>

      <div className="mt-auto border-t border-border/70 pt-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <LeadIconWell icon={RiCalendarEventLine} />
          <div className="min-w-0">
            <p className="text-xs/relaxed font-medium tracking-wide text-muted-foreground uppercase">
              Criado em
            </p>
            <p className="truncate text-xs/relaxed text-foreground">
              {formatDateTimeShort(createdAt)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
