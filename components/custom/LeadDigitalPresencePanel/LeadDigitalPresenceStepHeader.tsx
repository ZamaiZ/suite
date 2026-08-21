"use client"

import {
  RiCheckLine,
  RiGroupLine,
  RiLoader4Line,
} from "react-icons/ri"
import { LeadIconWell } from "@/components/custom/LeadDetailDialog/LeadIconWell"

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
          <h2 className="font-sans text-caption font-semibold text-fg">
            Presença digital
          </h2>
          <p className="font-sans text-caption text-fg-muted">
            Redes, rastreamento e identidade da marca.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {saveStatus === "saving" ? (
          <span
            className="inline-flex items-center gap-1 font-sans text-caption text-fg-muted"
            aria-live="polite"
          >
            <RiLoader4Line size={14} aria-hidden className="animate-spin" />
            Salvando…
          </span>
        ) : null}
        {saveStatus === "saved" ? (
          <span
            className="inline-flex items-center gap-1 font-sans text-caption text-success"
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
