"use client"

import { RiCheckLine, RiGroupLine } from "react-icons/ri"
import { LeadIconWell } from "@/components/custom/LeadDetailDialog/LeadIconWell"
import { Spinner } from "@/components/ui/spinner"

export function LeadDigitalPresenceStepHeader({
  saveStatus,
}: {
  saveStatus: "idle" | "saving" | "saved" | "error"
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-2.5">
        <LeadIconWell icon={RiGroupLine} />
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-semibold text-foreground">
            Presença digital
          </h2>
          <p className="text-xs/relaxed text-muted-foreground">
            Redes, rastreamento e identidade da marca.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {saveStatus === "saving" ? (
          <span
            className="inline-flex items-center gap-1 text-xs/relaxed text-muted-foreground"
            aria-live="polite"
          >
            <Spinner aria-hidden className="size-3.5" />
            Salvando…
          </span>
        ) : null}
        {saveStatus === "saved" ? (
          <span
            className="inline-flex items-center gap-1 text-xs/relaxed text-success"
            aria-live="polite"
          >
            <RiCheckLine size={14} aria-hidden />
            Salvo agora
          </span>
        ) : null}
      </div>
    </div>
  )
}
